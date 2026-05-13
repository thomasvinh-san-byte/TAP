---
phase: 04-onboarding-chauffeur-authshell
plan: 5
wave: 4
covers_constraints: [C08, C09]
requirements_completed: [CHAUF-01, CHAUF-02, CHAUF-03, CHAUF-04, NFR-001, NFR-002, NFR-006]
tech-stack:
  added:
    - "@playwright/test (déjà installé, nouveau pattern helper réutilisable)"
  patterns:
    - "Helper Inbucket réutilisable (apps/web/tests/e2e/helpers/inbucket.ts) — pattern à dupliquer pour futures specs invitation"
    - "Pattern reset Inbucket en beforeEach (Q4.2) — isolation runs"
    - "Pattern context.clearCookies() pour simuler onglet privé chauffeur (vs /logout endpoint absent)"
    - "Regex URL invitation tolérant /accept-invite ET /accept-invite/verify (déviation Route Handler PLAN-4)"
key-files:
  created:
    - apps/web/tests/e2e/helpers/inbucket.ts
    - apps/web/tests/e2e/accept-invitation-happy-path.spec.ts
    - apps/web/tests/e2e/accept-invitation-token-expired.spec.ts
    - docs/showcase/04-onboarding-chauffeur-authshell/.gitkeep
    - .planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md
  modified: []
decisions:
  - "Captures Visible Progress (login-jour.png + accept-invite.png) DÉFÉRÉES à l'UAT humain post-merge — autonomous: false du plan respecté, captures impossibles en sandbox sans preview Vercel live (CLAUDE.md § 13.5)"
  - "Bouton 'Inviter' ciblé via filter sur <li> contenant le nom du chauffeur (vs getByRole('row') initialement suggéré PLAN-5 §5.2) — la liste drivers utilise <ul>/<li>, pas un <table> sémantique"
  - "Sélecteur 'Nouveau chauffeur' (pas 'Ajouter') — copy réelle du DOM dans drivers-list.client.tsx ligne 148"
  - "Bouton submit 'Créer le chauffeur' (pas 'Enregistrer') — copy réelle driver-form.client.tsx ligne 169"
  - "Vérification readonly via toHaveJSProperty('readOnly', true) (vs toHaveAttribute('readonly', '')) — robuste aux différentes sérialisations React/HTML"
metrics:
  duration: "~30 min"
  tasks_completed: 5
  files_created: 5
  files_modified: 0
  commits: 1
completed_date: "2026-05-13"
---

# Phase 04 Plan 5 : Tests Playwright invitation chauffeur + showcase placeholder + SUMMARY final (C08 + C09) — Summary

3 fichiers de tests E2E livrés (1 helper Inbucket + 2 specs Playwright), 1 placeholder showcase, 1 SUMMARY de phase final. Pas de captures PNG produites dans cette wave (autonomous: false respecté). Tests `--list` OK 30/30 (3 nouveaux + 27 existants), typecheck OK, prêts pour exécution CI cloud `preview-smoke.yml`.

## Constat travail effectué

| Tâche PLAN-5 | Livrable | Path |
|---|---|---|
| §5.1 Helper Inbucket | `resetInbucketMailbox` + `fetchLatestInviteUrl` polling 10×1s | `apps/web/tests/e2e/helpers/inbucket.ts` (66L) |
| §5.2 Spec happy path | 1 test, 11 étapes (login dirigeant → invite → magic link → activation → /conduite) | `apps/web/tests/e2e/accept-invitation-happy-path.spec.ts` (113L) |
| §5.3 Spec token expiré | 2 tests (?error=expired + ?error=invalid_link), 4+3 assertions | `apps/web/tests/e2e/accept-invitation-token-expired.spec.ts` (60L) |
| §5.4 Captures placeholder | Dossier showcase créé avec .gitkeep, captures réelles déférées UAT | `docs/showcase/04-onboarding-chauffeur-authshell/.gitkeep` |
| §5.5 04-SUMMARY.md final | Bilan de phase 5 plans + walkthrough + UAT checklist + dette transitoire | `.planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md` |

## Traçabilité contraintes

### C08 — 2 tests Playwright (happy path + token expired)

