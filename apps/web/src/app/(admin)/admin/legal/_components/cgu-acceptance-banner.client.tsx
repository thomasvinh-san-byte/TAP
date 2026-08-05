'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { acceptCguAction } from '../_actions/cgu-accept';

interface Props {
  currentVersion: string;
  acceptedVersion: string | null;
}

/**
 * Banner CGU non-bloquant (D-13, CONTEXT.md §specifics « CGU versioning »).
 *
 * Affichage si `acceptedVersion < currentVersion`. Le bouton « Lire et
 * accepter » ouvre /legal/cgu et appelle Server Action `acceptCguAction`
 * pour persister `profiles.cgu_version_accepted` + audit log via trigger.
 */
export function CguAcceptanceBanner({ currentVersion, acceptedVersion }: Props) {
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;
  if (acceptedVersion && acceptedVersion >= currentVersion) return null;

  function onAccept() {
    startTransition(async () => {
      const res = await acceptCguAction(currentVersion);
      if (!res.error) setHidden(true);
    });
  }

  return (
    <div
      role="status"
      className="border-info bg-info/5 flex items-center justify-between gap-16 rounded-lg border p-16"
    >
      <div className="flex-1">
        <p className="font-medium">Nos CGU ont été mises à jour</p>
        <p className="text-muted-foreground mt-4 text-sm">
          Version {currentVersion} : merci de prendre connaissance des nouvelles conditions.
        </p>
      </div>
      <div className="flex gap-8">
        <Button asChild variant="outline" size="sm">
          <Link href="/legal/cgu" target="_blank">
            Lire les CGU
          </Link>
        </Button>
        <Button variant="accent" size="sm" onClick={onAccept} disabled={pending}>
          {pending ? 'Enregistrement…' : 'Accepter'}
        </Button>
      </div>
    </div>
  );
}
