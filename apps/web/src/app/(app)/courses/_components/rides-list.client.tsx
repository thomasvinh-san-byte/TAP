'use client';

import { type ReactNode, useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Check, Plus, Rows3 } from 'lucide-react';
import { listRidesEnrichedAction } from '../actions';
import type { RideRowEnriched, RideStatus, RideTransportMode } from '../_lib/queries';
import { RIDES_LIST_FETCH_CAP } from '../_lib/list-config';
import { ExportCsvButton } from './export-csv-button.client';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DataTable,
  ListToolbar,
  ListMeta,
  Pagination,
  type DataTableColumn,
} from '@/components/data-table';
import { DatePickerFieldFr } from '@/components/date-picker-fr.client';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { formatShortDateFr, formatTimeFr, isToday } from '@/lib/dates-fr';
import { ModeBadge, PaymentBadge, StatusBadge, UrgencyBadge } from './ride-badges';
import { RideDrawer } from './ride-drawer.client';
import { AssignModal } from './assign-modal.client';
import { useRideOrchestrator } from './ride-orchestrator-context.client';
import { CoursesBulkActions } from './courses-bulk-actions.client';
import { useTableDensity } from '@/lib/use-table-density.client';

// Source canonique des statuts actifs : STATUS_LABELS_FR (ride-status-fr.ts) et
// la machine à états (@tap/shared). Liste maintenue à la main ici pour l'ordre
// et le regroupement des annulations sous une seule entrée « Annulées » — à
// garder synchronisée si l'énumération évolue (FIX-01, §5.16).
const STATUS_FILTERS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'validee', label: 'Validées' },
  { value: 'assignee', label: 'Affectées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'arrive_sur_place', label: 'Arrivé sur place' },
  { value: 'patient_a_bord', label: 'Patient à bord' },
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
// Borne de fetch journalière (le filtre date par défaut = aujourd'hui → set
// borné). On pagine ensuite côté client par plage de PAGE_SIZE (DEC-132).
// Source de vérité UNIQUE partagée avec le schéma de l'action et les requêtes
// (évite le cas client > schéma qui vidait la liste en silence).
const FETCH_CAP = RIDES_LIST_FETCH_CAP;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RidesList(): JSX.Element {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  // Hotfix 04.7-bis : filtre date — défaut aujourd'hui pour focus régulatrice
  const [dateFilter, setDateFilter] = useState<string>(todayIso());
  // Lot 2/4 — filtre urgence, piloté par le preset « Urgentes ». Pas de sélecteur
  // dédié (parcimonie) : filtrage client (urgente + immediate) sur les données
  // déjà chargées. `all` = pas de filtre d'urgence.
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent'>('all');
  // Tri client (Lot 1/4) : colonnes heure / statut / mode / urgence. Défaut =
  // créneau décroissant, identique à l'ordre serveur (aucun saut au 1er rendu).
  const [sort, setSort] = useState<{ column: string; dir: 'asc' | 'desc' }>({
    column: 'heure',
    dir: 'desc',
  });
  // Pagination par page (DEC-132) — remplace l'offset cumulatif « Voir plus ».
  const [page, setPage] = useState<number>(0);
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [assignRideId, setAssignRideId] = useState<string | null>(null);
  // Lot 4/4 — sélection multiple (par id de course, survit à la pagination et au
  // tri). Réinitialisée quand l'ensemble filtré change (voir effet plus bas).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dq = useDeferredValue(q);
  const orchestrator = useRideOrchestrator();
  // Lot 3/4 — densité de tableau persistée (préférence UI, pattern useHighContrast).
  const { density, toggle: toggleDensity } = useTableDensity();

  const resetPage = () => setPage(0);
  // Revenir page 1 quand la recherche change (cohérence de plage).
  useEffect(() => {
    setPage(0);
  }, [dq]);

  // Sélection cohérente avec le résultat affiché : on la vide quand l'ensemble
  // FILTRÉ change (statut / mode / date / urgence / recherche). La pagination et
  // le tri ne la vident pas (même ensemble) → la sélection survit à la pagination.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, modeFilter, dateFilter, urgencyFilter, dq]);

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllRowsSelection = (keys: string[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (selectAll) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Lot 2/4 — filtres rapides : raccourcis qui POSITIONNENT les états de filtre
  // existants (pas un canal parallèle). L'état « actif » est DÉRIVÉ des filtres
  // courants → modifier un filtre à la main désactive automatiquement le preset,
  // et les sélecteurs reflètent toujours ce qui est filtré. Toggle : recliquer un
  // preset actif remet sa dimension au défaut ; « Toutes » réinitialise tout.
  const today = todayIso();
  const isPresetToutes =
    statusFilter === 'all' && modeFilter === 'all' && urgencyFilter === 'all' && !dateFilter;
  const isPresetNonAssignees = statusFilter === 'validee';
  const isPresetUrgentes = urgencyFilter === 'urgent';
  const isPresetAujourdhui = dateFilter === today;

  const applyToutes = () => {
    setStatusFilter('all');
    setModeFilter('all');
    setUrgencyFilter('all');
    setDateFilter('');
    resetPage();
  };
  const toggleNonAssignees = () => {
    setStatusFilter(isPresetNonAssignees ? 'all' : 'validee');
    resetPage();
  };
  const toggleUrgentes = () => {
    setUrgencyFilter(isPresetUrgentes ? 'all' : 'urgent');
    resetPage();
  };
  const toggleAujourdhui = () => {
    setDateFilter(isPresetAujourdhui ? '' : today);
    resetPage();
  };

  const { data, isPending } = useQuery({
    queryKey: ['rides', { status: statusFilter, mode: modeFilter, date: dateFilter }],
    queryFn: () =>
      listRidesEnrichedAction({
        status: statusFilter === 'all' ? undefined : (statusFilter as RideStatus),
        transport_mode: modeFilter === 'all' ? undefined : (modeFilter as RideTransportMode),
        date: dateFilter || undefined,
        limit: FETCH_CAP,
        offset: 0,
      }),
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  const rides = (data ?? []) as RideRowEnriched[];
  const filtered = rides.filter((r) => {
    // Preset « Urgentes » (client) : urgente + immediate (par opposition à programmée).
    if (urgencyFilter === 'urgent' && r.urgency !== 'urgente' && r.urgency !== 'immediate') {
      return false;
    }
    if (!dq) return true;
    const lower = dq.toLowerCase();
    return (
      r.pickup_address.toLowerCase().includes(lower) ||
      r.dropoff_address.toLowerCase().includes(lower) ||
      `${r.patient?.nom ?? ''} ${r.patient?.prenom ?? ''}`.toLowerCase().includes(lower)
    );
  });
  // Tri de l'ENSEMBLE filtré, PUIS pagination : l'ordre reste cohérent d'une
  // page à l'autre. Le tri s'applique aux données déjà chargées (client).
  const sorted = sortRides(filtered, sort.column, sort.dir);
  const total = sorted.length;
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-16">
      {/* Lot 2/4 — filtres rapides : puces au-dessus de la liste, en un clic. */}
      <div className="flex flex-wrap items-center gap-8" role="group" aria-label="Filtres rapides">
        <QuickFilterChip active={isPresetToutes} onClick={applyToutes}>
          Toutes
        </QuickFilterChip>
        <QuickFilterChip active={isPresetNonAssignees} onClick={toggleNonAssignees}>
          Non assignées
        </QuickFilterChip>
        <QuickFilterChip active={isPresetUrgentes} onClick={toggleUrgentes}>
          Urgentes
        </QuickFilterChip>
        <QuickFilterChip active={isPresetAujourdhui} onClick={toggleAujourdhui}>
          Aujourd&apos;hui
        </QuickFilterChip>
      </div>
      <ListToolbar
        search={
          <Input
            aria-label="Rechercher dans les adresses ou patients"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
        filters={
          <>
            <DatePickerFieldFr
              value={dateFilter}
              onChange={(v) => {
                setDateFilter(v);
                resetPage();
              }}
              ariaLabel="Filtre date des courses"
              className="w-[160px]"
            />
            {dateFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFilter('');
                  resetPage();
                }}
                aria-label="Effacer le filtre date"
              >
                Effacer
              </Button>
            )}
            <Select
              ariaLabel="Filtre statut"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                resetPage();
              }}
              items={[...STATUS_FILTERS]}
              triggerClassName="min-w-[180px]"
            />
            <Select
              ariaLabel="Filtre mode de transport"
              value={modeFilter}
              onChange={(v) => {
                setModeFilter(v);
                resetPage();
              }}
              items={[...MODE_FILTERS]}
              triggerClassName="min-w-[180px]"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-8">
            {/* Lot 3/4 — bascule densité (compact ↔ normal), préférence persistée.
                État actif perceptible au-delà de la couleur : aria-pressed + fond
                plein vs contour + libellé. */}
            <Button
              type="button"
              size="sm"
              variant={density === 'compact' ? 'secondary' : 'outline'}
              aria-pressed={density === 'compact'}
              onClick={toggleDensity}
              aria-label={
                density === 'compact'
                  ? 'Densité compacte activée — cliquer pour la densité normale'
                  : 'Activer la densité compacte'
              }
              className="gap-4"
            >
              <Rows3 className="h-16 w-16" aria-hidden />
              <span className="hidden sm:inline">Compact</span>
            </Button>
            <ExportCsvButton
              dateFilter={dateFilter}
              statusFilter={statusFilter}
              modeFilter={modeFilter}
            />
          </div>
        }
      />

      {/* Lot 4/4 — barre d'actions groupées, visible seulement si sélection. */}
      <CoursesBulkActions selectedIds={[...selectedIds]} onClear={clearSelection} />

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
          description="Rien de prévu pour cette date. Créez une course pour démarrer la journée."
          action={{
            onClick: () => orchestrator.dispatch({ type: 'OPEN_NEW' }),
            label: 'Nouvelle course',
            icon: Plus,
          }}
        />
      )}

      {!isPending && total > 0 && (
        <ListMeta>
          {total} course{total > 1 ? 's' : ''}
        </ListMeta>
      )}

      {!isPending && total > 0 && (
        <>
          <DataTable<RideRowEnriched>
            columns={RIDE_COLUMNS((rid) => setAssignRideId(rid))}
            rows={paged}
            // DEC-033 : clé inclut `status` pour re-mount au changement
            // (sans ça, « Assigner » reste actif après affectation —
            // précédent Phase 03.2 #4).
            rowKey={(r) => `${r.id}-${r.status}`}
            ariaLabel="Liste des courses"
            density={density}
            // Hauteur bornée : le corps défile, les en-têtes restent figés, la
            // barre d'outils au-dessus et la pagination en dessous restent visibles.
            maxHeight="60vh"
            // `group` sur chaque ligne : support des actions révélées au survol /
            // focus (cf. bouton « Assigner »).
            rowClassName={() => 'group'}
            onRowClick={(r) => setOpenRideId(r.id)}
            // Sélection multiple (Lot 4/4) — clé métier = id course (stable après
            // mutation), distincte de la clé React (id-statut).
            selectable
            selectionKey={(r) => r.id}
            selectedKeys={selectedIds}
            onToggleRow={toggleRowSelection}
            onToggleAllRows={toggleAllRowsSelection}
            // Tri client réutilisant le mécanisme du tableau (en-tête bouton +
            // flèche + aria-sort). Retour page 1 au changement, comme les filtres.
            sort={{
              column: sort.column,
              dir: sort.dir,
              onSortChange: (column, dir) => {
                setSort({ column, dir });
                resetPage();
              },
            }}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
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
 * Puce de filtre rapide (Lot 2/4) — bouton toggle. État sélectionné perceptible
 * au-delà de la couleur : `aria-pressed` (lecteur d'écran), fond plein vs contour
 * (variante), et coche visible quand actif. Activable au clavier (bouton natif).
 */
function QuickFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
      className="gap-4"
    >
      {active && <Check className="h-12 w-12" aria-hidden />}
      {children}
    </Button>
  );
}

// Ordres métier des colonnes triables par énumération (pas alphabétiques) :
// le tri « regroupe » selon un ordre utile à la régulation (cycle de vie de la
// course, niveau d'urgence). Une valeur hors énumération → `null` (fin de tri).
const STATUS_ORDER: Record<string, number> = {
  validee: 0,
  assignee: 1,
  en_cours: 2,
  terminee: 3,
  annulee_regulateur: 4,
  annulee_patient: 5,
  annulee_chauffeur: 6,
  annulee_meteo: 7,
  brouillon: 8,
};
const URGENCY_ORDER: Record<string, number> = { programmee: 0, urgente: 1, immediate: 2 };
const MODE_ORDER: Record<string, number> = {
  taxi_conventionne: 0,
  tpmr: 1,
  vsl: 2,
  ambulance: 3,
};

/** Clé de comparaison d'une course pour une colonne triable ; `null` = manquant. */
function sortKey(ride: RideRowEnriched, column: string): number | string | null {
  switch (column) {
    case 'heure':
      return ride.scheduled_at || null;
    case 'statut':
      return STATUS_ORDER[ride.status] ?? null;
    case 'mode':
      return MODE_ORDER[ride.transport_mode] ?? null;
    case 'urgence':
      return URGENCY_ORDER[ride.urgency] ?? null;
    default:
      return null;
  }
}

/**
 * Tri client de l'ensemble filtré. Les valeurs manquantes (`null`) sont toujours
 * ordonnées EN FIN, quel que soit le sens. `Array.sort` est stable → les égalités
 * conservent leur ordre relatif (créneau serveur).
 */
function sortRides(
  rides: RideRowEnriched[],
  column: string,
  dir: 'asc' | 'desc',
): RideRowEnriched[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rides].sort((a, b) => {
    const av = sortKey(a, column);
    const bv = sortKey(b, column);
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // manquant en fin
    if (bv === null) return -1;
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
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
      sortable: true,
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
      sortable: true,
      cell: (ride) => <ModeBadge mode={ride.transport_mode} />,
    },
    {
      key: 'urgence',
      header: 'Urgence',
      sortable: true,
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
          // Action de ligne RÉVÉLÉE au survol de la ligne (`group-hover`) ET au
          // focus clavier (`group-focus-within` sur la ligne focusable +
          // `focus-visible` sur le bouton lui-même) — jamais survol-souris seul.
          // Le bouton reste dans le flux (opacity, pas display:none) donc
          // focusable au clavier. Logique inchangée : stopPropagation évite
          // d'ouvrir le drawer, onAssign court-circuite vers l'affectation.
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(ride.id);
            }}
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
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
      sortable: true,
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
