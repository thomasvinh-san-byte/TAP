---
phase: 04-onboarding-chauffeur-authshell
plan: 3
wave: 2
covers_constraints: [C02, C03, C04_partial]
requirements_completed: [CHAUF-01, CHAUF-02, CHAUF-04, NFR-006]
tech-stack:
  added: []
  patterns:
    - "Server Actions Next.js 14 App Router (`'use server'`)"
    - "Pattern CLAUDE.md § 10 : guard rôle → safeParse zod → mutation → audit (trigger BDD ou applicatif) → revalidatePath/redirect"
    - "Client Supabase admin (service_role) instancié server-only via createAdminClient()"
    - "Idempotence via clauses `.eq('status', 'pending')` + `.is('profile_id', null)` (anti double-submit)"
    - "Audit log applicatif `cgu_accepted_via_invitation` (DEC-027 — pas de trigger BDD pour cette action)"
key-files:
  created:
    - packages/shared/src/schemas/driver-invitation.ts
    - apps/web/src/app/(auth)/accept-invite/actions.ts
    - .planning/phases/04-onboarding-chauffeur-authshell/deferred-items.md
  modified:
    - packages/shared/src/index.ts
    - apps/web/src/app/(admin)/admin/chauffeurs/actions.ts
decisions:
  - "Helper resolveOrigin() centralisé : `headers().get('origin')` + fallback NEXT_PUBLIC_APP_URL — utilisé par inviteDriverAction et resendInvitationAction"
  - "createAdminClient() (service_role) ré-instancié par appel d'action — pas de cache module-level pour préserver le scope server-only (vs. singleton qui pourrait fuiter en client)"
  - "Helper flattenFieldErrors local à accept-invite/actions.ts (pas de cross-import du dossier admin/) — duplication de 6 lignes acceptée pour préserver l'isolation route group"
  - "Rule SCOPE BOUNDARY appliquée sur lint cassé pré-existant (ESLint v10 flat config absent) — déféré dans deferred-items.md"
metrics:
  duration: "~30 min"
  tasks_completed: 5
  files_created: 3
  files_modified: 2
  commits: 1
completed_date: "2026-05-13"
---

# Phase 04 Plan 3 : Server Actions invitation chauffeur (C02 + C03 + C04 partial) — Summary

3 Server Actions livrées (`inviteDriverAction`, `resendInvitationAction`, `acceptInvitationAction`) avec 2 schémas Zod séparés `driverInvitationSchema` + `acceptInvitationSchema` (DEC-026). Pattern CLAUDE.md § 10 respecté : guard rôle → validation → mutation → audit (trigger BDD pour invite/resend/accepted, applicatif pour CGU) → revalidate/redirect. Service-role client confiné `'use server'`.

## Constat travail effectué

| Tâche | Livrable | Commit |
|---|---|---|
| §3.1 Schémas Zod (driverInvitationSchema + acceptInvitationSchema) | `packages/shared/src/schemas/driver-invitation.ts` (52 lignes) + re-export depuis `index.ts` | `3e0f371` |
| §3.2 `inviteDriverAction` (8 étapes spec) | Extension `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` (+~160 lignes) | `3e0f371` |
| §3.3 `resendInvitationAction` (anti-race 23h59) | Idem ci-dessus | `3e0f371` |
| §3.4 `acceptInvitationAction` (7 étapes + audit applicatif CGU) | `apps/web/src/app/(auth)/accept-invite/actions.ts` (174 lignes, nouveau) | `3e0f371` |
| §3.5 Commit unique format spec | Commit message exact, 4 fichiers code, 462 insertions | `3e0f371` |

## Traçabilité C02 + C03 + C04 (partiel)

### C02 — `inviteDriverAction` Server Action, 8 étapes fidèles

