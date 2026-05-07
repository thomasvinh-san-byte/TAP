'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { fulfillErasureAction } from '../../actions';

interface Props {
  token: string;
}

/**
 * UI client pour le droit d'effacement (art. 17 RGPD).
 *
 * Confirmation explicite obligatoire avant invocation de la Server Action
 * `fulfillErasureAction` qui appelle la RPC `rgpd_anonymize_patient`
 * (UPDATE only, jamais DELETE — T-1.5-21, R5 RESEARCH).
 *
 * Avertissement « irréversible » affiché côté UI avant et après confirmation.
 */
export function ErasureClient({ token }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok?: true; error?: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <div className="space-y-16">
        <h2 className="text-xl font-semibold tracking-tight">
          Effacement effectué
        </h2>
        <p className="text-sm text-muted-foreground">
          Vos données identifiantes ont été anonymisées de manière
          irréversible. Conformément à la durée légale CGSS (5 ans, CSS
          L114-19), les courses passées sont conservées sans lien
          identitaire pour des raisons comptables. En cas de désaccord,
          vous pouvez saisir la Commission Nationale de l&apos;Informatique
          et des Libertés (cnil.fr).
        </p>
      </div>
    );
  }

  if (result?.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {result.error}
      </p>
    );
  }

  const onConfirm = () => {
    startTransition(async () => {
      const r = await fulfillErasureAction(token);
      setResult(r);
    });
  };

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        className="h-48"
        onClick={() => setConfirming(true)}
      >
        Demander l&apos;effacement de mes données
      </Button>
    );
  }

  return (
    <div className="space-y-16 rounded-md border border-destructive/40 bg-destructive/5 p-24">
      <h2 className="text-xl font-semibold tracking-tight">
        Confirmer l&apos;anonymisation
      </h2>
      <p className="text-sm text-muted-foreground">
        L&apos;effacement de vos données identifiantes est irréversible.
        Cette action ne peut pas être annulée. Vos courses passées
        resteront conservées sous forme anonymisée pour respecter la durée
        légale CGSS de 5 ans (CSS L114-19).
      </p>
      <div className="flex gap-12">
        <Button
          type="button"
          variant="destructive"
          className="h-48"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? 'Anonymisation…' : 'Confirmer l’anonymisation'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-48"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
