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

## Déploiement (Railway)

Le service se déploie via Dockerfile sur Railway.app (region EU West / Frankfurt).
Le consommateur (Route Handler Next.js) doit configurer la variable d'environnement :

```
OPTIMIZER_SERVICE_URL=https://<service>.railway.app
```

Cette variable est à ajouter dans Vercel (preview et production) après création du projet
Railway. Voir `railway.json` pour la configuration du déploiement.

## Endpoints

- `GET /health` — sonde de disponibilité, retourne `{"status": "ok"}`
- `POST /solve` — résolution PDPTW, accepte un `SolveRequest`, retourne un `SolveResponse`
