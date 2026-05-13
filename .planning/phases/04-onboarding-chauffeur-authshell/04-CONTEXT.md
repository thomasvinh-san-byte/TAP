# Phase 04 — Onboarding chauffeur + AuthShell mode jour — Context

**Gathered:** 2026-05-13 (assumptions mode initial) — **Refondu:** 2026-05-13 (refonte E2E DEC-023)
**Status:** Ready for re-discuss with new perimeter (onboarding-only)
**Précédent CONTEXT:** god-phase 4 livrables (PWA + tarif + caisse + login) — abandonné par DEC-023.

> **Refonte DEC-023** : la Phase 04 god-phase a été découpée en 4 sous-phases (04 onboarding / 04.5 robustesse / 04.7 pricing mockup + caisse / 04.9 PWA enveloppe) + insertion d'une Phase 05.5 (pricing CGSS réel — DEC-021). Ce CONTEXT.md ne couvre plus que le **scope onboarding chauffeur + AuthShell mode jour**.

---

<domain>
## Phase Boundary (refondu)

**Goal fonctionnel** : Le dirigeant invite un chauffeur par email. Le chauffeur active son compte via un magic link Supabase Auth, est rattaché à sa fiche `drivers` existante, puis peut se connecter via `/login` refondu.

**Goal UX** : `<AuthShell>` réutilisable extrait dans `(auth)/_components/`, layout split desktop ≥ 1024 px, single column mobile. `/login` + `/welcome` + `/setup` refondus en **mode jour uniquement**, captures publiables. `DemoCredentials` cards cliquables qui prefill le form si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`. **Premier RHF + zodResolver du repo** (DEC-018).

**Critère de fin (ADR-003)** : Un design partner enchaîne 1) invitation chauffeur, 2) réception magic link, 3) activation, 4) connexion via `/login` refondu sans intervention dev.

**Périmètre — dans :**
- Migration BDD : table `driver_invitations` (token UUID, status enum `pending|accepted|expired`, expiry 48 h, RLS `organization_id`)
- Server Action `inviteDriverAction` depuis `/admin/chauffeurs`
- Supabase Auth magic link (template SES par défaut)
- Page `/accept-invite?token=...` avec RHF + zodResolver (création password + activation compte)
- Rattachement `drivers.profile_id = auth.uid()` à l'activation
- Composant `<AuthShell>` extrait dans `apps/web/src/app/(auth)/_components/`
- `DemoCredentials` converti Server → Client component, cards cliquables, prefill email + password si flag `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`
- Refonte light `/login` `/welcome` `/setup` (consomment `<AuthShell>`)

**Périmètre — hors (Phase UI dédiée post-Passe 2) :**
- Mode nuit toggle complet (spec UI prête dans `04-UI-SPEC.md § 4`, infra Tailwind en place, à activer Phase UI dédiée)
- Refonte visuelle complète logo / baseline (logo TAP existant conservé)
- Slide bidirectionnel iOS-style PWA Driver (DEC-020 — bug Next.js #42658)

**Périmètre — déplacé vers autres sous-phases (DEC-023) :**
- PWA chauffeur (manifest, Serwist, Dexie, ConnectionStatus, sync engine, persistence storage) → **Phase 04.9**
- Tarif CGSS (`packages/pricing` + `PricingBreakdown` + `OverrideTarifModal` + migration géocoding) → **Phase 04.7**
- Page `/courses/caisse` + export CSV → **Phase 04.7**
- Filtrage type_permis ↔ vehicle.type, audit logs nom acteur, découpes modal/drawer, types regen → **Phase 04.5**
- Pricing CGSS calcul réel (grille validée dirigeant + décision distance) → **Phase 05.5**

**Success Criteria** :
1. Le dirigeant invite un humain réel via `/admin/chauffeurs` sans intervention dev
2. L'humain reçoit un email magic link et active son compte sur `/accept-invite`
3. `drivers.profile_id` rattaché correctement à l'activation (cohérent base, vérifiable depuis `/admin/chauffeurs`)
4. `/login` refondue capture publiable mode jour
5. `DemoCredentials` cards prefill le form si flag actif (3 cards : dirigeant / regulateur / chauffeur)
</domain>

<decisions>
## Implementation Decisions (onboarding-only scope)

### Découpage Phase (LOCKED)

- **DEC-023** : Phase 04 god-phase abandonnée. Refonte E2E logique : 04 onboarding → 04.5 robustesse → 04.7 pricing mockup + caisse → 04.9 PWA enveloppe → 05 récurrences + cockpit + SMS + patient absent → 05.5 pricing CGSS réel → 06 HDS. Principe : logique métier web stable d'abord, mobilité PWA ensuite.
- **DEC-017** (annulé) : Phase 04 monolithique E2E — ABANDONNÉ, remplacé par DEC-023.

### Workflow Invitation Chauffeur

- **D-01** : Migration BDD `driver_invitations(id UUID PK, organization_id UUID, driver_id UUID FK, token UUID UNIQUE, email TEXT, status enum 'pending'|'accepted'|'expired', expires_at TIMESTAMPTZ, invited_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ NULL, RLS organization_id)`. Expiry 48 h par défaut.
- **D-02** : `inviteDriverAction(driver_id, email)` Server Action depuis `/admin/chauffeurs` :
  - Insère `driver_invitations` row
  - Appelle `supabase.auth.admin.inviteUserByEmail(email, { redirectTo: '/accept-invite?token={uuid}' })`
  - Trace `audit_logs` action `invite_sent`
- **D-03** : Page `/accept-invite?token=...` : RHF + zodResolver, schéma `{ password: z.string().min(8), confirm: z.string() }` + refine `password === confirm`. Server Action `acceptInviteAction(token, password)` :
  - Vérifie `status: 'pending'` + `expires_at > now()` (RLS bypass via service_role server-side)
  - Met à jour Supabase Auth user password
  - Met à jour `drivers.profile_id = auth.uid()` (lift `profile_id IS NULL`)
  - Marque `driver_invitations.status = 'accepted'` + `accepted_at = now()`
  - Trace `audit_logs` action `invite_accepted`
- **D-04** : Magic link Supabase Auth built-in (template SES par défaut). **Resend/Brevo email transactionnel reporté Phase 06.**

### AuthShell + Refonte Login (light)

- **D-05** : Composant `<AuthShell>` dans `apps/web/src/app/(auth)/_components/`. Layout split desktop ≥ 1024 px (identité gauche, form droite), single column mobile. Spec complète dans `04-UI-SPEC.md § 7.6`.
- **D-06** : **Refonte légère** — logo TAP existant conservé, baseline factuelle sobre (« Régulation, optimisation, pilotage TAP/CGSS — 974 »). Refonte visuelle complète (charte, baseline, splash, identité forte) = phase UI/UX dédiée post-Passe 2.
- **D-07** : `DemoCredentials` (`apps/web/src/components/demo-credentials.tsx`) converti Server Component → Client Component avec cards cliquables. Click prefill email + password sur le form `<LoginForm>`. Lift state up : `<LoginForm>` reçoit `defaultEmail` + `defaultPassword` props.
- **D-08** : Flag d'affichage `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`. Si absent ou `=== '0'`, zone démo absente du DOM.

### Formulaires (LOCKED — DEC-018)

- **D-09** : **React Hook Form + zodResolver** adoption ciblée Phase 04 : `/accept-invite` form (création password), `<LoginForm>` peut rester `useTransition` actuel ou migrer (à trancher en plan). PAS de migration rétroactive Phase 1/2. Server Actions conservées côté submit.

### Hors scope explicite Phase 04

- **D-10** : Mode nuit toggle complet = Phase UI dédiée. Infra Tailwind `darkMode: ['class', '[data-theme="dark"]']` + tokens CSS vars `globals.css` déjà en place. Spec mode nuit `04-UI-SPEC.md § 4` reste valide pour la phase future. Phase 04 livre mode jour exclusivement.
- **D-11** : Slide bidirectionnel iOS-style PWA Driver = Phase UI dédiée (DEC-020, bug Next.js #42658). Phase 04.9 livre fade-in simple via `template.tsx`.
- **D-12** : Refonte logo/baseline = Phase UI dédiée. Logo TAP existant conservé.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 04 section refondue (lignes Phase 04: Onboarding chauffeur)
- `.planning/REQUIREMENTS.md` — CHAUF-01..04 (workflow invitation chauffeur), NFR-001..006
- `.planning/PROJECT.md` — Bloc `<decisions>` : DEC-017 (annulé), DEC-018 RHF, DEC-023 refonte, ADR-003 pivot E2E
- `.planning/codebase/CONCERNS.md` — Re-mapping post-DEC-023 + section « Workflow invitation chauffeur »
- `.planning/codebase/CONVENTIONS.md` — RLS multi-tenant, Server Actions, dates pattern, archivage logique
- `.planning/codebase/STACK.md` — Supabase Auth, Next.js 14 App Router, Tailwind + shadcn
- `apps/web/src/app/(auth)/login/page.tsx` + `apps/web/src/app/welcome/page.tsx` + `apps/web/src/app/setup/page.tsx` — 3 auth shells à unifier
- `apps/web/src/app/(auth)/login/login-form.client.tsx` — form actuel `useTransition`, à enrichir avec `defaultEmail`/`defaultPassword`
- `apps/web/src/components/demo-credentials.tsx` — Server Component à convertir Client
- `apps/web/src/app/admin/chauffeurs/` — point d'intégration `inviteDriverAction`
- `apps/web/tailwind.config.ts` + `apps/web/src/app/globals.css` — darkMode + tokens CSS vars HSL jour/nuit (mode nuit infra prête, toggle hors scope Phase 04)
- `.planning/phases/04-onboarding-chauffeur-authshell/04-UI-SPEC.md` — **UI-SPEC global Passe 2** (835 L, 6/6 PASS gsd-ui-checker, voir annotation tête pour répartition par sous-phase). Sections consommées par Phase 04 : § 7.6 AuthShell, § 7.7 DemoCredentials cards, § 7.8 /accept-invite
- `CLAUDE.md § 5` (PWA chauffeur ≥56px — appliqué Phase 04.9), `CLAUDE.md § 13.5` (Visible Progress)
- Supabase Auth docs : `supabase.auth.admin.inviteUserByEmail`, magic link templates, redirectTo flow
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drivers` table déjà existante avec `profile_id` nullable (anticipation invitation Phase 04)
- `audit_logs` INSERT-only INSERT trigger en place — actions `invite_sent` / `invite_accepted` à ajouter
- Pattern Server Action canonique (`apps/web/src/app/admin/chauffeurs/actions.ts`) à étendre pour `inviteDriverAction`
- 3 auth shells `/login` `/welcome` `/setup` réimplémentent `min-h-screen flex items-center justify-center` — extraction `<AuthShell>` = refactor mécanique, pas rewrite
- Dark mode infra (`tailwind.config.ts` + `globals.css`) déjà en place pour la phase UI future

