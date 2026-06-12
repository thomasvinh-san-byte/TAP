'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { listPrescriptionsForPatientAction } from '../../patients/actions';

/**
 * Sélecteur de prescription / bon de transport — OPTIONNEL (CdG §5.3, DEC-163).
 *
 * Liste les prescriptions du patient sélectionné. Si la prescription choisie est
 * épuisée ou expirée → AVERTISSEMENT visible (CdG : « alerte avant saisie de la
 * course »), sans bloquer (le régulateur décide). Désactivé tant qu'aucun patient
 * n'est choisi (un bon appartient à un patient).
 */
interface Props {
  patientId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function statusLabel(statut: string, restants: number): string {
  if (statut === 'expiree') return 'expirée';
  if (statut === 'epuisee') return 'épuisée';
  return `${restants} restant${restants > 1 ? 's' : ''}`;
}

export function PrescriptionPickerField({ patientId, selectedId, onSelect }: Props): JSX.Element {
  const query = useQuery({
    queryKey: ['ride-prescriptions', patientId],
    queryFn: () => listPrescriptionsForPatientAction(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const list = query.data ?? [];
    return list.map((p) => {
      const restants = Math.max(0, p.trajets_autorises - p.trajets_consommes);
      return { value: p.id, label: `Bon ${p.numero} — ${statusLabel(p.statut, restants)}` };
    });
  }, [query.data]);

  const selected = (query.data ?? []).find((p) => p.id === selectedId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const warn =
    selected !== null &&
    (selected.statut === 'epuisee' ||
      selected.statut === 'expiree' ||
      (selected.date_expiration !== null && selected.date_expiration < today));

  if (!patientId) {
    return (
      <div className="space-y-8">
        <Label>Prescription</Label>
        <p className="text-muted-foreground text-xs">
          Choisissez d&apos;abord un patient pour rattacher un bon de transport.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Label htmlFor="prescription">Prescription (facultatif)</Label>
      <Select
        ariaLabel="Prescription"
        value={selectedId ?? ''}
        onChange={(v) => onSelect(v || null)}
        placeholder={items.length > 0 ? 'Aucune' : 'Aucun bon pour ce patient'}
        items={items}
        triggerClassName="w-full"
      />
      {warn && (
        <p className="text-destructive text-xs" role="alert">
          Ce bon est {selected && selected.statut === 'expiree' ? 'expiré' : 'épuisé/expiré'} — la
          course pourrait ne pas être remboursée par la CGSS.
        </p>
      )}
    </div>
  );
}
