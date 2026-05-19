-- Phase 05 Wave 1 — Tracking SMS sortants (delivery status Twilio)
-- Ref : DEC-008 SMS consentement (vérification côté applicatif avant insertion).

create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid null references public.patients(id) on delete set null,
  ride_id uuid null references public.rides(id) on delete set null,
  template_key text not null,
  to_phone text not null,
  body_rendered text not null,
  twilio_message_sid text null,
  delivery_status text not null default 'queued'
    check (delivery_status in (
      'queued', 'sent', 'delivered', 'failed', 'undelivered', 'skipped_consent_revoked'
    )),
  delivery_error text null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

create index sms_messages_organization_id_idx on public.sms_messages (organization_id);
create index sms_messages_patient_id_idx on public.sms_messages (patient_id);
create index sms_messages_ride_id_idx on public.sms_messages (ride_id);
create index sms_messages_twilio_sid_idx on public.sms_messages (twilio_message_sid) where twilio_message_sid is not null;

alter table public.sms_messages enable row level security;

create policy sms_messages_select_org on public.sms_messages
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));
