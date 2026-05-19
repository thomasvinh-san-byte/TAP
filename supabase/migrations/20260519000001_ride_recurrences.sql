-- Phase 05 Wave 1 — Table ride_recurrences (modèle de récurrence)
-- Ref : DEC-046 rrule.js LOCKED, RFC 5545

create table public.ride_recurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid null, -- FK reportée Phase 06 (table prescriptions non créée V1.5, cf CONCERNS)
  rrule_str text not null,
  start_date date not null,
  end_date date null,
  pickup_address text not null,
  pickup_lat numeric(10,7) null,
  pickup_lng numeric(10,7) null,
  pickup_citycode text null,
  dropoff_address text not null,
  dropoff_lat numeric(10,7) null,
  dropoff_lng numeric(10,7) null,
  dropoff_citycode text null,
  transport_mode text not null,
  urgency text not null default 'normale',
  archived_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ride_recurrences enable row level security;

create policy ride_recurrences_select_org on public.ride_recurrences
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

create policy ride_recurrences_insert_regulateur on public.ride_recurrences
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrences_update_regulateur on public.ride_recurrences
  for update to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    organization_id = (select public.current_organization_id())
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrences_delete_dirigeant on public.ride_recurrences
  for delete to authenticated
  using (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

create index ride_recurrences_patient_id_idx on public.ride_recurrences (patient_id);
create index ride_recurrences_organization_id_idx on public.ride_recurrences (organization_id);
