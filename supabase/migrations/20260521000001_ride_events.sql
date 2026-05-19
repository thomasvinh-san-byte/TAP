-- Phase 05 Wave 6 — Table ride_events (alertes opérationnelles)
-- Trou identifié PLAN-2 Wave 2 (PR #125 cockpit fallback [] silencieux car
-- table absente) + prérequis Wave 6 workflow patient absent
-- (INSERT type 'patient_no_show' depuis Route Handler PWA).
--
-- Types d'événements V1.5 :
--   - patient_no_show : chauffeur déclare patient absent (Wave 6)
--   - sms_failed     : webhook Twilio status failed/undelivered (Wave 5)
--   - ride_delayed   : informatif (Phase 06+ heuristique)
--
-- Réf : PLAN-6 lignes 446-458, DEC-053 endpoint cohérent DEC-045,
-- UI-SPEC Surface 5 cockpit alerte slide-in.

create table public.ride_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  event_type text not null check (event_type in (
    'patient_no_show',
    'sms_failed',
    'ride_delayed'
  )),
  payload jsonb null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index ride_events_organization_id_idx on public.ride_events (organization_id);
create index ride_events_ride_id_idx on public.ride_events (ride_id);
create index ride_events_event_type_idx on public.ride_events (event_type);
create index ride_events_created_at_desc_idx on public.ride_events (created_at desc);

alter table public.ride_events enable row level security;

-- SELECT : tous les membres de l'organisation (régulateur + dirigeant +
-- chauffeur). La restriction chauffeur côté lecture est laxiste V1.5 :
-- les chauffeurs n'ont aujourd'hui pas d'UI consommant ride_events
-- (Phase 06+ historique perso éventuel).
create policy ride_events_select_org on public.ride_events
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- INSERT : régulateur/dirigeant pour n'importe quel ride de l'org ;
-- chauffeur uniquement pour SES rides (cohérent driver_id = drivers.user_id).
create policy ride_events_insert_regulateur_or_driver on public.ride_events
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
      or (
        public.has_role('chauffeur'::public.user_role)
        and ride_id in (
          select id from public.rides
          where driver_id in (
            select id from public.drivers
            where profile_id = auth.uid()
          )
        )
      )
    )
  );

-- Pas de UPDATE (immuable post-création, log d'événements).
-- Pas de DELETE V1.5 (audit trail — Phase 06 RGPD purge éventuelle).
