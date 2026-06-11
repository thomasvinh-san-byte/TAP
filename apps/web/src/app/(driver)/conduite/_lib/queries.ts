/**
 * Queries RSC du module /conduite (Phase 3 Passe 1, sous-bloc 03-B).
 *
 * Lectures RLS-protégées + filtre applicatif par chauffeur authentifié.
 *
 * Sécurité :
 *   - RLS Phase 2 (rides_select_same_org) garantit l'isolation tenant.
 *   - Le filtre `driver_id = mon driver` est applicatif ici (pas de policy
 *     SELECT par rôle chauffeur — un chauffeur peut techniquement voir les
 *     rides same-org via SELECT). On ne RETOURNE que les siennes au RSC.
 *   - On lit les coordonnées patient via `patients_safe` (vue Phase 1
 *     security_invoker, masque le ciphertext NIR — DEC-NIR).
 *
 * TODO(types) : `drivers` + colonnes `rides` étendues absents de
 * types.gen.ts jusqu'à régénération nightly. Casts ciblés en attendant.
 */

import 'server-only';
import { getAuthContext, type AuthContext } from '@/lib/auth/get-auth-context';

// --------------------------------------------------------------------------
// Types de retour exposés à l'UI 03-E (cartes + détail course)
// --------------------------------------------------------------------------

export type DriverRideStatus =
  | 'assignee'
  | 'en_cours'
  | 'terminee'
  | 'annulee_regulateur'
  | 'annulee_patient'
  | 'annulee_chauffeur';

export type RideForDriverList = {
  id: string;
  scheduled_at: string;
  status: DriverRideStatus;
  pickup_address: string;
  pickup_postal_code: string | null;
  pickup_city: string | null;
  dropoff_address: string;
  dropoff_postal_code: string | null;
  dropoff_city: string | null;
  transport_mode: string;
  urgency: string;
  notes_regulateur: string | null;
  started_at: string | null;
  ended_at: string | null;
  tarif_amount_eur: number | null;
  payment_status: string;
  payment_method: string | null;
  patient: {
    id: string;
    nom: string;
    prenom: string;
    telephone: string | null;
  };
};

// --------------------------------------------------------------------------
// Helpers internes
// --------------------------------------------------------------------------

type DriverIdRow = { id: string };

async function resolveMyDriverId(ctx: AuthContext): Promise<string | null> {
  const res = await ctx.supabase
    .from('drivers')
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('organization_id', ctx.organizationId)
    .eq('archive', false)
    .maybeSingle();

  if (res.error) {
    // Logging défensif pattern PR #63 (DEC-039 esprit defense in depth).
    // Pas de PII : profile_id + organization_id = UUIDs non-PII (DEC-030
    // conformité). Pas de NIR, pas de tokens, pas de notes médicales.
    console.error('[conduite] resolveMyDriverId query failed', {
      message: res.error.message,
      code: res.error.code,
      details: res.error.details,
      hint: res.error.hint,
      user_id: ctx.userId,
      role: ctx.role,
      organization_id: ctx.organizationId,
    });
  }

  return ((res.data as DriverIdRow | null) ?? null)?.id ?? null;
}

/**
 * Bornes [aujourd'hui 00h00 ; après-demain 00h00) en TZ Indian/Reunion
 * (UTC+4, pas de DST). Couvre J + J+1 dans la même requête — le chauffeur
 * voit ce qui l'attend dans les 48 prochaines heures.
 *
 * Pas de dépendance Intl/DateTimeFormat : on décale `now` de +4 h pour
 * obtenir la « date locale » Réunion, puis on soustrait l'offset pour
 * remonter en UTC. `tomorrowStartIso` sert au regroupement UI (cluster
 * « Aujourd'hui » vs « Demain » côté page.tsx).
 */
const REUNION_OFFSET_HOURS = 4;

