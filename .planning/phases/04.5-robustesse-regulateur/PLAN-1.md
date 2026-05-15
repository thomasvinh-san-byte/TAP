---
phase: 04.5
plan: 1
plan_number: 1
slug: workflow-chauffeur
type: execute
status: draft
estimated_hours: 2.5
wave: 1
depends_on: []
note_ordre_execution: |
  Phase 04.5 a 4 waves intra-phase :
    Wave A : PLAN-1 Task 1.1 (T1.1 fix /conduite, priorité MAX bloquant démo)
    Wave B : PLAN-1 Task 1.2 + 1.3 ∥ PLAN-2 Task 2.1 ∥ PLAN-3 Task 3.1
    Wave C : PLAN-2 Task 2.2 + 2.3 ∥ PLAN-3 Task 3.2 + 3.3 ∥ PLAN-4 ∥ PLAN-5
    Wave D : PLAN-6 (différable 04.5-bis si > 12 h cumulées au début)
  PLAN-2..PLAN-5 ne démarrent qu'après livraison de PLAN-1 Task 1.1 GREEN.
  PLAN-6 démarre qu'après PLAN-1..PLAN-5 livrés.
files_modified:
  - apps/web/src/app/(driver)/conduite/page.tsx
  - supabase/seed.demo.sql
  - apps/web/tests/e2e/driver-workflow-complete.spec.ts
autonomous: true
requirements:
  - NFR-006
  - CONCERNS-UAT-F1
  - CONCERNS-UAT-F2
decisions_implemented:
  - D-01
  - D-02
  - D-03
  - DEC-039
tags:
  - hotfix
  - driver
  - e2e
  - seed
must_haves:
  truths:
    - "Le compte chauffeur démo voit au moins 1 course sur /conduite après reseed/redéploiement"
    - "Le seed démo est idempotent et glissant : reseed un jour après → rides toujours réparties J-3..J+1"
    - "Un test E2E couvre le golden path chauffeur : login → voir course → démarrer → clôturer + paiement → terminée"
  artifacts:
    - path: "apps/web/src/app/(driver)/conduite/page.tsx"
      provides: "Logging défensif pattern PR #63 + fix root cause"
    - path: "supabase/seed.demo.sql"
      provides: "Seed glissant ON CONFLICT DO UPDATE pour rides 44444444-%"
    - path: "apps/web/tests/e2e/driver-workflow-complete.spec.ts"
      provides: "E2E workflow chauffeur complet"
  key_links:
    - from: "apps/web/src/app/(driver)/conduite/page.tsx"
      to: "Supabase rides query"
      via: "logging défensif des res.error"
      pattern: "console.error.*ridesRes.error|driversRes.error"
    - from: "supabase/seed.demo.sql"
      to: "rides table"
      via: "ON CONFLICT (id) DO UPDATE SET scheduled_at, started_at, ended_at, created_at = EXCLUDED.*"
      pattern: "ON CONFLICT.*DO UPDATE SET scheduled_at"
---

<objective>
T1 — Workflow chauffeur : restaurer la capacité d'un chauffeur démo à exécuter une course complète sur preview Vercel, en débloquant `/conduite` (bug visible UAT 2026-05-14), en garantissant un seed glissant pour démo design partner n'importe quel jour, et en verrouillant le golden path par un test Playwright E2E.

Purpose : ce plan est priorité MAX. Sans `/conduite` fonctionnel + seed glissant, la démo design partner Phase 04.5 ne peut pas exister. Tout le reste de Phase 04.5 est secondaire si T1 n'est pas livré.

Output : un fix root cause `/conduite`, un seed démo idempotent glissant, un test E2E driver workflow complet.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md
@.planning/phases/04.5-robustesse-regulateur/04.5-DISCUSSION-LOG.md
@.planning/codebase/CONCERNS.md

# Pattern de référence à reproduire (PR #63)
@apps/web/src/app/(admin)/admin/chauffeurs/page.tsx

# Fichiers à modifier
@apps/web/src/app/(driver)/conduite/page.tsx
@supabase/seed.demo.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1.1 — Fix bug /conduite (logging défensif + correction root cause)</name>
  <files>
    apps/web/src/app/(driver)/conduite/page.tsx
  </files>
  <action>
Per D-01. Reproduire en miroir le pattern logging défensif PR #63 appliqué à `apps/web/src/app/(admin)/admin/chauffeurs/page.tsx`.

