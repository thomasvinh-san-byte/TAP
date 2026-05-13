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

## Files modified

### Nouveaux fichiers (8)

- `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` — wrapper React (C05)
- `apps/web/src/app/(auth)/accept-invite/page.tsx` — Server Component (verify session + render form ou panneau erreur)
- `apps/web/src/app/(auth)/accept-invite/route.ts` — Route Handler GET (verifyOtp Supabase)
- `apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.client.tsx` — form RHF
- `apps/web/src/app/(auth)/accept-invite/_components/invitation-error-panel.tsx` — Server Component erreur token

### Fichiers modifiés (5)

- `apps/web/src/app/(auth)/login/page.tsx` — utiliser `<AuthShell>` + passer DemoCredentials
- `apps/web/src/app/(auth)/login/login-form.client.tsx` — migration RHF + props prefill
- `apps/web/src/app/welcome/page.tsx` — utiliser `<AuthShell>`
- `apps/web/src/app/setup/page.tsx` — utiliser `<AuthShell>`
- `apps/web/src/components/demo-credentials.tsx` — Server → Client cliquable
- `apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` — bouton Inviter + badge statut

## Tasks

### 4.1 `<AuthShell>` composant réutilisable (C05)

Fichier `apps/web/src/app/(auth)/_components/auth-shell.client.tsx`.

Spec consommée : UI-SPEC § 7.6.

```tsx
'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';

interface AuthShellProps {
  children: ReactNode;
  title: string;
  footerHint?: ReactNode;
  rightSlot?: ReactNode; // pour DemoCredentials uniquement /login
}

export function AuthShell({ children, title, footerHint, rightSlot }: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Colonne identité (gauche desktop, header mobile) */}
      <aside
        className="bg-muted flex-1 flex flex-col justify-between p-24 lg:p-48"
        aria-label="Identité produit"
      >
        <header className="h-14" /> {/* Header 56 px vide V1 */}
        <div className="flex flex-col items-start gap-24">
          <Image
            src="/logo-tap.svg" // confirmer chemin existant dans public/
            alt="TAP"
            width={120}
            height={48}
            className="h-12 w-auto"
            priority
          />
          <p className="text-base text-muted-foreground leading-[1.5] max-w-[440px]">
            Régulation, optimisation, pilotage TAP/CGSS — 974
          </p>
        </div>
        <footer className="text-xs text-muted-foreground">
          SaaS de régulation TAP — Réunion 974
        </footer>
      </aside>

      {/* Colonne form (droite desktop, body mobile) */}
      <section className="bg-background w-full lg:w-[480px] lg:flex-shrink-0 flex flex-col p-24 lg:p-32">
        <header className="h-14" /> {/* Header 56 px — toggle nuit Phase UI future */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[400px] mx-auto space-y-24">
            <h1 className="text-[28px] font-semibold leading-[1.2]">{title}</h1>
            {children}
            {rightSlot ? <div className="pt-16">{rightSlot}</div> : null}
            {footerHint ? (
              <p className="text-sm text-muted-foreground pt-16">{footerHint}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
```

Vérif : `h-12` (48 px) logo, `h-14` (56 px) headers, padding `p-24/p-32/p-48`
**échelle stricte** (NFR-003). Pas d'emoji. Baseline factuelle (NFR-001).

### 4.2 Refonte `/login` (consume AuthShell + RHF form + DemoCredentials)

**Fichier `apps/web/src/app/(auth)/login/page.tsx`** (Server Component) :

```tsx
import { AuthShell } from '../_components/auth-shell.client';
import { DemoCredentials } from '@/components/demo-credentials';
import { LoginForm } from './login-form.client';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <AuthShell
      title="Connexion"
      rightSlot={<DemoCredentialsSlot next={searchParams.next} />}
    >
      <LoginForm next={searchParams.next} />
    </AuthShell>
  );
}

// Wrapper Client pour partager state prefill entre DemoCredentials et LoginForm.
// Implémenté en §4.4 — pour l'instant, DemoCredentials reçoit directement
// le callback de prefill via Context AuthShell ou prop drilling minimal.
function DemoCredentialsSlot({ next }: { next?: string }) {
  return <DemoCredentials />;
}
```

