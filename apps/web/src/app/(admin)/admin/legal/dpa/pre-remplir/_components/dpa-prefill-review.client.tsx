'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prefillDpaRecordsAction, type DpaPrefillInput } from '../../actions';
import { DpaPrefillCard } from './dpa-prefill-card.client';
import type { DpaPrefillFiche } from '../../_lib/dpa-prefill-content';

/**
 * Écran de revue du pré-remplissage des fiches DPA (Wave 3).
 *
 * Même pattern review-then-insert que le registre. Le dirigeant doit
 * renseigner `signed_at` et `dpa_version` de chaque fiche cochée avant
 * insertion (D-04) — la validation locale bloque sinon.
 */

function readFiche(index: number): DpaPrefillInput | null {
  const form = document.getElementById(`dpa-prefill-form-${index}`);
  if (!(form instanceof HTMLFormElement)) return null;
  const fd = new FormData(form);
  return {
    subprocessor_name: String(fd.get('subprocessor_name') ?? '').trim(),
    subprocessor_role: String(fd.get('subprocessor_role') ?? '').trim(),
    dpa_version: String(fd.get('dpa_version') ?? '').trim(),
    signed_at: String(fd.get('signed_at') ?? '').trim(),
    notes: String(fd.get('notes') ?? '').trim(),
  };
}

export function DpaPrefillReview({ fiches }: { fiches: DpaPrefillFiche[] }): JSX.Element {
  const router = useRouter();
  const [included, setIncluded] = useState<boolean[]>(() => fiches.map(() => true));
  const [cardErrors, setCardErrors] = useState<(string | undefined)[]>(() =>
    fiches.map(() => undefined),
  );
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const checkedCount = included.filter(Boolean).length;

  function handleInsert() {
    setError(undefined);
    const nextErrors: (string | undefined)[] = fiches.map(() => undefined);
    const selected: DpaPrefillInput[] = [];
    let blocked = false;

    included.forEach((inc, i) => {
      if (!inc) return;
      const fiche = readFiche(i);
      if (!fiche) return;
      if (!fiche.dpa_version || !fiche.signed_at) {
        nextErrors[i] = 'Renseignez la version du DPA et la date de signature.';
        blocked = true;
        return;
      }
      selected.push(fiche);
    });

    setCardErrors(nextErrors);
    if (blocked) return;

    startTransition(async () => {
      const res = await prefillDpaRecordsAction(selected);
      if (res.error) setError(res.error);
      else router.push('/admin/legal/dpa');
    });
  }

  return (
    <div className="space-y-24">
      <div className="bg-muted flex items-start gap-12 rounded-lg p-16">
        <AlertTriangle className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-sm">
          Ces fiches décrivent vos sous-traitants techniques. TAP les pré-remplit, mais le contrat
          (DPA) signé et sa version restent à votre charge : renseignez-les ci-dessous. Vous restez
          responsable de ces informations. Ceci ne constitue pas un conseil juridique.
        </p>
      </div>

      <p className="text-muted-foreground text-sm">
        {fiches.length} fiches proposées : décochez celles à ne pas insérer.
      </p>

      <div className="space-y-16">
        {fiches.map((fiche, i) => (
          <DpaPrefillCard
            key={i}
            fiche={fiche}
            index={i}
            included={included[i] ?? false}
            error={cardErrors[i]}
            onIncludedChange={(v) => setIncluded((prev) => prev.map((x, j) => (j === i ? v : x)))}
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-8">
        <Button
          variant="outline"
          onClick={() => router.push('/admin/legal/dpa')}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button onClick={handleInsert} disabled={pending || checkedCount === 0}>
          {pending ? 'Insertion…' : `Insérer les ${checkedCount} fiches cochées`}
        </Button>
      </div>
    </div>
  );
}
