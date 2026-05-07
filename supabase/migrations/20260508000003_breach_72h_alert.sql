-- =============================================================================
-- Migration Phase 1.5 — Watchdog 72h notification CNIL + purge rate limit
-- =============================================================================
-- D-08 (notification CNIL 72h obligatoire art. 33 RGPD).
-- Crée :
--   - extension pg_cron (gérée par Supabase Cloud, absente local Docker)
--   - public.check_breach_deadlines() : insère breach.deadline_warning quand
--     un breach > 66h n'a pas encore été notifié à la CNIL
--   - public.purge_legal_request_attempts() : purge entries > 7 jours
--   - cron.schedule('breach-72h-watchdog', '0 * * * *', ...) — horaire
--   - cron.schedule('legal-request-attempts-purge', '0 3 * * *', ...) — quotidien
-- =============================================================================
-- Note CI : si pg_cron absent (sandbox locale, docker registry bloqué),
-- les `select cron.schedule(...)` sont guardés via DO block conditionnel.
-- En production Supabase Cloud, pg_cron est pré-installé.
-- =============================================================================

-- pg_cron : pré-installé sur Supabase Cloud. Localement absent → guard.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  else
    raise notice 'pg_cron non disponible (sandbox locale) — cron.schedule sera skip.';
  end if;
end;
$$;

-- -- check_breach_deadlines() : watchdog 72h -------------------------------
-- Pour chaque data_breach_incident dont :
--   - cnil_notification_required = true
--   - cnil_notification_at IS NULL
--   - closed_at IS NULL
--   - now() > detected_at + 66 heures (i.e. moins de 6h restantes avant 72h)
-- → insère un audit_log action='breach.deadline_warning' avec metadata.hours_remaining.
create or replace function public.check_breach_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select id, organization_id, detected_at
    from public.data_breach_incident
    where cnil_notification_required = true
      and cnil_notification_at is null
      and closed_at is null
      and now() > detected_at + interval '66 hours'
  loop
    insert into public.audit_logs
      (organization_id, actor_id, actor_role, action,
       entity_type, entity_id, metadata)
    values (
      r.organization_id, null, null, 'breach.deadline_warning',
      'data_breach_incident', r.id,
      jsonb_build_object(
        'hours_remaining',
        extract(epoch from (r.detected_at + interval '72 hours' - now())) / 3600
      )
    );
  end loop;
end;
$$;

comment on function public.check_breach_deadlines() is
  'Watchdog 72h notification CNIL (art. 33 RGPD) — exécuté horaire par pg_cron.';

-- -- purge_legal_request_attempts() : nettoyage rate limit ------------------
create or replace function public.purge_legal_request_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.legal_request_attempts
  where attempted_at < now() - interval '7 days';
end;
$$;

comment on function public.purge_legal_request_attempts() is
  'Purge legal_request_attempts > 7 jours (Pitfall 6 RESEARCH) — exécuté quotidien.';

-- -- cron.schedule (guardé : DO block si extension présente) ----------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Watchdog 72h breach : exécution horaire
    perform cron.schedule(
      'breach-72h-watchdog',
      '0 * * * *',
      $cron$ select public.check_breach_deadlines(); $cron$
    );
    -- Purge rate limit attempts : 03h00 chaque nuit
    perform cron.schedule(
      'legal-request-attempts-purge',
      '0 3 * * *',
      $cron$ select public.purge_legal_request_attempts(); $cron$
    );
  end if;
end;
$$;
