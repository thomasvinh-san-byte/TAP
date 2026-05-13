# Phase 04 — Onboarding chauffeur + AuthShell mode jour — Context

**Gathered:** 2026-05-13 (assumptions mode, brief méta dirigeant — refonte E2E DEC-023)
**Status:** Ready for planning (32 contraintes C01..C10 + 19 réponses posées Q1.1..Q7.1)
**Précédent:** CONTEXT god-phase abandonné par DEC-023 (PR #57 mergé `2553e33`).
**Audit code main:** dirigeant 2026-05-13 (état existant + à créer documenté ci-dessous).

> **Brief méta du dirigeant** : ce CONTEXT.md matérialise 10 contraintes formelles (C01..C10) traçables par le plan + 19 réponses posées à 19 questions standards (Q1.1..Q7.1) + 11 success criteria. **Le plan final doit citer chaque CXX en référence explicite « PLAN-X §Y.Z traite CXX » pour vérification traçabilité.**

---

<domain>
## Phase Boundary

**Goal fonctionnel** : Le dirigeant invite un chauffeur par email depuis `/admin/chauffeurs`. Le chauffeur reçoit un magic link Supabase Auth, atterrit sur `/accept-invite` avec email pré-rempli, crée son mot de passe + accepte les CGU, et est rattaché à sa fiche `drivers` existante. Il peut ensuite se connecter via `/login` refondu.

**Goal UX** : `<AuthShell>` réutilisable extrait dans `(auth)/_components/` — layout split desktop ≥ 1024 px, single column < 1024 px. `/login` + `/welcome` + `/setup` + `/accept-invite` refondus en **mode jour uniquement** (toggle nuit reporté Phase UI dédiée — DEC-020 update). `DemoCredentials` cards cliquables qui prefill le form si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`. **Premier RHF + zodResolver du repo** (DEC-018).

**Critère de fin (ADR-003)** : Un design partner enchaîne 1) création fiche chauffeur, 2) invitation, 3) réception magic link, 4) activation compte sur `/accept-invite`, 5) connexion via `/login` refondue sans intervention dev.

**Périmètre — dans :**
- Migration BDD `driver_invitations` (table séparée — DEC-025) + RLS strict + trigger audit_logs (C01)
- Server Actions : `inviteDriverAction` (C02), `resendInvitationAction` (C03), `acceptInvitationAction` (C04)
- Page `/accept-invite?token_hash=...&type=invite` + Route Handler GET (verify OTP Supabase) (C04)
- Composant `<AuthShell>` extrait wrapper React (pas layout Next.js) (C05)
- Conversion `login-form.client.tsx` à RHF + zodResolver (premier form RHF du repo) (C06)
- `DemoCredentials` Server Component → Client Component cliquable (C07)
- 2 tests Playwright (happy path + token expired) avec reset Inbucket (C08)
- 2 captures Visible Progress dans `docs/showcase/04-onboarding-chauffeur-authshell/` (C09)
- Wave 0 : vérification ROADMAP / STATE / PROJECT.md à jour (PR #57 déjà mergé) (C10)

**Périmètre — hors (reporté) :**
- Mode nuit toggle complet → **Phase UI dédiée post-Passe 2** (DEC-020 update, infra Tailwind en place)
- Refonte visuelle complète logo/baseline → Phase UI dédiée (logo TAP existant conservé)
- Slide bidirectionnel iOS-style PWA Driver → Phase UI dédiée (DEC-020, bug Next.js #42658)
- SMTP custom Resend/Brevo → Phase 06+ (Q5.3)
- Migration clés Supabase `sb_publishable_*` / `sb_secret_*` → Phase 06 (Q5.1)
- Tests Vitest sur Server Actions → V1.0 commerciale (Q4.1, CLAUDE.md § 9 relax)
- `pnpm db:types` régénération → Phase 04.5 (C10)
- 10 captures showcase Phase 03 → Phase 04.5 (report explicite acté C10)
- Self-service signup chauffeur → JAMAIS (B2B fleet pattern industriel admin provisioning : Auth0/WorkOS/Onfleet)

**Success Criteria** (11 items pour `/gsd-verify-work` future) :
1. Dirigeant crée fiche driver puis click « Inviter » → email délivré au chauffeur via Supabase SMTP
2. Chauffeur clique le lien magic → atterrit `/accept-invite` avec email pré-rempli read-only
3. Chauffeur saisit mot de passe (min 8 chars NIST 2020+) + confirme + accepte CGU → submit
4. Acceptation : `auth.users` mis à jour password, `drivers.profile_id` rattaché, `driver_invitations.status='accepted'`, `audit_logs` 4 events INSERT cohérents (`driver_invited`, `driver_invitation_accepted`, `cgu_accepted_via_invitation`, password update implicite Supabase)
5. Redirect `/conduite` + toast success
6. `/login` refondue AuthShell mode jour, capture publiable
7. `DemoCredentials` cards cliquables si flag, prefill form fonctionnel
8. Token expiré → panneau erreur dédié, aucun form, pas de retry self-service
9. Email déjà utilisé autre rôle → refus clair avant envoi email (« Cet email est déjà utilisé pour un autre rôle »)
10. 2 tests Playwright passent : happy path + token expired
11. 2 captures Visible Progress dans `docs/showcase/04-onboarding-chauffeur-authshell/`

</domain>

<decisions>
## Implementation Decisions (32 contraintes + DEC-024..028)

### Découpage Phase (LOCKED — DEC-023 PR #57)

- **DEC-023** : Phase 04 god-phase abandonnée. Refonte E2E logique : 04 onboarding → 04.5 robustesse → 04.7 pricing mockup + caisse → 04.9 PWA enveloppe → 05 récurrences + cockpit + SMS + patient absent → 05.5 pricing CGSS réel → 06 HDS.

### Nouvelles décisions Phase 04 (à inscrire PROJECT.md)

- **DEC-024** : Workflow invitation 2 temps. Bouton « Inviter » séparé de `createDriverAction`. Le dirigeant crée d'abord la fiche métier `drivers` (peut être un chauffeur sans email/compte connexion encore — cas hérité Phase 1, `profile_id` nullable déjà prévu), PUIS click « Inviter » quand prêt à rattacher un compte. Cohérent avec le code existant. (Q1.1)
- **DEC-025** : `driver_invitations` table séparée (PAS extension de `drivers`). Évite duplication email (auth.users source de vérité après rattachement) et risque de désynchronisation. La table `drivers` reste sans champ email. Pour affichage liste, JOIN informationnel avec `auth.users` via `profile_id`. (Q1.2 + C01)
- **DEC-026** : `driverInvitationSchema` Zod séparé (PAS extension `driverInputSchema`). Séparation des concerns : fiche métier vs compte connexion. `driverInvitationSchema = { email: z.string().email(), driverId: z.string().uuid() }`. (Q1.3)
- **DEC-027** : Acceptation CGU obligatoire à `/accept-invite`. Case à cocher avec lien `/legal/cgu`. Trace `audit_logs` type `cgu_accepted_via_invitation`. Conforme Phase 1.5 RGPD. (Q1.4)
- **DEC-028** : Pattern RHF + Server Actions sans wrapper `<Form>` shadcn pour formulaires simples Phase 04+. `<Input>` `<Label>` `<Button>` shadcn directs (le wrapper `<Form>` ajoute des layers inutiles pour ≤ 5 champs). Le `<Form>` shadcn reste disponible pour formulaires complexes futures (caisse filters, override tarif Phase 04.7). (C06 + Q2.x)

### Formulaires (LOCKED — DEC-018 + DEC-028)

- **DEC-018** : RHF + zodResolver adoption ciblée Phase 04+. PAS de migration rétroactive Phase 1/2. Server Actions conservées côté submit.
- **D-RHF-01** : `useForm({ resolver: zodResolver(schema), mode: 'onBlur' })` — uncontrolled inputs (`defaultValues`), validation onBlur (PAS onChange qui re-render à chaque keystroke). (Q2.1)
- **D-RHF-02** : Erreurs serveur → toast Sonner. Erreurs Zod client → `formState.errors` RHF. PAS de `form.setError()` pour erreurs serveur V1. (Q2.2)
- **D-RHF-03** : Pattern classique `async/await` dans `onSubmit` — PAS `useActionState` React 19 (repo Next 14.2 + React 18). Migration React 19 = Phase 06+. (Q2.3)
- **D-RHF-04** : Première migration formulaire RHF = `login-form.client.tsx` (existant 80L, `useFormState`) + nouveau `/accept-invite` form. (C06)

### Contraintes formelles à tracer dans le plan (CXX)

**C01 — Migration BDD `driver_invitations`** *(Wave 1)*

Table dédiée avec 11 colonnes :
```sql
CREATE TABLE driver_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  driver_id     uuid REFERENCES drivers(id),  -- nullable, rempli à l'acceptance
  invited_by    uuid NOT NULL REFERENCES auth.users(id),
  email         text NOT NULL,
  role          text NOT NULL CHECK (role IN ('chauffeur')),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  accepted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Empêche doublons invitations pending même email
CREATE UNIQUE INDEX driver_invitations_pending_email_uniq
  ON driver_invitations(email) WHERE status = 'pending';

-- RLS strict (4 policies)
ALTER TABLE driver_invitations ENABLE ROW LEVEL SECURITY;

-- SELECT : invité OR destinataire
CREATE POLICY ... USING (
  auth.uid() = invited_by
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- INSERT : dirigeant uniquement
CREATE POLICY ... WITH CHECK (
  auth.uid() = invited_by
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'dirigeant')
);

-- UPDATE : destinataire pendant validité (acceptance)
CREATE POLICY ... USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status = 'pending'
  AND now() < expires_at
);

