---
phase: 04-onboarding-chauffeur-authshell
plan: 3
wave: 2
order_in_wave: 1
depends_on: [2]
files_modified:
  - packages/shared/src/schemas/driver-invitation.ts
  - packages/shared/src/index.ts
  - apps/web/src/app/(admin)/admin/chauffeurs/actions.ts
  - apps/web/src/app/(auth)/accept-invite/actions.ts
autonomous: true
requirements:
  - CHAUF-01
  - CHAUF-02
  - CHAUF-04
  - NFR-006
estimated_minutes: 75
covers_constraints:
  - C02
  - C03
  - C04 (partiel — acceptInvitationAction)
---

# PLAN-3 — Server Actions invitation (inviteDriverAction + resendInvitationAction + acceptInvitationAction)

## Objectif

Implémenter les **3 Server Actions** du workflow d'invitation et leur
schéma Zod dédié (DEC-026) :

1. `inviteDriverAction(email, driverId)` — déclenchée par bouton
   « Inviter » dans la liste drivers (C02).
2. `resendInvitationAction(invitationId)` — relance email perdu (C03).
3. `acceptInvitationAction(formData)` — submit de `/accept-invite`
   (partie code de C04, la page UI étant traitée PLAN-4).

Tous les patterns respectent CLAUDE.md § 10 (zod → guard → mutation
→ audit (trigger BDD) → revalidatePath) et § 7 (validation runtime
zod côté serveur, types via `z.infer`).

## Files modified

- `packages/shared/src/schemas/driver-invitation.ts` — nouveau schéma Zod (à créer)
- `packages/shared/src/index.ts` — export `driverInvitationSchema`, `acceptInvitationSchema`, types inférés
- `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` — extension : `inviteDriverAction` + `resendInvitationAction`
- `apps/web/src/app/(auth)/accept-invite/actions.ts` — nouveau fichier : `acceptInvitationAction`

## Tasks

### 3.1 Schéma Zod `driverInvitationSchema` + `acceptInvitationSchema`

Fichier `packages/shared/src/schemas/driver-invitation.ts` :

```ts
import { z } from 'zod';

// Invitation côté dirigeant (PLAN-3 §3.2 inviteDriverAction)
export const driverInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Adresse e-mail invalide.' })
    .max(254, { message: 'Adresse e-mail trop longue.' }),
  driverId: z.string().uuid({ message: 'Identifiant chauffeur invalide.' }),
});
export type DriverInvitationInput = z.infer<typeof driverInvitationSchema>;

// Acceptation côté chauffeur (PLAN-3 §3.4 acceptInvitationAction)
// NB: pas de complexity rule mot de passe (NIST 2020+ — longueur seule).
export const acceptInvitationSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: 'Mot de passe trop court (8 caractères minimum).' })
      .max(128, { message: 'Mot de passe trop long.' }),
    confirmPassword: z.string(),
    cguAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Vous devez accepter les CGU pour continuer.' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
```

Re-exporter dans `packages/shared/src/index.ts` :

```ts
export {
  driverInvitationSchema,
  acceptInvitationSchema,
  type DriverInvitationInput,
  type AcceptInvitationInput,
} from './schemas/driver-invitation';
```

### 3.2 `inviteDriverAction(email, driverId)` — C02

Étendre `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts`. Garder
les fonctions existantes intactes. Ajouter :