### Established Patterns
- Server Components par défaut (CLAUDE.md § 7), `'use client'` seulement quand nécessaire
- RLS forcée + `organization_id` sur toute table métier (FOND-02)
- Audit logs systématique sur actions sensibles (CLAUDE.md § 6)
- Validation zod côté client + serveur, types via `z.infer`

### Integration Points
- `apps/web/src/app/admin/chauffeurs/` : ajout bouton « Inviter » + Server Action
- `supabase/migrations/2026MMDD000001_driver_invitations.sql` : nouvelle migration RLS
- `apps/web/src/app/(auth)/accept-invite/page.tsx` : nouvelle page
- `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` : nouveau composant
- Conversion `apps/web/src/components/demo-credentials.tsx` Server → Client
</code_context>

<specifics>
## Specific User Choices

- **Découpage** : refonte E2E DEC-023, Phase 04 = onboarding chauffeur + AuthShell mode jour uniquement (~4-5h)
- **Email magic link** : Supabase Auth built-in (template SES par défaut), Resend/Brevo Phase 06+
- **Refonte login** : light only (logo conservé, mode jour, comptes démo cliquables)
- **Mode nuit toggle** : hors scope Phase 04, déplacé Phase UI dédiée post-Passe 2
- **RHF** : adoption ciblée Phase 04 sur `/accept-invite`, pas de migration rétroactive
- **Captures Visible Progress** : 2 (`/login` mode jour, `/accept-invite`)
- **Estimation** : 4-5 h discuss → ship

