'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <form action={onSubmit} className="space-y-16">
      <div className="space-y-4">
        <Label htmlFor="dpo_contact_email">Email DPO</Label>
        <Input
          id="dpo_contact_email"
          name="dpo_contact_email"
          type="email"
          defaultValue={initial.dpo_contact_email}
          placeholder="dpo@societe.fr"
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor="dpo_contact_phone">Téléphone DPO</Label>
        <Input
          id="dpo_contact_phone"
          name="dpo_contact_phone"
          type="tel"
          defaultValue={initial.dpo_contact_phone}
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor="dpo_contact_address">Adresse postale</Label>
        <textarea
          id="dpo_contact_address"
          name="dpo_contact_address"
          rows={3}
          defaultValue={initial.dpo_contact_address}
          className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm"
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-success">Contact DPO mis à jour.</p>
      )}

      <div className="pt-8">
        <Button type="submit" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
