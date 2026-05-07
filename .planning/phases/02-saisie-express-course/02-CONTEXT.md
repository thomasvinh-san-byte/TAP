# Phase 2 : Saisie express course - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Mode:** Autonomous (Phase 2 = formulaire de saisie ; scope cadré par CDC v2 module 5.8 + DEC-005/015)

<domain>
## Phase Boundary

La régulatrice peut **saisir une course en mode express** en moins de 30 secondes, depuis n'importe quel écran via le raccourci `Cmd/Ctrl+N`, avec brouillons en file d'attente locale et multi-saisies parallèles, sans jamais être bloquée par un appel téléphonique entrant.

**Scope inclus**
- Migration 004 : table `rides` (schéma minimal V1, étendable Phase 3+) + table `ride_draft` pour brouillons + RLS forcée + audit triggers
- Composant **`<RideExpressModal>`** déclenchable globalement (cmdk pattern) ou par le bouton « + » du cockpit
- Champs minimum requis Phase 2 : `patient_id`, `pickup_address`, `dropoff_address`, `scheduled_at`, `transport_mode` (taxi / TPMR / VSL / ambulance), `urgency` (programmée / urgente)
- Champs reportés Phase 3 (pricing) et Phase 4 (récurrences) : tarification, prescription_id, ride_recurrence_id
- File d'attente brouillons visible : icône cloche en header avec compteur, dropdown qui liste les brouillons reprenables
- Multi-saisies parallèles : ouvrir un nouveau modal sans fermer l'actuel = sauvegarde le courant en brouillon
- Validation : toute course créée écrit dans `audit_logs` action `ride.created`
- E2E Playwright mesure le SAIS-01 (< 30 s saisie complète course type)

**Scope exclus (autres phases)**
- Calcul tarifaire CGSS (Phase 3 — `packages/pricing`)
- Récurrences dialyse/chimio (Phase 4)
- Cockpit temps réel (Phase 5)
- Planning Gantt visualisation (Phase 6)
- Workflows imprévus (Phase 7)
- SMS confirmation patient (Phase 8)
- Assignation chauffeur en temps réel (Phase 6/9 — la course reste `unassigned` après création V1)
- OR-Tools optimization (Phase 10)
- Suggestion d'adresse / autocomplete OSRM Nominatim (V1.5 — Phase 4.5 livre le bootstrap mais geocoding reverse = Phase 11)

</domain>

<decisions>
## Implementation Decisions

### Schéma `rides` minimal V1 (D-01)

Versionnement par migrations successives — la table `rides` v1 contient le strict nécessaire pour la saisie + audit. Phase 3 ajoutera `ride_billing`, Phase 4 ajoutera `ride_recurrence_id`, Phase 6 ajoutera `driver_id` + `vehicle_id` + statuts d'exécution.

```sql
create type ride_transport_mode as enum (
  'taxi_conventionne',  -- taxi conventionné CGSS
  'tpmr',                -- transport personne à mobilité réduite (fauteuil)
  'vsl',                 -- véhicule sanitaire léger (agrément ARS)
  'ambulance'            -- ambulance (V2, juste l'enum pour future-proofing)
);

create type ride_urgency as enum (
  'programmee',          -- créneau planifié à l'avance
  'urgente',             -- à caser dans la journée
  'immediate'            -- < 1h, alerte cockpit
);

create type ride_status as enum (
  'brouillon',           -- pas encore validée (uniquement via ride_draft V1)
  'validee',             -- créée, en attente d'assignation chauffeur (V1 = état terminal)
  'assignee',            -- chauffeur affecté (Phase 6)
  'en_cours',            -- chauffeur a démarré (Phase 9)
  'terminee',            -- course clôturée (Phase 9)
  'annulee_regulateur',  -- annulée avant assignation
  'annulee_patient',     -- annulée par patient (Phase 7 imprévus)
  'annulee_chauffeur'    -- annulée par chauffeur (Phase 7 imprévus)
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid not null references public.patients(id),
  scheduled_at timestamptz not null,
  pickup_address text not null,
  pickup_postal_code text,
  pickup_city text,
  dropoff_address text not null,
  dropoff_postal_code text,
  dropoff_city text,
  transport_mode ride_transport_mode not null default 'taxi_conventionne',
  urgency ride_urgency not null default 'programmee',
  status ride_status not null default 'validee',
  notes_regulateur text,                -- note libre régulatrice (≤ 500 chars)
  -- Champs futurs commentés pour rappel (à activer en migrations 005/006/007) :
  -- prescription_id uuid references public.prescriptions(id),
  -- ride_recurrence_id uuid references public.ride_recurrences(id),
  -- driver_id uuid references public.drivers(id),
  -- vehicle_id uuid references public.vehicles(id),
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id)
);

create index rides_org_scheduled_idx on public.rides (organization_id, scheduled_at);
create index rides_patient_idx on public.rides (patient_id);
create index rides_status_idx on public.rides (organization_id, status) where status = 'validee';
```

