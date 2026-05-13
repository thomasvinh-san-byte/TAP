---
phase: 04-onboarding-chauffeur-authshell
plan: 4
wave: 3
order_in_wave: 1
depends_on: [3]
files_modified:
  - apps/web/src/app/(auth)/_components/auth-shell.client.tsx
  - apps/web/src/app/(auth)/login/page.tsx
  - apps/web/src/app/(auth)/login/login-form.client.tsx
  - apps/web/src/app/(auth)/login/_components/login-form-shell.client.tsx
  - apps/web/src/app/welcome/page.tsx
  - apps/web/src/app/setup/page.tsx
  - apps/web/src/app/(auth)/accept-invite/page.tsx
  - apps/web/src/app/(auth)/accept-invite/route.ts
  - apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.client.tsx
  - apps/web/src/app/(auth)/accept-invite/_components/invitation-error-panel.tsx
  - apps/web/src/components/demo-credentials.tsx
  - apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx
  - apps/web/src/app/(driver)/conduite/page.tsx
autonomous: true
requirements:
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
estimated_minutes: 150
covers_constraints:
  - C04 (page /accept-invite + Route Handler GET)
  - C05 (AuthShell)
  - C06 (LoginForm RHF + zodResolver)
  - C07 (DemoCredentials Client cliquable)
---

# PLAN-4 — AuthShell mode jour + `/accept-invite` + LoginForm RHF + DemoCredentials cliquable + bouton Inviter

## Objectif

Livrer l'**ensemble de la surface UI** de la phase 04 :

1. Composant `<AuthShell>` réutilisable mode jour (split desktop ≥ 1024 px,
   single column < 1024 px) — C05.
2. Refonte des 4 pages `/login`, `/welcome`, `/setup`, `/accept-invite`
   à consommer `<AuthShell>` — C05.
3. Migration `LoginForm` à RHF + zodResolver (premier RHF du repo) — C06.
4. Conversion `DemoCredentials` Server → Client cliquable avec prefill
   du form parent — C07.
5. Page `/accept-invite` complète (Route Handler GET verify OTP + page
   server render + form client RHF + panneau erreur token) — C04 UI.
6. Bouton « Inviter » + badge statut invitation dans
   `drivers-list.client.tsx` (Q1.6 + Q1.7).

Pas de toggle mode nuit (DEC-020 update, reporté Phase UI dédiée).

Le code complet de chaque section est dans le commit local de la branche
(le PLAN-4 fait 850 lignes inline). Voir version locale pour SQL/TSX détaillé :
- AuthShell : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx`
  layout split desktop / single column mobile, logo TAP h-12, baseline factuelle
- LoginFormShell : lift state up pour prefill DemoCredentials
- LoginForm RHF : `useForm({ resolver: zodResolver, mode: 'onBlur' })`, signInAction inchangée
- DemoCredentials Client : 3 cards cliquables hover:bg-accent/8 active:bg-accent/12
  (corrigé FLAG #3 plan-checker), null si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1'`
- /accept-invite : Route Handler GET verifyOtp + Server Component page +
  AcceptInviteForm client RHF + InvitationErrorPanel
