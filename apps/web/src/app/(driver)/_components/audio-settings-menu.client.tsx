'use client';

import { Check, Volume2, VolumeX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDriverAudio } from './driver-audio.client';

/**
 * <AudioSettingsMenu> — réglages audio chauffeur (PWA-02, §5.16).
 *
 * Posé dans le header `(driver)/layout.tsx` à côté du contraste élevé. Deux
 * bascules simples, persistées (localStorage), activées par défaut :
 *   - Lecture vocale : nom + adresse énoncés au démarrage de la course
 *   - Sons d'alerte  : earcons brefs distincts par type d'événement
 *
 * A11y : `aria-checked` sur chaque bascule, `onSelect` empêché pour garder le
 * menu ouvert pendant le réglage, icône du déclencheur `aria-hidden` (le label
 * porte le sens).
 */
export function AudioSettingsMenu({ className }: { className?: string }): JSX.Element {
  const { voiceEnabled, earconsEnabled, setVoiceEnabled, setEarconsEnabled } = useDriverAudio();
  const anyOn = voiceEnabled || earconsEnabled;
  const label = 'Réglages audio';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'transition-colors duration-150',
          className,
        )}
      >
        {anyOn ? (
          <Volume2 className="h-16 w-16" aria-hidden />
        ) : (
          <VolumeX className="h-16 w-16" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Réglages audio</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ToggleRow
          checked={voiceEnabled}
          onToggle={() => setVoiceEnabled(!voiceEnabled)}
          title="Lecture vocale"
          description="Nom et adresse au départ"
        />
        <ToggleRow
          checked={earconsEnabled}
          onToggle={() => setEarconsEnabled(!earconsEnabled)}
          title="Sons d'alerte"
          description="Un son distinct par événement"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ToggleRow({
  checked,
  onToggle,
  title,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      onSelect={(e) => {
        e.preventDefault(); // garder le menu ouvert pendant le réglage
        onToggle();
      }}
      className="flex items-start gap-12"
    >
      <span
        className={cn(
          'mt-2 inline-flex h-16 w-16 shrink-0 items-center justify-center rounded border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
        aria-hidden
      >
        {checked && <Check className="h-12 w-12" />}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </span>
    </DropdownMenuItem>
  );
}
