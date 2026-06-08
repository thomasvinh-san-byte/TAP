'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COMPLIANCE_LABELS } from '@tap/shared';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import type { ComplianceAlertEnriched } from '../_lib/get-compliance-alerts';

/**
 * <ComplianceAlertsPanel> — bloc dérivé pour cockpit/dashboard
 * (Phase 06.34, DEC-113).
 *
 * Affichage compact, dense (cockpit 8h/j). Sobre — terracotta NON
 * (les alertes ne sont pas un moment-clé d'action). Statut visuel
 * accessible : icône + texte + jours (`<ComplianceBadge>`),
 * pas couleur seule (WCAG 1.4.1).
 *
 * Source partagée avec le dashboard via `getComplianceAlerts` (lib
 * server-only).
 *
 * Bloc discret si aucune échéance proche : un simple message « tout
 * est à jour » plutôt que le bloc complet, pour ne pas encombrer.
 */

interface Props {
  alerts: ComplianceAlertEnriched[];
  /** Variante d'affichage : panneau (cockpit, dense) ou card (dashboard, sobre). */
  variant?: 'panel' | 'card';
  /** Limite l'affichage à N items (cockpit dense) ; le reste est compté. */
  limit?: number;
}

export function ComplianceAlertsPanel({
  alerts,
  variant = 'panel',
  limit = 6,
}: Props): JSX.Element {
  const total = alerts.length;
  const visible = alerts.slice(0, limit);
  const remaining = total - visible.length;

  return (
    <section
      aria-labelledby="compliance-alerts-title"
      className={
        variant === 'card' ? 'border-border space-y-12 rounded-lg border p-16' : 'space-y-12'
      }
    >
      <header className="flex items-center justify-between gap-12">
        <h2
          id="compliance-alerts-title"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Échéances réglementaires
        </h2>
        {total > 0 && (
          <span className="bg-warning/10 text-warning inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-8 text-xs font-semibold">
            {total}
          </span>
        )}
      </header>

      {total === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune échéance à surveiller.</p>
      ) : (
        <>
          <ul className="space-y-8">
            {visible.map((a) => (
              <li
                key={a.id}
                className="border-border bg-background/60 flex flex-col gap-4 rounded-md border p-12"
              >
                <div className="flex items-start justify-between gap-12">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.entity_label}</p>
                    <p className="text-muted-foreground text-xs">{COMPLIANCE_LABELS[a.kind]}</p>
                  </div>
                  <ComplianceBadge expiresAt={a.expires_at} compact />
                </div>
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <p className="text-muted-foreground text-xs">
              + {remaining} autre{remaining > 1 ? 's' : ''}
            </p>
          )}

          <Link
            href="/admin/conformite"
            className="text-primary inline-flex items-center gap-4 text-sm hover:underline"
          >
            Gérer les échéances
            <ArrowRight className="h-12 w-12" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