### Brouillons : `ride_draft` table DB (D-02)

**Pas localStorage** — les brouillons doivent survivre à un rafraîchissement, à une fermeture d'onglet, à un changement d'appareil. RGPD : un brouillon contient potentiellement des données patient → DB chiffrée RLS plutôt que browser storage non protégé.

```sql
create table public.ride_draft (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  author_id uuid not null references auth.users(id),
  patient_id uuid references public.patients(id),         -- nullable (pas encore choisi)
  payload jsonb not null,                                  -- formData partielle, validée à la submit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS : un user voit uniquement SES PROPRES brouillons (author_id = auth.uid())
-- + isolation organization_id habituelle
create index ride_draft_author_idx on public.ride_draft (author_id, updated_at desc);
```

Pas de TTL automatique V1 (V2 si on voit des brouillons abandonnés s'accumuler — purge après 7j). L'utilisateur peut les supprimer manuellement.

### Pattern d'ouverture : Modal global + cmdk (D-03)

**Modal global** monté dans `(app)/layout.tsx`, visible sur toutes les routes authentifiées. Ouverture via :
- **Raccourci clavier global `Cmd/Ctrl+N`** (overrides browser default si focus dans body)
- Bouton **« Nouvelle course »** dans le header (icône `Plus` Lucide, `text-primary`, ≥ 40 px hauteur)
- Click sur un brouillon dans la file d'attente → réouvre le modal avec payload restauré

**Pas de page dédiée `/courses/new`** V1 — la saisie express est par essence en surcouche de l'écran courant pour ne jamais bloquer la régulatrice (DEC-015 : « ne pas bloquer pendant un appel »). Une page dédiée existera Phase 5/6 pour la saisie longue (rare).

Bibliothèque : composant `Dialog` + `Command` shadcn/ui — déjà disponibles ou installables sans nouvelle dep majeure (DEC-003). Si `cmdk` package séparé requis, ajouter (déjà transitif via shadcn).

### Multi-saisies parallèles (D-04)

Quand l'utilisateur ouvre un 2e modal alors que le 1er n'est pas validé :
- Auto-sauvegarde du 1er en `ride_draft` (Server Action `upsertRideDraft(payload)`)
- Compteur header décrément/incrément en temps réel
- Le 2e modal s'ouvre vide, le 1er reste accessible via la file d'attente

**Pas de tabs visuels** dans le même modal — chaque saisie = une instance modale. Décision pragmatique : moins de complexité d'état React, mental model 1-modal-1-saisie aligne avec DEC-015 « 1 écran = 1 action principale ».

### Auto-save fréquente (D-05)

Toutes les 5 secondes ET sur blur de chaque champ ET sur fermeture du modal sans submit. Server Action `upsertRideDraft({id?, payload, patient_id?})` — idempotente, retourne le `ride_draft.id` créé/mis à jour.

**Pas de debounce trop long** — la régulatrice peut être interrompue à tout moment. 5s est l'équilibre acceptable entre charge serveur et fraîcheur du brouillon.

### Validation et création (D-06)

À la submit (bouton « Créer » en bas du modal) :
1. zod parse `rideSchema` côté client (instant feedback)
2. Server Action `createRideAction(formData)` :
   - Re-validation zod côté serveur
   - Vérification `auth.getUser()` + rôle régulateur ou dirigeant
   - INSERT `rides` (statut = 'validee')
   - Si la saisie venait d'un brouillon : DELETE `ride_draft` correspondant
   - audit_logs trigger automatique
   - revalidatePath('/courses') + revalidatePath('/cockpit')
   - **Pas de redirect** — le modal se ferme, un toast `<Sonner>` confirme « Course créée pour Patrick Hoarau le 15 mai à 14h30 »

Le modal ne navigue pas — on reste sur l'écran courant (cockpit, planning, ou autre).

### Page liste `/courses` (D-07)

Une page `/courses` minimale Phase 2 : liste des courses créées (toutes statuts, ordre `scheduled_at desc`), avec recherche par patient, filtre par statut/urgency/transport_mode, et lien vers fiche patient. Pas de drag-and-drop V1 (Phase 6 — Gantt).

**Header global** : bouton « + Nouvelle course » qui ouvre le modal express. Compteur brouillons visible avec dropdown.

### `zod` schémas (D-08)

`packages/shared/src/validators/ride.ts` (existe déjà en stub Phase 0 — à étendre) :

```ts
export const rideTransportModeSchema = z.enum([
  'taxi_conventionne', 'tpmr', 'vsl', 'ambulance',
]);
export const rideUrgencySchema = z.enum(['programmee', 'urgente', 'immediate']);

export const rideExpressInputSchema = z.object({
  patient_id: z.string().uuid('Patient requis'),
  scheduled_at: z.string().datetime({ offset: true, message: 'Date/heure requise' }),
  pickup_address: z.string().trim().min(3, 'Adresse de prise en charge requise').max(200),
  pickup_postal_code: codePostalReunionSchema.optional(),
  pickup_city: z.string().trim().max(80).optional(),
  dropoff_address: z.string().trim().min(3, 'Adresse de destination requise').max(200),
  dropoff_postal_code: codePostalReunionSchema.optional(),
  dropoff_city: z.string().trim().max(80).optional(),
  transport_mode: rideTransportModeSchema.default('taxi_conventionne'),
  urgency: rideUrgencySchema.default('programmee'),
  notes_regulateur: z.string().trim().max(500).optional(),
});
export type RideExpressInput = z.infer<typeof rideExpressInputSchema>;

// Brouillon : tous champs optionnels (sauf patient_id si présent doit être valide)
export const rideDraftSchema = rideExpressInputSchema.partial();
```

### Performance < 30 s (D-09)

Mesure E2E Playwright stricte : `tests/e2e/saisie-express.spec.ts` lance le scénario suivant et vérifie que le temps total entre `Cmd+N` et toast confirmation est < 30 secondes :
1. Cmd+N → modal ouvre
2. Tape « Ho » dans le champ patient → fuzzy retourne « Hoarau Patrick »
3. Sélectionne Hoarau
4. Tape adresse pickup (autocomplete adresse vide V1 — saisie libre)
5. Tape adresse dropoff
6. Tape date+heure dans champ unique « 15/05 14h30 » (parsing libre via library `chrono-node` ou DateInput shadcn)
7. Mode transport déjà à `taxi_conventionne` par défaut → laisse
8. Submit → toast

**Optimisations garantissant < 30 s :**
- Recherche patient instantanée (déjà Phase 1, RPC < 50 ms)
- Champs intelligents : la saisie d'une adresse réutilise les adresses précédentes du patient (top 5 récentes via subquery)
- Date/heure : input libre + parsing client (pas un date picker à plusieurs clics)
- Tab order optimisé : patient → date → pickup → dropoff → mode → submit (8 tabs max)
- Submit déclenche optimistic UI : modal fade-out 100 ms + toast immédiat (réconciliation après mutation)
- Échec mutation = toast erreur + ré-ouverture modal avec données préservées

### Audit logs (D-10)

Trigger PG (pattern Phase 1) sur `rides` : INSERT/UPDATE/DELETE → `audit_logs` action `ride.created` / `ride.updated` / `ride.archived`. **Pas d'audit pour `ride_draft`** (donnée transitoire).

### Tests (D-11)

- pgTAP : RLS rides + ride_draft (régulateur voit ses propres brouillons + courses de son org, chauffeur ne voit rien V1)
- Vitest : `rideExpressInputSchema` cas critiques (NIR-like patient_id, postal codes 974, dates passées rejetées)
- Vitest : helper `parseFreeformDate('15/05 14h30')` cas multiples (DD/MM, HHhMM, demain, lundi prochain, etc.)
- Playwright : `tests/e2e/saisie-express.spec.ts` mesure SAIS-01 (timing < 30 s) + SAIS-02 (Cmd+N global) + SAIS-03 (pause/reprise brouillon) + SAIS-04 (recherche fuzzy 2 chars OK déjà Phase 1) + SAIS-05 (multi-saisies) + SAIS-06 (audit log)
- Smoke preview : `tests/smoke/preview.spec.ts` étendu — vérifie que `/courses` répond + le bouton + global existe

### Visible Progress Mandate (D-12)

Avant le commit de finalisation Phase 2, `docs/showcase/02-saisie-express-course/` contient :
- `01-modal-express-vide.png` — modal après Cmd+N, focus dans patient
- `02-modal-recherche-patient.png` — fuzzy 2 chars « Ho » → résultats
- `03-modal-rempli-prêt-submit.png` — tous champs remplis
- `04-toast-creation-confirmee.gif` — submit + fade-out + toast (≤ 30 s perçu)
- `05-brouillons-dropdown-3-en-attente.png` — multi-saisies en parallèle
- `06-page-courses-liste-30j.png` — page /courses avec courses seedées

Walkthrough script (10 étapes) inclus dans `02-SUMMARY.md`.

### Claude's Discretion

Le user a délégué (mode autonomous) :
- Pas de geocoding adresse V1 (saisie libre) — Phase 11 OSRM advanced ajoute Nominatim reverse
- Date parser : `chrono-node` choisi (déjà 60k stars, MIT, pure JS, support FR) — nouvelle dep mineure justifiée par l'objectif < 30 s
- Auto-save 5s + blur — pragmatique
- Toast `Sonner` (déjà installé Phase 1)
- Pas de undo créer-supprimer V1 (la régulatrice peut archiver via UI courses, V1.5 si demandé)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Décisions de projet (LOCKED)
- `CLAUDE.md` § 1 piliers UX, § 5 ergonomie régulatrice, § 6 sécurité, § 11 anti-patterns, § 13.5 Visible Progress Mandate
- `.planning/PROJECT.md` § Key Decisions — DEC-001..DEC-016
- `.planning/intel/decisions.md` — DEC-005 (saisie < 30 s), DEC-015 (raccourci Cmd+N, brouillons, multi-saisies)

### Requirements de phase
- `.planning/REQUIREMENTS.md` § « Saisie express course (SAIS) » — SAIS-01..SAIS-06
- `.planning/ROADMAP.md` § Phase 2

### Code existant à réutiliser
- `packages/shared/src/validators/ride.ts` (stub à étendre)
- `packages/shared/src/validators/common.ts` — `codePostalReunionSchema`, `telephoneReunionSchema`
- `apps/web/src/app/(app)/patients/_components/patient-search.client.tsx` — pattern fuzzy à RÉUTILISER (pas dupliquer)
- `apps/web/src/app/(app)/patients/_lib/queries.ts` — `searchPatients` RPC à appeler
- `apps/web/src/app/(app)/layout.tsx` — root layout admin où monter le modal global
- `apps/web/src/components/ui/dialog.tsx`, `command.tsx`, `sonner.tsx` (shadcn)
- `supabase/migrations/20260507000001_patients.sql` — pattern audit trigger à dupliquer
- `supabase/migrations/20260508000001_legal_compliance.sql` — pattern RLS forcée + helpers org

### Sources externes (à valider en research)
- shadcn/ui Command (cmdk) — pattern raccourci global avec `useEffect` pour `keydown`
- chrono-node — parser date freeform JS, support FR
- TanStack Query useMutation + optimistic UI patterns
- Server Actions React 19 patterns avec `useFormState` + `useOptimistic`

### À produire en Phase 2
- `supabase/migrations/2026050X_rides.sql` — tables rides + ride_draft + RLS + triggers
- `apps/web/src/app/(app)/courses/page.tsx` — liste minimale + bouton + global
- `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx` — modal global
- `apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx` — header dropdown
- `apps/web/src/app/(app)/courses/actions.ts` — Server Actions create + draft upsert/delete
- `apps/web/src/app/(app)/courses/_lib/queries.ts` — listRides + listDrafts
- `apps/web/src/lib/keyboard-shortcuts.ts` — hook global Cmd+N
- `packages/shared/src/utils/parse-freeform-date.ts` — wrapper chrono-node fr
- `apps/web/tests/e2e/saisie-express.spec.ts` — mesure SAIS-01..06
- `docs/showcase/02-saisie-express-course/*.png|gif` — captures Visible Progress

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (à NE PAS dupliquer)
- `searchPatients` RPC + UI `<PatientSearch/>` — Phase 1 livré, parfaitement utilisable dans le modal express
- `Sheet` shadcn pour le drawer (mais le modal express utilise plutôt `Dialog` — pas de drawer)
- `Sonner` toast — Phase 1 installé, pour la confirmation
- Helpers RLS DB : `current_organization_id()`, `has_role(role)` — pour les policies de `rides` et `ride_draft`
- Pattern audit trigger Phase 1 + 1.5 — duplicable sans modification (filtre colonnes sensibles trivial ici)
- Pattern `Database` typing depuis `@tap/database/types.gen.ts` — régénérer après migration 004

### Patterns à respecter
- Server Actions `'use server'` dans `actions.ts` par feature
- React Query côté client + Server Components côté server (RSC) pour la liste
- Pas de useEffect-fetch (DEC-005)
- Pas d'import @supabase/* hors wrappers `lib/supabase/*`
- Fichiers ≤ 300, composants ≤ 150, fonctions ≤ 50
- French UI/messages partout

### Integration Points
- Le bouton « + Nouvelle course » s'intègre dans `(app)/layout.tsx` ou un `header.client.tsx` partagé
- Le modal express utilise `<PatientSearch/>` interne pour l'autocomplete patient
- La page `/courses` dépend de `rides` table (Migration 004 obligatoire avant)
- Les brouillons sont visibles uniquement par leur auteur (RLS `author_id = auth.uid()`)
- L'audit log alimente la fiche patient (Phase 1 a déjà l'agrégation côté lecture, juste à étendre l'affichage Phase 5/6)

</code_context>

<specifics>
## Specific Ideas

### Date freeform parsing — comportement
La saisie « 15/05 14h30 » → 15 mai année courante 14:30 heure locale Réunion. « demain 8h » → date+heure relative. « lundi 9h » → prochain lundi. Si parsing échoue, message d'erreur sous le champ : « Format non reconnu — exemples : 15/05 14h30, demain 8h, lundi 9h ».

### Auto-suggest adresses
À chaque ouverture du modal, on récupère les 5 adresses pickup les plus récentes (60 derniers jours) du patient sélectionné depuis `rides` — `select pickup_address from rides where patient_id = $1 order by created_at desc limit 5`. Affichage en bas du champ pickup quand focus.

### Toast confirmation
« Course créée pour Patrick Hoarau, le 15 mai à 14h30 — taxi conventionné » — formatage français explicite. Action « Voir la course » qui ouvre la fiche course (page V1.5 ou drawer Phase 6).

### Compteur brouillons
`<Badge>` Lucide `Inbox` icon dans le header avec nombre de brouillons. Click → dropdown shadcn avec liste cliquable. Hover sur un brouillon = preview (patient + date + adresse). Click = réouvre modal avec payload restauré.

### Indicator d'auto-save
Pendant la saisie : petit texte gris en bas du modal « Sauvegardé il y a 3 secondes » qui se met à jour. Si pas connecté ou serveur indisponible : « Sauvegarde locale uniquement — reconnexion en cours » (V2 — V1 = juste « erreur »).

</specifics>

<deferred>
## Deferred Ideas

### V2 / V1.5
- Geocoding inverse adresse via Nominatim (Phase 11)
- Suggestion d'adresse depuis historique avec auto-complete (V1 = juste les 5 dernières en hint)
- Undo création course après submit (V1.5 — si demandé)
- Tabs multi-saisies dans un même modal (V1 = instances modales séparées)
- Purge automatique brouillons > 7j (V2)
- Templates de courses récurrentes (Phase 4)
- Suggestion intelligente de mode transport selon contraintes patient (V1.5 — `medical_fauteuil` → préselectionner TPMR)
- Edition course créée (V1.5 — Phase 6 ajoutera reassignation chauffeur via Gantt)

### Documentation
- Mettre à jour `CLAUDE.md` § 14 après livraison Phase 2

</deferred>

---

*Phase: 02-saisie-express-course*
*Context gathered: 2026-05-07 (mode autonome)*
