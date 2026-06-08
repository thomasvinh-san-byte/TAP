-- =============================================================================
-- Migration 06.41 — Messagerie interne, lot 1 : chat texte à la course (§5.22)
-- =============================================================================
-- Chat temps réel régulateur ↔ chauffeur RATTACHÉ À UNE COURSE (DEC-120).
--
-- Modèle (cadrage GSD validé) :
--   - Table UNIQUE `internal_message(ride_id, ...)` — la course EST la
--     conversation. Pas de table conversation séparée (évite le bug Supabase
--     #1721 : payloads Realtime mélangés quand 2 tables partagent un channel).
--   - Texte uniquement au lot 1. Photo (Q2) repoussée au stockage HDS,
--     push web (Q3) et fil général repoussés (registre des travaux repoussés).
--   - `sender_role` dénormalisé pour l'affichage (bulle + libellé auteur)
--     sans jointure profiles à chaque message.
--   - Messages IMMUABLES : pas d'UPDATE/DELETE (ni policy, ni grant). Édition
--     et purge 1 an (pg_cron) hors périmètre lot 1.
--
-- RLS stricte multi-tenant + par rôle, INDEXÉE (la RLS filtre aussi la
-- réception Realtime ; sans index sur les colonnes de policy → latence du
-- 1er message) :
--   - SELECT : same_org ET (régulateur/dirigeant voient toute conversation de
--     l'org ; chauffeur voit UNIQUEMENT ses courses via drivers.profile_id).
--   - INSERT : same_org, sender_profile_id = auth.uid() (anti-usurpation),
--     sender_role = current_user_role(), et un chauffeur n'écrit que sur SES
--     courses (même prédicat que rides_update_chauffeur_own_rides).
--
-- Pas de trigger audit : la table est elle-même append-only et horodatée
-- (trace native immuable). Inutile de dupliquer dans audit_logs au lot 1.
-- =============================================================================

create table public.internal_message (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.user_role not null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.internal_message is
  'Messagerie interne (CdC §5.22) lot 1 — chat texte régulateur↔chauffeur rattaché à une course. La course EST la conversation. Messages immuables (pas d''UPDATE/DELETE). Photo/push/fil général repoussés.';

-- Index fil chronologique + colonne de policy RLS (ride_id).
create index internal_message_ride_created_idx
  on public.internal_message (ride_id, created_at);

-- Index multi-tenant (colonne de policy RLS).
create index internal_message_organization_id_idx
  on public.internal_message (organization_id);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.internal_message enable row level security;
alter table public.internal_message force row level security;

-- SELECT : même org ; régul/dirigeant voient tout l'org, chauffeur seulement
-- les conversations de SES courses (pattern rides_update_chauffeur_own_rides).
create policy internal_message_select on public.internal_message
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select r.id
          from public.rides r
          where r.driver_id in (
            select d.id
            from public.drivers d
            where d.profile_id = auth.uid()
              and d.archive = false
          )
        )
      )
    )
  );

-- INSERT : même org, auteur = soi (anti-usurpation), rôle cohérent ; un
-- chauffeur ne peut écrire que sur SES courses.
create policy internal_message_insert on public.internal_message
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and sender_profile_id = auth.uid()
    and sender_role = public.current_user_role()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select r.id
          from public.rides r
          where r.driver_id in (
            select d.id
            from public.drivers d
            where d.profile_id = auth.uid()
              and d.archive = false
          )
        )
      )
    )
  );
-- Pas de policy UPDATE/DELETE : messages immuables au lot 1.

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.internal_message from anon;
grant select, insert on public.internal_message to authenticated;

-- =============================================================================
-- Publication Realtime
-- =============================================================================
-- Canonique : ALTER publication supabase_realtime ADD TABLE public.internal_message
-- Exécuté de façon idempotente et sûre : on n'ajoute la table que si la
-- publication existe, n'est pas « FOR ALL TABLES » et ne contient pas déjà la
-- table (évite l'échec en CI reset comme en cloud où rides a été ajouté via
-- le dashboard).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not (select puballtables from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'internal_message'
       )
    then
      alter publication supabase_realtime add table public.internal_message;
    end if;
  end if;
end
$$;
