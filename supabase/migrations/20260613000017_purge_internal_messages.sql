-- =============================================================================
-- Migration — purge automatique des messages internes > 1 an (MESSAGERIE-01, §5.22)
-- =============================================================================
-- Traite le reste-à-faire explicitement documenté du premier lot de messagerie
-- (migration 20260608000003_internal_message : « purge 1 an (pg_cron) hors
-- périmètre lot 1 »). Le §5.22 demande un archivage d'un an.
--
-- Deux volets, sur le pattern EXISTANT :
--   - fonction SQL `purge_internal_messages()` (modèle `purge_driver_positions`
--     / `purge_legal_request_attempts`) : delete au-delà de la rétention.
--   - planification pg_cron GARDÉE par un DO block conditionnel sur la présence
--     de l'extension (modèle `breach_72h_alert`) : skip propre en sandbox locale
--     où pg_cron est absent. En production Supabase Cloud, pg_cron est
--     pré-installé.
--
-- Périmètre : SEULE la table `internal_message` est touchée. Le chat, l'envoi et
-- l'affichage restent inchangés. Sûr en démo : si aucune ligne n'a plus d'un an,
-- la purge ne supprime rien (comportement naturel du delete).
-- =============================================================================

-- -- purge_internal_messages() : rétention 1 an --------------------------------
create or replace function public.purge_internal_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.internal_message
  where created_at < now() - interval '1 year';
$$;

comment on function public.purge_internal_messages() is
  'MESSAGERIE-01 (§5.22) : purge des messages internes > 1 an. Executee mensuellement par pg_cron.';

-- -- cron.schedule (guardé : DO block si extension présente) --------------------
-- Mensuel, 03h00 UTC le 1er du mois (creux, aligné sur le style des autres
-- purges). pg_cron s'exprime en UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge_internal_messages_monthly',
      '0 3 1 * *',
      $cron$ select public.purge_internal_messages(); $cron$
    );
  else
    raise notice 'pg_cron non disponible (sandbox locale) — purge_internal_messages non schedulee.';
  end if;
end;
$$;
