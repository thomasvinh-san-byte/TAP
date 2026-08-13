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

-- La policy UPDATE a été renommée/élargie au régulateur par 20260516000001
-- (driver_invitations_update_recipient_or_admin_or_regulateur). On change la
-- clause email du destinataire (USING) ; la clause émetteur (dirigeant OU
-- régulateur) est conservée à l'identique.
--
-- WITH CHECK : la version d'origine exigeait `organization_id =
-- current_organization_id()`. Or le destinataire d'une invitation N'A PAS ENCORE
-- d'organisation (ni profil ni rôle : il l'accepte pour REJOINDRE) →
-- current_organization_id() est NULL → l'acceptation (pending → accepted) était
-- refusée (42501). Le flux d'acceptation invité était donc CASSÉ, en
-- contradiction avec la clause destinataire du USING. On autorise la nouvelle
-- ligne quand elle correspond à l'email du destinataire (borné : le USING ne
-- laisse le destinataire agir que sur SA propre invitation pending non expirée).
alter policy driver_invitations_update_recipient_or_admin_or_regulateur
  on public.driver_invitations
  using (
    (
      email = (auth.jwt() ->> 'email')
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and (
        public.has_role('dirigeant'::public.user_role)
        or public.has_role('regulateur'::public.user_role)
      )
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    or email = (auth.jwt() ->> 'email')
  );
