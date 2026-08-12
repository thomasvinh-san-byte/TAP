-- =============================================================================
-- Migration — Messagerie interne, fil général hors course (§5.22 lot A)
-- =============================================================================
-- Un fil de discussion GÉNÉRAL régulateur ↔ chauffeurs, NON rattaché à une
-- course (le chat à la course reste `internal_message`, inchangé).
--
-- Choix de modèle — table DÉDIÉE plutôt que `ride_id` nullable sur
-- `internal_message` :
--   - les filtres Realtime Supabase ne supportent que `eq`/`in`/comparaisons,
--     jamais `is null` : impossible de s'abonner proprement à « ride_id IS NULL »
--     pour isoler le fil général ;
--   - filtrer le fil général par `organization_id` sur `internal_message`
--     ferait remonter TOUS les messages de course de l'org dans le fil général
--     (classe du bug Supabase #1721 : un canal reçoit les payloads d'un autre) ;
--   - une table dédiée a son propre canal `internal_general_message:{org}`
--     filtré `organization_id=eq.{org}` — seulement le fil général, aucun
--     mélange, ZÉRO régression sur le chat à la course.
--   Le §5.22 lot A autorise explicitement « table dédiée si plus propre ».
--
-- Mêmes invariants que `internal_message` : RLS org-scoped stricte, messages
-- IMMUABLES (pas d'UPDATE/DELETE), sender dénormalisé, publication Realtime,
-- archivage 1 an (purge étendue plus bas). Texte uniquement au lot A ; la photo
-- (lot C) sur le fil général est un suivi (le socle Storage est déjà là).
-- =============================================================================

create table public.internal_general_message (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.internal_general_message is
  'Messagerie interne (CdC §5.22 lot A) — fil général régulateur↔chauffeurs hors course. Un fil par organisation. Messages immuables. Table dédiée (isolation Realtime, cf. migration).';

-- Index fil chronologique + colonne de policy RLS (organization_id).
create index internal_general_message_org_created_idx
  on public.internal_general_message (organization_id, created_at);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.internal_general_message enable row level security;
alter table public.internal_general_message force row level security;

-- SELECT : tout membre de l'organisation voit le fil général (régulateur,
-- dirigeant, chauffeur — le fil est commun à l'org, c'est sa raison d'être).
create policy internal_general_message_select on public.internal_general_message
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : même org, auteur = soi (anti-usurpation), rôle cohérent.
create policy internal_general_message_insert on public.internal_general_message
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and sender_profile_id = auth.uid()
    and sender_role = public.current_user_role()
  );
-- Pas de policy UPDATE/DELETE : messages immuables (cohérent avec internal_message).

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.internal_general_message from anon;
grant select, insert on public.internal_general_message to authenticated;

-- =============================================================================
-- Publication Realtime (idempotent, même garde que internal_message)
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not (select puballtables from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'internal_general_message'
       )
    then
      alter publication supabase_realtime add table public.internal_general_message;
    end if;
  end if;
end
$$;

-- =============================================================================
-- Archivage 1 an — étend purge_internal_messages() au fil général (§5.22)
-- =============================================================================
-- Cohérent avec l'existant (MESSAGERIE-01) : la purge mensuelle pg_cron déjà
-- planifiée appelle cette fonction ; on ajoute simplement le fil général.
create or replace function public.purge_internal_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.internal_message
  where created_at < now() - interval '1 year';
  delete from public.internal_general_message
  where created_at < now() - interval '1 year';
$$;

comment on function public.purge_internal_messages() is
  'MESSAGERIE-01 (§5.22) : purge des messages internes > 1 an (chat course + fil général). Executee mensuellement par pg_cron.';
