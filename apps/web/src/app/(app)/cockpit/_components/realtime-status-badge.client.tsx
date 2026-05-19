'use client';

import { Radio, RefreshCw, WifiOff } from 'lucide-react';
import type { RealtimeStatus } from '../_lib/types';

const LABEL: Record<RealtimeStatus, string> = {
  connected: 'En direct',
  reconnecting: 'Reconnexion…',
  disconnected: 'Hors ligne',
};

export function RealtimeStatusBadge({ status }: { status: RealtimeStatus }): JSX.Element {
  if (status === 'reconnecting') {
    return (
      <div
        role="status"
        aria-label={LABEL.reconnecting}
        className="inline-flex items-center gap-8 rounded-full bg-amber-100 px-12 py-4 text-sm text-amber-900 cockpit-status-pulse"
      >
        <RefreshCw aria-hidden className="h-12 w-12" />
        <span>{LABEL.reconnecting}</span>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div
        role="status"
        aria-label={LABEL.disconnected}
        className="inline-flex items-center gap-8 rounded-full bg-destructive/10 px-12 py-4 text-sm text-destructive"
      >
        <WifiOff aria-hidden className="h-12 w-12" />
        <span>{LABEL.disconnected}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={LABEL.connected}
      className="inline-flex items-center gap-8 rounded-full bg-emerald-50 px-12 py-4 text-sm text-emerald-700"
    >
      <Radio aria-hidden className="h-12 w-12" />
      <span>{LABEL.connected}</span>
    </div>
  );
}
