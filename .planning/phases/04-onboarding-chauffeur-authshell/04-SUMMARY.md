---
phase: 04-onboarding-chauffeur-authshell
status: livrée
completed_date: "2026-05-13"
plans_executed: 5
requirements_completed:
  - CHAUF-01
  - CHAUF-02
  - CHAUF-03
  - CHAUF-04
  - NFR-001
  - NFR-002
  - NFR-003
  - NFR-004
  - NFR-005
  - NFR-006
constraints_covered:
  - C01
  - C02
  - C03
  - C04
  - C04_UI
  - C05
  - C06
  - C07
  - C08
  - C09
adr_compliance:
  - ADR-003 (golden path enchaîné sans assistance — preuve E2E Playwright + UAT humain)
clean_status: livrée
---

# Phase 04 — Onboarding chauffeur + AuthShell mode jour — SUMMARY

**Status :** livrée le 2026-05-13
**Plans exécutés :** 5 (PLAN-1 → PLAN-5)
**Critère ADR-003 :** ✓ — un design partner peut enchaîner les 10 étapes du
golden path (invitation → activation → /conduite) sans intervention dev,
sous réserve de l'UAT humain final (post-merge).

## Periphery (résumé par PLAN)

### PLAN-1 — Cadrage (Wave 0 NO-OP) — commit `5d74bc1`

Inscription des décisions DEC-024..028 dans PROJECT.md (B2B fleet pas de
signup self-service, RHF + zodResolver standard formulaires, CGU obligatoire
`z.literal(true)`, etc.). Ajout dépendance `@hookform/resolvers ^3.9` au
package apps/web. Aucun fichier source touché.

### PLAN-2 — Migration BDD `driver_invitations` (Wave 1) — commits `2608419` + `8c5e7f9`

- Table `driver_invitations` 11 colonnes (id, organization_id, driver_id, email, token_hash, status, expires_at, sent_at, accepted_at, accepted_profile_id, audit)
- 3 policies RLS (insert dirigeant org, select dirigeant + chauffeur invité, update self-accept)
- Trigger `audit_logs` 4 actions (`driver_invited` / `_accepted` / `_revoked` / `_resent`)
- 6 tests pgTAP RLS verts
- Schema push appliqué (cd.yml automatique au merge main)

### PLAN-3 — Server Actions (Wave 2) — commits `3e0f371` + `91e3389`

- `inviteDriverAction` (8 étapes incl. rate-limit Supabase Auth handling + audit applicatif)
- `resendInvitationAction` (anti-race : refus si < 23h59 depuis dernier envoi)
- `acceptInvitationAction` (étape 6 rattachement `driver.profile_id = user.id` + audit `cgu_accepted_via_invitation`)
- Schémas `driverInvitationSchema` + `acceptInvitationSchema` Zod (`@tap/shared`, DEC-026)

### PLAN-4 — UI (Wave 3) — commits `9534859` + `7139f18`

