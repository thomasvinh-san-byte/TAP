'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { listDraftsAction, deleteRideDraft } from '../actions';
import { useRideOrchestrator } from './ride-orchestrator-context.client';

/**
 * DraftQueue header (Phase 2 / Wave 4 — SAIS-04).
 *
 * Affiche un dropdown listant les brouillons de l'utilisateur (RLS-filtré
 * server-side via `listDraftsAction`). Click sur un item dispatch `RESUME`
 * vers l'orchestrator qui réouvre le modal avec valeurs restaurées. Click
 * sur l'icône poubelle supprime le brouillon (sans confirmation V1 — D-10
 * brouillons = données transitoires hors audit log).
 *
 * Pas de `useEffect-fetch` (DEC-005) : useQuery + refetchInterval 10s.
 */
interface DraftEntry {
  id: string;
  patient_id: string | null;
  payload: Record<string, unknown>;
  updated_at: string;
}

function formatPreview(d: DraftEntry): string {
  const p = d.payload as { pickup_address?: string; dropoff_address?: string };
  const pickup = p.pickup_address?.slice(0, 40) ?? 'Adresse à compléter';
  const dropoff = p.dropoff_address?.slice(0, 40) ?? '…';
  return `${pickup} → ${dropoff}`;
}

function formatRelative(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function DraftQueue(): JSX.Element {
  const queryClient = useQueryClient();
  const { dispatch } = useRideOrchestrator();
  const { data, isPending } = useQuery({
    queryKey: ['ride-drafts'],
    queryFn: () => listDraftsAction(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const drafts = (data ?? []) as DraftEntry[];
  const count = drafts.length;

  const handleResume = (draftId: string, patientId: string | null) => {
    dispatch({
      type: 'RESUME',
      draftId,
      patientId: patientId ?? undefined,
    });
  };

  const handleDelete = async (draftId: string) => {
    const res = await deleteRideDraft(draftId);
    if (res.success) {
      await queryClient.invalidateQueries({ queryKey: ['ride-drafts'] });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Brouillons (${count})`}
          className="relative gap-8"
        >
          <Inbox className="h-16 w-16" aria-hidden />
          {count > 0 && (
            <Badge variant="secondary" className="ml-4 tabular-nums">
              {count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[400px] w-[360px] overflow-y-auto">
        <DropdownMenuLabel>
          {count === 0
            ? 'Aucun brouillon en cours'
            : `${count} brouillon${count > 1 ? 's' : ''} en cours`}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPending && <DropdownMenuItem disabled>Chargement…</DropdownMenuItem>}
        {!isPending && drafts.length === 0 && (
          <DropdownMenuItem disabled>Vos brouillons apparaîtront ici.</DropdownMenuItem>
        )}
        {drafts.map((d) => (
          <DropdownMenuItem
            key={d.id}
            onSelect={(e) => {
              e.preventDefault();
              handleResume(d.id, d.patient_id);
            }}
            className="flex flex-col items-start gap-4"
          >
            <span className="w-full truncate text-sm font-medium">{formatPreview(d)}</span>
            <div className="text-muted-foreground flex w-full items-center justify-between text-xs">
              <span>{formatRelative(d.updated_at)}</span>
              <button
                type="button"
                aria-label="Supprimer ce brouillon"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(d.id);
                }}
                className="hover:text-destructive transition-colors"
              >
                <Trash2 className="h-12 w-12" aria-hidden />
              </button>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
