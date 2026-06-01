"""
Application FastAPI du service d'optimisation de tournées.
Voie hybride single-projet Vercel : ce fichier est déployé comme une
Vercel Python serverless function dans le même projet que apps/web.

Les routes sont préfixées par /api/solver (convention Vercel : le dossier
api/ à la racine du Root Directory expose ses fonctions sous /api/...).
"""

import os

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

router = APIRouter(prefix="/api/solver")


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
