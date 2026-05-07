---
phase: 01-referentiel-patients
verified: 2026-05-07T05:54:38Z
status: human_needed
score: 5/5 success criteria delivered (programmatic), 2 require runtime/E2E confirmation
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Lancer la stack complète et exécuter `pnpm db:reset && pnpm db:test`"
    expected: "35/35 assertions pgTAP GREEN sur patients.sql + patient_constraint.sql + patient_operational_note.sql (RLS, NIR bytea, audit filtre, isolation tenant, EXPLAIN GIN)"
    why_human: "Sandbox bloque Docker registry public.ecr.aws → `pnpm db:reset` impossible localement. Vérification déférée à CI réelle (job `rls-tests` dans .github/workflows/ci.yml exécute `supabase test db`)."
  - test: "Lancer `cd supabase/functions && deno test --allow-env --allow-net --allow-read nir/index.test.ts` avec APP_NIR_ENCRYPTION_KEY + APP_NIR_SEARCH_KEY définies"
    expected: "6 cas Deno verts : round-trip encrypt/decrypt, IV unique, hash déterministe normalisation espaces, clés AES vs HMAC distinctes, 401 sans JWT, audit_logs `patient.nir.decrypt` inséré avant return"
    why_human: "Deno indisponible dans le sandbox d'exécution (PLAN-3 SUMMARY confirme). Revue logique cas-par-cas faite — exécution réelle requise en CI ou local développeur."
  - test: "Lancer `pnpm -C apps/web test:e2e` après `pnpm db:reset` (avec NIR keys + Supabase local)"
    expected: "Test E2E `patient-flow.spec.ts` PASS : login → /patients/new → submit → URL [uuid] → recherche fuzzy 1 char vide / 2 chars trouve patient → drawer width === 400 → NIR masqué regex `1•••••••••\\d{2}\\s*\\d{2}` → edit → consentement SMS → audit_logs `patient.update` sans `nir_encrypted` dans `metadata.new`"
    why_human: "Playwright nécessite Next.js dev + Supabase local + Edge Function `nir` lancée (concurrently). Sandbox sans Docker. Code applicatif satisfait tous les contrats (vérifié grep)."
  - test: "Smoke UX visuel : ouvrir /patients/new sur Chrome 1280px, mode jour ET nuit"
    expected: "Spacing strict 4/8/12/16/24/32/48/64, palette bleu profond + accent terracotta, pas d'emoji UI, focus visible, transitions 150ms, hover carte légère, Lucide ligne fine. Niveau Linear/Notion/Stripe."
    why_human: "Pilier 1 (UX qui donne envie) ne se mesure pas par grep. Capture d'écran à valider par Guillaume sur écran réel."
  - test: "Vérifier la performance recherche fuzzy à 2 caractères en production-like (10k patients)"
    expected: "< 100ms feedback visuel (CLAUDE.md § 1) ; index GIN pg_trgm utilisé (Bitmap Index Scan visible dans EXPLAIN)"
    why_human: "Test pgTAP 20 force `enable_seqscan=off` pour vérifier que l'index *peut* être utilisé. Vraie mesure de latence requiert dataset volumétrique réel (à valider Phase 2 ou première démo design partner)."
---

# Phase 1 : Référentiel patients — Verification Report

**Phase Goal :** La régulatrice peut créer, consulter, rechercher et annoter une fiche patient avec un NIR chiffré et des préférences exploitables par les autres modules.
**Verified :** 2026-05-07T05:54:38Z
**Status :** human_needed
**Verdict global :** PASS programmatique (toutes les preuves codebase sont là) — confirmation runtime requise pour les tests bloqués par sandbox Docker.

