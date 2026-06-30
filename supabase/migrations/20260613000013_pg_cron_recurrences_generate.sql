-- =============================================================================
-- Migration — pg_cron : génération anticipée des récurrences (RECURRENCE-01)
-- =============================================================================
-- Planifie l'appel quotidien de /api/cron/recurrences-generate (§5.9), sur le
-- MÊME mécanisme que les crons SMS (pg_cron + pg_net + Vault secret
-- 'cron_app_token', migration 20260519000007). Aucun second mécanisme (pas de
-- Vercel cron).
--
-- LOT PARTIEL ASSUMÉ : ce cron ne couvre QUE la génération anticipée. Surcharge
-- d'occurrence, éditions de série et renouvellement restent à faire (§5.9).
--
-- Timezone : pg_cron s'exprime en UTC. La Réunion est UTC+4.
--   '0 22 * * *' UTC = 02h00 Réunion (creux de nuit).
--
-- Si le secret 'cron_app_token' est absent, le Bearer est vide → le Route
-- Handler répond 401 (comportement attendu jusqu'à création du secret).
-- =============================================================================

select cron.schedule(
  'recurrences-generate',
  '0 22 * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/recurrences-generate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token'),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
