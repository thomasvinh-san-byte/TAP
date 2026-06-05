/**
 * `/accept-invite` — page d'activation compte chauffeur (C04, Server Component).
 *
 * Flux :
 *   1. Route Handler GET (`route.ts`) reçoit `?token_hash=...&type=invite`,
 *      appelle `verifyOtp` → crée la session puis redirige vers cette page
 *      sans paramètres (succès) OU vers `?error=expired|invalid_link` (échec).
 *   2. Cette page lit `searchParams.error` :
 *      - présent → render <InvitationErrorPanel>
 *      - absent → vérifier session active (`supabase.auth.getUser()`) puis
 *        render <AcceptInviteForm userEmail={...}>
 *
 * NB : on n'utilise PAS `getAuthContext()` ici — l'invité vient juste de
 * faire `verifyOtp`, son `profile_id` n'est pas encore créé/rattaché
 * (rattachement = étape 6 de `acceptInvitationAction` au submit). `getUser()`
 * direct sur le client Supabase server-side suffit (session SSR + cookie).
 */

import { AuthShell } from '../_components/auth-shell';
import { AcceptInviteForm } from './_components/accept-invite-form.client';
import { InvitationErrorPanel } from './_components/invitation-error-panel';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Activer mon compte',
};
export const dynamic = 'force-dynamic';

export default async function AcceptInvitePage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  // Erreur transmise par Route Handler (token invalide ou expiré)
  if (searchParams.error === 'expired' || searchParams.error === 'invalid_link') {
    return (
      <AuthShell title="Activer mon compte">
        <InvitationErrorPanel
          message={
            searchParams.error === 'expired'
              ? "Lien d'invitation expiré. Demandez un nouveau lien à votre régulateur."
              : "Lien d'invitation invalide ou déjà utilisé."
          }
        />
      </AuthShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    // Pas de session valide (accès direct sans passer par le Route Handler GET)
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
      <AcceptInviteForm userEmail={user.email} />
    </AuthShell>
  );
}
