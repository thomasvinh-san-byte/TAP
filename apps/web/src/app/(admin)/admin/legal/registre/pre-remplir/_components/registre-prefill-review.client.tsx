'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import type { DataProcessingRegisterInput } from '@tap/shared';
import { Button } from '@/components/ui/button';
import { prefillDataProcessingRegisterAction } from '../../actions';
import { RegistrePrefillCard } from './registre-prefill-card.client';

/**
 * Écran de revue du pré-remplissage du registre (Wave 2 — la pièce maîtresse).
 *
 * Disclaimer de non-certification en tête (D-07), 6 cartes éditables, et une
 * insertion qui n'écrit que les entrées cochées (D-02b — le registre est
 * append-only). Pas de flag « suggéré » persisté (D-08).
 */

const SHORT_LABELS = [
  'Planification et exécution des courses',
  'Facturation CGSS et comptabilité',
  'Gestion des chauffeurs',
  'Données de santé des patients',
  'Géolocalisation et adresses',
  'Consentement aux cookies',
];

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lit une entrée depuis le `<form>` de la carte d'index donné. */
function readEntryFromForm(index: number): DataProcessingRegisterInput | null {
  const form = document.getElementById(`prefill-form-${index}`);
  if (!(form instanceof HTMLFormElement)) return null;
  const fd = new FormData(form);
  return {
    purpose: String(fd.get('purpose') ?? '').trim(),
    legal_basis: String(fd.get('legal_basis') ?? '') as DataProcessingRegisterInput['legal_basis'],
    data_categories: splitList(fd.get('data_categories')),
    data_subjects: splitList(fd.get('data_subjects')),
    recipients: splitList(fd.get('recipients')),
    retention_period_days: Number(fd.get('retention_period_days') ?? 0),
    security_measures: String(fd.get('security_measures') ?? '').trim(),
    international_transfer: fd.get('international_transfer') === 'on',
    international_transfer_safeguards: null,
  };
}

export function RegistrePrefillReview({
  entries,
}: {
  entries: DataProcessingRegisterInput[];
}): JSX.Element {
  const router = useRouter();
  const [included, setIncluded] = useState<boolean[]>(() => entries.map(() => true));
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const checkedCount = included.filter(Boolean).length;

  function handleInsert() {
    setError(undefined);
    const selected: DataProcessingRegisterInput[] = [];
    included.forEach((inc, i) => {
      if (!inc) return;
      const entry = readEntryFromForm(i);
      if (entry) selected.push(entry);
    });
    startTransition(async () => {
      const res = await prefillDataProcessingRegisterAction(selected);
      if (res.error) setError(res.error);
      else router.push('/admin/legal/registre');
    });
  }

  return (
    <div className="space-y-24">
      <div className="bg-muted flex items-start gap-12 rounded-lg p-16">
        <AlertTriangle className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-base">
          Ces entrées sont des suggestions adaptées au transport sanitaire. Vérifiez et
          personnalisez chacune selon votre activité réelle. Vous restez responsable de leur
          exactitude et de leur mise à jour. Ceci ne constitue pas un conseil juridique.
        </p>
      </div>

      <p className="text-muted-foreground text-sm">
        {entries.length} entrées proposées : décochez celles à ne pas insérer.
      </p>

      <div className="space-y-16">
        {entries.map((entry, i) => (
          <RegistrePrefillCard
            key={i}
            entry={entry}
            index={i}
            label={SHORT_LABELS[i] ?? entry.purpose}
            included={included[i] ?? false}
            onIncludedChange={(v) => setIncluded((prev) => prev.map((x, j) => (j === i ? v : x)))}
          />
        ))}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-8">
        <Button
          variant="outline"
          onClick={() => router.push('/admin/legal/registre')}
          disabled={pending}
        >
          Annuler
        </Button>
        <Button onClick={handleInsert} disabled={pending || checkedCount === 0}>
          {pending ? 'Insertion…' : `Insérer les ${checkedCount} entrées cochées`}
        </Button>
      </div>
    </div>
  );
}