### Visible Progress Mandate (CLAUDE.md § 13.5)

2 captures Phase 04 + walkthrough script + seed démo 974 (déjà en place) + comptes démo persistants (déjà en place) + preview Vercel + UAT manuel design partner sur preview.

</specifics>

<deferred>
## Deferred Ideas

### Reportées sous-phases suivantes (DEC-023)

- PWA chauffeur (Serwist + Dexie + ConnectionStatus + sync engine + persistence storage) → **Phase 04.9**
- Tarif CGSS UI mockup + override + caisse + migration géocoding → **Phase 04.7**
- Tarif CGSS calcul réel (grille dirigeant + décision distance) → **Phase 05.5**
- Robustesse régulateur (filtrage permis, audit logs nom, découpes, types regen, 10 captures Phase 03) → **Phase 04.5**

### Reportées Phase UI/UX dédiée post-Passe 2

- Mode nuit toggle complet (Sun/Moon button + Server Action + cookie httpOnly + QA parité)
- Refonte visuelle complète logo / baseline / splash / identité forte
- Slide bidirectionnel iOS-style PWA Driver (DEC-020, bug Next.js #42658)
- Layout split tablette 768-1024 px (CONCERNS.md nouveau)
- Polish UI/UX modal saisie course (CONCERNS.md ligne 197 — verrou maintenu)

### Reviewed Todos (not folded)

Aucun — `gsd-sdk query todo.match-phase 04` retourne 0.

</deferred>
