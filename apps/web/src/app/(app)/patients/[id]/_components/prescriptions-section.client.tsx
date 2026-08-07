'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Field, RequiredFieldsLegend } from '@/components/form/field';
import { FormRow } from '@/components/form/form-layout';
import { DateFieldFr } from '@/components/date-field-fr.client';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createPrescriptionAction, type PatientPrescriptionRow } from '../../actions';
import { PrescriptionRenewalButton } from './prescription-renewal-button.client';

export interface PrescriberOption {
  id: string;
  label: string;
}

const STATUT_LABELS: Record<PatientPrescriptionRow['statut'], string> = {
  active: 'Active',
  epuisee: 'Épuisée',
  expiree: 'Expirée',
};

function isExpired(p: PatientPrescriptionRow): boolean {
  return p.date_expiration !== null && p.date_expiration < new Date().toISOString().slice(0, 10);
}

function statutTone(p: PatientPrescriptionRow): 'active' | 'warn' | 'danger' {
  if (p.statut === 'expiree' || isExpired(p)) return 'danger';
  if (p.statut === 'epuisee') return 'danger';
  if (p.trajets_autorises > 0 && p.trajets_consommes / p.trajets_autorises >= 0.8) return 'warn';
  return 'active';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PrescriptionsSection({
  patientId,
  prescriptions,
  prescribers,
}: {
  patientId: string;
  prescriptions: PatientPrescriptionRow[];
  prescribers: PrescriberOption[];
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    // Ancre stable `#prescriptions` : cible des renvois « bon expiré » du cockpit
    // (arrivée directe sur la section). `scroll-mt` évite l'arrivée collée au bord.
    <section id="prescriptions" className="scroll-mt-24 space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Prescriptions / bons de transport
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-8"
        >
          <Plus className="h-12 w-12" aria-hidden />
          Nouveau bon
        </Button>
      </div>

      {prescriptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune prescription enregistrée.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {prescriptions.map((p) => {
            const tone = statutTone(p);
            const restants = Math.max(0, p.trajets_autorises - p.trajets_consommes);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-12 p-12">
                <div className="flex min-w-0 items-center gap-12">
                  <FileText className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">Bon {p.numero}</div>
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {p.trajets_consommes}/{p.trajets_autorises} trajets · {restants} restant
                      {restants > 1 ? 's' : ''}
                      {p.date_expiration ? ` · expire le ${p.date_expiration}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-8">
                  <Badge
                    variant={
                      tone === 'active' ? 'secondary' : tone === 'warn' ? 'outline' : 'destructive'
                    }
                    className="text-xs"
                  >
                    {isExpired(p) && p.statut !== 'expiree' ? 'Expirée' : STATUT_LABELS[p.statut]}
                  </Badge>
                  <PrescriptionRenewalButton prescriptionId={p.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={open} onOpenChange={(o) => setOpen(o)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-[460px]">
          <CreateForm
            patientId={patientId}
            prescribers={prescribers}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CreateForm({
  patientId,
  prescribers,
  onDone,
  onCancel,
}: {
  patientId: string;
  prescribers: PrescriberOption[];
  onDone: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [numero, setNumero] = React.useState('');
  const [datePrescription, setDatePrescription] = React.useState(todayIso());
  const [prescriberId, setPrescriberId] = React.useState('');
  const [trajets, setTrajets] = React.useState('1');
  const [dateExpiration, setDateExpiration] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const res = await createPrescriptionAction({
        patient_id: patientId,
        prescriber_id: prescriberId || null,
        numero: numero.trim(),
        date_prescription: datePrescription,
        trajets_autorises: Number(trajets),
        date_expiration: dateExpiration || '',
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success('Prescription enregistrée.');
      onDone();
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Nouveau bon de transport</SheetTitle>
        <SheetDescription>
          Saisie structurée du bon. Le scan du document sera ajouté ultérieurement.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-16 py-16">
        <RequiredFieldsLegend />
        <FormRow>
          <Field
            id="numero"
            name="numero"
            label="Numéro du bon"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            maxLength={60}
            required
          />
          <Field
            id="trajets"
            name="trajets"
            label="Trajets autorisés"
            value={trajets}
            onChange={(e) => setTrajets(e.target.value)}
            inputMode="numeric"
            className="tabular-nums"
            required
          />
        </FormRow>
        <div className="space-y-8">
          <Label htmlFor="prescriber">Prescripteur (facultatif)</Label>
          <Select
            ariaLabel="Prescripteur"
            value={prescriberId}
            onChange={setPrescriberId}
            placeholder="Aucun"
            items={prescribers.map((p) => ({ value: p.id, label: p.label }))}
            triggerClassName="w-full"
          />
        </div>
        <FormRow>
          <div className="space-y-8">
            <Label htmlFor="date-presc">Date de prescription</Label>
            <DateFieldFr id="date-presc" value={datePrescription} onChange={setDatePrescription} />
          </div>
          <div className="space-y-8">
            <Label htmlFor="date-exp">Expiration (facultatif)</Label>
            <DateFieldFr id="date-exp" value={dateExpiration} onChange={setDateExpiration} />
          </div>
        </FormRow>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>

      <SheetFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="button" variant="accent" onClick={submit} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer le bon'}
        </Button>
      </SheetFooter>
    </>
  );
}
