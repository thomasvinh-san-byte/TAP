/**
 * Route Handler export PDF récap donneur d'ordres sur période (CdC §5.5 l.195,
 * DEC-159). Calqué sur `api/admin/chauffeurs/recap/pdf` (DEC-116) :
 *   - runtime nodejs (@react-pdf/renderer)
 *   - Auth + guard rôle (dirigeant OU régulateur)
 *   - Isolation org : le donneur est lu via le client RLS-scopé (cross-org
 *     introuvable → 404) ; les courses sont filtrées par RLS + ordering_party_id
 *   - Pas de N+1 : courses en 1 requête, patients en `.in()` (patients_safe)
 *   - Montant totalisé = `tarif_amount_eur` réellement stocké (reflète déjà la
 *     grille B2B 07.02 si le donneur est en grille_propre — pas de recalcul)
 *   - Audit log AVANT renderToStream
 *   - Réutilise `PdfDocument` + `pdfStyles` (charte commune)
 *
 * Params : ?ordering_party=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { renderToStream } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { RecapDonneurPdf, type RecapDonneurRow } from './_components/recap-donneur-pdf';

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  validee: 'Validée',
  assignee: 'Assignée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee_regulateur: 'Annulée',
  annulee_patient: 'Annulée',
  annulee_chauffeur: 'Annulée',
};

interface RawRow {
  scheduled_at: string;
  status: string;
  pickup_address: string | null;
  pickup_city: string | null;
  dropoff_address: string | null;
  dropoff_city: string | null;
  tarif_amount_eur: number | string | null;
  patient_id: string;
}

function trajet(addr: string | null, city: string | null): string {
  if (city && addr) return `${addr}, ${city}`;
  return addr ?? city ?? '';
}

function periodLabel(from: string, to: string): string {
  return `${from} → ${to}`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderingPartyId = url.searchParams.get('ordering_party') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderingPartyId)) {
    return new Response('Paramètre « ordering_party » invalide.', { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return new Response('Paramètres « from »/« to » invalides (format AAAA-MM-JJ).', {
      status: 400,
    });
  }
  if (from > to) {
    return new Response('La date de fin doit être postérieure ou égale à la date de début.', {
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Non authentifié.', { status: 401 });

  const profileRes = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { role: string; organization_id: string } | null;
  if (!profile || (profile.role !== 'dirigeant' && profile.role !== 'regulateur')) {
    return new Response('Accès refusé.', { status: 403 });
  }

  const [partyRes, orgRes, ridesRes] = await Promise.all([
    // RLS ordering_parties_select_same_org → cross-org renvoie null (isolation).
    supabase
      .from('ordering_parties')
      .select('id, raison_sociale, siret')
      .eq('id', orderingPartyId)
      .maybeSingle(),
    supabase.from('organizations').select('nom').eq('id', profile.organization_id).single(),
    supabase
      .from('rides')
      .select(
        'scheduled_at, status, pickup_address, pickup_city, dropoff_address, dropoff_city, tarif_amount_eur, patient_id',
      )
      .eq('ordering_party_id', orderingPartyId)
      .eq('archive', false)
      .gte('scheduled_at', `${from}T00:00:00.000Z`)
      .lte('scheduled_at', `${to}T23:59:59.999Z`)
      .order('scheduled_at', { ascending: true })
      .limit(2000),
  ]);

  const party = partyRes.data as {
    id: string;
    raison_sociale: string;
    siret: string | null;
  } | null;
  if (!party) return new Response("Donneur d'ordres introuvable.", { status: 404 });
  const org = orgRes.data as { nom: string } | null;
  const raw = ((ridesRes.data ?? []) as RawRow[]) ?? [];

  // Hydrate patient labels en 1 lookup (patients_safe = vue sans ciphertext, RGPD).
  const patientIds = Array.from(new Set(raw.map((r) => r.patient_id)));
  const patientLabels: Record<string, string> = {};
  if (patientIds.length > 0) {
    const { data } = await supabase
      .from('patients_safe')
      .select('id, nom, prenom')
      .in('id', patientIds);
    for (const p of (data as { id: string; nom: string; prenom: string }[] | null) ?? []) {
      patientLabels[p.id] = `${p.nom} ${p.prenom}`.trim();
    }
  }

  const rows: RecapDonneurRow[] = raw.map((r) => ({
    scheduled_at: r.scheduled_at,
    patient_label: patientLabels[r.patient_id] ?? '',
    trajet: `${trajet(r.pickup_address, r.pickup_city)} → ${trajet(r.dropoff_address, r.dropoff_city)}`,
    status_label: STATUS_LABELS[r.status] ?? r.status,
    tarif_eur: r.tarif_amount_eur !== null ? Number(r.tarif_amount_eur) : null,
  }));

  const countTerminees = rows.filter((r) => r.status_label === 'Terminée').length;
  const totalEur = rows.reduce((acc, r) => acc + (r.tarif_eur ?? 0), 0);

  // Audit log AVANT le rendu (pattern recap chauffeur / facturation).
  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    actor_role: profile.role,
    action: 'ordering_party.recap.exported_pdf',
    entity_type: 'ordering_party',
    entity_id: orderingPartyId,
    metadata: {
      ordering_party_id: orderingPartyId,
      from,
      to,
      rides_count: rows.length,
      total_eur: totalEur,
    },
  } as never);

  const stream = await renderToStream(
    <RecapDonneurPdf
      organizationName={org?.nom ?? 'Société'}
      generatedAt={new Date().toLocaleString('fr-FR')}
      donneurLabel={party.raison_sociale}
      donneurSiret={party.siret}
      periodeLabel={periodLabel(from, to)}
      rows={rows}
      summary={{
        count: rows.length,
        countTerminees,
        totalEur,
      }}
    />,
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recap_donneur_${from}_${to}.pdf"`,
    },
  });
}
