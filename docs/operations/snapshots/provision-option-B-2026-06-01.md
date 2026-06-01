# Snapshot — provision Option B (deux projets Vercel séparés)

**Date** : 2026-06-01
**Auteur** : opérateur de bord — phase de test de fonctionnalités Wave 3
**Décision documentée dans** : `docs/adr/ADR-008-hebergement-services-optimizer.md` (révision 2026-06-01)

## État du repo au moment de la provision

- Commit `main` : `4f84dc9` (merge PR #192, Wave 3 livrée code-side).
- Branche `main` propre, aucune PR en cours sur `services/optimizer` ou `apps/web`.
- Phase 06.7 : Waves 1 + 2 + 3 livrées côté code, 2 gates opérateur restantes (provision + walkthrough).

## Config Vercel existante avant la provision

- `vercel.json` racine : `framework: nextjs`, `regions: ["cdg1"]`. **Aucune config Services active** — l'Option A n'a jamais été activée après Wave 3.
- `services/optimizer/vercel.json` présent et configuré (runtime `python3.11`, `maxDuration: 10`, env `OPTIMIZER_TIME_LIMIT_SECONDS=3`) mais **non référencé** par le projet Vercel actuel.

## Objectif de cette provision

- Créer un projet Vercel séparé `tap-optimizer` avec Root Directory = `services/optimizer/`.
- Exposer une URL publique pour le service Python FastAPI.
- Configurer `OPTIMIZER_SERVICE_URL` côté `apps/web` (preview + production) pour relier le Route Handler Wave 3 au service Python.
- Mesurer le cold start (protocole DEC-079 (c)) et documenter p50 / p95 dans le SUMMARY 06.7-03.

## Action humaine attendue

Sous-ensemble du runbook A → B (`docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md`) — étapes 2, 3, 4, 5, 6 et 8 (les étapes 1 « snapshot avant bascule » et 7 « retrait config Services » sont sans objet puisque l'Option A n'a pas été activée).

- Étape 2 : créer le 2e projet Vercel `tap-optimizer`.
- Étape 3 : configurer les variables d'environnement et la branche de production.
- Étape 4 : premier déploiement et test `/health`.
- Étape 5 : mesure cold start (10 appels après inactivité, p50 / p95 documentés).
- Étape 6 : configurer `OPTIMIZER_SERVICE_URL` côté `apps/web`.
- Étape 8 : vérification E2E + walkthrough preview (Task 4 du plan Wave 3).

## Sortie attendue

- Une URL `https://tap-optimizer-<hash>.vercel.app` qui répond `200 OK` sur `/health`.
- Une mesure cold start p50 / p95 documentée dans `06.7-03-SUMMARY.md`.
- Un walkthrough preview validé sur le scénario complet du SUMMARY.

---

*Snapshot consigné avant action côté dashboard Vercel — sert de référence pour un éventuel post-mortem.*
