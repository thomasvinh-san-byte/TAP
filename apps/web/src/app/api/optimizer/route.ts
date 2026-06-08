import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import {
  ridesToSolveRequest,
  solveResponseToProposal,
  type RideRow,
  type VehicleRow,
  type OptimizationProposal,
  type RideAttributes,
} from '@tap/optimizer-client';
import { solveLocal } from '@/lib/optimizer/solve-local';
import { isPlanningBlocking } from '@tap/shared';
import {
  getComplianceBlockingMode,
  getEntityComplianceLookup,
} from '../../(admin)/admin/conformite/_lib/compliance-planning';

/**
 * POST /api/optimizer
 *
 * Orchestre l'optimisation des tournées d'une journée.
 * Contraintes de sécurité :
 *   - Auth obligatoire (401) + rôle régulateur/dirigeant (403).
 *   - D-08 : aucune donnée patient identifiante dans le payload solveur.
 *     Le SELECT ne lit que les colonnes géométriques et de contrainte.
 *   - D-18 : calcul pur, aucun effet de bord en base.
 *
 * Phase 06.12 (ADR-010) : appel direct au solveur heuristique TS native
 * `solveLocal()`. Plus de microservice Python OR-Tools, plus de mock,
 * plus d'hébergement séparé. Le contrat zod
 * (`@tap/optimizer-client`) reste l'interface canonique.
 */

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format YYYY-MM-DD requis).'),
});

/** Dépôt par défaut : Saint-Denis (centre administratif de La Réunion). */
const DEPOT_DEFAULT: [number, number] = [-20.8789, 55.4481];
const CORRECTION_FACTOR_DEFAULT = 1.3;
const AVG_SPEED_KMH = 50;
const TIME_LIMIT_SECONDS = 3;

type RideRowForOptim = RideRow & {
  pickup_city: string | null;
  dropoff_city: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  patient: { prenom: string | null; nom: string | null } | null;
};

type VehicleRowForOptim = VehicleRow & {
  immatriculation: string | null;
};

async function readRidesForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
): Promise<RideRowForOptim[]> {
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, urgency, transport_mode, ' +
        'pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ' +
        'pickup_citycode, dropoff_citycode, ' +
        'pickup_city, dropoff_city, pickup_address, dropoff_address, ' +
        'patient:patients(prenom, nom)',
    )
    .gte('scheduled_at', `${date}T00:00:00`)
    .lt('scheduled_at', `${date}T23:59:59.999Z`)
    .eq('status', 'validee')
    .order('scheduled_at');
  if (error) {
    console.error('[optimizer/rides] Erreur Supabase:', error);
  }
  return (data as RideRowForOptim[] | null) ?? [];
}

