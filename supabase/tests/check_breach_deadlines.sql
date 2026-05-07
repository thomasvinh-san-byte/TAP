-- =============================================================================
-- Tests fonction check_breach_deadlines() — Phase 1.5 DPA + RGPD compliance
-- D-08 (watchdog 72h), DPA-05 (notification CNIL automatique).
-- =============================================================================
-- État RED attendu en Wave 0 : la fonction public.check_breach_deadlines()
-- et la table public.data_breach_incident n'existent pas encore.
--
-- Stratégie : insérer un breach détecté il y a 67 heures (donc 5 heures
-- restantes avant deadline 72h), puis appeler la fonction. On attend une
-- ligne audit_logs.action = 'breach.deadline_warning' avec hours_remaining
-- entre 0 et 6 dans metadata.
-- =============================================================================

begin;

select plan(5);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant + dirigeant Alpha
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap');

-- -----------------------------------------------------------------------------
-- 1. La fonction check_breach_deadlines() existe et est callable
-- -----------------------------------------------------------------------------
select has_function(
  'public', 'check_breach_deadlines',
  'La fonction public.check_breach_deadlines() existe (D-08)'
);

-- -----------------------------------------------------------------------------
-- 2. Insère un breach détecté il y a 67 heures (5h restantes avant 72h)
-- -----------------------------------------------------------------------------
insert into public.data_breach_incident
  (organization_id, detected_at, severity, nature,
   affected_data_categories, description, immediate_measures,
   cnil_notification_required, cnil_notification_at, created_by)
values
  ('11111111-1111-1111-1111-111111111111',
   now() - interval '67 hours', 'eleve', 'confidentialite',
   array['identite','sante'],
   'Breach test pour watchdog', 'Mesures immédiates test',
   true, null,
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- -----------------------------------------------------------------------------
-- 3. Appel de la fonction watchdog
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ select public.check_breach_deadlines() $$,
  'check_breach_deadlines() s''exécute sans erreur'
);

-- -----------------------------------------------------------------------------
-- 4. audit_logs contient au moins une ligne breach.deadline_warning
-- -----------------------------------------------------------------------------
select ok(
  (select count(*) >= 1
     from public.audit_logs
     where action = 'breach.deadline_warning'
       and organization_id = '11111111-1111-1111-1111-111111111111'),
  'audit_logs reçoit au moins une ligne breach.deadline_warning (D-08)'
);

-- -----------------------------------------------------------------------------
-- 5. metadata contient hours_remaining (numeric > 0 et < 6)
-- -----------------------------------------------------------------------------
select ok(
  (select (metadata->>'hours_remaining')::numeric > 0
      and (metadata->>'hours_remaining')::numeric < 6
     from public.audit_logs
     where action = 'breach.deadline_warning'
       and organization_id = '11111111-1111-1111-1111-111111111111'
     limit 1),
  'metadata.hours_remaining est entre 0 et 6 (5h restantes attendues)'
);

select * from finish();
rollback;