**Happy path** (`accept-invitation-happy-path.spec.ts`) :
- Reset Inbucket `beforeEach` → isolation runs (Q4.2)
- Login dirigeant `dirigeant@demo.tap` / `demo1234!` via DemoCredentials seed
- Navigation `/admin/chauffeurs` → bouton « Nouveau chauffeur » → Sheet Form
- Création driver `Chauffeur test` + type_permis Taxi → submit
- Filter ligne `<li>` par nom → bouton « Inviter » → Dialog mini-form
- Saisie `chauffeur-test@example.com` → bouton « Envoyer l'invitation »
- Toast Sonner « Invitation envoyée. »
- `fetchLatestInviteUrl` → URL extraite via regex tolérant `/accept-invite|verify`
- `context.clearCookies()` pour simuler onglet privé
- `page.goto(inviteUrl)` → Route Handler `/accept-invite/verify` redirige vers `/accept-invite` (PLAN-4 déviation)
- Vérif email readonly pré-rempli + form RHF complet
- Saisie password + confirm + CGU → bouton « Activer mon compte »
- Assert `waitForURL(/\/conduite/)` (preuve fonctionnelle : route protégée chauffeur n'est accessible qu'aux profiles role='chauffeur' authentifiés post-acceptInvitationAction étape 6 rattachement)

**Token expired** (`accept-invitation-token-expired.spec.ts`) :
- 2 specs : `?error=expired` + `?error=invalid_link`
- Pas de génération réelle de token expiré requise : la page Server Component branche sur `searchParams.error` AVANT toute vérif de session (cf. accept-invite/page.tsx lignes 36-50)
- Assertions DEC-024 (B2B fleet, pas de signup self-service) :
  - Panneau erreur visible avec message factuel FR
  - Aucun champ password rendu (`toHaveCount(0)`)
  - Aucun bouton retry / renvoi (`toHaveCount(0)`)
  - Indication explicite « Contactez votre régulateur »

### C09 — 2 captures Visible Progress

`autonomous: false` du plan respecté. Les captures `login-jour.png` et `accept-invite.png` sont **déférées à l'UAT humain post-merge** (CLAUDE.md § 13.5 — la preview Vercel est la canonical CI, pas la sandbox locale). Procédure détaillée dans `04-SUMMARY.md` § Vérification dirigeant.

Dossier `docs/showcase/04-onboarding-chauffeur-authshell/` créé avec `.gitkeep` pour que la structure existe au merge ; les PNG y sont déposés par le dirigeant pendant l'UAT.

## Déviations PLAN-5

### [Rule 1 — Cohérence sélecteur] Bouton « Nouveau chauffeur » (pas « Ajouter »)
- **Found during** : §5.2 (rédaction spec happy path)
- **Issue** : le PLAN-5 §5.2 suggérait `name: /Nouveau chauffeur|Ajouter/`, mais le DOM réel ne contient que « Nouveau chauffeur » (drivers-list.client.tsx ligne 148). Le pattern OR aurait fonctionné mais introduit une ambiguïté.
- **Fix** : sélecteur strict `/nouveau chauffeur/i`. Aligne le test sur la copy réelle UI-SPEC.
- **Files modified** : `accept-invitation-happy-path.spec.ts`

### [Rule 1 — Cohérence sélecteur] Bouton submit driver-form « Créer le chauffeur »
- **Found during** : §5.2
- **Issue** : PLAN-5 suggérait `/Enregistrer|Créer/`, le DOM réel est « Créer le chauffeur » (driver-form.client.tsx ligne 169 SubmitButton edit=false).
- **Fix** : sélecteur strict `/créer le chauffeur/i`.

### [Rule 3 — Blocking] Filter ligne par `<li>` (pas `getByRole('row')`)
- **Found during** : §5.2 click bouton Inviter
- **Issue** : la liste drivers utilise `<ul>` / `<li>` (drivers-list.client.tsx ligne 155-211), PAS un `<table>` sémantique. `getByRole('row')` aurait renvoyé `count=0`.
- **Fix** : `page.locator('li').filter({ hasText: TEST_DRIVER_NAME }).first()` puis `.getByRole('button', { name: /^Inviter$/ })`.

### [Rule 1 — Bug fix proactif] Vérif readonly via toHaveJSProperty
- **Found during** : §5.2 assertion email pré-rempli
- **Issue** : `toHaveAttribute('readonly', '')` est fragile selon la sérialisation React (string vide vs présent sans valeur vs boolean attribute).
- **Fix** : `toHaveJSProperty('readOnly', true)` lit la propriété DOM directement (robuste, indépendant du rendu attribut).