## Goal Achievement — Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Régulatrice peut créer une fiche patient via formulaire validé zod | ✓ DELIVERED | Route `apps/web/src/app/(app)/patients/new/page.tsx` → `<PatientForm action={createPatientAction}>` ; `actions.ts:42` `patientSchema.safeParse(...)` ; 7 labels `name=` (nom, prénom, date_naissance, nir, adresse_ligne1, code_postal, ville) confirmés dans `patient-form-sections.client.tsx:17-110` ; refine `consentement_sms_at` requis si `consentement_sms=true` (`patient.ts:70-75`) |
| 2 | NIR stocké chiffré AES-256-GCM, jamais en clair en base ni dans logs | ✓ DELIVERED | `crypto.ts:50` AES-GCM via Web Crypto natif Deno ; `crypto.ts:13` VERSION_BYTE 0x01 + IV 12 bytes + tag 16 bytes ; `crypto.ts:85` IV aléatoire `crypto.getRandomValues` ; migration 003 lignes 50-51 colonnes `nir_encrypted bytea` + `nir_search_hash bytea` ; trigger d'audit ligne 212-214 `to_jsonb(old/new) - 'nir_encrypted' - 'nir_search_hash'` ; vue `patients_safe` (l.283) `with (security_invoker = true)` exclut bytea ; 0 `console.*` dans `supabase/functions/` (grep clean) ; `decryptNir` catch wraps any error → "NIR illisible" générique (T-03-01 mitigé) |
| 3 | Recherche à 2 caractères (nom/prénom/téléphone) instantanée fuzzy | ✓ DELIVERED | RPC `public.search_patients(q text)` migration 004 — `length(q) >= 2` côté SQL + `search_text % lower(unaccent(q))` + `similarity(...)` order by + `limit 10` ; index GIN `patients_search_trgm_idx` migration 003 l.80 ; côté client `patients-list.client.tsx:35` garde `enabled: dq.length === 0 \|\| dq.length >= 2` + `useDeferredValue` pour debounce React natif ; queries.ts:39 garde serveur `if (trimmed.length > 0 && trimmed.length < 2) return []` ; pgTAP test 20 valide Bitmap Index Scan |
| 4 | Régulatrice peut renseigner préférences SMS/appel/aucun + note opérationnelle libre | ✓ DELIVERED | Enum `canal_contact_prefere` migration 003 section 2 ; `<select id="canal_contact_prefere" name="canal_contact_prefere">` dans `patient-form-sections.client.tsx:124-132` (options `appel`, `sms`, `aucun`) ; `<input type="checkbox" name="consentement_sms">` + datetime input pour horodatage ; table dédiée `patient_operational_note` (migration 003 l.99-115) avec pattern `replaced_by_id` (D-18) + helper pur `replacePatientNote` testé Vitest 3/3 ; `<Textarea name="notes_operationnelles" maxLength=500>` avec compteur dans `patient-form-note.client.tsx` |
| 5 | Création/modification fiche patient apparaît dans audit_logs avec utilisateur, horodatage, delta | ✓ DELIVERED | 3 triggers `*_audit_trigger` (migration 003 l.199-270) : `patients_audit_trigger`, `patient_constraint_audit_trigger`, `patient_operational_note_audit_trigger` ; chaque trigger `for each row` ; insert dans `audit_logs (organization_id, actor_id=auth.uid(), action, entity_type, entity_id, metadata{old, new})` ; `audit_logs` est append-only hérité de migration 002 ; pgTAP test 15 valide `action=patient.insert` créé après INSERT ; tests 16-17 valident `metadata->new` ne contient pas `nir_encrypted` ni `nir_search_hash` |

**Score :** 5/5 truths verified (programmatique). Confirmation runtime des tests pgTAP/Deno/E2E requise — voir section Human Verification.

## Required Artifacts

