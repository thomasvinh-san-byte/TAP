---
phase: 01-referentiel-patients
plan: 2
type: execute
wave: 1
depends_on: [1]
files_modified:
  - supabase/migrations/20260507000001_patients.sql
  - supabase/migrations/20260507000002_search_patients_rpc.sql
  - packages/shared/src/validators/patient.ts
  - packages/shared/src/validators/patient-constraint.ts
  - packages/shared/src/validators/patient-note.ts
  - packages/shared/src/validators/index.ts
  - packages/database/src/types.ts
  - packages/database/src/types.gen.ts
autonomous: true
requirements:
  - PAT-01
  - PAT-02
  - PAT-04
  - PAT-05
  - PAT-06
  - PAT-07
must_haves:
  truths:
    - "La migration 003 s'applique localement (pnpm db:reset succeed) avec extensions pg_trgm + unaccent + wrapper unaccent_immutable"
    - "Les 3 tables (patients, patient_constraint, patient_operational_note) ont RLS forcée + 3 ou 4 policies"
    - "Les 3 fichiers pgTAP de PLAN-1 passent en GREEN après pnpm db:reset && pnpm db:test"
    - "Une INSERT sur public.patients déclenche un trigger qui insère dans audit_logs avec metadata->'new' SANS clés nir_encrypted ni nir_search_hash"
    - "L'index patients_search_trgm_idx est utilisé par EXPLAIN sur recherche 'h % o'"
    - "L'index unique partiel patients_nir_unique empêche les doublons NIR par tenant"
    - "Le validator patientSchema étendu accepte consentement_sms_at, genre, contact_urgence, archive"
    - "Les types Supabase régénérés contiennent les 3 tables et l'enum patient_constraint_type"
  artifacts:
    - path: supabase/migrations/20260507000001_patients.sql
      provides: "DDL + RLS + triggers audit + index GIN + index unique partiel NIR"
      min_lines: 200
    - path: packages/shared/src/validators/patient.ts
      provides: "patientSchema étendu + normalizeNir + normalizePhone helpers"
      min_lines: 70
    - path: packages/shared/src/validators/patient-constraint.ts
      provides: "patientConstraintTypeSchema + patientConstraintInputSchema"
      min_lines: 25
    - path: packages/shared/src/validators/patient-note.ts
      provides: "patientOperationalNoteInputSchema"
      min_lines: 15
    - path: packages/database/src/types.gen.ts
      provides: "Types Supabase régénérés depuis le schéma local"
      min_lines: 50
  key_links:
    - from: supabase/migrations/20260507000001_patients.sql
      to: public.audit_logs
      via: trigger patients_audit_trigger
      pattern: "audit_logs.*nir_encrypted"
    - from: packages/shared/src/validators/index.ts
      to: ./patient-constraint
      via: re-export
      pattern: "export \\* from './patient-constraint'"
    - from: public.patients (search_text)
      to: public.unaccent_immutable
      via: generated always as
      pattern: "unaccent_immutable"
---

<objective>
Livrer le schéma data complet de la phase 1 : migration 003 (3 tables + RLS + triggers audit + index GIN + index unique partiel NIR), validators zod étendus, helpers de normalisation, types Supabase régénérés. Cette tâche fait passer les 3 fichiers pgTAP de PLAN-1 en GREEN et fournit le contrat data consommé par PLAN-3 (Edge Function NIR), PLAN-4 (apps/web) et PLAN-5 (UI patient).

Purpose: la migration 003 est le point d'ancrage de toute la phase. Le format `nir_encrypted bytea` + `nir_search_hash bytea` + `search_text generated stored` + RLS forcée doivent être figés ici pour que les waves suivantes ne renégocient rien.

Output: 1 migration SQL ≥ 200 lignes, 2 nouveaux validators + 1 étendu, types régénérés, schema push local exécuté.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-referentiel-patients/01-CONTEXT.md
@.planning/phases/01-referentiel-patients/01-RESEARCH.md
@.planning/phases/01-referentiel-patients/01-PATTERNS.md
@CLAUDE.md
@supabase/migrations/20260506000001_foundations.sql
@supabase/migrations/20260506000002_rls_foundations.sql
@packages/shared/src/validators/patient.ts
@packages/shared/src/validators/common.ts
@packages/shared/src/validators/ride.ts
@packages/database/src/types.ts

<interfaces>
<!-- Helpers RLS Postgres déjà disponibles (migration 001 lignes 129-180) -->
public.current_organization_id() returns uuid           -- SECURITY DEFINER
public.current_user_role() returns public.user_role     -- SECURITY DEFINER
public.has_role(public.user_role) returns boolean       -- SECURITY DEFINER
public.set_updated_at() returns trigger                 -- réutilisable

<!-- Table audit_logs existante (migration 001 lignes 185-208) -->
public.audit_logs (
  id uuid pk,
  organization_id uuid not null,
  actor_id uuid references auth.users,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
)

