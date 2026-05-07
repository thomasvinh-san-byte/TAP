---
phase: 02-saisie-express-course
plan: 03
subsystem: web/server
tags: [server-actions, rsc-queries, supabase-server, zod-validation, rls, idempotent-upsert, courses]

# Dependency graph
requires:
  - phase: 00-foundations
    provides: wrapper @/lib/supabase/server (createClient SSR cookie-bound), helpers RLS Postgres
  - phase: 01-referentiel-patients
    provides: pattern Server Actions auth + profile (createPatientAction), pattern queries RSC (searchPatients), table profiles
  - phase: 02-saisie-express-course/02-01
    provides: rideExpressInputSchema + rideDraftSchema (@tap/shared) — Wave 0
  - phase: 02-saisie-express-course/02-02
    provides: tables rides + ride_draft + RLS forcee + audit trigger + types Database['public']['Tables']['rides'/'ride_draft'] + 3 enums (Wave 1)
provides:
  - 4 Server Actions (createRideAction, upsertRideDraft, deleteRideDraft, listDraftsAction)
    appelables depuis composants client React 18 useTransition/useActionState — Wave 3
  - 3 queries RSC (listRides, listDrafts, listRecentPickupAddresses) prefetchables
    via QueryClient.prefetchQuery + HydrationBoundary — Wave 4
  - Helper interne getAuthContext (auth.getUser + profile.organization_id) reutilisable
    par toutes les futures actions courses (Phase 3 pricing, Phase 6 assignation, etc.)
  - Type ActionState discriminated coherent avec Phase 1 patients (continuite UX modal/toast)
affects:
  - 02-saisie-express-course Wave 3 : RideExpressModal (createRideAction + useOptimistic + Sonner)
  - 02-saisie-express-course Wave 3 : RideExpressOrchestrator (upsertRideDraft auto-save 5s + onBlur)
  - 02-saisie-express-course Wave 3 : DraftQueue (listDraftsAction + useQuery + dropdown header)
  - 02-saisie-express-course Wave 4 : page /courses (listRides prefetch + RidesList client)
  - 02-saisie-express-course Wave 5 : E2E SAIS-01 (mesure < 30 s passe par createRideAction)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action mutation flow : zod safeParse -> getAuthContext -> Supabase write -> revalidatePath -> ActionState (pas de redirect, le modal Wave 3 ferme cote client)"
    - "Idempotent upsert pour auto-save : .upsert(row, { onConflict: 'id' }) genere UUID si id absent ; permet la reprise reseau sans dupliquer (D-05)"
    - "Helper getAuthContext : centralise auth.getUser + profile.organization_id en 1 fonction pour eviter la duplication des 6 lignes dans chaque action"
    - "Wrapper Server Action listDraftsAction : evite l'import 'server-only' RSC dans composants client useQuery (Wave 3 DraftQueue)"
    - "Dedup JS pour top-5 adresses : 20 lignes lues + Set en memoire ; plus simple que distinct on Postgres + order by"

key-files:
  created:
    - apps/web/src/app/(app)/courses/actions.ts (181 lignes — 4 Server Actions + helper)
    - apps/web/src/app/(app)/courses/_lib/queries.ts (112 lignes — 3 queries RSC + types reexports)
  modified: []

key-decisions:
  - "createRideAction signature objet typé `{input, fromDraftId?}` plutôt que FormData : facilite l'appel depuis Wave 3 useTransition + useOptimistic (pas de Object.fromEntries à manipuler côté client). Pattern aligné avec upsertRideDraft (objet typé z.infer)."
  - "Pas de check de rôle JS explicite : RLS Postgres policy rides_insert_regulateur (Wave 1) fait foi (DRY + source de vérité serveur). Les actions reposent sur l'erreur PostgREST 42501 captée comme 'Création course impossible.'"
  - "Helper getAuthContext retourne null en cas d'absence d'auth/profile plutôt que de throw : permet un short-circuit propre `return { error: 'Session expirée.' }` côté action (UX continue)."
  - "Cast `as never` sur insert/upsert payload : compromis Phase 1 documenté (typage @supabase/supabase-js 2.105 incomplet sur Insert avec champs optionnels). Les types Database fournissent quand même la vérification au call site."
  - "Pas de redirect après createRideAction : D-06 explicite — le modal Wave 3 ferme côté client + toast Sonner. revalidatePath suffit pour rafraîchir /courses + /cockpit."

