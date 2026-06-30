export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface CockpitPersonName {
  prenom: string | null;
  nom: string | null;
}

/**
 * Table `drivers` : pas de `prenom`/`nom` séparés, uniquement `nom_affichage`
 * (consolidé par migration). Type distinct de `CockpitPersonName` qui reste
 * valide pour `patient` (table `patients` a bien `prenom` + `nom`).
 */
export interface CockpitDriverName {
  nom_affichage: string | null;
}

export interface CockpitRide {
  id: string;
  scheduled_at: string;
  status: string;
  pickup_address: string;
  dropoff_address: string | null;
  // COCKPIT-02 : nécessaire pour croiser positions ↔ courses (« en service »).
  driver_id: string | null;
  patient: CockpitPersonName | null;
  driver: CockpitDriverName | null;
}

export type CockpitAlertType =
  | 'patient_no_show'
  | 'sms_failed'
  | 'ride_delayed'
  | 'driver_incident'
  // COCKPIT-01 (§5.13) : course validée non affectée à moins d'1h du créneau.
  // Calculée côté client (échéance temporelle), pas issue de `ride_events`.
  | 'ride_unassigned_h1'
  // COCKPIT-02 (§5.13) : position d'un chauffeur en service non remontée depuis
  // > 5 min. Calculée côté client (âge de la position), pas issue de `ride_events`.
  | 'driver_position_stale';

export interface CockpitAlert {
  id: string;
  ride_id: string | null;
  event_type: CockpitAlertType;
  payload: Record<string, unknown> | null;
  created_at: string;
}
