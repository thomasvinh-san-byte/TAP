'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { inviteDriverAction, resendInvitationAction } from '../actions';
import type { DriverRow } from '../page';

/**
 * Dialogs d'invitation chauffeur (inviter par e-mail / renvoyer le lien).
 * Extrait de drivers-list (Phase 06.58, DEC-137) — l'état e-mail + soumission
 * (Server Actions `inviteDriverAction`/`resendInvitationAction`) vit ici ;
 * l'orchestrateur ne pilote que l'ouverture via `state`. Comportement inchangé.
 */
export type InvitationDialogState =
  | { kind: 'closed' }
  | { kind: 'invite'; driver: DriverRow }
  | { kind: 'resend'; driver: DriverRow };

export function DriverInvitationDialogs({
  state,
  onClose,
}: {
  state: InvitationDialogState;
  onClose: () => void;
}): JSX.Element {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Réinitialise le champ e-mail à chaque ouverture du dialog d'invitation.
  React.useEffect(() => {
    if (state.kind === 'invite') setInviteEmail('');
  }, [state]);

  const close = () => {
    setInviteEmail('');
    onClose();
  };

  const onInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.kind !== 'invite') return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('email', inviteEmail);
      fd.set('driverId', state.driver.id);
      const res = await inviteDriverAction({}, fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invitation envoyée.');
      close();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResendConfirm = async () => {
    if (state.kind !== 'resend') return;
    const invitationId = state.driver.invitation?.id;
    if (!invitationId) return;
    setIsSubmitting(true);
    try {
      const res = await resendInvitationAction(invitationId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Invitation renvoyée.');
      close();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={state.kind === 'invite'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              Inviter {state.kind === 'invite' ? state.driver.nom_affichage : ''}
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
              <Button type="button" variant="ghost" onClick={close} disabled={isSubmitting}>
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
        open={state.kind === 'resend'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Renvoyer l&apos;invitation ?</DialogTitle>
            <DialogDescription>
              Un nouveau lien magique sera envoyé à{' '}
              <span className="font-mono">
                {state.kind === 'resend' ? state.driver.invitation?.email : ''}
              </span>
              . L&apos;ancien lien restera valide jusqu&apos;à son expiration naturelle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={isSubmitting}>
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