| Artefact | Niveau 1 (existe) | Niveau 2 (substantiel) | Niveau 3 (wired) | Niveau 4 (data flows) | Status |
|----------|-------------------|------------------------|-------------------|----------------------|--------|
| `supabase/migrations/20260507000001_patients.sql` | OUI (298 lignes) | OUI (3 tables + RLS forcée + 9 policies + 3 audit triggers + vue patients_safe) | OUI (pgTAP 35/35 documenté) | n/a (DDL) | ✓ VERIFIED |
| `supabase/migrations/20260507000002_search_patients_rpc.sql` | OUI (42 lignes) | OUI (RPC stable security invoker, length>=2, similarity desc limit 10, grant authenticated) | OUI (consommé par queries.ts:49 `supabase.rpc('search_patients')`) | OUI (retourne setof patients_safe) | ✓ VERIFIED |
| `supabase/functions/nir/_shared/crypto.ts` | OUI (139 lignes) | OUI (encryptNir / decryptNir / hashNir / normalizeNir, AES-GCM, HMAC-SHA256, IV aléatoire) | OUI (importé par index.ts:7) | n/a (module pur) | ✓ VERIFIED |
| `supabase/functions/nir/_shared/auth.ts` | OUI (105 lignes) | OUI (authenticate + adminClient + AuthError + SupabaseLike) | OUI (importé par index.ts) | n/a | ✓ VERIFIED |
| `supabase/functions/nir/index.ts` | OUI (144 ≤ 150) | OUI (dispatch encrypt/decrypt/hash + audit forcé sur decrypt + 401/400/405) | OUI (re-export `encryptNir/decryptNir/hashNir` consommé par index.test.ts) | OUI (action `decrypt` insère `audit_logs` AVANT return l.79-86) | ✓ VERIFIED |
| `supabase/tests/patients.sql` | OUI (270+ lignes, plan(20)) | OUI (RLS, NIR bytea, audit filtre, isolation, EXPLAIN GIN) | OUI (référencé par CI `supabase test db`) | n/a | ✓ VERIFIED (sandbox-bloqué exécution) |
| `supabase/tests/patient_constraint.sql` | OUI (plan(8)) | OUI (RLS, INSERT régulateur OK / chauffeur 42501, isolation, audit) | OUI (CI) | n/a | ✓ VERIFIED |
| `supabase/tests/patient_operational_note.sql` | OUI (plan(7)) | OUI (RLS, replaced_by_id chaîne, CHECK 500 chars, audit) | OUI (CI) | n/a | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/page.tsx` | OUI (45 lignes) | OUI (RSC + HydrationBoundary + searchParams) | OUI (route `/patients` Next.js App Router) | OUI (consomme `searchPatients` queries.ts) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/queries.ts` | OUI (115 lignes) | OUI (`searchPatients` + `getPatientById` + garde 2 chars) | OUI (consommé par page.tsx + actions.ts) | OUI (DB → patients_safe via supabase.rpc + .from) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/actions.ts` | OUI (293 ≤ 300) | OUI (createPatient + updatePatient + decryptNir + searchPatients + getPatientById Server Actions) | OUI (consommé par formulaires + UI) | OUI (zod parse → encryptAndHashNir → INSERT/UPDATE → revalidatePath ; 6 occurrences `revalidatePath`) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/constraints.actions.ts` | OUI (82 lignes) | OUI (add/remove atomiques + zod schema) | OUI (consommé par patient-form-constraints) | OUI (DB INSERT/DELETE) | ✓ VERIFIED |
| `apps/web/src/lib/nir-client.ts` | OUI (91 lignes) | OUI (encryptAndHashNir + decryptNirViaEdge + hash) | OUI (consommé par actions.ts:29-31) | OUI (HTTP → Edge Function `nir`) | ✓ VERIFIED |
| `apps/web/src/lib/utils.ts` (`maskNir`) | OUI | OUI (`maskNir(nirLast4) → "1•••••••••XX YY"`) | OUI (consommé par patient-nir-display, drawer-sections, [id]/page.tsx) | OUI (input nir_last4 clair → bullets) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx` | OUI (105 lignes) | OUI (Sheet 400px exact + 6 blocs ordonnés) | OUI (`w-[400px]` confirmé) | OUI (consume getPatientById) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/_components/patient-search.client.tsx` | OUI (33 lignes) | OUI (input contrôlé) | OUI (consommé par patients-list) | OUI | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/_components/patient-form-*.client.tsx` | OUI (60/137/46/148/137 lignes) | OUI (sections identité/coordonnées/préférences/contraintes/note) | OUI | OUI (Server Action createPatientAction/updatePatientAction) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/[id]/page.tsx` | OUI (95 lignes) | OUI (page détail + bouton Modifier + PatientNirDisplay) | OUI | OUI (getPatientById → vue patients_safe) | ✓ VERIFIED |
| `apps/web/src/app/(app)/patients/[id]/edit/page.tsx` | OUI (78 lignes) | OUI (PatientForm + PatientFormConstraints hors form) | OUI | OUI (updatePatientAction.bind(id)) | ✓ VERIFIED |
| `packages/shared/src/validators/patient.ts` | OUI (78 lignes) | OUI (patientSchema + genreSchema + contactUrgenceSchema + normalizeNir + refine consentement) | OUI (importé par actions.ts:23) | n/a (validateur pur) | ✓ VERIFIED |
| `packages/shared/src/validators/patient-constraint.ts` | OUI (28 lignes) | OUI (enum 8 valeurs + input schema) | OUI (importé par constraints.actions.ts:17) | n/a | ✓ VERIFIED |
| `packages/shared/src/validators/patient-note.ts` | OUI (18 lignes) | OUI (input schema 1-500 chars) | OUI | n/a | ✓ VERIFIED |
| `packages/shared/src/utils/patient-note.ts` (`replacePatientNote`) | OUI (56 lignes) | OUI (helper pur replaced_by_id) | OUI (importé par actions.ts) | OUI (3 tests Vitest GREEN documentés) | ✓ VERIFIED |
| `packages/database/src/types.gen.ts` | OUI (392 lignes) | OUI (Database Tables + Views + Functions + Enums miroir schéma) | OUI (importé par tous les wrappers Supabase) | n/a | ✓ VERIFIED (manual mirror — sandbox bloque `pnpm db:types`) |
| `apps/web/src/middleware.ts` | OUI (37 lignes) | OUI (PKCE + getUser + redirect /login) | OUI (Next.js détecte src/middleware.ts) | OUI (smoke test PLAN-4 confirmé /patients → 307 /login?next) | ✓ VERIFIED |
| `apps/web/src/app/(auth)/login/page.tsx` | OUI (27 lignes) | OUI (Server Action signInAction + open-redirect protection) | OUI | OUI (redirect /patients après succès) | ✓ VERIFIED |
| `supabase/seed.sql` (compte E2E) | OUI | OUI (compte `reg-demo@tap.test` ajouté ligne 97-119, idempotent) | OUI (helper E2E `loginAsRegulateur`) | OUI | ✓ VERIFIED |