<!-- patientSchema actuel à étendre (packages/shared/src/validators/patient.ts) -->
patientSchema: ZodObject<{
  prenom: ZodString,
  nom: ZodString,
  date_naissance: ZodString (regex AAAA-MM-JJ),
  telephone: ZodOptional<telephoneReunionSchema>,
  nir: ZodOptional<nirFormatSchema>,
  adresse: adresseSchema,
  canal_contact_prefere: ZodEnum<['sms','appel','aucun']>,
  consentement_sms: ZodBoolean,
  notes_operationnelles: ZodOptional<ZodString>
}>

<!-- Format payload NIR chiffré (D-01) -->
bytea = iv (12) || ciphertext || auth_tag (16) — au-dessus, préfixe version 0x01 (open question §2 RESEARCH adoptée)
bytea final = version (1) || iv (12) || ciphertext || tag (16) — total >= 30 bytes pour NIR 13 chars
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : Migration 003 — extensions, types, tables, RLS, triggers audit, index</name>
  <files>supabase/migrations/20260507000001_patients.sql</files>
  <read_first>
    - /home/user/TAP/supabase/migrations/20260506000001_foundations.sql (intégral, ≤ 250 lignes — patterns DDL, helpers, set_updated_at)
    - /home/user/TAP/supabase/migrations/20260506000002_rls_foundations.sql (intégral — pattern RLS forcée + 4 policies + revoke/grant)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 138-232, 462-498, 538-560 — schéma + audit trigger + pitfalls)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 45-167 — pattern migration 003)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md (lignes 86-122, modèle contraintes + notes)
    - /home/user/TAP/supabase/tests/patients.sql (les assertions à faire passer en GREEN — créées par PLAN-1)
  </read_first>
  <behavior>
  - Test : `pnpm db:reset` applique la migration sans erreur ; `pnpm db:test` (qui inclut patients.sql + patient_constraint.sql + patient_operational_note.sql) passe en GREEN avec ≥ 35 assertions vertes
  - Test : un INSERT patient avec `nir_encrypted = '\\x01...'` insère une ligne audit_logs `action='patient.insert'` dont `metadata->'new'` ne contient ni `nir_encrypted` ni `nir_search_hash`
  - Test : 2 INSERTs même `nir_search_hash` dans la même org → conflit `23505` ; même `nir_search_hash` cross-tenant → OK
  - Test : EXPLAIN ANALYZE `select * from patients where search_text % 'ho'` mentionne `Bitmap Index Scan on patients_search_trgm_idx`
  - Test : DELETE depuis identité régulateur → `42501`
  </behavior>
  <action>
Créer `supabase/migrations/20260507000001_patients.sql` (≥ 200 lignes, ≤ 300). Structure obligatoire (en-tête `=` style migrations 001/002) :

**Section 1 — En-tête commenté** (pattern PATTERNS.md lignes 53-64) — décrit les 8 objets créés.

**Section 2 — Extensions et wrapper IMMUTABLE** :
```sql
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Wrapper IMMUTABLE pour permettre l'usage dans une colonne générée stockée.
-- Sans cela, Postgres lève "generation expression is not immutable".
-- Référence : RESEARCH.md Pitfall 1.
create or replace function public.unaccent_immutable(input text)
returns text
language sql
immutable
parallel safe
as $$ select extensions.unaccent('extensions.unaccent', input) $$;
```

**Section 3 — Type énuméré `patient_constraint_type`** (8 valeurs exactes de D-17 / CONTEXT lignes 88-96) :
```sql
create type public.patient_constraint_type as enum (
  'medical_oxygene',
  'medical_fauteuil',
  'medical_brancard',
  'vehicule_tpmr',
  'horaire_matin',
  'horaire_apres_midi',
  'accompagnement_obligatoire',
  'autre'
);
```

**Section 4 — Type énuméré `canal_contact_prefere`** :
```sql
create type public.canal_contact_prefere as enum ('sms', 'appel', 'aucun');
```

**Section 5 — Table `patients`** :
```sql
create table public.patients (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prenom text not null check (length(trim(prenom)) between 1 and 80),
  nom text not null check (length(trim(nom)) between 1 and 80),
  date_naissance date not null,
  genre text check (genre in ('M','F','X')),
  telephone text,
  telephone_normalized text,            -- forme normalisée pour fuzzy
  adresse_ligne1 text not null,
  adresse_ligne2 text,
  code_postal text not null check (code_postal ~ '^974[0-9]{2}$'),
  ville text not null,
  contact_urgence_nom text,
  contact_urgence_telephone text,
  nir_encrypted bytea,
  nir_search_hash bytea,
  -- 4 derniers chiffres seuls ne permettent pas l'identification directe d'un patient
  -- (RGPD acceptable comme pseudonymisation partielle). Cf. ADR-004 (placeholder).
  -- Format `XX YY` = 2 derniers digits + 2 digits de la clé, séparés par un espace.
  nir_last4 text check (
    nir_last4 is null
    or nir_last4 ~ '^[0-9]{2}\s[0-9]{2}$'
  ),
  canal_contact_prefere public.canal_contact_prefere not null default 'appel',
  consentement_sms boolean not null default false,
  consentement_sms_at timestamptz,
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint patients_consentement_sms_horodatage check (
    consentement_sms = false or consentement_sms_at is not null
  )
);

-- Colonne générée stockée pour la recherche fuzzy
alter table public.patients add column search_text text generated always as (
  lower(public.unaccent_immutable(
    coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(telephone_normalized, '')
  ))
) stored;
```

