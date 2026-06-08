import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { complianceStatus, type ComplianceStatus } from '@tap/shared';
import { cn } from '@/lib/utils';

/**
 * <ComplianceBadge> — état d'une échéance réglementaire (Phase 06.33).
 *
 * Le statut est DÉRIVÉ d'`expires_at` vs aujourd'hui via `complianceStatus`
 * (helper @tap/shared) — jamais stocké.
 *
 * Couleur sémantique + ICÔNE + texte : pas de couleur seule (WCAG 2.1
 * critère 1.4.1 « Utilisation de la couleur »). Tokens uniquement
 * (`text-success`, `text-warning`, `text-destructive`), jour+nuit.
 */

interface Props {
  expiresAt: string | Date | null | undefined;
  today?: Date;
  /** Affichage compact (icône + texte court, pour listes denses). */
  compact?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  ComplianceStatus,
  { icon: typeof CheckCircle2; tone: string; label: string; compactLabel: string }
> = {
  ok: {
    icon: CheckCircle2,
    tone: 'text-success',
    label: 'À jour',
    compactLabel: 'OK',
  },
  soon: {
    icon: AlertTriangle,
    tone: 'text-warning',
    label: 'Échéance proche',
    compactLabel: 'Bientôt',
  },
  expired: {
    icon: AlertCircle,
    tone: 'text-destructive',
    label: 'Expirée',
    compactLabel: 'Expirée',
  },
};

export function ComplianceBadge({ expiresAt, today, compact, className }: Props): JSX.Element {
  const { status, daysUntilExpiry } = complianceStatus(expiresAt, today);
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  const suffix =
    daysUntilExpiry === null
      ? ''
      : status === 'expired'
        ? ` (il y a ${Math.abs(daysUntilExpiry)} j)`
        : status === 'soon'
          ? ` (${daysUntilExpiry} j)`
          : '';

  const label = compact ? cfg.compactLabel : cfg.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-4 text-xs font-medium tabular-nums',
        cfg.tone,
        className,
      )}
      role="status"
      aria-label={`${cfg.label}${suffix}`}
    >
      <Icon className="h-12 w-12 shrink-0" aria-hidden />
      <span>
        {label}
        {!compact && suffix}
      </span>
    </span>
  );
}
