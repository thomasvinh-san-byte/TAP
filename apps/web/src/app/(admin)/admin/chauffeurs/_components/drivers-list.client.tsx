'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  UserCircle2,
  UserPlus,
  Mail,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state';
import { SegmentedNav } from '@/components/ui/segmented-control';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteDriverAction, reactivateDriverAction, resendInvitationAction } from '../actions';
import type { DriverRow } from '../page';
import { DriverForm } from './driver-form.client';
import { ArchiveDriverModal } from './archive-driver-modal.client';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog.client';
import { UnarchiveConfirmDialog } from './unarchive-confirm-dialog.client';

type Role = 'dirigeant' | 'regulateur';
type Vue = 'actifs' | 'archives';

interface Props {
  initialDrivers: DriverRow[];
  currentRole: Role;
  vue: Vue;
}

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; driver: DriverRow };

type InvitationDialogState =
  | { kind: 'closed' }
  | { kind: 'invite'; driver: DriverRow }
  | { kind: 'resend'; driver: DriverRow };

type AccountStatus = 'none' | 'invited' | 'expired' | 'active';

function getAccountStatus(d: DriverRow): AccountStatus {
  if (d.profile_id) return 'active';
  if (d.invitation) {
    const isExpired = new Date(d.invitation.expires_at).getTime() < Date.now();
    return isExpired ? 'expired' : 'invited';
  }
  return 'none';
}

