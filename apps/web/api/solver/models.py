"""
Modèles pydantic du contrat solveur PDPTW.
VERSION DU CONTRAT : "1" — miroir Python du schéma zod côté TS (Wave 2).
Aucun champ nominatif patient : IDs opaques + coordonnées + horaires uniquement (D-08).
"""

from typing import Literal

from pydantic import BaseModel, Field

# Constante de version du contrat — à incrémenter manuellement si le schéma change.
# Le client TS (packages/optimizer-client) doit rester synchronisé.
CONTRACT_VERSION = "1"


class RideNode(BaseModel):
    """
    Représentation dé-identifiée d'une course pour le solveur.
    JAMAIS de nom patient, NIR ou donnée identifiante (D-08).
    """

    id: str = Field(description="UUID opaque de la course")
    pickup: tuple[float, float] = Field(description="[lat, lng] du point de prise en charge")
    dropoff: tuple[float, float] = Field(description="[lat, lng] du point de dépose")
    scheduled_at: str = Field(description="Horodatage ISO 8601 avec offset")
    urgency: Literal["programmee", "urgente", "immediate"]
    transport_mode: Literal["taxi_conventionne", "tpmr", "vsl", "ambulance"]


class VehicleNode(BaseModel):
    """Représentation d'un véhicule disponible pour le solveur."""

    id: str = Field(description="UUID opaque du véhicule")
    type: Literal["taxi", "tpmr", "vsl", "ambulance"]
    places_assises: int = Field(ge=1, le=20)
    places_tpmr: int = Field(ge=0, le=4)


class SolveRequest(BaseModel):
    """
    Requête de résolution PDPTW.
    Contrat Python — miroir du SolveRequestSchema zod côté TS.
    """

    contract_version: Literal["1"] = CONTRACT_VERSION
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD")
    rides: list[RideNode] = Field(min_length=1, max_length=200)
    vehicles: list[VehicleNode] = Field(min_length=1)
    depot: tuple[float, float] = Field(description="[lat, lng] du dépôt fictif")
    correction_factor: float = Field(ge=1.0, le=2.0, description="Facteur de correction routier (DEC-056)")
    avg_speed_kmh: float = Field(ge=10.0, le=120.0, description="Vitesse moyenne paramétrée (D-12)")
    time_limit_seconds: int = Field(ge=2, le=5, description="Durée max du solveur (D-05)")


class Groupement(BaseModel):
    """
    Groupement de courses compatible proposé par le solveur.
    Toujours >= 2 courses (une seule course = rides_non_groupees_ids).
    """

    vehicle_id: str
    ride_ids: list[str] = Field(min_length=2)
    order: list[str] = Field(description="Ordre de passage (UUIDs)")
    motif: str = Field(max_length=120, description="Justification courte en français")
    gain_km_a_vide: float = Field(ge=0.0)


class SolveResponse(BaseModel):
    """
    Réponse du solveur PDPTW.
    Contrat Python — miroir du SolveResponseSchema zod côté TS.
    """

    contract_version: Literal["1"] = CONTRACT_VERSION
    groupements: list[Groupement] = Field(default_factory=list)
    rides_non_groupees_ids: list[str] = Field(default_factory=list)
    rides_exclues_ids: list[str] = Field(
        default_factory=list,
        description="Toujours [] côté service — le filtre coordonnées est dans le Route Handler (D-17)",
    )
    km_a_vide_estimes: float = Field(ge=0.0, default=0.0)