```ts
import { driverInvitationSchema } from '@tap/shared';

export async function inviteDriverAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Guard
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  // 2. Validation zod
  const parsed = driverInvitationSchema.safeParse({
    email: formData.get('email'),
    driverId: formData.get('driverId'),
  });
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }
  const { email, driverId } = parsed.data;

  // 3. Check email pas déjà utilisé par un autre rôle
  //    (auth.admin.listUsers ou table profiles selon ce qui existe — pattern :
  //    un email = un user max. Si trouvé → refus clair.)
  const { data: existingUsers } =
    await ctx.supabaseAdmin.auth.admin.listUsers();
  const collision = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email,
  );
  if (collision) {
    return { error: 'Cet email est déjà utilisé pour un autre rôle.' };
  }

  // 4. Vérifier que driver existe + appartient à org du dirigeant +
  //    n'est pas déjà rattaché à un profile_id
  const { data: driver } = await ctx.supabase
    .from('drivers' as never)
    .select('id, profile_id, archive')
    .eq('id', driverId)
    .maybeSingle();
  if (!driver) return { error: 'Chauffeur introuvable.' };
  if ((driver as { archive: boolean }).archive) return { error: 'Chauffeur archivé.' };
  if ((driver as { profile_id: string | null }).profile_id) {
    return { error: 'Ce chauffeur a déjà un compte actif.' };
  }

  // 5. Appel Supabase Auth : magic link invitation
  const origin = (await import('next/headers')).headers().get('origin')
    ?? process.env.NEXT_PUBLIC_APP_URL!;
  const { error: inviteErr } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { role: 'chauffeur', driver_id: driverId, organization_id: ctx.organizationId },
      redirectTo: `${origin}/accept-invite`,
    },
  );
  if (inviteErr) {
    // Rate limit Supabase 3 emails/h défaut
    if (inviteErr.message?.includes('rate') || inviteErr.status === 429) {
      return {
        error: 'Email non envoyé (limite atteinte, ré-essayer dans 1h ou contacter support).',
      };
    }
    return { error: 'Envoi de l\'invitation impossible.' };
  }

  // 6. INSERT driver_invitations
  const { data: invitation, error: insertErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .insert({
      organization_id: ctx.organizationId,
      driver_id: driverId,
      invited_by: ctx.userId,
      email,
      role: 'chauffeur',
      status: 'pending',
    } as never)
    .select('id')
    .single();

  if (insertErr || !invitation) {
    // Cas index unique pending : invitation déjà en cours
    if (insertErr?.code === '23505') {
      return { error: 'Une invitation est déjà en cours pour cet email.' };
    }
    return { error: 'Enregistrement de l\'invitation impossible.' };
  }
  // (trigger audit_logs émet driver_invited automatiquement, PLAN-2 §2.1.5)

  // 7. Revalidate
  revalidatePath('/admin/chauffeurs');

  return { success: true, id: (invitation as { id: string }).id };
}
```

**Pré-requis client supabaseAdmin** : `ctx.supabaseAdmin` doit exister
côté `getAuthContext()`. Vérifier dans
`apps/web/src/lib/auth/get-auth-context.ts` : si le helper expose déjà
un client `service_role`, l'utiliser ; sinon créer un client admin
local scopé à cette action via `createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })`,
**uniquement côté serveur** (jamais exposé client).

### 3.3 `resendInvitationAction(invitationId)` — C03

Toujours dans `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` :

```ts
export async function resendInvitationAction(
  invitationId: string,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(invitationId).success) {
    return { error: 'Identifiant invitation invalide.' };
  }
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  // 1. Fetch invitation + check ownership + statut
  const { data: invitation } = await ctx.supabase
    .from('driver_invitations' as never)
    .select('id, email, status, invited_by, expires_at')
    .eq('id', invitationId)
    .eq('invited_by', ctx.userId)
    .maybeSingle();
  if (!invitation) return { error: 'Invitation introuvable.' };

  const inv = invitation as {
    id: string;
    email: string;
    status: string;
    expires_at: string;
  };
  if (inv.status !== 'pending') {
    return { error: 'Cette invitation n\'est plus en attente.' };
  }

  // 2. Anti race : refuser un resend si expires_at - now() > 23h59m
  //    (le dirigeant vient juste de cliquer Inviter, double-click protection)
  const remainingMs = new Date(inv.expires_at).getTime() - Date.now();
  if (remainingMs > 23 * 60 * 60 * 1000 + 59 * 60 * 1000) {
    return { error: 'Invitation envoyée à l\'instant. Patientez quelques minutes avant relance.' };
  }

  // 3. Re-call inviteUserByEmail (Supabase regen token)
  const origin = (await import('next/headers')).headers().get('origin')
    ?? process.env.NEXT_PUBLIC_APP_URL!;
  const { error: resendErr } =
    await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: `${origin}/accept-invite`,
    });
  if (resendErr) {
    if (resendErr.status === 429) {
      return { error: 'Email non envoyé (limite atteinte, ré-essayer dans 1h).' };
    }
    return { error: 'Renvoi de l\'invitation impossible.' };
  }

  // 4. Bump expires_at + trigger émet driver_invitation_resent
  const { error: updErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .update({ expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() } as never)
    .eq('id', invitationId);
  if (updErr) return { error: 'Mise à jour invitation impossible.' };

  revalidatePath('/admin/chauffeurs');
  return { success: true, id: invitationId };
}
```

### 3.4 `acceptInvitationAction(formData)` — partie C04

Nouveau fichier `apps/web/src/app/(auth)/accept-invite/actions.ts` :