| Sous-exigence C02 | Implémentation | Localisation |
|---|---|---|
| Guard rôle dirigeant | `requireDirigeant()` (defense in depth en plus de RLS BDD) | `actions.ts` étape 1 |
| Validation zod | `driverInvitationSchema.safeParse({ email, driverId })` | `actions.ts` étape 2 |
| Check email collision auth.users | `supabaseAdmin.auth.admin.listUsers()` + find `email.toLowerCase()` | `actions.ts` étape 3 |
| Check driver existe + org match + actif + non rattaché | SELECT `drivers` puis 4 checks (archive, actif, profile_id, organization_id) | `actions.ts` étape 4 |
| `supabase.auth.admin.inviteUserByEmail` avec metadata role + driver_id + organization_id, redirectTo /accept-invite | Service-role client + try/catch rate limit (429 → message friendly) | `actions.ts` étape 5 |
| INSERT `driver_invitations` status='pending' | RLS-protégé via policy `driver_invitations_insert_dirigeant` + unique index partiel pending (catch 23505 → message dédié) | `actions.ts` étape 6 |
| `revalidatePath('/admin/chauffeurs')` | Présent | `actions.ts` étape 7 |
| Retour `ActionState { success, id }` | `{ success: true, id: invitation.id }` | `actions.ts` étape 8 |
| Gestion rate limit | `inviteErr.status === 429` ou `message.includes('rate')` → « Email non envoyé (limite atteinte, ré-essayer dans 1h…) » | `actions.ts` étape 5 |
| Gestion 23505 (doublon pending) | catch code `23505` → « Une invitation est déjà en cours pour cet email » | `actions.ts` étape 6 |

### C03 — `resendInvitationAction` (anti-race 23h59)

| Sous-exigence C03 | Implémentation | Localisation |
|---|---|---|
| Validation UUID | `z.string().uuid().safeParse(invitationId)` | étape 0 |
| Guard dirigeant | `requireDirigeant()` | étape 0 |
| Fetch invitation + ownership (`.eq('invited_by', ctx.userId)`) | SELECT scoped | étape 1 |
| Check status='pending' (refuse accepted/revoked) | `if (inv.status !== 'pending') return error` | étape 1 |
| Anti-race 23h59 (refuse si invitation toute neuve) | `remainingMs > 23h59m → error` | étape 2 |
| Re-call `inviteUserByEmail` (regen magic link) | Service-role client | étape 3 |
| Bump `expires_at = now() + 24h` | UPDATE row | étape 4 |
| Trigger BDD émet `driver_invitation_resent` | Trigger AFTER UPDATE existant PLAN-2 | implicite |

### C04 (partiel — code uniquement, UI = PLAN-4)

