import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import {
  solve,
  ridesToSolveRequest,
  solveResponseToProposal,
  OptimizerError,
  type RideRow,
  type VehicleRow,
  type OptimizationProposal,
} from '@tap/optimizer-client';

/**
 * POST /api/optimizer
 *
 * Orchestre l'appel au solveur OR-Tools pour une journée donnée.
 * Contraintes de sécurité :
 *   - Auth obligatoire (401) + rôle régulateur/dirigeant (403).
 *   - D-08 : aucune donnée patient identifiante dans le payload solveur.
 *     Le SELECT ne lit que les colonnes géométriques et de contrainte.
 *   - D-18 : calcul pur, aucun effet de bord en base.
 *
 * Refs : DEC-079 LOCKED, ADR-008, CONTEXT.md D-05/D-08/D-14/D-17/D-18.
 */

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format YYYY-MM-DD requis).'),
});

/** Dépôt par défaut : Saint-Denis (centre administratif de La Réunion). */
const DEPOT_DEFAULT: [number, number] = [-20.8789, 55.4481];
const CORRECTION_FACTOR_DEFAULT = 1.3;
const AVG_SPEED_KMH = 50;
const TIME_LIMIT_SECONDS = 3;

/**
 * Type local : RideRow enrichi avec champs nécessaires à la construction
 * des labels UI (Wave 4). Les colonnes supplémentaires (pickup_city,
 * dropoff_city, addresses, patient join) ne sont JAMAIS transmises au
 * solveur — la dé-identification D-08 est enforcée par le mapping
 * explicite dans `ridesToSolveRequest()` côté @tap/optimizer-client
 * (cf. commentaire ligne 93 de transform.ts).
 */
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
  supabase: ReturnType<typeof createClient>,
  date: string,
): Promise<RideRowForOptim[]> {
  // Colonnes de géométrie + contraintes (pour le solveur, D-08) + champs
  // d'enrichissement UI (pour les labels Wave 4, jamais transmis au solveur).
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
  supabase: ReturnType<typeof createClient>,
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
 *
 * Wave 4 — D-08 respectée : enrichissement côté Route Handler authentifié,
 * le solveur (Python ou mock) ne voit toujours que des UUIDs opaques. Le
 * front voit déjà ces données via le cockpit (DEC-054) donc aucune
 * nouvelle surface d'exposition.
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
    rideLabels[ride.id] = `${heure} — ${pickupVille} → ${dropoffVille}${suffixePatient}`;
  }

  const vehiclesLabels = vehicles.map((v) => ({
    id: v.id,
    label: `${v.immatriculation ?? v.id.slice(0, 8)} — ${v.type}`,
  }));

  return {
    ...proposal,
    rideLabels,
    vehicles: vehiclesLabels,
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
  const supabase = createClient();
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

  // 5. Transformation en payload solveur dé-identifié.
  const { payload, excluded } = ridesToSolveRequest(rides, vehicles, {
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
    return NextResponse.json(enrichProposal(emptyProposal, rides, vehicles), { status: 200 });
  }

  // 7. Appel au solveur — mock ou service Python selon OPTIMIZER_USE_MOCK.
  //
  // Voie hybride single-projet Vercel (ADR-008 révision 2026-06-01) : le solveur
  // Python est déployé dans le même projet Vercel, à /api/solver/*.
  // L'URL est construite depuis VERCEL_URL (fournie automatiquement par Vercel
  // en preview et production) ou un fallback localhost en dev.
  //
  // Si OPTIMIZER_USE_MOCK=true, court-circuite l'appel HTTP et utilise un mock
  // local qui produit une réponse conforme au contrat zod. Débloque la
  // validation fonctionnelle Wave 3 sans dépendre de l'hébergement Python.
  const useMock = process.env.OPTIMIZER_USE_MOCK === 'true';

  try {
    let response;
    if (useMock) {
      const { mockSolve } = await import('./_mock-solver');
      response = mockSolve(payload);
    } else {
      const baseHost = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000');
      const serviceUrl = `${baseHost}/api/solver`;
      response = await solve(payload, {
        baseUrl: serviceUrl,
        timeoutMs: 5000,
      });
    }
    const proposal = solveResponseToProposal(response, rides.length, excluded);
    return NextResponse.json(enrichProposal(proposal, rides, vehicles), { status: 200 });
  } catch (err) {
    if (err instanceof OptimizerError) {
      return NextResponse.json(
        {
          error:
            "Le service d'optimisation n'est pas disponible pour le moment. Les tournées ne sont pas affectées. Réessayez dans quelques minutes.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Le service d'optimisation n'est pas disponible pour le moment. Les tournées ne sont pas affectées. Réessayez dans quelques minutes.",
      },
      { status: 503 },
    );
  }
}
