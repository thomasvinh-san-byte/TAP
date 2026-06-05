/**
 * Route export PDF registre (DPA-01, D-17). Runtime nodejs OBLIGATOIRE
 * (@react-pdf/renderer utilise APIs Node). Auth dirigeant + audit log
 * (T-1.5-26 Repudiation). Layout (admin) fait déjà le double-check role.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { renderToStream } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RegistrePdf, type Entry } from './_components/registre-pdf';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const profileRes = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { role: string; organization_id: string } | null;
  if (!profile || profile.role !== 'dirigeant') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  const orgRes = await supabase
    .from('organizations')
    .select('nom')
    .eq('id', profile.organization_id)
    .single();
  const org = orgRes.data as { nom: string } | null;

  const { data: rawEntries, error: rawEntriesError } = await supabase
    .from('data_processing_register')
    .select('*')
    .order('created_at', { ascending: false });
  if (rawEntriesError) {
    console.error('[admin/legal/registre-pdf] Erreur Supabase:', rawEntriesError);
  }
  const entries = (rawEntries ?? []) as Entry[];

  // Audit log explicite AVANT renderToStream (T-1.5-26).
  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    actor_role: 'dirigeant',
    action: 'legal.registre.exported_pdf',
    entity_type: 'data_processing_register',
    entity_id: null,
    metadata: { entries_count: entries.length },
  } as never);

  const stream = await renderToStream(
    <RegistrePdf
      entries={entries}
      organizationName={org?.nom ?? 'Société'}
      generatedAt={new Date().toLocaleString('fr-FR')}
    />,
  );
  const filename = `registre-traitements-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
