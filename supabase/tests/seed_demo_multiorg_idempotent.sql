-- =============================================================================
-- Tests pgTAP — Idempotence & isolation multi-sociétés du seed démo (SEED-02)
-- =============================================================================
-- Couvre les entités « écrans vivants » introduites par SEED-02 et le
-- multi-sociétés :
--   A. weather_alerts : le ré-seed (ON CONFLICT (id) DO UPDATE) ne duplique pas
--      l'alerte active et respecte l'unicité « une alerte active par société »
--      (index partiel) ; chaque société voit UNIQUEMENT sa propre alerte (RLS).
--   B. driver_incidents : un incident marqué résolu en UAT est RÉ-OUVERT par le
--      ré-seed (resolved_at repassé à null) → /replanification garde de la
--      matière, sans dupliquer l'incident.
--
-- Les insertions se font sous rôle authenticated + sub d'un dirigeant de la
-- société concernée (mêmes conventions que les autres tests seed) pour exercer
-- les politiques RLS réelles.
-- =============================================================================

begin;

select plan(6);

-- -----------------------------------------------------------------------------
-- Fixtures : 2 sociétés + 1 dirigeant chacune + 1 chauffeur (société A)
-- -----------------------------------------------------------------------------
insert into public.organizations (id, nom, ville, code_postal)
values
  ('a0000000-0000-0000-0000-000000000001', 'Org Multi A', 'Saint-Denis', '97400'),
  ('b0000000-0000-0000-0000-000000000001', 'Org Multi B', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'multiA-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('b0000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'multiB-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('a0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-000000000001',
   'dirigeant', 'Multi', 'DirA', 'multiA-dir@test.tap'),
  ('b0000000-0000-0000-0000-0000000000d1', 'b0000000-0000-0000-0000-000000000001',
   'dirigeant', 'Multi', 'DirB', 'multiB-dir@test.tap');

set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-0000000000d1';

insert into public.drivers
  (id, organization_id, profile_id, nom_affichage, type_permis, created_by)
values
  ('a0000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-000000000001',
   null, 'Chauffeur A', '{taxi}', 'a0000000-0000-0000-0000-0000000000d1');

-- -----------------------------------------------------------------------------
-- A. weather_alerts — société A : insertion initiale (bloc « écrans vivants »)
-- -----------------------------------------------------------------------------
insert into public.weather_alerts (id, organization_id, active, motif, zone, activated_by, activated_at)
values ('a0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000001', true,
        'Vigilance cyclonique (test)', 'Nord', 'a0000000-0000-0000-0000-0000000000d1', now())
on conflict (id) do update set active = true, motif = excluded.motif,
  zone = excluded.zone, activated_at = excluded.activated_at, deactivated_at = null;

select is(
  (select count(*)::int from public.weather_alerts where active),
  1,
  '1. Société A : exactement 1 alerte météo active visible (RLS scope org)'
);

-- Ré-seed (idempotence) : même id, ON CONFLICT DO UPDATE — pas de duplication.
insert into public.weather_alerts (id, organization_id, active, motif, zone, activated_by, activated_at)
values ('a0000000-0000-0000-0000-0000000000f1', 'a0000000-0000-0000-0000-000000000001', true,
        'Vigilance cyclonique (test)', 'Nord', 'a0000000-0000-0000-0000-0000000000d1', now())
on conflict (id) do update set active = true, motif = excluded.motif,
  zone = excluded.zone, activated_at = excluded.activated_at, deactivated_at = null;

select is(
  (select count(*)::int from public.weather_alerts where active),
  1,
  '2. Après ré-seed : toujours 1 alerte active (ON CONFLICT ne duplique pas)'
);

-- -----------------------------------------------------------------------------
-- Isolation : société B a sa PROPRE alerte active ; ne voit pas celle de A.
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-0000000000d1';

insert into public.weather_alerts (id, organization_id, active, motif, activated_by, activated_at)
values ('b0000000-0000-0000-0000-0000000000f1', 'b0000000-0000-0000-0000-000000000001', true,
        'Vigilance cyclonique B (test)', 'b0000000-0000-0000-0000-0000000000d1', now())
on conflict (id) do update set active = true;

select is(
  (select count(*)::int from public.weather_alerts where active),
  1,
  '3. Isolation : société B voit 1 alerte active (la sienne), jamais celle de A'
);

-- -----------------------------------------------------------------------------
-- B. driver_incidents — société A : ouvert → résolu (UAT) → ré-ouvert (ré-seed)
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-0000000000d1';

insert into public.driver_incidents (id, organization_id, driver_id, type, nature, lieu, started_at, created_by)
values ('a0000000-0000-0000-0000-00000000ab01', 'a0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-0000000000e1', 'panne_vehicule', 'Panne test', 'RN1',
        now() - interval '30 minutes', 'a0000000-0000-0000-0000-0000000000d1')
on conflict (id) do update set type = excluded.type, nature = excluded.nature,
  lieu = excluded.lieu, started_at = excluded.started_at, resolved_at = null;

select is(
  (select resolved_at from public.driver_incidents
   where id = 'a0000000-0000-0000-0000-00000000ab01'),
  null::timestamptz,
  '4. Incident initial : ouvert (resolved_at null)'
);

-- UAT : la régulation marque l'incident résolu.
update public.driver_incidents set resolved_at = now()
 where id = 'a0000000-0000-0000-0000-00000000ab01';

select isnt(
  (select resolved_at from public.driver_incidents
   where id = 'a0000000-0000-0000-0000-00000000ab01'),
  null::timestamptz,
  '5. Post-UAT : incident résolu (resolved_at renseigné)'
);

-- Ré-seed : ON CONFLICT DO UPDATE resolved_at = null → ré-ouverture.
insert into public.driver_incidents (id, organization_id, driver_id, type, nature, lieu, started_at, created_by)
values ('a0000000-0000-0000-0000-00000000ab01', 'a0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-0000000000e1', 'panne_vehicule', 'Panne test', 'RN1',
        now() - interval '30 minutes', 'a0000000-0000-0000-0000-0000000000d1')
on conflict (id) do update set type = excluded.type, nature = excluded.nature,
  lieu = excluded.lieu, started_at = excluded.started_at, resolved_at = null;

select is(
  (select resolved_at from public.driver_incidents
   where id = 'a0000000-0000-0000-0000-00000000ab01'),
  null::timestamptz,
  '6. Post ré-seed : incident ré-ouvert (resolved_at null) — /replanification garde sa matière'
);

select * from finish();
rollback;
