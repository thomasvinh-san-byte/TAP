-- Phase 05 Wave 1 — pg_net + pg_cron schedules SMS reminders
-- Ref : DEC-050 RÉVISÉ pg_cron + pg_net + Vault.
--
-- pg_cron 1.6.4 et supabase_vault 0.3.1 sont déjà activés (Supabase managed).
-- Cette migration active pg_net et planifie les 2 cron jobs SMS.
--
-- Le secret 'cron_app_token' doit être créé MANUELLEMENT dans la console
-- Supabase (Vault) post-merge — pas de hardcoding dans git :
--
--   select vault.create_secret('XXXX-32-chars-uuid-v4', 'cron_app_token');
--
-- Si le secret est absent au déclenchement cron, le SELECT dans
-- vault.decrypted_secrets retourne NULL et l'header Authorization sera
-- 'Bearer ' vide → le Route Handler Next.js refusera 401. Comportement
-- attendu jusqu'à création du secret.
--
-- Timezone : pg_cron exprime ses schedules en UTC. La Réunion est UTC+4.
--   '0 14 * * *' UTC = 18h00 Réunion (rappel J-1 en soirée).
--   '0 * * * *'  toutes les heures (rappel J-2h).

create extension if not exists pg_net;

select cron.schedule(
  'sms-reminder-j1',
  '0 14 * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j1',
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

select cron.schedule(
  'sms-reminder-j2h',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j2h',
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