function reunionUpcomingBoundsIso(now = new Date()): {
  startIso: string;
  endIso: string;
  tomorrowStartIso: string;
} {
  const reunionNow = new Date(now.getTime() + REUNION_OFFSET_HOURS * 60 * 60 * 1000);
  const y = reunionNow.getUTCFullYear();
  const m = reunionNow.getUTCMonth();
  const d = reunionNow.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0, 0) - REUNION_OFFSET_HOURS * 60 * 60 * 1000;
  const tomorrowStartUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 48 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    tomorrowStartIso: new Date(tomorrowStartUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

const RIDE_FOR_DRIVER_COLUMNS =
  'id, patient_id, scheduled_at, status, ' +
  'pickup_address, pickup_postal_code, pickup_city, ' +
  'dropoff_address, dropoff_postal_code, dropoff_city, ' +
  'transport_mode, urgency, notes_regulateur, ' +
  'started_at, ended_at, tarif_amount_eur, ' +
  'payment_status, payment_method';

type RawRideRow = {
  id: string;
  patient_id: string;
  scheduled_at: string;
  status: DriverRideStatus;
  pickup_address: string;
  pickup_postal_code: string | null;
  pickup_city: string | null;
  dropoff_address: string;
  dropoff_postal_code: string | null;
  dropoff_city: string | null;
  transport_mode: string;
  urgency: string;
  notes_regulateur: string | null;
  started_at: string | null;
  ended_at: string | null;
  tarif_amount_eur: number | null;
  payment_status: string;
  payment_method: string | null;
};

type PatientSafeMin = {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
};

async function fetchPatientsByIds(
  ctx: AuthContext,
  ids: string[],
): Promise<Map<string, PatientSafeMin>> {
  const map = new Map<string, PatientSafeMin>();
  if (ids.length === 0) return map;
  const { data } = await ctx.supabase
    .from('patients_safe')
    .select('id, nom, prenom, telephone')
    .in('id', ids);
  for (const row of (data ?? []) as PatientSafeMin[]) {
    if (row.id) map.set(row.id, row);
  }
  return map;
}

function joinPatient(
  ride: RawRideRow,
  patientsById: Map<string, PatientSafeMin>,
): RideForDriverList {
  const p = patientsById.get(ride.patient_id);
  return {
    id: ride.id,
    scheduled_at: ride.scheduled_at,
    status: ride.status,
    pickup_address: ride.pickup_address,
    pickup_postal_code: ride.pickup_postal_code,
    pickup_city: ride.pickup_city,
    dropoff_address: ride.dropoff_address,
    dropoff_postal_code: ride.dropoff_postal_code,
    dropoff_city: ride.dropoff_city,
    transport_mode: ride.transport_mode,
    urgency: ride.urgency,
    notes_regulateur: ride.notes_regulateur,
    started_at: ride.started_at,
    ended_at: ride.ended_at,
    tarif_amount_eur: ride.tarif_amount_eur,
    payment_status: ride.payment_status,
    payment_method: ride.payment_method,
    patient: {
      id: ride.patient_id,
      nom: p?.nom ?? '',
      prenom: p?.prenom ?? '',
      telephone: p?.telephone ?? null,
    },
  };
}

// --------------------------------------------------------------------------
// listMyRidesUpcoming — courses J + J+1 du chauffeur authentifié
// --------------------------------------------------------------------------

export type UpcomingDayBucket = 'today' | 'tomorrow';

export type RideForDriverWithBucket = RideForDriverList & {
  bucket: UpcomingDayBucket;
};

/**
 * Liste des courses des 48 prochaines heures TZ Indian/Reunion, classées
 * par cluster jour pour le regroupement UI (« Aujourd'hui » / « Demain »).
 *
 * Élargi en Phase 3 / clôture Passe 1 (anciennement listMyRidesToday) :
 * la régulatrice consultait sa journée mais ne voyait pas les dialyses
 * de J+1 → la projection 48 h donne de la prévisibilité au chauffeur
 * sans saturer la liste (limit 50 conservée).
 */
export async function listMyRidesUpcoming(): Promise<RideForDriverWithBucket[]> {
  const ctx = await getAuthContext();
  if (!ctx) return [];
  if (ctx.role !== 'chauffeur') return [];

  const myDriverId = await resolveMyDriverId(ctx);
  if (!myDriverId) return [];

  const { startIso, tomorrowStartIso, endIso } = reunionUpcomingBoundsIso();

  const { data, error } = await ctx.supabase
    .from('rides')
    .select(RIDE_FOR_DRIVER_COLUMNS)
    .eq('driver_id' as never, myDriverId)
    .gte('scheduled_at', startIso)
    .lt('scheduled_at', endIso)
    .eq('archive', false)
    .order('scheduled_at', { ascending: true })
    .limit(50);

  if (error) {
    // Logging défensif pattern PR #63 (DEC-039 esprit defense in depth).
    // Visible Vercel Runtime logs. Pas de PII : driver_id = UUID non-PII.
    console.error('[conduite] listMyRidesUpcoming rides query failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      user_id: ctx.userId,
      role: ctx.role,
      organization_id: ctx.organizationId,
      resolved_driver_id: myDriverId,
      window_start: startIso,
      window_end: endIso,
    });
    throw new Error('Lecture des courses à venir impossible.');
  }

  const rides = (data ?? []) as unknown as RawRideRow[];
  const patientsById = await fetchPatientsByIds(
    ctx,
    rides.map((r) => r.patient_id),
  );
  return rides.map((r) => ({
    ...joinPatient(r, patientsById),
    bucket: r.scheduled_at < tomorrowStartIso ? 'today' : 'tomorrow',
  }));
}

// --------------------------------------------------------------------------
// getRideForDriver — détail d'une course pour /conduite/[rideId]
// --------------------------------------------------------------------------

export async function getRideForDriver(rideId: string): Promise<RideForDriverList | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  if (ctx.role !== 'chauffeur') return null;

  const myDriverId = await resolveMyDriverId(ctx);
  if (!myDriverId) return null;

  const { data } = await ctx.supabase
    .from('rides')
    .select(RIDE_FOR_DRIVER_COLUMNS + ', driver_id')
    .eq('id', rideId)
    .maybeSingle();
  if (!data) return null;

  const ride = data as unknown as RawRideRow & { driver_id: string | null };
  if (ride.driver_id !== myDriverId) return null;

  const patientsById = await fetchPatientsByIds(ctx, [ride.patient_id]);
  return joinPatient(ride, patientsById);
}
