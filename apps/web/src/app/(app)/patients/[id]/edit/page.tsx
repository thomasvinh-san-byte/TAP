import { notFound } from 'next/navigation';
import { PatientForm } from '../../_components/patient-form.client';
import { PatientFormConstraints } from '../../_components/patient-form-constraints.client';
import { updatePatientAction } from '../../actions';
import { getPatientById } from '../../queries';

interface PageProps {
  params: { id: string };
}

/**
 * Édition patient (D-13 explicite, PAT-01). Le formulaire principal
 * (identité / coords / préférences / note) utilise `updatePatientAction`
 * bound à l'id ; les contraintes sont éditées hors `<form>` via Server
 * Actions atomiques (B-2).
 */
export default async function EditPatientPage({ params }: PageProps) {
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
    genre: string | null;
    telephone: string | null;
    adresse_ligne1: string;
    adresse_ligne2: string | null;
    code_postal: string;
    ville: string;
    canal_contact_prefere: 'sms' | 'appel' | 'aucun';
    consentement_sms: boolean;
    patient_constraint?: { id: string; type: string; note: string | null }[];
    patient_operational_note?: { id: string; content: string }[];
  };

  const action = updatePatientAction.bind(null, p.id);
  const activeNote = p.patient_operational_note?.[0]?.content ?? '';

  return (
    <div className="space-y-32">
      <h1 className="text-2xl font-semibold tracking-tight">
        Modifier — {p.nom} {p.prenom}
      </h1>
      <PatientForm
        action={action}
        defaultValues={{
          prenom: p.prenom,
          nom: p.nom,
          date_naissance: p.date_naissance ?? undefined,
          genre: (p.genre as 'M' | 'F' | 'X' | null) ?? undefined,
          telephone: p.telephone ?? undefined,
          adresse_ligne1: p.adresse_ligne1,
          adresse_ligne2: p.adresse_ligne2 ?? undefined,
          code_postal: p.code_postal,
          ville: p.ville,
          canal_contact_prefere: p.canal_contact_prefere,
          consentement_sms: p.consentement_sms,
          notes_operationnelles: activeNote,
        }}
        submitLabel="Enregistrer"
      />
      <PatientFormConstraints
        patientId={p.id}
        initial={(p.patient_constraint ?? []).map((c) => ({
          id: c.id,
          type: c.type,
          note: c.note,
        }))}
      />
    </div>
  );
}