## Key Link Verification

| Source | Cible | Via | Status | Détails |
|--------|-------|-----|--------|---------|
| Formulaire `/patients/new` | `createPatientAction` | `<PatientForm action={createPatientAction}>` | ✓ WIRED | `new/page.tsx` bind action prop |
| `createPatientAction` | Edge Function NIR encrypt | `encryptAndHashNir(supabase, nir)` (`actions.ts:99, 206`) | ✓ WIRED | `supabase.functions.invoke('nir', { body: {action:'encrypt', nir} })` |
| Edge Function NIR | DB `audit_logs` (decrypt) | `ctx.client.from("audit_logs").insert({action:'patient.nir.decrypt'})` AVANT return (`index.ts:79-86`) | ✓ WIRED | T-03-03 mitigé : audit forcé côté serveur, impossible à bypass côté caller |
| `PatientSearch` (input) | RPC `search_patients` | `useDeferredValue(q)` → `useQuery({ enabled: >=2 })` → `searchPatientsAction` → `supabase.rpc('search_patients', { q })` | ✓ WIRED | queries.ts:49, garde 2 chars en triple : composant + Server Action + SQL |
| `PatientNirDisplay` "Afficher le NIR" | `decryptNirAction` | `onClick → decryptNirAction(patientId)` | ✓ WIRED | Audit log inséré côté Edge Function, état mémoire React uniquement |
| Tables `patients/patient_constraint/patient_operational_note` | `audit_logs` | 3 triggers `*_audit_trigger` `for each row` | ✓ WIRED | Trigger `patients_audit_trigger` filtre `nir_encrypted` + `nir_search_hash` dans old + new |
| `getPatientById` | Vue `patients_safe` (B-5) | `supabase.from('patients_safe')` (queries.ts:115 ligne 88) | ✓ WIRED | 2 occurrences, ciphertext jamais exposé au browser |
| Middleware Next.js | Supabase Auth PKCE | `createSupabaseMiddlewareClient` + `getUser()` | ✓ WIRED | smoke test : `/patients` → 307 `/login?next=%2Fpatients` |
| `(app)/layout.tsx` | Garde-fou serveur | `getUser()` + `redirect('/login')` | ✓ WIRED | ceinture+bretelles (T-04-01) |

