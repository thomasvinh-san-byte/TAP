-- Migration : élargissement permissions chauffeurs au régulateur
--
-- Hotfix Phase 04 (DEC-029) : la gestion opérationnelle des chauffeurs
-- (CRUD + invitation) doit être accessible au rôle 'regulateur', pas
-- uniquement 'dirigeant'. Le métier réel taxi conventionné 974 = la
-- régulatrice gère l'onboarding quotidien (embauche, invitation,
-- modification, archivage). Dirigeant maintient son accès (élargissement,
-- pas transfert).
--
-- Modifie 4 policies RLS sur public.drivers + public.driver_invitations.
-- Ajoute aussi la colonne archive_motif sur drivers pour la confirmation
-- renforcée d'archivage (UX option C — modal motif obligatoire +
-- saisie "ARCHIVER").
--
-- Refs : DEC-029, hotfix permissions chauffeurs régulateur.

------------------------------------------------------------
-- Section 1 — public.drivers : élargir INSERT + UPDATE
------------------------------------------------------------

drop policy if exists drivers_insert_dirigeant on public.drivers;
drop policy if exists drivers_update_dirigeant on public.drivers;

create policy drivers_insert_admin_or_regulateur on public.drivers
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

create policy drivers_update_admin_or_regulateur on public.drivers
  for update
  to authenticated
  using (organization_id = public.current_organization_id())
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
  );

------------------------------------------------------------
-- Section 2 — public.driver_invitations : élargir INSERT + UPDATE
------------------------------------------------------------

drop policy if exists driver_invitations_insert_dirigeant on public.driver_invitations;
drop policy if exists driver_invitations_update_recipient_or_dirigeant on public.driver_invitations;

create policy driver_invitations_insert_admin_or_regulateur on public.driver_invitations
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('dirigeant'::public.user_role)
      or public.has_role('regulateur'::public.user_role)
    )
    and auth.uid() = invited_by
  );

-- UPDATE — 2 cas distincts factorisés :
--   a) destinataire pendant validité (acceptation par le chauffeur invité)
--   b) émetteur dirigeant OR régulateur (revoke / resend → expires_at refresh)
create policy driver_invitations_update_recipient_or_admin_or_regulateur on public.driver_invitations
  for update
  to authenticated
  using (
    (
      email = (select u.email from auth.users u where u.id = auth.uid())
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
  with check (organization_id = public.current_organization_id());

------------------------------------------------------------
-- Section 3 — drivers.archive_motif (confirmation renforcée UX option C)
------------------------------------------------------------

alter table public.drivers
  add column if not exists archive_motif text
    check (archive_motif is null or length(trim(archive_motif)) between 10 and 500);

comment on column public.drivers.archive_motif is
  'Motif libre saisi à l''archivage (DEC-029 confirmation renforcée). '
  'NULL tant que le driver n''est pas archivé. Min 10 / Max 500 chars.';
