import * as React from 'react';
import { Activity, CheckCircle2, Edit3, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { formatRelativeFr } from '@/lib/dates-fr';
import type { RideAuditEntry } from '../_lib/queries';

/**
 * Timeline verticale d'entrées audit (Phase 3 / 03-D).
 *
 * On humanise l'action via un mini-mapping. Les diffs précis sont disponibles
 * via metadata.old/new (trigger audit Phase 2) mais V1 on n'expose que
 * l'action — suffit au design partner pour reconstituer l'historique.
 */

const ACTION_ICON: Record<string, LucideIcon> = {
  'ride.insert': Plus,
  'ride.update': Edit3,
  'ride.delete': Trash2,
};

const ACTION_LABEL: Record<string, string> = {
  'ride.insert': 'Course créée',
  'ride.update': 'Course modifiée',
  'ride.delete': 'Course supprimée',
};

function describeUpdate(entry: RideAuditEntry): string {
  const meta = entry.metadata as {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  } | null;
  if (!meta?.old || !meta?.new) return ACTION_LABEL['ride.update']!;
  const old = meta.old;
  const next = meta.new;
  const oldStatus = typeof old.status === 'string' ? old.status : null;
  const newStatus = typeof next.status === 'string' ? next.status : null;
  if (oldStatus && newStatus && oldStatus !== newStatus) {
    return `Statut → ${newStatus}`;
  }
  const oldPay = typeof old.payment_status === 'string' ? old.payment_status : null;
  const newPay = typeof next.payment_status === 'string' ? next.payment_status : null;
  if (oldPay && newPay && oldPay !== newPay) {
    return `Paiement → ${newPay}`;
  }
  return 'Course modifiée';
}

export function RideAuditTimeline({ entries }: { entries: RideAuditEntry[] }): JSX.Element {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">Pas encore d'historique.</p>;
  }
  return (
    <ol className="relative space-y-12" aria-label="Historique de la course">
      {entries.map((entry, idx) => {
        const Icon =
          ACTION_ICON[entry.action] ?? (entry.action.includes('payment') ? CheckCircle2 : Activity);
        const label =
          entry.action === 'ride.update'
            ? describeUpdate(entry)
            : (ACTION_LABEL[entry.action] ?? entry.action);
        return (
          <li key={entry.id} className="flex gap-12">
            <div className="relative shrink-0">
              <div className="border-border bg-background flex h-24 w-24 items-center justify-center rounded-full border">
                <Icon className="text-muted-foreground h-12 w-12" aria-hidden />
              </div>
              {idx < entries.length - 1 && (
                <span
                  aria-hidden
                  className="bg-border absolute left-1/2 top-24 h-12 w-[1px] -translate-x-1/2"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4 pb-8">
              <span className="text-foreground text-sm">{label}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatRelativeFr(entry.created_at)}
                {entry.actor_role ? ` · ${entry.actor_role}` : ''}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
