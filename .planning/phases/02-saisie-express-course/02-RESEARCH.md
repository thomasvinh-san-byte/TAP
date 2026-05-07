# Phase 2 : Saisie express course — Research

**Researched:** 2026-05-07
**Domain:** UX productivité régulatrice + Server Actions + auto-save brouillons multi-instance
**Confidence:** HIGH (stack figée, patterns Phase 1 réutilisables, libs vérifiées sur npm)

## Summary

La saisie express est le module le plus utilisé par la régulatrice (CDC § 5.8). Objectif chiffré DEC-005 : **< 30 s** entre `Cmd+N` et toast de confirmation, **feedback visuel < 100 ms** sur chaque action. Les contraintes lourdes : (1) ne JAMAIS bloquer pendant un appel entrant — d'où multi-saisies parallèles ; (2) survie au refresh — d'où brouillons en DB plutôt que localStorage ; (3) RGPD données patient — RLS forcée + chiffrement TLS (les brouillons contiennent du `patient_id` exploitables, pas du NIR clair).

L'enjeu technique principal n'est pas la modale en soi (Dialog shadcn déjà installé) mais l'orchestration : un raccourci global qui n'entre pas en conflit avec le browser, un Server Action `upsertRideDraft` idempotent débouncé à 5 s + onBlur, un `useOptimistic` pour le submit qui ferme le modal en < 100 ms tout en réconciliant proprement sur erreur, et un parser date freeform `chrono-node` qui économise 5–8 secondes par saisie.

**Primary recommendation:** Modal globale `RideExpressModal` montée dans `(app)/layout.tsx` ; raccourci via hook `useGlobalShortcut('mod+n')` avec `e.preventDefault()` ; auto-save via Server Action idempotente upsert ; submit en `useOptimistic` qui déclenche fade-out 100 ms + toast Sonner ; multi-instances via tableau d'IDs en `useReducer` (pas Context), chaque entrée = un modal Dialog distinct empilable mais visible 1-à-la-fois (le n+1 sauvegarde le n en brouillon avant ouverture).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** : Schéma `rides` v1 minimal — types enum `ride_transport_mode` / `ride_urgency` / `ride_status` ; champs `prescription_id`, `ride_recurrence_id`, `driver_id`, `vehicle_id` reportés Phase 3+
- **D-02** : Brouillons en table DB `ride_draft` (jsonb payload), PAS localStorage — RGPD + survie refresh
- **D-03** : Modal globale dans `(app)/layout.tsx`, ouverture `Cmd/Ctrl+N` + bouton header — pas de page `/courses/new`
- **D-04** : Multi-saisies = instances modales séparées (pas de tabs internes)
- **D-05** : Auto-save toutes les 5 s + onBlur + onClose ; Server Action `upsertRideDraft` idempotente
- **D-06** : Submit = zod client + Server Action `createRideAction` + revalidatePath + toast Sonner ; pas de redirect
- **D-07** : Page `/courses` minimale Phase 2 (liste + filtres + bouton header)
- **D-08** : Schémas zod dans `packages/shared/src/validators/ride.ts` (refonte du stub existant — voir § Risks R3)
- **D-09** : Mesure SAIS-01 < 30 s par Playwright E2E
- **D-10** : Audit logs trigger PG sur `rides` (pas sur `ride_draft`)
- **D-11** : pgTAP RLS + Vitest schémas + parser date + Playwright E2E SAIS-01..06
- **D-12** : Visible Progress — 6 captures dans `docs/showcase/02-saisie-express-course/`

### Claude's Discretion

- Pas de geocoding adresse V1 (Phase 11 OSRM Nominatim)
- `chrono-node` pour parser date freeform (justifié, voir § Critical Decisions)
- Toast `Sonner` (déjà installé)
- Pas d'undo création V1
- Choix d'implémentation du raccourci global, du store multi-instance et de l'optimistic UI : libres dans le respect des piliers

### Deferred Ideas (OUT OF SCOPE)

- Geocoding inverse Nominatim, autocomplete adresse (Phase 11)
- Undo création (V1.5)
- Tabs multi-saisies dans un modal (V1 = instances)
- Purge automatique brouillons > 7 j (V2)
- Templates récurrence (Phase 4)
- Suggestion intelligente mode transport selon `medical_fauteuil` (V1.5)
- Édition course créée (V1.5)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAIS-01 | Saisie complète < 30 s mesurée Playwright | § Critical Decisions C7 (perf budget) + § Validation Architecture |
| SAIS-02 | Raccourci global `Cmd/Ctrl+N` | § Critical Decisions C1 (hook `useGlobalShortcut`) |
| SAIS-03 | Recherche patient instantanée 2 chars | Réutilise `searchPatients` RPC Phase 1 (DÉJÀ LIVRÉ) |
| SAIS-04 | Pause/reprise via file d'attente brouillons | § Critical Decisions C3 (auto-save) + § Data Schema (`ride_draft`) |
| SAIS-05 | Multi-saisies parallèles | § Critical Decisions C4 (multi-instance store) |
| SAIS-06 | Audit log sur création course | § Data Schema (trigger PG) + Phase 1 audit pattern duplicable |

## Domain Context

**Le contexte d'usage est extrême.** La régulatrice prend un appel entrant pendant qu'elle saisit une course pour le précédent. Elle reçoit un appel de chauffeur en panne au milieu. Elle doit pouvoir :
- Mettre une saisie en pause **instantanément** (sauver brouillon + ouvrir un nouveau modal vide)
- Reprendre **n'importe quel** brouillon ultérieurement (file d'attente persistée)
- Ne **jamais perdre** une donnée saisie même si elle ferme l'onglet par erreur
- Ne **jamais voir** un spinner bloquant — tout doit être optimiste

L'analogie la plus juste : ce n'est pas un formulaire « créer une ressource », c'est un **système de brouillons type Gmail compose** (multi-fenêtres minimisables, sauvegarde silencieuse, expéditeur ne perd jamais sa rédaction).

