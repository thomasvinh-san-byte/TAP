-- =============================================================================
-- Tests pgTAP — Référentiel patients (Phase 1, Plan 1, Wave 0 RED)
-- =============================================================================
-- État RED attendu en Wave 0 : la table public.patients n'existe pas encore.
-- Les assertions échouent avec "relation \"public.patients\" does not exist".
-- Wave 1 (migration 003) rendra ces tests verts.
--
-- Couverture (PAT-01, PAT-02, PAT-04, PAT-07) :
--   - RLS activée + forcée
--   - Schéma colonnes critiques (nir_encrypted, nir_search_hash, search_text)
--   - Index GIN pg_trgm + index unique partiel NIR
--   - Isolation tenant Alpha vs Bravo
--   - DELETE interdit (archivage logique)
--   - Audit_logs : ligne créée, sans nir_encrypted ni nir_search_hash
--   - Unicité nir_search_hash par tenant
--   - Plan d'exécution fuzzy utilise l'index GIN (Pitfall 3 RESEARCH)
--
-- Données factices uniquement. NIR factice 1801234567823 (sans valeur réelle).
-- =============================================================================

begin;

select plan(20);

-- -----------------------------------------------------------------------------
-- Fixtures multi-tenant : Alpha + Bravo + 3 users
-- (pattern dupliqué de supabase/tests/foundations.sql lignes 45-73)
-- -----------------------------------------------------------------------------
-- Socle multi-tenant via la fabrique de preambule (migration
-- 20260613000021_test_fixtures_factory). Identifiants figes inchanges.
do $$ begin perform test_fixtures.setup(with_second_org => true, second_org_role => 'regulateur'); end $$;

-- -----------------------------------------------------------------------------
-- 1-2. RLS activée + forcée sur public.patients
-- -----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.patients'::regclass),
  'RLS activée sur patients'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.patients'::regclass),
  'RLS forcée sur patients (force row level security)'
);

-- -----------------------------------------------------------------------------
-- 3. Type énuméré patient_constraint_type avec 8 valeurs (D-17)
-- -----------------------------------------------------------------------------
select ok(
  (select array_length(enum_range(null::public.patient_constraint_type), 1) = 8),
  'Type patient_constraint_type expose bien 8 valeurs'
);

-- -----------------------------------------------------------------------------
-- 4-5. Colonnes nir_encrypted (bytea) et nir_search_hash (bytea)
-- -----------------------------------------------------------------------------
select col_type_is(
  'public', 'patients', 'nir_encrypted', 'bytea',
  'Colonne nir_encrypted est de type bytea'
);
select col_type_is(
  'public', 'patients', 'nir_search_hash', 'bytea',
  'Colonne nir_search_hash est de type bytea'
);

-- -----------------------------------------------------------------------------
-- 6. Colonne search_text est generated stored ('s' dans pg_attribute)
-- -----------------------------------------------------------------------------
select is(
  (select attgenerated::text from pg_attribute
    where attrelid = 'public.patients'::regclass and attname = 'search_text'),
  's',
  'Colonne search_text est generated always as ... stored'
);

-- -----------------------------------------------------------------------------
-- 7. Index patients_search_trgm_idx existe et utilise un AM gin
-- -----------------------------------------------------------------------------
select ok(
  (select am.amname = 'gin'
     from pg_index i
     join pg_class c on c.oid = i.indexrelid
     join pg_am am on am.oid = c.relam
     where c.relname = 'patients_search_trgm_idx'),
  'Index patients_search_trgm_idx existe et est de type GIN'
);

-- -----------------------------------------------------------------------------
-- 8. Index unique partiel patients_nir_unique avec prédicat attendu
-- -----------------------------------------------------------------------------
select ok(
  (select i.indisunique and pg_get_expr(i.indpred, i.indrelid) is not null
     from pg_index i
     join pg_class c on c.oid = i.indexrelid
     where c.relname = 'patients_nir_unique'),
  'Index unique partiel patients_nir_unique existe avec prédicat'
);

-- -----------------------------------------------------------------------------
-- 9-12. Isolation tenant + RLS WITH CHECK
-- -----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- 9. INSERT minimal sous alpha-reg réussit
select lives_ok(
  $$ insert into public.patients
       (organization_id, nom, prenom, date_naissance, adresse_ligne1,
        code_postal, ville, canal_contact_prefere)
     values
       ('11111111-1111-1111-1111-111111111111', 'Hoarau', 'Patrick',
        '1980-01-23', '12 rue Pasteur', '97400', 'Saint-Denis', 'appel') $$,
  'alpha-reg insère un patient minimal valide'
);

-- 10. SELECT depuis alpha-reg retourne 1 ligne
select is(
  (select count(*)::int from public.patients),
  1,
  'alpha-reg voit 1 patient (le sien)'
);

-- 11. bravo-reg ne voit pas le patient Alpha
set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
select is(
  (select count(*)::int from public.patients),
  0,
  'bravo-reg ne voit aucun patient Alpha (isolation tenant)'
);

