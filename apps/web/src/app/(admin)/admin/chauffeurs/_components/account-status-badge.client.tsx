'use client';

import { Badge } from '@/components/ui/badge';
import type { DriverRow } from '../page';

/**
 * Statut du compte utilisateur d'un chauffeur (Phase 04 onboarding).
 * Extrait de drivers-list (Phase 06.58, DEC-137) — comportement inchangé.
 */
export type AccountStatus = 'none' | 'invited' | 'expired' | 'active';

export function getAccountStatus(d: DriverRow): AccountStatus {
  if (d.profile_id) return 'active';
  if (d.invitation) {
    const isExpired = new Date(d.invitation.expires_at).getTime() < Date.now();
    return isExpired ? 'expired' : 'invited';
  }
  return 'none';
}

export function AccountStatusBadge({ status }: { status: AccountStatus }): JSX.Element {
  switch (status) {
    case 'active':
      return <Badge variant="secondary">Compte actif</Badge>;
    case 'invited':
      return <Badge variant="outline">Invité</Badge>;
    case 'expired':
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Lien expiré
        </Badge>
      );
    case 'none':
    default:
      return <Badge variant="outline">Sans compte</Badge>;
  }
}