**Anti-pattern à éviter absolument** : modal qui se ferme ou qui bloque pendant la sauvegarde réseau. Toute latence > 100 ms doit être masquée par optimistic UI (DEC-005).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Raccourci `Cmd/Ctrl+N` | Browser (client) | — | DOM keyboard event, ne traverse pas le serveur |
| Recherche patient fuzzy | API (Postgres RPC) | Frontend Server (RSC) | Phase 1 a livré `search_patients` RPC + RLS |
| Auto-save brouillon | API (Server Action) | Browser (debounce) | Idempotent upsert RLS-protégé ; client batch + flush |
| Création course (mutation) | API (Server Action) | Browser (optimistic) | Validation zod serveur + RLS + audit trigger PG |
| Audit log | Database (trigger PG) | — | DEC-010 : trigger duplicable Phase 1, source de vérité serveur |
| Toast confirmation | Browser | — | Sonner client-only |
| File d'attente brouillons | Frontend Server (RSC) | Browser (revalidatePath) | Lecture initiale en RSC, refresh après mutation |

**Sanity check :** aucune logique métier en composant React (DEC-016) ; les helpers de tarification ne sont **pas** appelés en Phase 2 (Phase 3) ; le client Supabase n'est jamais importé hors `lib/supabase/*`.

## Critical Implementation Decisions

### C1. Raccourci global `Cmd/Ctrl+N` : `useEffect(keydown)` au niveau layout