-- 12. bravo-reg ne peut pas insérer dans Alpha (WITH CHECK)
select throws_ok(
  $$ insert into public.patients
       (organization_id, nom, prenom, date_naissance, adresse_ligne1,
        code_postal, ville, canal_contact_prefere)
     values
       ('11111111-1111-1111-1111-111111111111', 'Mal', 'Acteur',
        '1990-01-01', '1 rue X', '97400', 'Saint-Denis', 'appel') $$,
  '42501',
  null,
  'bravo-reg ne peut pas créer un patient dans Alpha (RLS WITH CHECK)'
);

-- -----------------------------------------------------------------------------
-- 13-14. DELETE interdit, UPDATE archive=true autorisé
-- -----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- DELETE bloqué par RLS (archivage logique — aucune policy DELETE). authenticated
-- a le grant DELETE (défaut Supabase) mais aucune policy DELETE ne rend de ligne
-- supprimable → 0 ligne supprimée, sans erreur. WITH-DELETE au niveau supérieur.
with del as (
  delete from public.patients
    where organization_id = '11111111-1111-1111-1111-111111111111'
    returning 1
)
select is(
  (select count(*)::int from del),
  0,
  'alpha-reg ne peut pas DELETE un patient — bloqué par RLS (0 ligne ; archivage logique)'
);

select lives_ok(
  $$ update public.patients
       set archive = true
       where organization_id = '11111111-1111-1111-1111-111111111111' $$,
  'alpha-reg peut archiver un patient (UPDATE archive=true)'
);

-- -----------------------------------------------------------------------------
-- 15-17. Audit_logs alimenté par trigger, sans NIR
-- -----------------------------------------------------------------------------
reset role;
reset "request.jwt.claim.sub";

select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'patient.insert'
         and organization_id = '11111111-1111-1111-1111-111111111111'
   )),
  'audit_logs reçoit une ligne action=patient.insert après l''INSERT'
);

select ok(
  (select not (metadata->'new') ? 'nir_encrypted'
     from public.audit_logs
     where action = 'patient.insert'
     limit 1),
  'audit_logs.metadata->new ne contient PAS nir_encrypted'
);

select ok(
  (select not (metadata->'new') ? 'nir_search_hash'
     from public.audit_logs
     where action = 'patient.insert'
     limit 1),
  'audit_logs.metadata->new ne contient PAS nir_search_hash'
);

-- -----------------------------------------------------------------------------
-- 18-19. Unicité nir_search_hash par tenant
-- -----------------------------------------------------------------------------
-- Réinjecter un hash NIR factice côté service_role
update public.patients
  set nir_search_hash = decode('deadbeefdeadbeefdeadbeefdeadbeef', 'hex'),
      archive = false
  where organization_id = '11111111-1111-1111-1111-111111111111';

-- 18. 2e patient avec même hash dans Alpha → conflit
select throws_ok(
  $$ insert into public.patients
       (organization_id, nom, prenom, date_naissance, adresse_ligne1,
        code_postal, ville, canal_contact_prefere, nir_search_hash, archive)
     values
       ('11111111-1111-1111-1111-111111111111', 'Doublon', 'Patient',
        '1985-05-05', '5 rue Y', '97410', 'Saint-Pierre', 'appel',
        decode('deadbeefdeadbeefdeadbeefdeadbeef', 'hex'), false) $$,
  '23505',
  null,
  'INSERT 2e patient même nir_search_hash dans Alpha → 23505'
);

-- 19. Même hash dans Bravo → réussit (multi-tenant)
select lives_ok(
  $$ insert into public.patients
       (organization_id, nom, prenom, date_naissance, adresse_ligne1,
        code_postal, ville, canal_contact_prefere, nir_search_hash, archive)
     values
       ('22222222-2222-2222-2222-222222222222', 'Bravo', 'Patient',
        '1988-08-08', '8 rue Z', '97410', 'Saint-Pierre', 'appel',
        decode('deadbeefdeadbeefdeadbeefdeadbeef', 'hex'), false) $$,
  'INSERT même nir_search_hash dans Bravo → succès (multi-tenant)'
);

-- -----------------------------------------------------------------------------
-- 20. EXPLAIN sur recherche fuzzy utilise l'index GIN (Pitfall 3 RESEARCH)
-- -----------------------------------------------------------------------------
-- Avec si peu de lignes en fixture, le planner Postgres préfère un Seq Scan
-- (coût plus bas que la lecture d'index GIN). On force enable_seqscan = off
-- pour vérifier que l'index *peut* être utilisé. C'est le pattern pgTAP
-- standard pour valider la présence d'un plan d'exécution sur des fixtures
-- de petite taille (cf. RESEARCH Pitfall 3).
set local enable_seqscan = off;

-- Wrapper SQL pour capturer le plan en texte (cf. RESEARCH §Pitfall 3)
create or replace function pg_temp.explain_text(q text) returns text
language plpgsql as $$
declare line text; result text := '';
begin
  for line in execute 'explain ' || q loop
    result := result || line || E'\n';
  end loop;
  return result;
end; $$;

select alike(
  pg_temp.explain_text(
    $q$ select id from public.patients where search_text % 'ho' $q$
  ),
  '%Bitmap Index Scan on patients_search_trgm_idx%',
  'Le plan EXPLAIN utilise Bitmap Index Scan on patients_search_trgm_idx'
);

select * from finish();
rollback;