async function readActiveVehicles(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<VehicleRowForOptim[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, type, places_assises, places_tpmr, immatriculation')
    .eq('actif', true);
  if (error) {
    console.error('[optimizer/vehicles] Erreur Supabase:', error);
  }
  return (data as VehicleRowForOptim[] | null) ?? [];
}

/**
 * Enrichit la proposition retournée par `solveResponseToProposal()` avec :
 *   - `rideLabels` : map UUID → label lisible (heure + ville pickup → ville dropoff + initiales patient).
 *   - `vehicles` : liste véhicules avec immatriculation pour les dropdowns UI.
 *   - `rideAttributes` : urgency + transport_mode pour les badges UI (Phase 06.11).
 *
 * D-08 respectée : enrichissement côté Route Handler authentifié, le solveur
 * ne voit toujours que des UUIDs opaques. Le front voit déjà ces données via
 * le cockpit (DEC-054) donc aucune nouvelle surface d'exposition.
 */
function enrichProposal(
  proposal: OptimizationProposal,
  rides: RideRowForOptim[],
  vehicles: VehicleRowForOptim[],
): OptimizationProposal {
  const rideLabels: Record<string, string> = {};
  for (const ride of rides) {
    const heure = new Date(ride.scheduled_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Indian/Reunion',
    });
    const pickupVille = ride.pickup_city ?? ride.pickup_address?.split(',').pop()?.trim() ?? '?';
    const dropoffVille = ride.dropoff_city ?? ride.dropoff_address?.split(',').pop()?.trim() ?? '?';
    const initiales = ride.patient
      ? `${(ride.patient.prenom ?? '?').slice(0, 1)}. ${(ride.patient.nom ?? '?').slice(0, 1)}.`
      : '';
    const suffixePatient = initiales ? ` (${initiales})` : '';
    rideLabels[ride.id] = `${heure} · ${pickupVille} → ${dropoffVille}${suffixePatient}`;
  }

  const vehiclesLabels = vehicles.map((v) => ({
    id: v.id,
    label: `${v.immatriculation ?? v.id.slice(0, 8)} · ${v.type}`,
  }));

  const rideAttributes: Record<string, RideAttributes> = {};
  for (const ride of rides) {
    rideAttributes[ride.id] = {
      urgency: ride.urgency,
      transport_mode: ride.transport_mode,
    };
  }

  return {
    ...proposal,
    rideLabels,
    vehicles: vehiclesLabels,
    rideAttributes,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Validation du corps de la requête.
  const body = await req.json().catch(() => null);
  const bodyParse = requestSchema.safeParse(body);
  if (!bodyParse.success) {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }
  const { date } = bodyParse.data;

  // 2. Auth : utilisateur connecté.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // 3. Autorisation : rôle régulateur ou dirigeant.
  const ctx = await getAuthContext();
  if (!ctx || !['regulateur', 'dirigeant'].includes(ctx.role)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
  }

  // 4. Lecture des données (sans PII — D-08).
  const [rides, vehicles] = await Promise.all([
    readRidesForDate(supabase, date),
    readActiveVehicles(supabase),
  ]);

  // 4bis. Phase 06.35 DEC-114 : contrôle conformité véhicules.
  //   - mode 'warn'  : tous les véhicules vont au solveur ; les non
  //     conformes sont signalés à l'UI via `complianceWarnings`.
  //   - mode 'block' : les véhicules non conformes sont retirés du
  //     pool envoyé au solveur ET signalés (blocked=true).
  const complianceMode = await getComplianceBlockingMode();
  const vehicleLookup = await getEntityComplianceLookup(
    [],
    vehicles.map((v) => v.id),
  );
  const complianceWarnings = vehicles
    .filter((v) => {
      const st = vehicleLookup.byVehicleId[v.id];
      return st && isPlanningBlocking(st);
    })
    .map((v) => ({
      vehicle_id: v.id,
      label: `${v.immatriculation ?? v.id.slice(0, 8)} · ${v.type}`,
      blocked: complianceMode === 'block',
    }));
  const vehiclesForSolver =
    complianceMode === 'block'
      ? vehicles.filter((v) => !complianceWarnings.find((w) => w.vehicle_id === v.id))
      : vehicles;

  // 5. Transformation en payload solveur dé-identifié.
  const { payload, excluded } = ridesToSolveRequest(rides, vehiclesForSolver, {
    date,
    depot: DEPOT_DEFAULT,
    correctionFactor: CORRECTION_FACTOR_DEFAULT,
    avgSpeedKmh: AVG_SPEED_KMH,
    timeLimitSeconds: TIME_LIMIT_SECONDS,
  });

  // 6. Si aucune course éligible, retourner état vide sans appeler le solveur.
  if (payload.rides.length === 0) {
    const emptyProposal = solveResponseToProposal(
      {
        contract_version: '1',
        groupements: [],
        rides_non_groupees_ids: [],
        rides_exclues_ids: [],
        km_a_vide_estimes: 0,
      },
      rides.length,
      excluded,
    );
    return NextResponse.json(
      { ...enrichProposal(emptyProposal, rides, vehicles), complianceWarnings },
      { status: 200 },
    );
  }

  // 7. Appel synchrone au solveur heuristique TS native (Phase 06.12, ADR-010).
  //    Pure fonction, pas de réseau, pas de timeout — le volume reste petit
  //    (≤ 200 courses, plafond zod), l'algorithme termine en quelques ms.
  try {
    const response = solveLocal(payload);
    const proposal = solveResponseToProposal(response, rides.length, excluded);
    return NextResponse.json(
      { ...enrichProposal(proposal, rides, vehicles), complianceWarnings },
      { status: 200 },
    );
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'optimizer' } });
    console.error('[optimizer] erreur solveLocal:', err);
    return NextResponse.json(
      {
        error:
          "Le service d'optimisation n'est pas disponible pour le moment. Les tournées ne sont pas affectées. Réessayez dans quelques minutes.",
      },
      { status: 503 },
    );
  }
}
