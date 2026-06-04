'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Plus } from 'lucide-react';
import { listRidesEnrichedAction } from '../actions';
import type { RideRowEnriched, RideStatus, RideTransportMode } from '../_lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { formatShortDateFr, formatTimeFr, isToday } from '@/lib/dates-fr';
import { ModeBadge, PaymentBadge, StatusBadge, UrgencyBadge } from './ride-badges';
import { RideDrawer } from './ride-drawer.client';
import { AssignModal } from './assign-modal.client';
import { useRideOrchestrator } from './ride-orchestrator-context.client';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'validee', label: 'Validées' },
  { value: 'assignee', label: 'Affectées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'annulee_regulateur', label: 'Annulées' },
] as const;

const MODE_FILTERS = [
  { value: 'all', label: 'Tous modes' },
  { value: 'taxi_conventionne', label: 'Taxi conventionné' },
  { value: 'tpmr', label: 'TPMR' },
  { value: 'vsl', label: 'VSL' },
  { value: 'ambulance', label: 'Ambulance' },
] as const;

function truncate(s: string, max = 60): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Hotfix 04.7-bis élargi : raccourcir une adresse complète à son préfixe
 * « avant la virgule » pour confiner le scroll horizontal de la table
 * Courses (pattern Linear/Stripe/Notion — truncation + tooltip).
 *
 * Exemples :
 *   « EHPAD Les Lataniers, 97419 La Possession » → « EHPAD Les Lataniers »
 *   « CHU Sud Saint-Pierre — Avenue du Président Mitterrand, … » → « CHU Sud Saint-Pierre — Avenue du Président Mitterrand »
 *   « 12 Rue de Paris, 97400 Saint-Denis » → « 12 Rue de Paris »
 *
 * Si pas de virgule, retourne tel quel (saisie libre ultra-courte).
 */
function shortAddress(full: string): string {
  const idx = full.indexOf(',');
  if (idx === -1) return full;
  return full.slice(0, idx).trim();
}

/**
 * RidesList enrichi (Phase 3 / 03-D).
 *
 * Pré-fetch RSC via /courses/page.tsx (clé identique, queryFn pointe sur la
 * version enrichie). Click ligne → ouvre RideDrawer. Bouton "Assigner" sur
 * une ligne non assignée court-circuite le drawer pour passer direct à la
 * modal (gain de clic régulatrice 8h/jour).
 */
const PAGE_SIZE = 50;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RidesList(): JSX.Element {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  // Hotfix 04.7-bis : filtre date — défaut aujourd'hui pour focus régulatrice
  const [dateFilter, setDateFilter] = useState<string>(todayIso());
  // Hotfix 04.7-bis : pagination simple — offset cumulatif via bouton Voir plus
  const [pageOffset, setPageOffset] = useState<number>(0);
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [assignRideId, setAssignRideId] = useState<string | null>(null);
  const dq = useDeferredValue(q);
  const orchestrator = useRideOrchestrator();

  // Reset offset quand un filtre change (sinon on perd la cohérence pagination)
  const resetOffset = () => setPageOffset(0);

  const { data, isPending } = useQuery({
    queryKey: [
      'rides',
      { status: statusFilter, mode: modeFilter, date: dateFilter, limit: pageOffset + PAGE_SIZE },
    ],
    queryFn: () =>
      listRidesEnrichedAction({
        status: statusFilter === 'all' ? undefined : (statusFilter as RideStatus),
        transport_mode: modeFilter === 'all' ? undefined : (modeFilter as RideTransportMode),
        date: dateFilter || undefined,
        limit: pageOffset + PAGE_SIZE,
        offset: 0,
      }),
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  const rides = (data ?? []) as RideRowEnriched[];
  const hasMore = rides.length === pageOffset + PAGE_SIZE;
  const filtered = rides.filter((r) => {
    if (!dq) return true;
    const lower = dq.toLowerCase();
    return (
      r.pickup_address.toLowerCase().includes(lower) ||
      r.dropoff_address.toLowerCase().includes(lower) ||
      `${r.patient?.nom ?? ''} ${r.patient?.prenom ?? ''}`.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="space-y-16">
      <div className="flex flex-wrap items-end gap-12">
        <div className="min-w-[240px] flex-1">
          <Input
            aria-label="Rechercher dans les adresses ou patients"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-8">
          <DateFieldFr
            value={dateFilter}
            onChange={(v) => {
              setDateFilter(v);
              resetOffset();
            }}
            ariaLabel="Filtre date des courses"
            className="h-10 w-[160px] tabular-nums"
          />
          {dateFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter('');
                resetOffset();
              }}
              aria-label="Effacer le filtre date"
            >
              Effacer
            </Button>
          )}
        </div>
        <Select
          ariaLabel="Filtre statut"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            resetOffset();
          }}
          items={[...STATUS_FILTERS]}
          triggerClassName="min-w-[180px]"
        />
        <Select
          ariaLabel="Filtre mode de transport"
          value={modeFilter}
          onChange={(v) => {
            setModeFilter(v);
            resetOffset();
          }}
          items={[...MODE_FILTERS]}
          triggerClassName="min-w-[180px]"
        />
      </div>

      {isPending && (
        <div className="space-y-8" aria-label="Chargement des courses">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
      )}

      {!isPending && filtered.length === 0 && (
        <EmptyState
          icon={Calendar}
          title="Aucune course aujourd'hui"
          description="Aucune course planifiée pour cette date."
          action={{
            onClick: () => orchestrator.dispatch({ type: 'OPEN_NEW' }),
            label: 'Nouvelle course',
            icon: Plus,
          }}
        />
      )}

      {!isPending && filtered.length > 0 && (
        <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
          <span>
            {filtered.length} course{filtered.length > 1 ? 's' : ''} affichée
            {filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {!isPending && filtered.length > 0 && (
        <DataTable<RideRowEnriched>
          columns={RIDE_COLUMNS((rid) => setAssignRideId(rid))}
          rows={filtered}
          // DEC-033 : clé inclut `status` pour re-mount au changement
          // (sans ça, « Assigner » reste actif après affectation —
          // précédent Phase 03.2 #4).
          rowKey={(r) => `${r.id}-${r.status}`}
          ariaLabel="Liste des courses"
          onRowClick={(r) => setOpenRideId(r.id)}
        />
      )}

      {!isPending && filtered.length > 0 && hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPageOffset((o) => o + PAGE_SIZE)}
          >
            Voir plus ({PAGE_SIZE} de plus)
          </Button>
        </div>
      )}

      <RideDrawer
        rideId={openRideId}
        open={openRideId !== null}
        onOpenChange={(o) => !o && setOpenRideId(null)}
        onRequestAssign={(rid) => {
          setOpenRideId(null);
          setAssignRideId(rid);
        }}
      />
      <AssignModal
        rideId={assignRideId}
        open={assignRideId !== null}
        onOpenChange={(o) => !o && setAssignRideId(null)}
      />
    </div>
  );
}

