'use client';

import type { DriverPositionInput } from '@tap/shared';
import { POSITION_MAX_ACCURACY_M } from '@tap/shared';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Capture la position GPS courante via l'API navigateur.
 * NON BLOQUANT : si la permission est refusée, si l'acquisition timeout,
 * ou si l'accuracy est trop mauvaise, on renvoie `{}` — le pointage
 * métier s'exécute quand même côté caller (la position est un PLUS, pas
 * un prérequis).
 *
 * RETEX : la précision GPS dégrade en intérieur (immeubles, parkings) ;
 * un timeout court (8s) évite de bloquer la régulatrice / le chauffeur
 * sur un fix qui n'arrivera pas.
 */
export async function captureCurrentPosition(): Promise<DriverPositionInput> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return {};
  }

  return new Promise<DriverPositionInput>((resolve) => {
    let settled = false;
    const settle = (v: DriverPositionInput) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const timer = setTimeout(() => settle({}), 8_000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy > POSITION_MAX_ACCURACY_M) {
          // Trop floue côté client aussi — on n'envoie rien.
          settle({});
          return;
        }
        settle({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? undefined,
        });
      },
      () => {
        clearTimeout(timer);
        settle({});
      },
      {
        enableHighAccuracy: true,
        timeout: 8_000,
        maximumAge: 5_000,
      },
    );
  });
}
