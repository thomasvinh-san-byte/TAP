-- Migration : archivage chauffeur réservé au dirigeant (column-level)
--
-- Hotfix-bis Phase 04 (DEC-029 affinée) : la migration précédente
-- (20260516000001_drivers_perm_regulateur.sql) a élargi UPDATE
-- public.drivers au régulateur en globalité. Mais la décision D1 sépare
-- explicitement quatre actions :
--
--   - Désactiver (régulateur, actif=false)         → filet de sécurité
--   - Réactiver  (régulateur, actif=true)          → instantané
--   - Archiver   (DIRIGEANT UNIQUEMENT)            → sortie système
--   - Désarchiver (régulateur ou dirigeant)        → réintégration
--
-- Postgres RLS ne supporte pas nativement le contrôle column-level dans
-- USING/WITH CHECK (pas de référence OLD vs NEW). On enforce donc via un
-- trigger BEFORE UPDATE : si l'une des colonnes d'archivage change et que
-- l'appelant n'est pas dirigeant, on lève une exception.
--
-- Defense in depth : les Server Actions appliquent déjà ce contrôle au
-- niveau applicatif (requireDirigeant pour archiveDriverAction). Ce
-- trigger garantit qu'aucune route alternative (RPC, client direct) ne
-- contourne la règle.
--
-- Refs : DEC-029, hotfix permissions chauffeurs régulateur (Volet 1 bis).

create or replace function public.drivers_archive_columns_dirigeant_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Archivage (false → true) : dirigeant uniquement. Le désarchivage
  -- (true → false) reste autorisé au régulateur (D1 décision dirigeant).
  if (new.archive = true and old.archive = false)
     and not public.has_role('dirigeant'::public.user_role) then
    raise exception
      'Seul un dirigeant peut archiver un chauffeur.'
      using errcode = '42501';
  end if;

  -- Modification isolée du motif d'archivage (sans changement du flag
  -- archive) : dirigeant uniquement. Empêche un régulateur de réécrire
  -- l'historique d'un chauffeur déjà archivé.
  if new.archive_motif is distinct from old.archive_motif
     and new.archive is not distinct from old.archive
     and not public.has_role('dirigeant'::public.user_role) then
    raise exception
      'Seul un dirigeant peut modifier le motif d''archivage.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.drivers_archive_columns_dirigeant_only() is
  'Garde column-level : interdit aux non-dirigeants de modifier archive / '
  'archive_at / archive_motif sur public.drivers (DEC-029 sémantique '
  '4 actions distinctes).';

drop trigger if exists drivers_archive_columns_guard on public.drivers;

create trigger drivers_archive_columns_guard
  before update on public.drivers
  for each row
  execute function public.drivers_archive_columns_dirigeant_only();
