import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { maskNir } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import type { RideRecurrence } from '@/types/recurrence';
import { getPatientById } from '../queries';
import { PatientNirDisplay } from '../_components/patient-nir-display.client';
import { RecurrencesSection } from './_components/recurrences-section.client';

interface PageProps {
  params: { id: string };
}

/**
 * Page complète fiche patient (PAT-03). Identique au drawer mais en page
 * pleine largeur, avec bouton « Modifier » → `/patients/[id]/edit`.
 */
export default async function PatientPage({ params }: PageProps) {
  let patient: Awaited<ReturnType<typeof getPatientById>>;
  try {
    patient = await getPatientById(params.id);
  } catch {
    notFound();
  }

  const p = patient as unknown as {
    id: string;
    prenom: string;
    nom: string;
    date_naissance: string | null;
    telephone: string | null;
    adresse_ligne1: string;
    adresse_ligne2: string | null;
    code_postal: string;
    ville: string;
    nir_last4: string | null;
    has_nir: boolean | null;
    canal_contact_prefere: 'sms' | 'appel' | 'aucun';
    consentement_sms: boolean;
    consentement_sms_at: string | null;
  };

  // Récurrences actives (Phase 05 Wave 3) + counts rides futures non démarrées
  // pour la cascade DEC-048 dans le modal édition.
  const supabase = createClient();
  const recurrencesRes = await supabase
    .from('ride_recurrences' as never)
    .select('*')
    .eq('patient_id', p.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  const recurrences = (recurrencesRes.data as RideRecurrence[] | null) ?? [];

  const futureCounts: Record<string, number> = {};
  if (recurrences.length > 0) {
    const nowIso = new Date().toISOString();
    await Promise.all(
      recurrences.map(async (rec) => {
        const countRes = await supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('ride_recurrence_id' as never, rec.id)
          .in('status', ['validee', 'assignee'])
          .gt('scheduled_at', nowIso);
        futureCounts[rec.id] = countRes.count ?? 0;
      }),
    );
  }

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {p.nom} {p.prenom}
        </h1>
        <Button asChild variant="outline">
          <Link href={`/patients/${p.id}/edit`}>
            <Pencil className="mr-8 h-16 w-16" aria-hidden />
            Modifier
          </Link>
        </Button>
      </header>

      <section className="space-y-12">
        <h2 className="text-muted-foreground text-sm font-semibold uppercase">
          Identité administrative
        </h2>
        {p.has_nir && <PatientNirDisplay patientId={p.id} maskedNir={maskNir(p.nir_last4)} />}
        <p className="text-sm">Né(e) le {p.date_naissance}</p>
      </section>

      <section className="space-y-12">
        <h2 className="text-muted-foreground text-sm font-semibold uppercase">Coordonnées</h2>
        {p.telephone && <p className="tabular-nums">{p.telephone}</p>}
        <p>
          {p.adresse_ligne1}
          {p.adresse_ligne2 ? `, ${p.adresse_ligne2}` : ''}
          <br />
          {p.code_postal} {p.ville}
        </p>
      </section>

      <RecurrencesSection patientId={p.id} recurrences={recurrences} futureCounts={futureCounts} />

      <section className="space-y-8">
        <h2 className="text-muted-foreground text-sm font-semibold uppercase">Préférences</h2>
        <p>
          Canal : <strong>{p.canal_contact_prefere}</strong>
        </p>
        <p>
          Consentement SMS :{' '}
          {p.consentement_sms
            ? `oui (${new Date(p.consentement_sms_at!).toLocaleDateString('fr-FR')})`
            : 'non'}
        </p>
      </section>
    </div>
  );
}
