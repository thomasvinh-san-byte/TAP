'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Jeu de champs du registre des traitements — fragment partagé.
 *
 * Source unique des champs : consommé par `registre-drawer` (création
 * unitaire) et, en Wave 2, par les cartes de l'écran de revue. Évite la
 * divergence entre les deux surfaces.
 *
 * Champs non contrôlés (`defaultValue`) : les valeurs sont lues via la
 * `FormData` du formulaire parent. `idPrefix` rend les `id` uniques quand
 * plusieurs instances coexistent sur une même page.
 */

export interface RegistreFieldsValues {
  purpose: string;
  legal_basis: string;
  data_categories: string;
  data_subjects: string;
  recipients: string;
  retention_period_days: number | string;
  security_measures: string;
  international_transfer: boolean;
}

interface RegistreFieldsProps {
  idPrefix?: string;
  values?: Partial<RegistreFieldsValues>;
}

export function RegistreFields({ idPrefix = '', values }: RegistreFieldsProps): JSX.Element {
  const fieldId = (name: string) => (idPrefix ? `${idPrefix}-${name}` : name);

  return (
    <div className="space-y-16">
      <div className="space-y-4">
        <Label htmlFor={fieldId('purpose')}>Finalité</Label>
        <Input id={fieldId('purpose')} name="purpose" required defaultValue={values?.purpose} />
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('legal_basis')}>Base légale</Label>
        <select
          id={fieldId('legal_basis')}
          name="legal_basis"
          required
          defaultValue={values?.legal_basis}
          className="border-input bg-background flex h-32 w-full rounded-md border px-12 text-sm"
        >
          <option value="consentement">Consentement</option>
          <option value="contrat">Contrat</option>
          <option value="obligation_legale">Obligation légale</option>
          <option value="mission_interet_public">Mission intérêt public</option>
          <option value="interet_legitime">Intérêt légitime</option>
          <option value="sauvegarde_vie">Sauvegarde vie</option>
        </select>
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('data_categories')}>
          Catégories de données (séparées par virgule)
        </Label>
        <Input
          id={fieldId('data_categories')}
          name="data_categories"
          required
          placeholder="identite, contact, sante"
          defaultValue={values?.data_categories}
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('data_subjects')}>
          Personnes concernées (séparées par virgule)
        </Label>
        <Input
          id={fieldId('data_subjects')}
          name="data_subjects"
          required
          placeholder="patient, chauffeur"
          defaultValue={values?.data_subjects}
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('recipients')}>Destinataires (séparés par virgule)</Label>
        <Input
          id={fieldId('recipients')}
          name="recipients"
          required
          placeholder="CGSS, comptable"
          defaultValue={values?.recipients}
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('retention_period_days')}>Conservation (jours)</Label>
        <Input
          id={fieldId('retention_period_days')}
          name="retention_period_days"
          type="number"
          min="1"
          max="36500"
          required
          defaultValue={values?.retention_period_days}
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor={fieldId('security_measures')}>Mesures de sécurité</Label>
        <textarea
          id={fieldId('security_measures')}
          name="security_measures"
          required
          rows={3}
          defaultValue={values?.security_measures}
          className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
        />
      </div>
      <div className="flex items-center gap-8">
        <input
          id={fieldId('international_transfer')}
          name="international_transfer"
          type="checkbox"
          defaultChecked={values?.international_transfer}
        />
        <Label htmlFor={fieldId('international_transfer')}>Transfert international</Label>
      </div>
    </div>
  );
}
