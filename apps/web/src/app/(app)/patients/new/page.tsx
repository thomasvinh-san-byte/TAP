import { PatientForm } from '../_components/patient-form.client';
import { createPatientAction } from '../actions';

export const metadata = { title: 'Nouveau patient — TAP Régulation' };

/**
 * Création patient (PAT-01). Server Action `createPatientAction` validée
 * via `patientSchema` côté serveur. Redirection vers `/patients/[id]` après
 * succès (RSC + revalidatePath).
 */
export default function NewPatientPage() {
  return (
    <div className="space-y-24">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau patient</h1>
      <PatientForm action={createPatientAction} submitLabel="Créer" />
    </div>
  );
}
