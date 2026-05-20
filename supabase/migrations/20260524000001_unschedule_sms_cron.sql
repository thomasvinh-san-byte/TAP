-- Mini-PR — Mise en pause des rappels SMS (ADR-004, DEC-062).
--
-- Le fournisseur SMS est différé (Twilio US/CLOUD Act écarté pour le
-- transport sanitaire ; cible = API SMS française HDS ou RaspiSMS
-- auto-hébergé). Les 2 cron jobs SMS (migration 20260519000007) sont
-- désactivés : ils déclenchaient des appels horaires vers les Route
-- Handlers qui échouaient en 401 (aucun secret Vault, aucun fournisseur).
--
-- Migration idempotente via garde `if exists` : passe en prod (jobs déjà
-- unscheduled manuellement) ET sur un reset (annule les cron.schedule
-- recréés par 20260519000007).
--
-- RÉACTIVATION (au choix d'un fournisseur) : recréer les cron.schedule
-- dans une nouvelle migration (cf. 20260519000007 pour le modèle), avec
-- l'URL du Route Handler du nouveau fournisseur.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sms-reminder-j1') then
    perform cron.unschedule('sms-reminder-j1');
  end if;
  if exists (select 1 from cron.job where jobname = 'sms-reminder-j2h') then
    perform cron.unschedule('sms-reminder-j2h');
  end if;
end $$;
