-- =============================================================================
-- Migration — Template SMS « pickup_confirmed » (SMS-01, §5.15)
-- =============================================================================
-- Prise en charge confirmée : le patient est prévenu que son transport vient de
-- démarrer (transition assignee → en_cours côté chauffeur). Envoyé en
-- best-effort APRÈS la transition, avec consentement RGPD vérifié (DEC-008).
--
-- Variables Mustache supportées (template-renderer @tap/sms, DEC-051 LOCKED) :
--   {{patient_prenom}} {{patient_nom}} {{date}} {{heure}} {{chauffeur_prenom}}
-- Ton sobre et rassurant (§5.15), sans donnée médicale. Body éditable via le
-- module sms-templates (dirigeant). Additif idempotent (ON CONFLICT DO NOTHING)
-- — n'écrase jamais un edit dirigeant.
-- =============================================================================

insert into public.sms_templates (key, body) values
  (
    'pickup_confirmed',
    'Bonjour {{patient_prenom}}, votre transport vient de demarrer. {{chauffeur_prenom}} arrive vers vous. TAP Reunion.'
  )
on conflict (key) do nothing;