**Section 6 — Index patients** :
```sql
create index patients_organization_archive_idx on public.patients (organization_id, archive);
create index patients_search_trgm_idx on public.patients using gin (search_text extensions.gin_trgm_ops);
create unique index patients_nir_unique
  on public.patients (organization_id, nir_search_hash)
  where archive = false and nir_search_hash is not null;
create index patients_nir_search_hash_idx on public.patients (organization_id, nir_search_hash) where archive = false;
```

**Section 7 — Table `patient_constraint`** (D-17 / CONTEXT lignes 96-107) :
```sql
create table public.patient_constraint (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  type public.patient_constraint_type not null,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);
create index patient_constraint_patient_idx on public.patient_constraint (patient_id);
```

**Section 8 — Table `patient_operational_note`** (D-18 / CONTEXT lignes 109-122) :
```sql
create table public.patient_operational_note (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 500),
  author_id uuid not null references auth.users(id),
  replaced_by_id uuid references public.patient_operational_note(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patient_operational_note_active_idx
  on public.patient_operational_note (patient_id)
  where replaced_by_id is null;
```

**Section 9 — RLS forcée + policies (3 tables)** : reproduire le pattern de migration 002 lignes 13-160 pour chaque table. Pour chaque table :
- `enable row level security`
- `force row level security`
- Policy `<table>_select_same_org` (SELECT, condition `organization_id = public.current_organization_id()`)
- Policy `<table>_insert_regulateur` (INSERT, condition org + `has_role('regulateur') OR has_role('dirigeant')`)
- Policy `<table>_update_regulateur` (UPDATE) — patients et patient_operational_note seulement (patient_constraint = pas d'update)
- **Pas de policy DELETE** sur patients (archivage logique)
- **Policy DELETE** sur `patient_constraint` (suppression d'une contrainte = action métier valide pour régulateur ; gardée par helpers)

**Section 10 — Trigger `patients_set_updated_at`** + idem pour `patient_operational_note` (réutiliser `public.set_updated_at()` migration 001).

**Section 11 — Trigger d'audit `patients_audit_trigger`** (squelette PATTERNS.md lignes 130-159 + RESEARCH.md lignes 538-560) :
- Fonction `public.patients_audit_trigger()` SECURITY DEFINER, search_path = public, qui INSERT dans audit_logs
- `metadata = jsonb_build_object('old', ..., 'new', ...)` avec `to_jsonb(...) - 'nir_encrypted' - 'nir_search_hash'` — **les 2 clés sont retirées dans les 2 branches old + new**
- `action = 'patient.' || lower(tg_op)` (insert / update / delete — delete impossible mais inclus pour cohérence)
- Triggers `after insert or update or delete on public.patients for each row execute function public.patients_audit_trigger()`

**Section 12 — Trigger d'audit `patient_constraint_audit_trigger`** : action `'patient_constraint.' || lower(tg_op)`.

**Section 13 — Trigger d'audit `patient_operational_note_audit_trigger`** : action `'patient_operational_note.' || lower(tg_op)`. Le `replaced_by_id` set d'une UPDATE produit l'action `patient_operational_note.update` (équivalent au "replaced" sémantique de D-20).

**Section 14 — Revoke / Grant** (pattern PATTERNS.md lignes 117-126) :
```sql
revoke all on public.patients, public.patient_constraint, public.patient_operational_note from anon;
grant select, insert, update on public.patients to authenticated;
grant select, insert, delete on public.patient_constraint to authenticated;
grant select, insert, update on public.patient_operational_note to authenticated;
```

**Section 14b — Vue `patients_safe` (B-5 ciphertext leak fix)** : la vue est définie APRÈS la table, APRÈS les policies RLS et APRÈS les revoke/grant. RLS sur `public.patients` est enforced car `security_invoker = true`. Les Server Actions consomment cette vue, jamais la table brute (cf. ADR-004 placeholder).

```sql
create view public.patients_safe with (security_invoker = true) as
  select
    id,
    organization_id,
    nom,
    prenom,
    date_naissance,
    genre,
    telephone,
    telephone_normalized,
    adresse_ligne1,
    adresse_ligne2,
    code_postal,
    ville,
    canal_contact_prefere,
    consentement_sms,
    consentement_sms_at,
    contact_urgence_nom,
    contact_urgence_telephone,
    nir_last4,                          -- masque clair, sécurité acceptable
    (nir_encrypted is not null) as has_nir,
    archive,
    archive_at,
    archive_reason,
    search_text,
    created_at,
    updated_at,
    created_by,
    updated_by
  from public.patients;

-- nir_encrypted, nir_search_hash, search_text are NOT exposed:
-- - nir_encrypted/hash : ciphertext leak prevention (cf. ADR-004)
-- - search_text exposed for client-side display ranking (lowercase unaccented concat)

grant select on public.patients_safe to authenticated;
```

**Section 15 — Comments** : `comment on table public.patients is 'Référentiel patient — NIR chiffré applicatif AES-256-GCM (Edge Function nir).';` etc.

**Conventions strictes :**
- Fichier ≤ 300 lignes (CLAUDE.md §11) — si dépassement, splitter au seuil de section 11 (mais préférable de tenir en ≤ 300)
- snake_case Postgres
- Aucun `service_role` dans les policies
- Aucun `select *` dans une policy
- Aucun NIR clair dans un `comment on column` (jamais)
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm db:test 2&gt;&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/migrations/20260507000001_patients.sql` ≥ 200 et ≤ 300
    - `grep -cE "create (table|type|index|extension|trigger|policy|or replace function)" supabase/migrations/20260507000001_patients.sql` ≥ 25
    - `grep -c "force row level security" supabase/migrations/20260507000001_patients.sql` == 3 (3 tables)
    - `grep -c "enable row level security" supabase/migrations/20260507000001_patients.sql` == 3
    - `grep -c "unaccent_immutable" supabase/migrations/20260507000001_patients.sql` ≥ 2
    - `grep -c "gin_trgm_ops" supabase/migrations/20260507000001_patients.sql` == 1
    - `grep -c "patients_nir_unique" supabase/migrations/20260507000001_patients.sql` == 1
    - `grep -c "where archive = false" supabase/migrations/20260507000001_patients.sql` ≥ 1
    - `grep -vE "^\\s*--" supabase/migrations/20260507000001_patients.sql | grep -c "nir_encrypted'.*'nir_search_hash" ` ≥ 2 (les 2 branches old + new du trigger filtrent les clés ; vérifié hors commentaires)
    - `grep -c "create policy" supabase/migrations/20260507000001_patients.sql` ≥ 10 (3 tables × 3-4 policies)
    - `! grep -E "^[^-]*delete.*on public\\.patients" supabase/migrations/20260507000001_patients.sql | grep -v "create policy"` (aucune policy DELETE sur patients)
    - `pnpm db:reset` exit 0
    - `pnpm db:test 2>&1 | grep -cE "ok [0-9]+ -"` ≥ 35 (assertions vertes des 3 fichiers PLAN-1)
    - `pnpm db:test 2>&1 | grep -cE "not ok"` == 0
    - `psql -f migration.sql` puis `\d patients` montre la colonne `nir_last4` avec sa CHECK constraint
    - `\dv patients_safe` montre que la vue existe
    - pgTAP tests vérifient que `patients_safe` n'expose ni `nir_encrypted` ni `nir_search_hash` (assertion `is(... select column_name ... where table_name='patients_safe' ...)` exclut ces noms)
  </acceptance_criteria>
  <done>Migration 003 appliquée localement, 3 tables avec RLS forcée, triggers audit qui excluent NIR (filtre conservé strictement à `nir_encrypted` + `nir_search_hash` ; `nir_last4` reste dans le delta d'audit comme contexte non-secret utile), vue `patients_safe` masque le ciphertext, index GIN + unique partiel opérationnels, 35+ assertions pgTAP vertes.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2 : Validators zod étendus + 2 nouveaux + helpers normalisation</name>
  <files>packages/shared/src/validators/patient.ts, packages/shared/src/validators/patient-constraint.ts, packages/shared/src/validators/patient-note.ts, packages/shared/src/validators/index.ts</files>
  <read_first>
    - /home/user/TAP/packages/shared/src/validators/patient.ts (état actuel)
    - /home/user/TAP/packages/shared/src/validators/common.ts (telephoneReunionSchema, nirFormatSchema, codePostalReunionSchema)
    - /home/user/TAP/packages/shared/src/validators/ride.ts (pattern enum + refine + composition)
    - /home/user/TAP/packages/shared/src/validators/__tests__/patient.test.ts (créé en PLAN-1, dicte le contrat)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 314-415, sections validators)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md (D-16, D-17, D-18)
  </read_first>
  <behavior>
  - Test : `patientSchema.parse({ ...minimal, consentement_sms: true })` SANS `consentement_sms_at` → throw `"Horodatage de consentement requis si consentement_sms = true."`
  - Test : `patientSchema.parse({ ...minimal, genre: 'autre' })` → throw
  - Test : `patientSchema.parse({ ...minimal, contact_urgence: { nom: 'Mme Hoarau', telephone: '06 92 12 34 56' } })` → success, telephone normalisé à `'0692123456'`
  - Test : `normalizeNir('1 80 12 34 567 823')` → `'1801234567823'` (suppression espaces)
  - Test : `normalizePhone('06 92 12 34 56')` → `'0692123456'`
  - Test : `patientConstraintInputSchema.parse({ patient_id: '<uuid>', type: 'medical_oxygene', note: 'O2 12L/min' })` → success
  - Test : `patientOperationalNoteInputSchema.parse({ patient_id: '<uuid>', content: 'A'.repeat(501) })` → throw
  </behavior>
  <action>
**packages/shared/src/validators/patient.ts** — étendre (≥ 70 lignes finales, ≤ 150) :

Imports en plus :
```ts
import { codePostalReunionSchema } from './common';
```

Ajouter (en gardant ce qui existe) :
```ts
export const genreSchema = z.enum(['M', 'F', 'X']);
export type Genre = z.infer<typeof genreSchema>;

export const contactUrgenceSchema = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  telephone: telephoneReunionSchema,
});

