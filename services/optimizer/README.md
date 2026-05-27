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

Le service se déploie via le `Dockerfile` sur n'importe quel hébergeur de conteneurs.
Le choix du fournisseur reste à trancher (cf. DEC-079 dans `.planning/PROJECT.md`).
Le conteneur lit `PORT` au runtime — comportement standard de tout hébergeur de
conteneurs.

Une fois l'hébergeur choisi et le service déployé, exposer l'URL publique côté
Vercel (preview et production) :

```
OPTIMIZER_SERVICE_URL=https://<host>/
```

Cette variable est consommée par le Route Handler Next.js qui relaye `/solve`.

## Endpoints

- `GET /health` — sonde de disponibilité, retourne `{"status": "ok"}`
- `POST /solve` — résolution PDPTW, accepte un `SolveRequest`, retourne un `SolveResponse`