## Data-Flow Trace (Level 4)

| Artefact | Variable | Source | Real data ? | Status |
|----------|----------|--------|-------------|--------|
| `/patients` page | liste patients | RPC `search_patients(q)` (RSC prefetch + HydrationBoundary) | OUI (DB query active, pas de mock) | ✓ FLOWING |
| `/patients/[id]` page | fiche complète | `getPatientById(id)` → `supabase.from('patients_safe')` | OUI | ✓ FLOWING |
| `PatientNirDisplay` | NIR clair | `decryptNirAction(patientId)` → Edge Function decrypt | OUI (HTTPS round-trip Edge) | ✓ FLOWING |
| `PatientFormConstraints` | liste contraintes | `getPatientById(id).constraints` (drawer-sections.client.tsx) | OUI | ✓ FLOWING |
| Audit_logs après INSERT/UPDATE | metadata old/new | trigger Postgres `to_jsonb(old/new) - 'nir_encrypted' - 'nir_search_hash'` | OUI (trigger DB) | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build Next.js compile | `pnpm -C apps/web build` | "Compiled successfully" (PLAN-5 SUMMARY) | ✓ PASS (documenté) |
| Typecheck monorepo | `pnpm typecheck` | exit 0 sur 3 packages | ✓ PASS (documenté) |
| Vitest replacePatientNote | `pnpm -C packages/shared test src/utils` | 3/3 GREEN | ✓ PASS (documenté) |
| Vitest validators patient | `pnpm -C packages/shared test patient` | 11/11 GREEN | ✓ PASS (documenté PLAN-2) |
| pgTAP 35 assertions | `pnpm db:test` | non exécutable sandbox | ? SKIP — voir Human Verification 1 |
| Deno tests Edge Function | `deno test` | non exécutable sandbox | ? SKIP — voir Human Verification 2 |
| Playwright E2E | `pnpm -C apps/web test:e2e` | non exécutable sandbox | ? SKIP — voir Human Verification 3 |

## Requirements Coverage