// Helper exporté : normalisation NIR — suppression espaces, uppercase pour clé corse 2A/2B
export function normalizeNir(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

// Helper exporté : normalisation téléphone — réutilise transform de telephoneReunionSchema
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s.-]/g, '');
}
```

Étendre `patientSchema` :
```ts
export const patientSchema = z
  .object({
    prenom: z.string().trim().min(1, 'Prénom requis').max(80),
    nom: z.string().trim().min(1, 'Nom requis').max(80),
    date_naissance: z
      .string()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format attendu : AAAA-MM-JJ'),
    genre: genreSchema.optional(),
    telephone: telephoneReunionSchema.optional(),
    nir: nirFormatSchema.optional(),
    adresse: adresseSchema,
    contact_urgence: contactUrgenceSchema.optional(),
    canal_contact_prefere: canalContactSchema.default('appel'),
    consentement_sms: z.boolean().default(false),
    consentement_sms_at: z.string().datetime({ offset: true }).optional(),
    notes_operationnelles: z.string().trim().max(500).optional(),
    archive: z.boolean().default(false),
  })
  .refine(
    (data) => !data.consentement_sms || Boolean(data.consentement_sms_at),
    {
      message: 'Horodatage de consentement requis si consentement_sms = true.',
      path: ['consentement_sms_at'],
    },
  );
