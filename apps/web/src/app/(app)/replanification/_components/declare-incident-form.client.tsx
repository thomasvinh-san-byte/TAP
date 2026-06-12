'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { declareIncidentAction } from '../actions';
import type { DriverOption } from '../_lib/queries';

type IncidentType = 'indisponible' | 'panne_vehicule';

const TYPE_ITEMS: { value: IncidentType; label: string }[] = [
  { value: 'indisponible', label: 'Indisponible' },
  { value: 'panne_vehicule', label: 'Panne véhicule' },
];

/**
 * Déclaration d'un incident chauffeur par la régulation (DEC-160, CdG l.371).
 * Un incident rend le chauffeur indisponible opérationnellement et déclenche la
 * proposition de réaffectation de ses courses restantes.
 */
export function DeclareIncidentForm({ drivers }: { drivers: DriverOption[] }): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [driverId, setDriverId] = React.useState('');
  const [type, setType] = React.useState<IncidentType>('indisponible');
  const [nature, setNature] = React.useState('');
  const [lieu, setLieu] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function reset(): void {
    setDriverId('');
    setType('indisponible');
    setNature('');
    setLieu('');
  }

  function submit(): void {
    if (!driverId) {
      toast.error('Choisissez un chauffeur.');
      return;
    }
    startTransition(async () => {
      const res = await declareIncidentAction({
        driverId,
        type,
        nature: nature.trim() || undefined,
        lieu: lieu.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Incident déclaré. Réaffectation proposée ci-dessous.');
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="accent" className="gap-8" onClick={() => setOpen(true)}>
        <TriangleAlert className="h-16 w-16" aria-hidden />
        Déclarer une indisponibilité
      </Button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <SheetContent side="right" className="overflow-y-auto sm:max-w-[460px]">
          <SheetHeader>
            <SheetTitle>Déclarer un incident chauffeur</SheetTitle>
            <SheetDescription>
              Le chauffeur devient indisponible et ses courses restantes sont proposées à la
              réaffectation.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-16 py-16">
            <div className="space-y-8">
              <Label htmlFor="inc-driver">Chauffeur</Label>
              <Select
                ariaLabel="Chauffeur"
                value={driverId}
                onChange={setDriverId}
                placeholder="Choisir un chauffeur"
                items={drivers.map((d) => ({ value: d.id, label: d.nom_affichage }))}
                triggerClassName="w-full"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="inc-type">Type d&apos;incident</Label>
              <Select
                ariaLabel="Type d'incident"
                value={type}
                onChange={(v) => setType(v as IncidentType)}
                items={TYPE_ITEMS}
                triggerClassName="w-full"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="inc-nature">Précision (facultatif)</Label>
              <input
                id="inc-nature"
                value={nature}
                onChange={(e) => setNature(e.target.value)}
                maxLength={500}
                className="border-input focus-visible:ring-ring w-full rounded-md border px-12 py-8 text-sm focus-visible:outline-none focus-visible:ring-2"
                placeholder="Ex. arrêt maladie, véhicule au garage…"
              />
            </div>
            <div className="space-y-8">
              <Label htmlFor="inc-lieu">Lieu (facultatif)</Label>
              <input
                id="inc-lieu"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                maxLength={200}
                className="border-input focus-visible:ring-ring w-full rounded-md border px-12 py-8 text-sm focus-visible:outline-none focus-visible:ring-2"
                placeholder="Ex. RN1 Saint-Paul"
              />
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" variant="accent" onClick={submit} disabled={pending}>
              {pending ? 'Déclaration…' : "Déclarer l'incident"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