export function DriversList({ initialDrivers, currentRole, vue }: Props): JSX.Element {
  const router = useRouter();
  const isDirigeant = currentRole === 'dirigeant';

  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<DriverRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<DriverRow | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<DriverRow | null>(null);
  const [invitationDialog, setInvitationDialog] = React.useState<InvitationDialogState>({
    kind: 'closed',
  });
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reactivatingId, setReactivatingId] = React.useState<string | null>(null);

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);
  const closeInvitationDialog = React.useCallback(() => {
    setInvitationDialog({ kind: 'closed' });
    setInviteEmail('');
  }, []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchived = React.useCallback(() => {
    setArchiveTarget(null);
    close();
  }, [close]);

  const onDeactivated = React.useCallback(() => {
    setDeactivateTarget(null);
  }, []);

  const onUnarchived = React.useCallback(() => {
    setUnarchiveTarget(null);
  }, []);

  const onReactivate = React.useCallback(
    async (driver: DriverRow) => {
      setReactivatingId(driver.id);
      try {
        const res = await reactivateDriverAction(driver.id);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success('Chauffeur réactivé.');
        router.refresh();
      } finally {
        setReactivatingId(null);
      }
    },
    [router],
  );

  const onInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (invitationDialog.kind !== 'invite') return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('email', inviteEmail);
      fd.set('driverId', invitationDialog.driver.id);
      const res = await inviteDriverAction({}, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invitation envoyée.');
      closeInvitationDialog();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendConfirm = async () => {
    if (invitationDialog.kind !== 'resend') return;
    const invitationId = invitationDialog.driver.invitation?.id;
    if (!invitationId) return;
    setIsSubmitting(true);
    try {
      const res = await resendInvitationAction(invitationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invitation renvoyée.');
      closeInvitationDialog();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-12">
        <div className="flex items-center gap-12">
          <ViewToggle currentVue={vue} />
          <p className="text-muted-foreground text-sm">
            {initialDrivers.length} chauffeur
            {initialDrivers.length > 1 ? 's' : ''}
            {vue === 'archives' ? ' archivé' : ''}
            {vue === 'archives' && initialDrivers.length > 1 ? 's' : ''}
          </p>
        </div>
        {vue === 'actifs' ? (
          <Button
            type="button"
            variant="accent"
            onClick={() => setMode({ kind: 'create' })}
            className="gap-8"
          >
            <Plus className="h-16 w-16" aria-hidden />
            Nouveau chauffeur
          </Button>
        ) : null}
      </div>

      <DataTable<DriverRow>
        columns={[
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
            key: 'compte',
            header: 'Compte',
            width: '140px',
            cell: (d) => <AccountStatusBadge status={getAccountStatus(d)} />,
          },
          {
            key: 'statut',
            header: 'Statut',
            width: '120px',
            cell: (d) =>
              d.archive ? (
                <Badge variant="outline" className="border-muted-foreground/40">
                  Archivé
                </Badge>
              ) : d.actif ? (
                <Badge>Actif</Badge>
              ) : (
                <Badge variant="outline">Désactivé</Badge>
              ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (d) => (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex justify-end"
                role="presentation"
              >
                <DriverRowActions
                  driver={d}
                  role={currentRole}
                  reactivatingId={reactivatingId}
                  onInvite={(driver) => {
                    setInviteEmail('');
                    setInvitationDialog({ kind: 'invite', driver });
                  }}
                  onResend={(driver) => setInvitationDialog({ kind: 'resend', driver })}
                  onDeactivate={(driver) => setDeactivateTarget(driver)}
                  onReactivate={onReactivate}
                  onArchive={(driver) => setArchiveTarget(driver)}
                  onUnarchive={(driver) => setUnarchiveTarget(driver)}
                />
              </div>
            ),
          },
        ]}
        rows={initialDrivers}
        // DEC-033 : clé inclut `actif`/`archive` pour re-mount au changement
        // d'état (Désactiver / Réactiver / Archiver / Désarchiver). Sans ça,
        // les boutons d'action restent figés sur l'ancien état après
        // router.refresh().
        rowKey={(d) => `${d.id}-${d.actif}-${d.archive}`}
        ariaLabel={`Liste des chauffeurs ${vue === 'archives' ? 'archivés' : 'actifs'}`}
        onRowClick={(d) => setMode({ kind: 'edit', driver: d })}
        emptyState={<EmptyState vue={vue} onCreate={() => setMode({ kind: 'create' })} />}
      />

      <Sheet
        open={mode.kind !== 'closed'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] overflow-y-auto sm:w-[480px] sm:max-w-[480px]"
        >
          <SheetHeader>
            <SheetTitle>
              {mode.kind === 'edit' ? 'Modifier le chauffeur' : 'Nouveau chauffeur'}
            </SheetTitle>
            <SheetDescription>
              Les informations sont visibles dans la fenêtre d&apos;affectation de course.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-24">
            {mode.kind === 'create' && <DriverForm onSuccess={onSuccess} />}
            {mode.kind === 'edit' && <DriverForm initial={mode.driver} onSuccess={onSuccess} />}
          </div>

          {mode.kind === 'edit' && isDirigeant && !mode.driver.archive ? (
            <div className="border-border mt-24 border-t pt-16">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
                onClick={() => setArchiveTarget(mode.driver)}
              >
                Archiver ce chauffeur
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ArchiveDriverModal
        driver={
          archiveTarget
            ? { id: archiveTarget.id, nom_affichage: archiveTarget.nom_affichage }
            : null
        }
        onClose={() => setArchiveTarget(null)}
        onArchived={onArchived}
      />

      <DeactivateConfirmDialog
        driver={
          deactivateTarget
            ? {
                id: deactivateTarget.id,
                nom_affichage: deactivateTarget.nom_affichage,
              }
            : null
        }
        onClose={() => setDeactivateTarget(null)}
        onDeactivated={onDeactivated}
      />

      <UnarchiveConfirmDialog
        driver={
          unarchiveTarget
            ? {
                id: unarchiveTarget.id,
                nom_affichage: unarchiveTarget.nom_affichage,
              }
            : null
        }
        onClose={() => setUnarchiveTarget(null)}
        onUnarchived={onUnarchived}
      />

      <Dialog
        open={invitationDialog.kind === 'invite'}
        onOpenChange={(o) => {
          if (!o) closeInvitationDialog();
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Inviter{' '}
              {invitationDialog.kind === 'invite' ? invitationDialog.driver.nom_affichage : ''}
            </DialogTitle>
            <DialogDescription>
              Un courriel d&apos;invitation sera envoyé. Le chauffeur cliquera le lien pour définir
              son mot de passe et activer son compte.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onInviteSubmit} className="space-y-16" noValidate>
            <div className="space-y-8">
              <Label htmlFor="invite-email">Adresse e-mail du chauffeur</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                autoComplete="off"
                className="h-10"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={closeInvitationDialog}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting || !inviteEmail}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Envoi…' : "Envoyer l'invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invitationDialog.kind === 'resend'}
        onOpenChange={(o) => {
          if (!o) closeInvitationDialog();
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Renvoyer l&apos;invitation ?</DialogTitle>
            <DialogDescription>
              Un nouveau lien magique sera envoyé à{' '}
              <span className="font-mono">
                {invitationDialog.kind === 'resend'
                  ? invitationDialog.driver.invitation?.email
                  : ''}
              </span>
              . L&apos;ancien lien restera valide jusqu&apos;à son expiration naturelle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeInvitationDialog}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void onResendConfirm()}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Envoi…' : 'Renvoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewToggle({ currentVue }: { currentVue: Vue }) {
  return (
    <SegmentedNav<Vue>
      ariaLabel="Filtre chauffeurs"
      value={currentVue}
      options={[
        { value: 'actifs', label: 'Actifs', href: '/admin/chauffeurs?vue=actifs' },
        { value: 'archives', label: 'Archivés', href: '/admin/chauffeurs?vue=archives' },
      ]}
    />
  );
}

function AccountStatusBadge({ status }: { status: AccountStatus }) {
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

function DriverRowActions({
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
}) {
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

function EmptyState({ vue, onCreate }: { vue: Vue; onCreate: () => void }) {
  if (vue === 'archives') {
    return (
      <SharedEmptyState
        icon={UserCircle2}
        title="Aucun chauffeur archivé"
        description="Les chauffeurs sortis du système apparaîtront ici."
      />
    );
  }
  return (
    <SharedEmptyState
      icon={UserPlus}
      title="Aucun chauffeur enregistré"
      description="Invitez votre premier chauffeur pour commencer à assigner des courses."
      action={{ onClick: onCreate, label: 'Inviter un chauffeur', icon: Plus, variant: 'accent' }}
    />
  );
}