/**
 * Définition des colonnes de la liste courses (Phase 06.15 D-04). Le clic
 * de ligne ouvre le drawer (`onRowClick` sur DataTable). Le bouton
 * « Assigner » appelle `e.stopPropagation()` pour éviter de déclencher
 * l'ouverture du drawer.
 */
function RIDE_COLUMNS(onAssign: (rideId: string) => void): DataTableColumn<RideRowEnriched>[] {
  return [
    {
      key: 'heure',
      header: 'Heure',
      cell: (ride) => {
        const today = isToday(ride.scheduled_at);
        return (
          <div className="tabular-nums">
            <div className="font-medium">{formatTimeFr(ride.scheduled_at)}</div>
            {!today && (
              <div className="text-muted-foreground text-xs">
                {formatShortDateFr(ride.scheduled_at)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'patient',
      header: 'Patient',
      cell: (ride) => {
        const patientName = ride.patient
          ? `${ride.patient.nom} ${ride.patient.prenom}`.trim()
          : 'Patient inconnu';
        return (
          <div className="flex items-center gap-8">
            <InitialsAvatar name={patientName} size={24} />
            <span className="max-w-[180px] truncate">{patientName}</span>
          </div>
        );
      },
    },
    {
      key: 'trajet',
      header: 'Trajet',
      cell: (ride) => (
        <div className="flex min-w-0 items-center gap-8">
          <span className="max-w-[180px] truncate" title={ride.pickup_address}>
            {shortAddress(ride.pickup_address)}
          </span>
          <ArrowRight className="text-muted-foreground h-12 w-12 shrink-0" aria-hidden />
          <span className="max-w-[180px] truncate" title={ride.dropoff_address}>
            {shortAddress(ride.dropoff_address)}
          </span>
        </div>
      ),
    },
    {
      key: 'mode',
      header: 'Mode',
      cell: (ride) => <ModeBadge mode={ride.transport_mode} />,
    },
    {
      key: 'urgence',
      header: 'Urgence',
      cell: (ride) => <UrgencyBadge urgency={ride.urgency} />,
    },
    {
      key: 'chauffeur',
      header: 'Chauffeur',
      cell: (ride) =>
        ride.driver ? (
          <div className="flex items-center gap-8">
            <InitialsAvatar name={ride.driver.nom_affichage} role="chauffeur" size={24} />
            <span className="max-w-[140px] truncate">{ride.driver.nom_affichage}</span>
          </div>
        ) : ride.status === 'validee' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(ride.id);
            }}
          >
            Assigner
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'statut',
      header: 'Statut',
      cell: (ride) => <StatusBadge status={ride.status} />,
    },
    {
      key: 'paiement',
      header: 'Paiement',
      cell: (ride) => (
        <PaymentBadge status={ride.payment_status} amountEur={ride.tarif_amount_eur} />
      ),
    },
  ];
}
