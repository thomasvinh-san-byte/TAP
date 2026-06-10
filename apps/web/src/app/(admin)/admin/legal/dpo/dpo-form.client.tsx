'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/form/field';
import { FormSection, FormActions } from '@/components/form/form-layout';
import { updateDpoContactAction } from './actions';

interface Props {
  initial: {
    dpo_contact_email: string;
    dpo_contact_phone: string;
    dpo_contact_address: string;
    dpo_external: boolean;
  };
}

export function DpoForm({ initial }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateDpoContactAction({ error: undefined }, formData);
      if (res.error) setError(res.error);
      else setSuccess(true);
    });
  }

  return (
    <form action={onSubmit} className="space-y-24">
      <FormSection title="Coordonnées du DPO">
        <Field
          id="dpo_contact_email"
          label="Email DPO"
          type="email"
          defaultValue={initial.dpo_contact_email}
          placeholder="dpo@societe.fr"
          hint="Adresse mail à afficher pour les contacts RGPD patients."
          maxLength={120}
        />
        <Field
          id="dpo_contact_phone"
          label="Téléphone DPO"
          type="tel"
          inputMode="tel"
          defaultValue={initial.dpo_contact_phone}
          placeholder="02 62 12 34 56"
          hint="Numéro de contact (format libre, jusqu'à 14 caractères)."
          maxLength={14}
        />
        <div className="space-y-8">
          <Label htmlFor="dpo_contact_address">Adresse postale</Label>
          <Textarea
            id="dpo_contact_address"
            name="dpo_contact_address"
            rows={3}
            defaultValue={initial.dpo_contact_address}
          />
        </div>
        <div className="flex items-center gap-8">
          <input
            id="dpo_external"
            name="dpo_external"
            type="checkbox"
            defaultChecked={initial.dpo_external}
          />
          <Label htmlFor="dpo_external">DPO externe (cabinet)</Label>
        </div>
      </FormSection>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-success text-sm">Contact DPO mis à jour.</p>}

      <FormActions>
        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </FormActions>
    </form>
  );
}
