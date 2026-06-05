import { PageHeader } from '@/components/page-header';
import { PatientForm } from '../_components/patient-form.client';
import { createPatientAction } from '../actions';

export const metadata = { title: 'Nouveau patient' };

/**
 * Création patient (PAT-01). Server Action `createPatientAction` validée
 * via `patientSchema` côté serveur. Redirection vers `/patients/[id]` après
 * succès (RSC + revalidatePath).
 */
export default function NewPatientPage() {
  return (
    <div className="space-y-24">
      <PageHeader title="Nouveau patient" />
      <PatientForm action={createPatientAction} submitLabel="Créer" />
    </div>
  );
}
