"""
Extraction des groupements depuis la solution OR-Tools.
Séparé de solver.py pour respecter la limite de 300 lignes par fichier (CLAUDE.md §11).
"""

from haversine import haversine_km
from models import Groupement, RideNode, SolveResponse, VehicleNode


def extract_groupements(
    routing,
    manager,
    solution,
    rides: list[RideNode],
    vehicles: list[VehicleNode],
    dm: list[list[float]],
) -> SolveResponse:
    """
    Parcourt la solution OR-Tools véhicule par véhicule.
    Construit les Groupement (>= 2 courses) et identifie les courses non groupées.
    Calcule km_a_vide_estimes (km sans passager entre un dropoff et le prochain pickup).
    """
    rides_dans_groupement: set[str] = set()
    groupements: list[Groupement] = []
    km_a_vide_total = 0.0

    for vehicle_idx in range(len(vehicles)):
        route_ride_ids, route_node_order, km_a_vide_veh = _parcourir_route(
            routing, manager, solution, rides, vehicle_idx, dm
        )

        if len(route_ride_ids) >= 2:
            vehicle_id = vehicles[vehicle_idx].id
            groupements.append(
                Groupement(
                    vehicle_id=vehicle_id,
                    ride_ids=route_ride_ids,
                    order=route_node_order,
                    motif="compatibilite horaire et trajet commun",
                    gain_km_a_vide=round(km_a_vide_veh, 2),
                )
            )
            rides_dans_groupement.update(route_ride_ids)
        km_a_vide_total += km_a_vide_veh

    rides_non_groupees = [r.id for r in rides if r.id not in rides_dans_groupement]

    return SolveResponse(
        contract_version="1",
        groupements=groupements,
        rides_non_groupees_ids=rides_non_groupees,
        rides_exclues_ids=[],
        km_a_vide_estimes=round(km_a_vide_total, 2),
    )


def _parcourir_route(
    routing,
    manager,
    solution,
    rides: list[RideNode],
    vehicle_idx: int,
    dm: list[list[float]],
) -> tuple[list[str], list[str], float]:
    """
    Parcourt la route d'un véhicule dans la solution.
    Retourne (ride_ids_servis, order_uuids, km_a_vide).
    """
    ride_ids_servis: list[str] = []
    order_uuids: list[str] = []
    km_a_vide = 0.0
    last_node_was_dropoff = False
    last_dropoff_node: int | None = None

    index = routing.Start(vehicle_idx)
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node != 0:  # ignorer le dépôt
            ride_i = (node - 1) // 2
            is_pickup = (node - 1) % 2 == 0
            ride = rides[ride_i]

            if is_pickup:
                order_uuids.append(ride.id + ":pickup")
                if last_node_was_dropoff and last_dropoff_node is not None:
                    km_a_vide += dm[last_dropoff_node][node]
                last_node_was_dropoff = False
                last_dropoff_node = None
            else:
                order_uuids.append(ride.id + ":dropoff")
                if ride.id not in ride_ids_servis:
                    ride_ids_servis.append(ride.id)
                last_node_was_dropoff = True
                last_dropoff_node = node

        index = solution.Value(routing.NextVar(index))

    # order contient les UUIDs (sans :pickup/:dropoff) dans l'ordre de passage
    order_clean = [entry.split(":")[0] for entry in order_uuids]

    return ride_ids_servis, order_clean, km_a_vide
