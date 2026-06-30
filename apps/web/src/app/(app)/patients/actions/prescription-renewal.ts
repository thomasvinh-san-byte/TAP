'use server';

/**
 * Demande de renouvellement de bon pré-remplie (RENOUVELLEMENT-01, §5.3).
 *
 * Génère un BROUILLON (objet + corps + lien mailto) à adresser au prescripteur.
 * PAS d'envoi automatique : un texte copiable / un `mailto:` pré-rempli suffit.
 * Données minimales (pas de détail clinique) : patient, bon (numéro, trajets,
 * expiration), nature de la série (motif + rythme), demande d'un nouveau bon.
 * Table prescriptions absente de types.gen.ts → `as never` (DEC-155).
 */

import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';

export interface RenewalRequest {
  subject: string;
  body: string;
  /** Lien mailto pré-rempli si le prescripteur a un email, sinon null. */
  mailto: string | null;
  prescriberEmail: string | null;
}

const DAY_FR: Record<string, string> = {
  MO: 'lundi',
  TU: 'mardi',
  WE: 'mercredi',
  TH: 'jeudi',
  FR: 'vendredi',
  SA: 'samedi',
  SU: 'dimanche',
};

function humanizeRhythm(rrule: string): string {
  const byday = rrule.match(/BYDAY=([^;]+)/)?.[1];
  if (!byday) return 'transport récurrent';
  const jours = byday
    .split(',')
    .map((d) => DAY_FR[d] ?? d)
    .join(', ');
  return `transport récurrent les ${jours}`;
}

function formatDateFr(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface PrescriptionRow {
  id: string;
  numero: string;
  patient_id: string;
  prescriber_id: string | null;
  motif: string | null;
  trajets_autorises: number;
  trajets_consommes: number;
  date_expiration: string | null;
}

export async function buildRenewalRequestAction(
  prescriptionId: string,
): Promise<{ data?: RenewalRequest; error?: string }> {
  if (!z.string().uuid().safeParse(prescriptionId).success) {
    return { error: 'Bon invalide.' };
  }
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou au dirigeant.' };

  const presRes = await ctx.supabase
    .from('prescriptions' as never)
    .select(
      'id, numero, patient_id, prescriber_id, motif, trajets_autorises, trajets_consommes, date_expiration',
    )
    .eq('id', prescriptionId)
    .maybeSingle();
  const pres = presRes.data as unknown as PrescriptionRow | null;
  if (presRes.error || !pres) return { error: 'Bon introuvable.' };

  const [patientRes, prescriberRes, seriesRes] = await Promise.all([
    ctx.supabase
      .from('patients_safe')
      .select('nom, prenom')
      .eq('id', pres.patient_id)
      .maybeSingle(),
    pres.prescriber_id
      ? ctx.supabase
          .from('prescribers')
          .select('nom, prenom, contact_email')
          .eq('id', pres.prescriber_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.supabase
      .from('ride_recurrences')
      .select('rrule_str')
      .eq('prescription_id' as never, prescriptionId as never)
      .is('archived_at', null)
      .limit(1)
      .maybeSingle(),
  ]);

  const patient = patientRes.data as { nom: string; prenom: string } | null;
  const patientName = patient ? `${patient.nom} ${patient.prenom}`.trim() : 'le patient';
  const prescriber = prescriberRes.data as {
    nom: string;
    prenom: string | null;
    contact_email: string | null;
  } | null;
  const prescriberName = prescriber
    ? `${prescriber.prenom ? `${prescriber.prenom} ` : ''}${prescriber.nom}`.trim()
    : null;
  const series = seriesRes.data as { rrule_str: string } | null;

  const expFr = formatDateFr(pres.date_expiration);
  const restants = Math.max(0, pres.trajets_autorises - pres.trajets_consommes);

  const subject = `Demande de renouvellement de bon de transport — ${patientName}`;
  const natureLine = series
    ? `Ce patient bénéficie d'un ${humanizeRhythm(series.rrule_str)}${pres.motif ? ` (motif : ${pres.motif})` : ''}.`
    : pres.motif
      ? `Motif : ${pres.motif}.`
      : null;
  const body = [
    prescriberName ? `Madame, Monsieur ${prescriberName},` : 'Madame, Monsieur,',
    '',
    `Le bon de transport n° ${pres.numero} du patient ${patientName} arrive à échéance ` +
      `(${pres.trajets_consommes}/${pres.trajets_autorises} trajets utilisés, ${restants} restant${restants > 1 ? 's' : ''}` +
      `${expFr ? `, expiration le ${expFr}` : ''}).`,
    natureLine,
    `Afin d'assurer la continuité de sa prise en charge, nous vous remercions de bien vouloir établir un nouveau bon de transport.`,
    '',
    'Cordialement.',
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
  const email = prescriber?.contact_email ?? null;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;

  return { data: { subject, body, mailto, prescriberEmail: email } };
}
