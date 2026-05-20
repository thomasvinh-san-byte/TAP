'use client';

import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  computeCgssFromDistance,
  type MajorationMotif,
  type TariffGrid,
} from '@tap/pricing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Simulateur de tarif live (Surface C — UI-SPEC §5).
 *
 * Recalcul `useMemo` à chaque changement d'entrée — pas de bouton
 * « Calculer ». Réutilise `computeCgssFromDistance` (cœur pur partagé
 * avec `computeCgssShortTrip`). Entrées purement numériques (NFR-001).
 *
 * `holidays974` : non câblé dans le simulateur V1.5 — le simulateur teste
 * distance / heure / TPMR. La majoration jour férié est couverte par le
 * calcul réel des courses (ride-drawer). Set vide ici = choix assumé.
 */
function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

const MAJORATION_LABEL: Record<Exclude<MajorationMotif, null>, string> = {
  nuit: 'Majoration nuit',
  weekend: 'Majoration week-end',
  ferie: 'Majoration jour férié',
};

const EMPTY_HOLIDAYS: Set<string> = new Set();

export function TariffSimulator({ grid }: { grid: TariffGrid }): JSX.Element {
  const [distanceKm, setDistanceKm] = useState('12');
  const [heure, setHeure] = useState('08:00');
  const [tpmr, setTpmr] = useState(false);

  const result = useMemo(() => {
    const distance = Number.parseFloat(distanceKm);
    const distanceValue = Number.isFinite(distance) && distance >= 0 ? distance : null;
    // scheduled_at : date arbitraire (lundi ouvré 2026-06-01) + heure saisie.
    // L'heure pilote la majoration nuit ; le jour est neutre (lundi).
    const scheduledAt = `2026-06-01T${heure}:00.000+04:00`;
    return computeCgssFromDistance(
      distanceValue,
      {
        scheduled_at: scheduledAt,
        transport_mode: tpmr ? 'tpmr' : 'taxi_conventionne',
        holidays974: EMPTY_HOLIDAYS,
      },
      grid,
    );
  }, [distanceKm, heure, tpmr, grid]);

  return (
    <article className="rounded-md border border-border bg-muted/20 p-16">
      <header className="mb-12 flex items-center gap-8">
        <Calculator aria-hidden className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Simulateur</h2>
      </header>

      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-4">
          <Label htmlFor="sim-distance">Distance (km)</Label>
          <Input
            id="sim-distance"
            type="number"
            min={0}
            step={0.1}
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          <Label htmlFor="sim-heure">Heure de prise en charge</Label>
          <Input
            id="sim-heure"
            type="time"
            value={heure}
            onChange={(e) => setHeure(e.target.value)}
          />
        </div>
      </div>

      <label className="mt-12 flex items-center gap-8 text-sm">
        <input
          type="checkbox"
          checked={tpmr}
          onChange={(e) => setTpmr(e.target.checked)}
        />
        Véhicule TPMR
      </label>

      <dl className="mt-16 space-y-6 border-t border-border pt-12 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Forfait</dt>
          <dd className="font-mono tabular-nums">
            {formatEur(result.forfait_eur)}
          </dd>
        </div>
        {result.km_total_eur !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Km facturés</dt>
            <dd className="font-mono tabular-nums">
              {formatEur(result.km_total_eur)}
            </dd>
          </div>
        )}
        {result.supplement_drom_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément DROM</dt>
            <dd className="font-mono tabular-nums">
              {formatEur(result.supplement_drom_eur)}
            </dd>
          </div>
        )}
        {result.supplement_tpmr_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément TPMR</dt>
            <dd className="font-mono tabular-nums">
              {formatEur(result.supplement_tpmr_eur)}
            </dd>
          </div>
        )}
        {result.majoration_eur > 0 && result.majoration_motif !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {MAJORATION_LABEL[result.majoration_motif]}
            </dt>
            <dd className="font-mono tabular-nums">
              {formatEur(result.majoration_eur)}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-8 text-base font-semibold">
          <dt>Total</dt>
          <dd className="font-mono tabular-nums">
            {formatEur(result.total_eur)}
          </dd>
        </div>
      </dl>
      <p className="mt-8 text-xs text-muted-foreground">Estimation indicative.</p>
    </article>
  );
}