Étapes :
1. Remplacer les patterns `(data) => data ?? []` masquant les erreurs Supabase par `const res = await ...; if (res.error) console.error('[conduite] rides query failed', { message: res.error.message, code: res.error.code, details: res.error.details, hint: res.error.hint, user_id, role, organization_id }); const data = res.data ?? [];`.
2. Appliquer ce traitement à `ridesRes` ET `driversRes` (si applicable au chemin de résolution du driver_id courant).
3. Inclure dans le contexte de log : `user_id` (from auth), `role`, `organization_id`, `resolved_driver_id` (résultat de `resolveMyDriverId`).
4. Déployer en preview Vercel, lire les logs Vercel Runtime pour identifier laquelle des hypothèses suivantes est vraie :
   - H1 : politique RLS `rides_select` filtre rôle chauffeur sans match `driver_id`
   - H2 : `resolveMyDriverId` retourne null malgré `profile_id` correct
   - H3 : query Supabase échoue silencieusement (auth token expiré, column manquante en preview)
5. Selon l'hypothèse confirmée, appliquer le fix root cause :
   - H1 → modifier la politique RLS via nouvelle migration (CD `supabase db push`, jamais MCP — DEC-032)
   - H2 → corriger la résolution `resolveMyDriverId` (probable jointure manquante profiles ↔ drivers)
   - H3 → corriger la query (auth header manquant, column renommée non répercutée)
6. Conserver le logging défensif après fix (defense in depth — DEC-039 esprit).

Hors scope explicite : ne pas toucher au composant client de la page, ne pas ajouter de fonctionnalité, ne pas refondre le layout `/conduite`.

Threat model ASVS L1 :
- T-04.5-01 (Information Disclosure) : Logs Vercel peuvent contenir user_id / organization_id. Mitigation : pas de NIR, pas de notes médicales, pas de tokens loggés. user_id et organization_id sont des UUID non-PII.
- T-04.5-02 (Spoofing) : Si fix concerne RLS, vérifier qu'un chauffeur ne peut voir QUE ses propres rides après modification. Test pgTAP rides_select à mettre à jour si politique modifiée.
- T-04.5-03 (Tampering — log poisoning) : Les valeurs loggées proviennent d'auth (user_id, role) ou de la query Supabase (error.message). Pas d'input utilisateur direct injecté dans les logs.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(driver\\)/conduite</automated>
    Manual : preview Vercel déployée, login `chauffeur@demo.tap` / `demo1234!`, naviguer sur `/conduite`, observer ≥ 1 course visible. Si bug persiste, lire logs Vercel Runtime et appliquer le fix selon hypothèse identifiée.
  </verify>
  <done>
    - Logging défensif déployé sur preview Vercel
    - Cause root identifiée (H1 / H2 / H3) et fixée
    - Compte démo chauffeur voit ≥ 1 course active sur `/conduite`
    - Logging défensif conservé après fix
    - Aucune information PII (NIR, notes médicales, tokens) dans les logs
  </done>
  <rollback>
    `git revert` du commit fix (le logging seul peut rester si non-bloquant). Si fix RLS via migration, créer migration de rollback opposite (jamais `DROP POLICY` sans recreate).
  </rollback>
</task>

<task type="auto">
  <name>Task 1.2 — Seed démo glissant idempotent (DEC-039)</name>
  <files>
    supabase/seed.demo.sql
  </files>
  <action>
Per D-02 et DEC-039. Le seed `seed.demo.sql` utilise déjà `date_trunc('day', now() - interval '3 days')` etc. (dates relatives, correct). Le problème root cause : `ON CONFLICT (id) DO NOTHING` sur les rides démo `id LIKE '44444444-%'` empêche le ré-application des dates relatives après le premier seed.

Étapes :
1. Identifier dans `seed.demo.sql` les blocs `INSERT INTO public.rides ... ON CONFLICT (id) DO NOTHING` concernant les rides démo (id préfixé `44444444-`).
2. Remplacer `ON CONFLICT (id) DO NOTHING` par :
   ```
   ON CONFLICT (id) DO UPDATE SET
     scheduled_at = EXCLUDED.scheduled_at,
     started_at = EXCLUDED.started_at,
     ended_at = EXCLUDED.ended_at,
     created_at = EXCLUDED.created_at,
     status = EXCLUDED.status,
     pickup_address = EXCLUDED.pickup_address,
     dropoff_address = EXCLUDED.dropoff_address;
   ```
