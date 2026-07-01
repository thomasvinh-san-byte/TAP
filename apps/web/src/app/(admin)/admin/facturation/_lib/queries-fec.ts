import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { FecEncaissement, FecPaymentMethod } from '@tap/shared';

/**
 * Requêtes serveur de l'export comptable FEC — EXPORT-01 (§5.23).
 *
 * RLS Postgres scope automatiquement par `organization_id`. Aucune donnée
 * médicale n'est lue ici (le FEC est comptable : montant, mode de règlement,
 * référence de pièce = identifiant de course).
 */

/** SIRET de l'organisation courante (14 chiffres) ou null si non renseigné. */
export async function getOrganizationSiret(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return null;

  const orgRes = await supabase
    .from('organizations')
    .select('siret')
    .eq('id', profile.organization_id)
    .single();
  const org = orgRes.data as { siret: string | null } | null;
  return org?.siret ?? null;
}

const FEC_METHODS: readonly string[] = ['cash', 'cb', 'cheque', 'cgss_differe'];

/**
 * Encaissements enregistrés de la période (courses `terminee` +
 * `payment_status='encaisse'`, `ended_at` ∈ [from, to]). Date d'écriture =
 * date d'encaissement (`payment_received_at`) à défaut la clôture de course
 * (`ended_at`). Référence de pièce = identifiant de course (non médical).
 */
export async function listEncaissementsForFec(
  from: string,
  to: string,
): Promise<FecEncaissement[]> {
  const supabase = await createClient();
  const start = new Date(`${from}T00:00:00.000Z`).toISOString();
  const end = new Date(`${to}T23:59:59.999Z`).toISOString();

  const { data, error } = await supabase
    .from('rides')
    .select('id, ended_at, payment_received_at, tarif_amount_eur, payment_method')
    .eq('status', 'terminee')
    .eq('payment_status', 'encaisse')
    .gte('ended_at', start)
    .lte('ended_at', end)
    .order('ended_at', { ascending: true })
    .limit(10000);

  if (error || !data) return [];

  const rows = data as unknown as {
    id: string;
    ended_at: string | null;
    payment_received_at: string | null;
    tarif_amount_eur: number | null;
    payment_method: string | null;
  }[];

  return rows
    .filter((r) => r.tarif_amount_eur !== null && FEC_METHODS.includes(r.payment_method ?? ''))
    .map((r) => ({
      pieceRef: r.id,
      date: r.payment_received_at ?? r.ended_at ?? start,
      amountEur: Number(r.tarif_amount_eur),
      method: r.payment_method as FecPaymentMethod,
    }));
}
