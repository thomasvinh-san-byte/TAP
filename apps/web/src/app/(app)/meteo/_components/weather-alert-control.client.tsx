'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, CloudLightning } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setWeatherAlertAction } from '../actions';
import type { WeatherAlert } from '../_lib/queries';

/**
 * Pilotage du mode alerte météo / cyclone (DEC-170, CdG l.380-385). Si un
 * épisode est actif, propose sa désactivation ; sinon, un formulaire d'activation
 * (motif obligatoire, zone optionnelle).
 */
export function WeatherAlertControl({ active }: { active: WeatherAlert | null }): JSX.Element {
  const router = useRouter();
  const [motif, setMotif] = React.useState('');
  const [zone, setZone] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function activate(): void {
    if (!motif.trim()) {
      toast.error('Précisez le motif (ex. alerte rouge cyclone).');
      return;
    }
    startTransition(async () => {
      const res = await setWeatherAlertAction({
        active: true,
        motif: motif.trim(),
        zone: zone.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Mode alerte météo activé.');
      setMotif('');
      setZone('');
      router.refresh();
    });
  }

  function deactivate(): void {
    startTransition(async () => {
      const res = await setWeatherAlertAction({ active: false, motif: 'levée' });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Mode alerte météo levé.');
      router.refresh();
    });
  }

  if (active) {
    return (
      <div className="border-border bg-card space-y-12 rounded-lg border p-16">
        <p className="text-sm">
          Mode alerte météo <span className="font-semibold">actif</span> : {active.motif}
          {active.zone ? ` — zone ${active.zone}` : ''}.
        </p>
        <Button type="button" variant="outline" onClick={deactivate} disabled={pending}>
          <CloudOff className="mr-8 h-16 w-16" aria-hidden />
          {pending ? 'Levée…' : "Lever l'alerte météo"}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border bg-card space-y-16 rounded-lg border p-16">
      <div className="space-y-8">
        <Label htmlFor="meteo-motif">Motif de l&apos;alerte</Label>
        <Input
          id="meteo-motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          maxLength={200}
          placeholder="Ex. alerte rouge cyclone"
        />
      </div>
      <div className="space-y-8">
        <Label htmlFor="meteo-zone">Zone concernée (facultatif)</Label>
        <Input
          id="meteo-zone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          maxLength={120}
          placeholder="Ex. Saint-Denis — laisser vide pour toute l'activité"
        />
      </div>
      <Button type="button" variant="accent" onClick={activate} disabled={pending}>
        <CloudLightning className="mr-8 h-16 w-16" aria-hidden />
        {pending ? 'Activation…' : 'Activer le mode alerte météo'}
      </Button>
    </div>
  );
}
