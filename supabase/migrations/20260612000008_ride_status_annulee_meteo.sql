-- =============================================================================
-- Migration — Statut d'annulation météo (annulee_meteo, DEC-170)
-- =============================================================================
-- Mode alerte météo / cyclone (CdG l.380-385, US-REG-09). On distingue une
-- annulation cyclone d'une annulation régulateur normale (traçabilité : stats,
-- non-facturation, reprise J+1/J+2 ultérieure).
--
-- `ADD VALUE IF NOT EXISTS` : additif, idempotent. La valeur n'est PAS utilisée
-- dans cette migration (un nouvel enum value ne peut servir dans la même
-- transaction que son ajout) — elle est consommée au runtime par l'app et par la
-- migration suivante (weather_alerts) côté données seulement.
-- =============================================================================

alter type public.ride_status add value if not exists 'annulee_meteo';
