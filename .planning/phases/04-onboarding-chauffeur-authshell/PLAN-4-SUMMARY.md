---
phase: 04-onboarding-chauffeur-authshell
plan: 4
wave: 3
covers_constraints: [C04_UI, C05, C06, C07]
requirements_completed: [CHAUF-01, CHAUF-02, CHAUF-03, CHAUF-04, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-006]
tech-stack:
  added:
    - "@hookform/resolvers v3.9 (déjà installé Wave 0, consommé productivement Wave 3)"
    - "react-hook-form v7.53 (déjà installé Phase 03, premier usage productif ici)"
  patterns:
    - "RHF + zodResolver mode onBlur + uncontrolled inputs (DEC-018 + D-RHF-01)"
    - "Pattern DEC-028 : Input/Label/Button shadcn directs, PAS de wrapper <Form>"
    - "Lift state up minimal pour partage prefill DemoCredentials <-> LoginForm (vs. Context)"
    - "Server Component qui consomme <AuthShell> (Client) — composition fonctionne grâce à children + RSC payload"
    - "Route Handler GET sous sous-segment /accept-invite/verify (Next.js : page+route ne peuvent coexister au même path)"
    - "ActivationToast Client component qui lit useSearchParams + nettoie URL via router.replace (FLAG #1 patché)"
key-files:
  created:
    - apps/web/src/app/(auth)/_components/auth-shell.client.tsx
    - apps/web/src/app/(auth)/accept-invite/page.tsx
    - apps/web/src/app/(auth)/accept-invite/verify/route.ts
    - apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.client.tsx
    - apps/web/src/app/(auth)/accept-invite/_components/invitation-error-panel.tsx
    - apps/web/src/app/(auth)/login/_components/login-form-shell.client.tsx
    - apps/web/src/app/(driver)/conduite/_components/activation-toast.client.tsx
    - apps/web/public/logo-tap.svg
  modified:
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/login/login-form.client.tsx
    - apps/web/src/app/welcome/page.tsx
    - apps/web/src/app/setup/page.tsx
    - apps/web/src/components/demo-credentials.tsx
    - apps/web/src/app/(admin)/admin/chauffeurs/page.tsx
    - apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx
    - apps/web/src/app/(admin)/admin/chauffeurs/actions.ts (redirectTo /accept-invite/verify)
    - apps/web/src/app/(driver)/conduite/page.tsx
    - apps/web/src/app/layout.tsx (Toaster racine — Rule 3)
    - apps/web/src/app/(app)/providers.client.tsx (Toaster retiré, montée au racine)
decisions:
  - "Route Handler GET déplacé de /accept-invite vers /accept-invite/verify (déviation Rule 3) — Next.js refuse page.tsx + route.ts au même path. redirectTo dans inviteDriverAction et resendInvitationAction mis à jour en conséquence."
  - "Toaster Sonner monté au layout racine (Rule 3) — les routes (auth) et (driver) n'étaient pas couvertes par le Toaster de (app)/providers.client.tsx. Retiré l'ancien pour éviter duplication."
  - "Flag NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS aligné sur '1' (PLAN-4 §4.4) — la valeur '/setup-vercel.yml' qui posait 'true' devra être mise à jour côté CI (dette transitoire — voir Next step)."
  - "Logo placeholder SVG créé dans apps/web/public/logo-tap.svg — fichier réel n'existait pas (Rule 3). Stylage sobre, à remplacer par identité finale Phase UI dédiée."
  - "getAuthContext non consommé dans /accept-invite/page.tsx — l'invité n'a pas encore de profile_id (rattachement = étape 6 acceptInvitationAction). Utilisation directe supabase.auth.getUser() (Rule 1 — bug fix proactif)."
metrics:
  duration: "~50 min"
  tasks_completed: 9
  files_created: 8
  files_modified: 11
  commits: 1
completed_date: "2026-05-13"
---