```

Conserver `export type PatientInput = z.infer<typeof patientSchema>;`.

**packages/shared/src/validators/patient-constraint.ts** — créer (≥ 25 lignes) :
```ts
import { z } from 'zod';

export const patientConstraintTypeSchema = z.enum([
  'medical_oxygene',
  'medical_fauteuil',
  'medical_brancard',
  'vehicule_tpmr',
  'horaire_matin',
  'horaire_apres_midi',
  'accompagnement_obligatoire',
  'autre',
]);
export type PatientConstraintType = z.infer<typeof patientConstraintTypeSchema>;

export const patientConstraintInputSchema = z.object({
  patient_id: z.string().uuid('Identifiant patient invalide'),
  type: patientConstraintTypeSchema,
  note: z.string().trim().max(300).optional(),
});
export type PatientConstraintInput = z.infer<typeof patientConstraintInputSchema>;
```

**packages/shared/src/validators/patient-note.ts** — créer (≥ 15 lignes) :
```ts
import { z } from 'zod';

export const patientOperationalNoteInputSchema = z.object({
  patient_id: z.string().uuid('Identifiant patient invalide'),
  content: z
    .string()
    .trim()
    .min(1, 'Contenu requis')
    .max(500, 'Note limitée à 500 caractères'),
});
export type PatientOperationalNoteInput = z.infer<typeof patientOperationalNoteInputSchema>;
```

**packages/shared/src/validators/index.ts** — ajouter les re-exports :
```ts
export * from './common';
export * from './patient';
export * from './patient-constraint';
export * from './patient-note';
export * from './ride';
```

**Conventions strictes :**
- TypeScript strict, aucun `any`
- Messages d'erreur en français, sans jargon technique
- Limites code : chaque fichier ≤ 300 lignes (large marge ici), chaque fonction ≤ 50 lignes
- Pas de logique métier qui dépasse le formatage / normalisation — déléguer à `packages/domain` si besoin
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm -C packages/shared test 2&gt;&amp;1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l packages/shared/src/validators/patient.ts` ≥ 70
    - `wc -l packages/shared/src/validators/patient-constraint.ts` ≥ 25
    - `wc -l packages/shared/src/validators/patient-note.ts` ≥ 15
    - `grep -c "normalizeNir\\|normalizePhone" packages/shared/src/validators/patient.ts` ≥ 2
    - `grep -c "consentement_sms_at" packages/shared/src/validators/patient.ts` ≥ 2
    - `grep -c "Horodatage de consentement requis" packages/shared/src/validators/patient.ts` == 1
    - `grep -c "contactUrgenceSchema\\|contact_urgence" packages/shared/src/validators/patient.ts` ≥ 2
    - `grep -c "patientConstraintTypeSchema" packages/shared/src/validators/patient-constraint.ts` ≥ 1
    - `grep -c "medical_oxygene\\|vehicule_tpmr\\|accompagnement_obligatoire" packages/shared/src/validators/patient-constraint.ts` ≥ 3
    - `grep -c "patient-constraint\\|patient-note" packages/shared/src/validators/index.ts` == 2
    - `pnpm -C packages/shared test 2>&1 | grep -cE "(✓|PASS).*patient"` ≥ 8 (tous les cas du PLAN-1 verts)
    - `pnpm -C packages/shared test 2>&1 | grep -cE "(✗|FAIL)"` == 0
    - `pnpm -C packages/shared typecheck` exit 0
  </acceptance_criteria>
  <done>3 fichiers validators (1 étendu + 2 créés), helpers de normalisation exportés, tests Vitest GREEN sur les 10 cas du PLAN-1.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2.5 : Migration RPC search_patients (déplacée de PLAN-5 — B-3)</name>
  <files>supabase/migrations/20260507000002_search_patients_rpc.sql</files>
  <read_first>
    - /home/user/TAP/supabase/migrations/20260507000001_patients.sql (vue `patients_safe` créée par Tâche 1, contrat de retour de la fonction)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 45-167 — pattern migration + section RPC)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 138-232 — recherche fuzzy pg_trgm + unaccent)
    - /home/user/TAP/supabase/migrations/20260506000001_foundations.sql (helper `public.current_organization_id()` SECURITY DEFINER)
  </read_first>
  <behavior>
  - Test : `select * from public.search_patients('ho')` retourne ≤ 10 lignes triées par `similarity` desc, restreintes à l'organisation courante (RLS via `current_organization_id()` + `security invoker` sur la vue sous-jacente)
  - Test : `select * from public.search_patients('h')` (q < 2 caractères) retourne 0 ligne (court-circuit `length(q) >= 2`)
  - Test : `\df search_patients` montre la fonction présente, language sql, stable, security invoker
  - Test : aucune des colonnes `nir_encrypted` ni `nir_search_hash` n'apparaît dans le résultat (la fonction retourne `setof public.patients_safe`, pas `setof public.patients`)
  - Test : `revoke all` puis `grant execute ... to authenticated` garantit qu'`anon` ne peut pas appeler la fonction (assertion pgTAP `function_privs_are`)
  </behavior>
  <action>
