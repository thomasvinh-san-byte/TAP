-- =============================================================================
-- Tests pgTAP — Notes opérationnelles patient (Phase 1, Plan 1, Wave 0 RED)
-- =============================================================================
-- État RED attendu en Wave 0 : table public.patient_operational_note absente.
-- Wave 1 (migration 003) rendra ces tests verts.
--
-- Couverture (PAT-06, PAT-07) :
--   - RLS activée + forcée
--   - Modèle historique en chaîne (replaced_by_id)
--   - Une seule note active par patient
--   - Contrainte CHECK longueur 500 chars
--   - audit_logs : insert tracé
-- =============================================================================

begin;

select plan(7);

-- -----------------------------------------------------------------------------
-- Fixtures
-- -----------------------------------------------------------------------------
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_alpha_dirigeant => false); end $$;

insert into public.patients
  (id, organization_id, nom, prenom, date_naissance, adresse_ligne1,
   code_postal, ville, canal_contact_prefere)
values
  ('99999999-9999-9999-9999-999999999991',
   '11111111-1111-1111-1111-111111111111', 'Hoarau', 'Patrick',
   '1980-01-23', '12 rue Pasteur', '97400', 'Saint-Denis', 'appel');

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class
     where oid = 'public.patient_operational_note'::regclass),
  'RLS activée sur patient_operational_note'
);
select ok(
  (select relforcerowsecurity from pg_class
     where oid = 'public.patient_operational_note'::regclass),
  'RLS forcée sur patient_operational_note'
);

-- -----------------------------------------------------------------------------
-- 3. INSERT note 1 sous alpha-reg
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok(
  $$ insert into public.patient_operational_note
       (id, organization_id, patient_id, content, author_id)
     values
       ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        '99999999-9999-9999-9999-999999999991',
        'Préfère un chauffeur calme. Sonne au portail rouge.',
        'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'alpha-reg insère la note opérationnelle 1'
);

-- -----------------------------------------------------------------------------
-- 4. INSERT note 2 + UPDATE note1.replaced_by_id = note2.id
-- -----------------------------------------------------------------------------
select lives_ok(
  $$ with nouvelle as (
       insert into public.patient_operational_note
         (id, organization_id, patient_id, content, author_id)
       values
         ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111',
          '99999999-9999-9999-9999-999999999991',
          'Mise à jour : chien à la maison, prévenir au portail.',
          'cccccccc-cccc-cccc-cccc-cccccccccccc')
       returning id
     )
     update public.patient_operational_note
       set replaced_by_id = (select id from nouvelle)
       where id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'INSERT note 2 + chaînage replaced_by_id réussit'
);

-- -----------------------------------------------------------------------------
-- 5. Une seule note active (replaced_by_id IS NULL) par patient
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.patient_operational_note
     where patient_id = '99999999-9999-9999-9999-999999999991'
       and replaced_by_id is null),
  1,
  'Une seule note active par patient (replaced_by_id IS NULL)'
);

-- -----------------------------------------------------------------------------
-- 6. CHECK longueur 500 chars : INSERT note > 500 chars échoue
-- -----------------------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.patient_operational_note
         (organization_id, patient_id, content, author_id)
       values
         ('11111111-1111-1111-1111-111111111111',
          '99999999-9999-9999-9999-999999999991',
          %L,
          'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
    repeat('x', 501)
  ),
  '23514',
  null,
  'INSERT note > 500 chars lève contrainte CHECK 23514'
);

-- -----------------------------------------------------------------------------
-- 7. Audit log : patient_operational_note.insert
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select is(
  (select count(*)::int from public.audit_logs
     where action = 'patient_operational_note.insert'),
  2,
  'audit_logs reçoit 2 lignes patient_operational_note.insert (note 1 + note 2)'
);

select * from finish();
rollback;
