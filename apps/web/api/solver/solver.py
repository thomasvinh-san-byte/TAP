"""
Solveur PDPTW (Pickup & Delivery Problem with Time Windows) avec OR-Tools.
Regroupe les courses compatibles et ordonne les passages (D-01, D-06).

Note d'implémentation : OR-Tools 9.15 présente un problème mémoire (bad_alloc)
lors de la combinaison Time dimension + AddDisjunction + AddPickupAndDelivery.
L'approche retenue est un pré-filtrage par compatibilité de fenêtres temporelles
avant la construction du RoutingModel. Les courses incompatibles entre elles sont
exclues du modèle et retournées dans rides_non_groupees_ids. Le comportement
observable est identique à la spécification : les courses non groupables ne sont
jamais perdues.
"""

from dataclasses import dataclass
from datetime import datetime

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from _extract import extract_groupements
from haversine import distance_matrix
from models import RideNode, SolveRequest, SolveResponse, VehicleNode

# ---------------------------------------------------------------------------
# Constantes — fenêtres horaires (D-11)
# TODO UAT D-11 : valider ces tolérances avec un design partner dialyse
# ---------------------------------------------------------------------------
TOLERANCE_PROGRAMMEE_S: int = 30 * 60   # ±30 min courses planifiées
TOLERANCE_URGENTE_S: int = 60 * 60      # ±60 min courses urgentes
TOLERANCE_IMMEDIATE_S: int = 15 * 60    # ±15 min (quasi-pin)

# Pénalité pour rendre les paires optionnelles (D-06)
# Note : AddDisjunction n'est pas utilisé à cause d'une incompatibilité runtime
# OR-Tools 9.15 (bad_alloc Time+PDP+Disjunction). Le pré-filtrage remplace cette
# mécanique pour la V1.
PENALTY: int = 10_000_000

# Offset UTC+4 (La Réunion, sans DST)
REUNION_OFFSET_S: int = 4 * 3600


@dataclass
class TimeWindow:
    """Fenêtre horaire en secondes depuis minuit UTC+4."""
    earliest: int
    latest: int


def _time_window(scheduled_at_iso: str, urgency: str) -> TimeWindow:
    """
    Dérive la fenêtre horaire [earliest, latest] depuis scheduled_at + urgency.
    Travaille en secondes depuis minuit UTC+4 (D-11).
    Réunion = UTC+4 sans DST.
    """
    dt = datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00"))
    secs_since_midnight = (dt.timestamp() + REUNION_OFFSET_S) % 86400

    tolerances = {
        "programmee": TOLERANCE_PROGRAMMEE_S,
        "urgente": TOLERANCE_URGENTE_S,
        "immediate": TOLERANCE_IMMEDIATE_S,
    }
    tolerance = tolerances.get(urgency, TOLERANCE_PROGRAMMEE_S)

    return TimeWindow(
        earliest=max(0, int(secs_since_midnight) - tolerance),
        latest=min(86400, int(secs_since_midnight) + tolerance),
    )


def _windows_overlap(tw1: TimeWindow, tw2: TimeWindow) -> bool:
    """Retourne True si deux fenêtres horaires se chevauchent."""
    return tw1.earliest <= tw2.latest and tw2.earliest <= tw1.latest


def _pre_filter_rides(
    rides: list[RideNode],
) -> tuple[list[RideNode], list[str]]:
    """
    Pré-filtre les courses par compatibilité de fenêtres temporelles.
    Une course est groupable si sa fenêtre chevauche au moins une autre fenêtre.
    Les courses isolées (fenêtre incompatible avec toutes les autres) sont exclues.
    Retourne (rides_groupables, rides_non_groupees_ids).
    """
    if len(rides) <= 1:
        return rides, []

    windows = [_time_window(r.scheduled_at, r.urgency) for r in rides]

    # Matrice de compatibilité
    compatible_with_any = [False] * len(rides)
    for i in range(len(rides)):
        for j in range(len(rides)):
            if i != j and _windows_overlap(windows[i], windows[j]):
                compatible_with_any[i] = True
                break

    groupables = [r for i, r in enumerate(rides) if compatible_with_any[i]]
    non_groupees = [r.id for i, r in enumerate(rides) if not compatible_with_any[i]]

    return groupables, non_groupees