-- DELETE interdit (archivage logique via status='revoked')
```

Trigger `audit_logs INSERT` à chaque INSERT/UPDATE (pattern `drivers_audit_trigger`).

**C02 — `inviteDriverAction(email, driverId)` Server Action** *(Wave 2)*

Déclenchée par bouton « Inviter » dans `drivers-list.client.tsx` (PAS auto à `createDriverAction` — DEC-024). Logique :
1. Guard `requireDirigeant()` (pattern existant)
2. Validation `driverInvitationSchema` Zod (email + driverId)
3. Check email PAS DÉJÀ dans `auth.users` (autre rôle) → si existe, refus « Cet email est déjà utilisé pour un autre rôle »
4. `supabase.auth.admin.inviteUserByEmail(email, { data: { role: 'chauffeur', driver_id: driverId }, redirectTo: \`${origin}/accept-invite\` })`
5. INSERT `driver_invitations` `status='pending'`, `expires_at = now() + 24h`
6. `audit_logs INSERT` type `driver_invited`
7. `revalidatePath('/admin/chauffeurs')`
8. Retourne `ActionState { success, invitationId }`

Gestion erreur SMTP rate limit Supabase (3 emails/h défaut) : si `rate_limited`, message « Email non envoyé, ré-essayer dans 1h ou contacter support ».

**C03 — `resendInvitationAction(invitationId)` Server Action** *(Wave 2)*

Permet ré-invitation si email perdu/spam. Logique :
1. Guard dirigeant + ownership (`invited_by = auth.uid()`)
2. Check invitation existe + `status='pending'`
3. `supabase.auth.admin.inviteUserByEmail` re-call (Supabase génère nouveau token, ancien reste valide jusqu'expiry naturel)
4. UPDATE `driver_invitations.expires_at = now() + 24h`
5. `audit_logs INSERT` type `driver_invitation_resent`

**C04 — Page `/accept-invite` + `acceptInvitationAction`** *(Wave 3)*

**Route Handler GET `/accept-invite`** :
1. Lit `?token_hash` et `?type=invite` des params (pattern Supabase officiel `ConfirmationURL` — PAS construire le lien à la main, sinon « Auth session missing »)
2. Appelle `supabase.auth.verifyOtp({ token_hash, type: 'invite' })` pour vérifier et créer session
3. Si OK → render page form (Server Component qui passe email pré-rempli depuis `auth.user` actuel)
4. Si KO → render panneau erreur dédié sans CTA (lien expiré/invalide)

**Form Client Component RHF** :
- Email read-only (depuis user actuel)
- Mot de passe + confirmation (RHF + zodResolver)
- Validation : `password: z.string().min(8)` (PAS de complexity rule — NIST 2020+ guidance)
- Case à cocher CGU avec lien `/legal/cgu` (DEC-027)

**Submit → `acceptInvitationAction(data)`** :
1. `supabase.auth.updateUser({ password })`
2. UPDATE `driver_invitations.status='accepted'`, `accepted_at=now()`
3. UPDATE `drivers.profile_id = auth.uid()` WHERE `id = driver_invitations.driver_id`
4. `audit_logs INSERT` 2 events : `driver_invitation_accepted` + `cgu_accepted_via_invitation`
5. `redirect('/conduite')` (chauffeur landing existant web responsive)

**C05 — Composant `<AuthShell>`** *(Wave 3)*

Wrapper React (PAS Next.js layout) consommé par `/login`, `/welcome`, `/setup`, `/accept-invite`. Props :
```ts
interface AuthShellProps {
  children: React.ReactNode;          // form contenu
  title: string;                      // h1 page
  footerHint?: string;                // texte muted bas form
}
```

Layout split `lg:` (≥ 1024 px), single column mobile < 1024 px. **Aucun toggle jour/nuit** (DEC-020 update + Q3.2).

Colonne identité gauche (`bg-muted`) :
- Logo TAP `/public/` existant, `h-12` (48 px)
- Baseline factuelle sobre : « Régulation, optimisation, pilotage TAP/CGSS — 974 »
- Footer 48 px bottom muted : « SaaS de régulation TAP — Réunion 974 »

Colonne form droite (`bg-background`) :
- Header 56 px (vide V1 — toggle Phase UI future en slot prop optionnel)
- Title 28 px font-semibold
- Children (form) avec max-w-[400px] mx-auto
- DemoCredentials slot optionnel (uniquement `/login`)

Hauteurs `h-10` Input/Button default (verrou apprentissage Phase 03.2 → CONVENTIONS.md). **Spec complète déjà dans `04-UI-SPEC.md § 7.6`.**

**C06 — Conversion `LoginForm` à RHF + zodResolver** *(Wave 3, premier RHF du repo — DEC-018 + DEC-028)*

Pattern :
```tsx
'use client';
const form = useForm<SignInInput>({
  resolver: zodResolver(signInSchema),
  mode: 'onBlur',
  defaultValues: { email: defaultEmail ?? '', password: defaultPassword ?? '' },
});

const onSubmit = form.handleSubmit(async (data) => {
  const result = await signInAction(data);
  if (result?.error) toast.error(result.error);
});
```

Composants `<Input>` `<Label>` `<Button>` shadcn directs (PAS `<Form>` shadcn wrapper — DEC-028). `signInAction` existante intacte (60 L `actions.ts`), seule l'invocation client change. Props nouveaux : `defaultEmail?`, `defaultPassword?` pour prefill DemoCredentials (C07).

**C07 — `DemoCredentials` Client cliquable** *(Wave 3)*

Conversion Server Component → Client Component (`apps/web/src/components/demo-credentials.tsx`).

3 cards verticales (dirigeant, régulateur, chauffeur) :
- Visible **uniquement** si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'` — sinon **absent du DOM** (PAS `display: none`, empêche fuite credentials en prod via inspecteur)
- Click prefill email + password du form parent
- Lift state up : callback `onSelectAccount(email, password)` passé en prop, ou Context AuthShell (à trancher en plan)
- Texte d'aide muted 12 px : « Comptes de démonstration (cliquer pour pré-remplir). »
- Style cards : `border border-border rounded-md p-16 cursor-pointer hover:bg-accent/8 active:bg-accent/12 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`

Spec UI complète déjà dans `04-UI-SPEC.md § 7.7`.

**C08 — 2 Tests Playwright** *(Wave 4)*

**Test 1** `apps/web/tests/e2e/accept-invitation-happy-path.spec.ts` :
- `beforeEach` : reset Inbucket via `curl http://localhost:54324/api/v1/mailbox` (Q4.2)
- Login régulateur démo (ou dirigeant — à trancher selon RLS C01)
- Visite `/admin/chauffeurs`, crée fiche driver fictive (no nom propre — NFR-001)
- Click bouton « Inviter », saisit email test (`chauffeur-test@example.com`)
- Submit → toast success « Invitation envoyée »
- Lit email Inbucket (port 54324) via API, extract `token_hash` du `ConfirmationURL`
- Visite `/accept-invite?token_hash=...&type=invite`
- Submit form mot de passe (`test1234` ≥ 8 chars + confirm + check CGU)
- Assert redirect `/conduite` + toast success « Compte activé »
- Assert `drivers.profile_id` rattaché en BDD (query Supabase test client)

**Test 2** `accept-invitation-token-expired.spec.ts` :
- Visite `/accept-invite?token_hash=expired_token&type=invite`
- Assert panneau erreur visible (« Ce lien a expiré ou est invalide »)
- Assert absence de form mot de passe (zéro champ password rendu)
- Assert pas de bouton de retry self-service

PAS de tests Vitest (Q4.1 — relax CLAUDE.md § 9).

**C09 — Visible Progress (2 captures)** *(Wave 4)*

`docs/showcase/04-onboarding-chauffeur-authshell/` :
- `login-jour.png` : `/login` refondue AuthShell mode jour avec DemoCredentials visible (flag actif), 1280×720 ou plus, PNG ≤ 500 Ko
- `accept-invite.png` : `/accept-invite` form avec email pré-rempli + champs mot de passe + checkbox CGU, idem format

Production : preview Vercel après merge, capture humaine. Walkthrough script 5-10 étapes dans `04-SUMMARY.md`.

**C10 — Wave 0 préliminaires (vérifications docs)** *(Wave 0)*

- `STATE.md` : `current_phase = 04 onboarding` ✓ (déjà à jour post-#57)
- `ROADMAP.md` : Phase 04 reflète nouveau périmètre ✓ (déjà à jour post-#57)
- `PROJECT.md` : DEC-017..023 + ADR-003 ✓ (déjà inscrits post-#57). **À ajouter Phase 04 : DEC-024..028** (matérialisés dans ce CONTEXT.md, inscrits dans ce même commit)
- **10 captures showcase Phase 03 pending** : REPORT autorisé Phase 04.5, **acté explicitement ici** (le plan Phase 04 ne livre PAS les captures Phase 03)
- `pnpm db:types` régénération : reporté Phase 04.5 (Q5.1 indirectement, dette CONCERNS.md)

### Stack additions

- **D-DEPS-01** : Ajouter dépendance `@hookform/resolvers` (~5 KB gzip, standard écosystème RHF + Zod). Aucune autre. (Q5.2)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 04 section refondue (post-DEC-023, mergée PR #57)
- `.planning/REQUIREMENTS.md` — CHAUF-01..04 (workflow invitation chauffeur), NFR-001..006
- `.planning/PROJECT.md` — Bloc `<decisions>` : DEC-017..023 + ADR-003 + DEC-024..028 (inscrits ce commit)
- `.planning/STATE.md` — current_phase 04 onboarding
- `.planning/codebase/CONCERNS.md` — Re-mapping post-DEC-023 + section « Workflow invitation chauffeur » (résolu Phase 04)
- `.planning/codebase/CONVENTIONS.md` — RLS multi-tenant, Server Actions, archivage logique, **piège Tailwind `h-*` rem default** (Phase 03.2)
- `.planning/codebase/STACK.md` — Supabase Auth, Next.js 14 App Router, Tailwind + shadcn, Sonner toasts
- `.planning/phases/04-onboarding-chauffeur-authshell/04-UI-SPEC.md` — Contrat visuel global Passe 2 (835 L, 6/6 PASS gsd-ui-checker). Sections consommées Phase 04 : **§ 7.6 AuthShell + § 7.7 DemoCredentials + § 7.8 /accept-invite + § 4 Color (jour uniquement)**
- `.planning/regle-neutralite-et-ton.md` — NFR-001 (aucun nom propre dans tests/captures/exemples), NFR-002 (ton sobre)
- Supabase docs : `auth.admin.inviteUserByEmail`, `auth.verifyOtp({ token_hash, type: 'invite' })`, ConfirmationURL template gotcha
- Supabase Auth template config : `{{ .ConfirmationURL }}` à utiliser TEL QUEL dans le template email (pas reconstruire le lien)

### Code existant audité (dirigeant 2026-05-13)

| Fichier | Lignes | État |
|---|---|---|
| `apps/web/src/app/(admin)/admin/chauffeurs/page.tsx` | — | RSC liste drivers avec RLS |
| `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` | — | `createDriverAction`, `updateDriverAction`, `archiveDriverAction` (pattern `useFormState`, audit auto via trigger `drivers_audit_trigger`) |
| `apps/web/src/app/(admin)/admin/chauffeurs/_components/driver-form.client.tsx` | — | Form création/édition (nom_affichage, telephone, numero_licence, type_permis[], actif). **PAS de champ email.** |
| `apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` | — | Liste + Sheet édition (ajout bouton « Inviter » Phase 04) |
| `packages/shared/.../driverInputSchema.ts` | — | Zod schema (sans email) — inchangé Phase 04 (DEC-026) |
| `supabase/migrations/20260512000001_drivers.sql` | — | `drivers.profile_id uuid` nullable REFERENCES `auth.users(id)` ON DELETE SET NULL |
| `apps/web/src/app/(auth)/login/page.tsx` | 29 | Layout actuel centered card max-w-[400px] — à refondre AuthShell |
| `apps/web/src/app/(auth)/login/login-form.client.tsx` | 80 | Pattern `useFormState` — à migrer RHF (C06) |
| `apps/web/src/app/(auth)/login/actions.ts` | 62 | `signInAction` Server Action existante — **inchangée Phase 04** |
| `apps/web/src/components/demo-credentials.tsx` | — | Server Component actuel — à convertir Client cliquable (C07) |
| `apps/web/src/app/welcome/page.tsx` | 88 | À refondre AuthShell |
| `apps/web/src/app/setup/page.tsx` | 107 | À refondre AuthShell |

3 commentaires dans le code mentionnent explicitement « rattachement compte connexion Passe 2 » — Phase 04 lifte ces TODO.

### À créer Phase 04

- Migration `supabase/migrations/2026MMDD000001_driver_invitations.sql`
- `packages/shared/.../driverInvitationSchema.ts` (nouveau schéma)
- Server Actions `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` (extension) : `inviteDriverAction`, `resendInvitationAction`
- `apps/web/src/app/(auth)/accept-invite/page.tsx` + `route.ts` (GET handler) + `_components/accept-invite-form.client.tsx` + `actions.ts` (`acceptInvitationAction`)
- `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` (nouveau)
- Conversion `apps/web/src/components/demo-credentials.tsx` Server → Client
- Refonte `(auth)/login/page.tsx`, `welcome/page.tsx`, `setup/page.tsx` à consommer `<AuthShell>`
- Migration `login-form.client.tsx` vers RHF
- 2 tests Playwright `apps/web/tests/e2e/accept-invitation-*.spec.ts`
- 2 captures `docs/showcase/04-onboarding-chauffeur-authshell/*.png`

### Recherche état de l'art 2026 (synthèse 6 recherches web — dirigeant)

| Topic | Conclusion |
|---|---|
| Supabase Auth invitation | `inviteUserByEmail` V1 simple (B2B fleet pattern). Pas `signInWithOtp` (self-service public, inapproprié). Pas `admin.generateLink + SMTP custom` (V2+). |
| SMTP rate limit Supabase | 3 emails/h défaut. OK V1 design partner (volume négligeable). Custom Resend/Brevo = Phase 06+. |
| ConfirmationURL gotcha | Utiliser `{{ .ConfirmationURL }}` dans template email tel quel. Construire le lien à la main → « Auth session missing » au `/accept-invite`. |
| Clés Supabase 2026 | `sb_publishable_*` / `sb_secret_*` remplacent `anon` / `service_role`. Legacy until end of 2026. Migration optionnelle, **Phase 06+** (Q5.1). |
| B2B fleet onboarding pattern industriel 2026 | Admin provisioning (Auth0, WorkOS, Onfleet). Dirigeant invite, chauffeur active. PAS de self-service signup. **Exactement notre modèle.** |
| RHF + Server Actions + Zod 2026 | RHF reste leader (12M DL/sem PkgPulse 2026). Pattern stable. Conform alternative = sur-engineering pour 1 form. |
| shadcn login-page-02 block | Pattern industriel adopté Linear/Vercel/WorkOS/Supabase. Référence visuelle uniquement — **PAS d'install CLI** (apporterait code non aligné CSS vars repo) (Q3.1). |

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drivers.profile_id uuid` nullable déjà prévu pour rattachement Phase 04 (anticipation Phase 1)
- `audit_logs` INSERT-only trigger en place — types `driver_invited` / `driver_invitation_resent` / `driver_invitation_accepted` / `cgu_accepted_via_invitation` à ajouter (4 types nouveaux)
- Pattern Server Action canonique `(admin)/admin/chauffeurs/actions.ts` à étendre
- 3 auth shells `/login` `/welcome` `/setup` dupliquent `min-h-screen flex items-center justify-center` — extraction `<AuthShell>` = refactor mécanique, pas rewrite
- Dark mode infra Tailwind (`darkMode: ['class', '[data-theme="dark"]']` + tokens CSS vars `globals.css`) en place — Phase 04 ne consomme que tokens jour, toggle Phase UI dédiée
- `signInAction` existante (60L) inchangée Phase 04 — seule l'invocation client migre à RHF

### Established Patterns (à respecter)
- Server Components par défaut (CLAUDE.md § 7), `'use client'` minimal
- RLS forcée + `organization_id` sur toute table métier (FOND-02) — `driver_invitations` ne fait pas exception
- Audit logs systématique sur actions sensibles (CLAUDE.md § 6) — 4 events ajoutés Phase 04
- Validation zod côté client + serveur, types via `z.infer<typeof schema>`
- Pickers/popovers dans Radix Dialog → rendu inline, pas de `portalId` externe (Phase 03.2.8) — non applicable Phase 04 (pas de Dialog AuthShell)
- Classes hauteur Tailwind `h-*` = échelle default rem (`h-10 = 40 px` Input/Select shadcn) — verrou apprentissage Phase 03.2 (`h-40 = 160 px ❌`)

### Integration Points
- `apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` : ajout bouton « Inviter » + badge statut invitation (Q1.6, Q1.7)
- `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` : ajout `inviteDriverAction` + `resendInvitationAction`
- `supabase/migrations/2026MMDD000001_driver_invitations.sql` : nouvelle migration RLS + trigger audit
- `apps/web/src/app/(auth)/accept-invite/` : nouveau dossier (page + route handler + form + actions)
- `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` : nouveau composant
- `apps/web/src/components/demo-credentials.tsx` : conversion Server → Client (lift state up via prop callback)
- `apps/web/package.json` : `+ @hookform/resolvers ^3.x`
- `apps/web/tests/e2e/` : 2 nouveaux specs Playwright

### Risques techniques identifiés
- **Email landing en spam** : domaine `noreply@mail.supabase.io` non SPF/DKIM/DMARC sur domaine TAP. V1 accepté (chauffeur prévenu par téléphone), V2 SMTP custom (Q6.1).
- **Token visible historique navigateur chauffeur** : trade-off accepté simplicité (token usage unique, expire 24h) (Q6.2).
- **Race condition resend** : si dirigeant click « Renvoyer » 2× rapidement, 2 emails partent. Mitigation : disable bouton 5s post-click + check côté serveur `expires_at - now() > 23h59m` (refus retry trop rapide).

</code_context>

<specifics>
## Specific User Choices (19 réponses posées Q1.1..Q7.1)

| Q | Réponse posée | Inscrit dans |
|---|---|---|
| Q1.1 | Bouton « Inviter » séparé de `createDriverAction` | DEC-024 + C02 |
| Q1.2 | `driver_invitations` table séparée (PAS extension `drivers`) | DEC-025 + C01 |
| Q1.3 | `driverInvitationSchema` Zod séparé | DEC-026 + C02 |
| Q1.4 | Acceptation CGU obligatoire à `/accept-invite` | DEC-027 + C04 |
| Q1.5 | Token expiry 24h défaut Supabase | C01 |
| Q1.6 | Bouton « Inviter » dans `drivers-list` (PAS drawer édition) | C02 |
| Q1.7 | Badge statut invitation dans liste drivers (4 états : aucun / Invité / Lien expiré / Compte actif) | C02 + UI-SPEC complément |
| Q2.1 | RHF uncontrolled inputs + mode `onBlur` | D-RHF-01 |
| Q2.2 | Erreurs serveur via toast Sonner (PAS `form.setError`) | D-RHF-02 |
| Q2.3 | Pattern `async/await` (PAS `useActionState` React 19) | D-RHF-03 |
| Q3.1 | PAS d'install `npx shadcn add login-page-02` (réf visuelle uniquement) | C05 |
| Q3.2 | PAS de toggle mode nuit Phase 04 (DEC-020 update) | Périmètre hors |
| Q4.1 | PAS de tests Vitest Server Actions V1 (CLAUDE.md § 9 relax) | Périmètre hors |
| Q4.2 | Reset Inbucket entre tests Playwright via `curl /api/v1/mailbox` | C08 |
| Q5.1 | PAS de migration clés Supabase `sb_publishable_*` Phase 04 | Périmètre hors |
| Q5.2 | Ajout `@hookform/resolvers` (~5 KB gzip, seule dep) | D-DEPS-01 |
| Q5.3 | PAS de SMTP custom Resend/Brevo Phase 04 | Périmètre hors |
| Q6.1 | Risque email spam accepté V1 (chauffeur prévenu par téléphone) | Risques techniques |
| Q6.2 | Token URL trade-off accepté (usage unique 24h) | Risques techniques |
| Q7.1 | Velocity 4-5h, 4 plans / 4 waves | Estimation |

### Plan probable (4 plans / 4 waves) — proposition dirigeant

| Wave | Plan | Contraintes traitées |
|------|------|---------------------|
| **W0** | Préliminaires + verif docs | C10 (vérif STATE/ROADMAP/PROJECT — DEC-024..028 inscrits ce commit) |
| **W1** | Migration BDD `driver_invitations` | C01 |
| **W2** | Server Actions invitation (3 actions) | C02 + C03 + partie C04 (acceptInvitationAction) |
| **W3** | `/accept-invite` + AuthShell + refonte 4 pages + RHF + DemoCredentials | C04 (page) + C05 + C06 + C07 |
| **W4** | Tests Playwright + 2 captures Visible Progress | C08 + C09 |

Le planner peut ajuster à la marge (par exemple split W3 si overhead). Traçabilité « PLAN-X §Y.Z traite CXX » obligatoire dans le rendu final.

### Visible Progress Mandate (CLAUDE.md § 13.5)

- 2 captures (`login-jour.png` + `accept-invite.png`)
- Walkthrough script 5-10 étapes dans `04-SUMMARY.md`
- Seed démo 974 déjà en place (Phase 0.7)
- Comptes démo persistants `dirigeant@demo.tap` / `regulateur@demo.tap` / `chauffeur@demo.tap` déjà seedés
- Preview Vercel + UAT manuel design partner

</specifics>

<deferred>
## Deferred Ideas

### Reportées sous-phases suivantes (DEC-023)
- PWA chauffeur (Serwist + Dexie + ConnectionStatus + sync engine + persistence) → **Phase 04.9**
- Tarif CGSS UI mockup + override + caisse + migration géocoding → **Phase 04.7**
- Tarif CGSS calcul réel (grille dirigeant + décision distance) → **Phase 05.5**
- Robustesse régulateur (filtrage permis, audit nom acteur, découpes 384L/337L, types regen, 10 captures Phase 03) → **Phase 04.5**

### Reportées Phase UI/UX dédiée post-Passe 2
- Mode nuit toggle complet (Sun/Moon button + Server Action `toggleThemeAction` + cookie httpOnly + QA parité jour/nuit + captures publiables nuit)
- Refonte visuelle complète logo / baseline / splash / identité forte
- Slide bidirectionnel iOS-style PWA Driver (DEC-020, bug Next.js #42658)
- Layout split tablette 768-1024 px (CONCERNS.md nouveau)
- Polish UI/UX modal saisie course (CONCERNS.md ligne 197 — verrou maintenu)

### Reportées Phase 06+
- SMTP custom Resend/Brevo email transactionnel (Q5.3)
- Migration clés Supabase `sb_publishable_*` / `sb_secret_*` (Q5.1)
- Migration React 19 + `useActionState` (Q2.3)
- Self-host OSRM (déjà déféré DEC-021)

### Reviewed Todos (not folded)
Aucun — `gsd-sdk query todo.match-phase 04` retourne 0.

</deferred>
