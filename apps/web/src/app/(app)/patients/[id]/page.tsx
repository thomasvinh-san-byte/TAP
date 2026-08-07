import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { maskNir } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import type { RideRecurrence } from '@/types/recurrence';
import { getPatientById } from '../queries';
import type { PatientPrescriptionRow } from '../actions';
import { PatientNirDisplay } from '../_components/patient-nir-display.client';
import { RecurrencesSection } from './_components/recurrences-section.client';
import {
  PrescriptionsSection,
  type PrescriberOption,
} from './_components/prescriptions-section.client';
import { PatientIncidentsSection } from './_components/patient-incidents-section.client';
import { getPatientIncidents } from './_lib/incidents';
import { PatientDriverPreferencesSection } from './_components/patient-driver-preferences-section.client';
import { getPatientDriverPreferences } from './_lib/driver-preferences';
import { logPatientConsultation } from './_lib/log-consultation';
import { listActiveDrivers } from '../../courses/_lib/queries';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page complète fiche patient (PAT-03). Identique au drawer mais en page
 * pleine largeur, avec bouton « Modifier » → `/patients/[id]/edit`.
 */
export default async function PatientPage(props: PageProps) {
  const params = await props.params;
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

  // Traçabilité HDS : consultation d'un dossier patient identifiant (corollaire
  // « qui a accédé à quel dossier »). Best-effort — n'interrompt pas le rendu.
  await logPatientConsultation(p.id);

  // Récurrences actives (Phase 05 Wave 3) + counts rides futures non démarrées
  // pour la cascade DEC-048 dans le modal édition.
  const supabase = await createClient();
  const recurrencesRes = await supabase
    .from('ride_recurrences')
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
          .eq('ride_recurrence_id', rec.id)
          .in('status', ['validee', 'assignee'])
          .gt('scheduled_at', nowIso);
        futureCounts[rec.id] = countRes.count ?? 0;
      }),
    );
  }

  // Prescriptions du patient (CdG §5.3, DEC-163) + prescripteurs actifs (picker).
  const [prescriptionsRes, prescribersRes] = await Promise.all([
    supabase
      .from('prescriptions')
      .select(
        'id, numero, date_prescription, prescriber_id, finess, motif, type_transport, ' +
          'trajets_autorises, trajets_consommes, date_expiration, statut, created_at',
      )
      .eq('patient_id', p.id)
      .order('date_prescription', { ascending: false }),
    supabase
      .from('prescribers')
      .select('id, nom, prenom')
      .eq('actif', true)
      .eq('archive', false)
      .order('nom', { ascending: true }),
  ]);
  const prescriptions = (prescriptionsRes.data as PatientPrescriptionRow[] | null) ?? [];
  const prescribers: PrescriberOption[] = (
    (prescribersRes.data as { id: string; nom: string; prenom: string | null }[] | null) ?? []
  ).map((pr) => ({ id: pr.id, label: [pr.nom, pr.prenom].filter(Boolean).join(' ') }));

  // Incidents patient (PATIENT-01) + courses récentes pour rattacher un incident.
  const [incidentsRecap, ridesRes] = await Promise.all([
    getPatientIncidents(p.id),
    supabase
      .from('rides')
      .select('id, scheduled_at, dropoff_address')
      .eq('patient_id', p.id)
      .order('scheduled_at', { ascending: false })
      .limit(30),
  ]);
  const rideOptions = (
    (ridesRes.data as
      | { id: string; scheduled_at: string; dropoff_address: string | null }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    label: `${new Date(r.scheduled_at).toLocaleDateString('fr-FR')}${
      r.dropoff_address ? ` → ${r.dropoff_address}` : ''
    }`,
  }));

  // Préférences chauffeur (PATIENT-02) + référentiel chauffeurs actifs.
  const [driverPreferences, activeDrivers] = await Promise.all([
    getPatientDriverPreferences(p.id),
    listActiveDrivers(),
  ]);
  const driverOptions = activeDrivers.map((d) => ({ id: d.id, label: d.nom_affichage }));

  // Date de naissance en JJ/MM/AAAA sans construire de `Date` (évite tout décalage
  // de fuseau sur une date seule « AAAA-MM-JJ »).
  const dateNaissanceFr = p.date_naissance
    ? p.date_naissance.slice(0, 10).split('-').reverse().join('/')
    : null;

  return (
    <div className="space-y-24">
      {/* BANNER D'IDENTIFICATION (norme dossier patient) — regroupe les
          identifiants (nom + date de naissance + NIR partiel) pour confirmer sans
          ambiguïté le bon dossier (règle « deux identifiants indépendants »). Le
          bouton Modifier reste dans le banner. Aucun statut inventé : la base n'en
          porte pas. */}
      <header
        aria-label={`Identification du patient ${p.nom} ${p.prenom}`}
        className="bg-background border-border flex flex-wrap items-start justify-between gap-16 rounded-lg border p-16"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {p.nom} {p.prenom}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-x-16 gap-y-8 text-sm">
            {dateNaissanceFr && (
              <span className="text-muted-foreground">
                Né(e) le{' '}
                <span className="text-foreground font-medium tabular-nums">{dateNaissanceFr}</span>
              </span>
            )}
            {p.has_nir && (
              <span className="flex items-center gap-8">
                <span className="text-muted-foreground">NIR</span>
                <PatientNirDisplay patientId={p.id} maskedNir={maskNir(p.nir_last4)} />
              </span>
            )}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/patients/${p.id}/edit`}>
            <Pencil className="mr-8 h-16 w-16" aria-hidden />
            Modifier
          </Link>
        </Button>
      </header>

      <section className="space-y-12">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Coordonnées
        </h2>
        {p.telephone && <p className="text-base tabular-nums">{p.telephone}</p>}
        <p className="text-base">
          {p.adresse_ligne1}
          {p.adresse_ligne2 ? `, ${p.adresse_ligne2}` : ''}
          <br />
          {p.code_postal} {p.ville}
        </p>
      </section>

      <RecurrencesSection
        patientId={p.id}
        recurrences={recurrences}
        futureCounts={futureCounts}
        prescriptionOptions={prescriptions
          .filter((pr) => pr.statut === 'active')
          .map((pr) => ({ id: pr.id, numero: pr.numero }))}
      />

      <PrescriptionsSection
        patientId={p.id}
        prescriptions={prescriptions}
        prescribers={prescribers}
      />

      <PatientIncidentsSection
        patientId={p.id}
        recap={{
          incidents: incidentsRecap.incidents,
          countsByType: incidentsRecap.countsByType,
          windowTotal: incidentsRecap.windowTotal,
          tone: incidentsRecap.tone,
        }}
        rideOptions={rideOptions}
      />

      <PatientDriverPreferencesSection
        patientId={p.id}
        prefere={driverPreferences.prefere}
        evite={driverPreferences.evite}
        driverOptions={driverOptions}
      />

      <section className="space-y-8">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Préférences
        </h2>
        <p className="text-base">
          Canal : <strong>{p.canal_contact_prefere}</strong>
        </p>
        <p className="text-base">
          Consentement SMS :{' '}
          {p.consentement_sms
            ? `oui (${new Date(p.consentement_sms_at!).toLocaleDateString('fr-FR')})`
            : 'non'}
        </p>
      </section>
    </div>
  );
}
