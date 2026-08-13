-- =============================================================================
-- Tests pgTAP — Buckets Storage privés + RLS org-scoped (storage.objects)
-- =============================================================================
-- Couvre les deux buckets privés à cloisonnement multi-tenant par 1er dossier
-- du chemin = organization_id :
--   - compliance-documents  (migration 20260613000026) : SELECT régul/dirigeant
--     même org ; INSERT dirigeant même org.
--   - message-attachments   (migration 20260613000028, photo jointe à un message
--     interne — internal_message.image_path) : SELECT/INSERT membre authentifié
--     de l'org.
--
-- Vérification STRUCTURELLE des policies storage.objects (existence, commande,
-- rôle `authenticated`, absence d'anon, cloisonnement org dans le prédicat). Le
-- comportement runtime (URL signée, upload) est validé au niveau applicatif/E2E ;
-- storage.objects est une table gérée par Supabase, non seedée ici.
-- =============================================================================

begin;

select plan(10);

-- 1-2. Buckets privés (public = false) et présents
select is(
  (select public from storage.buckets where id = 'compliance-documents'),
  false,
  'bucket compliance-documents existe et est privé (public = false)'
);
select is(
  (select public from storage.buckets where id = 'message-attachments'),
  false,
  'bucket message-attachments existe et est privé (public = false)'
);

-- 3. RLS activée sur storage.objects (support des policies de cloisonnement)
select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'RLS activée sur storage.objects'
);

-- 4. compliance-documents : policy SELECT réservée à authenticated (jamais anon)
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'compliance_docs_select_same_org'
       and cmd = 'SELECT'
       and roles @> array['authenticated']::name[]
       and not (roles @> array['anon']::name[])
  ),
  'policy compliance_docs_select_same_org : SELECT, authenticated seulement'
);

-- 5. compliance-documents : SELECT cloisonné par org ET réservé régul/dirigeant
select ok(
  (select qual from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'compliance_docs_select_same_org')
    like '%current_organization_id%',
  'policy compliance_docs_select_same_org : prédicat cloisonné par organisation'
);

-- 6. compliance-documents : policy INSERT réservée au dirigeant
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'compliance_docs_insert_dirigeant'
       and cmd = 'INSERT'
       and roles @> array['authenticated']::name[]
       and not (roles @> array['anon']::name[])
  ),
  'policy compliance_docs_insert_dirigeant : INSERT, authenticated seulement'
);
select ok(
  (select with_check from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'compliance_docs_insert_dirigeant')
    like '%dirigeant%',
  'policy compliance_docs_insert_dirigeant : écriture réservée au rôle dirigeant'
);

-- 7-8. message-attachments : policies SELECT + INSERT présentes, authenticated,
-- cloisonnées par organisation (1er dossier du chemin).
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'message_attachments_select_same_org'
       and cmd = 'SELECT'
       and roles @> array['authenticated']::name[]
       and not (roles @> array['anon']::name[])
  ),
  'policy message_attachments_select_same_org : SELECT, authenticated seulement'
);
select ok(
  exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'message_attachments_insert_same_org'
       and cmd = 'INSERT'
       and roles @> array['authenticated']::name[]
       and not (roles @> array['anon']::name[])
  ),
  'policy message_attachments_insert_same_org : INSERT, authenticated seulement'
);
select ok(
  (select with_check from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'message_attachments_insert_same_org')
    like '%current_organization_id%',
  'policy message_attachments_insert_same_org : prédicat cloisonné par organisation'
);

select * from finish();
rollback;
