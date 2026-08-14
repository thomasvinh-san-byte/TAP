'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listDraftsAction, deleteRideDraft } from '../../courses/actions';
import { useRideOrchestrator } from '../../courses/_components/ride-orchestrator-context.client';

/**
 * Indicateur « Brouillons non finalisés » du cockpit (CdC §5.13, DEC-140).
 *
 * Repositionne la file de brouillons depuis le header (réservé aux
 * notifications §5.22) vers le cockpit, où le CdC la liste comme indicateur
 * du régulateur. MÊME source que l'ancien DraftQueue : `useQuery(['ride-drafts'])`
 * (cache partagé), `listDraftsAction`, `deleteRideDraft`, `dispatch RESUME` →
 * rouvre le modal course exactement comme avant. Présentation alignée sur les
 * panneaux cockpit (cf. `AlertsPanel`), pas la grammaire dropdown du header.
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

export function DraftsIndicator(): JSX.Element {
  const queryClient = useQueryClient();
  const { dispatch } = useRideOrchestrator();
  // Brouillon en cours de suppression (garde anti-double-clic + libellé pending).
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: ['ride-drafts'],
    queryFn: () => listDraftsAction(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const drafts = (data ?? []) as DraftEntry[];
  const count = drafts.length;

  const handleResume = (draftId: string, patientId: string | null) => {
    dispatch({ type: 'RESUME', draftId, patientId: patientId ?? undefined });
  };

  const handleDelete = async (draftId: string) => {
    if (deletingId) return; // garde anti-double-clic
    setDeletingId(draftId);
    try {
      const res = await deleteRideDraft(draftId);
      if (res.success) {
        await queryClient.invalidateQueries({ queryKey: ['ride-drafts'] });
      } else {
        // Ne plus « faire semblant » : un DELETE 0-ligne (RLS / brouillon d'un
        // autre compte) est un échec explicite, pas un succès silencieux.
        toast.error(res.error ?? 'Suppression impossible : brouillon introuvable ou non autorisé.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="mb-12 flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Brouillons non finalisés
        </h2>
        {count > 0 && (
          <span className="bg-muted text-muted-foreground inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-8 text-xs font-semibold tabular-nums">
            {count}
          </span>
        )}
      </header>

      {isPending && <p className="text-muted-foreground text-sm">Chargement…</p>}

      {!isPending && count === 0 && (
        <p className="text-muted-foreground text-sm">Aucun brouillon.</p>
      )}

      {!isPending && count > 0 && (
        <div className="flex flex-col gap-8 overflow-y-auto pr-4">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="border-border bg-background hover:bg-muted/50 focus-within:ring-ring rounded-md border p-12 transition-colors focus-within:ring-2"
            >
              <button
                type="button"
                onClick={() => handleResume(d.id, d.patient_id)}
                className="block w-full text-left focus:outline-none"
                aria-label={`Reprendre le brouillon : ${formatPreview(d)}`}
              >
                <span className="block truncate text-sm font-medium">{formatPreview(d)}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatRelative(d.updated_at)}
                </span>
              </button>
              <div className="mt-8 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Supprimer ce brouillon"
                  onClick={() => void handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className="text-muted-foreground hover:text-destructive gap-4"
                >
                  <Trash2 className="h-12 w-12" aria-hidden />
                  {deletingId === d.id ? 'Suppression…' : 'Supprimer'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
