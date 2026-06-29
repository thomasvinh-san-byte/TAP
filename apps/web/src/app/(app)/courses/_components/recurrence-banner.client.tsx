'use client';

import { Button } from '@/components/ui/button';
import type { RecurrenceMatch } from '../actions';

/**
 * Bannière de SUGGESTION de récurrence (CdG §5.8, EXPRESS-02). Famille visuelle
 * de `DuplicateBanner` mais ton INFORMATIF (bleu info), pas alerte (ambre) : une
 * récurrence qui tombe ce jour-là est une suggestion, pas un avertissement. Non
 * bloquante — un seul bouton « Compris » qui ferme la suggestion ; aucune action
 * n'empêche la création.
 */
const MODE_LABELS: Record<string, string> = {
  taxi_conventionne: 'taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'ambulance',
};

export type RecurrenceBannerProps = {
  patientLabel: string;
  suggestions: RecurrenceMatch[];
  onDismiss: () => void;
};

export function RecurrenceBanner({
  patientLabel,
  suggestions,
  onDismiss,
}: RecurrenceBannerProps): JSX.Element | null {
  if (suggestions.length === 0) return null;
  const who = patientLabel.trim() || 'Ce patient';
  const plural = suggestions.length > 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-info/30 bg-info/10 space-y-8 rounded-md border px-16 py-12"
    >
      <p className="text-info text-sm font-medium">
        {who} a {plural ? 'des transports récurrents' : 'un transport récurrent'} aujourd&apos;hui.
        Est-ce le même&nbsp;?
      </p>
      <ul className="text-info/90 space-y-4 text-sm">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s.id}>
            vers {s.dropoff_address || 'destination habituelle'}
            {MODE_LABELS[s.transport_mode] ? ` · ${MODE_LABELS[s.transport_mode]}` : ''}
          </li>
        ))}
      </ul>
      <div className="flex justify-end pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
          Compris
        </Button>
      </div>
    </div>
  );
}