3. **Limiter ce comportement aux rides démo uniquement** : si le seed contient d'autres `INSERT INTO public.rides` non-démo, ne PAS appliquer `DO UPDATE` global. Garder `DO NOTHING` pour les autres seeds.
4. Mêmes principes pour les éventuelles tables liées (`ride_payments`, `ride_executions`) si elles sont seedées avec des dates relatives qui doivent rester glissantes.
5. Tester localement via `psql` contre `DATABASE_URL` preview OU via Supabase Studio SQL Editor en mode `BEGIN; <seed snippet>; SELECT id, scheduled_at FROM rides WHERE id LIKE '44444444-%' ORDER BY scheduled_at; ROLLBACK;` — vérifier que les dates sont bien réparties J-3, J-2, J-1, J0, J+1 par rapport à `now()`. **Pas d'écriture via MCP `apply_migration`** (DEC-032 LOCKED — toutes migrations + seeds via CD `supabase db push` exclusivement).
6. Pousser via CD : `git push` sur main → workflow `cd.yml` applique automatiquement `seed.demo.sql` (DEC-032).

Hors scope :
- Ne pas modifier les patients démo, drivers démo, vehicles démo (id différents `11111111-`, `22222222-`, `33333333-`).
- Ne pas ajouter de nouveaux rides : on garde le même nombre, on rend les dates glissantes.
- Ne pas modifier `seed.sql` (production-like, pas démo).

