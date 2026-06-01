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

async function readRidesForDate(
  supabase: ReturnType<typeof createClient>,
  date: string,
): Promise<RideRow[]> {
  // D-08 : colonnes de géométrie et contraintes uniquement, aucune donnée identifiante.
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, urgency, transport_mode, ' +
        'pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ' +
        'pickup_citycode, dropoff_citycode',
    )
    .gte('scheduled_at', `${date}T00:00:00`)
    .lt('scheduled_at', `${date}T23:59:59.999Z`)
    .eq('status', 'validee')
    .order('scheduled_at');
  if (error) {
    console.error('[optimizer/rides] Erreur Supabase:', error);
  }
  return (data as RideRow[] | null) ?? [];
}

async function readActiveVehicles(
  supabase: ReturnType<typeof createClient>,
): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, type, places_assises, places_tpmr')
    .eq('actif', true);
  if (error) {
    console.error('[optimizer/vehicles] Erreur Supabase:', error);
  }
  return (data as VehicleRow[] | null) ?? [];
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
    return NextResponse.json(emptyProposal, { status: 200 });
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
    return NextResponse.json(proposal, { status: 200 });
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