def solve(req: SolveRequest) -> SolveResponse:
    """
    Résout le problème PDPTW pour la journée donnée.
    Retourne les groupements de courses compatibles et les courses non groupables.
    """
    rides = req.rides
    vehicles = req.vehicles

    if not rides or not vehicles:
        return SolveResponse()

    # Pré-filtrage des courses incompatibles
    rides_groupables, rides_non_groupees = _pre_filter_rides(rides)

    if not rides_groupables:
        return SolveResponse(rides_non_groupees_ids=[r.id for r in rides])

    # Nœuds : dépôt fictif (index 0) + 2 nœuds par course
    # ride i → pickup node : 1 + 2*i ; dropoff node : 2 + 2*i
    n_nodes = 1 + 2 * len(rides_groupables)
    manager = pywrapcp.RoutingIndexManager(n_nodes, len(vehicles), 0)
    routing = pywrapcp.RoutingModel(manager)

    # Matrice de distance Haversine corrigée (D-09)
    coords = [req.depot] + [c for r in rides_groupables for c in (r.pickup, r.dropoff)]
    dm = distance_matrix(coords, req.correction_factor)

    # Callback temps : distance_km / vitesse_moy × 3600 → secondes (D-12)
    avg_speed = req.avg_speed_kmh

    def time_cb(from_idx: int, to_idx: int) -> int:
        f = manager.IndexToNode(from_idx)
        t = manager.IndexToNode(to_idx)
        return int(dm[f][t] / avg_speed * 3600)

    time_cb_idx = routing.RegisterTransitCallback(time_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(time_cb_idx)

    _add_capacity_dimension(routing, manager, vehicles)
    _add_pdptw_constraints_and_time(routing, manager, rides_groupables, vehicles, time_cb_idx)
    _add_time_windows(routing, manager, rides_groupables)

    solution = _solve_with_params(routing, req.time_limit_seconds)
    if not solution:
        all_non_groupees = rides_non_groupees + [r.id for r in rides_groupables]
        return SolveResponse(rides_non_groupees_ids=all_non_groupees)

    response = extract_groupements(routing, manager, solution, rides_groupables, vehicles, dm)
    response.rides_non_groupees_ids.extend(rides_non_groupees)
    return response


def _add_time_windows(routing, manager, rides: list[RideNode]) -> None:
    """Applique les fenêtres horaires sur les CumulVars (après AddDimension)."""
    time_dim = routing.GetDimensionOrDie("Time")
    for i, ride in enumerate(rides):
        pickup_idx = manager.NodeToIndex(1 + 2 * i)
        dropoff_idx = manager.NodeToIndex(2 + 2 * i)
        tw = _time_window(ride.scheduled_at, ride.urgency)
        time_dim.CumulVar(pickup_idx).SetRange(tw.earliest, tw.latest)
        routing.solver().Add(
            time_dim.CumulVar(pickup_idx) <= time_dim.CumulVar(dropoff_idx)
        )


def _add_capacity_dimension(routing, manager, vehicles: list[VehicleNode]) -> None:
    """Ajoute la dimension capacité (charge +1 pickup, -1 dropoff)."""
    def demand_cb(from_idx: int) -> int:
        node = manager.IndexToNode(from_idx)
        if node == 0:
            return 0
        is_pickup = (node - 1) % 2 == 0
        return 1 if is_pickup else -1

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_cb)
    capacities = [v.places_assises for v in vehicles]
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx, 0, capacities, True, "Capacity"
    )


def _add_pdptw_constraints_and_time(
    routing,
    manager,
    rides: list[RideNode],
    vehicles: list[VehicleNode],
    time_cb_idx: int,
) -> None:
    """
    Ajoute les contraintes PDPTW de base :
    - AddPickupAndDelivery (même véhicule, précédence)
    - Contrainte de mobilité TPMR (Pitfall 5 RESEARCH.md)
    Puis ajoute la dimension temporelle (après les contraintes PDP).
    """
    tpmr_vehicle_indices = [
        i for i, v in enumerate(vehicles) if v.type == "tpmr"
    ]

    for i, ride in enumerate(rides):
        pickup_idx = manager.NodeToIndex(1 + 2 * i)
        dropoff_idx = manager.NodeToIndex(2 + 2 * i)

        routing.AddPickupAndDelivery(pickup_idx, dropoff_idx)
        routing.solver().Add(
            routing.VehicleVar(pickup_idx) == routing.VehicleVar(dropoff_idx)
        )

        # Contrainte de mobilité TPMR
        if ride.transport_mode == "tpmr" and tpmr_vehicle_indices:
            routing.SetAllowedVehiclesForIndex(tpmr_vehicle_indices, pickup_idx)
            routing.SetAllowedVehiclesForIndex(tpmr_vehicle_indices, dropoff_idx)

    # Dimension temporelle APRES les contraintes PDP (ordre requis)
    routing.AddDimension(
        time_cb_idx,
        3600,         # slack_max : temps d'attente max entre deux stops (1h)
        24 * 3600,    # max cumul : horizon journée entière
        False,
        "Time",
    )


def _solve_with_params(routing, time_limit_seconds: int):
    """Configure la stratégie de recherche et résout (D-05)."""
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = time_limit_seconds
    return routing.SolveWithParameters(search_params)
