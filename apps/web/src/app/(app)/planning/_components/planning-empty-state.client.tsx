'use client';

import { CalendarX2, SearchX } from 'lucide-react';
import { HeaderNewRideButton } from '../../courses/_components/header-new-ride-button.client';

/**
 * États vides travaillés de la grille planning (Module 5.12, raffinement Gantt) —
 * une invitation à agir, pas une grille fantôme. Deux cas distincts :
 *   - aucune course ce jour → proposer d'en créer une (CTA réutilisé) ;
 *   - des courses existent mais les filtres n'en laissent aucune → l'indiquer,
 *     sans laisser croire que la journée est vide.
 */

export function PlanningEmptyDay(): JSX.Element {
  return (
    <div className="border-border bg-card text-card-foreground shadow-elev-sm flex flex-col items-center gap-12 rounded-lg border px-24 py-48 text-center">
      <span className="bg-muted text-muted-foreground flex h-48 w-48 items-center justify-center rounded-full">
        <CalendarX2 className="h-24 w-24" aria-hidden />
      </span>
      <div className="space-y-4">
        <p className="text-foreground text-base font-semibold">Aucune course planifiée ce jour</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Créez une course ou choisissez une autre date pour retrouver le planning des tournées.
        </p>
      </div>
      <HeaderNewRideButton />
    </div>
  );
}

export function PlanningNoMatch(): JSX.Element {
  return (
    <div className="border-border bg-card text-card-foreground shadow-elev-sm flex flex-col items-center gap-8 rounded-lg border px-24 py-32 text-center">
      <span className="bg-muted text-muted-foreground flex h-40 w-40 items-center justify-center rounded-full">
        <SearchX className="h-20 w-20" aria-hidden />
      </span>
      <p className="text-foreground text-sm font-medium">Aucune course ne correspond aux filtres</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        Des courses existent ce jour : ajustez ou réinitialisez les filtres pour les afficher.
      </p>
    </div>
  );
}