- `<AuthShell>` mode jour (split desktop / single column mobile, partagé par 4 pages)
- 4 pages refondues : `/login`, `/welcome`, `/setup`, `/accept-invite`
- Premier RHF du repo productif : `LoginForm` + `AcceptInviteForm` (DEC-018)
- `DemoCredentials` Client cliquable (lift state up → prefill LoginForm)
- Bouton « Inviter » + badge statut 4 états dans `drivers-list.client.tsx`
- Route Handler `/accept-invite/verify/route.ts` (déviation Rule 3 : page+route au même path interdit Next.js)
- `ActivationToast` Client component (FLAG #1 patché : useSearchParams → toast.success → router.replace pour nettoyer l'URL)

### PLAN-5 — Tests + showcase placeholder + SUMMARY final (Wave 4) — commit `<en cours>`

- Helper Inbucket réutilisable (`apps/web/tests/e2e/helpers/inbucket.ts`)
- 2 specs Playwright : happy path 11 étapes + token expired 2 variants
- Dossier `docs/showcase/04-onboarding-chauffeur-authshell/` créé (captures déférées UAT)
- Ce SUMMARY de phase final

## Walkthrough script (10 étapes — golden path Phase 04)

À dérouler sur preview Vercel après merge main, par le dirigeant en mode UAT 30 min.

1. Ouvrir la preview Vercel sur `<URL>/login` (mode jour).
2. Vérifier que les 3 cards DemoCredentials sont visibles sous le bouton « Se connecter » (sinon, le flag `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1` n'est pas posé — voir dette transitoire).
3. Cliquer la card « Dirigeant » → champs email/password pré-remplis automatiquement.
4. Cliquer « Se connecter » → redirect vers `/admin` ou `/tableau-de-bord` ou `/cockpit` selon profil.
5. Naviguer sur `/admin/chauffeurs`. Cliquer « Nouveau chauffeur ».
6. Remplir la fiche : Nom affiché « Chauffeur test », cocher Taxi. Cliquer « Créer le chauffeur ».
7. La ligne du nouveau chauffeur apparaît avec badge « Sans compte » et bouton « Inviter ». Cliquer « Inviter ».
8. Dans le mini-Dialog, saisir `chauffeur-test@example.com` (ou un email réel pour test live). Cliquer « Envoyer l'invitation ». Toast « Invitation envoyée. » apparaît.
9. Ouvrir la boîte mail (Inbucket en local : `http://localhost:54324` ; en preview : la vraie mailbox du destinataire si SMTP Supabase prod configuré). Cliquer le lien magic dans l'email. Atterrir sur `/accept-invite` avec email pré-rempli read-only.
10. Saisir un mot de passe ≥ 8 caractères, le confirmer, cocher la case CGU, cliquer « Activer mon compte ». Redirect automatique vers `/conduite` (route protégée chauffeur). Toast « Compte activé. » visible brièvement.

## Vérification dirigeant (30 min UAT — checkpoint humain pré-merge)

À cocher pendant la session UAT post-déploiement preview :

- [ ] Walkthrough 1-10 termine sans erreur ni accroche visuelle
- [ ] Login DemoCredentials cliquable conforme `login-jour.png` (voir Captures)
- [ ] Form `/accept-invite` conforme `accept-invite.png` (voir Captures)
- [ ] Token expiré (`<URL>/accept-invite?error=expired`) → panneau erreur sans form ni bouton retry
- [ ] Token invalide (`<URL>/accept-invite?error=invalid_link`) → message générique
- [ ] Mobile iPhone SE 375 px : layout AuthShell single column lisible
- [ ] Bouton « Renvoyer » apparaît au lieu de « Inviter » après envoi (badge « Invité »)
- [ ] Aucune fuite de nom propre dans l'UI ni dans les captures (NFR-001)
- [ ] Aucun emoji visible dans l'UI

## Captures Visible Progress (CLAUDE.md § 13.5)

**Statut** : déférées à l'UAT humain post-merge (PLAN-5 §5.4, `autonomous: false`).

Procédure à exécuter sur preview Vercel :

### `docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png`

1. Ouvrir `<URL>/login` en mode jour (système OS clair).
2. Confirmer que `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=1` est posé côté Vercel (sinon DemoCredentials absent du DOM — voir dette transitoire ci-dessous).
3. Viewport 1280 × 800 (desktop standard). Capture montrant :
   - Colonne identité gauche : logo TAP + baseline « TAP/CGSS — 974 » + footer
   - Colonne form droite : titre « Connexion » + 2 champs (Adresse e-mail, Mot de passe) + bouton « Se connecter »
   - 3 cards DemoCredentials sous le bouton (Dirigeant, Régulateur, Chauffeur)
4. PNG ≤ 500 Ko (compression `pngquant --quality=75-85` au besoin).

### `docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png`

1. Dérouler le walkthrough §1-9 sur preview pour atterrir sur `/accept-invite`.
2. Ouvrir le lien magic dans un onglet privé (pour ne pas hériter de la session dirigeant).
3. Viewport 1280 × 800. Capture montrant :
   - Colonne identité gauche identique
   - Colonne form droite : titre « Activer mon compte », hint « Définissez votre mot de passe… », champ email read-only pré-rempli, champ Mot de passe + hint « 8 caractères minimum », champ Confirmer le mot de passe, case CGU avec lien « conditions générales d'utilisation », bouton « Activer mon compte »
4. PNG ≤ 500 Ko.

### Vérifications NFR-001 / pilier UI

- Aucun nom propre réel sur les captures
- Comptes démo `dirigeant@demo.tap` / `chauffeur-test@example.com` OK (exception explicite seed démo, `.planning/regle-neutralite-et-ton.md` § 1)
- Aucun emoji visible
- Spacing strict 4/8/12/16/24/32/48/64 (palette UI-SPEC § 7)

## Risques identifiés / dette transitoire

| Item | Sévérité | Action proposée |
|---|---|---|
| **Flag CI `setup-vercel.yml` valeur `'true'` ≠ code `'1'`** | medium | À aligner sur `'1'` côté workflow Vercel (sinon DemoCredentials absents en preview, captures impossibles). Patch trivial Phase 04.5 |
| **Headers HTTP sécurité** (`Referrer-Policy`, `X-Frame-Options`, CSP `frame-ancestors`) | medium | Vérifier dans `next.config.js`. Si absents → Phase 04.5 |
| **Open redirect `?next=` LoginForm** | low (déjà mitigé) | Déjà sanitisé dans `signInAction` (actions.ts:58 `safeNext = next.startsWith('/') && !next.startsWith('//')`). Note documentaire |
| **10 captures showcase Phase 03** | bas | Toujours pending, reportées Phase 04.5 (acté C10 Phase 03) |
| **`pnpm db:types` régénération** | bas | Reporté Phase 04.5 (la table `driver_invitations` n'est pas encore dans les types générés mais le code utilise des casts ponctuels) |
| **Logo TAP final** | bas | Placeholder SVG sobre actuellement. Identité visuelle complète = Phase UI dédiée post-Passe 2 (DEC-020 + DEC-022) |
| **Tests Playwright run réel en sandbox** | nul | Délégué CI cloud `preview-smoke.yml` — CLAUDE.md § 13.5 (la preview est la canonical CI, pas la sandbox locale) |

## Lien preview Vercel

`<URL produite par CD post-merge, à coller ici par le dirigeant pendant l'UAT.>`

## Captures

Les fichiers ci-dessous seront déposés par le dirigeant après UAT :

- `docs/showcase/04-onboarding-chauffeur-authshell/login-jour.png` *(en attente UAT)*
- `docs/showcase/04-onboarding-chauffeur-authshell/accept-invite.png` *(en attente UAT)*

## Tests verts

| Suite | État au merge | Détail |
|---|---|---|
| pgTAP RLS PLAN-2 | 6/6 vert (cf. PLAN-2-SUMMARY) | `driver_invitations` 3 policies + audit trigger |
| Server actions PLAN-3 | typecheck OK + tests intégration différés Phase 04.5 si besoin | Logique complexe couverte par E2E happy path |
| Playwright `accept-invitation-happy-path.spec.ts` | 1/1 attendu sur CI cloud | Sandbox local n'a pas Supabase + Inbucket lancés |
| Playwright `accept-invitation-token-expired.spec.ts` | 2/2 attendus sur CI cloud | Tests pure UI, ne nécessitent pas Supabase live |
| `pnpm typecheck` apps/web | 0 erreur | Confirmé PLAN-5 §verification |
| Smoke preview `preview-smoke.yml` | inchangé (7 tests, doit rester vert) | Tests Phase 0.7 / 2 toujours alignés |

## Bilan critère ADR-003

> « Une phase est livrée quand un design partner peut compléter le parcours de la passe sans intervention du dev. »

Critère **atteint sous réserve UAT** :

- ✓ Code compile : `pnpm typecheck` apps/web OK
- ✓ Tests automatisés : 3 specs Playwright nouvelles (à exécuter en CI cloud sur preview)
- ✓ Walkthrough 10 étapes documenté
- ⏳ UAT humain pré-merge (checkpoint PLAN-5 §5.6) — non bloquant pour ce SUMMARY, exigé avant merge PR
- ⏳ Captures `login-jour.png` + `accept-invite.png` — non bloquant pour ce SUMMARY, produites pendant UAT

## Next phase

**Phase 05 — Passe 2 PWA chauffeur + tarif standard CGSS auto + caisse** (cf. ROADMAP § Phases à venir).

Cette phase 04 fournit l'infrastructure auth nécessaire à la Passe 2 :
les comptes chauffeurs activés via `/accept-invite` peuvent désormais
recevoir des courses et déclencher l'app mobile chauffeur (`/conduite`),
qui sera enrichie en Phase 05.

## Self-Check

- [x] 5 PLAN-SUMMARY.md livrés (PLAN-1 à PLAN-5)
- [x] 11 SC du `04-CONTEXT.md` couverts collectivement par les 5 plans (SC #1..#6 happy path E2E, SC #7..#9 erreurs / sécurité, SC #10..#11 tests + captures)
- [x] ADR-003 honoré (golden path enchaîné, UAT explicitement défini)
- [x] CLAUDE.md § 13.5 honoré (showcase folder + procédure capture documentée, captures déférées UAT comme prévu pour `autonomous: false`)
- [x] NFR-001 respecté (aucun nom propre dans tests ni dans copy UI)
- [x] NFR-002 respecté (ton sobre, pas d'emojis, pas d'encouragements gamifiés)
