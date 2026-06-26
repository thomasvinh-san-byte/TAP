'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getRegulateurPlanningMirrorAction } from '../actions-mirror';
import { saveRegulateurMirror } from '@/lib/offline/regulateur-db';
import { DegradedPlanning } from './degraded-planning.client';

/**
 * Bascule mode normal / mode dégradé du cockpit régulateur (DEC-177, §5.24).
 *
 * - EN LIGNE : rend le cockpit normal (`children`) ET alimente en arrière-plan
 *   le miroir Dexie (planning J/J+1 + contacts) — au mount et à chaque retour
 *   réseau, pour disposer d'un cache frais en cas de coupure.
 * - HORS-LIGNE : rend la vue LECTURE SEULE (`DegradedPlanning`) à la place du
 *   cockpit (la fraîcheur 4h est gérée dans la vue).
 *
 * Réutilise les MÉCANISMES offline (Dexie, listeners online/offline) sans la
 * sémantique d'écriture du chauffeur : aucune file de mutations ici.
 */
function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function OfflineGate({ children }: { children: ReactNode }): JSX.Element {
  const online = useOnline();
  const syncing = useRef(false);

  useEffect(() => {
    if (!online) return;
    if (syncing.current) return;
    syncing.current = true;
    void getRegulateurPlanningMirrorAction()
      .then((rows) => saveRegulateurMirror(rows))
      .catch((err) => console.error('[mirror régulateur] synchro échouée:', err))
      .finally(() => {
        syncing.current = false;
      });
  }, [online]);

  if (!online) return <DegradedPlanning />;
  return <>{children}</>;
}