```ts
'use server';

import { redirect } from 'next/navigation';
import { acceptInvitationSchema } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type AcceptState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function acceptInvitationAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  // 0. Session active (créée par /accept-invite GET via verifyOtp, PLAN-4 §4.3)
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Demandez un nouveau lien.' };

  // 1. Validation zod
  const parsed = acceptInvitationSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    cguAccepted: formData.get('cguAccepted') === 'on',
  });
  if (!parsed.success) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (v && v[0]) flat[k] = v[0];
    }
    return { error: 'Vérifiez les champs.', fieldErrors: flat };
  }

  // 2. Retrouver l'invitation pending matchée sur email de l'user actuel
  const userEmail = ctx.user?.email?.toLowerCase();
  if (!userEmail) return { error: 'Email du compte introuvable.' };

  const { data: invitation } = await ctx.supabase
    .from('driver_invitations' as never)
    .select('id, driver_id, status, expires_at, organization_id')
    .eq('email', userEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!invitation) return { error: 'Aucune invitation valide pour ce compte.' };

  const inv = invitation as {
    id: string;
    driver_id: string;
    status: string;
    expires_at: string;
    organization_id: string;
  };
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return { error: 'Lien d\'invitation expiré. Demandez un nouveau lien à votre régulateur.' };
  }

  // 3. Update password (Supabase Auth)
  const { error: pwErr } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (pwErr) return { error: 'Définition du mot de passe impossible.' };

  // 4. UPDATE driver_invitations.status='accepted' + accepted_at
  //    (trigger émet driver_invitation_accepted)
  const { error: invErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .update({ status: 'accepted', accepted_at: new Date().toISOString() } as never)
    .eq('id', inv.id);
  if (invErr) return { error: 'Validation de l\'invitation impossible.' };

  // 5. UPDATE drivers.profile_id = auth.uid()
  const { error: dErr } = await ctx.supabase
    .from('drivers' as never)
    .update({ profile_id: ctx.userId } as never)
    .eq('id', inv.driver_id)
    .is('profile_id', null);  // double check : pas déjà rattaché
  if (dErr) return { error: 'Rattachement du compte chauffeur impossible.' };

  // 6. Log applicatif cgu_accepted_via_invitation (DEC-027, NON émis par trigger)
  await ctx.supabase.from('audit_logs' as never).insert({
    organization_id: inv.organization_id,
    actor_id: ctx.userId,
    actor_role: 'chauffeur',
    action: 'cgu_accepted_via_invitation',
    entity_type: 'driver',
    entity_id: inv.driver_id,
    metadata: {
      invitation_id: inv.id,
      cgu_version: process.env.NEXT_PUBLIC_CGU_VERSION ?? 'v1.0',
    },
  } as never);

  // 7. Redirect chauffeur landing avec flag toast success (FLAG #1 plan-checker)
  //    Le toast Sonner "Compte activé. Bienvenue…" (UI-SPEC § 7.8) est déclenché
  //    côté client par /conduite/page.tsx au mount via lecture searchParams.
  revalidatePath('/conduite');
  redirect('/conduite?activated=1');
}
```

**Toast success côté `/conduite`** : la page chauffeur `/conduite/page.tsx` doit lire `searchParams.activated === '1'` et déclencher `toast.success('Compte activé. Bienvenue dans l\\'application chauffeur.')` au mount (via un Client Component wrapper qui consomme `useSearchParams()` + `useEffect` une fois). Pattern documenté dans PLAN-4 §4.5 (forme côté form) + PLAN-4 nouveau §4.5bis (consommation côté `/conduite`). Cf. UI-SPEC § 7.8 success state.

### 3.5 Commit unique

Message :

```
feat(04): server actions invitation chauffeur (C02 + C03 + acceptInvitationAction)

- @tap/shared : driverInvitationSchema + acceptInvitationSchema Zod (DEC-026)
- inviteDriverAction (admin/chauffeurs/actions.ts) :
    guard dirigeant → zod → check email collision rôle → check driver
    org+actif+pas déjà rattaché → supabase.auth.admin.inviteUserByEmail
    → INSERT driver_invitations → rate limit handling (3/h Supabase défaut)
- resendInvitationAction : check ownership + status='pending' + anti-race
  23h59 + re-inviteUserByEmail + bump expires_at
- acceptInvitationAction (accept-invite/actions.ts) :
    validation zod (password ≥ 8 + confirmPassword match + CGU obligatoire)
    → updateUser password → UPDATE invitation accepted → UPDATE drivers
    profile_id rattaché → audit_logs cgu_accepted_via_invitation
    → redirect /conduite

Réfs : Phase 04 § PLAN-3, DEC-024..028, C02, C03, C04 (partiel).
```

## Traçabilité contraintes

