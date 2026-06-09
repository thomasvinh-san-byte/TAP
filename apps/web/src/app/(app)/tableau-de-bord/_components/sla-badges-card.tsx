import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SlaRule, SlaStatus } from '../_lib/sla-status';

/**
 * Carte des SLA factuels datés (Wave 1 Phase 06.11 — A3 reformulé Option 3).
 *
 * Doctrine : couleurs uniquement sur dépassements légaux objectifs datés
 * (cf. `_lib/sla-status.ts`). PAS de jugement de conformité globale (la
 * `ComplianceCard` reste neutre/factuelle, doctrine 06.6 LOCKED).
 *
 * Comportement :
 * - Si `rules` non vide : liste les règles non-vertes, rouge en haut.
 * - Si `rules` vide : état neutre « Délais légaux respectés » (icône check,
 *   texte neutre, AUCUN jugement « conforme RGPD »).
 *
 * Couleurs : tokens sémantiques alignés sur KpiCard (Phase 06.49, DEC-128) —
 * `text-destructive` / `text-warning` / `text-success`, jour+nuit.
 */

const STATUS_CLASS: Record<SlaStatus, string> = {
  rouge: 'text-destructive',
  orange: 'text-warning',
  vert: 'text-success',
};

const STATUS_DOT_CLASS: Record<SlaStatus, string> = {
  rouge: 'bg-destructive',
  orange: 'bg-warning',
  vert: 'bg-success',
};

interface Props {
  rules: SlaRule[];
}

export function SlaBadgesCard({ rules }: Props): JSX.Element {
  if (rules.length === 0) {
    return (
      <section
        className="border-border bg-background flex h-full flex-col gap-8 rounded-lg border p-16"
        aria-labelledby="sla-title"
      >
        <div className="flex items-center gap-8">
          <Check className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
          <h3 id="sla-title" className="text-sm font-medium">
            Délais légaux
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">Délais légaux respectés</p>
      </section>
    );
  }

  return (
    <section
      className="border-border bg-background flex h-full flex-col gap-8 rounded-lg border p-16"
      aria-labelledby="sla-title"
    >
      <h3 id="sla-title" className="text-sm font-medium">
        Délais légaux
      </h3>
      <ul className="flex flex-col gap-8">
        {rules.map((rule) =>
          rule.href ? (
            <li key={rule.id}>
              <Link
                href={rule.href}
                className={cn(
                  'focus-visible:ring-ring flex min-h-[44px] items-center justify-between gap-8 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2',
                  STATUS_CLASS[rule.status],
                )}
              >
                <span className="flex items-center gap-8">
                  <span
                    className={cn(
                      'inline-block h-8 w-8 shrink-0 rounded-full',
                      STATUS_DOT_CLASS[rule.status],
                    )}
                    aria-hidden
                  />
                  <span>{rule.label}</span>
                </span>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ) : (
            <li
              key={rule.id}
              className={cn(
                'flex min-h-[44px] items-center gap-8 text-sm font-medium',
                STATUS_CLASS[rule.status],
              )}
            >
              <span
                className={cn(
                  'inline-block h-8 w-8 shrink-0 rounded-full',
                  STATUS_DOT_CLASS[rule.status],
                )}
                aria-hidden
              />
              <span>{rule.label}</span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
