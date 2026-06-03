"""
Application FastAPI du service d'optimisation de tournées.
Voie hybride single-projet Vercel : ce fichier est déployé comme une
Vercel Python serverless function dans le même projet que apps/web.

Convention Vercel : ce fichier `apps/web/py/solver/index.py` (déplacé hors
de /api/ après PR #207, voir ADR-009 et 06.10-01-PLAN.md) est routé par
Vercel sous `/api/solver/*` via la config legacy `builds`/`routes` (PR
#208). Les routes définies ici (`/health`, `/solve`) sont relatives à
cette base, donc accessibles à `/api/solver/health` et `/api/solver/solve`
côté HTTP public.
Le préfixe `/api/solver` est géré par Vercel, PAS par FastAPI.
"""

import os
import sys

# Fix Vercel : le runtime charge ce module via importlib depuis /var/task/
# (CWD), donc sys.path ne contient pas le dossier du fichier. Les imports
# plats (`from models import ...`, `from solver import ...`) ne trouvent
# pas les modules adjacents sans ce patch. Local pytest n'a pas ce souci
# (pytest.ini configure pythonpath = .).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import SolveRequest, SolveResponse
from solver import solve

app = FastAPI(
    title="Optimizer Service",
    description="Service de résolution PDPTW pour l'optimisation de tournées TAP.",
    version="1.0.0",
)

# CORS minimal — le service ne manipule aucune donnée patient (D-08).
# ALLOWED_ORIGIN peut être restreint à l'URL Vercel en production.
_allowed_origins = os.getenv("ALLOWED_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_allowed_origins] if _allowed_origins != "*" else ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Sonde de disponibilité (healthcheck hébergeur + Route Handler Next.js)."""
    return {"status": "ok"}


@router.post("/solve", response_model=SolveResponse)
async def solve_endpoint(request: SolveRequest) -> SolveResponse:
    """
    Résout le problème PDPTW pour la liste de courses reçue.
    Le payload est dé-identifié (IDs opaques, coordonnées, horaires — D-08).
    Aucun log du contenu métier du payload.
    """
    return solve(request)


app.include_router(router)
