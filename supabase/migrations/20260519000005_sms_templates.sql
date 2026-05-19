-- Phase 05 Wave 1 — Templates SMS (j1_reminder + j2h_reminder seed)
-- Variables Mustache {{patient_prenom}} {{date}} {{heure}} {{chauffeur_prenom}} {{pickup_address}}
-- NFR-001 : zéro nom propre dans le code — uniquement variables.

create table public.sms_templates (
  key text primary key,
  body text not null check (length(body) <= 160),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sms_templates enable row level security;

create policy sms_templates_read on public.sms_templates
  for select to authenticated using (true);

create policy sms_templates_update_dirigeant on public.sms_templates
  for update to authenticated
  using (public.has_role('dirigeant'::public.user_role))
  with check (public.has_role('dirigeant'::public.user_role));

-- Seed initial (updated_by null = system seed).
-- Le dirigeant prendra le relai au premier edit via UI admin (Wave 4).
insert into public.sms_templates (key, body) values
  (
    'j1_reminder',
    'Bonjour {{patient_prenom}}, rappel course demain {{date}} a {{heure}} avec {{chauffeur_prenom}}. TAP Reunion.'
  ),
  (
    'j2h_reminder',
    '{{patient_prenom}}, votre course est dans 2h ({{heure}}). {{chauffeur_prenom}} vient vous chercher. TAP Reunion.'
  );