Créer `supabase/migrations/20260507000002_search_patients_rpc.sql` (≥ 30 lignes). La fonction retourne `setof public.patients_safe` (PAS `public.patients`) pour éviter toute fuite de ciphertext (B-5).

```sql
create or replace function public.search_patients(q text)
returns setof public.patients_safe
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.patients_safe
  where organization_id = public.current_organization_id()
    and length(q) >= 2
    and search_text % lower(unaccent(q))
  order by similarity(search_text, lower(unaccent(q))) desc
  limit 10;
$$;

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;
```

**Conventions strictes :**
- La fonction est `security invoker` (pas definer) : RLS de `patients` (via la vue `patients_safe`) s'applique à l'appelant, pas au propriétaire
- Filtre `length(q) >= 2` côté SQL : court-circuit le scan si l'UI envoie 1 caractère
- `lower(unaccent(q))` côté requête : alignement strict avec la colonne générée `search_text` (Tâche 1 Section 5)
- `limit 10` : protège l'UI (cap dur, le ranking client se fait sur 10 max)
- Aucun `service_role` ; aucune interpolation SQL (q est paramétré, l'opérateur `%` reçoit du texte normalisé)
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -5 &amp;&amp; pnpm db:test 2&gt;&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/migrations/20260507000002_search_patients_rpc.sql` ≥ 25 et ≤ 80
    - `grep -c "returns setof public.patients_safe" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `grep -c "security invoker" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `grep -c "current_organization_id" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `grep -c "length(q) >= 2" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `grep -c "limit 10" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `grep -c "grant execute on function public.search_patients(text) to authenticated" supabase/migrations/20260507000002_search_patients_rpc.sql` == 1
    - `! grep -c "setof public.patients[^_]" supabase/migrations/20260507000002_search_patients_rpc.sql` (aucun retour depuis la table brute — uniquement la vue)
    - `\df search_patients` montre la fonction (après pnpm db:reset)
    - `pnpm db:reset` exit 0 (la fonction s'applique sans erreur)
  </acceptance_criteria>
  <done>RPC `search_patients` livrée sur la vue `patients_safe`, RLS héritée via `security invoker`, plafond 10 résultats, pas de fuite de ciphertext. Consommée par PLAN-5 (UI patient) au lieu d'y être créée.</done>
</task>

<task type="auto">
  <name>Tâche 3 [BLOCKING] : Schema push local + régénération types Supabase</name>
  <files>packages/database/src/types.gen.ts, packages/database/src/types.ts</files>
  <read_first>
    - /home/user/TAP/packages/database/src/types.ts (stub manuel actuel — voir ligne 7 commentaire « régénération via pnpm db:types »)
    - /home/user/TAP/package.json (scripts db:reset, db:types, db:test, db:push)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 452-479, section types Database)
  </read_first>
  <action>
**Étape A — schema push local (BLOCKING)** :
1. `cd /home/user/TAP && pnpm db:reset` — applique migrations 001, 002, 003 + seed. Doit exit 0.
2. `pnpm db:test` — doit exit 0 avec ≥ 35 assertions vertes.
3. **Sans cette étape, la suite échoue.** Si `pnpm db:reset` échoue : lire l'erreur, corriger la migration 003 (probablement `unaccent` immutable, voir Pitfall 1 RESEARCH.md), recommencer.

**Étape B — régénération types** :
4. `pnpm db:types` — exécute `supabase gen types typescript --local > packages/database/src/types.gen.ts`. Vérifier que le fichier généré contient :
   - `patients: { Row: { ..., nir_encrypted: string | null, nir_search_hash: string | null, ... } }`
   - `patient_constraint: { Row: ... }`
   - `patient_operational_note: { Row: ... }`
   - `Enums: { ..., patient_constraint_type: 'medical_oxygene' | ... | 'autre', canal_contact_prefere: 'sms' | 'appel' | 'aucun', user_role: ... }`

**Étape C — mise à jour du stub `types.ts`** :
5. Ouvrir `packages/database/src/types.ts`. Au lieu de remplacer entièrement le stub manuel, ajouter en tête :
   ```ts
   // Types Supabase générés automatiquement par `pnpm db:types`.
   // Importer depuis `./types.gen` quand le fichier existe ; le stub manuel ci-dessous
   // reste pour la compatibilité du package en dev avant `pnpm db:reset`.
   export type { Database } from './types.gen';
   ```
   Et déplacer le contenu manuel existant en-dessous d'un commentaire « // Stub legacy — supprimé après stabilisation Phase 1 ». Si le typecheck casse à cause d'export double, garder uniquement le re-export vers `types.gen` et marquer le stub `@deprecated`.

6. Ajouter dans `packages/database/src/index.ts` (ou créer si absent) :
   ```ts
   export type { Database } from './types';
   ```

7. `pnpm typecheck` à la racine → exit 0.

**Note remote (déférée) :** `supabase db push` (vers staging) est documenté en commit message mais NON exécuté ici. Cette tâche traite uniquement le push **local**. Le push remote a lieu en deploy post-merge (CI workflow existant `.github/workflows/ci.yml`).

**En cas d'échec `pnpm db:reset`** :
- Erreur `extension "pg_trgm" must be in schema "extensions"` → mettre `with schema extensions` dans la migration 003
- Erreur `generation expression is not immutable` → vérifier wrapper `unaccent_immutable` (cf. PATTERNS.md ligne 162)
- Erreur `function public.unaccent does not exist` → utiliser `extensions.unaccent` (toutes extensions Supabase sont en schema `extensions`)
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -5 &amp;&amp; pnpm db:test 2&gt;&amp;1 | tail -5 &amp;&amp; pnpm db:types 2&gt;&amp;1 | tail -3 &amp;&amp; pnpm typecheck 2&gt;&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm db:reset` exit 0
    - `pnpm db:test 2>&1 | grep -cE "not ok"` == 0
    - `test -f packages/database/src/types.gen.ts`
    - `wc -l packages/database/src/types.gen.ts` ≥ 50
    - `grep -c "patients:\\|patient_constraint:\\|patient_operational_note:" packages/database/src/types.gen.ts` ≥ 3
    - `grep -c "patient_constraint_type" packages/database/src/types.gen.ts` ≥ 1
    - `grep -c "canal_contact_prefere" packages/database/src/types.gen.ts` ≥ 1
    - `grep -c "nir_encrypted" packages/database/src/types.gen.ts` ≥ 1
    - `grep -c "from './types.gen'" packages/database/src/types.ts` == 1
    - `pnpm typecheck` exit 0
  </acceptance_criteria>
  <done>Migration appliquée localement, types régénérés depuis le schéma réel, typecheck propre, base de données prête à être consommée par PLAN-3 (Edge Function) et PLAN-4 (apps/web).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client (Server Action / Edge Function) → Postgres | Toutes les écritures patients passent par RLS forcée + helpers SECURITY DEFINER `current_organization_id` |
| Postgres trigger → audit_logs | L'écriture audit est hors RLS (SECURITY DEFINER) ; risque de contournement par bug trigger |
| Migration 003 → données existantes | Aucune donnée patient en prod (Phase 0 → seed démo seulement) ; risque destruction nul |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-02-01 | Information Disclosure | trigger patients_audit_trigger | HIGH | mitigate | `to_jsonb(...) - 'nir_encrypted' - 'nir_search_hash'` dans les 2 branches (old + new) ; assertion pgTAP `metadata->'new' ? 'nir_encrypted' = false` (PLAN-1 tâche 1 cas 16-17) |
| T-02-02 | Information Disclosure | recherche fuzzy `search_text % $1` via SQL injection | HIGH | mitigate | Toutes les requêtes passent par supabase-js paramétré (PLAN-5) ; aucune interpolation. Lint `no-restricted-syntax` à ajouter dans `apps/web` (PLAN-4) refuse les `from()` avec template strings non-paramétrés |
| T-02-03 | Elevation of Privilege | chauffeur lit fiche patient cross-org | MEDIUM | mitigate | RLS forcée + 4 policies par table ; pgTAP cross-tenant assertion 11-12 dans PLAN-1 |
| T-02-04 | Repudiation | bypass audit_logs via INSERT direct service_role | MEDIUM | mitigate | Audit_logs append-only (RLS migration 002 ligne 130-152) ; service_role limité aux migrations + Edge Function. Pattern documenté dans `audit_logs_insert_self` |
| T-02-05 | Tampering | suppression d'un patient via DELETE | LOW | mitigate | Aucune policy DELETE sur public.patients ; DELETE → SQLSTATE 42501. Test pgTAP cas 13 (PLAN-1) |
| T-02-06 | Information Disclosure | logs Postgres incluent NIR clair en cas d'erreur (column constraint trigger) | HIGH | mitigate | Aucun `RAISE NOTICE` ni `RAISE EXCEPTION` n'inclut le NIR clair dans la migration ; le NIR n'apparaît jamais en chaîne dans la migration (uniquement bytea opaque) |
</threat_model>

<verification>
Phase verification (au-delà des `<verify>` par tâche) :
- Le full audit ADR-001 : `grep -rE "from \\\"@supabase/supabase-js\\\"" apps/web 2>/dev/null` == 0 (apps/web n'existe pas encore — control vacuous OK ; vrai control en PLAN-4)
- `pnpm db:reset && pnpm db:test && pnpm -C packages/shared test && pnpm typecheck` chaîne complète exit 0
- `grep -c "force row level security" supabase/migrations/20260507000001_patients.sql` == 3
- Pas de NIR clair n'importe où : `grep -rn "180123456" supabase/migrations/ packages/shared/` == 0 (le seul NIR factice du projet vit dans les tests PLAN-1)
</verification>

<success_criteria>
- Migration 003 livrée (≥ 200 lignes), 3 tables avec RLS forcée + 10+ policies + 3 triggers d'audit qui excluent NIR
- Index GIN `patients_search_trgm_idx` opérationnel (vérifié par EXPLAIN dans pgTAP cas 20)
- Index unique partiel `patients_nir_unique` empêche les doublons NIR par tenant tout en autorisant le multi-tenant
- 3 fichiers pgTAP de PLAN-1 passent en GREEN, 0 not ok
- patientSchema étendu : refine consentement_sms_at, helpers normalizeNir / normalizePhone exportés
- `patientConstraintInputSchema` + `patientOperationalNoteInputSchema` créés
- Types Supabase régénérés depuis le schéma local et exportés via `@tap/database`
- `pnpm typecheck` exit 0 dans tout le monorepo
- PLAN-3 (Edge Function NIR) et PLAN-4 (apps/web) peuvent démarrer sans dépendre de cette tâche pour autre chose que les types et le schéma
</success_criteria>

<output>
Après complétion, créer `.planning/phases/01-referentiel-patients/01-2-SUMMARY.md` documentant :
- Liste exacte des objets créés en migration 003 (3 tables, 2 enums, 1 wrapper IMMUTABLE, 4 index, 6 triggers, 1 vue `patients_safe`)
- Liste des objets créés en migration 004 (1 fonction RPC `search_patients`)
- Comptage final policies par table
- Diff de surface des validators (ce qui a été ajouté par rapport à `patient.ts` initial)
- Snapshot du `pnpm db:test` final (pour gate PLAN-3)
</output>

## Revision Log

- **B-3** : Ajout de la tâche T2.5 et de la migration `20260507000002_search_patients_rpc.sql` (déplacée depuis PLAN-5 Wave 3 vers PLAN-2 Wave 1). La migration crée la fonction RPC `public.search_patients(q text)` qui retourne `setof public.patients_safe` (et non pas la table brute) afin d'éviter toute fuite de ciphertext.
- **B-5** : Ajout de la vue `public.patients_safe` (Section 14b de la migration 003) avec `security_invoker = true`, excluant `nir_encrypted` et `nir_search_hash`. Les Server Actions et la RPC `search_patients` consomment exclusivement cette vue, jamais la table `patients` directement.
- **B-6** : Ajout de la colonne `nir_last4 text` (format `XX YY` validé par CHECK regex `^[0-9]{2}\s[0-9]{2}$`) dans la table `patients`. Permet l'affichage masqué (4 derniers chiffres) sans déchiffrement applicatif. Option (b) du checker, ADR-004 placeholder. La colonne reste incluse dans le delta JSONB des audit triggers (filtre conservé strictement à `nir_encrypted` + `nir_search_hash` ; `nir_last4` est non-secret et utile au contexte d'audit).
- **Date** : 2026-05-06
- **Iteration** : 1/3