| Sous-exigence C04 | Implémentation | Localisation |
|---|---|---|
| Session active (verifyOtp PLAN-4 GET) | `supabase.auth.getUser()` + check user.email | étape 0 |
| Validation zod (mdp ≥ 8 + match + CGU=true) | `acceptInvitationSchema.safeParse` | étape 1 |
| Retrouver invitation pending matchée sur email | SELECT scoped RLS `driver_invitations` | étape 2 |
| Check `expires_at > now()` | `if (new Date(expires_at) < now) return error 'Lien expiré'` | étape 3 |
| `supabase.auth.updateUser({ password })` | Pose le mdp Supabase Auth | étape 4 |
| UPDATE driver_invitations status='accepted' + accepted_at | Trigger émet `driver_invitation_accepted` | étape 5 |
| UPDATE drivers.profile_id = auth.uid() avec `.is('profile_id', null)` | Idempotent | étape 6 |
| INSERT audit_logs `cgu_accepted_via_invitation` (DEC-027) | metadata = { invitation_id, cgu_version } | étape 7 |
| redirect `/conduite?activated=1` (FLAG #1) | Toast Sonner déclenché côté `/conduite` PLAN-4 | étape 8 |

## Conformité DEC-026 + DEC-027

**DEC-026 (schémas séparés)** : `driverInvitationSchema` et `acceptInvitationSchema` créés dans un **nouveau** fichier `packages/shared/src/schemas/driver-invitation.ts`. **AUCUNE extension** de `driverInputSchema` (`packages/shared/src/validators/driver.ts` non touché). Re-export dédié dans `index.ts`.

**DEC-027 (CGU + audit applicatif)** :
- Zod : `cguAccepted: z.literal(true, { errorMap: ... })` — un missing/false fait échouer `safeParse` côté serveur (la case côté Client est défense en plus).
- Audit log : `INSERT audit_logs (action='cgu_accepted_via_invitation', metadata={invitation_id, cgu_version})` exécuté SYSTÉMATIQUEMENT côté `acceptInvitationAction` étape 7 — pas de trigger BDD pour cette action sémantique (DEC-027 explicite).

## Threat model résumé

| Threat | Risk | Mitigation livrée |
|---|---|---|
| **Email enumeration via collision check** | MEDIUM | `listUsers()` gated par `requireDirigeant()` — pas de surface publique. RGPD : un dirigeant a déjà accès aux emails de son org via UI native. |
| **Privilege escalation via metadata Supabase** | HIGH | `data: { role: 'chauffeur' }` passé via **service_role** côté serveur. `user_metadata` Supabase n'est PAS la source de vérité du rôle (c'est `public.profiles.role` RLS-protégé via `has_role()`). |
| **Mass invitation spam** | MEDIUM | Rate limit Supabase 3/h SMTP intégré V1 bloque déjà. Audit trace chaque `driver_invited`. Throttling fin reporté V2 SMTP custom. |
| **Token URL leak (referer / history)** | LOW | Trade-off Q6.2 accepté. Usage unique 24h. Après acceptation `status='accepted'` → UPDATE policy refuse re-set vers `pending` (defense in depth). |
| **CSRF Server Actions** | LOW | Next.js 14 App Router protège nativement (origin check same-origin). |
| **Race condition double-submit accept** | LOW | UPDATE `drivers.profile_id` clause `.is('profile_id', null)` + UPDATE invitation clause `.eq('status', 'pending')` → 2ᵉ requête match 0 row, idempotent. |
| **Service-role key fuite client** | CRITICAL | `createAdminClient()` instancié dans des actions `'use server'` (`actions.ts` top : `'use server'`). Jamais importé côté Client Component. Service-role lit `process.env.SUPABASE_SERVICE_ROLE_KEY` — non préfixé `NEXT_PUBLIC_*`, donc absent du bundle client par garantie Next.js. |
| **CGU consent forgery** | MEDIUM (RGPD) | Zod `z.literal(true)` serveur fait échouer `safeParse` si missing/false. Audit log applicatif avec version CGU + timestamp serveur (DEC-027). |

ASVS L1 V2.1.1 (auth flow), V8.3.4 (audit logging RGPD), V10.3.1 (least privilege) : conforme.

## Verification

| Vérif | Statut | Commentaire |
|---|---|---|
| `pnpm typecheck` | ✅ | 3 packages verts (`@tap/shared`, `@tap/database`, `@tap/web`) en 14.5s |
| `pnpm lint` | ❌ (pré-existant) | ESLint v10 flat config absent sur les 3 packages — état antérieur au PLAN-3. Documenté dans `deferred-items.md`. Pas causé par les changements de ce plan. |
| Tous fichiers spec créés/modifiés | ✅ | 4 fichiers code dans le commit `3e0f371`, +462 insertions |
| Pas de modification des actions existantes (`createDriverAction` etc.) | ✅ | Lignes 55-148 inchangées, vérifié via `git diff` (extension only post ligne 148) |
| `driverInputSchema` non modifié (DEC-026) | ✅ | `packages/shared/src/validators/driver.ts` intact |
| Service-role key non bundle client | ✅ | `createAdminClient()` consommé uniquement dans des fichiers `'use server'`. `SUPABASE_SERVICE_ROLE_KEY` non préfixé `NEXT_PUBLIC_*` → exclu du bundle client par Next.js. |
| Audit applicatif CGU présent | ✅ | `accept-invite/actions.ts` étape 7 — INSERT systématique avant redirect |
| Aucun nom propre dans messages / fixtures (NFR-001) | ✅ | Messages génériques (« chauffeur », « régulateur », « dirigeant »), pas d'exemples nominatifs |
| Test E2E Playwright | ⏳ | Reporté PLAN-5 (test sur preview Vercel post-merge) |
| Test manuel preview Vercel | ⏳ | Reporté post-merge — schema push CI requis (PLAN-2 dette transitoire) |