**Note importante** : la prefill via DemoCredentials nécessite un état
partagé Client-side entre `<DemoCredentials>` et `<LoginForm>`. **Solution
retenue** : encapsuler les deux dans un Client Component `<LoginFormShell>`
qui détient le state local `(email, password)` et passe les setters à
DemoCredentials + les values en `defaultValues` RHF du LoginForm.

Refactor : créer
`apps/web/src/app/(auth)/login/_components/login-form-shell.client.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { LoginForm } from '../login-form.client';
import { DemoCredentials } from '@/components/demo-credentials';

export function LoginFormShell({ next }: { next?: string }) {
  const [prefill, setPrefill] = useState<{ email: string; password: string } | null>(null);

  return (
    <div className="space-y-16">
      <LoginForm next={next} prefill={prefill ?? undefined} />
      <DemoCredentials onSelect={(email, password) => setPrefill({ email, password })} />
    </div>
  );
}
```

Et `page.tsx` simplifié :

```tsx
import { AuthShell } from '../_components/auth-shell.client';
import { LoginFormShell } from './_components/login-form-shell.client';

export default function LoginPage({
  searchParams,
}: { searchParams: { next?: string } }) {
  return (
    <AuthShell title="Connexion">
      <LoginFormShell next={searchParams.next} />
    </AuthShell>
  );
}
```

### 4.3 LoginForm — migration RHF + zodResolver (C06)

Remplacer intégralement `apps/web/src/app/(auth)/login/login-form.client.tsx`.

Conserver `signInAction` existante (60L `actions.ts`) inchangée. Seule
l'invocation client change. Pattern DEC-028 (pas de wrapper `<Form>` shadcn) :

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction } from './actions';

const signInSchema = z.object({
  email: z.string().email({ message: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { message: 'Mot de passe requis.' }),
});
type SignInInput = z.infer<typeof signInSchema>;

interface LoginFormProps {
  next?: string;
  prefill?: { email: string; password: string };
}

export function LoginForm({ next, prefill }: LoginFormProps) {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: { email: prefill?.email ?? '', password: prefill?.password ?? '' },
  });

  // Sync prefill lorsque DemoCredentials est cliqué (state up dans LoginFormShell)
  useEffect(() => {
    if (prefill) {
      form.setValue('email', prefill.email, { shouldValidate: false });
      form.setValue('password', prefill.password, { shouldValidate: false });
    }
  }, [prefill, form]);

  const onSubmit = form.handleSubmit(async (data) => {
    const fd = new FormData();
    fd.set('email', data.email);
    fd.set('password', data.password);
    if (next) fd.set('next', next);
    // signInAction existante prend (prev, formData)
    const result = await signInAction({}, fd);
    if (result?.error) toast.error(result.error);
    // Si pas d'erreur, signInAction redirect via Next.js — pas de else nécessaire.
  });

  return (
    <form onSubmit={onSubmit} className="space-y-16" noValidate>
      <div className="space-y-8">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          className="h-10"
          {...form.register('email')}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-8">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-10"
          {...form.register('password')}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
        className="w-full h-12 text-base"
      >
        {form.formState.isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
      </Button>
    </form>
  );
}
```

**Note signInAction** : la signature `signInAction({}, fd)` doit être
compatible avec celle existante (qui utilise `useFormState` côté ancien
form). Vérifier dans `actions.ts` ligne 1-62 : si la signature est
`(prev: SignInState, formData: FormData)`, l'appel `signInAction({}, fd)`
fonctionne tel quel. **Aucune modification à `actions.ts`**.

Toast Sonner : confirmer dans `apps/web/src/app/layout.tsx` que
`<Toaster />` Sonner est monté à la racine (existait Phase 1, voir
`apps/web/src/app/layout.tsx`). Si non, l'ajouter.

### 4.4 DemoCredentials — Server → Client cliquable (C07)

Remplacer intégralement `apps/web/src/components/demo-credentials.tsx` :

```tsx
'use client';

import { ChevronRight } from 'lucide-react';