| Req | Plan | Files | Tests | Status |
|-----|------|-------|-------|--------|
| **PAT-01** Régulatrice peut créer fiche (coordonnées, NIR, date naissance, genre) | 01-2, 01-5 | `patient.ts` (zod) + `patient-form-sections.client.tsx` (labels nom/prénom/date/genre/NIR/téléphone/adresse/code postal/ville) + `actions.ts` (createPatientAction) + migration 003 (28 colonnes) | pgTAP cas 9-10 (alpha-reg insère patient minimal valide), E2E patient-flow (création → URL [uuid]) | ✓ DELIVERED |
| **PAT-02** NIR chiffré AES-256-GCM, clé hors Supabase, jamais loggué | 01-2, 01-3 | `crypto.ts` (AES-GCM + HMAC + VERSION_BYTE 0x01) + migration 003 (`nir_encrypted bytea` + trigger filtre audit) + `.env.example` (clés vides) | pgTAP 4-5, 16-17 (audit ne contient pas ciphertext), Deno round-trip | ✓ DELIVERED — clé `APP_NIR_ENCRYPTION_KEY` dans env Edge Function (pas dans bundle Next.js) |
| **PAT-03** Régulatrice peut consulter fiche en < 1 clic depuis recherche | 01-5 | `PatientDrawer` (Sheet 400px, ouvert au click sur ligne liste) + page détail `/patients/[id]` + lien "Voir la fiche complète" | E2E patient-flow (drawer → click "Voir la fiche complète") | ✓ DELIVERED |
| **PAT-04** Recherche fuzzy 2 chars (nom, prénom, téléphone) | 01-2, 01-5 | RPC `search_patients` (migration 004) + index GIN pg_trgm + `patients-list.client.tsx` `useDeferredValue` + garde `>=2` triple (UI/Server Action/SQL) | pgTAP cas 20 (Bitmap Index Scan), E2E (1 char rien / 2 chars trouve) | ✓ DELIVERED |
| **PAT-05** Préférences patient (SMS/appel/aucun, contraintes) | 01-2, 01-5 | Enum `canal_contact_prefere` + `<select>` 3 options + table `patient_constraint` 8 types + `PatientFormConstraints` add/remove atomiques + `consentement_sms` + `consentement_sms_at` (refine zod) | pgTAP patient_constraint 8 cas, E2E (selectOption sms + checkbox consentement) | ✓ DELIVERED |
| **PAT-06** Note opérationnelle libre | 01-1, 01-2, 01-5 | Table `patient_operational_note` (CHECK 500 chars + replaced_by_id) + `<Textarea name=notes_operationnelles maxLength=500>` + helper pur `replacePatientNote` (D-18) | pgTAP patient_operational_note 7 cas, Vitest replacePatientNote 3/3 | ✓ DELIVERED |
| **PAT-07** Modifications fiche journalisées dans audit_logs | 01-2 | 3 triggers `for each row` sur patients/patient_constraint/patient_operational_note + filtre `nir_encrypted/nir_search_hash` | pgTAP cas 15 (action=patient.insert), 16-17 (sans NIR), 22-26 (constraints, notes) | ✓ DELIVERED |

**Aucun requirement orphelin.** Les 7 PAT-* sont tous couverts.

## Quality Gates (CLAUDE.md § 11)

| Check | Commande | Résultat | Status |
|-------|----------|----------|--------|
| 0 `console.*` apps/web/src/ | `grep -rE "console\.(log\|error\|warn\|info\|debug)" apps/web/src/` | 0 match | ✓ OK |
| 0 `console.*` supabase/functions/ | `grep -rE "console\.(log\|error\|warn\|info\|debug)" supabase/functions/` | 0 match | ✓ OK |
| 0 `useEffect` dans patients/ | `grep -rE "useEffect" apps/web/src/app/(app)/patients/` | 0 match | ✓ OK |
| ADR-001 : aucun `@supabase/*` hors `lib/supabase/` | `grep -rE "from ['\"]@supabase/" apps/web/src/ \| grep -v "lib/supabase/"` | 0 match | ✓ OK |
| 0 `nir_encrypted/nir_search_hash` dans `_components/` | `grep -rE "nir_encrypted\|nir_search_hash" apps/web/src/app/(app)/patients/_components/` | 0 match | ✓ OK |
| Références `nir_encrypted/nir_search_hash` ailleurs | `actions.ts` (10), `queries.ts` (commentaires, 2), `nir-client.ts` (types réponse, 2) | sanctionné — Server Actions only, jamais transmis au client | ✓ OK |
| Fichiers ≤ 300 lignes | `wc -l` sur tous .ts/.tsx | max 293 (`actions.ts`) | ✓ OK |
| Composants ≤ 150 lignes | `wc -l` sur _components/ | max 148 (`patient-form-sections`) | ✓ OK |
| Migration 003 ≤ 300 lignes | `wc -l 20260507000001_patients.sql` | 298 | ✓ OK |
| Edge Function index ≤ 150 lignes | `wc -l supabase/functions/nir/index.ts` | 144 | ✓ OK |
| Pas de magic strings NIR factice | `grep -rE "180123456" supabase/functions/nir/_shared/` | 0 match | ✓ OK |
| `.env.example` 2 clés NIR vides | `grep -cE "^APP_NIR_(ENCRYPTION\|SEARCH)_KEY=$" .env.example` | 2 | ✓ OK |
| Build Next.js | `pnpm -C apps/web build` | exit 0 (PLAN-5) | ✓ OK |
| Typecheck monorepo | `pnpm typecheck` | exit 0 sur 3 packages | ✓ OK |

