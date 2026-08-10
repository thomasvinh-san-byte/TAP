'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { bulkUnassignRidesAction, exportRidesCsvAction } from '../actions';

/**
 * Barre d'actions groupées sur la sélection de courses (Lot 4/4).
 *
 * Visible uniquement quand au moins une course est sélectionnée (rend `null`
 * sinon). Fondée sur les vrais patterns de dispatch NEMT : PAS d'affectation en
 * lot (chevauchements de créneaux — l'affectation reste unitaire via le drawer ou
 * l'optimiseur). Actions proposées : désaffecter en lot (avec confirmation +
 * compte-rendu, réutilise le garde-fou par course) et exporter la sélection.
 */
export function CoursesBulkActions({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}): JSX.Element | null {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const count = selectedIds.length;
  if (count === 0) return null;

  async function onConfirmUnassign() {
    setUnassigning(true);
    // Réutilise `unassignRideAction` course par course (garde-fous préservés) ;
    // les courses non éligibles sont ignorées proprement et comptées.
    const res = await bulkUnassignRidesAction(selectedIds);
    setUnassigning(false);
    setConfirmOpen(false);
    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    // Compte-rendu explicite : ne jamais laisser croire à un succès total si
    // certaines ont été écartées.
    const ignoredNote =
      res.ignored > 0
        ? ` ${res.ignored} ignorée${res.ignored > 1 ? 's' : ''} (non éligible${
            res.ignored > 1 ? 's' : ''
          } : en cours, terminée ou déjà à affecter).`
        : '';
    if (res.done > 0) {
      toast.success(
        `${res.done} course${res.done > 1 ? 's' : ''} désaffectée${res.done > 1 ? 's' : ''}.${ignoredNote}`,
      );
    } else {
      toast.error(`Aucune course désaffectée.${ignoredNote}`);
    }
    // Rafraîchir la liste (les désaffectées redeviennent « à affecter »).
    void qc.invalidateQueries({ queryKey: ['rides'] });
    onClear();
  }

  async function onExport() {
    setExporting(true);
    // Réutilise l'export CSV existant, étendu pour cibler une liste d'ids
    // (mêmes colonnes / format que l'export par plage).
    const res = await exportRidesCsvAction({ ids: selectedIds });
    setExporting(false);
    if (res.error || !res.csv || !res.filename) {
      toast.error(res.error ?? 'Export impossible.');
      return;
    }
    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Export terminé : ${res.filename}`);
  }

  return (
    <div
      role="region"
      aria-label="Actions groupées sur la sélection"
      className="border-border bg-muted/40 flex flex-wrap items-center gap-12 rounded-md border px-16 py-12"
    >
      <span className="text-sm font-medium" aria-live="polite">
        {count} course{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
      </span>
      <div className="flex flex-wrap items-center gap-8">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          className="gap-4"
        >
          <UserMinus className="h-12 w-12" aria-hidden />
          Désaffecter
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onExport()}
          disabled={exporting}
          className="gap-4"
        >
          <Download className="h-12 w-12" aria-hidden />
          {exporting ? 'Export…' : 'Exporter la sélection'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClear} className="gap-4">
          <X className="h-12 w-12" aria-hidden />
          Tout désélectionner
        </Button>
      </div>

      {/* Confirmation (action sensible) : indique combien seront désaffectées.
          Le détachement effectif respecte le garde-fou par course (les non
          éligibles sont ignorées) ; la réaffectation reste unitaire ensuite. */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !unassigning && setConfirmOpen(o)}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Désaffecter {count} course(s) ?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Les courses affectées sélectionnées repasseront « à affecter » (chauffeur détaché), pour
            être redistribuées ensuite (individuellement ou via l&apos;optimiseur). Les courses non
            éligibles (en cours, terminée, déjà à affecter) seront ignorées.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={unassigning}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onConfirmUnassign()}
              disabled={unassigning}
            >
              {unassigning ? 'Désaffectation…' : 'Désaffecter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