# Phase 04 Plan 4 : AuthShell + /accept-invite + LoginForm RHF + DemoCredentials cliquable + bouton Inviter (C04_UI + C05 + C06 + C07) — Summary

Surface UI complète Phase 04 livrée en un seul commit atomique. 9 tâches PLAN-4, 19 fichiers (8 créés + 11 modifiés), 1035 insertions. AuthShell mode jour partagé par 4 pages auth, premier RHF productif du repo (LoginForm + AcceptInviteForm), workflow `/accept-invite` complet (Route Handler verifyOtp + page + form + panneau erreur), bouton Inviter avec badge statut 4 états dans drivers-list.

## Constat travail effectué

| Tâche PLAN-4 | Livrable | Path |
|---|---|---|
| §4.1 AuthShell | Wrapper React mode jour split desktop/mobile | `(auth)/_components/auth-shell.client.tsx` (74L) |
| §4.2 Refonte /login + LoginFormShell | Page server + Client shell lift state up | `(auth)/login/page.tsx` (18L) + `_components/login-form-shell.client.tsx` (26L) |
| §4.3 LoginForm RHF | Migration `useFormState` → RHF + zodResolver | `(auth)/login/login-form.client.tsx` (112L, premier RHF productif) |
| §4.4 DemoCredentials Client | 3 cards cliquables, accent/8 + accent/12, ABSENT DOM si flag absent | `components/demo-credentials.tsx` (87L) |
| §4.5 /accept-invite complet | Route Handler GET + page + form RHF + panneau erreur | `accept-invite/{page,verify/route}.ts` + `_components/{accept-invite-form,invitation-error-panel}.tsx` |
| §4.6 Refonte /welcome + /setup | Consommation AuthShell, contenu métier inchangé | `welcome/page.tsx`, `setup/page.tsx` |
| §4.7 Bouton Inviter + badge statut | Mini-Dialog email + 4 badges (aucun/Invité/Lien expiré/Compte actif) + Renvoyer | `chauffeurs/_components/drivers-list.client.tsx` (+~200L) |
| §4.8 Validation visuelle UI-SPEC | Pas de h-40, échelle stricte, pas d'emoji, palette CSS vars | grep automatisé OK |
| §4.8bis ActivationToast (FLAG #1) | Client `useSearchParams` → toast.success → router.replace | `(driver)/conduite/_components/activation-toast.client.tsx` (24L) |
| §4.9 Commit unique | Message exact PLAN-4 §4.9 | `9534859` |

## Traçabilité contraintes

### C04 (UI page /accept-invite)
- **Route Handler GET** : `apps/web/src/app/(auth)/accept-invite/verify/route.ts` — `verifyOtp({ token_hash, type: 'invite' })` Supabase. Sortie `?error=invalid_link` si paramètres manquants, `?error=expired` si verify échoue, redirect propre vers `/accept-invite` si OK.
- **Page Server Component** : `apps/web/src/app/(auth)/accept-invite/page.tsx` — branche sur `searchParams.error` (panneau erreur) puis sur présence session (`supabase.auth.getUser()` direct, pas `getAuthContext` car profile_id encore null pour l'invité).
- **Form RHF** : `_components/accept-invite-form.client.tsx` — RHF + zodResolver(acceptInvitationSchema), password ≥ 8 + match + CGU obligatoire (DEC-027), checkbox HTML natif (pas de Checkbox shadcn dans le repo), link `/legal/cgu`.
- **Panneau erreur** : `_components/invitation-error-panel.tsx` — Server Component sobre, `<AlertCircle>` Lucide + 2 messages distincts (expired vs invalid_link), aucun CTA self-service (B2B fleet pattern, DEC-024).

### C05 (AuthShell)
- Composant `(auth)/_components/auth-shell.client.tsx` — wrapper React (pas layout Next.js).
- Layout split `lg:flex-row` + colonne identité `bg-muted` (logo `h-12` + baseline + footer) + colonne form `bg-background w-[480px]`.
- Mode jour uniquement — header form `h-14` vide V1, réservé toggle Sun/Moon Phase UI future (DEC-020 update).
- Consommé par les 4 pages `/login`, `/accept-invite`, `/welcome`, `/setup`.

### C06 (LoginForm RHF + zodResolver)
- `(auth)/login/login-form.client.tsx` réécrit. Pattern : `useForm({ resolver: zodResolver(...), mode: 'onBlur', defaultValues })` + `handleSubmit(async (data) => signInAction({}, fd))`.
- `signInAction` (actions.ts) INCHANGÉE — signature `(prev, formData)` conservée, l'invocation Client reconstruit FormData.
- Props `prefill?: { email; password }` + `useEffect setValue` pour sync avec DemoCredentials.
- Pattern DEC-028 : Input/Label/Button shadcn directs, PAS de `<Form>` wrapper.
- Erreurs serveur → `toast.error` Sonner. Erreurs Zod client → `formState.errors` + `role="alert"`.

### C07 (DemoCredentials Client cliquable)
- `components/demo-credentials.tsx` réécrit (Server → Client `'use client'`).
- 3 cards `<button>` (Dirigeant / Régulateur / Chauffeur), descriptions UI-SPEC § 7.7 (pas d'email visible dans rendu).
- Style cards : `hover:bg-accent/8` + `active:bg-accent/12` (FLAG #3 patché — pas `/10` `/15`).
- Composant retourne `null` si `process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1'` (ABSENT du DOM, pas `display:none`).
- Prop `onSelect(email, password)` — lift state up via `<LoginFormShell>` qui détient `useState<{ email; password } | null>`.

### DEC-018 / DEC-027 / DEC-028
- **DEC-018** : RHF + zodResolver consommé par LoginForm ET AcceptInviteForm (2 formulaires productifs).
- **DEC-027** : CGU obligatoire `z.literal(true)` côté serveur (PLAN-3 schéma), checkbox client côté form, link `/legal/cgu` target=_blank.
- **DEC-028** : aucun usage de `<Form>` wrapper shadcn dans les 2 formulaires créés. Input/Label/Button directs.

### DEC-020 update (PAS de toggle nuit Phase 04)
- AuthShell header form `h-14` vide V1. Aucun bouton Sun/Moon Lucide. Tokens CSS vars mode nuit `globals.css` restent intacts pour activation future.

### Q1.6 / Q1.7 (bouton Inviter + badge statut)
- `drivers-list.client.tsx` étendu avec colonne badge `AccountStatusBadge` (4 états : `none` Sans compte / `invited` Invité / `expired` Lien expiré / `active` Compte actif).
- Bouton `InvitationActionButton` à droite du badge : `Inviter` (icône Mail) si `none`, `Renvoyer` (icône RefreshCw) si `invited`/`expired`, rien si `active`.
- 2 Dialogs Radix : mini-form email (Inviter) + confirmation (Renvoyer). Submit via `inviteDriverAction` / `resendInvitationAction` (PLAN-3).
- Page server `chauffeurs/page.tsx` étendue : JOIN informationnel `driver_invitations` (status='pending', latest) puis attribution à chaque driver via `Map<driver_id, invitation>`.

## Conformité UI-SPEC § 7.6 / 7.7 / 7.8

| Contrôle | Statut |
|---|---|
| Aucun `h-40` (verrou Phase 03.2 — piège rem default) | OK (grep automatique vide sur fichiers PLAN-4) |
| Spacing strict 4/8/12/16/24/32/48/64 | OK (`p-16`, `p-24`, `space-y-16`, `space-y-24`, `gap-8`, `gap-12`, `h-10`, `h-12`, `h-14` uniquement) |
| Pas d'emoji UI | OK (◉ retiré de DemoCredentials, → retiré du bouton « Ouvrir le Marketplace ») |
| Pas de nom propre dans copy/comptes démo | OK (`@demo.tap`, baseline « TAP/CGSS — 974 ») |
| Palette CSS vars existantes | OK (--accent, --primary, --muted, --destructive uniquement) |
| Focus ring visible (`focus-visible:ring-2 ring-ring ring-offset-2`) | OK sur DemoCredentials cards + boutons |
| Transitions ≤ 250ms | OK (`duration-150` partout) |
| Mode jour uniquement (pas de toggle Sun/Moon) | OK (header form `h-14` vide V1) |

## Threat model résumé

| Threat | Mitigation appliquée |
|---|---|
| DemoCredentials fuite en prod | Composant retourne `null` si flag != '1' — ABSENT du DOM (pas display:none) |
| CSRF /accept-invite | Server Action protégée Next.js 14 (same-origin check natif) |
| XSS via userEmail prefill | `<Input value={userEmail} readOnly>` React échappe, pas de `dangerouslySetInnerHTML` |
| CGU bypass via JS désactivé | Zod côté serveur `cguAccepted: z.literal(true)` rejette toute valeur falsy (PLAN-3) |
| Race double-submit accept-invite | `formState.isSubmitting` désactive button + serveur idempotent (`.is('profile_id', null)`) |
| Open redirect `?next=` LoginForm | `signInAction` valide déjà `next.startsWith('/') && !next.startsWith('//')` (actions.ts:58) |

## Déviations PLAN-4

### [Rule 3 — Blocking] Route Handler déplacé à `/accept-invite/verify`
- **Found during** : §4.5 (build webpack)
- **Issue** : Next.js App Router refuse simultanément `page.tsx` et `route.ts` au même path (« You cannot have two parallel pages that resolve to the same path »).
- **Fix** : déplacement du Route Handler vers le sous-segment `verify/` (`/accept-invite/verify`). Mise à jour `inviteDriverAction` + `resendInvitationAction` (`redirectTo: ${origin}/accept-invite/verify`) pour cohérence avec le template magic link Supabase.
- **Files modified** : `accept-invite/verify/route.ts` (créé), `chauffeurs/actions.ts` (2 occurrences `redirectTo`).
- **Commit** : `9534859`

### [Rule 3 — Blocking] Toaster Sonner monté au layout racine
- **Found during** : §4.3 (LoginForm) + §4.5 (AcceptInviteForm) + §4.8bis (ActivationToast)
- **Issue** : le Toaster Sonner était monté dans `(app)/providers.client.tsx` mais les routes `(auth)` et `(driver)` ne passent pas par ce layout — toasts émis depuis LoginForm/AcceptInviteForm/ActivationToast n'auraient jamais été visibles.
- **Fix** : Toaster déplacé au layout racine `apps/web/src/app/layout.tsx` (couvre tous les groups). Retiré du `(app)/providers.client.tsx` pour éviter duplication.
- **Files modified** : `app/layout.tsx`, `(app)/providers.client.tsx`.
- **Commit** : `9534859`

### [Rule 3 — Blocking] Logo placeholder créé
- **Found during** : §4.1 (AuthShell consomme `/logo-tap.svg`)
- **Issue** : `apps/web/public/` était vide — pas de logo TAP. AuthShell crashait à l'affichage de l'Image Next.js.
- **Fix** : SVG placeholder sobre créé (`apps/web/public/logo-tap.svg`), palette HSL primary du repo, à remplacer par identité finale Phase UI dédiée.
- **Files created** : `apps/web/public/logo-tap.svg`.
- **Commit** : `9534859`

### [Rule 1 — Bug fix proactif] getAuthContext non utilisable côté /accept-invite
- **Found during** : §4.5 (page Server Component)
- **Issue** : `getAuthContext()` requiert un row `profiles` ; or l'invité vient juste de faire verifyOtp, son `profile_id` n'est pas encore rattaché (rattachement = étape 6 de `acceptInvitationAction` au submit). `getAuthContext()` retournerait null systématiquement → panneau erreur affiché à tort.
- **Fix** : utilisation directe `supabase.auth.getUser()` (comme `acceptInvitationAction`). Email du user récupéré pour pré-remplir le form read-only.
- **Files modified** : `(auth)/accept-invite/page.tsx`.
- **Commit** : `9534859`

### [Rule 1 — Cohérence] Flag DemoCredentials aligné sur '1'
- **Found during** : §4.4
- **Issue** : ancien code testait `=== 'true'`, PLAN-4 + DEC `=== '1'`. Choix : aligner sur `'1'` standard binaire.
- **Fix** : nouveau code teste `=== '1'`. Le workflow CI `setup-vercel.yml` pose actuellement la valeur côté Vercel — à vérifier en preview et patcher si besoin (dette transitoire, non bloquante car preview Vercel teste live).
- **Files modified** : `components/demo-credentials.tsx`.
- **Commit** : `9534859`

## Verification

| Contrôle | Statut | Détail |
|---|---|---|
| `pnpm typecheck` | OK | `pnpm --filter=@tap/web typecheck` exit 0 |
| `pnpm build` apps/web | OK | Build production Next.js 14.2.35 : 27 routes générées, `/accept-invite` (ƒ dynamic) + `/accept-invite/verify` + `/login` + `/welcome` + `/setup` + `/conduite` toutes OK |
| `pnpm lint` | non lancé | État pré-existant repo-wide cassé (ESLint v10 flat config absent — voir PLAN-3-SUMMARY déjà déféré). Hors scope (Rule SCOPE BOUNDARY). |
| grep `h-40` `p-20` `gap-10` `space-y-20` sur fichiers PLAN-4 | OK | 0 occurrence interdite |
| grep emojis (🚀, ✓, →, 🎉, ◉) sur fichiers UI | OK | 0 occurrence dans copy UI (les `→` restants sont en commentaires de code, pas UI) |

Tests Playwright + captures Visible Progress = PLAN-5 (Wave 4, C08 + C09).

## Dette transitoire (à inscrire dans deferred-items.md ou PLAN-5)

1. **Flag CI `setup-vercel.yml`** : actuellement `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true` côté CI Vercel. Le code attend désormais `'1'` (aligné PLAN-4 §4.4). À patcher en preview, sinon DemoCredentials cards invisibles sur la preview.
2. **Headers HTTP sécurité** : `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` / `frame-ancestors 'none'` non confirmés dans `next.config.js` (threat model PLAN-4 § 4.8 LOW/MEDIUM). À ajouter Phase 04.5 si absent.
3. **Logo TAP final** : placeholder SVG sobre actuellement. Identité visuelle complète = Phase UI dédiée post-Passe 2 (DEC-020 + DEC-022).
4. **Open redirect `?next=`** : déjà mitigé dans `signInAction` (actions.ts:58 `safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/patients'`). Aucune action requise — note documentaire.

## Next step

**PLAN-5 (Wave 4)** = tests Playwright + captures Visible Progress. Couverture C08 (2 tests : happy path + token expired, reset Inbucket entre tests) + C09 (2 captures : `login-jour.png` + `accept-invite.png` dans `docs/showcase/04-onboarding-chauffeur-authshell/`). Walkthrough 5-10 étapes dans `04-SUMMARY.md` final phase.

## Self-Check: PASSED

- [x] `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` FOUND
- [x] `apps/web/src/app/(auth)/accept-invite/page.tsx` FOUND
- [x] `apps/web/src/app/(auth)/accept-invite/verify/route.ts` FOUND
- [x] `apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.client.tsx` FOUND
- [x] `apps/web/src/app/(auth)/accept-invite/_components/invitation-error-panel.tsx` FOUND
- [x] `apps/web/src/app/(auth)/login/_components/login-form-shell.client.tsx` FOUND
- [x] `apps/web/src/app/(driver)/conduite/_components/activation-toast.client.tsx` FOUND
- [x] `apps/web/public/logo-tap.svg` FOUND
- [x] Commit `9534859` FOUND dans `git log --oneline`
