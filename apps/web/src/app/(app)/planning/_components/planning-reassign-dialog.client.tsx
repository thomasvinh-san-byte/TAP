'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import type { PlanningDriverOption } from '../_lib/planning-queries';
import type { ReassignConflict } from '../_lib/planning-conflicts';

/** Cible « non affectées » (désaffectation) — même convention que la grille. */
export const REASSIGN_UNASSIGNED = '__unassigned__';

export interface ReassignTarget {
  rideId: string;
  patientLabel: string;
  scheduledAt: string;
  currentDriverId: string | null;
  /** Cible pré-sélectionnée (dépose avec conflit) ou `undefined` (choix clavier). */
  presetTarget?: string | null;
}

interface Props {
  target: ReassignTarget | null;
  drivers: PlanningDriverOption[];
  pending: boolean;
  /** Conflit probable pour une cible donnée (`null` = aucun). */
  conflictFor: (rideId: string, targetDriverId: string | null) => ReassignConflict | null;
  onConfirm: (rideId: string, targetDriverId: string | null) => void;
  onClose: () => void;
}

/** Traduit la valeur du select en id chauffeur (`null` = non affectées). */
function toDriverId(value: string): string | null {
  return value === REASSIGN_UNASSIGNED ? null : value;
}

/**
 * Boîte de réaffectation (Module 5.12 lot B) — chemin ACCESSIBLE CLAVIER de la
 * réaffectation (alternative au glisser-déposer) ET confirmation quand une
 * dépose déclenche un conflit horaire probable. Sélection d'un chauffeur cible
 * (ou « non affectées »), alerte de chevauchement en couleur + texte, jamais
 * bloquante. Réutilise les Server Actions de réaffectation via `onConfirm`.
 */
export function PlanningReassignDialog({
  target,
  drivers,
  pending,
  conflictFor,
  onConfirm,
  onClose,
}: Props): JSX.Element {
  const initial =
    target?.presetTarget === undefined
      ? (target?.currentDriverId ?? REASSIGN_UNASSIGNED)
      : (target?.presetTarget ?? REASSIGN_UNASSIGNED);
  const [value, setValue] = React.useState<string>(initial);

  // Réinitialise la sélection à chaque ouverture sur une nouvelle course.
  React.useEffect(() => {
    setValue(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.rideId]);

  if (!target) return <Dialog open={false}>{null}</Dialog>;

  const targetDriverId = toDriverId(value);
  const conflict = conflictFor(target.rideId, targetDriverId);
  const unchanged = targetDriverId === target.currentDriverId;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réaffecter la course</DialogTitle>
          <DialogDescription>
            {target.patientLabel} · {formatReunionTime(target.scheduledAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          <label className="flex flex-col gap-4">
            <span className="text-muted-foreground text-xs font-medium">Chauffeur</span>
            <select
              className={cn(
                'border-input bg-background focus-visible:ring-ring h-11 rounded-md border px-8 text-sm',
                'focus-visible:outline-none focus-visible:ring-2',
              )}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              autoFocus
            >
              <option value={REASSIGN_UNASSIGNED}>Non affectées</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          {conflict ? (
            <div
              role="alert"
              className="border-warning/40 bg-warning/10 text-warning-foreground flex items-start gap-8 rounded-md border p-8 text-sm"
            >
              <AlertTriangle className="text-warning mt-0.5 h-16 w-16 shrink-0" aria-hidden />
              <span>
                Chevauchement horaire probable :{' '}
                <span className="font-medium">
                  {conflict.count} course{conflict.count > 1 ? 's' : ''}
                </span>{' '}
                de ce chauffeur à proximité, la plus proche à{' '}
                {formatReunionTime(conflict.nearestScheduledAt)}. Les durées de course ne sont pas
                connues : cette alerte ne bloque pas la réaffectation.
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(target.rideId, targetDriverId)}
            disabled={pending || unchanged}
          >
            {unchanged ? 'Aucun changement' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