Threat model ASVS L1 :
- T-04.5-04 (Tampering) : `DO UPDATE` peut écraser une modification manuelle faite via UI sur une ride démo. Acceptable : les rides `44444444-%` sont strictement réservées à la démo, jamais modifiées manuellement par un utilisateur réel. Préciser dans un commentaire SQL : `-- WARNING: ces rides sont seedées et écrasées à chaque reseed. Ne pas éditer manuellement.`
- T-04.5-05 (Repudiation) : Le seed s'exécute en CD sous identité service. Audit logs trigger doit conserver l'historique des changements (déjà en place via `rides_audit_trigger`).
  </action>
  <verify>
    <automated>grep -c "ON CONFLICT (id) DO UPDATE SET" supabase/seed.demo.sql</automated>
    Doit retourner ≥ 1 (les rides démo). Tests manuels :
    1. Via Supabase Studio SQL Editor OU `psql` (lecture seule) : `SELECT id, scheduled_at, started_at, ended_at FROM public.rides WHERE id LIKE '44444444-%' ORDER BY scheduled_at;` après reseed CD → vérifier répartition J-3 / J-2 / J-1 / J0 / J+1.
    2. Le lendemain (J+1), re-déclencher workflow `cd.yml` (empty commit ou cron) — **PAS** d'écriture via Supabase MCP (DEC-032 LOCKED). Re-vérifier la query lecture seule : les dates doivent rester réparties J-3..J+1 par rapport au NOUVEAU now() (donc J-2 / J-1 / J0 / J+1 / J+2 par rapport à hier).
  </verify>
  <done>
    - `seed.demo.sql` patché avec `ON CONFLICT (id) DO UPDATE SET` sur rides démo uniquement
    - Test glissant : reseed un jour après → dates ré-évaluées
    - Commentaire SQL `-- WARNING reseed écrase modifications manuelles` ajouté
    - Aucune autre table affectée
  </done>
  <rollback>
    `git revert` du commit + re-trigger workflow `cd.yml`. Les rides existantes garderont leurs dates écrasées (acceptable : c'est de la donnée démo).
  </rollback>
</task>

<task type="auto">
  <name>Task 1.3 — Test E2E driver-workflow-complete</name>
  <files>
    apps/web/tests/e2e/driver-workflow-complete.spec.ts (nouveau)
  </files>
  <action>
Per D-03. Créer un nouveau test Playwright E2E couvrant le golden path chauffeur complet, exécuté contre la preview Vercel ou staging.

Étapes :
1. Créer `apps/web/tests/e2e/driver-workflow-complete.spec.ts`.
2. Utiliser le helper existant `loginAs(page, 'chauffeur')` (présent dans les autres `.spec.ts` Playwright du repo).
3. Structure du test (étapes séquentielles dans un seul `test()` non-idempotent V1 acceptable) :
   - `test.describe('Driver workflow E2E')`
   - `test.beforeEach` : `await loginAs(page, 'chauffeur')`
   - `test('chauffeur peut exécuter une course de bout en bout', async ({ page }) => {`
     - `await page.goto('/conduite')`
     - **Assertion 1** : `await expect(page.getByRole('listitem').first()).toBeVisible()` — ≥ 1 course visible. Si 0 course visible : `test.skip(..., 'seed démo consommé, à reseed avant retest')`.
     - **Action 1** : cliquer sur "Démarrer la course" (locator par texte ou data-testid). Si déjà démarrée (seed consommé), `test.skip`.
     - **Assertion 2** : toast sonner « Course démarrée » apparaît + bouton « Clôturer la course » visible.
     - **Action 2** : cliquer « Clôturer la course » → ouvre le formulaire/modal de clôture.
     - **Action 3** : saisir tarif (ex : 25 €) + sélectionner mode paiement (cash) + confirmer.
     - **Assertion 3** : statut de la course passe à « Terminée » (badge ou texte UI).
   - `})`
4. V1 non-idempotent acceptable : pas de cleanup BDD. Si le seed démo est consommé (course déjà terminée), le test `skip` proprement avec message explicite. Dette test future à inscrire dans CONCERNS.md.
5. Ajouter le test à la matrice Playwright preview-smoke si pertinent (cf. `.github/workflows/preview-smoke.yml`), OU exécuter en CI dédié driver workflow.

Hors scope :
- Pas de mock backend, pas de stub : test contre preview Vercel + Supabase staging réels.
- Pas de couverture des cas d'erreur (course non assignée, paiement échoué, etc.) — V1 happy path uniquement.

Threat model ASVS L1 :
- T-04.5-06 (Information Disclosure dans tests) : Le test utilise compte démo `chauffeur@demo.tap` avec mot de passe `demo1234!` (déjà documenté CLAUDE.md § 13.5, OK environnement preview/staging uniquement). NE PAS exécuter contre production commerciale.
- T-04.5-07 (Tampering données démo) : Test mutate des rides démo (start + end). Tolérable car DEC-039 (seed glissant) réinitialise quotidiennement via reseed automatique.
  </action>
  <verify>
    <automated>cd apps/web && pnpm exec playwright test tests/e2e/driver-workflow-complete.spec.ts --reporter=line</automated>
    Le test doit PASS ou SKIP explicitement (avec message clair) si seed consommé. Aucun FAIL toléré.
  </verify>
  <done>
    - Test E2E créé et committé
    - Test PASS sur preview Vercel après seed frais
    - Test SKIP propre si seed consommé (pas de FAIL flaky)
    - Aucune fuite de credentials hors comptes démo
  </done>
  <rollback>
    `git revert` du commit. Test absent ≠ régression fonctionnelle, juste dette.
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Auth → /conduite query | JWT Supabase + RLS rides_select |
| CD GitHub Actions → Supabase | Service role + db push |
| Playwright preview → Vercel preview | Test compte démo `chauffeur@demo.tap` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-01 | Information Disclosure | logging défensif /conduite | mitigate | Pas de NIR / notes médicales / tokens dans les logs. user_id et organization_id (UUID) acceptables. |
| T-04.5-02 | Spoofing | RLS rides_select (si fix H1) | mitigate | Test pgTAP : un chauffeur ne voit QUE ses rides après fix |
| T-04.5-03 | Tampering | log poisoning | mitigate | Logs proviennent d'auth + Supabase error.message, pas d'input utilisateur |
| T-04.5-04 | Tampering | seed démo ON CONFLICT DO UPDATE | accept | Rides 44444444-% strictement démo, commentaire SQL warning |
| T-04.5-05 | Repudiation | reseed automatique | mitigate | rides_audit_trigger conserve historique |
| T-04.5-06 | Information Disclosure | credentials test E2E | mitigate | Comptes démo uniquement, jamais production |
| T-04.5-07 | Tampering | test E2E mutate rides démo | accept | DEC-039 (seed glissant) régénère automatiquement |
</threat_model>

<verification>
1. `/conduite` affiche ≥ 1 course sur preview Vercel pour compte démo chauffeur
2. `seed.demo.sql` re-appliqué à J+1 produit des rides J-2/J-1/J0/J+1/J+2 (glissant)
3. Test Playwright `driver-workflow-complete.spec.ts` PASS ou SKIP propre
4. Logging défensif présent ET fix root cause appliqué (defense in depth)
5. Aucun PII dans les logs Vercel Runtime
</verification>

<success_criteria>
- [ ] PR mergée, deploy preview verte
- [ ] Démo : régulateur connecté en compte démo `chauffeur@demo.tap` peut démarrer + clôturer une course sans assistance dev
- [ ] DEC-039 inscrite en PROJECT.md (post-planning, par orchestrateur)
- [ ] Logs Vercel : root cause documentée dans le commit message (H1 / H2 / H3)
</success_criteria>

<output>
Après exécution, créer `.planning/phases/04.5-robustesse-regulateur/04.5-1-SUMMARY.md` avec :
- Cause root identifiée (H1 / H2 / H3) et fix appliqué
- Capture preview Vercel /conduite avec ≥ 1 course
- Lien vers run Playwright PASS
- Test glissant reseed J+1 documenté
</output>