patterns-established:
  - "Module Server Actions courses : 1 fichier actions.ts (CRUD + wrappers) + 1 fichier _lib/queries.ts (lectures RSC pures) — réplique pattern patients pour cohérence architecturale"
  - "Action signature `Promise<ActionState>` ou `Promise<{id} | {error}>` selon que l'action a besoin de retourner un id généré DB (idempotent upsert)"
  - "Dedup en mémoire pour top-N distinct : pattern réutilisable Phase 4 (récurrences récentes patient), Phase 6 (chauffeurs récents par zone)"

requirements-completed: [SAIS-04, SAIS-06]

# Metrics
duration: 2min
completed: 2026-05-07
---

# Phase 2 Plan 03 : Server Actions + queries RSC courses — Summary

**Wave 2 livrée — 4 Server Actions (createRideAction + upsertRideDraft + deleteRideDraft + listDraftsAction) + 3 queries RSC (listRides + listDrafts + listRecentPickupAddresses) ; pnpm typecheck monorepo GREEN ; aucun import @supabase/* direct ; aucune logique métier côté composants (DEC-016).**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-07T10:26:25Z
- **Completed:** 2026-05-07T10:28:17Z
- **Tasks:** 2 (+ SUMMARY)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

### Task 3.1 — Server Actions (`apps/web/src/app/(app)/courses/actions.ts`, 181 lignes)

4 exports nommés Server Actions + 1 helper interne :

- **`getAuthContext()`** (helper interne) — encapsule `supabase.auth.getUser()` + lecture `profiles.organization_id`. Retourne `null` si non authentifié ou profil absent ; aucune fuite Postgres.
- **`createRideAction({input, fromDraftId?})`** (D-06) — re-validation zod côté serveur (defense in depth), INSERT rides avec `created_by`/`updated_by` = `auth.uid()`, DELETE optionnel du brouillon source, `revalidatePath('/courses')` + `revalidatePath('/cockpit')`. Retour `ActionState { success, id }` ou `{ error }`. **Pas de redirect** — le modal Wave 3 ferme côté client + toast Sonner.
- **`upsertRideDraft({id?, payload, patient_id?})`** (D-05) — idempotent via `.upsert(row, { onConflict: 'id' })`. Si `id` absent → INSERT avec UUID généré DB. Retour `{id}` (existing or generated) ou `{error}`. Aucun `revalidatePath` (les brouillons sont consommés via Server Action wrapper côté client useQuery — pas de RSC à invalider).
- **`deleteRideDraft(id)`** — validation UUID zod inline, DELETE RLS-scoped (RLS auto-filtre `author_id = auth.uid()`). Retour `{success, error?}`.
- **`listDraftsAction()`** — wrapper Server Action pour useQuery client (DraftQueue Wave 3). Limit 20, tri `updated_at desc`, RLS auto-filtre author. Retourne `[]` en cas d'absence d'auth (UX continue, pas d'erreur).

### Task 3.2 — Queries RSC (`apps/web/src/app/(app)/courses/_lib/queries.ts`, 112 lignes)

3 exports nommés appelables depuis Server Components :

- **`listRides({status?, transport_mode?, urgency?})`** (D-07) — SELECT 18 colonnes rides RLS-filtré, tri `scheduled_at desc`, `archive=false`, limit 100. Filtres optionnels chainés. Throw `'Lecture courses impossible.'` sur erreur (jamais l'erreur Postgres brute).
- **`listDrafts()`** — SELECT ride_draft RLS-author-scoped (RLS auto-applique double prédicat), tri `updated_at desc`, limit 20.
- **`listRecentPickupAddresses(patientId)`** (specifics §11.4) — top 5 adresses pickup distinctes du patient. Lit 20 lignes par `created_at desc` puis dédup JS via `Set`. Améliore SAIS-01 par auto-suggestion HTML5 `<datalist>` Wave 3.

Types réexportés pour consommation Wave 3/4 : `RideRow`, `RideDraftRow`, `RideTransportMode`, `RideUrgency`, `RideStatus`.

## Task Commits

| Task | Name                                                                | Commit    | Files                                              |
| ---- | ------------------------------------------------------------------- | --------- | -------------------------------------------------- |
| 3.1  | Server Actions courses (createRide + upsertDraft + deleteDraft)     | `8f5e17b` | apps/web/src/app/(app)/courses/actions.ts          |
| 3.2  | Queries RSC courses (listRides + listDrafts + recentAddresses)      | `6d58d02` | apps/web/src/app/(app)/courses/_lib/queries.ts     |

## Files Created/Modified

### Créés (2)

- `apps/web/src/app/(app)/courses/actions.ts` — 181 lignes (≤ 200 cible)
- `apps/web/src/app/(app)/courses/_lib/queries.ts` — 112 lignes (≤ 130 cible)

### Modifiés (0)

Aucune modification de fichier existant — ce plan est purement additif.

## Decisions Made

### Signature createRideAction : objet typé plutôt que FormData

Le pattern Phase 1 `createPatientAction(_prev, formData)` est aligné avec `useFormState` côté client. Pour Phase 2 Wave 3, le modal utilisera `useTransition` + `useOptimistic` (RESEARCH §C6) plutôt que `useFormState` — la signature objet typé `{input, fromDraftId?}` évite le boilerplate `Object.fromEntries(formData.entries())` et bénéficie de `z.infer` au call site. C'est cohérent avec `upsertRideDraft` (déjà objet typé pour transporter `id?` et `payload`).

### Délégation du check de rôle à RLS Postgres

CLAUDE.md § 6 spécifie « Politique RLS systématique » et la migration Wave 1 applique `rides_insert_regulateur` avec `with check (... and (has_role('regulateur') or has_role('dirigeant')))`. Dupliquer le check en JS romprait le DRY — la source de vérité reste Postgres. Le test d'isolation cross-rôle est déjà couvert par pgTAP (Wave 1, assertion 9 rides_rls). En cas de tentative cross-rôle, PostgREST renvoie 42501 captée par le `if (error)` côté action → `'Création course impossible.'` (message FR neutre, sans détail Postgres exposé — anti-pattern CLAUDE.md § 6).

### Helper getAuthContext plutôt que duplication

Les 4 actions ont besoin du couple `(user, organization_id)`. Plutôt que dupliquer 6 lignes par action, factorisation en `getAuthContext()` qui retourne `null` en short-circuit. Pattern réutilisable par toutes les futures actions courses (Phase 3 pricing, Phase 6 assignation chauffeur).

### `as never` sur Insert/Upsert payloads

Le typage `@supabase/supabase-js@2.105` sur `.insert(row)` est strict mais incomplet quand des champs optionnels (`pickup_postal_code?`, etc.) sont absents du payload typé. Phase 1 `createPatientAction` a documenté ce compromis (commentaire ligne 135). On le réplique ici pour rester cohérent — la vérification de type s'effectue au call site via `rideExpressInputSchema` (zod) et l'inférence Database au niveau du `.from('rides')`.

### Dedup JS plutôt que `distinct on` Postgres

`select distinct on (pickup_address) ... order by created_at desc` exige `order by pickup_address, created_at desc` (Postgres requirement). Combiner avec un tri par récence demande une CTE ou subquery. Sur 20 lignes en mémoire la dédup JS via `Set` est instantanée et garde la query plate.

## Deviations from Plan

### Auto-fixed Issues

Aucune. Le plan a été exécuté tel qu'écrit, sans Rule 1/2/3 déclenchée.

### Notes mineures

- **Validation runtime sur deleteRideDraft** : ajout d'un `z.string().uuid().safeParse(id)` inline avant l'appel DB (Rule 2 défensif — éviter une erreur Postgres 22P02 brute si l'id arrive corrompu côté client). Conforme aux directives CLAUDE.md § 6 (validation systématique côté serveur). Non considéré comme déviation car le PLAN texte le suggérait implicitement (`if (!z.string().uuid().safeParse(id).success)`).

## Issues Encountered

Aucune. Les 2 tâches sont passées GREEN au premier essai. Le typecheck monorepo (`pnpm --filter @tap/web typecheck`) est exit 0 dès la première exécution sur chaque commit.

## Threat Flags

Aucun nouveau threat surface introduit hors du `<threat_model>` du PLAN. Les 6 threats listés (T-02-T1, T-02-T2, T-02-T3, T-02-T4, T-02-V5, T-02-T7) sont tous mitigés ou explicitement acceptés :

| Threat ID | Statut       | Vérification                                                                                          |
| --------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| T-02-T1   | mitigé       | `getAuthContext()` appelé en début d'action ; absence d'auth → `return` sans toucher la DB           |
| T-02-T2   | mitigé       | RLS Wave 1 author-scoped + zod `rideDraftSchema` refuse champs hors schéma                           |
| T-02-T3   | accepté      | Trigger PG `for each row` inviolable depuis l'API ; aucun `service_role` dans ce code                |
| T-02-T4   | mitigé       | `.upsert(row, { onConflict: 'id' })` last-write-wins acceptable car payload remplacé entier           |
| T-02-V5   | mitigé       | `rideDraftSchema` (zod) refuse champs non listés ; React échappe au rendu Wave 3 (pas d'innerHTML)    |
| T-02-T7   | mitigé       | Aucun catch global — erreurs retournées explicitement `{ error: '...' }` ; UI Wave 3 fera Sentry      |

## Self-Check : PASSED

### Files exist

- [x] `apps/web/src/app/(app)/courses/actions.ts` (181 lignes)
- [x] `apps/web/src/app/(app)/courses/_lib/queries.ts` (112 lignes)

### Acceptance grep counts

- [x] `grep -cE "^export (async )?function (createRideAction|upsertRideDraft|deleteRideDraft|listDraftsAction)" actions.ts` = 4
- [x] `grep -cE "^export (async )?function (listRides|listDrafts|listRecentPickupAddresses)" queries.ts` = 3
- [x] `grep -c "^'use server';" actions.ts` = 1 (`'use server';` en haut)
- [x] `grep -c "rideExpressInputSchema" actions.ts` = 1
- [x] `grep -c "rideDraftSchema" actions.ts` = 1
- [x] `grep -c "revalidatePath('/courses')" actions.ts` = 1
- [x] `grep -c "revalidatePath('/cockpit')" actions.ts` = 1
- [x] `grep -c "Database\['public'\]" queries.ts` = 5 (RideRow, RideDraftRow, 3 enums)
- [x] `grep -cE "^import.*@supabase/" actions.ts queries.ts` = 0
- [x] `grep -v '^\s*//\|^\s*\*' actions.ts queries.ts | grep -c "console\."` = 0

