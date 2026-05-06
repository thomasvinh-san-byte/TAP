# Phase 1 : Référentiel patients - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Default discuss → switched to autonomous after user delegation. Décisions étayées par recherche web (chiffrement HDS, pg_trgm, UX healthcare).

<domain>
## Phase Boundary

La régulatrice peut **créer, consulter, rechercher et annoter** une fiche patient avec NIR chiffré et préférences. Cette phase délivre le référentiel patient comme **fondation** consommée par toutes les phases suivantes (saisie de course, prescriptions, courses récurrentes, SMS, planning). Aucun autre objet métier n'est ouvert ici.

**Scope inclus**
- Table `patients` + colonnes RLS-compliant
- NIR chiffré applicatif AES-256-GCM (clé hors Supabase) + recherche par hash
- Recherche fuzzy ≥ 2 caractères (nom, prénom, téléphone)
- Préférences communication (SMS / appel / aucun) + consentement SMS horodaté
- Contraintes patient typées (table satellite)
- Notes opérationnelles avec historique de versions
- Audit logs sur toute mutation et tout déchiffrement de NIR
- **Bootstrap minimal de `apps/web`** (Next.js 14 + Tailwind + shadcn/ui + login + middleware auth) — prérequis matériel à toute UI

**Scope exclus (autres phases)**
- Saisie d'une course (Phase 2)
- Tarif CGSS, récurrences (Phases 3, 4)
- Cockpit temps réel, planning Gantt (Phases 5, 6)
- Visibilité chauffeur sur les notes patient (Phase 9 — PWA chauffeur)
- Photos patient, documents joints (V2)

</domain>

<decisions>
## Implementation Decisions

### Stratégie de chiffrement NIR (zone grise n°1)

> Source : DEC-007 fixe AES-256-GCM hors Supabase. Le reste = décisions Claude étayées par recherche.

