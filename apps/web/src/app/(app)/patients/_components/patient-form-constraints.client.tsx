'use client';

import { useState, useTransition } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addPatientConstraintAction, removePatientConstraintAction } from '../constraints.actions';

const CONSTRAINT_TYPES = [
  { value: 'medical_oxygene', label: 'Oxygène' },
  { value: 'medical_fauteuil', label: 'Fauteuil roulant' },
  { value: 'medical_brancard', label: 'Brancard' },
  { value: 'vehicule_tpmr', label: 'Véhicule TPMR' },
  { value: 'horaire_matin', label: 'Horaire matin' },
  { value: 'horaire_apres_midi', label: 'Horaire après-midi' },
  { value: 'accompagnement_obligatoire', label: 'Accompagnement obligatoire' },
  { value: 'autre', label: 'Autre' },
] as const;

interface Constraint {
  id: string;
  type: string;
  note: string | null;
}

interface Props {
  patientId: string;
  initial: Constraint[];
}

/**
 * Édition contraintes patient (B-2, PAT-05). Server Actions atomiques
 * (add/remove). Audit géré par trigger Postgres `patient_constraint_audit`.
 */
export function PatientFormConstraints({ patientId, initial }: Props) {
  const [items, setItems] = useState<Constraint[]>(initial);
  const [type, setType] = useState<string>('medical_oxygene');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      const res = await addPatientConstraintAction(patientId, type, note || undefined);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setItems([...items, res.created]);
      setNote('');
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const res = await removePatientConstraintAction(id);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setItems(items.filter((c) => c.id !== id));
    });
  }

  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-sm font-semibold uppercase">Contraintes</h2>
      <ul className="flex flex-wrap gap-8" aria-label="Contraintes actuelles">
        {items.length === 0 && (
          <li className="text-muted-foreground text-sm">Aucune contrainte.</li>
        )}
        {items.map((c) => (
          <li key={c.id}>
            <Badge variant="outline" className="gap-8">
              {CONSTRAINT_TYPES.find((t) => t.value === c.type)?.label ?? c.type}
              {c.note ? ` — ${c.note}` : ''}
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                disabled={pending}
                aria-label={`Supprimer ${c.type}`}
                className="ml-4"
              >
                <X className="h-12 w-12" aria-hidden />
              </button>
            </Badge>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-12">
        <div className="space-y-8">
          <Label htmlFor="constraint-type">Type</Label>
          <select
            id="constraint-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border-border bg-background h-48 w-full rounded-md border px-12 text-sm"
          >
            {CONSTRAINT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-8">
          <Label htmlFor="constraint-note">Précision (optionnel)</Label>
          <Input id="constraint-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="button" onClick={handleAdd} disabled={pending} className="h-48">
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Ajouter
        </Button>
      </div>
    </section>
  );
}
