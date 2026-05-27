"""
Tests pytest de l'API FastAPI (endpoints /health et /solve).
Cinq scénarios couvrant les cas nominaux, le cas vide, la validation
et l'absence de PII dans le contrat.
"""

import json

import pytest


# ---------------------------------------------------------------------------
# Scénario 1 — GET /health
# ---------------------------------------------------------------------------

def test_health(test_client):
    """GET /health retourne 200 avec {"status": "ok"}."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Scénario 2 — POST /solve avec instance valide (2 courses compatibles)
# ---------------------------------------------------------------------------

def test_solve_valid_instance(test_client, build_test_request, build_test_ride, build_test_vehicle):
    """POST /solve avec 2 courses compatibles retourne 200 et un SolveResponse parseable."""
    import uuid

    UUID1 = str(uuid.UUID("00000000-0000-0000-0000-000000000001"))
    UUID2 = str(uuid.UUID("00000000-0000-0000-0000-000000000002"))
    VEH1 = str(uuid.UUID("00000000-0000-0000-0000-000000000101"))

    ride1 = build_test_ride(
        id=UUID1,
        pickup=(-21.35, 55.47),
        dropoff=(-21.37, 55.49),
        scheduled_at="2026-05-22T04:00:00Z",
    )
    ride2 = build_test_ride(
        id=UUID2,
        pickup=(-21.34, 55.46),
        dropoff=(-21.37, 55.49),
        scheduled_at="2026-05-22T04:15:00Z",
    )
    vehicle = build_test_vehicle(id=VEH1, places_assises=4)
    req = build_test_request(rides=[ride1, ride2], vehicles=[vehicle])

    response = test_client.post("/solve", json=req.model_dump())

    assert response.status_code == 200
    data = response.json()
    assert "contract_version" in data
    assert data["contract_version"] == "1"
    assert "groupements" in data
    assert len(data["groupements"]) >= 1


# ---------------------------------------------------------------------------
# Scénario 3 — POST /solve avec 1 course non groupable
# ---------------------------------------------------------------------------

def test_solve_empty_rides(test_client, build_test_request, build_test_ride, build_test_vehicle):
    """
    POST /solve avec 1 seule course (non groupable par définition) :
    retourne 200 sans crash, groupements == [].
    """
    import uuid
    VEH1 = str(uuid.UUID("00000000-0000-0000-0000-000000000101"))

    ride = build_test_ride(scheduled_at="2026-05-22T04:00:00Z")
    vehicle = build_test_vehicle(id=VEH1, places_assises=4)
    req = build_test_request(rides=[ride], vehicles=[vehicle])

    response = test_client.post("/solve", json=req.model_dump())

    assert response.status_code == 200
    data = response.json()
    assert data["groupements"] == []


# ---------------------------------------------------------------------------
# Scénario 4 — POST /solve avec payload invalide (422)
# ---------------------------------------------------------------------------

def test_solve_invalid_payload(test_client):
    """POST /solve sans contract_version retourne 422 (validation pydantic/FastAPI)."""
    payload = {
        # contract_version manquant intentionnellement
        "date": "2026-05-22",
        "rides": [],
        "vehicles": [],
        "depot": [-20.8825, 55.4513],
        "correction_factor": 1.3,
        "avg_speed_kmh": 50.0,
        "time_limit_seconds": 3,
    }
    response = test_client.post("/solve", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Scénario 5 — Absence de PII dans le contrat
# ---------------------------------------------------------------------------

def test_no_pii_in_contract(build_test_request, build_test_ride, build_test_vehicle):
    """
    Un SolveRequest sérialisé en JSON ne contient aucun champ patient/nom/nir.
    Vérifie que le contrat pydantic est structurellement sans PII (D-08).
    """
    import uuid

    ride = build_test_ride(
        id=str(uuid.uuid4()),
        scheduled_at="2026-05-22T04:00:00Z",
    )
    vehicle = build_test_vehicle(id=str(uuid.uuid4()))
    req = build_test_request(rides=[ride], vehicles=[vehicle])

    serialized = req.model_dump_json()

    assert "patient" not in serialized.lower()
    assert "nom" not in serialized.lower()
    assert "nir" not in serialized.lower()
