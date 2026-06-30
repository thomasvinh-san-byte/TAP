'use client';

import * as React from 'react';
import { Mail, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildRenewalRequestAction, type RenewalRequest } from '../../actions';

/**
 * Bouton « Demander le renouvellement » (RENOUVELLEMENT-01, §5.3) : génère un
 * brouillon pré-rempli au prescripteur (texte copiable + mailto). PAS d'envoi
 * automatique.
 */
export function PrescriptionRenewalButton({
  prescriptionId,
}: {
  prescriptionId: string;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [req, setReq] = React.useState<RenewalRequest | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openDialog(): void {
    startTransition(async () => {
      const res = await buildRenewalRequestAction(prescriptionId);
      if (res.error || !res.data) {
        toast.error(res.error ?? 'Génération impossible.');
        return;
      }
      setReq(res.data);
      setOpen(true);
    });
  }

  async function copyBody(): Promise<void> {
    if (!req) return;
    try {
      await navigator.clipboard.writeText(req.body);
      toast.success('Demande copiée.');
    } catch {
      toast.error('Copie impossible.');
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog} disabled={pending}>
        <MailPlus className="mr-8 h-12 w-12" aria-hidden />
        Renouvellement
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Demande de renouvellement</DialogTitle>
            <DialogDescription>
              Brouillon à adresser au prescripteur. Aucun envoi automatique.
            </DialogDescription>
          </DialogHeader>

          {req && (
            <div className="space-y-12">
              <Textarea value={req.body} readOnly rows={9} className="text-sm" />
              <div className="flex flex-wrap gap-8">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyBody()}>
                  Copier le texte
                </Button>
                {req.mailto ? (
                  <Button asChild type="button" variant="accent" size="sm">
                    <a href={req.mailto}>
                      <Mail className="mr-8 h-12 w-12" aria-hidden />
                      Ouvrir l&apos;email ({req.prescriberEmail})
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground self-center text-xs">
                    Aucun email prescripteur — copier puis envoyer par un autre canal.
                  </span>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
