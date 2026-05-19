export type RealtimeStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface CockpitPersonName {
  prenom: string | null;
  nom: string | null;
}

export interface CockpitRide {
  id: string;
  scheduled_at: string;
  status: string;
  pickup_address: string;
  dropoff_address: string | null;
  patient: CockpitPersonName | null;
  driver: CockpitPersonName | null;
}

export type CockpitAlertType = 'patient_no_show' | 'sms_failed' | 'ride_delayed';

export interface CockpitAlert {
  id: string;
  ride_id: string | null;
  event_type: CockpitAlertType;
  payload: Record<string, unknown> | null;
  created_at: string;
}
