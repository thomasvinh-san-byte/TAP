'use client';

import { Button } from '@/components/ui/button';
import { STATUS_LABELS_FR, formatHourFR } from './ride-status-fr';

/**
 * Banner « course en doublon » — scaffold Wave 0 Phase 03.1.
 *
 * Markup complet (amber, accessibilité role="alert", boutons d'action). Le
 * composant est instancié par Plan 03.1-03 dans le modal saisie express
 * une fois la détection de doublons câblée côté Server Action.
 *
 * Aucun emoji, aucune icône Lucide (cf. UI-SPEC anti-patterns).
 */
export type DuplicateBannerProps = {
  duplicates: Array<{ id: string; scheduled_at: string; status: string }>;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DuplicateBanner(props: DuplicateBannerProps): JSX.Element | null {
  if (props.duplicates.length === 0) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="space-y-8 rounded-md border border-amber-500/50 bg-amber-50 px-16 py-12 dark:bg-amber-950/30"
    >
      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
        Course en doublon détectée
      </p>
      <ul className="space-y-4 text-sm text-amber-900/80 dark:text-amber-100/80">
        {props.duplicates.slice(0, 3).map((d) => (
          <li key={d.id}>
            {formatHourFR(d.scheduled_at)} — {STATUS_LABELS_FR[d.status] ?? d.status}
          </li>
        ))}
      </ul>
      {/* `pt-4` = 16 px Tailwind default, conforme scale 4/8/12/16/24/32/48/64. */}
      <div className="flex justify-end gap-8 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={props.isPending}
          onClick={props.onCancel}
        >
          Annuler
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={props.isPending}
          onClick={props.onConfirm}
        >
          Créer quand même
        </Button>
      </div>
    </div>
  );
}
