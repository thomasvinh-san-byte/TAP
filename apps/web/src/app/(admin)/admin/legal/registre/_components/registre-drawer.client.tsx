'use client';

import { useState, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDataProcessingRegisterAction } from '../actions';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer création entrée registre (D-05). Largeur 400px (cf. patient-drawer).
 * Pas de mode édition (D-05 versioning par lignes — créer une nouvelle entrée).
 */
export function RegistreDrawer({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await createDataProcessingRegisterAction(
        { error: undefined },
        formData,
      );
      if (res.error) setError(res.error);
      else onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Nouvelle entrée registre</SheetTitle>
          <SheetDescription>
            Article 30 RGPD — chaque enregistrement crée une nouvelle version.
          </SheetDescription>
        </SheetHeader>

        <form action={onSubmit} className="space-y-16 mt-24">
          <div className="space-y-4">
            <Label htmlFor="purpose">Finalité</Label>
            <Input id="purpose" name="purpose" required />
          </div>
          <div className="space-y-4">
            <Label htmlFor="legal_basis">Base légale</Label>
            <select
              id="legal_basis"
              name="legal_basis"
              required
              className="flex h-32 w-full rounded-md border border-input bg-background px-12 text-sm"
            >
              <option value="consentement">Consentement</option>
              <option value="contrat">Contrat</option>
              <option value="obligation_legale">Obligation légale</option>
              <option value="mission_interet_public">Mission intérêt public</option>
              <option value="interet_legitime">Intérêt légitime</option>
              <option value="sauvegarde_vie">Sauvegarde vie</option>
            </select>
          </div>
          <div className="space-y-4">
            <Label htmlFor="data_categories">Catégories de données (séparées par virgule)</Label>
            <Input id="data_categories" name="data_categories" required placeholder="identite, contact, sante" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="data_subjects">Personnes concernées (séparées par virgule)</Label>
            <Input id="data_subjects" name="data_subjects" required placeholder="patient, chauffeur" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="recipients">Destinataires (séparés par virgule)</Label>
            <Input id="recipients" name="recipients" required placeholder="CGSS, comptable" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="retention_period_days">Conservation (jours)</Label>
            <Input
              id="retention_period_days"
              name="retention_period_days"
              type="number"
              min="1"
              max="36500"
              required
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="security_measures">Mesures de sécurité</Label>
            <textarea
              id="security_measures"
              name="security_measures"
              required
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-12 py-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-8">
            <input id="international_transfer" name="international_transfer" type="checkbox" />
            <Label htmlFor="international_transfer">Transfert international</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-8 pt-16">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
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
