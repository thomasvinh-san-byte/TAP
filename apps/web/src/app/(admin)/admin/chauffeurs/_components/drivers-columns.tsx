import { Badge } from '@/components/ui/badge';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import type { DataTableColumn } from '@/components/data-table';
import type { DriverRow } from '../page';
import { DriverAttributesBadges } from '@/components/driver-attributes-badges.client';
import { AccountStatusBadge, getAccountStatus } from './account-status-badge.client';
import { DriverStatusBadge } from './driver-status-badge.client';
import { DriverRowActions } from './driver-row-actions.client';

type Role = 'dirigeant' | 'regulateur';

interface DriverColumnHandlers {
  onInvite: (d: DriverRow) => void;
  onResend: (d: DriverRow) => void;
  onDeactivate: (d: DriverRow) => void;
  onReactivate: (d: DriverRow) => void | Promise<void>;
  onArchive: (d: DriverRow) => void;
  onUnarchive: (d: DriverRow) => void;
}

/**
 * Définition des 6 colonnes de la liste chauffeurs (Chauffeur / Permis /
 * Compte / Statut / Conformité / Actions). Extrait de drivers-list en
 * factory (Phase 06.58, DEC-137) — colonnes et valeurs métier inchangées.
 */
export function buildDriverColumns({
  currentRole,
  reactivatingId,
  nextComplianceByDriverId,
  handlers,
}: {
  currentRole: Role;
  reactivatingId: string | null;
  nextComplianceByDriverId?: Record<string, string>;
  handlers: DriverColumnHandlers;
}): DataTableColumn<DriverRow>[] {
  return [
    {
      key: 'chauffeur',
      header: 'Chauffeur',
      cell: (d) => (
        <div className="flex items-center gap-12">
          <InitialsAvatar name={d.nom_affichage} role="chauffeur" size={32} />
          <div className="min-w-0">
            <div className="truncate font-medium">{d.nom_affichage}</div>
            <div className="text-muted-foreground flex items-center gap-8 text-xs tabular-nums">
              {d.telephone ?? 'Téléphone non renseigné'}
              {d.numero_licence && <span>· Lic. {d.numero_licence}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'permis',
      header: 'Permis',
      width: '160px',
      cell: (d) => (
        <div className="flex flex-wrap gap-4">
          {d.type_permis.map((t: string) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t.toUpperCase()}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'profil',
      header: 'Langues / Compétences',
      width: '220px',
      cell: (d) =>
        d.langues.length + d.competences.length > 0 ? (
          <DriverAttributesBadges competences={d.competences} langues={d.langues} />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'compte',
      header: 'Compte',
      width: '140px',
      cell: (d) => <AccountStatusBadge status={getAccountStatus(d)} />,
    },
    {
      key: 'statut',
      header: 'Statut',
      width: '120px',
      cell: (d) => <DriverStatusBadge status={d.status} />,
    },
    {
      key: 'conformite',
      header: 'Conformité',
      width: '160px',
      cell: (d) => {
        const next = nextComplianceByDriverId?.[d.id];
        return next ? (
          <ComplianceBadge expiresAt={next} />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (d) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end" role="presentation">
          <DriverRowActions
            driver={d}
            role={currentRole}
            reactivatingId={reactivatingId}
            onInvite={handlers.onInvite}
            onResend={handlers.onResend}
            onDeactivate={handlers.onDeactivate}
            onReactivate={handlers.onReactivate}
            onArchive={handlers.onArchive}
            onUnarchive={handlers.onUnarchive}
          />
        </div>
      ),
    },
  ];
}
