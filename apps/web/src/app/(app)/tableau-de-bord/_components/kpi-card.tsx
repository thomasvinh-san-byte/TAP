import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Carte-KPI du tableau de bord dirigeant (Phase 06.8) — composant
 * présentationnel, server component. Reçoit ses valeurs en props, aucune
 * query.
 *
 * 4 variantes (anatomie UI-SPEC §3). WCAG : tout état couleur est doublé d'un
 * texte ; les liens sont focusables, cible ≥ 44 px.
 */

export type KpiState = 'neutre' | 'succes' | 'attention' | 'alerte';

const STATE_CLASS: Record<KpiState, string> = {
  neutre: 'text-foreground',
  succes: 'text-green-700',
  attention: 'text-amber-700',
  alerte: 'text-destructive',
};

const ACTION_CLASS =
  'text-primary focus-visible:ring-ring mt-auto inline-flex min-h-[44px] items-center ' +
  'text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2';

interface KpiAction {
  href: string;
  label: string;
}

interface KpiCardBase {
  label: string;
  action?: KpiAction;
}

interface KpiSimple extends KpiCardBase {
  variant: 'simple';
  value: string;
  context?: string;
  state?: KpiState;
  stateLabel?: string;
}

interface KpiVentilation extends KpiCardBase {
  variant: 'ventilation';
  value: string;
  lines: { label: string; value: string }[];
}

interface KpiMulti extends KpiCardBase {
  variant: 'multi';
  rows: { label: string; value: string }[];
}

interface KpiAlerte extends KpiCardBase {
  variant: 'alerte';
  items: { label: string; href?: string }[];
}

export type KpiCardProps = KpiSimple | KpiVentilation | KpiMulti | KpiAlerte;

function KpiBody(props: KpiCardProps): JSX.Element {
  switch (props.variant) {
    case 'simple':
      return (
        <div className="flex flex-col gap-4">
          <p
            className={cn(
              'text-3xl font-semibold tabular-nums',
              props.state && STATE_CLASS[props.state],
            )}
          >
            {props.value}
          </p>
          {props.stateLabel ? (
            <p className={cn('text-sm', props.state && STATE_CLASS[props.state])}>
              {props.stateLabel}
            </p>
          ) : null}
          {props.context ? <p className="text-muted-foreground text-xs">{props.context}</p> : null}
        </div>
      );
    case 'ventilation':
      return (
        <div className="flex flex-col gap-8">
          <p className="text-3xl font-semibold tabular-nums">{props.value}</p>
          <dl className="flex flex-col gap-4">
            {props.lines.map((l) => (
              <div key={l.label} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{l.label}</dt>
                <dd className="tabular-nums">{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case 'multi':
      return (
        <dl className="flex flex-col gap-8">
          {props.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-sm">{r.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'alerte':
      if (props.items.length === 0) {
        return <p className="text-sm font-medium text-green-700">Aucune alerte</p>;
      }
      return (
        <ul className="flex flex-col gap-4">
          {props.items.map((it) =>
            it.href ? (
              <li key={it.label}>
                <Link
                  href={it.href}
                  className="text-destructive focus-visible:ring-ring flex min-h-[44px] items-center justify-between gap-8 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                >
                  <span>{it.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ) : (
              <li
                key={it.label}
                className="text-destructive flex min-h-[44px] items-center text-sm font-medium"
              >
                {it.label}
              </li>
            ),
          )}
        </ul>
      );
  }
}

export function KpiCard(props: KpiCardProps): JSX.Element {
  return (
    <div className="border-border bg-background flex flex-col gap-12 rounded-lg border p-16">
      <h3 className="text-muted-foreground text-sm font-medium">{props.label}</h3>
      <KpiBody {...props} />
      {props.action ? (
        <Link href={props.action.href} className={ACTION_CLASS}>
          {props.action.label} →
        </Link>
      ) : null}
    </div>
  );
}
