'use client';

import { Badge } from '@/components/ui/badge';
import { DRIVER_STATUS_LABELS, type DriverStatus } from '@tap/shared';

/**
 * Badge de statut opérationnel du chauffeur (§5.6, CHAUFFEUR-01) — distinct du
 * badge de statut de COMPTE (`account-status-badge`). Source : `drivers.status`.
 */
export function DriverStatusBadge({ status }: { status: DriverStatus }): JSX.Element {
  switch (status) {
    case 'actif':
      return <Badge>Actif</Badge>;
    case 'conge':
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-700">
          {DRIVER_STATUS_LABELS.conge}
        </Badge>
      );
    case 'suspendu':
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          {DRIVER_STATUS_LABELS.suspendu}
        </Badge>
      );
    case 'archive':
    default:
      return (
        <Badge variant="outline" className="border-muted-foreground/40">
          {DRIVER_STATUS_LABELS.archive}
        </Badge>
      );
  }
}
