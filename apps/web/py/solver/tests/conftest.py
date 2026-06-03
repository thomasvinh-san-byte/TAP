"""
Fixtures pytest partagées pour les tests du service optimizer.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from models import RideNode, VehicleNode, SolveRequest


# Coordonnées de dépôt fictif (centre de Saint-Denis)
DEPOT_DEFAULT = (-20.8825, 55.4513)

# UUIDs stables pour les fixtures
_DEFAULT_RIDE_ID = str(uuid.UUID("00000000-0000-0000-0000-000000000001"))
_DEFAULT_VEH_ID = str(uuid.UUID("00000000-0000-0000-0000-000000000101"))


# ---------------------------------------------------------------------------
# Factories (fonctions utilitaires — non fixtures)
# ---------------------------------------------------------------------------

def build_test_ride(**overrides) -> RideNode:
    """
    Construit un RideNode valide avec des valeurs par défaut surchargeable.
    Aucun champ nominatif patient (D-08).
    """
    defaults = {
        "id": overrides.pop("id", str(uuid.uuid4())),
        "pickup": (-21.35, 55.47),
        "dropoff": (-21.37, 55.49),
        "scheduled_at": "2026-05-22T04:00:00Z",
        "urgency": "programmee",
        "transport_mode": "taxi_conventionne",
    }
    defaults.update(overrides)
    return RideNode(**defaults)


def build_test_vehicle(**overrides) -> VehicleNode:
    """
    Construit un VehicleNode valide avec des valeurs par défaut surchargeable.
    """
    defaults = {
        "id": overrides.pop("id", str(uuid.uuid4())),
        "type": "taxi",
        "places_assises": 4,
        "places_tpmr": 0,
    }
    defaults.update(overrides)
    return VehicleNode(**defaults)


def build_test_request(
    rides: list | None = None,
    vehicles: list | None = None,
) -> SolveRequest:
    """
    Construit un SolveRequest valide minimal.
    contract_version="1", depot Saint-Denis, facteurs calibrés.
    """
    if rides is None:
        rides = [build_test_ride()]
    if vehicles is None:
        vehicles = [build_test_vehicle()]

    return SolveRequest(
        contract_version="1",
        date="2026-05-22",
        rides=rides,
        vehicles=vehicles,
        depot=DEPOT_DEFAULT,
        correction_factor=1.3,
        avg_speed_kmh=50.0,
        time_limit_seconds=3,
    )


# ---------------------------------------------------------------------------
# Fixtures pytest (expose les factories comme fixtures injectables)
# ---------------------------------------------------------------------------

@pytest.fixture
def build_test_ride_fn():
    """Retourne la factory build_test_ride."""
    return build_test_ride


@pytest.fixture
def build_test_vehicle_fn():
    """Retourne la factory build_test_vehicle."""
    return build_test_vehicle


@pytest.fixture
def build_test_request_fn():
    """Retourne la factory build_test_request."""
    return build_test_request


# Fixtures directes (injection via nom de paramètre)
# Note: ces fixtures retournent les fonctions factory elles-mêmes,
# ce qui permet aux tests d'appeler build_test_ride(id=..., ...) etc.
@pytest.fixture(name="build_test_ride")
def fixture_build_test_ride():
    return build_test_ride


@pytest.fixture(name="build_test_vehicle")
def fixture_build_test_vehicle():
    return build_test_vehicle


@pytest.fixture(name="build_test_request")
def fixture_build_test_request():
    return build_test_request


@pytest.fixture
def test_client():
    """Client de test httpx synchrone sur l'application FastAPI."""
    from index import app
    return TestClient(app)
