'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserCircle2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
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
import {
  archiveDriverAction,
  inviteDriverAction,
  resendInvitationAction,
} from '../actions';
import type { DriverRow } from '../page';
import { DriverForm } from './driver-form.client';

interface Props {
  initialDrivers: DriverRow[];
}

type Mode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; driver: DriverRow };

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

export function DriversList({ initialDrivers }: Props): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<DriverRow | null>(
    null,
  );
  const [invitationDialog, setInvitationDialog] =
    React.useState<InvitationDialogState>({ kind: 'closed' });
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);
  const closeInvitationDialog = React.useCallback(() => {
    setInvitationDialog({ kind: 'closed' });
    setInviteEmail('');
  }, []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchive = async () => {
    if (!archiveTarget) return;
    const res = await archiveDriverAction(archiveTarget.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Chauffeur archivé.');
    setArchiveTarget(null);
    close();
    router.refresh();
  };

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialDrivers.length} chauffeur
          {initialDrivers.length > 1 ? 's' : ''}
        </p>
        <Button
          type="button"
          onClick={() => setMode({ kind: 'create' })}
          className="gap-8"
        >
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau chauffeur
        </Button>
      </div>

      {initialDrivers.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: 'create' })} />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {initialDrivers.map((d) => {
            const status = getAccountStatus(d);
            return (
              <li
                key={d.id}
                className="flex w-full items-center gap-12 px-16 py-12"
              >
                <button
                  type="button"
                  onClick={() => setMode({ kind: 'edit', driver: d })}
                  className="flex flex-1 items-center gap-12 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset -mx-16 px-16 py-8 rounded-sm"
                >
                  <InitialsAvatar
                    name={d.nom_affichage}
                    role="chauffeur"
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {d.nom_affichage}
                    </div>
                    <div className="flex items-center gap-8 text-xs text-muted-foreground tabular-nums">
                      {d.telephone ?? 'Téléphone non renseigné'}
                      {d.numero_licence && <span>· Lic. {d.numero_licence}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-8 shrink-0">
                    {d.type_permis.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t.toUpperCase()}
                      </Badge>
                    ))}
                    <AccountStatusBadge status={status} />
                    {d.actif ? (
                      <Badge>Actif</Badge>
                    ) : (
                      <Badge variant="outline">Inactif</Badge>
                    )}
                  </div>
                </button>
                <InvitationActionButton
                  driver={d}
                  status={status}
                  onInvite={(driver) => {
                    setInviteEmail('');
                    setInvitationDialog({ kind: 'invite', driver });
                  }}
                  onResend={(driver) =>
                    setInvitationDialog({ kind: 'resend', driver })
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={mode.kind !== 'closed'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {mode.kind === 'edit'
                ? 'Modifier le chauffeur'
                : 'Nouveau chauffeur'}
            </SheetTitle>
            <SheetDescription>
              Les informations sont visibles dans la modal d&apos;assignation
              de course.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-24">
            {mode.kind === 'create' && <DriverForm onSuccess={onSuccess} />}
            {mode.kind === 'edit' && (
              <DriverForm initial={mode.driver} onSuccess={onSuccess} />
            )}
          </div>

          {mode.kind === 'edit' && (
            <div className="mt-24 border-t border-border pt-16">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
                onClick={() => setArchiveTarget(mode.driver)}
              >
                Archiver ce chauffeur
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={archiveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
      >
        <SheetContent side="bottom" className="space-y-16 p-24">
          <SheetHeader>
            <SheetTitle>
              Archiver « {archiveTarget?.nom_affichage} » ?
            </SheetTitle>
            <SheetDescription>
              Le chauffeur n&apos;apparaîtra plus dans la modal
              d&apos;assignation. Les courses passées restent intactes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-end gap-12">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
            >
              Conserver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onArchive()}
            >
              Archiver
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog Inviter — mini-form email */}
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
              {invitationDialog.kind === 'invite'
                ? invitationDialog.driver.nom_affichage
                : ''}
            </DialogTitle>
            <DialogDescription>
              Un email d&apos;invitation sera envoyé. Le chauffeur cliquera
              le lien pour définir son mot de passe et activer son compte.
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
                disabled={isSubmitting || !inviteEmail}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? 'Envoi…' : "Envoyer l'invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Renvoyer — confirmation */}
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
              Un nouveau lien magic sera envoyé à{' '}
              <span className="font-mono">
                {invitationDialog.kind === 'resend'
                  ? invitationDialog.driver.invitation?.email
                  : ''}
              </span>
              . L&apos;ancien lien restera valide jusqu&apos;à son expiration
              naturelle.
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

function AccountStatusBadge({ status }: { status: AccountStatus }) {
  switch (status) {
    case 'active':
      return <Badge variant="secondary">Compte actif</Badge>;
    case 'invited':
      return <Badge variant="outline">Invité</Badge>;
    case 'expired':
      return (
        <Badge
          variant="outline"
          className="border-destructive/40 text-destructive"
        >
          Lien expiré
        </Badge>
      );
    case 'none':
    default:
      return <Badge variant="outline">Sans compte</Badge>;
  }
}

function InvitationActionButton({
  driver,
  status,
  onInvite,
  onResend,
}: {
  driver: DriverRow;
  status: AccountStatus;
  onInvite: (d: DriverRow) => void;
  onResend: (d: DriverRow) => void;
}) {
  if (status === 'active') return null;
  if (status === 'none') {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onInvite(driver)}
        className="gap-8 shrink-0"
      >
        <Mail className="h-4 w-4" aria-hidden />
        Inviter
      </Button>
    );
  }
  // invited or expired
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onResend(driver)}
      className="gap-8 shrink-0"
    >
      <RefreshCw className="h-4 w-4" aria-hidden />
      Renvoyer
    </Button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-12 rounded-md border border-dashed border-border py-48 text-center">
      <UserCircle2
        className="h-48 w-48 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <div>
        <h2 className="text-base font-semibold">Aucun chauffeur</h2>
        <p className="text-sm text-muted-foreground">
          Ajoutez un premier chauffeur pour pouvoir assigner des courses.
        </p>
      </div>
      <Button type="button" onClick={onCreate} className="gap-8">
        <Plus className="h-16 w-16" aria-hidden />
        Nouveau chauffeur
      </Button>
    </div>
  );
}
