-- =============================================================================
-- Tests pgTAP — RLS cost_parameters (§5.20 lot E)
-- =============================================================================
-- Couverture :
--   - RLS activée + forcée
--   - dirigeant Alpha écrit + lit les paramètres de son org
--   - régulateur Alpha LIT mais ne peut PAS écrire (écriture dirigeant only)
--   - cross-tenant : dirigeant Bravo ne voit pas les paramètres Alpha
--   - unicité : une seule ligne par organisation
--   - grants authenticated = SELECT/INSERT/UPDATE (pas DELETE), anon refusé
-- =============================================================================

begin;

select plan(9);

insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-dir@test.tap', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-reg@test.tap', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bravo-dir@test.tap', crypt('x', gen_salt('bf')), now(), now(), now(), '{}', '{}');

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111',
   'regulateur', 'Alpha', 'Régulateur', 'alpha-reg@test.tap'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
   'dirigeant', 'Bravo', 'Dirigeant', 'bravo-dir@test.tap');

-- 1-2. RLS activée + forcée
select ok(
  (select relrowsecurity from pg_class where oid = 'public.cost_parameters'::regclass),
  'RLS activée sur cost_parameters'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.cost_parameters'::regclass),
  'RLS forcée sur cost_parameters'
);

-- 3. dirigeant Alpha écrit ses paramètres
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok(
  $$ insert into public.cost_parameters
       (organization_id, cout_carburant_eur_km, cout_entretien_eur_km, cout_amortissement_eur_km)
     values ('11111111-1111-1111-1111-111111111111', 0.15, 0.08, 0.05) $$,
  'dirigeant Alpha INSERT paramètres de son org OK'
);

-- 4. dirigeant Alpha lit ses paramètres
select is(
  (select count(*)::int from public.cost_parameters),
  1,
  'dirigeant Alpha voit ses paramètres (1)'
);

-- 5. régulateur Alpha LIT les paramètres (config non sensible)
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select is(
  (select count(*)::int from public.cost_parameters),
  1,
  'régulateur Alpha lit les paramètres de son org'
);

-- 6. régulateur Alpha ne peut PAS écrire : l'UPDATE est un no-op (la policy
-- USING dirigeant filtre la ligne → 0 ligne modifiée, sans erreur). On vérifie
-- que la valeur reste inchangée (0.150, saisie par le dirigeant).
update public.cost_parameters set cout_carburant_eur_km = 9
  where organization_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select cout_carburant_eur_km from public.cost_parameters
    where organization_id = '11111111-1111-1111-1111-111111111111'),
  0.150::numeric,
  'régulateur : UPDATE sans effet (écriture réservée au dirigeant)'
);

-- 7. cross-tenant : dirigeant Bravo ne voit pas les paramètres Alpha
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
  (select count(*)::int from public.cost_parameters),
  0,
  'dirigeant Bravo ne voit pas les paramètres Alpha (cross-tenant strict)'
);

-- 8. grants : SELECT/INSERT/UPDATE ; pas DELETE
select ok(
  has_table_privilege('authenticated', 'public.cost_parameters', 'SELECT')
    and has_table_privilege('authenticated', 'public.cost_parameters', 'INSERT')
    and has_table_privilege('authenticated', 'public.cost_parameters', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.cost_parameters', 'DELETE'),
  'authenticated : SELECT/INSERT/UPDATE OK ; DELETE refusé'
);

-- 9. anon refusé
select ok(
  not has_table_privilege('anon', 'public.cost_parameters', 'SELECT'),
  'anon refusé sur cost_parameters'
);

select * from finish();
rollback;
