'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Armement du son d'alerte (§5.13). La politique d'autoplay impose une
 * interaction : la régulatrice arme le son en début de service. Non armé →
 * alerte visuelle seule (hint « son désactivé »), sans erreur.
 */
export function AlertSoundToggle({
  armed,
  onArm,
  onDisarm,
}: {
  armed: boolean;
  onArm: () => void;
  onDisarm: () => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-8"
        aria-pressed={armed}
        onClick={() => (armed ? onDisarm() : onArm())}
      >
        {armed ? (
          <Volume2 className="h-12 w-12" aria-hidden />
        ) : (
          <VolumeX className="h-12 w-12" aria-hidden />
        )}
        {armed ? 'Son activé' : 'Activer le son'}
      </Button>
      {!armed && (
        <p className="text-muted-foreground text-xs">Son désactivé — alerte visuelle seule.</p>
      )}
    </div>
  );
}
