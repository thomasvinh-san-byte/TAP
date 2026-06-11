'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
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
import { PatientPickerField } from '../../_components/ride-patient-picker.client';
import { AddressOrPOIPicker } from '../../_components/address-or-poi-picker.client';
import {
  DateTimeFields,
  ModeUrgencyFields,
  type TransportMode,
  type Urgency,
} from '../../_components/ride-fields';
import { createRideGroupAction } from '../../actions';
import type { OrderingPartyMin } from '../../_lib/queries';

interface Line {
  patient_id?: string;
  patientLabel: string;
  scheduled_at?: string;
  pickup_address: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_citycode?: string | null;
  dropoff_address: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  dropoff_citycode?: string | null;
  transport_mode: TransportMode;
  urgency: Urgency;
}

function emptyLine(): Line {
  return {
    patientLabel: '',
    pickup_address: '',
    dropoff_address: '',
    transport_mode: 'taxi_conventionne',
    urgency: 'programmee',
  };
}

/**
 * Création d'une demande groupée B2B (DEC-158) : un donneur d'ordres + N lignes
 * de transport. Réutilise les champs de la saisie express par ligne. À la
 * soumission, crée le groupe `en_attente` + N courses `brouillon` (createRideGroupAction).
 */
export function DemandeGroupeeForm({ donneurs }: { donneurs: OrderingPartyMin[] }): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [orderingPartyId, setOrderingPartyId] = React.useState('');
  const [lines, setLines] = React.useState<Line[]>([emptyLine()]);
  const [pending, startTransition] = React.useTransition();

  function reset(): void {
    setOrderingPartyId('');
    setLines([emptyLine()]);
  }

  function patch(i: number, p: Partial<Line>): void {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  }

  function submit(): void {
    if (!orderingPartyId) {
      toast.error('Choisissez un donneur d’ordres.');
      return;
    }
    const rides = lines.map((l) => ({
      patient_id: l.patient_id,
      scheduled_at: l.scheduled_at,
      pickup_address: l.pickup_address,
      dropoff_address: l.dropoff_address,
      pickup_lat: l.pickup_lat ?? null,
      pickup_lng: l.pickup_lng ?? null,
      pickup_citycode: l.pickup_citycode ?? null,
      dropoff_lat: l.dropoff_lat ?? null,
      dropoff_lng: l.dropoff_lng ?? null,
      dropoff_citycode: l.dropoff_citycode ?? null,
      transport_mode: l.transport_mode,
      urgency: l.urgency,
    }));
    startTransition(async () => {
      // La validation zod serveur (rideGroupRequestSchema) tranche : patient,
      // date/heure et adresses requis par ligne.
      const res = await createRideGroupAction({
        ordering_party_id: orderingPartyId,
        rides,
      } as never);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Demande groupée créée — ${lines.length} course(s) en attente.`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="accent" className="gap-8" onClick={() => setOpen(true)}>
        <Plus className="h-16 w-16" aria-hidden />
        Nouvelle demande groupée
      </Button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <SheetContent side="right" className="overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>Nouvelle demande groupée</SheetTitle>
            <SheetDescription>
              Choisissez le donneur d&apos;ordres puis ajoutez les transports. La demande part « en
              attente » ; les courses ne sont fermes qu&apos;à l&apos;acceptation.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-24 py-16">
            <div className="max-w-[360px] space-y-8">
              <Label htmlFor="dg-donneur">Donneur d&apos;ordres</Label>
              <Select
                ariaLabel="Donneur d'ordres"
                value={orderingPartyId}
                onChange={setOrderingPartyId}
                placeholder="Choisir un donneur d'ordres"
                items={donneurs.map((d) => ({ value: d.id, label: d.raison_sociale }))}
                triggerClassName="w-full"
              />
            </div>

            {lines.map((line, i) => (
              <div key={i} className="border-border space-y-12 rounded-md border p-16">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Course {i + 1}</span>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-destructive gap-8"
                    >
                      <Trash2 className="h-12 w-12" aria-hidden />
                      Retirer
                    </Button>
                  )}
                </div>

                <PatientPickerField
                  selectedLabel={line.patientLabel}
                  onSelect={(id, label) =>
                    patch(i, { patient_id: id || undefined, patientLabel: label })
                  }
                />
                <DateTimeFields
                  value={line.scheduled_at ?? null}
                  onChange={(iso) => patch(i, { scheduled_at: iso ?? undefined })}
                  error={null}
                />
                <AddressOrPOIPicker
                  id={`dg-${i}-pickup`}
                  label="Adresse de prise en charge"
                  ariaLabel="Adresse de prise en charge"
                  value={line.pickup_address}
                  onChange={(v) => patch(i, { pickup_address: v })}
                  onSelect={(sel) =>
                    patch(i, {
                      pickup_lat: sel.lat ?? null,
                      pickup_lng: sel.lng ?? null,
                      pickup_citycode: sel.citycode ?? null,
                    })
                  }
                />
                <AddressOrPOIPicker
                  id={`dg-${i}-dropoff`}
                  label="Adresse de destination"
                  ariaLabel="Adresse de destination"
                  value={line.dropoff_address}
                  onChange={(v) => patch(i, { dropoff_address: v })}
                  onSelect={(sel) =>
                    patch(i, {
                      dropoff_lat: sel.lat ?? null,
                      dropoff_lng: sel.lng ?? null,
                      dropoff_citycode: sel.citycode ?? null,
                    })
                  }
                />
                <ModeUrgencyFields
                  mode={line.transport_mode}
                  urgency={line.urgency}
                  onModeChange={(m) => patch(i, { transport_mode: m })}
                  onUrgencyChange={(u) => patch(i, { urgency: u })}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="gap-8"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="h-16 w-16" aria-hidden />
              Ajouter une course
            </Button>
          </div>

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" variant="accent" onClick={submit} disabled={pending}>
              {pending ? 'Création…' : `Créer la demande (${lines.length})`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
