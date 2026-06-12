'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { reportBreakdownAction } from '../actions';

/**
 * Signalement de panne côté chauffeur (DEC-160, CdG l.364-365). Bouton large
 * (≥ 56 px, règle PWA chauffeur) → formulaire court (nature + lieu) → crée un
 * incident `panne_vehicule`. La régulation est alertée et réaffecte les courses.
 */
export function ReportBreakdownButton(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [nature, setNature] = React.useState('');
  const [lieu, setLieu] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    if (!nature.trim()) {
      toast.error('Décrivez la panne.');
      return;
    }
    startTransition(async () => {
      const res = await reportBreakdownAction({
        nature: nature.trim(),
        lieu: lieu.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Panne signalée à la régulation.');
      setOpen(false);
      setNature('');
      setLieu('');
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-destructive border-destructive/40 min-h-[56px] w-full gap-8 text-base"
      >
        <Wrench className="h-20 w-20" aria-hidden />
        Signaler une panne
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="space-y-16 p-24">
          <SheetHeader>
            <SheetTitle>Signaler une panne</SheetTitle>
            <SheetDescription>
              La régulation est prévenue immédiatement et réaffecte vos courses restantes.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-8">
            <Label htmlFor="panne-nature">Nature de la panne</Label>
            <textarea
              id="panne-nature"
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              maxLength={500}
              rows={3}
              className="border-input focus-visible:ring-ring w-full rounded-md border px-12 py-12 text-base focus-visible:outline-none focus-visible:ring-2"
              placeholder="Ex. crevaison, moteur immobilisé…"
            />
          </div>
          <div className="space-y-8">
            <Label htmlFor="panne-lieu">Lieu (facultatif)</Label>
            <input
              id="panne-lieu"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              maxLength={200}
              className="border-input focus-visible:ring-ring w-full rounded-md border px-12 py-12 text-base focus-visible:outline-none focus-visible:ring-2"
              placeholder="Ex. RN1 hauteur Saint-Paul"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={pending}
            className="min-h-[56px] w-full text-base"
          >
            {pending ? 'Envoi…' : 'Envoyer le signalement'}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
