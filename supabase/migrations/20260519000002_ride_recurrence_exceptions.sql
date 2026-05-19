-- Phase 05 Wave 1 — Exceptions manuelles sur récurrences (EXDATE)

create table public.ride_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  ride_recurrence_id uuid not null references public.ride_recurrences(id) on delete cascade,
  excluded_date date not null,
  reason text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ride_recurrence_id, excluded_date)
);

create index ride_recurrence_exceptions_recurrence_id_idx
  on public.ride_recurrence_exceptions (ride_recurrence_id);

alter table public.ride_recurrence_exceptions enable row level security;

create policy ride_recurrence_exceptions_select_org on public.ride_recurrence_exceptions
  for select to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
  );

create policy ride_recurrence_exceptions_insert_regulateur on public.ride_recurrence_exceptions
  for insert to authenticated
  with check (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_recurrence_exceptions_update_regulateur on public.ride_recurrence_exceptions
  for update to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
  );

create policy ride_recurrence_exceptions_delete_dirigeant on public.ride_recurrence_exceptions
  for delete to authenticated
  using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
    and public.has_role('dirigeant'::public.user_role)
  );