- **D-01 — Algorithme** : `AES-256-GCM` côté application via `crypto.subtle` (Edge Runtime) ou `node:crypto` (server). Taille IV = 96 bits, tag = 128 bits. Ciphertext stocké : `iv (12 bytes) || ciphertext || auth_tag (16 bytes)` en colonne `bytea`.
- **D-02 — Lieu de la clé V1** : variable d'environnement Vercel/Supabase (`APP_NIR_ENCRYPTION_KEY`), 32 octets base64. **Pragmatique** pour la beta privée, audit accès Vercel suffisant. Migration vers KMS managée (Scaleway KMS ou AWS KMS via BYOK) à acter dans **ADR-003** avant la bascule HDS production. Note : **HashiCorp Vault auto-hébergé écarté V1** — opex disproportionnée pour solo founder.
- **D-03 — Runtime de chiffrement** : **Edge Function Supabase (Deno)** dédiée — endpoints `POST /functions/v1/nir-encrypt`, `POST /functions/v1/nir-decrypt`, `POST /functions/v1/nir-hash`. Pourquoi : isolation stricte du front (la clé n'apparaît jamais dans le bundle Vercel ni dans un Server Action accessible côté client), authentification via JWT Supabase, logs concentrés.
- **D-04 — Recherche par NIR** : **HMAC-SHA256 déterministe** stocké en colonne `nir_search_hash bytea`. Clé HMAC distincte de la clé de chiffrement (`APP_NIR_SEARCH_KEY`). Le hash autorise un `=` exact mais ne permet pas de retrouver le NIR clair (one-way). Recherche par NIR clair = encoder côté Edge Function puis matcher hash. **Pas inclus dans la recherche fuzzy** — recherche dédiée NIR (champ explicite).
- **D-05 — Affichage** : NIR masqué par défaut dans toute UI (`1•••••••••76 23` — visible : sexe + 2 derniers chiffres + clé). Bouton « Afficher le NIR complet » → décryptage on-demand → ligne dans `audit_logs` (action `patient.nir.decrypt`). **Aucune log ne contient le NIR clair**, jamais.
- **D-06 — Schéma colonnes patients** :
  ```sql
  nir_encrypted    bytea,   -- iv || ciphertext || tag
  nir_search_hash  bytea,   -- HMAC-SHA256(NIR normalisé sans espaces)
  -- pas de colonne nir clair, jamais
  ```

### Moteur de recherche fuzzy (zone grise n°2)

- **D-07 — Moteur** : `pg_trgm` + index GIN — extension Postgres native, déjà compatible Supabase, latence < 50 ms à plusieurs centaines de milliers de patients par tenant. Validé par l'usage standard healthcare/SaaS.
- **D-08 — Champs cherchés** : `nom`, `prénom`, `telephone` (forme normalisée sans espaces). **Pas d'adresse V1** (risque d'exposition d'adresses santé via XSS ou bug RLS, valeur opérationnelle marginale).
- **D-09 — Implémentation** :
  ```sql
  create extension if not exists pg_trgm;
  create extension if not exists unaccent;
  -- Colonne stockée pour la recherche fuzzy
  alter table patients add column search_text text generated always as (
    lower(unaccent(coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(telephone_normalized, '')))
  ) stored;
  create index patients_search_trgm_idx
    on patients using gin (search_text gin_trgm_ops);
  ```
- **D-10 — Comportement client** : déclenchement à **2 caractères** (DEC-015), debounce **150 ms** (objectif feedback < 100 ms perçu après frappe stable). Top 10 résultats triés par `similarity(search_text, query) desc`. Au-delà de 50 résultats : tronquer + bandeau « Précisez votre recherche ».
- **D-11 — Recherche dédiée NIR** : champ séparé dans l'UI (icône clé), match exact via hash. Ne mélange jamais avec la fuzzy.

### UX consultation fiche patient (zone grise n°3)

- **D-12 — Pattern d'ouverture** : **drawer latéral 400 px à droite** par défaut (depuis cockpit ou liste patients). Lien explicite « Voir la fiche complète » → page `/patients/[id]` (URL partageable, plus d'espace). Pourquoi drawer principal : DEC-015 « ne jamais bloquer la régulatrice », contexte cockpit gardé. Pourquoi page existe : URL partageable interne, audit, blocs étendus V2.
- **D-13 — Édition** : mode explicite, pas d'inline. Bouton « Modifier » → page `/patients/[id]/edit` avec formulaire shadcn/ui complet (`react-hook-form` + `zodResolver(patientSchema)`). Réduit le risque d'édition accidentelle et simplifie l'audit log (un seul commit de modification par session édition).
- **D-14 — Blocs visibles V1** (ordre fixe) :
  1. **En-tête** : initiales en pastille, nom + prénom en `text-2xl`, âge calculé, badge canal préféré (SMS / appel / aucun)
  2. **Identité administrative** : NIR masqué + bouton « Afficher », date naissance, genre
  3. **Coordonnées** : téléphone (cliquable `tel:`), adresse postale formatée, contact d'urgence (champ libre nom + tel)
  4. **Préférences communication** : canal préféré (radio), consentement SMS booléen + horodatage
  5. **Contraintes** : liste de tags typés (TPMR, oxygène, fauteuil, accompagnement obligatoire, horaire matin, horaire après-midi, autre + note libre)
  6. **Note opérationnelle active** : texte multi-lignes (≤ 500 chars), horodatage dernière modif, auteur
- **D-15 — Blocs reportés V1.5/V2** : historique courses, prescriptions actives, incidents, photos, documents joints. À ouvrir une fois Phase 5 (cockpit) et 8 (SMS) livrées.

### Modèle préférences + contraintes patient (zone grise n°4)

- **D-16 — Préférences communication** : enum `canal_contact_prefere ('sms' | 'appel' | 'aucun')` + boolean `consentement_sms` + timestamp `consentement_sms_at`. Le booléen est faux par défaut, l'horodatage est NULL tant que pas de consentement. Cohérent DEC-008 (consentement actif horodaté).
- **D-17 — Contraintes patient** : **table satellite typée** `patient_constraint`, pas de JSONB libre. Pourquoi : audit_logs propre, requêtable (« tous les patients TPMR à Saint-Denis »), validation stricte côté `packages/shared`.
  ```sql
  create type patient_constraint_type as enum (
    'medical_oxygene',
    'medical_fauteuil',
    'medical_brancard',
    'vehicule_tpmr',
    'horaire_matin',
    'horaire_apres_midi',
    'accompagnement_obligatoire',
    'autre'
  );
  create table patient_constraint (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id),
    patient_id uuid not null references patients(id) on delete cascade,
    type patient_constraint_type not null,
    note text,
    created_at timestamptz not null default now(),
    created_by uuid not null references auth.users(id)
  );
  -- Une contrainte de même type pour un patient = ok (ex: 2 lignes "horaire" matin et après-midi).
  -- Si un type doit être unique, on ajoute un index partiel après usage terrain.
  ```
