# services/optimizer

Microservice Python exposant un solveur PDPTW (Pickup & Delivery Problem with Time Windows)
via OR-Tools. Regroupe et ordonne les courses compatibles pour la journée d'un transporteur.

## Rôle

Ce service reçoit une liste de courses dé-identifiées (IDs opaques, coordonnées, horaires,
contraintes) et retourne des groupements de courses compatibles avec leur ordre de passage.
Aucune donnée patient nominative (nom, NIR) ne transite par ce service.

## Lancement local

```bash
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8080
```

L'API est accessible sur `http://localhost:8080`. La documentation auto-générée est disponible
sur `http://localhost:8080/docs`.

## Tests

```bash
pytest
```

## Déploiement

### Hébergement : Vercel Python serverless — Option A (DEC-079 LOCKED, ADR-008)

Le service est hébergé sur **Vercel Python serverless**, dans le même projet Vercel
que `apps/web`, via l'architecture **Vercel Services** (Option A — un seul projet,
routage par sous-chemin URL).

Le fichier `services/optimizer/vercel.json` configure :
- `maxDuration: 10` secondes par invocation (plan Hobby Vercel).
- `OPTIMIZER_TIME_LIMIT_SECONDS=3` en production (contre 5 s en local) pour rester
  dans les limites d'exécution serverless avec marge.

**Étapes de déploiement initial (opérateur) :**

1. Dans le dashboard Vercel du projet, activer la feature **Services** et pointer
   le service Python vers `services/optimizer/`.
2. Configurer `OPTIMIZER_SERVICE_URL` côté `apps/web` (preview et production) :
   ```
   OPTIMIZER_SERVICE_URL=https://<deployment>.vercel.app/optimizer
   ```
3. Déclencher un premier déploiement (`git push` ou redeploy dans le dashboard).
4. **Mesure cold start obligatoire (DEC-079 (c))** : après au moins 5 minutes
   d'inactivité, exécuter 10 appels consécutifs au endpoint `/health` et mesurer
   p50/p95. Documenter dans le SUMMARY de la Wave 3.
   ```bash
   for i in {1..10}; do
     time curl -sf "$OPTIMIZER_SERVICE_URL/health"
     sleep 1
   done
   ```
5. Si p95 > 5 s : déclencher le repli vers Clever Cloud (DEC-079 (c)). Voir le
   runbook `docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md`.

### Repli : Clever Cloud (si p95 cold start > 5 s)

Le `Dockerfile` est conservé et maintenu en état fonctionnel pour permettre une
bascule sans réécriture vers Clever Cloud (DEC-079 (c)). Instructions de bascule
dans `docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md`.

### Développement local

```bash
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8080
```

L'API est accessible sur `http://localhost:8080`. La documentation auto-générée est
disponible sur `http://localhost:8080/docs`.

La variable d'environnement `OPTIMIZER_TIME_LIMIT_SECONDS` contrôle la limite de
temps du solveur (défaut : 5 s en local, 3 s en production Vercel).

Une fois le service déployé, exposer l'URL publique côté Vercel (preview et production) :

```
OPTIMIZER_SERVICE_URL=https://<host>/optimizer
```

Cette variable est consommée par le Route Handler Next.js qui relaye `/solve`.

## Endpoints

- `GET /health` — sonde de disponibilité, retourne `{"status": "ok"}`
- `POST /solve` — résolution PDPTW, accepte un `SolveRequest`, retourne un `SolveResponse`