### Commits exist

- [x] `8f5e17b` feat(02-03): Server Actions courses (createRide + upsertDraft + deleteDraft)
- [x] `6d58d02` feat(02-03): queries RSC courses (listRides + listDrafts + recentAddresses)

### Typecheck

- [x] `pnpm --filter @tap/web typecheck` exit 0 (les 2 commits)

### Code quality

- [x] Aucun `console.log/warn/error` (CLAUDE.md § 11)
- [x] Aucun import direct `@supabase/supabase-js` (uniquement wrapper `@/lib/supabase/server`)
- [x] Tous les messages d'erreur reformulés FR (« Saisie invalide. », « Session expirée. », « Création course impossible. », « Brouillon invalide. », « Sauvegarde impossible. », « Identifiant brouillon invalide. », « Suppression brouillon impossible. », « Lecture courses impossible. », « Lecture brouillons impossible. »)
- [x] Aucun `service_role` référencé
- [x] Fichier actions.ts ≤ 200 lignes (181)
- [x] Fichier queries.ts ≤ 130 lignes (112)
- [x] Toutes les fonctions ≤ 50 lignes

## User Setup Required

Aucun. Wave 2 est purement code serveur — pas de migration, pas d'env var, pas de dépendance npm ajoutée. Les Server Actions sont consommables immédiatement par Wave 3 (modal client) et Wave 4 (page /courses RSC).