- **D-18 — Notes opérationnelles** : table `patient_operational_note` (déjà au glossaire CLAUDE.md). Modèle **historique en chaîne** plutôt qu'écrasement.
  ```sql
  create table patient_operational_note (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id),
    patient_id uuid not null references patients(id) on delete cascade,
    content text not null check (length(content) <= 500),
    author_id uuid not null references auth.users(id),
    replaced_by_id uuid references patient_operational_note(id),
    created_at timestamptz not null default now()
  );
  -- Modification = INSERT nouvelle ligne + UPDATE ancienne (replaced_by_id).
  -- La régulatrice voit la note "active" (where replaced_by_id is null).
  -- Historique conservé sans coût de design supplémentaire.
  ```
- **D-19 — Visibilité notes par chauffeur** : **non en Phase 1**. La PWA chauffeur (Phase 9) verra la note active sur l'écran de course en cours, en lecture seule, sous condition d'opt-in régulatrice. Décision repoussée à Phase 9.

### Audit logs (LOCKED — DEC-010)

- **D-20 — Actions journalisées en Phase 1** :
  - `patient.created` (avec delta)
  - `patient.updated` (avec delta des champs modifiés, NIR exclu en clair)
  - `patient.archived` / `patient.unarchived`
  - `patient.nir.decrypt` (consultation NIR clair)
  - `patient_constraint.added` / `patient_constraint.removed`
  - `patient_operational_note.created` / `patient_operational_note.replaced`

### Bootstrap apps/web (gating)

- **D-21 — `apps/web` minimal** scaffolé en Phase 1, périmètre strict :
  - Next.js 14 App Router, TypeScript strict, Tailwind, shadcn/ui (init), Lucide
  - Layout racine + thèmes jour/nuit (CSS vars uniquement, pas de framework)
  - Middleware Supabase Auth (PKCE) avec redirect `/login` si non authentifié
  - Pages : `/login`, `/patients` (liste + recherche), `/patients/[id]` (page complète), `/patients/[id]/edit`
  - Composant `PatientDrawer` (drawer fiche réutilisable)
  - **Pas de cockpit, pas de saisie express** — Phase 2/5
- **D-22 — Provider state** : `@tanstack/react-query` côté client + Server Components côté serveur. Pas de Zustand/Redux V1. Cf. CLAUDE.md § 7 (« État global minimal »).

### Tests Phase 1

- **D-23 — Couverture** :
  - Validators zod (`packages/shared/src/validators/patient.ts`) : tests unitaires Vitest étendus (NIR avec/sans, contraintes, préférences)
  - Edge Function chiffrement : tests Deno (encrypt → decrypt → assert eq, hash déterministe, replay protection IV)
  - RLS : tests pgTAP sur `patients`, `patient_constraint`, `patient_operational_note` (isolation tenant, droits régulateur vs chauffeur)
  - E2E Playwright : create → search fuzzy 2 chars → open drawer → edit → audit_log apparaît
- **D-24 — Pas de couverture chiffrée 100 % branches** sur ce package (cible 100 % réservée pricing/recurrence par DEC-013). Cible Phase 1 : ≥ 80 % comme `packages/domain`.

### Claude's Discretion

