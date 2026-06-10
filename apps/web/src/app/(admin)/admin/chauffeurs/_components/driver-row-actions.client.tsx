'use client';

import { Mail, RefreshCw, PauseCircle, PlayCircle, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DriverRow } from '../page';
import { getAccountStatus } from './account-status-badge.client';
import { RecapPdfButton } from './recap-pdf-button.client';

type Role = 'dirigeant' | 'regulateur';

/**
 * Actions de ligne d'un chauffeur (4 actions DEC-029 :
 * Inviter/Renvoyer · Désactiver/Réactiver · Archiver/Désarchiver) +
 * RecapPdfButton (dirigeant). Extrait de drivers-list (Phase 06.58,
 * DEC-137) — logique et aria-label inchangés.
 */
export function DriverRowActions({
  driver,
  role,
  reactivatingId,
  onInvite,
  onResend,
  onDeactivate,
  onReactivate,
  onArchive,
  onUnarchive,
}: {
  driver: DriverRow;
  role: Role;
  reactivatingId: string | null;
  onInvite: (d: DriverRow) => void;
  onResend: (d: DriverRow) => void;
  onDeactivate: (d: DriverRow) => void;
  onReactivate: (d: DriverRow) => void | Promise<void>;
  onArchive: (d: DriverRow) => void;
  onUnarchive: (d: DriverRow) => void;
}): JSX.Element {
  const isDirigeant = role === 'dirigeant';
  const status = getAccountStatus(driver);

  if (driver.archive) {
    return (
      <div className="flex shrink-0 items-center gap-8">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onUnarchive(driver)}
          className="gap-8"
          aria-label={`Désarchiver ${driver.nom_affichage}`}
        >
          <ArchiveRestore className="h-4 w-4" aria-hidden />
          Désarchiver
        </Button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-8">
      {isDirigeant && <RecapPdfButton driverId={driver.id} driverLabel={driver.nom_affichage} />}
      {status !== 'active' &&
        (status === 'none' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onInvite(driver)}
            className="gap-8"
            aria-label={`Inviter ${driver.nom_affichage}`}
          >
            <Mail className="h-4 w-4" aria-hidden />
            Inviter
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onResend(driver)}
            className="gap-8"
            aria-label={`Renvoyer l'invitation à ${driver.nom_affichage}`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Renvoyer
          </Button>
        ))}

      {driver.actif ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDeactivate(driver)}
          className="gap-8"
          aria-label={`Désactiver ${driver.nom_affichage}`}
        >
          <PauseCircle className="h-4 w-4" aria-hidden />
          Désactiver
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => void onReactivate(driver)}
          disabled={reactivatingId === driver.id}
          aria-busy={reactivatingId === driver.id}
          className="gap-8"
          aria-label={`Réactiver ${driver.nom_affichage}`}
        >
          <PlayCircle className="h-4 w-4" aria-hidden />
          {reactivatingId === driver.id ? 'Réactivation…' : 'Réactiver'}
        </Button>
      )}

      {isDirigeant ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onArchive(driver)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-8"
          aria-label={`Archiver ${driver.nom_affichage}`}
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archiver
        </Button>
      ) : null}
    </div>
  );
}
