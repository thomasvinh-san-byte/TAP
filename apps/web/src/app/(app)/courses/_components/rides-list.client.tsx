'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listRidesEnrichedAction } from '../actions';
import type { RideRowEnriched, RideStatus, RideTransportMode } from '../_lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { formatShortDateFr, formatTimeFr, isToday } from '@/lib/dates-fr';
import { ModeBadge, PaymentBadge, StatusBadge, UrgencyBadge } from './ride-badges';
import { RideDrawer } from './ride-drawer.client';
import { AssignModal } from './assign-modal.client';

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
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              resetOffset();
            }}
            aria-label="Filtre date des courses"
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
        <div className="border-border text-muted-foreground rounded-md border p-32 text-center text-sm">
          Aucune course ne correspond aux critères.
        </div>
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
        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm" aria-label="Liste des courses">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-12 py-12 font-medium">Heure</th>
                <th className="px-12 py-12 font-medium">Patient</th>
                <th className="px-12 py-12 font-medium">Trajet</th>
                <th className="px-12 py-12 font-medium">Mode</th>
                <th className="px-12 py-12 font-medium">Urgence</th>
                <th className="px-12 py-12 font-medium">Chauffeur</th>
                <th className="px-12 py-12 font-medium">Statut</th>
                <th className="px-12 py-12 font-medium">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                // Clé inclut `status` pour forcer le re-mount au changement
                // de statut (validee/assignee/en_cours/terminee/annulee).
                // Sans ça, le bouton « Affecter » reste actif après affectation
                // ou le bouton « Annuler » reste cliquable après annulation
                // (DEC-033 + précédent Phase 03.2 #4).
                <RideRowView
                  key={`${r.id}-${r.status}`}
                  ride={r}
                  onOpen={() => setOpenRideId(r.id)}
                  onAssign={() => setAssignRideId(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
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

interface RideRowProps {
  ride: RideRowEnriched;
  onOpen: () => void;
  onAssign: () => void;
}

function RideRowView({ ride, onOpen, onAssign }: RideRowProps): JSX.Element {
  const today = isToday(ride.scheduled_at);
  const patientName = ride.patient
    ? `${ride.patient.nom} ${ride.patient.prenom}`.trim()
    : 'Patient inconnu';
  return (
    <tr
      className="border-border hover:bg-muted/50 cursor-pointer border-t transition-colors duration-150"
      onClick={onOpen}
    >
      <td className="px-12 py-12 align-top tabular-nums">
        <div className="font-medium">{formatTimeFr(ride.scheduled_at)}</div>
        {!today && (
          <div className="text-muted-foreground text-xs">
            {formatShortDateFr(ride.scheduled_at)}
          </div>
        )}
      </td>
      <td className="px-12 py-12 align-top">
        <div className="flex items-center gap-8">
          <InitialsAvatar name={patientName} size={24} />
          <span className="max-w-[180px] truncate">{patientName}</span>
        </div>
      </td>
      <td className="min-w-0 px-12 py-12 align-top">
        <div className="flex min-w-0 items-center gap-8 text-sm">
          <span className="max-w-[180px] truncate" title={ride.pickup_address}>
            {shortAddress(ride.pickup_address)}
          </span>
          <ArrowRight className="text-muted-foreground h-12 w-12 shrink-0" aria-hidden />
          <span className="max-w-[180px] truncate" title={ride.dropoff_address}>
            {shortAddress(ride.dropoff_address)}
          </span>
        </div>
      </td>
      <td className="px-12 py-12 align-top">
        <ModeBadge mode={ride.transport_mode} />
      </td>
      <td className="px-12 py-12 align-top">
        <UrgencyBadge urgency={ride.urgency} />
      </td>
      <td className="px-12 py-12 align-top">
        {ride.driver ? (
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
              onAssign();
            }}
          >
            Assigner
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      <td className="px-12 py-12 align-top">
        <StatusBadge status={ride.status} />
      </td>
      <td className="px-12 py-12 align-top">
        <PaymentBadge status={ride.payment_status} amountEur={ride.tarif_amount_eur} />
      </td>
    </tr>
  );
}