**Self-check fichiers :**
- `packages/shared/src/schemas/driver-invitation.ts` : FOUND
- `packages/shared/src/index.ts` : FOUND (export ajouté)
- `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` : FOUND (étendu, fonctions existantes intactes)
- `apps/web/src/app/(auth)/accept-invite/actions.ts` : FOUND
- Commit `3e0f371` : FOUND (`git log --oneline | grep 3e0f371`)

## Risques résolus / dette transitoire

**Résolus PLAN-3 :**
- Workflow invitation complet code-side (C02 + C03 + C04 partie code)
- Idempotence anti double-submit (clauses WHERE narrow)
- Service-role confinement server-only
- CGU audit log applicatif (DEC-027)

**Dette transitoire (non-blocking PLAN-4) :**
- Schema push CI-only (PLAN-2 dette héritée) : la table `driver_invitations` n'existe en staging Supabase qu'après merge `feat/04-onboarding-chauffeur` sur main → preview Vercel post-merge testera le workflow live.
- Types Supabase non régénérés (Phase 04.5 — C10) : pattern `'driver_invitations' as never` consommé. Pas de typage strict des columns côté actions (mais Zod côté input).
- Lint ESLint cassé repo-wide : flat config absent (`deferred-items.md`). À traiter PR dédiée chore(tooling).
- Page UI `/accept-invite` + Route Handler GET (verifyOtp) : livrés PLAN-4.

**Aucun stub dans le livrable.** Aucun nom propre. Aucune action existante modifiée.

## Threat Flags

Aucun nouveau. Surface introduite (3 Server Actions, 2 schémas Zod) entièrement couverte par le threat model PLAN-2 (RLS BDD) + threat model ci-dessus (couche applicative). Pas de nouveau endpoint réseau public ni nouveau path d'auth créé (l'URL `/accept-invite` est purement Next.js, l'auth elle-même reste Supabase géré).

## Walkthrough Visible Progress (CLAUDE.md §13.5)

PLAN-3 est une livraison **backend / Server Actions pure** (pas d'écran). Conformément à §13.5 critère adapté backend : *« La preview Vercel reste accessible, ne régresse pas visuellement »*.

Vérification implicite : les 4 fichiers code modifiés sont des extensions du Server Actions layer + schémas Zod. Aucun rendu UI n'est ajouté → la preview Vercel actuelle (Phase 02 dernière merge) reste verte. Le walkthrough utilisateur arrive en PLAN-4 (page `/admin/chauffeurs` bouton Inviter + page `/accept-invite` form).

## Next step

**PLAN-4 (Wave 3) — UI invitation + AuthShell + Route Handler GET verifyOtp** :
- Composant `InviteDriverButton.client.tsx` dans `/admin/chauffeurs/page.tsx` (consomme `inviteDriverAction`)
- Composant `ResendInvitationButton.client.tsx` (consomme `resendInvitationAction`)
- Route Handler `app/(auth)/accept-invite/route.ts` GET : `supabase.auth.verifyOtp({ type: 'invite', token_hash })` → set session cookies → render form
- Page `app/(auth)/accept-invite/page.tsx` : form RHF + `acceptInvitationSchema` côté client + bouton submit (consomme `acceptInvitationAction`)
- Composant `ActivationToast.client.tsx` sur `/conduite/page.tsx` : lit `searchParams.activated === '1'` + déclenche `toast.success('Compte activé. Bienvenue dans l\'application chauffeur.')`

**Dépendances pour PLAN-5 (tests E2E)** : PLAN-3 + PLAN-4 mergés + schema push CI appliqué sur staging.

## Self-Check: PASSED

- `packages/shared/src/schemas/driver-invitation.ts` : FOUND
- `packages/shared/src/index.ts` : FOUND
- `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` : FOUND (extension)
- `apps/web/src/app/(auth)/accept-invite/actions.ts` : FOUND
- Commit `3e0f371` : FOUND
- `pnpm typecheck` : PASS
- 0 deletion détectée (`git diff --diff-filter=D HEAD~1 HEAD` vide)
- `driverInputSchema` intact (DEC-026 OK)
- 3 actions existantes (`createDriverAction`, `updateDriverAction`, `archiveDriverAction`) intactes (vérouillage anti-régression OK)
- 0 nom propre (NFR-001 OK)
- Service-role confiné `'use server'` (CRITICAL threat OK)
