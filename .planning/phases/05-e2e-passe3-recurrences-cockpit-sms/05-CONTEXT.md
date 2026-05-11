# Phase 5 — Passe 3 (récurrences + cockpit + SMS) — Context (esquisse)

**Pivot ADR** : ADR-003 (2026-05-11)
**Status** : Esquisse — détails à compléter à l'approche de la phase

---

## Goal

Les trois leviers de productivité qui transforment l'outil de « utilisable » à « gain de temps mesurable ». À ce stade, le SaaS est commercialement vendable.

## Périmètre

**Dans :**

- `packages/recurrence` : modèle dialyse 3×/semaine, génération de courses à 30 jours rolling, exceptions jours fériés 974, gestion bons de transport décrémentés
- Cockpit `/cockpit` : vue temps réel régulatrice, courses du jour avec statut live (Supabase Realtime), géoloc chauffeur en service (capture limitée au service uniquement)
- `packages/sms` : Twilio ou OVH SMS Pro, templates de rappel J-1 et H-2, consentement patient respecté, archivage SMS dans la fiche
- Grilles tarifaires étendues : nuit, dimanche, brancardage, kilométrique
- Concept de tournée persistante (table `tournee`) : un chauffeur a une tournée du jour, les courses appartiennent à la tournée

**Hors :**

- Optimisation OR-Tools — Passe 4
- B2B donneurs d'ordres — Passe 4
- Mode dégradé full-feature — Passe 4

## Critère de fin

3 design partners en démo active, dont au moins 1 qui a signé un POC payant. Récurrences validées sur 1 mois de dialyse fictive. SMS envoyés sur 50 courses témoins avec taux de délivrance > 95 %.

## Estimation grossière

3 à 4 semaines.
