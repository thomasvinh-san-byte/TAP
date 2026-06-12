-- =============================================================================
-- Migration — Template SMS « reaffectation » (DEC-161)
-- =============================================================================
-- Complément replanification (CdG §5.14 l.368) : SMS au patient dont la course
-- change de chauffeur suite à une panne/indisponibilité. Envoyé en best-effort
-- par `reassignRidesBatchAction` (10.02), avec consentement RGPD vérifié.
--
-- Variables Mustache supportées (template-renderer @tap/sms) :
--   {{patient_prenom}} {{date}} {{heure}} {{chauffeur_prenom}}
-- D-04 : pas d'ETA inventé sans géoloc HDS → on garde l'horaire programmé
-- ({{heure}}). Body éditable via le module sms-templates (dirigeant).
-- Additif idempotent (ON CONFLICT DO NOTHING) — n'écrase pas un edit dirigeant.
-- =============================================================================

insert into public.sms_templates (key, body) values
  (
    'reaffectation',
    '{{patient_prenom}}, votre transport du {{date}} a {{heure}} est maintenant assure par un autre chauffeur (horaire maintenu). TAP Reunion.'
  )
on conflict (key) do nothing;
