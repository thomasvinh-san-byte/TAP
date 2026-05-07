'use client';

import { useState, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDpiaAction, updateDpiaAction } from '../actions';

interface Props {
  mode: 'create' | 'edit';
  dpiaId?: string;
  onClose: () => void;
}

/**
 * Form DPIA (D-07) — Markdown long + JSON risques/mesures + workflow status.
 * Largeur Sheet 400px.
 */
export function DpiaForm({ mode, dpiaId, onClose }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const action =
        mode === 'create'
          ? createDpiaAction({ error: undefined }, formData)
          : updateDpiaAction(dpiaId!, { error: undefined }, formData);
      const res = await action;
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <Sheet open={true} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>
            {mode === 'create' ? 'Nouvelle DPIA' : 'Modifier DPIA'}
          </SheetTitle>
        </SheetHeader>

        <form action={onSubmit} className="space-y-16 mt-24">
          <div className="space-y-4">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-4">
            <Label htmlFor="scope">Périmètre</Label>
            <textarea id="scope" name="scope" rows={2} required
              className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="data_flow_diagram">Diagramme de flux (Markdown)</Label>
            <textarea id="data_flow_diagram" name="data_flow_diagram" rows={5}
              className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm font-mono" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="risks_identified">Risques (JSON)</Label>
            <textarea id="risks_identified" name="risks_identified" rows={3}
              defaultValue="[]"
              className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm font-mono" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="mitigations">Mesures (JSON)</Label>
            <textarea id="mitigations" name="mitigations" rows={3}
              defaultValue="[]"
              className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm font-mono" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="residual_risk_level">Risque résiduel</Label>
            <select id="residual_risk_level" name="residual_risk_level" required
              className="flex h-32 w-full rounded-md border border-input bg-background px-12 text-sm">
              <option value="faible">Faible</option>
              <option value="moyen">Moyen</option>
              <option value="eleve">Élevé</option>
            </select>
          </div>
          <div className="flex items-center gap-8">
            <input id="cnil_consultation_required" name="cnil_consultation_required" type="checkbox" />
            <Label htmlFor="cnil_consultation_required">Consultation CNIL requise</Label>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-4">
              <Label htmlFor="reviewed_at">Revue le</Label>
              <Input id="reviewed_at" name="reviewed_at" type="date" required />
            </div>
            <div className="space-y-4">
              <Label htmlFor="next_review_at">Prochaine revue</Label>
              <Input id="next_review_at" name="next_review_at" type="date" required />
            </div>
          </div>
          <div className="space-y-4">
            <Label htmlFor="status">Statut</Label>
            <select id="status" name="status" required
              className="flex h-32 w-full rounded-md border border-input bg-background px-12 text-sm">
              <option value="brouillon">Brouillon</option>
              <option value="validee">Validée</option>
              <option value="archivee">Archivée</option>
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-8 pt-16">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