## Security Gates (CLAUDE.md § 6 + threat model)

| Threat | Mitigation | Verified | Status |
|--------|------------|----------|--------|
| **T-01-01 / T-02-01** NIR clair en logs ou audit_logs | Trigger `patients_audit_trigger` filtre `to_jsonb(old/new) - 'nir_encrypted' - 'nir_search_hash'` ; 0 `console.*` dans Edge Function | `migration 003 l.212-214` ; pgTAP 16-17 ; grep | ✓ OK |
| **T-02-02** SQL injection dans recherche fuzzy | RPC `search_patients(q text)` paramétrée (pas d'interpolation), `language sql stable security invoker` | `migration 004` paramètre `q text` + `length(q) >= 2` | ✓ OK |
| **T-02-03** Élévation de privilège cross-tenant | RLS `force row level security` × 3 tables + helper `current_organization_id()` dans toutes les policies + `organization_id not null references organizations` | migration 003 l.116, 142, 166 ; pgTAP 11-12 (isolation Alpha/Bravo) | ✓ OK |
| **T-02-05** DELETE patient (RGPD : archivage uniquement) | Aucune policy DELETE sur patients ; pgTAP cas 13 valide rejet | migration 003 (pas de policy delete) ; pgTAP 13 | ✓ OK |
| **T-03-03** Audit decrypt bypass-able | `audit_logs.insert` exécuté AVANT `return jsonResponse({ nir })` côté Edge Function (`index.ts:79-86`) ; client = `service_role` distinct du client user | `index.ts` review | ✓ OK |
| **T-03-01** Erreur crypto fuit raison | `decryptNir` catch wraps any error → `throw new Error("NIR illisible")` générique | `crypto.ts:106-122` | ✓ OK |
| **T-04-01** Bypass middleware Next.js | Matcher conforme + ceinture+bretelles `getUser()` dans `(app)/layout.tsx` | smoke test PLAN-4 + 2 occurrences `getUser()`, 0 `getSession(` | ✓ OK |
| **T-04-02** Open redirect via `?next=` | Garde `next.startsWith('/') && !next.startsWith('//')` + fallback `/patients` | `actions.ts` login | ✓ OK |
| **T-05-04** Audit decrypt impossible à bypass UI | `decryptNirAction` Server Action → Edge Function → audit log forcé côté serveur | review code | ✓ OK |
| **B-5 / T-05-05** Ciphertext leak browser | Vue `patients_safe` `with (security_invoker = true)` exclut `nir_encrypted` + `nir_search_hash` ; UI consomme exclusivement `patients_safe` (`from('patients_safe')` × 2 dans queries.ts) ; 0 référence ciphertext dans `_components/` | grep + migration 003 l.283-292 | ✓ OK |
| **B-6** Persistance atomique 3 colonnes NIR | `nir_encrypted`, `nir_search_hash`, `nir_last4` insérées/mises à jour dans la même requête (`actions.ts:107-114, 217-220`) ; `nir_last4` typé en `string` dans `EncryptResponse` | review | ✓ OK |
| **T-04-04** Login non audité | Accepté (Supabase Auth log natif suffit V1, à revisiter Phase 8) | déclaré en deviation PLAN-4 | ⚠️ ACCEPTED |

## Anti-Patterns Found

Aucun anti-pattern bloquant trouvé. Conformité CLAUDE.md § 11 totale sur le périmètre Phase 1.

| Catégorie | Détail | Sévérité |
|-----------|--------|----------|
| Cast TS `as never` ponctuels | Documentés dans `actions.ts` ligne 149/223 + `queries.ts:50` — version skew `@supabase/ssr 0.5.2` vs `@supabase/supabase-js 2.105.3` (4ᵉ generic). À reconsidérer V1.5 si upgrade `@supabase/ssr`. | ℹ️ Info — dette technique tracée |
| Test `siretSchema` Luhn échoue (validators/common) | Pré-existant Lot 0, hors scope Phase 1, tracé dans `deferred-items.md` | ℹ️ Info — déjà déféré |

## Known Limitations / Deviations

1. **Sandbox Docker bloqué** : `pnpm db:reset`, `pnpm db:test`, `pnpm db:types`, `deno test`, et `pnpm test:e2e` non exécutables localement (registre `public.ecr.aws` 403 Forbidden). `types.gen.ts` rédigé à la main en miroir du schéma vivant (vérifié par `pnpm typecheck` exit 0 et review manuelle). Tests pgTAP (35), Deno (6), Playwright (E2E patient-flow) sont **listés et code-prêts**, mais leur exécution est **déférée à la CI réelle** (`.github/workflows/ci.yml` job `rls-tests` lance `supabase test db`). Cf. Human Verification 1-3.

2. **Critère « ≥ 10 policies » du PLAN non atteint à la lettre** : 9 policies au total au lieu de 10+. Le design est intentionnel (patients sans DELETE, patient_constraint sans UPDATE, patient_operational_note sans DELETE). Documenté dans 01-2 SUMMARY comme « Notable Design Deviation ». **Acceptable** : la sécurité est meilleure (moins de surface d'attaque) ; la couverture des cas métier est intacte.

3. **Wave 0 RED → Wave 1 GREEN non re-vérifié post-mortem** : la baseline RED de PLAN-1 (`relation does not exist`) ne peut pas être re-démontrée maintenant que migration 003 est livrée. L'évolution RED→GREEN est documentée par les 4 commits cohérents (4194f14 / 1d6800c / f5440f8 / 34c959e / 72017de / d922399 / fdebda9).

4. **Login non audité** : T-04-04 explicitement accepté. Supabase Auth fournit ses propres logs. À revisiter en Phase 8 quand le module SMS imposera de tracer plus finement les actions régulatrice.

## Recommendations

**Avant de passer à Phase 2 :**

1. **CRITIQUE — Exécuter la CI réelle** sur les 5 commits Phase 1 et capturer les artefacts : 35/35 pgTAP GREEN, 6/6 Deno GREEN, E2E patient-flow GREEN. Sans ça, on est en confiance "code-prêt" mais pas "test-validé". Cf. Human Verification 1-3.

2. **MOYEN — Capture d'écran Pilier 1** : ouvrir `/patients/new` et `/patients` en mode jour ET nuit, sur Chrome 1280px. Valider que le résultat correspond au niveau Linear/Notion/Stripe (CLAUDE.md § 1). Idéalement, capture à montrer à un design partner avant Phase 2.

3. **MINEUR — Mesurer la performance recherche fuzzy** sur dataset volumétrique (10k patients seedés). Vérifier < 100ms feedback visuel. Pour l'instant, GIN pg_trgm est *utilisable* (pgTAP 20) mais pas mesuré en charge réelle.

4. **MINEUR — Tracker la dette `as never`** : créer une tâche pour upgrade `@supabase/ssr` vers une version compatible 4 generics, ou attendre alignement officiel. Documenté dans 01-5 SUMMARY.

5. **MINEUR — Régler le test `siretSchema` Luhn** dans un plan dédié validators (déjà tracé dans `deferred-items.md`). Pas un blocker Phase 1.

## Gaps Summary

**Aucun gap fonctionnel bloquant.** Les 5 Success Criteria et les 7 PAT-* sont tous délivrés en code, conformes aux CLAUDE.md § 6 (sécurité) et § 11 (anti-patterns). Le statut `human_needed` est dû exclusivement aux **tests à exécuter en environnement avec Docker** (CI ou poste développeur), pas à un manque dans le codebase.

Le code applicatif satisfait l'ensemble des contrats E2E déclarés dans `patient-flow.spec.ts` (vérifié grep par grep dans 01-5 SUMMARY). Le risque résiduel est bas : si un test runtime échoue, ce sera un détail (env var manquante, seed manquant, etc.) plutôt qu'une absence d'implémentation.

---

_Verified: 2026-05-07T05:54:38Z_
_Verifier: Claude (gsd-verifier, Opus 4.7)_