### [Note documentaire] `/logout` endpoint absent → `context.clearCookies()`
- **Found during** : §5.2 étape 6 « se déconnecter du dirigeant »
- **Issue** : pas d'endpoint `/logout` exposé V1 (seul `signOutAction` côté server, déclenché via bouton header).
- **Fix** : `context.clearCookies()` Playwright purge la session côté browser comme un onglet privé. Plus rapide et stable que naviguer vers un bouton de header.

### [Constat] Captures PNG déférées (autonomous: false)
- **Found during** : §5.4
- **Issue** : production de captures nécessite preview Vercel live + flag `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1` actif (dette PLAN-4 §4.4 : actuellement `'true'` côté `setup-vercel.yml`). Impossible en sandbox.
- **Fix** : dossier showcase créé avec `.gitkeep`, procédure détaillée dans 04-SUMMARY.md pour UAT. **Pas un blocker** — autonomous: false du plan explicite.

## Verification

| Contrôle | Statut | Détail |
|---|---|---|
| `pnpm typecheck` apps/web | OK | `tsc --noEmit` exit 0 (aucun nouveau error) |
| `pnpm exec playwright test --list` | OK | 30 tests listés total, 3 nouveaux PLAN-5 (1 happy path + 2 token expired) — compilation TS OK |
| Tests Playwright run réel | DÉFÉRÉ CI | Sandbox local n'a pas Supabase + Inbucket lancés. CI cloud `preview-smoke.yml` (déclenché sur deployment_status Vercel preview) exécute la suite complète |
| 2 captures PNG ≤ 500 Ko | DÉFÉRÉ UAT | autonomous: false → produites manuellement post-merge sur preview Vercel par le dirigeant |
| `04-SUMMARY.md` walkthrough + UAT + dette | OK | Voir fichier dédié |
| Aucun nom propre (NFR-001) | OK | `Chauffeur test`, `chauffeur-test@example.com`. Comptes démo `@demo.tap` exceptionnels OK |

## Threat model résumé (recopié PLAN-5 § Threat model)

| Item | Évaluation |
|---|---|
| Tests exposent credentials | Comptes démo `@demo.tap` + `demo1234!` apparaissent dans les specs. Acceptable : credentials seed démo déjà publics dans `setup-vercel.yml`. ABSENTS en prod commerciale (flag retiré) |
| Captures fuitent données réelles | NFR-001 : « Chauffeur test », `chauffeur-test@example.com` — données fictives. Pas de NIR/téléphone réel exposable |
| Inbucket exposé en prod | Inbucket = service local Supabase dev. En CI cloud il tourne dans le runner GitHub Actions, jamais exposé Internet |
| Token leakage dans Playwright trace | URL `?token_hash=...` capturée trace garde sur échec uniquement (CI artifact, purge auto 30j). Token Supabase expire 24h → impact nul |

Pas de surface code production touchée → pas de STRIDE applicable.

## Next step

PLAN-5 conclut la phase 04. Le SUMMARY de phase final (`04-SUMMARY.md`) est livré et prêt pour `/gsd-verify-work` ultérieur après UAT humain et merge sur main.

**Checkpoint humain UAT** (autonomous: false, hors scope agent) :
1. CI cloud `preview-smoke.yml` exécute les 3 specs → 30/30 vert
2. Dirigeant déroule walkthrough 10 étapes sur preview Vercel
3. Production des 2 captures PNG ≤ 500 Ko dans `docs/showcase/04-onboarding-chauffeur-authshell/`
4. URL preview collée dans 04-SUMMARY.md § Lien preview Vercel
5. Merge PR phase 04 sur main

## Self-Check

- [x] `apps/web/tests/e2e/helpers/inbucket.ts` créé
- [x] `apps/web/tests/e2e/accept-invitation-happy-path.spec.ts` créé
- [x] `apps/web/tests/e2e/accept-invitation-token-expired.spec.ts` créé
- [x] `docs/showcase/04-onboarding-chauffeur-authshell/.gitkeep` créé
- [x] `.planning/phases/04-onboarding-chauffeur-authshell/04-SUMMARY.md` créé
- [x] `pnpm typecheck` apps/web OK
- [x] `playwright test --list` 30 tests dont 3 nouveaux OK
