/**
 * Route Handler export PDF récap chauffeur sur période (Phase 06.37 §5.23,
 * DEC-116). Suit le pattern de `app/api/admin/facturation/pdf/route.tsx` :
 *   - runtime nodejs (@react-pdf/renderer)
 *   - Auth + guard rôle (dirigeant)
 *   - Audit log AVANT renderToStream
 *   - Réutilise `PdfDocument` + `pdfStyles` (charte commune)
 *
 * Params : ?driver=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { renderToStream } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { RecapChauffeurPdf, type RecapRow } from './_components/recap-chauffeur-pdf';

const STATUS_LABELS: Record<string, string> = {
  validee: 'Validée',
  assignee: 'Assignée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee_regulateur: 'Annulée',
  annulee_patient: 'Annulée',
  annulee_chauffeur: 'Annulée',
  annulee_meteo: 'Annulée (météo)',
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
  const driverId = url.searchParams.get('driver') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(driverId)) {
    return new Response('Paramètre « driver » invalide.', { status: 400 });
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
  if (!profile || profile.role !== 'dirigeant') {
    return new Response('Accès refusé.', { status: 403 });
  }

  const [driverRes, orgRes, ridesRes] = await Promise.all([
    supabase.from('drivers').select('id, nom_affichage').eq('id', driverId).maybeSingle(),
    supabase.from('organizations').select('nom').eq('id', profile.organization_id).single(),
    supabase
      .from('rides')
      .select(
        'scheduled_at, status, pickup_address, pickup_city, dropoff_address, dropoff_city, tarif_amount_eur, patient_id',
      )
      .eq('driver_id', driverId)
      .eq('archive', false)
      .gte('scheduled_at', `${from}T00:00:00.000Z`)
      .lte('scheduled_at', `${to}T23:59:59.999Z`)
      .order('scheduled_at', { ascending: true })
      .limit(2000),
  ]);

  const driver = driverRes.data as { id: string; nom_affichage: string } | null;
  if (!driver) return new Response('Chauffeur introuvable.', { status: 404 });
  const org = orgRes.data as { nom: string } | null;
  const raw = ((ridesRes.data ?? []) as RawRow[]) ?? [];

  // Hydrate patient labels en 1 lookup (pas de FK polymorphe — patients_safe
  // = vue sans ciphertext).
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

  const rows: RecapRow[] = raw.map((r) => ({
    scheduled_at: r.scheduled_at,
    patient_label: patientLabels[r.patient_id] ?? '',
    trajet: `${trajet(r.pickup_address, r.pickup_city)} → ${trajet(r.dropoff_address, r.dropoff_city)}`,
    status_label: STATUS_LABELS[r.status] ?? r.status,
    tarif_eur: r.tarif_amount_eur !== null ? Number(r.tarif_amount_eur) : null,
  }));

  const countTerminees = rows.filter((r) => r.status_label === 'Terminée').length;
  const totalEur = rows.reduce((acc, r) => acc + (r.tarif_eur ?? 0), 0);

  // Audit log AVANT le rendu (pattern facturation).
  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    actor_role: 'dirigeant',
    action: 'chauffeur.recap.exported_pdf',
    entity_type: 'driver',
    entity_id: driverId,
    metadata: {
      driver_id: driverId,
      from,
      to,
      rides_count: rows.length,
      total_eur: totalEur,
    },
  });

  const stream = await renderToStream(
    <RecapChauffeurPdf
      organizationName={org?.nom ?? 'Société'}
      generatedAt={new Date().toLocaleString('fr-FR')}
      chauffeurLabel={driver.nom_affichage}
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
      'Content-Disposition': `attachment; filename="recap_chauffeur_${from}_${to}.pdf"`,
    },
  });
}