## Next Phase Readiness

### Wave 3 (RideExpressModal + RideExpressOrchestrator + DraftQueue) — DÉBLOQUÉE

- ✅ `createRideAction({input, fromDraftId?})` consommable via `useTransition` + `useOptimistic` (RESEARCH §C6)
- ✅ `upsertRideDraft({id?, payload, patient_id?})` consommable via debounce 5 s + flush onBlur (RESEARCH §C3)
- ✅ `deleteRideDraft(id)` consommable depuis DraftQueue dropdown (action « Supprimer brouillon »)
- ✅ `listDraftsAction()` consommable via `useQuery({ queryKey: ['ride-drafts'], queryFn: listDraftsAction })` (RESEARCH §PATTERNS draft-queue)
- ✅ Type `ActionState` cohérent avec Phase 1 (continuité UX modal/toast Sonner)

### Wave 4 (page /courses RSC + RidesList client) — DÉBLOQUÉE

- ✅ `listRides({status, transport_mode, urgency})` prefetchable via `QueryClient.prefetchQuery({queryKey: ['rides', filters], queryFn: () => listRides(filters)})` + `HydrationBoundary` (pattern PATTERNS §courses/page.tsx)
- ✅ Types `RideRow`, `RideTransportMode`, `RideUrgency`, `RideStatus` réexportés pour usage client

### Wave 5 (E2E SAIS-01..06) — DÉBLOQUÉE

- ✅ Server Actions opérationnelles → Playwright peut mesurer le SAIS-01 < 30 s end-to-end (modal → submit → toast)
- ✅ Audit trigger Wave 1 + createRideAction → l'assertion E2E SAIS-06 « audit log ride.insert présent » est testable

### Specifics §11.4 (auto-suggestion adresses) — DÉBLOQUÉE pour Wave 3

- ✅ `listRecentPickupAddresses(patientId)` retourne 5 adresses dédupliquées prêtes pour `<datalist>` HTML5 sous le champ pickup du modal

---

*Phase: 02-saisie-express-course*
*Plan: 03 (Wave 2 — Server Actions + queries RSC)*
*Completed: 2026-05-07*
