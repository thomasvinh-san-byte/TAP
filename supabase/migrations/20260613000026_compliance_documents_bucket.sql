-- =============================================================================
-- Migration — bucket Storage privé « compliance-documents » + RLS org-scoped
-- =============================================================================
-- Débloque l'upload des justificatifs de conformité (contrôle technique,
-- assurance, convention…) en BÊTA sur Supabase Storage sous DPA (DEC-077 : le
-- HDS est un prérequis de la PROD commerciale, pas de la bêta ; Supabase EU sous
-- DPA acceptable en bêta). Architecture PORTABLE (CON-001) : la migration du
-- bucket vers une infra HDS en prod ne changera pas le code applicatif.
--
-- Bucket PRIVÉ (jamais public) : lecture uniquement par URL signée courte
-- générée côté serveur. Types/tailles bornés au niveau bucket (défense en
-- profondeur, en plus de la validation applicative).
--
-- Convention de chemin : {organization_id}/{entity_type}/{entity_id}/{uuid}-{fichier}
-- → le 1er dossier = organization_id, exploité par la RLS pour le cloisonnement
-- multi-tenant ; l'UUID évite collisions et énumération.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760, -- 10 Mio
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- RLS storage.objects — cloisonnement par organisation (1er dossier du chemin).
-- Lecture : régulateur / dirigeant de l'organisation propriétaire de l'objet.
create policy "compliance_docs_select_same_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

-- Écriture : réservée au DIRIGEANT de l'organisation (cohérent avec les actions
-- conformité), dans le préfixe de sa propre organisation. Aucun cross-org, aucun
-- anon (policies réservées au rôle `authenticated`).
create policy "compliance_docs_insert_dirigeant"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and public.has_role('dirigeant'::public.user_role)
  );
