# apps/web/api/solver

Service Python d'optimisation de tournées (PDPTW via OR-Tools) déployé comme
**Vercel Python serverless function** dans le même projet Vercel que
`apps/web` (voie hybride single-projet — ADR-008 révision 2026-06-01).

## Endpoints exposés

Convention Vercel : le dossier `api/` à la racine du Root Directory expose ses
fonctions sous `/api/...`. Les routes sont préfixées par `/api/solver` :

- `GET  /api/solver/health` — sonde de disponibilité, retourne `{"status":"ok"}`.
- `POST /api/solver/solve` — résolution PDPTW, accepte un `SolveRequest`,
  retourne un `SolveResponse`.

Le Route Handler Next.js `apps/web/src/app/api/optimizer/route.ts` (qui fait
l'auth Supabase, la vérification de rôle, la dé-identification D-08 et la
lecture des courses) appelle ce service via `fetch` interne au même domaine
Vercel — URL construite depuis `process.env.VERCEL_URL`.

## Architecture

- `index.py` — application FastAPI avec `APIRouter(prefix="/api/solver")`.
- `solver.py` — résolution PDPTW (OR-Tools).
- `models.py` — modèles pydantic miroir du contrat zod de `@tap/optimizer-client`.
- `haversine.py` — distance routière approximée (DEC-056, voie hybride).
- `_extract.py` — extraction des groupements depuis la solution OR-Tools.
- `requirements.txt` — dépendances runtime (`fastapi`, `ortools`, `pydantic`,
  `uvicorn[standard]`).
- `requirements-dev.txt` — dépendances de test (`pytest`, `httpx`).
- `tests/` — 11 tests pytest (6 solveur + 5 API).

## Configuration Vercel

Déclarée dans `vercel.json` racine :

```json
"functions": {
  "apps/web/api/solver/index.py": {
    "maxDuration": 10,
    "excludeFiles": "{apps/web/.next/**,...}"
  }
}
```

L'`excludeFiles` est crucial : sans lui, le bundle Python embarque
accidentellement le build Next.js et dépasse la limite de 250 MB unzipped
documentée par Vercel.

Variables d'environnement par environnement (configurées via Vercel UI sur
le projet `apps/web`, **pas** dans `vercel.json`) :

- `OPTIMIZER_TIME_LIMIT_SECONDS=3` en Production (DEC-079 (a)).
- `OPTIMIZER_TIME_LIMIT_SECONDS=5` en Preview / Development.

## Développement local

```bash
cd apps/web/api/solver
pip install -r requirements-dev.txt
python -m pytest -q
```

Pour développer le service ensemble avec Next.js :

```bash
vercel dev
```

(Le runtime Python s'active automatiquement via `requirements.txt`.)
