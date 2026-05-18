'use client';

/**
 * ConnectionStatusBadge — Phase 04.9 Wave 5.
 *
 * 4 états visuels intégrés au header existant (PAS de banner full-width,
 * anti-pattern UI-SPEC PR #110) :
 *   1. online_idle : RIEN visible (pas de pollution UI)
 *   2. synching : primary pulse + RefreshCw rotating + count
 *   3. offline_with_queue : amber pulse + CloudOff + count
 *   4. offline_idle : muted gris stable + CloudOff
 *
 * Couleur destructive (rouge) RÉSERVÉE dead letter toast Sonner Wave 4
 * (anti-pattern UI-SPEC #110).
 *
 * Refs : PLAN-5, UI-SPEC PR #110 (4 wireframes ASCII).
 */

import { CloudOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '@/lib/offline/use-sync-status';

export function ConnectionStatusBadge(): JSX.Element | null {
  const { isOnline, pendingCount, isSynching } = useSyncStatus();

  if (isOnline && pendingCount === 0) return null;

  if (isSynching) {
    return (
      <div
        role="status"
        aria-label={`Synchronisation en cours, ${pendingCount} mutations`}
        className="inline-flex items-center gap-8 rounded-full bg-primary/10 px-12 py-4 text-sm text-primary animate-pulse"
      >
        <RefreshCw aria-hidden className="h-16 w-16 animate-spin" />
        <span>Sync… {pendingCount}</span>
      </div>
    );
  }

  if (!isOnline && pendingCount > 0) {
    return (
      <div
        role="status"
        aria-label={`Hors ligne, ${pendingCount} mutations en attente`}
        className="inline-flex items-center gap-8 rounded-full bg-amber-100 px-12 py-4 text-sm text-amber-900 animate-pulse"
      >
        <CloudOff aria-hidden className="h-16 w-16" />
        <span>Hors-ligne · {pendingCount}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Hors ligne"
      className="inline-flex items-center gap-8 rounded-full bg-muted px-12 py-4 text-sm text-muted-foreground"
    >
      <CloudOff aria-hidden className="h-16 w-16" />
      <span>Hors-ligne</span>
    </div>
  );
}
