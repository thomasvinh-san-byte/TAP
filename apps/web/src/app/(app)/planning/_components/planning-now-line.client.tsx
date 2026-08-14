'use client';

import * as React from 'react';
import { reunionHourMinute } from '../_lib/planning-layout';

/**
 * Repère temporel « maintenant » de la grille planning (Module 5.12, raffinement
 * Gantt). Ligne verticale à l'heure courante (fuseau Réunion), traversant le
 * corps de la grille — le régulateur voit d'un coup d'œil où en est la journée
 * sur un outil « en direct ». Couleur d'ACCENT (réservée : distincte des couleurs
 * de statut), doublée d'un libellé « HH h MM ».
 *
 * Position mesurée à l'affichage (les colonnes ont des largeurs variables selon
 * l'écran) : on repère la cellule d'en-tête de l'heure courante et on décale de
 * la fraction de minute. Recalcul sur redimensionnement (ResizeObserver) et à
 * chaque avancée du temps (`nowMs` rafraîchi par le parent). Purement visuel
 * (`aria-hidden`) : les données de course restent l'information accessible.
 */

interface Props {
  /**
   * Conteneur RELATIF englobant la table (le repère se positionne par rapport à
   * lui et défile avec le contenu). Contient `thead`, `tbody` et des `th[data-hour]`.
   */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Heures-colonnes affichées — borne le rendu à la plage visible. */
  slots: number[];
  /** Horodatage courant (ms), rafraîchi par le parent (source unique d'horloge). */
  nowMs: number;
}

interface Geometry {
  left: number;
  top: number;
  height: number;
}

export function PlanningNowLine({ containerRef, slots, nowMs }: Props): JSX.Element | null {
  const hm = React.useMemo(() => reunionHourMinute(new Date(nowMs).toISOString()), [nowMs]);
  const [geom, setGeom] = React.useState<Geometry | null>(null);

  const first = slots[0];
  const last = slots[slots.length - 1];
  const inRange =
    hm != null && first !== undefined && last !== undefined && hm.hour >= first && hm.hour <= last;

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !hm || !inRange) {
      setGeom(null);
      return;
    }
    const measure = (): void => {
      const cRect = container.getBoundingClientRect();
      const th = container.querySelector<HTMLElement>(`th[data-hour="${hm.hour}"]`);
      const thead = container.querySelector<HTMLElement>('thead');
      const body = container.querySelector<HTMLElement>('tbody');
      if (!th || !thead || !body) {
        setGeom(null);
        return;
      }
      const tRect = th.getBoundingClientRect();
      const headRect = thead.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      setGeom({
        left: tRect.left - cRect.left + (hm.minute / 60) * tRect.width,
        top: headRect.bottom - cRect.top,
        height: Math.max(0, bodyRect.bottom - headRect.bottom),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, hm, inRange]);

  if (!geom || !hm) return null;
  const label = `${hm.hour} h ${String(hm.minute).padStart(2, '0')}`;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20"
      style={{ left: geom.left, top: geom.top, height: geom.height }}
    >
      <div className="bg-accent/80 h-full w-[2px] rounded-full" />
      <span className="bg-accent text-accent-foreground absolute left-0 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md px-4 py-1 text-[10px] font-semibold tabular-nums shadow-sm">
        {label}
      </span>
    </div>
  );
}
