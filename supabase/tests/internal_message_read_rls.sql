-- =============================================================================
-- Tests pgTAP — RLS internal_message_read (messagerie interne lot 2, §5.22)
-- =============================================================================
-- Read-state PRIVÉ par (utilisateur, course) et org-scoped. Policies
-- (migration 20260613000027) : SELECT/INSERT/UPDATE réservés à SES propres lignes
-- (profile_id = auth.uid()) dans son organisation. Aucune policy DELETE (le
-- read-state se met à jour par upsert, il ne se supprime pas).
-- Couverture :
--   - RLS activée + forcée
--   - INSERT de sa propre ligne OK ; INSERT au nom d'un autre profil refusé
--   - SELECT ne voit QUE ses lignes (cross-user same-org : 0 ; cross-tenant : 0)
--   - UPDATE de sa propre ligne OK
--   - DELETE bloqué par RLS (aucune policy DELETE → 0 ligne)
--   - anon ne voit rien (RLS) ; grants authenticated SELECT/INSERT/UPDATE
-- =============================================================================

begin;

select plan(11);

-- Socle multi-tenant (Org Alpha + Org Bravo + chauffeur Alpha) via la fabrique.
do $$ begin perform test_fixtures.setup(with_second_org => true, with_chauffeur => true); end $$;

-- Patient + course Alpha (FK de internal_message_read.ride_id).
insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111',
   'X', 'Y', '1980-01-23', '12 rue X', '97400', 'Saint-Denis', 'appel');

-- Course Alpha créée par le régulateur (policy rides_insert : created_by = soi).
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
insert into public.rides
  (id, organization_id, patient_id, scheduled_at, pickup_address, dropoff_address,
   created_by, updated_by)
values
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '99999999-9999-9999-9999-999999999991',
   now() + interval '1 hour', '12 rue X', 'CHU',
   'cccccccc-cccc-cccc-cccc-cccccccccccc',
   'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.internal_message_read'::regclass),
  'RLS activée sur internal_message_read'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.internal_message_read'::regclass),
  'RLS forcée sur internal_message_read'
);

-- 3. régulateur Alpha INSERT SA propre ligne de lecture OK
select lives_ok(
  $$ insert into public.internal_message_read
       (organization_id, ride_id, profile_id)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'régulateur INSERT sa propre ligne de read-state OK'
);

-- 4. régulateur INSERT au nom d'un AUTRE profil refusé (WITH CHECK profile_id=uid)
select throws_ok(
  $$ insert into public.internal_message_read
       (organization_id, ride_id, profile_id)
     values
       ('11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'régulateur refusé INSERT au nom d''un autre profil (read-state privé)'
);

-- 5. régulateur voit SA ligne (SELECT scoped à profile_id = auth.uid())
select is(
  (select count(*)::int from public.internal_message_read),
  1,
  'régulateur voit sa propre ligne de read-state (1)'
);

-- 6. bravo (autre org) ne voit rien (cross-tenant strict)
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.internal_message_read),
  0,
  'bravo ne voit aucune ligne Alpha (cross-tenant strict)'
);

-- 7. chauffeur Alpha (même org, autre utilisateur) ne voit rien (read-state privé)
set local "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
select is(
  (select count(*)::int from public.internal_message_read),
  0,
  'chauffeur Alpha ne voit pas la ligne du régulateur (isolation par utilisateur)'
);

-- 8. régulateur UPDATE SA ligne OK (mise à jour du dernier message lu)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
with upd as (
  update public.internal_message_read
    set last_read_at = now()
    where ride_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
    returning 1
)
select is(
  (select count(*)::int from upd),
  1,
  'régulateur UPDATE sa propre ligne de read-state OK (1 ligne)'
);

-- 9. DELETE bloqué par RLS (aucune policy DELETE). Le grant DELETE existe (défaut
-- Supabase) mais aucune policy DELETE ne rend de ligne supprimable → 0 ligne.
with del as (
  delete from public.internal_message_read
    where ride_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'DELETE read-state bloqué par RLS (0 ligne ; upsert-only)'
);

-- 10. anon : grant explicitement révoqué (migration : revoke all from anon).
-- La protection est ici au niveau du GRANT (anon n'a aucun privilège), pas
-- seulement RLS — on vérifie donc l'absence de privilège SELECT.
reset role;
reset "request.jwt.claim.sub";
select ok(
  not has_table_privilege('anon', 'public.internal_message_read', 'SELECT'),
  'anon n''a aucun privilège SELECT sur internal_message_read (grant révoqué)'
);

-- 11. Grants : authenticated SELECT/INSERT/UPDATE. Le grant DELETE reste octroyé
-- (défaut Supabase) : l'absence de suppression est garantie par l'absence de
-- policy DELETE (RLS), pas par la révocation du grant.
select ok(
  has_table_privilege('authenticated', 'public.internal_message_read', 'SELECT')
    and has_table_privilege('authenticated', 'public.internal_message_read', 'INSERT')
    and has_table_privilege('authenticated', 'public.internal_message_read', 'UPDATE'),
  'Grants internal_message_read : authenticated SELECT/INSERT/UPDATE (DELETE contrôlé par RLS)'
);

select * from finish();
rollback;
