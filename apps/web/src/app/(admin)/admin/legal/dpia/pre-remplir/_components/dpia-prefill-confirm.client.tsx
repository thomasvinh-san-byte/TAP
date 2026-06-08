'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { prefillDpiaRecordAction } from '../../actions';
import { DPIA_PREFILL_TRAME } from '../../_lib/dpia-prefill-content';

/**
 * Écran de confirmation de la trame squelette DPIA (Wave 3, D-05).
 *
 * Titre, périmètre et dates de revue éditables. La trame ne contient AUCUN
 * verdict de risque — l'identification des risques reste à la charge du
 * dirigeant. Insérée en statut « brouillon ».
 */

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DpiaPrefillConfirm(): JSX.Element {
  const router = useRouter();
  const today = new Date();
  const inOneYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await prefillDpiaRecordAction({
        title: String(formData.get('title') ?? '').trim(),
        scope: String(formData.get('scope') ?? '').trim(),
        reviewed_at: String(formData.get('reviewed_at') ?? ''),
        next_review_at: String(formData.get('next_review_at') ?? ''),
      });
      if (res.error) setError(res.error);
      else router.push('/admin/legal/dpia');
    });
  }

  return (
    <form action={handleSubmit} className="space-y-24">
      <div className="bg-muted flex items-start gap-12 rounded-lg p-16">
        <AlertTriangle className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-base">
          Cette trame fournit la structure d&apos;une analyse d&apos;impact, sans aucun verdict de
          risque. L&apos;identification et l&apos;évaluation des risques restent votre
          responsabilité (avec votre DPO si besoin). Ceci ne constitue pas un conseil juridique.
        </p>
      </div>

      <div className="space-y-4">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" required defaultValue={DPIA_PREFILL_TRAME.title} />
      </div>
      <div className="space-y-4">
        <Label htmlFor="scope">Périmètre</Label>
        <textarea
          id="scope"
          name="scope"
          required
          rows={4}
          defaultValue={DPIA_PREFILL_TRAME.scope}
          className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor="reviewed_at">Date de revue</Label>
        <DateFieldFr id="reviewed_at" name="reviewed_at" required defaultValue={isoDate(today)} />
      </div>
      <div className="space-y-4">
        <Label htmlFor="next_review_at">Prochaine revue</Label>
        <DateFieldFr
          id="next_review_at"
          name="next_review_at"
          required
          defaultValue={isoDate(inOneYear)}
        />
      </div>

      <p className="text-muted-foreground text-sm">
        Risques et mesures d&apos;atténuation : vides, à compléter par vos soins. Statut :
        brouillon.
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/legal/dpia')}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer la trame (brouillon)'}
        </Button>
      </div>
    </form>
  );
}