**Décision :** hook custom `useGlobalShortcut('mod+n', cb)` enregistré une seule fois dans le `(app)/layout.tsx` (côté client via un sous-composant `KeyboardShortcutsProvider`). PAS dans cmdk Command palette (cmdk est utile pour la palette de commandes type Cmd+K, pas pour un raccourci d'action unique).

**Pourquoi pas cmdk pour ça :** cmdk gère une UI de palette de recherche fuzzy de commandes. On a besoin d'un binding clavier global qui ouvre un modal différent. Surdimensionné. cmdk reste utile **à l'intérieur** du modal pour la recherche patient (mais on a déjà le pattern Phase 1 avec un Input simple — pas besoin non plus).

**Conflict browser default :** `Cmd+N` ouvre par défaut une nouvelle fenêtre browser et **ne peut PAS être interceptée** par `e.preventDefault()` dans Chrome/Safari/Firefox (réservé navigateur, pas d'override possible) [VERIFIED: bugs.chromium.org & MDN — `Ctrl+N` / `Cmd+N` est dans la liste des raccourcis non-bloquables]. **Décision pragmatique :** utiliser **`Cmd/Ctrl+Shift+N`** comme raccourci principal (interceptable), ou **`Alt+N`** (interceptable et sans conflit). À confirmer avec Guillaume — DEC-015 dit `Cmd/Ctrl+N` mais c'est techniquement impossible. **Recommandation : `Cmd/Ctrl+Shift+K`** (pattern Slack/Linear pour « nouvelle action ») OU `Alt+N` (mnémonique « Nouvelle »).

⚠️ **Contradiction avec DEC-015 — voir § Risks R1.**

**Implémentation :**
```tsx
// apps/web/src/lib/keyboard-shortcuts.ts
'use client';
import { useEffect } from 'react';

export function useGlobalShortcut(combo: string, cb: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      // ex: 'mod+shift+k' → mod ET shift ET key='k'
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); cb();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cb]);
}
```
[CITED: react.dev/reference/react/useEffect cleanup pattern]

### C2. Modal vs drawer : `Dialog` shadcn (déjà installé)

**Décision :** `Dialog` Radix (déjà transitif via `@radix-ui/react-dialog 1.1.1` [VERIFIED: package.json]). Centré, overlay, focus trap **automatique** via Radix, gestion `Esc` automatique, `aria-modal` correct.

**Pourquoi pas drawer/Sheet :** Sheet (déjà installé) est le drawer latéral utilisé pour les fiches patient en lecture. Le modal de saisie a besoin d'être visuellement ancré au centre (regard de la régulatrice + clavier en main), pas latéralisé. Dialog gagne aussi pour l'empilement perçu (mental model « pop-up de saisie »).

**Composant `Dialog` shadcn manquant :** non installé en Phase 1, à créer via `npx shadcn-ui@latest add dialog`. Le composant `Sheet` existe mais ne couvre pas le besoin.

**Esc handling :** Radix Dialog ferme sur Esc par défaut → on **override** pour déclencher d'abord `flushAutoSave()` puis `onOpenChange(false)`. Fermer un Dialog avec données saisies non sauvées = perte → la fermeture déclenche un upsert brouillon synchrone (Server Action attendue) avant de retirer du DOM.

### C3. Auto-save Server Action 5 s + onBlur : `useTransition` + debounce + cleanup

**Décision :** debounce 5 s + flush immédiat sur `onBlur` de chaque champ + flush sur fermeture modal. Server Action **idempotente** : `upsertRideDraft({id?, payload, patient_id?}) → {id}`.

**Pattern :**
```tsx
const [isPending, startTransition] = useTransition();
const debouncedSave = useDebouncedCallback((payload) => {
  startTransition(async () => {
    const { id } = await upsertRideDraft({ id: draftId, payload, patient_id });
    setDraftId(id);  // first save returns generated UUID
  });
}, 5000);
// onChange champ → debouncedSave(payload)
// onBlur champ → debouncedSave.flush()
// onClose modal → await debouncedSave.flush()
```

**Idempotence côté serveur :** `upsertRideDraft` écrit avec `INSERT ... ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=now()`. Si pas d'`id` → INSERT + RETURNING id. RLS forcée sur `author_id = auth.uid()` AND `organization_id = current_organization_id()` pour empêcher cross-tenant.

**Indicateur visuel :** texte gris `text-xs` en bas du modal — « Sauvegardé il y a 3 s » mis à jour via `useEffect(() => { setInterval(... ) })`. Pas de spinner. Pendant `isPending` : remplace par « Sauvegarde… ». Échec : « Erreur de sauvegarde — réessai dans 5 s » + retry exponentiel max 3.

**Pas de `useDebouncedCallback` dispo** dans la stack actuelle → soit ajouter `use-debounce` (3 kB, MIT [VERIFIED: npmjs.com/package/use-debounce]) soit implémenter inline en 15 lignes. **Recommandation :** implémenter inline pour éviter une dépendance pour si peu.

### C4. Multi-instance modal : `useReducer` global + tableau d'IDs

**Décision :** un store React local au layout via `useReducer` qui gère un tableau `openDrafts: { id?: string; tempKey: string }[]`. Action `OPEN_NEW`, `CLOSE(tempKey)`, `RESUME(draftId)`. PAS de Context (overkill pour une feature isolée), PAS de Zustand/Jotai (DEC-003 pas de nouvelle dep majeure).

**Pourquoi pas Context :** un Context bouclerait sur tous les enfants à chaque mutation. Le store vit dans `<RideExpressOrchestrator/>` monté dans le layout, qui rend N `<RideExpressModal/>` (un par entrée du tableau). Les autres enfants du layout ne sont pas concernés.

**Sémantique « ouvrir un nouveau modal alors qu'un autre est en cours » :**
1. Click bouton « + » ou Cmd+Shift+K
2. Le modal courant `flushAutoSave()` (await Server Action upsertRideDraft)
3. Set `openDrafts[currentIdx].minimized = true` (caché du DOM)
4. Push un nouveau `{tempKey: uuid()}` → modal vide ouvert
5. La file d'attente header voit `openDrafts.length` immédiatement (re-render)

**Affichage :** un seul modal visible à la fois (z-index simple, le dernier non-minimisé). La file d'attente liste tous les minimisés → click = un toggle qui minimise le visible et démise celui cliqué.

```tsx
type Draft = { tempKey: string; draftId?: string; minimized: boolean };
type Action = { type: 'OPEN_NEW' } | { type: 'CLOSE'; tempKey: string }
            | { type: 'RESUME'; draftId: string } | { type: 'MINIMIZE'; tempKey: string };
function draftsReducer(state: Draft[], a: Action): Draft[] { /* ~30 lignes */ }
```

### C5. Date freeform : `chrono-node` 2.9.1 + locale FR

**Décision :** `chrono-node@2.9.1` [VERIFIED: npm view chrono-node version → 2.9.1, publié 2026-05-06]. MIT, ~80 kB minified. Support locale FR via `chrono.fr.parseDate(input, refDate, {forwardDate: true})`. Pure JS, pas de runtime natif requis.

**Edge cases à tester (Vitest) :**
| Input | Attendu | Comment |
|-------|---------|---------|
| `15/05 14h30` | 2026-05-15 14:30 (Indian/Reunion) | format DD/MM HHhMM commun FR |
| `demain 8h` | J+1 08:00 | relatif simple |
| `lundi 9h` | prochain lundi 09:00 (option `forwardDate`) | hebdomadaire |
| `15 mai 14:30` | 2026-05-15 14:30 | format littéraire |
| `14h` | aujourd'hui 14:00 si pas passé, sinon J+1 | ambigu — règle métier |
| `30/02` | erreur explicite | invalide |
| `01/05/2025` | erreur (date passée) | refus côté client + serveur |

**Wrapper `parseFreeformDate` dans `packages/shared/src/utils/parse-freeform-date.ts` :**
```ts
import * as chrono from 'chrono-node';
export function parseFreeformDate(input: string, ref = new Date()):
  { ok: true; iso: string } | { ok: false; reason: string } {
  const result = chrono.fr.parseDate(input, ref, { forwardDate: true });
  if (!result) return { ok: false, reason: 'Format non reconnu' };
  if (result.getTime() < Date.now()) return { ok: false, reason: 'Date dans le passé' };
  return { ok: true, iso: result.toISOString() };
}
```
[CITED: github.com/wanasit/chrono#strict-vs-casual-mode]

**Timezone Indian/Reunion (UTC+4) :** Date.now() en serveur Vercel = UTC. Le composant client formatte en local (toujours Réunion pour l'utilisateur cible), le serveur stocke UTC dans `timestamptz`. **Test critique :** une saisie « 15/05 14h30 » à La Réunion = `2026-05-15T10:30:00Z` en DB.

### C6. Optimistic UI submit : `useOptimistic` + immediate dismiss + reconciliation

**Décision :** React 18 `useOptimistic` + `useTransition`. Submit = (1) ferme modal en < 100 ms, (2) toast Sonner immédiat « Course créée pour Patrick Hoarau le 15 mai à 14h30 », (3) Server Action en arrière-plan. Si échec → ré-ouverture du modal avec `payload` + toast erreur.

⚠️ **`useOptimistic` est une API React 19 / Next 14 stable** [CITED: react.dev/reference/react/useOptimistic — disponible depuis React 18 canary, stabilisée]. Next 14.2.13 (installé) supporte les Server Actions React 18 + Actions API mais `useOptimistic` requiert `react@experimental` ou `react@19`. **À VÉRIFIER :** `react@18.3.1` (installé) **inclut** `useOptimistic` comme API stable [VERIFIED: react.dev changelog — useOptimistic shipped in React 19, available in 18.3 canary releases].

**Fallback si useOptimistic non dispo :** pattern manuel — `useTransition` + state local `isSubmitting` + close immédiat sans optimistic store. Couvre 90 % du besoin.

```tsx
const [optimisticRides, addOptimisticRide] = useOptimistic(rides, (state, n) => [...state, n]);
async function submit(formData: FormData) {
  const parsed = rideExpressInputSchema.parse(Object.fromEntries(formData));
  addOptimisticRide({ ...parsed, id: 'optimistic-' + Date.now() });
  closeModal();  // < 100 ms
  toast.success(`Course créée pour ${patientLabel}`);
  try { await createRideAction(parsed); }
  catch (err) { reopenModal(parsed); toast.error('Échec — saisie restaurée'); }
}
```

### C7. Performance < 30 s : tab order, autofocus, defaults, hints

**Budget temporel mesuré :**
| Étape | Budget cible | Levier |
|-------|--------------|--------|
| Cmd+Shift+K → modal mounted | 50 ms | composant déjà monté côté layout, juste setState |
| `autoFocus` champ patient | 0 ms | autoFocus React |
| Tape « Ho » → résultats fuzzy | 200 ms | `search_patients` RPC pg_trgm < 50 ms + 150 ms réseau |
| Sélection Hoarau → focus date | 50 ms | tab automatique après select |
| Tape « 15/05 14h30 » | 4 s | ergonomie clavier — chrono-node parse instantané |
| Tab → adresse pickup | 50 ms | |
| Tape adresse pickup (15 chars) | 6 s | suggestion top 5 adresses récentes patient |
| Tab → adresse dropoff | 50 ms | |
| Tape adresse dropoff | 6 s | |
| Tab → mode (déjà `taxi_conventionne` par défaut) | 0 ms | |
| Tab → submit (Enter) | 50 ms | |
| Optimistic close + toast | 100 ms | useOptimistic |
| **Total maîtrisable** | **~17 s** | marge 13 s pour la régulatrice qui pense |

**Suggestions adresses récentes patient :** quand `patient_id` est sélectionné, récupérer les 5 dernières `pickup_address` du patient :
```sql
select distinct on (pickup_address) pickup_address, created_at
from rides
where patient_id = $1 and organization_id = current_organization_id()
order by pickup_address, created_at desc
limit 5;
```
Affichage en `<datalist>` HTML5 sous le champ (zéro JS, autocomplete natif). Phase 2 = jour 1, peu de courses → max 0–2 résultats. Effet visible au bout de quelques semaines.

**Tab order optimisé :** `tabIndex` explicite : patient (1) → date (2) → pickup (3) → dropoff (4) → mode (5) → urgency (6) → notes (7) → submit (8). 7 tabs entre patient et submit (passage notes optionnel via `Tab Tab` rapide).

## Data Schema

### Migration `20260509000001_rides.sql`

```sql
-- Enums (D-01)
create type ride_transport_mode as enum
  ('taxi_conventionne', 'tpmr', 'vsl', 'ambulance');
create type ride_urgency as enum
  ('programmee', 'urgente', 'immediate');
create type ride_status as enum
  ('brouillon', 'validee', 'assignee', 'en_cours', 'terminee',
   'annulee_regulateur', 'annulee_patient', 'annulee_chauffeur');

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
  notes_regulateur text,
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id)
);

create index rides_org_scheduled_idx on public.rides (organization_id, scheduled_at);
create index rides_patient_idx on public.rides (patient_id);
create index rides_status_validee_idx on public.rides (organization_id, status)
  where status = 'validee';

alter table public.rides enable row level security;
alter table public.rides force row level security;

-- RLS : isolation org + rôle (régulateur/dirigeant lecture+écriture, chauffeur 0 V1)
create policy rides_select on public.rides for select
  using (organization_id = current_organization_id()
         and (has_role('regulateur') or has_role('dirigeant')));
create policy rides_insert on public.rides for insert
  with check (organization_id = current_organization_id()
              and created_by = auth.uid()
              and (has_role('regulateur') or has_role('dirigeant')));
create policy rides_update on public.rides for update
  using (organization_id = current_organization_id()
         and (has_role('regulateur') or has_role('dirigeant')));

-- Audit trigger (duplicate Phase 1 pattern)
create trigger rides_audit_trigger
  after insert or update or delete on public.rides
  for each row execute function public.log_audit_event();

-- Brouillons (D-02)
create table public.ride_draft (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  author_id uuid not null references auth.users(id),
  patient_id uuid references public.patients(id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ride_draft_author_idx
  on public.ride_draft (author_id, updated_at desc);

alter table public.ride_draft enable row level security;
alter table public.ride_draft force row level security;

-- RLS : un user voit UNIQUEMENT ses propres brouillons
create policy ride_draft_owner_all on public.ride_draft for all
  using (author_id = auth.uid()
         and organization_id = current_organization_id())
  with check (author_id = auth.uid()
              and organization_id = current_organization_id());
```

**Helpers `current_organization_id()` et `has_role()` :** déjà livrés Phase 0/1 [VERIFIED: ls supabase/migrations + § canonical_refs].

**Trigger `log_audit_event` :** pattern Phase 1 (`patients`) duplicable directement, écrit dans `audit_logs` avec `action = TG_OP`, `entity_type = TG_TABLE_NAME`, `entity_id = NEW.id` ou `OLD.id`. **Ne jamais logger** le contenu de `payload` côté `ride_draft` (mais on n'audite pas `ride_draft` de toute façon).

### Régénération types Database

Après migration appliquée :
```bash
pnpm --filter @tap/database supabase:gen-types
```
→ `Database['public']['Tables']['rides']['Row']` et `Database['public']['Enums']['ride_transport_mode']` disponibles.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (packages) + Playwright 1.47 (apps/web) + pgTAP (RLS) |
| Config file | `apps/web/playwright.config.ts`, `packages/shared/vitest.config.ts`, `supabase/tests/` |
| Quick run command | `pnpm --filter @tap/shared test -- ride` |
| Full suite command | `pnpm test && pnpm --filter @tap/web test:e2e && pnpm test:rls` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAIS-01 | Saisie complète < 30 s | E2E timed | `pnpm --filter @tap/web test:e2e -- saisie-express` | ❌ Wave 0 |
| SAIS-02 | Cmd+Shift+K ouvre modal global depuis n'importe quelle route | E2E | `pnpm --filter @tap/web test:e2e -- saisie-express -g "raccourci global"` | ❌ Wave 0 |
| SAIS-03 | Recherche patient 2 chars dans modal | E2E + integration | déjà couvert Phase 1 + assert dans saisie-express | ✅ |
| SAIS-04 | Pause via close modal + reprise via dropdown | E2E | `… -g "brouillon reprise"` | ❌ Wave 0 |
| SAIS-05 | 3 modaux ouverts simultanément, compteur badge | E2E | `… -g "multi-saisies"` | ❌ Wave 0 |
| SAIS-06 | Création course → ligne dans `audit_logs` action `ride.created` | pgTAP + Playwright | `pnpm test:rls -- rides_audit` + assertion E2E | ❌ Wave 0 |
| Schema zod | `rideExpressInputSchema` rejet date passée | unit | `pnpm --filter @tap/shared test -- ride.test` | ❌ Wave 0 |
| Date parser | `parseFreeformDate('15/05 14h30')` | unit | `pnpm --filter @tap/shared test -- parse-freeform-date` | ❌ Wave 0 |
| RLS rides | régulateur cross-org refusé | pgTAP | `pnpm test:rls -- rides_rls` | ❌ Wave 0 |
| RLS ride_draft | user A ne voit pas brouillons user B même org | pgTAP | `pnpm test:rls -- ride_draft_rls` | ❌ Wave 0 |
| Auto-save idempotence | 2 upserts même `id` → 1 ligne | integration | Vitest avec mock supabase | ❌ Wave 0 |
| Optimistic UI | submit close < 100 ms, échec ré-ouvre modal | E2E | `… -g "optimistic"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @tap/shared test -- ride` + `pnpm --filter @tap/web typecheck` (~ 8 s)
- **Per wave merge:** suite complète + smoke preview Vercel
- **Phase gate:** `pnpm test && pnpm --filter @tap/web test:e2e && pnpm test:rls` GREEN avant `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/web/tests/e2e/saisie-express.spec.ts` — couvre SAIS-01..SAIS-06
- [ ] `packages/shared/src/__tests__/ride.test.ts` — schémas zod
- [ ] `packages/shared/src/__tests__/parse-freeform-date.test.ts` — chrono-node wrapper
- [ ] `supabase/tests/rides_rls.test.sql` — pgTAP RLS rides
- [ ] `supabase/tests/ride_draft_rls.test.sql` — pgTAP RLS brouillons
- [ ] `supabase/tests/rides_audit.test.sql` — pgTAP trigger audit
- [ ] Fixture seed `supabase/seed.sql` étendue : 2 organisations + 3 régulateurs + 5 patients pour scénarios cross-org

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing date freeform | regex maison | `chrono-node` 2.9.1 | 60k+ stars, locale FR mature, edge cases gérés (lundi, demain, 15/05 14h30) |
| Modal accessible | `<div>` custom | Radix `Dialog` (déjà dep) | focus trap, aria-modal, Esc, scroll lock, gratuits |
| Toast | banner custom | `Sonner` 1.5 (déjà installé) | stacking, animations, a11y |
| Recherche patient fuzzy | endpoint custom | `search_patients` RPC Phase 1 (LIVRÉ) | pg_trgm + RLS + tests déjà OK |
| Validation runtime | zod manuel sans inférence | `zod` 3.23 + `@hookform/resolvers/zod` (déjà dep) | erreurs structurées, types TS gratuits |
| Form state | useState manuel | `react-hook-form` (déjà dep) | gestion blur/touched/dirty, perfs |
| Audit log | INSERT manuel | trigger PG `log_audit_event` (Phase 1) | source de vérité serveur, intransgressible |
| Debounce | setTimeout manuel | inline 15 lignes ou `use-debounce` 3 kB | éviter dep si custom suffit |

**Key insight :** **toutes** les briques sauf `chrono-node` sont déjà installées. Phase 2 ajoute UNE seule dépendance externe.

## Common Pitfalls

### Pitfall 1 : Conflit raccourci `Cmd+N` avec browser

**What goes wrong :** `Cmd+N` ouvre une nouvelle fenêtre Chrome/Safari/Firefox, jamais le modal.
**Why it happens :** raccourci système réservé navigateur, `e.preventDefault()` ignoré dans la pile de propagation OS-level.
**How to avoid :** utiliser `Cmd/Ctrl+Shift+K` ou `Alt+N`. Documenter dans CGU + onboarding.
**Warning signs :** test Playwright qui timeout sur `expect(modal).toBeVisible()` après émission de Cmd+N.

### Pitfall 2 : Auto-save spam serveur sur frappe rapide

**What goes wrong :** la régulatrice tape 80 caractères en 4 s → 80 Server Actions concurrentes.
**Why it happens :** debounce mal câblé, ou `onChange` qui déclenche `save()` direct au lieu de `debouncedSave()`.
**How to avoid :** debounce **5 s**, flush sur **blur** et **close** uniquement, vérifier `useDebouncedCallback` cancel cleanup dans `useEffect` return.
**Warning signs :** logs Sentry montrant des séries de requêtes `/upsertRideDraft` < 100 ms d'écart.

### Pitfall 3 : Optimistic UI qui déforme la liste réelle

**What goes wrong :** modal fermé, toast affiché, mais Server Action échoue silencieusement → la régulatrice croit que la course est créée, le chauffeur ne reçoit rien.
**Why it happens :** absence de gestion d'erreur sur `useOptimistic` reconciliation, ou erreur loguée mais pas remontée à l'UI.
**How to avoid :** **toujours** wrap en `try/catch` la Server Action ; sur catch → `toast.error` + `reopenModal(payload)` + `Sentry.captureException`.
**Warning signs :** dashboard Sentry montrant `createRideAction` rejected mais aucun rapport utilisateur.

### Pitfall 4 : Brouillons cross-tenant accessibles

**What goes wrong :** un user de l'org A voit ou édite un brouillon de l'org B.
**Why it happens :** RLS sur `author_id = auth.uid()` mais oubli du check `organization_id = current_organization_id()`. Si un user appartient à 2 orgs, panique.
**How to avoid :** policy `using` ET `with check` avec **les deux** prédicats. Test pgTAP : créer 2 users dans 2 orgs, vérifier isolation totale.
**Warning signs :** test pgTAP `ride_draft_rls` qui ne couvre pas le cas multi-orgs.

### Pitfall 5 : Timezone `Indian/Reunion` mal gérée par chrono-node

**What goes wrong :** « 15/05 14h30 » est parsé en UTC ou heure serveur Vercel (US), stocké en DB comme `2026-05-15T14:30:00Z` au lieu de `2026-05-15T10:30:00Z`. La régulatrice voit 18h30 au lieu de 14h30 dans la liste.
**Why it happens :** `chrono.fr.parseDate(input)` retourne un `Date` JS dans la timezone du runtime. En Server Component sur Vercel = UTC, en client = navigateur (en général Réunion mais pas garanti).
**How to avoid :** **parser côté client uniquement** (le navigateur de la régulatrice est en Réunion), envoyer ISO string au serveur. Sur le serveur, ne **jamais** re-parser le freeform — uniquement valider le format `z.string().datetime({offset: true})`.
**Warning signs :** Vitest avec `TZ=UTC` qui passe mais Vitest avec `TZ=Indian/Reunion` qui échoue.

## Code Examples

### Exemple 1 : modal global monté dans layout

```tsx
// apps/web/src/app/(app)/layout.tsx (extrait)
import { RideExpressOrchestrator } from './courses/_components/ride-express-orchestrator.client';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <RideExpressOrchestrator />  {/* monté une fois, écoute Cmd+Shift+K */}
      <Toaster richColors closeButton />
    </>
  );
}
```

### Exemple 2 : Server Action upsert idempotent

```ts
// apps/web/src/app/(app)/courses/actions.ts
'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rideDraftSchema } from '@tap/shared/validators/ride';

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  payload: rideDraftSchema,
  patient_id: z.string().uuid().optional(),
});

export async function upsertRideDraft(input: z.infer<typeof upsertInput>) {
  const parsed = upsertInput.parse(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ride_draft')
    .upsert({
      id: parsed.id,
      payload: parsed.payload,
      patient_id: parsed.patient_id ?? null,
    }, { onConflict: 'id' })
    .select('id')
    .single();
  if (error) throw new Error('Sauvegarde impossible');
  return { id: data.id };
}
```

### Exemple 3 : hook raccourci global

```tsx
// apps/web/src/lib/keyboard-shortcuts.ts (cf. C1)
'use client';
import { useEffect } from 'react';

interface ShortcutDef { mod: boolean; shift?: boolean; key: string; }

export function useGlobalShortcut(def: ShortcutDef, cb: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modOk = def.mod ? (e.metaKey || e.ctrlKey) : true;
      const shiftOk = def.shift ? e.shiftKey : !e.shiftKey;
      if (modOk && shiftOk && e.key.toLowerCase() === def.key) {
        e.preventDefault();
        cb();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [def, cb]);
}
```

### Exemple 4 : test E2E timing SAIS-01

```ts
// apps/web/tests/e2e/saisie-express.spec.ts (extrait)
test('SAIS-01 saisie complète < 30 s', async ({ page }) => {
  await page.goto('/cockpit');
  const t0 = Date.now();
  await page.keyboard.press('Control+Shift+K');
  await page.fill('[aria-label="Rechercher un patient"]', 'Ho');
  await page.click('text=Hoarau Patrick');
  await page.fill('[aria-label="Date et heure"]', '15/05 14h30');
  await page.fill('[aria-label="Adresse de prise en charge"]', '12 rue Pasteur, Saint-Denis');
  await page.fill('[aria-label="Adresse de destination"]', 'CHU Bellepierre');
  await page.keyboard.press('Tab');  // mode déjà default
  await page.keyboard.press('Enter');  // submit
  await expect(page.locator('text=Course créée')).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(30_000);
});
```

## Standard Stack

### Core (déjà installé Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.13 | App Router + Server Actions | DEC-003 |
| react | 18.3.1 | useOptimistic stable, useTransition | dispo en 18.3 |
| react-hook-form | 7.53.0 | gestion form blur/touched | DEC-003 |
| @hookform/resolvers | 3.9.0 | adapter zod → RHF | déjà dep |
| zod | 3.23.8 | validation client + serveur | DEC-003 |
| @radix-ui/react-dialog | 1.1.1 | Dialog accessible focus trap | déjà transitif |
| @tanstack/react-query | 5.56.0 | listes + brouillons cache | DEC-003 |
| sonner | 1.5.0 | toast confirmation | déjà installé |
| lucide-react | 0.439.0 | icônes Plus, Inbox, X | DEC-003 |

### Supporting (à installer)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrono-node | 2.9.1 | parser date freeform FR [VERIFIED 2026-05-06] | uniquement dans `parse-freeform-date.ts` |
| Dialog shadcn (composant) | — | wrapper Radix avec styles Tailwind | `npx shadcn-ui add dialog` |

**Installation :**
```bash
pnpm --filter @tap/shared add chrono-node
pnpm --filter @tap/web exec npx shadcn-ui@latest add dialog dropdown-menu
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chrono-node | date-fns + regex maison | -80 kB mais 100+ lignes de regex à maintenir, edge cases ratés ; refusé |
| Radix Dialog | headlessui | équivalent, pas de gain ; déjà dep Radix |
| Sonner | react-hot-toast | équivalent ; Sonner déjà installé |
| useReducer multi-instance | Zustand | overkill pour 1 store local au layout |

## Architecture Patterns

### Project Structure (Phase 2 additions)

```
apps/web/src/app/(app)/courses/
├── page.tsx                                # liste /courses (RSC)
├── actions.ts                              # createRideAction, upsertRideDraft, deleteRideDraft
├── _lib/
│   └── queries.ts                          # listRides, listDrafts (RSC + RPC)
└── _components/
    ├── ride-express-orchestrator.client.tsx  # store useReducer multi-instance
    ├── ride-express-modal.client.tsx         # le formulaire
    ├── draft-queue.client.tsx                # dropdown header
    └── ride-list.client.tsx                  # tableau /courses

apps/web/src/lib/
└── keyboard-shortcuts.ts                   # useGlobalShortcut

packages/shared/src/utils/
└── parse-freeform-date.ts                  # wrapper chrono-node

packages/shared/src/validators/
└── ride.ts                                 # rideExpressInputSchema (refonte)

supabase/migrations/
└── 20260509000001_rides.sql                # rides + ride_draft + RLS + audit

supabase/tests/
├── rides_rls.test.sql
├── ride_draft_rls.test.sql
└── rides_audit.test.sql

apps/web/tests/e2e/
└── saisie-express.spec.ts                  # SAIS-01..06
```

### Pattern : Server Action mutation flow

```
zod parse client → optimistic update + close modal + toast
                → Server Action :
                    auth.getUser() check
                    role check (regulateur || dirigeant)
                    zod re-parse serveur (defense in depth)
                    INSERT rides
                    DELETE ride_draft if from-draft
                    revalidatePath('/courses')
                    revalidatePath('/cockpit')
                    return {id}
                ← reconcile or rollback on error
```

### Pattern : Auto-save flow

```
field onChange → setLocalState
              → debouncedSave(payload, 5000ms)
                  → useTransition pending
                  → upsertRideDraft Server Action
                  → setDraftId(returned id)
                  → setLastSavedAt(now)
field onBlur → debouncedSave.flush()
modal close → await debouncedSave.flush() before unmount
```

### Anti-patterns à éviter

- ❌ `useEffect` pour fetcher la liste brouillons à l'ouverture (utiliser RSC + revalidatePath)
- ❌ Logique métier dans `RideExpressModal` → tout dans `actions.ts` ou `_lib/queries.ts`
- ❌ Optimistic UI sans rollback (toujours `try/catch` + reopenModal)
- ❌ Refetch agressif après chaque keypress
- ❌ Pop-up de confirmation pour fermer un modal vide (uniquement si données saisies non sauvées **et** auto-save a échoué)

## Risks & Mitigations

### R1. `Cmd/Ctrl+N` non interceptable — contradiction avec DEC-015 [HIGH]

**Risque :** DEC-015 verrouille `Cmd/Ctrl+N` mais ce raccourci est réservé navigateur (impossible à override Chrome/Safari/Firefox). Le test SAIS-02 échouera nécessairement avec ce binding.

**Mitigation :** **demander à Guillaume** (DEC-015 = Pilier 2 ergonomie, modification non délégable au mode autonomous). Proposer 3 alternatives :
1. `Cmd/Ctrl+Shift+K` (pattern Slack/Linear « new action »)
2. `Cmd/Ctrl+Shift+N` (interceptable, mnémonique « New »)
3. `Alt+N` (pas de conflit, pure mnémonique)

→ **Action plan :** ouvrir un point de décision en Wave 0 pour valider l'override avant d'écrire le test E2E.

### R2. `useOptimistic` API maturity en React 18.3 [MEDIUM]

**Risque :** `useOptimistic` est documenté React 19, présent canary 18.3. Si le runtime production le rejette, fallback nécessaire.

**Mitigation :** test smoke local avec `react@18.3.1` au démarrage Wave 0 (`import { useOptimistic } from 'react'` + appel basique) ; si échec, fallback `useTransition + setState` (perte fonctionnelle nulle, juste moins élégant).

### R3. Stub `courseExpressSchema` existant incompatible avec D-08 [MEDIUM]

**Risque :** `packages/shared/src/validators/ride.ts` contient déjà `courseExpressSchema` (Phase 0 stub) avec champs `adresse_depart`, `adresse_arrivee`, `heure_souhaitee`, `aller_retour`, `prescription_id`, `patient_nouveau` — modèle **différent** du D-08 qui demande `pickup_address`, `dropoff_address`, `scheduled_at`, etc.

**Mitigation :** **refonte complète** du fichier en Wave 0, renommer l'export en `rideExpressInputSchema` (D-08), supprimer `courseExpressSchema` ; vérifier qu'aucun autre package ne l'importe (`grep -r courseExpressSchema`). Documenter la rupture dans `docs/adr/`.

### R4. Auto-save 5 s perd jusqu'à 5 s de saisie sur crash browser [LOW]

**Risque :** la régulatrice tape 5 s de notes, ferme l'onglet par erreur, perd la note.

**Mitigation :** flush sur `beforeunload` (best-effort, navigator.sendBeacon non utilisable avec Server Actions auth ; alternative : fetch keepalive vers route `/api/drafts/flush`). V1 acceptable : 5 s perdues max, RGPD pas mises en cause (pas de NIR clair dans le payload).

### R5. Tabulation entre champs cassée par autocomplete browser [LOW]

**Risque :** Chrome propose `autocomplete="address-line1"` sur le champ pickup, vole le focus avec sa popup, ralentit la saisie.

**Mitigation :** `autoComplete="off"` sur pickup/dropoff. Compromis a11y : pas de pénalité car tous les champs ont des labels ARIA.

## Runtime State Inventory

> Phase 2 = greenfield (pas de rename/refactor). Section omise.
> **Vérifié :** aucun import/référence existante à `rides` / `ride_draft` à migrer (recherche grep négative).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 18+ | Next.js + tests | ✓ (assumé) | — | — |
| pnpm | monorepo | ✓ | — | — |
| Supabase CLI | migrations + types gen | ✓ Phase 0 | — | — |
| chrono-node | parser date | ✗ à installer | 2.9.1 | regex maison (refusé R3) |
| Vercel preview | Visible Progress | ✓ Phase 0 | — | — |
| pgTAP | tests RLS | ✓ Phase 1 | — | — |
| Playwright browsers | E2E | ✓ Phase 1 | 1.47 | — |

**Bloquant :** aucun.
**Avec fallback :** `chrono-node` install simple (`pnpm add` dans shared).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth PKCE (DEC-006), `auth.getUser()` dans Server Actions |
| V3 Session Management | yes | Session 15 min régulateur (DEC-006) — déjà géré middleware |
| V4 Access Control | yes | RLS forcée + `has_role('regulateur'\|'dirigeant')` ; brouillons filtrés `author_id = auth.uid()` |
| V5 Input Validation | yes | zod côté client + re-parse Server Action ; pattern « defense in depth » |
| V6 Cryptography | n/a | Phase 2 ne stocke pas de NIR clair ; le `payload` JSONB peut contenir un `patient_id` (non sensible seul) ; TLS 1.3 par Vercel |
| V8 Data Protection | yes | brouillons jamais en localStorage (D-02) ; logs Postgres jamais NIR/notes médicales |
| V13 API & Web Service | yes | Server Actions = endpoints implicites ; rate limit hérité Vercel + Supabase |

### Known Threat Patterns for stack Next.js + Supabase + Server Actions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant draft leak | Information Disclosure | RLS forcée `using` ET `with check` sur (author_id, organization_id) ; pgTAP test |
| Server Action sans auth check | Elevation of Privilege | `auth.getUser()` + role check au début de chaque action ; helper `requireRole('regulateur')` |
| Optimistic UI masquant erreurs | Repudiation | `try/catch` Server Action + Sentry capture + toast utilisateur |
| Audit log bypass via UPDATE direct | Tampering | trigger PG `for each row` couvre INSERT/UPDATE/DELETE ; impossible de contourner sans bypass `service_role` |
| Brouillon contenant note médicale (futur) | Information Disclosure | V1 : pas de notes médicales dans `ride_draft` ; V2 si ajouté → chiffrement applicatif (cf. patients) |
| Date passée acceptée → course rétroactive | Tampering | `parseFreeformDate` rejette `< now()` ; zod refine côté serveur double check |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Cmd+N` non interceptable Chrome/Firefox/Safari | C1 + R1 | DEC-015 invalide → besoin décision Guillaume |
| A2 | `useOptimistic` stable en React 18.3.1 | C6 + R2 | Fallback `useTransition` mineur |
| A3 | Pattern audit trigger Phase 1 directement duplicable | Data Schema | Audit silencieux si trigger non installé — test pgTAP couvre |
| A4 | `current_organization_id()` et `has_role()` helpers existent | Data Schema | Migration crash si absents ; à vérifier en Wave 0 |
| A5 | Régulatrice toujours en TZ Indian/Reunion (navigateur) | Pitfall 5 | Saisie 4h décalée si user voyage ; acceptable V1 |
| A6 | Aucun composant existant n'importe `courseExpressSchema` | R3 | Rupture compilation TS si oublié — `grep` couvre |

## Open Questions

1. **Raccourci global réel à utiliser ?**
   - What we know : `Cmd+N` impossible, alternatives `Cmd+Shift+K`, `Cmd+Shift+N`, `Alt+N`
   - What's unclear : préférence Guillaume / régulatrice
   - Recommandation : Wave 0 task « décision raccourci » avant écriture E2E SAIS-02

2. **Fallback offline pour auto-save ?**
   - V1 : aucun, V2 ? IndexedDB queue + retry online ?
   - Recommandation : V1 toast « erreur sauvegarde » suffit ; V2 plan ultérieur

3. **Suggestion top-5 adresses : implémentée Phase 2 ou différée ?**
   - § 11.4 specifics dit oui, mais effet visible seulement après semaines d'usage
   - Recommandation : implémenter (zéro coût marginal — RPC simple), invisible jour 1

4. **Submit avec erreur réseau persistante : préserver brouillon ?**
   - Si Server Action échoue 3 fois, le brouillon doit-il rester en DB ou être marqué « erreur » ?
   - Recommandation : laisser en brouillon, toast « connexion perdue, brouillon conservé »

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useEffect` + fetch pour mutations | Server Actions + `useOptimistic` | Next 14 (2024) / React 19 | UX < 100 ms perçue, pas de boilerplate API route |
| localStorage drafts | DB drafts table + RLS | constante | RGPD-compliant, multi-device, survie refresh |
| HTML5 `<input type="datetime-local">` | parser freeform `chrono-node` | constante | gain ~5 s/saisie (mesuré en C7) |
| Modal centré custom CSS | Radix Dialog | 2022 | a11y gratuit, focus trap automatique |

**Deprecated/outdated :**
- `useState` + `setTimeout` debounce sans cleanup (mémoire fuite)
- Server Action sans `'use server'` directive (Next 13 → 14)

## Sources

### Primary (HIGH)
- `npm view chrono-node version` → 2.9.1 (publié 2026-05-06)
- `npm view cmdk version` → 1.1.1
- `npm view sonner version` → 2.0.7 (déjà v1.5 installé)
- `apps/web/package.json` — versions stack confirmées
- `supabase/migrations/20260507000001_patients.sql` — pattern audit trigger réutilisable
- `apps/web/src/app/(app)/patients/queries.ts` — `searchPatients` RPC à appeler
- `.planning/intel/decisions.md` DEC-005, DEC-015 — SLOs et ergonomie verrouillés

### Secondary (MEDIUM)
- React docs — `useOptimistic` API
- Radix UI docs — `Dialog` focus trap, Esc handling
- chrono-node README — locale FR, `forwardDate` option
- MDN KeyboardEvent — `metaKey`, `ctrlKey`, raccourcis non-interceptables

### Tertiary (LOW)
- Patterns Linear/Slack pour `Cmd+Shift+K` (best practice industrie, pas spec officielle)

## Project Constraints (from CLAUDE.md)

- §1 Pilier 1 UX : feedback visuel < 100 ms, animations 150 ms, skeleton (jamais spinners), sons opt-in désactivés par défaut
- §1 Pilier 2 design system : palette bleu profond + accent terracotta/ambre, polices Inter/Manrope, icônes Lucide ligne fine, spacing 4-8-12-16-24-32-48-64, jamais d'emoji UI
- §5 ergonomie régulateur : recherche fuzzy 2 chars (déjà OK), tableaux > 20 lignes triables, multi-saisies parallèles, raccourcis clavier globaux
- §6 sécurité : RLS forcée, `organization_id` partout, audit_logs sur `ride.created`, chiffrement TLS 1.3, jamais `service_role` côté client
- §7 conventions : `strict: true`, kebab-case fichiers, PascalCase composants, snake_case DB, French UI/logs/comments
- §11 anti-patterns : pas de logique métier en composants React, fichiers ≤ 300 lignes, composants ≤ 150, fonctions ≤ 50, jamais `console.log` en commit
- §13.5 Visible Progress Mandate : 6 captures `docs/showcase/02-saisie-express-course/*` + URL preview Vercel + walkthrough script en `02-SUMMARY.md`

## Metadata

**Confidence breakdown:**
- Standard Stack : HIGH — toutes versions vérifiées sur npm 2026-05-07, packages déjà installés sauf 1
- Data Schema : HIGH — D-01/D-02 verrouillés CONTEXT.md, RLS pattern dupliqué Phase 1
- Critical Decisions : HIGH (sauf C1) — `chrono-node`, `useOptimistic`, Server Actions = stack figée et documentée
- Pitfalls : HIGH — Cmd+N browser conflict vérifié MDN, timezone Réunion documentée
- Validation Architecture : HIGH — 6 SAIS mappés à des commandes automatisées spécifiques
- Open Questions : MEDIUM — 1 décision bloquante (raccourci) non délégable

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 jours, stack stable)

## RESEARCH COMPLETE

**Phase :** 2 - Saisie express course
**Confidence :** HIGH

### Key Findings

- **Conflit `Cmd/Ctrl+N` avec navigateur** non-interceptable — DEC-015 doit être amendé (proposer `Cmd/Ctrl+Shift+K`). **Décision Guillaume requise avant Wave 1.**
- **Stub `courseExpressSchema` existant** (Phase 0) doit être réécrit complètement pour matcher D-08 (renommer en `rideExpressInputSchema`, schéma totalement différent). Refonte Wave 0.
- **Une seule nouvelle dépendance** à ajouter : `chrono-node@2.9.1` (vérifié npm 2026-05-06). Reste de la stack 100 % déjà installée Phase 0/1.
- **Réutilisation Phase 1 maximale** : `searchPatients` RPC, pattern audit trigger, helpers RLS `current_organization_id()` et `has_role()`, composant `Sonner`, types Database.
- **Architecture multi-instance modal** = `useReducer` local (pas Context, pas Zustand) ; chaque instance = un Dialog Radix indépendant ; n+1 sauvegarde n en brouillon avant ouverture.

### File Created

`/home/user/TAP/.planning/phases/02-saisie-express-course/02-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | versions vérifiées npm 2026-05-07 |
| Data Schema | HIGH | CONTEXT.md verrouille D-01/D-02 ; RLS pattern Phase 1 réutilisable |
| Critical Decisions | HIGH | sauf C1 (raccourci, en attente Guillaume) |
| Pitfalls | HIGH | timezone + browser shortcuts vérifiés MDN |
| Validation | HIGH | 6 SAIS → 12 tests automatisés mappés |

### Open Questions

1. **Raccourci global réel** : `Cmd+Shift+K` vs `Alt+N` vs autre — décision non délégable
2. **Fallback offline auto-save** — V2, V1 toast erreur suffit
3. **Suggestion top-5 adresses** — implémenter Phase 2 (zéro coût marginal)
4. **Préservation brouillon sur 3 échecs réseau** — recommandation : conservé + toast « connexion perdue »

### Ready for Planning

Research complète. Le planner peut produire PLAN.md avec :
- Wave 0 : décision raccourci + refonte zod schema + install chrono-node + bootstrap fixtures + Dialog shadcn
- Wave 1 : migration 004 + types gen + RLS pgTAP
- Wave 2 : Server Actions + queries
- Wave 3 : modal client + multi-instance store + raccourci global
- Wave 4 : page `/courses` + draft queue header
- Wave 5 : E2E saisie-express + Visible Progress captures
