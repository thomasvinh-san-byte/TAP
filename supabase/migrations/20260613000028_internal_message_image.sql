-- =============================================================================
-- Migration — messagerie interne lot 3 (§5.22) : photo jointe à un message
-- =============================================================================
-- Permet d'attacher une PHOTO (incident, document) à un message de course.
-- Réutilise le pattern d'upload Supabase Storage débloqué (bucket PRIVÉ,
-- RLS org-scoped, URL signée à la lecture, validation MIME image/taille) — même
-- doctrine santé que l'upload conformité : jamais de public, pas de fuite.
--
-- Modèle : `internal_message.image_path` porte le CHEMIN de l'objet (bucket
-- privé — pas d'URL publique). Un message peut désormais être texte seul, photo
-- seule, ou les deux (légende) — d'où l'assouplissement de la contrainte body.
-- =============================================================================

-- Body désormais optionnel (message photo-seule). La contrainte de contenu
-- garantit qu'un message porte AU MOINS du texte OU une photo.
alter table public.internal_message alter column body drop not null;
alter table public.internal_message drop constraint if exists internal_message_body_check;

alter table public.internal_message add column image_path text;

alter table public.internal_message add constraint internal_message_content_check check (
  (body is null or char_length(body) between 1 and 2000)
  and (body is not null or image_path is not null)
);

comment on column public.internal_message.image_path is
  'Chemin de l''objet Storage (bucket prive message-attachments) d''une photo jointe. NULL = message texte. Lecture via URL signee (§5.22 lot 3).';

-- =============================================================================
-- Bucket privé + RLS org-scoped (même patron que compliance-documents)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880, -- 5 Mio
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Chemin : {organization_id}/{ride_id}/{uuid}-{fichier} → 1er dossier = org
-- (clé de cloisonnement RLS). Lecture / écriture réservées aux membres
-- authentifiés de l'organisation (les 3 rôles participent au chat ; la
-- visibilité fine par course est portée par la RLS de `internal_message` :
-- l'URL signée n'est demandée que pour un message que l'appelant peut voir).
create policy "message_attachments_select_same_org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );

create policy "message_attachments_insert_same_org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );
