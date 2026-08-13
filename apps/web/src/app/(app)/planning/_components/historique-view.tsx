import { PlusCircle, XCircle, ArrowLeftRight, Clock, type LucideIcon } from 'lucide-react';
import type { PlanningHistorique } from '../_lib/historique-queries';

/**
 * Vue comparative prévu vs réalisé d'un jour (Module 5.12 lot E). Server
 * Component (lecture pure). N'affiche que des écarts réellement mesurés depuis
 * l'instantané figé (lot D) et l'état courant. Sans planning validé : état vide
 * explicite, pas de fausse comparaison.
 */

interface StatProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'muted' | 'info' | 'success' | 'warning' | 'destructive';
}

const TONE_CLASS: Record<StatProps['tone'], string> = {
  muted: 'text-muted-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};

function Stat({ label, value, icon: Icon, tone }: StatProps): JSX.Element {
  return (
    <div className="border-border bg-card flex items-center gap-12 rounded-lg border px-16 py-12">
      <Icon className={`h-20 w-20 shrink-0 ${TONE_CLASS[tone]}`} aria-hidden />
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
        <div className="text-muted-foreground mt-2 text-xs">{label}</div>
      </div>
    </div>
  );
}

function RideList({
  title,
  rideIds,
  labels,
  suffix,
}: {
  title: string;
  rideIds: { ride_id: string }[];
  labels: PlanningHistorique['labels'];
  suffix?: (rideId: string) => string | null;
}): JSX.Element | null {
  if (rideIds.length === 0) return null;
  return (
    <section className="space-y-8">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="border-border divide-border divide-y rounded-lg border">
        {rideIds.map(({ ride_id }) => {
          const l = labels[ride_id];
          const extra = suffix?.(ride_id);
          return (
            <li
              key={ride_id}
              className="flex items-center justify-between gap-12 px-12 py-8 text-sm"
            >
              <span className="truncate">{l?.patient ?? 'Course'}</span>
              {extra ? (
                <span className="text-muted-foreground shrink-0 tabular-nums">{extra}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HistoriqueView({ historique }: { historique: PlanningHistorique }): JSX.Element {
  if (!historique.validated || !historique.diff) {
    return (
      <div className="border-border text-muted-foreground rounded-lg border border-dashed px-24 py-32 text-center text-sm">
        Aucun planning validé pour ce jour. Validez le planning depuis la vue planning pour activer
        le suivi prévu vs réalisé.
      </div>
    );
  }

  const { diff, labels } = historique;

  return (
    <div className="space-y-16">
      <div className="grid grid-cols-2 gap-12 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Prévues" value={diff.prevuCount} icon={Clock} tone="muted" />
        <Stat label="Réalisées" value={diff.realiseCount} icon={Clock} tone="info" />
        <Stat label="Ajoutées" value={diff.ajoutees.length} icon={PlusCircle} tone="success" />
        <Stat label="Annulées" value={diff.annulees.length} icon={XCircle} tone="destructive" />
        <Stat
          label="Réassignées"
          value={diff.reassignees.length}
          icon={ArrowLeftRight}
          tone="warning"
        />
        <Stat label="Retards" value={diff.retards.length} icon={Clock} tone="warning" />
      </div>

      <RideList title="Courses ajoutées après validation" rideIds={diff.ajoutees} labels={labels} />
      <RideList title="Courses annulées après validation" rideIds={diff.annulees} labels={labels} />
      <RideList
        title="Courses réassignées"
        rideIds={diff.reassignees.map((r) => ({ ride_id: r.ride_id }))}
        labels={labels}
        suffix={(id) => `→ ${labels[id]?.driver ?? 'Non affectée'}`}
      />
      <RideList
        title="Retards au démarrage"
        rideIds={diff.retards.map((r) => ({ ride_id: r.ride_id }))}
        labels={labels}
        suffix={(id) => {
          const r = diff.retards.find((x) => x.ride_id === id);
          return r ? `+${r.minutes} min` : null;
        }}
      />
    </div>
  );
}
