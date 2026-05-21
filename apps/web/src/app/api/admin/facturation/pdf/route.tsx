/**
 * Route Handler export PDF de la facturation CGSS (Phase 06 PLAN-2, Bloc A).
 *
 * Runtime nodejs OBLIGATOIRE (@react-pdf/renderer utilise des APIs Node).
 * Auth dirigeant + audit log AVANT le rendu. Calqué sur le Route Handler du
 * registre RGPD (Phase 1.5) — y ajoute la lecture des `searchParams`
 * (?mois=YYYY-MM&chauffeur=<id>).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { renderToStream } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import {
  getCoursesFacturables,
  type CourseFacturable,
} from '@/app/(admin)/admin/facturation/_lib/queries-facturation';
import { aggregateFacture } from '@/app/(admin)/admin/facturation/_lib/aggregate-facture';
import { FactureCgssPdf } from './_components/facture-cgss-pdf';

/** `YYYY-MM` → libellé « avril 2026 ». */
function moisLabel(mois: string): string {
  const y = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7));
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mois = url.searchParams.get('mois') ?? '';
  const chauffeurId = url.searchParams.get('chauffeur') || undefined;
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return new Response('Paramètre « mois » invalide.', { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Non authentifié.', { status: 401 });

  const profileRes = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as {
    role: string;
    organization_id: string;
  } | null;
  if (!profile || profile.role !== 'dirigeant') {
    return new Response('Accès refusé.', { status: 403 });
  }

  const orgRes = await supabase
    .from('organizations')
    .select('nom')
    .eq('id', profile.organization_id)
    .single();
  const org = orgRes.data as { nom: string } | null;

  const courses: CourseFacturable[] = await getCoursesFacturables(mois, chauffeurId);
  const aggregate = aggregateFacture(courses);

  // Audit log explicite AVANT renderToStream (pattern registre Phase 1.5).
  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    actor_role: 'dirigeant',
    action: 'facturation.cgss.exported_pdf',
    entity_type: 'rides',
    entity_id: null,
    metadata: {
      periode: mois,
      chauffeur_id: chauffeurId ?? null,
      rides_count: aggregate.count,
      total_eur: aggregate.totalEur,
    },
  } as never);

  const chauffeurLabel = chauffeurId
    ? (courses.find((c) => c.driver_id === chauffeurId)?.driver_nom ?? null)
    : null;

  const stream = await renderToStream(
    <FactureCgssPdf
      organizationName={org?.nom ?? 'Société'}
      periodeLabel={moisLabel(mois)}
      chauffeurLabel={chauffeurLabel}
      generatedAt={new Date().toLocaleString('fr-FR')}
      aggregate={aggregate}
    />,
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facturation-cgss-${mois}.pdf"`,
    },
  });
}
