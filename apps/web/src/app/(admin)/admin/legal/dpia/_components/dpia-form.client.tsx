'use client';

import { useState, useTransition } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/form/field';
import { FormSection, FormRow, FormActions } from '@/components/form/form-layout';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { createDpiaAction, updateDpiaAction } from '../actions';

// Select natif aligné sur le gabarit `<Input>` (h-10), soumet via `name`.
const NATIVE_SELECT_CLASS =
  'border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

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
        className="w-[400px] overflow-y-auto sm:w-[400px] sm:max-w-[400px]"
      >
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? 'Nouvelle DPIA' : 'Modifier DPIA'}</SheetTitle>
        </SheetHeader>

        <form action={onSubmit} className="mt-24 space-y-24">
          <FormSection title="Identification">
            <Field
              id="title"
              label="Titre"
              required
              hint="Nom court de l'analyse d'impact (ex : « DPIA Transport patients dialyse »)."
              maxLength={200}
            />
            <div className="space-y-8">
              <Label htmlFor="scope">Périmètre</Label>
              <Textarea id="scope" name="scope" rows={2} required />
            </div>
          </FormSection>

          <FormSection title="Analyse des risques">
            <div className="space-y-8">
              <Label htmlFor="data_flow_diagram">Diagramme de flux (Markdown)</Label>
              <Textarea
                id="data_flow_diagram"
                name="data_flow_diagram"
                rows={5}
                className="font-mono"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="risks_identified">Risques (JSON)</Label>
              <Textarea
                id="risks_identified"
                name="risks_identified"
                rows={3}
                defaultValue="[]"
                className="font-mono"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="mitigations">Mesures (JSON)</Label>
              <Textarea
                id="mitigations"
                name="mitigations"
                rows={3}
                defaultValue="[]"
                className="font-mono"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="residual_risk_level">Risque résiduel</Label>
              <select
                id="residual_risk_level"
                name="residual_risk_level"
                required
                className={NATIVE_SELECT_CLASS}
              >
                <option value="faible">Faible</option>
                <option value="moyen">Moyen</option>
                <option value="eleve">Élevé</option>
              </select>
            </div>
          </FormSection>

          <FormSection title="Suivi">
            <div className="flex items-center gap-8">
              <Checkbox id="cnil_consultation_required" name="cnil_consultation_required" />
              <Label htmlFor="cnil_consultation_required">Consultation CNIL requise</Label>
            </div>
            <FormRow>
              <div className="space-y-8">
                <Label htmlFor="reviewed_at">Revue le</Label>
                <DateFieldFr id="reviewed_at" name="reviewed_at" required />
              </div>
              <div className="space-y-8">
                <Label htmlFor="next_review_at">Prochaine revue</Label>
                <DateFieldFr id="next_review_at" name="next_review_at" required />
              </div>
            </FormRow>
            <div className="space-y-8">
              <Label htmlFor="status">Statut</Label>
              <select id="status" name="status" required className={NATIVE_SELECT_CLASS}>
                <option value="brouillon">Brouillon</option>
                <option value="validee">Validée</option>
                <option value="archivee">Archivée</option>
              </select>
            </div>
          </FormSection>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <FormActions>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </FormActions>
        </form>
      </SheetContent>
    </Sheet>
  );
}
