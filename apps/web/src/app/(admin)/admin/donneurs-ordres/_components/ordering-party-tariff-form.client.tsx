'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { NumberField } from '@/components/form/number-field';
import { RequiredFieldsLegend, RequiredMark } from '@/components/form/field';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getOrderingPartyActiveTariffGridAction,
  saveOrderingPartyTariffGridAction,
  type OrderingPartyTariffGridRow,
} from '../actions';

/**
 *
 * Bouton dans la fiche donneur qui ouvre une Sheet dédiée (portalisée → pas de
 * `<form>` imbriqué dans le formulaire donneur). Versionnement strict comme
 * /admin/tarifs : enregistrer = créer une nouvelle version datée. Pré-rempli
 * depuis la grille active courante. Champs identiques à la grille CGSS — la
 * grille est injectée telle quelle dans `computeCgssFromDistance` (moteur
 * inchangé).
 */
interface NumDef {
  name: keyof Omit<OrderingPartyTariffGridRow, 'date_effet'>;
  label: string;
  step: number;
  fallback: number;
}

const FIELDS: NumDef[] = [
  { name: 'forfait_eur', label: 'Forfait (€)', step: 0.01, fallback: 0 },
  { name: 'km_inclus', label: 'Km inclus', step: 1, fallback: 0 },
  { name: 'prix_km_eur', label: 'Prix au km (€)', step: 0.01, fallback: 0 },
  { name: 'supplement_drom_eur', label: 'Supplément DROM (€)', step: 0.01, fallback: 0 },
  { name: 'supplement_tpmr_eur', label: 'Supplément TPMR (€)', step: 0.01, fallback: 0 },
  { name: 'majoration_pct', label: 'Majoration (%)', step: 1, fallback: 0 },
  { name: 'facteur_correction_routier', label: 'Facteur correction', step: 0.01, fallback: 1.4 },
  { name: 'arrondi_eur', label: 'Arrondi (€)', step: 0.01, fallback: 0.05 },
];

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function OrderingPartyTariffForm({ partyId }: { partyId: string }): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<OrderingPartyTariffGridRow | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Charge la grille active à l'ouverture (pré-remplissage).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoaded(false);
    void getOrderingPartyActiveTariffGridAction(partyId).then((g) => {
      if (cancelled) return;
      setCurrent(g);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, partyId]);

  function handleSubmit(formData: FormData): void {
    startTransition(async () => {
      const res = await saveOrderingPartyTariffGridAction(partyId, formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Grille tarifaire enregistrée.');
      setOpen(false);
    });
  }

  return (
    <div className="border-border border-t pt-16">
      <div className="space-y-8">
        <p className="text-sm font-medium">Grille tarifaire propre</p>
        <p className="text-muted-foreground text-xs">
          Ce donneur d&apos;ordres utilise sa propre grille pour le calcul des courses (au lieu de
          la grille CGSS de l&apos;organisation).
        </p>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Définir / modifier la grille
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>Grille tarifaire du donneur</SheetTitle>
            <SheetDescription>
              {loaded && !current
                ? 'Aucune grille définie — tant qu’aucune grille propre n’est enregistrée, la grille CGSS de l’organisation s’applique.'
                : 'Enregistrer crée une nouvelle version datée (l’historique est conservé).'}
            </SheetDescription>
          </SheetHeader>

          {/* key=loaded : remonte les champs une fois la grille chargée (defaultValue). */}
          <form
            action={handleSubmit}
            key={loaded ? 'loaded' : 'loading'}
            className="space-y-16 py-16"
          >
            <RequiredFieldsLegend />
            <div className="space-y-8">
              <Label htmlFor="opg-date">
                Date d&apos;effet
                <RequiredMark />
              </Label>
              <DateFieldFr id="opg-date" name="date_effet" defaultValue={tomorrowIso()} required />
            </div>
            <div className="grid grid-cols-2 gap-12">
              {FIELDS.map((f) => (
                <NumberField
                  key={f.name}
                  id={`opg-${f.name}`}
                  name={f.name}
                  label={f.label}
                  min={0}
                  step={f.step}
                  defaultValue={current ? current[f.name] : f.fallback}
                  required
                />
              ))}
            </div>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button type="submit" variant="accent" disabled={pending}>
                {pending ? 'Enregistrement…' : 'Enregistrer la grille'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
