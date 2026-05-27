"""
Calcul de distance Haversine et matrice de distance corrigée.
Pas de dépendance tierce — stdlib Python uniquement (D-09).
"""

import math
from typing import Sequence

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Distance Haversine entre deux points géographiques, en kilomètres.
    Formule standard (rayon Terre 6371 km).
    """
    r = math.radians
    dlat = r(lat2 - lat1)
    dlng = r(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_matrix(
    coords: Sequence[tuple[float, float]],
    correction_factor: float,
) -> list[list[float]]:
    """
    Matrice NxN de distances Haversine × facteur_correction routier (DEC-056).
    coords[0] = dépôt fictif.
    Diagonale nulle, matrice symétrique.
    """
    n = len(coords)
    return [
        [
            haversine_km(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            * correction_factor
            for j in range(n)
        ]
        for i in range(n)
    ]
