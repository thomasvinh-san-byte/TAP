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

### Hébergement : projet Vercel séparé `tap-optimizer` (Option B — révision 2026-06-01, ADR-008)

Le service est déployé comme **projet Vercel séparé** (`tap-optimizer`) dont le
Root Directory pointe vers `services/optimizer/`. Le framework Python est
auto-détecté via `requirements.txt`. URL publique attendue :
`https://tap-optimizer-<hash>.vercel.app`.

Cette architecture isole le service Python dans son propre projet Vercel, sans
toucher au projet `apps/web` qui héberge le frontend Next.js.

Le fichier `services/optimizer/vercel.json` configure :
- `maxDuration: 10` secondes par invocation (plan Hobby Vercel).
- `OPTIMIZER_TIME_LIMIT_SECONDS=3` en production (contre 5 s en local) pour
  rester dans les limites d'exécution serverless avec marge (cf. DEC-079 (a)).

**Étapes de déploiement initial (opérateur)** — sous-ensemble du runbook
`docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md`
(étapes 2, 3, 4, 5, 6 et 8) :

1. **Créer le projet Vercel `tap-optimizer`** depuis le dashboard, Root
   Directory = `services/optimizer/`, framework Python auto-détecté,
   région `cdg1` (Paris).
2. **Configurer les variables d'environnement** :
   `OPTIMIZER_TIME_LIMIT_SECONDS=3` en Production, `=5` en Preview.
3. **Premier déploiement** et test `/health` :
   ```bash
   curl -sf https://tap-optimizer-<hash>.vercel.app/health
   # attendu : {"status":"ok"}
   ```
4. **Mesure cold start obligatoire (DEC-079 (c))** : après au moins
   5 minutes d'inactivité, exécuter 10 appels consécutifs au endpoint
   `/health` et mesurer p50 / p95. Documenter dans le SUMMARY de la Wave 3
   (`06.7-03-SUMMARY.md`). Script de mesure : annexe A du runbook.
5. **Configurer `OPTIMIZER_SERVICE_URL` côté `apps/web`** dans Vercel
   Settings → Environment Variables :
   ```
   OPTIMIZER_SERVICE_URL=https://tap-optimizer-<hash>.vercel.app
   ```
   (URL preview et URL production séparément). Redéployer `apps/web` pour
   prise en compte de la nouvelle variable.

### Développement local

```bash
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8080
```

L'API est accessible sur `http://localhost:8080`. La documentation auto-générée
est disponible sur `http://localhost:8080/docs`.

La variable d'environnement `OPTIMIZER_TIME_LIMIT_SECONDS` contrôle la limite
de temps du solveur (défaut : 5 s en local, 3 s en production Vercel).

Une fois le service déployé et `OPTIMIZER_SERVICE_URL` configurée côté
`apps/web`, le Route Handler `apps/web/src/app/api/optimizer/route.ts`
consomme `process.env.OPTIMIZER_SERVICE_URL` pour relayer les appels au
service Python.

## Endpoints

- `GET /health` — sonde de disponibilité, retourne `{"status": "ok"}`
- `POST /solve` — résolution PDPTW, accepte un `SolveRequest`, retourne un `SolveResponse`