const ACCOUNTS = [
  {
    role: 'Dirigeant',
    description: 'Accès complet, pilotage, configuration.',
    email: 'dirigeant@demo.tap',
    password: 'demo1234!',
  },
  {
    role: 'Régulateur',
    description: 'Saisie des courses, assignation, caisse.',
    email: 'regulateur@demo.tap',
    password: 'demo1234!',
  },
  {
    role: 'Chauffeur',
    description: 'PWA mobile, courses du jour, clôture.',
    email: 'chauffeur@demo.tap',
    password: 'demo1234!',
  },
] as const;

interface DemoCredentialsProps {
  onSelect: (email: string, password: string) => void;
}

/**
 * Comptes démo cliquables.
 *
 * Visible UNIQUEMENT si NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'.
 * Sinon le composant retourne null (ABSENT du DOM — pas display:none).
 * Empêche fuite credentials en prod via inspecteur (Q5.1).
 */
export function DemoCredentials({ onSelect }: DemoCredentialsProps) {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1') return null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Comptes de démonstration (cliquer pour pré-remplir).
      </p>
      <div className="space-y-8">
        {ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onSelect(account.email, account.password)}
            className="
              w-full text-left
              border border-border rounded-md p-16
              cursor-pointer
              hover:bg-accent/8 hover:border-accent
              active:bg-accent/12
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2
            "
          >
            <div className="flex items-center justify-between">
              <div className="space-y-4">
                <p className="text-sm font-medium">{account.role}</p>
                <p className="text-xs text-muted-foreground">{account.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Compat env var** : la version actuelle teste `=== 'true'`. La spec
DEC dit `=== '1'`. **Choix retenu** : aligner sur `'1'` (plus court,
standard flags binaires) et **mettre à jour `setup-vercel.yml`** si
besoin (Wave 1.1 ou §3.5 commit séparé). Vérifier au moment de
l'implémentation quelle valeur est posée par `setup-vercel.yml` et
l'aligner.

### 4.5 Page `/accept-invite` — Route Handler + Server Component + Form + Erreur (C04)

**Fichier `apps/web/src/app/(auth)/accept-invite/route.ts`** (Route Handler GET) :

```ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Route Handler GET /accept-invite
 *
 * Pattern Supabase officiel : verifyOtp({ token_hash, type: 'invite' })
 * crée la session si le token est valide. Le template d'email Supabase
 * doit utiliser {{ .ConfirmationURL }} TEL QUEL pour pointer ici
 * (gotcha : construire le lien à la main → "Auth session missing").
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (!token_hash || type !== 'invite') {
    return NextResponse.redirect(`${url.origin}/accept-invite?error=invalid_link`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'invite' });
  if (error) {
    return NextResponse.redirect(`${url.origin}/accept-invite?error=expired`);
  }
  return NextResponse.redirect(`${url.origin}/accept-invite`);
}
```

**Fichier `apps/web/src/app/(auth)/accept-invite/page.tsx`** (Server Component) :

```tsx
import { AuthShell } from '../_components/auth-shell.client';
import { AcceptInviteForm } from './_components/accept-invite-form.client';
import { InvitationErrorPanel } from './_components/invitation-error-panel';
import { getAuthContext } from '@/lib/auth/get-auth-context';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Erreur transmise par Route Handler (token invalide ou expiré)
  if (searchParams.error === 'expired' || searchParams.error === 'invalid_link') {
    return (
      <AuthShell title="Activer mon compte">
        <InvitationErrorPanel
          message={
            searchParams.error === 'expired'
              ? 'Lien d\'invitation expiré. Demandez un nouveau lien à votre régulateur.'
              : 'Lien d\'invitation invalide ou déjà utilisé.'
          }
        />
      </AuthShell>
    );
  }

  const ctx = await getAuthContext();
  if (!ctx?.user?.email) {
    // Pas de session valide (lien direct sans token_hash)
    return (
      <AuthShell title="Activer mon compte">
        <InvitationErrorPanel message="Lien d'invitation invalide ou déjà utilisé." />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activer mon compte"
      footerHint="Définissez votre mot de passe pour accéder à l'application chauffeur."
    >
      <AcceptInviteForm userEmail={ctx.user.email} />
    </AuthShell>
  );
}
```

**Fichier `_components/invitation-error-panel.tsx`** :

```tsx
import { AlertCircle } from 'lucide-react';

export function InvitationErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-16 p-24 bg-muted/40 rounded-md border border-border"
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="text-base text-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Aucune action à effectuer ici. Contactez votre régulateur pour obtenir
        un nouveau lien d'invitation.
      </p>
    </div>
  );
}
```

**Fichier `_components/accept-invite-form.client.tsx`** :

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';

import { acceptInvitationSchema, type AcceptInvitationInput } from '@tap/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox'; // si dispo shadcn ; sinon Input type=checkbox
import { acceptInvitationAction } from '../actions';

export function AcceptInviteForm({ userEmail }: { userEmail: string }) {
  const form = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '', cguAccepted: false as unknown as true },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const fd = new FormData();
    fd.set('password', data.password);
    fd.set('confirmPassword', data.confirmPassword);
    fd.set('cguAccepted', data.cguAccepted ? 'on' : '');
    const result = await acceptInvitationAction({}, fd);
    if (result?.error) toast.error(result.error);
    // Pas d'else : acceptInvitationAction redirect('/conduite?activated=1')
    // Le toast success "Compte activé. Bienvenue…" (UI-SPEC § 7.8) est
    // déclenché côté /conduite/page.tsx via lecture searchParams (FLAG #1).
  });

  return (
    <form onSubmit={onSubmit} className="space-y-16" noValidate>
      <div className="space-y-8">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" value={userEmail} readOnly className="h-10 bg-muted/40" />
      </div>

      <div className="space-y-8">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          className="h-10"
          {...form.register('password')}
        />
        <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
        {form.formState.errors.password ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-8">
        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="h-10"
          {...form.register('confirmPassword')}
        />
        {form.formState.errors.confirmPassword ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-8">
        <input
          id="cguAccepted"
          type="checkbox"
          {...form.register('cguAccepted')}
          className="h-4 w-4 mt-4 rounded border-border focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Label htmlFor="cguAccepted" className="text-sm leading-[1.4]">
          J'accepte les{' '}
          <Link href="/legal/cgu" target="_blank" className="underline underline-offset-4">
            conditions générales d'utilisation
          </Link>
          .
        </Label>
      </div>
      {form.formState.errors.cguAccepted ? (
        <p role="alert" className="text-sm text-destructive">
          {form.formState.errors.cguAccepted.message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
        className="w-full h-12"
      >
        {form.formState.isSubmitting ? 'Activation en cours…' : 'Activer mon compte'}
      </Button>
    </form>
  );
}
```

### 4.6 Refonte `/welcome` et `/setup` (consume AuthShell)

Wraper le contenu existant des deux pages dans `<AuthShell title="…">`.
Conserver la logique métier de chaque page (pas de refactor backend).

- `/welcome` → `title="Configurer l'environnement"` (UI-SPEC § 5).
- `/setup` → `title="Initialiser la base"`.

Le contenu intérieur reste celui actuel (les 88 / 107 lignes existantes
adaptées à passer dans `children`). Vérifier que la suppression de
l'ancien `min-h-screen flex items-center justify-center` ne casse pas
l'alignement (AuthShell le fournit déjà via `flex flex-col justify-center`
sur la colonne form).

### 4.7 Bouton « Inviter » + badge statut dans `drivers-list.client.tsx`

Étendre `apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` :

- Ajouter colonne « Statut compte » dans la liste, calculée côté Server
  Component parent via JOIN `drivers ↔ driver_invitations` (LEFT JOIN
  sur `driver_id`, `status='pending'` OR latest).
- 4 états badge (Q1.7) :
  - `aucun` → driver sans `profile_id` ET sans invitation → bouton « Inviter » primary
  - `Invité` → driver avec `driver_invitations.status='pending'` ET pas expiré → bouton « Renvoyer » secondary + badge muted « Invité »
  - `Lien expiré` → invitation `status='pending'` ET `now() > expires_at` (à calculer côté server) → bouton « Renvoyer » + badge `--warning`
  - `Compte actif` → `drivers.profile_id IS NOT NULL` → badge `--success` « Actif »
- Bouton « Inviter » ouvre un mini-dialog (réutilisation Radix `Dialog`
  déjà installé) avec 1 champ email + submit → `inviteDriverAction`.
- Bouton « Renvoyer » → confirm modale → `resendInvitationAction(invitationId)`.

Toasts Sonner pour les retours d'action.

### 4.8 Validation visuelle UI-SPEC § 7.6 / 7.7 / 7.8

Vérifier avant commit :
- Aucun `h-40` (160 px) sur Input/Button (piège Phase 03.2 — CONVENTIONS.md).
- Aucune valeur spacing intermédiaire (`p-20`, `gap-10`, etc.) — uniquement
  4/8/12/16/24/32/48/64.
- Aucun emoji dans copy ni dans icônes (NFR-002).
- Aucun nom propre dans copy (NFR-001).
- Palette CSS vars existantes uniquement (NFR-004).
- Focus ring visible sur tous interactifs (`focus-visible:ring-2 ring-ring ring-offset-2`).
- Aucune transition > 250 ms (NFR-005 — défaut 150 ms).
- `lang="fr"` hérité du layout racine, OK.

### 4.8bis Toast success post-acceptation invitation (FLAG #1 plan-checker)

**Fichier** : `apps/web/src/app/(driver)/conduite/page.tsx` (ou wrapper Client).

`acceptInvitationAction` (PLAN-3 §3.4) appelle `redirect('/conduite?activated=1')` côté serveur. Le toast success Sonner « Compte activé. Bienvenue dans l'application chauffeur. » (UI-SPEC § 7.8) doit donc être déclenché côté client par `/conduite` au mount, en lisant `searchParams.activated`.

Si `/conduite/page.tsx` est un Server Component, ajouter un petit Client Component wrapper `<ActivationToast />` qui :

```tsx
'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function ActivationToast() {
  const sp = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (sp.get('activated') === '1') {
      toast.success("Compte activé. Bienvenue dans l'application chauffeur.");
      // Nettoie le param URL pour éviter de re-déclencher au reload
      const url = new URL(window.location.href);
      url.searchParams.delete('activated');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [sp, router]);
  return null;
}
```

Et l'inclure dans `/conduite/page.tsx` (Server Component) :

```tsx
import { ActivationToast } from './_components/activation-toast.client';

export default async function ConduitePage() {
  return (
    <>
      <ActivationToast />
      {/* … reste du layout existant /conduite … */}
    </>
  );
}
```

**Pas de régression** sur le layout existant `/conduite` (Phase 03 squelette E2E inchangé). Toast est non-bloquant et purement informatif.

**SC #5 couvert** : redirect + toast success livrés sans modifier le contrat de `acceptInvitationAction` (qui reste un `redirect` côté serveur).

### 4.9 Commit unique (gros plan, ~600 lignes nettes)

Message :

```
feat(04): AuthShell jour + /accept-invite + LoginForm RHF + DemoCredentials cliquable + bouton Inviter (C04+C05+C06+C07)

- AuthShell : wrapper React split desktop / single column mobile, mode jour
  uniquement (toggle nuit reporté Phase UI dédiée — DEC-020 update)
- /login : refonte avec AuthShell + LoginFormShell (lift state up pour
  prefill DemoCredentials)
- LoginForm : migration RHF + zodResolver (premier RHF du repo, DEC-018+028)
  pattern uncontrolled inputs + mode onBlur + toast Sonner pour erreurs serveur
  signInAction (actions.ts) intacte
- DemoCredentials : Server → Client cliquable, 3 cards interactives,
  hover --accent réservé (NFR-004), ABSENT du DOM si flag != '1' (Q5.1)
- /accept-invite : Route Handler GET (verifyOtp Supabase) + page Server
  Component (render form OU panneau erreur selon ?error) + form RHF
  (password ≥ 8 + confirm match + CGU obligatoire DEC-027) + redirect /conduite
- /welcome + /setup : refonte AuthShell, contenu métier inchangé
- drivers-list.client.tsx : bouton Inviter + badge statut 4 états +
  bouton Renvoyer (consomme inviteDriverAction + resendInvitationAction)

Conformité visuelle UI-SPEC § 4 (mode jour), § 7.6, § 7.7, § 7.8.
Conformité NFR-001..006 vérifiée.

Réfs : Phase 04 § PLAN-4, C04 (UI), C05, C06, C07, DEC-018, DEC-027, DEC-028.
```

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

## Threat model

ASVS L1 + UI/UX hardening :

| Threat | Risk | Mitigation |
|---|---|---|
| **DemoCredentials fuite credentials en prod** | HIGH (vol comptes) | Composant retourne `null` si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1'`. **ABSENT du DOM** (pas `display:none` qui resterait inspectable). Vérifier que `setup-vercel.yml` ne pose pas ce flag sur la prod commerciale (V2). |
| **Token URL dans referer leakage** | LOW | Trade-off accepté Q6.2. Token usage unique, `verifyOtp` consomme. Headers `Referrer-Policy: strict-origin-when-cross-origin` posés par layout racine (à vérifier ; sinon ajouter dans `next.config.js`). |
| **CSRF accept-invite form** | LOW | Server Action protégée nativement Next.js 14 (same-origin check). |
| **XSS via email user prefill** | LOW | `userEmail` rendu via `<Input value=...>` React échappe par défaut. Pas de `dangerouslySetInnerHTML`. |
| **Clickjacking sur /accept-invite** (iframe attaque) | LOW | Headers `X-Frame-Options: DENY` ou `frame-ancestors 'none'` à vérifier dans `next.config.js`. Si absent, ajouter ce plan ou Phase 04.5. |
| **Open redirect via `?next=` LoginForm** | MEDIUM | Vérifier que `signInAction` (actions.ts existant) valide `next` comme URL relative (sanitize). Si non, ajouter check `next.startsWith('/')` dans la Server Action — **hors scope C06 mais à signaler dans `04-SUMMARY.md`** comme dette éventuelle Phase 04.5. |
| **Password reuse signaling** | LOW | Pas de check "password compromis" V1 (haveibeenpwned API = V2). NIST 2020+ longueur seule (≥ 8). |
| **CGU bypass via JS désactivé** | MEDIUM (RGPD) | Validation Zod côté serveur (PLAN-3 §3.1) `cguAccepted: z.literal(true)` rejette toute valeur falsy. Le checkbox client est UX, le serveur tranche. |
| **Race UI : double-submit accept-invite** | LOW | `form.formState.isSubmitting` désactive button + RHF debounce naturel. Côté serveur (PLAN-3 §3.4) UPDATE `drivers.profile_id` clause `.is('profile_id', null)` idempotent. |

ASVS L1 V2.2 (passwords), V3.1 (session), V14.4 (HTTP headers — à confirmer config Next) : conforme avec note headers à valider.

## Verification

- `pnpm typecheck` vert (RHF + zodResolver bien typés, types `AcceptInvitationInput` exporté).
- `pnpm lint` vert.
- `pnpm build` (Next prod build) vert : aucune erreur SSR/CSR sur les 4 pages auth.
- Manuel sur preview Vercel :
  - `/login` : capture publiable (AuthShell mode jour + DemoCredentials visible).
  - Click card « Chauffeur » → champs prefilled → Se connecter → redirect `/conduite`.
  - `/admin/chauffeurs` (login dirigeant démo) → créer fiche driver test → Inviter → email reçu Inbucket → click → `/accept-invite` avec email read-only + form mot de passe.
  - Submit form valide → redirect `/conduite` + toast success.
  - `/accept-invite?error=expired` → panneau erreur sans form.
- Mobile iPhone SE 375 px : layout single column lisible, boutons accessibles.

## Success criteria (extrait des 11 SC phase)

Couvre :
- SC #2 (chauffeur clique magic link → `/accept-invite` email pré-rempli)
- SC #3 (saisie password + confirm + CGU → submit)
- SC #5 (redirect `/conduite` + toast success)
- SC #6 (`/login` refondue AuthShell mode jour, capture publiable)
- SC #7 (DemoCredentials cards cliquables, prefill fonctionnel)
- SC #8 (token expiré → panneau erreur dédié, aucun form)

## Output

Note dans `04-SUMMARY.md` final § PLAN-4 : structure AuthShell, premier
RHF du repo, lift state up pattern DemoCredentials, headers sécurité
à valider Phase 04.5.
