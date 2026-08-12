-- =============================================================================
-- Migration — messagerie interne lot 2 (§5.22) : état de lecture + non-lus
-- =============================================================================
-- Ajoute la notion de « non-lu » au chat à la course (`internal_message`), qui
-- n'en avait aucune. Read-state PAR UTILISATEUR et PAR FIL (course) : une ligne
-- `(profile_id, ride_id)` porte l'horodatage du dernier message lu.
--
-- RLS stricte : un utilisateur ne voit / n'écrit QUE ses propres lignes de
-- lecture, dans son organisation (aucune fuite cross-tenant, read-state privé).
--
-- Le compteur de non-lus est exposé par une RPC SECURITY INVOKER : la RLS de
-- `internal_message` (org + rôle : le chauffeur ne voit que ses courses) et
-- celle de `internal_message_read` s'appliquent → le compte est exact et
-- cloisonné, sans logique de visibilité dupliquée côté applicatif.
-- =============================================================================

create table public.internal_message_read (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, ride_id)
);

comment on table public.internal_message_read is
  'Etat de lecture messagerie interne (§5.22 lot 2) : dernier message lu par (utilisateur, course). Prive et org-scoped. Sert au compteur de non-lus.';

create index internal_message_read_org_idx on public.internal_message_read (organization_id);

alter table public.internal_message_read enable row level security;
alter table public.internal_message_read force row level security;

-- Lecture / écriture RÉSERVÉES à ses propres lignes (read-state privé), même org.
create policy internal_message_read_select on public.internal_message_read
  for select to authenticated
  using (profile_id = auth.uid() and organization_id = public.current_organization_id());

create policy internal_message_read_insert on public.internal_message_read
  for insert to authenticated
  with check (profile_id = auth.uid() and organization_id = public.current_organization_id());

create policy internal_message_read_update on public.internal_message_read
  for update to authenticated
  using (profile_id = auth.uid() and organization_id = public.current_organization_id())
  with check (profile_id = auth.uid() and organization_id = public.current_organization_id());
-- Pas de DELETE : le read-state se met à jour (upsert), il ne se supprime pas.

revoke all on public.internal_message_read from anon;
grant select, insert, update on public.internal_message_read to authenticated;

-- =============================================================================
-- RPC compteur de non-lus (SECURITY INVOKER → RLS des 2 tables appliquée)
-- =============================================================================
-- Compte les messages VISIBLES par l'appelant (RLS internal_message), émis par
-- QUELQU'UN D'AUTRE, plus récents que son dernier passage sur le fil (ou jamais
-- lus). Un LEFT JOIN sur le read-state (lui aussi RLS-filtré à ses lignes).
create or replace function public.count_unread_messages()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int
  from public.internal_message m
  left join public.internal_message_read rd
    on rd.ride_id = m.ride_id and rd.profile_id = auth.uid()
  where m.sender_profile_id <> auth.uid()
    and (rd.last_read_at is null or m.created_at > rd.last_read_at);
$$;

comment on function public.count_unread_messages() is
  'Compteur de messages non lus de l''utilisateur courant (§5.22 lot 2). SECURITY INVOKER : RLS internal_message (org+role) et internal_message_read appliquees.';

revoke all on function public.count_unread_messages() from anon;
grant execute on function public.count_unread_messages() to authenticated;