Le user a explicitement délégué (« je n'ai pas à choisir cela », « no preference », « passe en autonomous »). Ces choix sont étayés par recherche externe (HDS, pg_trgm, healthcare UX) et alignés avec les 16 décisions LOCKED de PROJECT.md :

- Granularité table satellite vs JSONB pour contraintes : **typé** retenu (auditabilité, requêtes futures)
- Ordre des blocs fiche patient : **administratif → préférences → opérationnel** (pas de hiérarchie médicale, on n'est pas un EHR)
- Couleur badge canal préféré : laissée au design (cohérent palette terracotta/bleu existante)
- Composant Drawer : `Sheet` de shadcn/ui — pas custom

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Décisions de projet (LOCKED, autoritatives)
- `CLAUDE.md` — instructions racine projet, **lecture intégrale exigée**. § 1 (piliers UX), § 5 (règles UX régulateur), § 6 (RLS, chiffrement, audit logs), § 7 (conventions code), § 11 (anti-patterns)
- `.planning/PROJECT.md` § Key Decisions — DEC-001 à DEC-016 verrouillées
- `.planning/intel/decisions.md` — détail des 16 décisions
- `.planning/intel/constraints.md` — 14 contraintes (HDS, design system, code limits)
- `docs/adr/ADR-001-monorepo-turborepo.md` — `apps/*` ne dépendent QUE de `packages/*`
- `docs/adr/ADR-002-supabase-rls-multitenant.md` — RLS forcée + organization_id systématique

### Requirements de phase
- `.planning/REQUIREMENTS.md` § « Référentiel patients (PAT) » — PAT-01 à PAT-07
- `.planning/ROADMAP.md` § « Phase 1: Référentiel patients » — goal, depends-on, success criteria

### Code existant à réutiliser ou étendre
- `packages/shared/src/validators/patient.ts` — `patientSchema`, `canalContactSchema`, à étendre (contraintes, consentement_sms_at)
- `packages/shared/src/validators/common.ts` — `nirFormatSchema`, `telephoneReunionSchema`, `adresseSchema`, `codePostalReunionSchema`
- `packages/database/src/types.ts` — types Supabase à régénérer après migration 003
- `packages/database/src/client-server.ts` / `client-browser.ts` — clients Supabase typés
- `supabase/migrations/20260506000001_foundations.sql` — schéma `organizations`, `profiles`, `audit_logs`, helpers RLS (`current_organization_id`, `current_user_role`, `has_role`)
- `supabase/migrations/20260506000002_rls_foundations.sql` — pattern de RLS forcée à dupliquer pour patients

### Sources externes ayant motivé les décisions
- ANSSI / DuoKey HDS — exigence AES-256 + clé hors hébergeur (D-01, D-02)
- PostgreSQL pg_trgm + GIN — support fuzzy < 50 ms multi-millions lignes (D-07, D-09)
- HDS / RGPD niveau santé — pas de NIR en clair en log, déchiffrement audité (D-05, D-20)

### À produire en Phase 1 (pour la phase suivante)
- `supabase/migrations/20260507XXXXXX_patients.sql` — patients + patient_constraint + patient_operational_note + RLS + audit triggers
- `supabase/functions/nir/index.ts` — Edge Function encrypt/decrypt/hash
- `docs/adr/ADR-003-strategie-kms-production.md` — **placeholder** à acter avant migration HDS production (pas Phase 1, juste tracker)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `patientSchema` (zod) déjà défini dans `packages/shared/src/validators/patient.ts` — base solide, à étendre avec consentement_sms_at, structure contraintes typées
- `nirFormatSchema` existe déjà — validation format 13 chiffres + clé. À enrichir d'une fonction de **normalisation** (suppression espaces) à utiliser AVANT chiffrement et hash.
- `telephoneReunionSchema` accepte fixe + mobile 974 + format international. Réutilisable tel quel ; ajouter une fonction `normalizePhone(input) → string` pour la colonne `telephone_normalized` (recherche fuzzy).
- Helpers RLS Postgres déjà disponibles : `public.current_organization_id()`, `public.current_user_role()`, `public.has_role(role)` — à utiliser dans toutes les policies de la migration 003.

### Established Patterns
- **Pattern multi-tenant** : toute table métier porte `organization_id uuid not null references organizations(id)`. Index sur `(organization_id, ...)` systématique. RLS forcée + 4 policies (SELECT/INSERT/UPDATE/DELETE) construites sur les helpers SECURITY DEFINER.
- **Pattern audit_logs** : INSERT dans `public.audit_logs` à chaque mutation sensible. La policy `audit_logs_insert_self` autorise tout user auth à insérer dans sa propre org. Pas de UPDATE/DELETE possible (append-only).
- **Pattern validators** : zod côté client + serveur, types via `z.infer`. Messages français.
- **Pattern naming** : `snake_case` Postgres, `camelCase` TS, `kebab-case` fichiers, `PascalCase` composants React.
- **Limites code** : fichier ≤ 300 lignes, composant React ≤ 150 lignes, fonction ≤ 50 lignes, ≤ 3 niveaux d'imbrication. Composer plutôt qu'imbriquer.

### Integration Points
- **Apps/web inexistant** → la phase doit poser le scaffold minimal (le strict nécessaire pour exécuter PAT-01 à PAT-07). Phase 2 (saisie express) et Phase 5 (cockpit) viendront greffer leurs écrans.
- **packages/database/types.ts** sera régénéré (`pnpm db:types`) après migration 003 — étape obligatoire avant tout import dans `apps/web`.
- **CI** : la migration 003 doit ajouter ses tests pgTAP dans `supabase/tests/` ; les workflows existants (`.github/workflows/ci.yml`) tournent déjà `pnpm db:test`.

</code_context>

<specifics>
## Specific Ideas

### Recherche fuzzy — debounce 150 ms
Le pilier UX impose feedback < 100 ms. Le debounce client doit être à **150 ms** (compromis : assez court pour ne pas faire ressentir d'attente après dernière frappe, assez long pour éviter 5 requêtes par mot tapé). Pas plus, jamais.

### NIR masqué — format `1•••••••••76 23`
Format affiché par défaut : sexe (1 ou 2) puis bullets, puis 2 derniers chiffres du numéro et la clé. C'est le format que les régulatrices voient dans leurs outils papier actuels — alignement avec leur mental model.

### Drawer largeur fixe 400 px
Pas de drawer responsive ou redimensionnable V1. 400 px = environ 1/3 d'un écran 1280 px (cible desktop régulateur). Cohérent avec les exemples Linear / Stripe.

### Pas d'edit inline V1
Décision pragmatique : un mode édition explicite simplifie radicalement l'audit log (1 commit = 1 ligne audit) et réduit les erreurs. À reconsidérer V1.5 après feedback design partner.

### Tests E2E sur le flow complet
Au moins **un test Playwright** couvre le flow réel : login régulatrice → ouvre `/patients` → tape « ho » (2 chars) → voit « Hoarau Patrick » dans la liste → clique → drawer s'ouvre → clique « Voir la fiche complète » → page → « Modifier » → change préférence canal → save → revoit drawer avec nouveau canal → vérifie qu'une ligne `audit_logs` a été insérée.

</specifics>

<deferred>
## Deferred Ideas

### Roadmap backlog (futures phases ou phases existantes)
- **ADR-003 Stratégie KMS production** — à acter avant migration HDS. Tracker créé en placeholder ; pas Phase 1.
- **Recherche par adresse** — V1.5 si demandé par design partner avec safeguards RGPD (proximité chauffeur, par ex.)
- **Inline edit fiche patient** — V1.5 après feedback usage régulatrice
- **Historique versions notes opérationnelles dans l'UI** — V1.5 (modèle historique en chaîne stocké dès V1, juste pas affiché)
- **Photos patient** — V2, requiert stockage HDS et flux consentement spécifique
- **Visibilité chauffeur des notes patient** — Phase 9 (PWA chauffeur), avec opt-in régulatrice
- **Intégration ROR / RPPS pour autocomplétion** — out of scope V1 (alourdit conformité, pas demandé en design partner)
- **Import en masse (CSV)** — out of scope V1, valeur faible, complexité de validation forte
- **Dédoublonnage automatique** (deux patients avec même NIR) — gérer à l'INSERT (contrainte unique sur `nir_search_hash`), UI de fusion = V1.5

### Documentation produit
- Mettre à jour `CLAUDE.md` § 14 (état d'avancement) après livraison Phase 1
- Créer `docs/observations/` premier rapport au moment de la première session avec design partner régulatrice

</deferred>

---

*Phase: 01-referentiel-patients*
*Context gathered: 2026-05-06 (autonomous mode après délégation utilisateur)*
