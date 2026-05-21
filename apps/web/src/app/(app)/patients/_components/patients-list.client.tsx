'use client';

import { useState, useDeferredValue } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, MessageSquare, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import { archivePatientAction, searchPatientsAction, unarchivePatientAction } from '../actions';
import { PatientSearch } from './patient-search.client';
import { PatientDrawer } from './patient-drawer.client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { daysFromNow, formatShortDateFr, formatTimeFr } from '@/lib/dates-fr';

interface PatientListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
  last_ride_at?: string | null;
  next_ride_at?: string | null;
}

const CANAL_LABEL: Record<PatientListItem['canal_contact_prefere'], string> = {
  sms: 'SMS',
  appel: 'Appel',
  aucun: 'Aucun',
};

function CanalIcon({ canal }: { canal: PatientListItem['canal_contact_prefere'] }): JSX.Element {
  const cls = 'h-12 w-12';
  if (canal === 'sms') return <MessageSquare className={cls} aria-hidden />;
  if (canal === 'appel') return <Phone className={cls} aria-hidden />;
  return <X className={cls} aria-hidden />;
}

function describeRides(p: PatientListItem): string {
  const last = p.last_ride_at;
  const next = p.next_ride_at;
  if (next) {
    const days = daysFromNow(next);
    if (days >= 0 && days <= 7) {
      return `Prochaine course : ${formatShortDateFr(next)} ${formatTimeFr(next)}`;
    }
  }
  if (last) {
    const days = Math.abs(daysFromNow(last));
    if (days === 0) return "Dernière course aujourd'hui";
    if (days === 1) return 'Dernière course hier';
    return `Dernière course il y a ${days} jours`;
  }
  return 'Aucune course enregistrée';
}

/**
 * Liste patients enrichie (Phase 3 / 03-D).
 *
 * Pour chaque ligne :
 *   - InitialsAvatar 32 (hash déterministe sur le nom complet)
 *   - Nom Prénom + sous-ligne contextuelle (dernière / prochaine course)
 *   - Badge canal_contact_prefere avec icône Lucide
 *
 * Comportement :
 *   - useDeferredValue : debounce React natif
 *   - 1 char = pas de fetch (alignement D-10)
 *   - placeholderData prev : pas de flash skeleton entre frappes
 *   - Hover ligne bg-muted/50 — clic → drawer patient existant (Phase 1)
 */
type Scope = 'active' | 'archived';

export function PatientsList() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [scope, setScope] = useState<Scope>('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['patients', { q: dq, scope }],
    queryFn: () => searchPatientsAction(dq, scope),
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  const handleArchive = async (patientId: string, fullName: string): Promise<void> => {
    // Confirmation native (V1.5 — ConfirmDialog shadcn différé V2)
    if (
      !window.confirm(
        `Archiver le patient « ${fullName} » ? Le dossier sera masqué des listes actives mais conservé conformément aux obligations RGPD/HDS. Cette action est réversible (dirigeant uniquement).`,
      )
    ) {
      return;
    }
    setPendingArchive(patientId);
    const res = await archivePatientAction(patientId);
    setPendingArchive(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`« ${fullName} » archivé.`);
    void qc.invalidateQueries({ queryKey: ['patients'] });
  };

  const handleUnarchive = async (patientId: string, fullName: string): Promise<void> => {
    if (
      !window.confirm(
        `Réactiver le patient « ${fullName} » ? Le dossier redeviendra visible dans les listes actives.`,
      )
    ) {
      return;
    }
    setPendingArchive(patientId);
    const res = await unarchivePatientAction(patientId);
    setPendingArchive(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`« ${fullName} » réactivé.`);
    void qc.invalidateQueries({ queryKey: ['patients'] });
  };

  return (
    <div className="space-y-16">
      <div className="flex flex-wrap items-center gap-12">
        <div
          className="border-border bg-muted/40 inline-flex rounded-md border p-2"
          role="tablist"
          aria-label="Filtre archive patients"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'active'}
            onClick={() => setScope('active')}
            className={cn(
              'rounded-sm px-12 py-6 text-sm transition-colors',
              scope === 'active'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Actifs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'archived'}
            onClick={() => setScope('archived')}
            className={cn(
              'rounded-sm px-12 py-6 text-sm transition-colors',
              scope === 'archived'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Archivés
          </button>
        </div>
        <div className="min-w-[240px] flex-1">
          <PatientSearch value={q} onChange={setQ} />
        </div>
      </div>

      {q.length === 1 && (
        <p className="text-muted-foreground text-sm">
          Tapez au moins 2 caractères pour lancer la recherche.
        </p>
      )}

      {isPending && !data && (
        <ul className="space-y-8" aria-label="Chargement des patients">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-64 w-full" />
            </li>
          ))}
        </ul>
      )}

      {data && data.length === 0 && q.length >= 2 && !isFetching && (
        <p className="text-muted-foreground text-sm">Aucun patient ne correspond à « {q} ».</p>
      )}

      {data && data.length > 0 && (
        <ul
          className="divide-border border-border divide-y overflow-hidden rounded-md border"
          aria-label="Résultats de recherche"
        >
          {data.map((p: PatientListItem) => {
            const fullName = `${p.nom} ${p.prenom}`.trim();
            const isPending = pendingArchive === p.id;
            return (
              <li key={p.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="hover:bg-muted/50 focus-visible:ring-ring flex flex-1 items-center gap-16 px-16 py-12 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                >
                  <InitialsAvatar name={fullName} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col gap-4">
                    <span className="text-foreground truncate font-semibold">
                      {p.nom} {p.prenom}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {describeRides(p)}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0 gap-4">
                    <CanalIcon canal={p.canal_contact_prefere} />
                    <span>{CANAL_LABEL[p.canal_contact_prefere]}</span>
                  </Badge>
                </button>
                <div className="flex items-center px-12">
                  {scope === 'active' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleArchive(p.id, fullName);
                      }}
                      disabled={isPending}
                      aria-label={`Archiver ${fullName}`}
                      className="gap-4"
                    >
                      <Archive className="h-12 w-12" aria-hidden />
                      Archiver
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnarchive(p.id, fullName);
                      }}
                      disabled={isPending}
                      aria-label={`Réactiver ${fullName}`}
                      className="gap-4"
                    >
                      <ArchiveRestore className="h-12 w-12" aria-hidden />
                      Réactiver
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PatientDrawer
        patientId={openId}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </div>
  );
}