| Contrainte | Traitement dans ce plan |
|---|---|
| **C02** (`inviteDriverAction` Server Action, 8 étapes, gestion rate limit) | PLAN-3 §3.2 (8 étapes fidèlement implémentées : guard / zod / collision email / check driver / inviteUserByEmail / INSERT / revalidate / return) |
| **C03** (`resendInvitationAction` Server Action) | PLAN-3 §3.3 (guard ownership + status pending + anti-race 23h59 + re-invite + bump expires_at) |
| **C04** (acceptInvitationAction part — page UI = PLAN-4) | PLAN-3 §3.4 (logique 6 étapes : session check / zod / fetch invitation / updateUser pw / UPDATE invitation+drivers / audit applicatif CGU / redirect) |
| **DEC-026** (`driverInvitationSchema` séparé) | PLAN-3 §3.1 (schéma `packages/shared/src/schemas/driver-invitation.ts` séparé de `driverInputSchema`) |
| **DEC-027** (CGU obligatoire + audit log applicatif) | PLAN-3 §3.1 (Zod `cguAccepted: z.literal(true)`) + §3.4 step 6 (INSERT `audit_logs` type `cgu_accepted_via_invitation` avec version CGU) |

## Threat model

ASVS L1 + auth invariants :

| Threat | Risk | Mitigation |
|---|---|---|
| **Email enumeration via collision check** (attaquant scrape les emails déjà utilisés) | MEDIUM | Le check `auth.admin.listUsers` n'est appelé QUE par dirigeant authentifié (guard `requireDirigeant`). Pas de surface publique. RGPD : un dirigeant a déjà accès aux emails de son org via UI. |
| **Privilege escalation via metadata Supabase** (chauffeur modifie son rôle dans `user_metadata`) | HIGH | Le `data: { role: 'chauffeur', ... }` est passé à `auth.admin.inviteUserByEmail` côté serveur (service_role key, jamais exposée client). User metadata Supabase n'est pas le canal de vérité du rôle : c'est `public.profiles.role` (RLS-protégé) qui pilote `has_role()`. Le rattachement effectif du rôle est fait via DB trigger ou par dirigeant ailleurs (hors scope ici). |
| **Mass invitation spam** (dirigeant compromis envoie 1000 invitations) | MEDIUM | Rate limit Supabase 3 emails/h défaut bloque déjà. Audit logs trace chaque `driver_invited`. Aucune action server-side supplémentaire — V2 SMTP custom pourra ajouter throttling fin (reporté Phase 06+). |
| **Token URL leak via referer / browser history** | LOW | Trade-off accepté Q6.2. Token usage unique 24h, après acceptation → status='accepted', UPDATE policy refuse `status='pending'`. |
| **CSRF sur Server Actions** | LOW | Next.js 14 App Router protège nativement (origin check + same-origin policy). |
| **Race condition on accept** (chauffeur clique 2× submit pendant requête) | LOW | UPDATE `drivers.profile_id` clause `.is('profile_id', null)` : la 2ᵉ requête trouve 0 rows et ne fait rien. UPDATE invitation clause `status='pending'` (via policy) : idem, idempotent. |
| **Service role key fuite client** | CRITICAL | `supabaseAdmin` instancié `'use server'` uniquement. Jamais importé côté Client Component. Vérifier `apps/web/src/lib/auth/get-auth-context.ts` n'exporte rien qui finisse dans un bundle client. |
| **CGU consent forgery** (chauffeur soumet sans cocher) | MEDIUM (RGPD) | Zod `z.literal(true)` côté serveur — un missing/false fait échouer `safeParse`. La case côté Client est en plus un garde-fou UX. Audit log applicatif `cgu_accepted_via_invitation` avec version CGU + timestamp serveur. |

ASVS L1 V2.1.1 (auth flow), V8.3.4 (audit logging RGPD), V10.3.1 (least privilege) : conforme.

## Verification

- `pnpm typecheck` vert (les schémas zod re-exportés ne cassent rien).
- `pnpm lint` vert (Server Actions conformes pattern existant).
- Test manuel via preview Vercel après merge :
  - Login dirigeant démo → `/admin/chauffeurs` → créer driver test
    « Chauffeur test » → bouton Inviter avec `chauffeur-test@example.com` → toast
    success.
  - Vérifier dans Inbucket (préview) qu'un email est reçu.
  - Vérifier en BDD via MCP Supabase :
    `select status, expires_at from driver_invitations
     order by created_at desc limit 1;` → `pending`, 24h plus tard.

## Success criteria (extrait des 11 SC phase)

Couvre la mécanique de :
- SC #1 (dirigeant click Inviter → email délivré)
- SC #4 (audit_logs 4 events INSERT cohérents — 1 par trigger
  `driver_invited`, 1 par trigger `driver_invitation_accepted`,
  1 applicatif `cgu_accepted_via_invitation`, 1 implicite Supabase
  pour password update)
- SC #9 (email déjà utilisé autre rôle → refus clair AVANT envoi email)

UI/UX et navigation : PLAN-4.

## Output

Note dans `04-SUMMARY.md` final § PLAN-3 : nombre d'actions exposées,
patterns spéciaux (anti-race resend, audit applicatif CGU), risques
explicitement traités.