- /welcome + /setup : refonte AuthShell, contenu métier inchangé
- drivers-list : bouton Inviter + badge 4 états (aucun / Invité / Lien expiré / Compte actif)
- /conduite/page.tsx : ActivationToast client wrapper qui lit ?activated=1
  et déclenche toast.success (corrigé FLAG #1 plan-checker)

## Traçabilité contraintes

| Contrainte | Traitement dans ce plan |
|---|---|
| **C04** (page `/accept-invite` UI : Route Handler GET verifyOtp + form RHF + panneau erreur token) | PLAN-4 §4.5 (Route Handler `route.ts` + page Server Component + `AcceptInviteForm` Client + `InvitationErrorPanel`) |
| **C05** (Composant `<AuthShell>` wrapper React, split desktop/mobile, PAS toggle nuit) | PLAN-4 §4.1 (composant complet) + §4.2/§4.5/§4.6 (consommation par 4 pages) |
| **C06** (Conversion LoginForm RHF + zodResolver, premier RHF du repo) | PLAN-4 §4.3 (migration complète, pattern DEC-028 sans wrapper `<Form>` shadcn, props `prefill` pour DemoCredentials) |
| **C07** (DemoCredentials Client cliquable, prefill via lift state up) | PLAN-4 §4.4 (Server → Client + 3 cards `<button>` cliquables) + §4.2 (LoginFormShell lift state up) |
| **DEC-018** (RHF + zodResolver Phase 04+) | §4.3 + §4.5 (LoginForm + AcceptInviteForm — 2 forms RHF du repo) |
| **DEC-027** (CGU obligatoire `/accept-invite` + lien `/legal/cgu`) | §4.5 form Client `<input type="checkbox" {...register('cguAccepted')}>` + Link `/legal/cgu` |
| **DEC-028** (RHF sans wrapper Form shadcn formulaires simples) | §4.3 + §4.5 (`<Input>` `<Label>` `<Button>` shadcn directs) |
| **DEC-020 update** (PAS de toggle mode nuit Phase 04) | §4.1 AuthShell : header form vide `h-14` réservé futur, aucun bouton Sun/Moon Phase 04 |
| **Q1.6 / Q1.7** (bouton Inviter dans drivers-list + badge statut 4 états) | §4.7 |

## FLAGs plan-checker patchés dans ce plan

- **FLAG #1** : ActivationToast client wrapper dans `/conduite/page.tsx` qui consomme `searchParams.activated === '1'` et déclenche `toast.success` (`/conduite/page.tsx` ajouté à `files_modified`)
- **FLAG #2** : `login-form-shell.client.tsx` ajouté à `files_modified`
- **FLAG #3** : `hover:bg-accent/8` + `active:bg-accent/12` (aligné UI-SPEC § 7.7, vs `/10` `/15` initial)

## Threat model

ASVS L1 + UI/UX hardening :

| Threat | Risk | Mitigation |
|---|---|---|
| **DemoCredentials fuite credentials en prod** | HIGH (vol comptes) | Composant retourne `null` si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1'`. **ABSENT du DOM** (pas `display:none`). |
| **Token URL dans referer leakage** | LOW | Trade-off accepté Q6.2. Token usage unique, `verifyOtp` consomme. Headers `Referrer-Policy: strict-origin-when-cross-origin` à vérifier. |
| **CSRF accept-invite form** | LOW | Server Action protégée nativement Next.js 14 (same-origin check). |
| **XSS via email user prefill** | LOW | `userEmail` rendu via `<Input value=...>` React échappe par défaut. Pas de `dangerouslySetInnerHTML`. |
| **Clickjacking sur /accept-invite** (iframe attaque) | LOW | Headers `X-Frame-Options: DENY` à vérifier dans `next.config.js`. Si absent, dette Phase 04.5. |
| **Open redirect via `?next=` LoginForm** | MEDIUM | Vérifier que `signInAction` valide `next` comme URL relative. Sinon ajouter check `next.startsWith('/')` — hors scope C06 mais signé dans `04-SUMMARY.md` comme dette éventuelle Phase 04.5. |
| **Password reuse signaling** | LOW | NIST 2020+ longueur seule (≥ 8). HIBP V2. |
| **CGU bypass via JS désactivé** | MEDIUM (RGPD) | Validation Zod côté serveur (PLAN-3 §3.1) `cguAccepted: z.literal(true)`. |
| **Race UI : double-submit accept-invite** | LOW | `form.formState.isSubmitting` désactive button. Côté serveur UPDATE idempotent. |

ASVS L1 V2.2 (passwords), V3.1 (session), V14.4 (HTTP headers — à confirmer config Next) : conforme avec note headers à valider.

## Verification

- `pnpm typecheck` vert (RHF + zodResolver bien typés, types `AcceptInvitationInput` exporté).
- `pnpm lint` vert.
- `pnpm build` (Next prod build) vert : aucune erreur SSR/CSR sur les 4 pages auth.
- Manuel sur preview Vercel :
  - `/login` : capture publiable (AuthShell mode jour + DemoCredentials visible).
  - Click card « Chauffeur » → champs prefilled → Se connecter → redirect `/conduite`.
  - `/admin/chauffeurs` (login dirigeant démo) → créer fiche driver test → Inviter → email reçu Inbucket → click → `/accept-invite` avec email read-only + form mot de passe.
  - Submit form valide → redirect `/conduite?activated=1` + toast success via ActivationToast.
  - `/accept-invite?error=expired` → panneau erreur sans form.
- Mobile iPhone SE 375 px : layout single column lisible, boutons accessibles.

## Success criteria (extrait des 11 SC phase)

Couvre :
- SC #2 (chauffeur clique magic link → `/accept-invite` email pré-rempli)
- SC #3 (saisie password + confirm + CGU → submit)
- SC #5 (redirect `/conduite` + toast success via ActivationToast)
- SC #6 (`/login` refondue AuthShell mode jour, capture publiable)
- SC #7 (DemoCredentials cards cliquables, prefill fonctionnel)
- SC #8 (token expiré → panneau erreur dédié, aucun form)

## Output

Note dans `04-SUMMARY.md` final § PLAN-4 : structure AuthShell, premier
RHF du repo, lift state up pattern DemoCredentials, headers sécurité
à valider Phase 04.5.

> **NOTE EXECUTEUR** : le contenu détaillé de chaque section (snippets TSX, route handlers, layouts CSS, etc.) est disponible dans la version locale de ce fichier sur la branche `planning/04-discuss-onboarding-chauffeur` (~850 lignes). Cette version pushée MCP API est allégée pour respecter la limite payload tool call. Avant exécution, faire `git pull` localement pour récupérer la version intégrale du plan avec tous les snippets de code.
