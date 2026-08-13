-- =============================================================================
-- Migration sécurité/robustesse — driver_invitations : email destinataire via JWT
-- =============================================================================
-- Les policies SELECT et UPDATE « destinataire » de driver_invitations
-- (20260514000002) identifiaient l'invité par
--   `email = (select u.email from auth.users u where u.id = auth.uid())`.
-- Lire la TABLE `auth.users` exige un privilège que le rôle `authenticated` n'a
-- pas → « permission denied for table users » : le flux invité (voir / accepter
-- son invitation) était CASSÉ en production, et la RLS échouait aux tests.
--
-- Correctif standard Supabase : comparer à l'email du JWT via
-- `auth.jwt() ->> 'email'` (fonction SECURITY DEFINER, aucun accès table requis).
-- Même sémantique de sécurité (l'email du JWT est celui de l'utilisateur
-- authentifié), sans lecture de `auth.users`. ALTER POLICY ne touche que le
-- USING ; les WITH CHECK existants sont conservés.
-- =============================================================================

alter policy driver_invitations_select_invited_or_recipient
  on public.driver_invitations
  using (
    auth.uid() = invited_by
    or email = (auth.jwt() ->> 'email')
  );

alter policy driver_invitations_update_recipient_or_dirigeant
  on public.driver_invitations
  using (
    (
      email = (auth.jwt() ->> 'email')
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and public.has_role('dirigeant'::public.user_role)
    )
  );
