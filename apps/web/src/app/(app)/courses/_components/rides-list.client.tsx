'use client';

import { type ReactNode, useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, Check, FilterX, Plus, Rows3, X } from 'lucide-react';
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
import { useTablePageSize, PAGE_SIZE_OPTIONS } from '@/lib/use-table-page-size.client';
import { usePersistedCoursesFilters } from '@/lib/use-courses-filters.client';

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
// Borne de fetch journalière (le filtre date par défaut = aujourd'hui → set
// borné). On pagine ensuite côté client par plage réglable (voir useTablePageSize).
// Source de vérité UNIQUE partagée avec le schéma de l'action et les requêtes
// (évite le cas client > schéma qui vidait la liste en silence).
const FETCH_CAP = RIDES_LIST_FETCH_CAP;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RidesList(): JSX.Element {
  // Amélioration C — filtres PERSISTÉS entre visites (statut / mode / urgence /
  // recherche), même patron que la densité. La DATE n'est PAS persistée (reste
  // `useState`, défaut aujourd'hui). Alias vers les noms existants → aucun autre
  // changement dans le composant (presets, chips, query, reset inchangés).
  const {
    search: q,
    setSearch: setQ,
    status: statusFilter,
    setStatus: setStatusFilter,
    mode: modeFilter,
    setMode: setModeFilter,
    urgency: urgencyFilter,
    setUrgency: setUrgencyFilter,
  } = usePersistedCoursesFilters();
  // Hotfix 04.7-bis : filtre date — défaut aujourd'hui pour focus régulatrice.
  // VOLONTAIREMENT non persistée (repart sur aujourd'hui à chaque ouverture).
  const [dateFilter, setDateFilter] = useState<string>(todayIso());
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
  // Taille de page réglable + persistée (défaut 25, options 10/25/50/100).
  const { pageSize, setPageSize } = useTablePageSize();

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

  // Filtres actifs par rapport à la VUE PAR DÉFAUT (aujourd'hui, tous statuts /
  // modes, sans urgence ni recherche). Réutilise les mêmes dimensions que les
  // presets — pas de détection dupliquée. La date « défaut » est AUJOURD'HUI
  // (vue d'accueil régulatrice), cohérent avec le preset « Aujourd'hui ».
  const hasActiveFilters =
    statusFilter !== 'all' ||
    modeFilter !== 'all' ||
    urgencyFilter !== 'all' ||
    dateFilter !== today ||
    dq.trim() !== '';

  // Réinitialisation globale : remet chaque dimension au défaut (mêmes setters
  // que les presets), date = aujourd'hui, recherche vidée, retour page 1.
  const resetFilters = () => {
    setStatusFilter('all');
    setModeFilter('all');
    setUrgencyFilter('all');
    setDateFilter(today);
    setQ('');
    resetPage();
  };

  // Puces de filtres ACTIFS (une par dimension au-delà du défaut). Réutilise les
  // libellés lisibles (STATUS_FILTERS / MODE_FILTERS) et les setters par
  // dimension — pas de second système. Le × remet CETTE dimension au défaut
  // (page 1), sans toucher aux autres. Date : puce seulement si ≠ aujourd'hui
  // (défaut) ; le retrait ramène à aujourd'hui (cohérent avec resetFilters).
  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (statusFilter !== 'all') {
    activeFilterChips.push({
      key: 'status',
      label: `Statut : ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? statusFilter}`,
      onRemove: () => {
        setStatusFilter('all');
        resetPage();
      },
    });
  }
  if (modeFilter !== 'all') {
    activeFilterChips.push({
      key: 'mode',
      label: `Mode : ${MODE_FILTERS.find((f) => f.value === modeFilter)?.label ?? modeFilter}`,
      onRemove: () => {
        setModeFilter('all');
        resetPage();
      },
    });
  }
  if (urgencyFilter === 'urgent') {
    activeFilterChips.push({
      key: 'urgency',
      label: 'Urgence : urgente / immédiate',
      onRemove: () => {
        setUrgencyFilter('all');
        resetPage();
      },
    });
  }
  if (dq.trim() !== '') {
    activeFilterChips.push({
      key: 'search',
      label: `Recherche : "${dq.trim()}"`,
      onRemove: () => {
        setQ('');
        resetPage();
      },
    });
  }
  if (dateFilter !== today) {
    activeFilterChips.push({
      key: 'date',
      label: dateFilter
        ? `Date : ${dateFilter.slice(0, 10).split('-').reverse().join('/')}`
        : 'Date : toutes',
      onRemove: () => {
        setDateFilter(today);
        resetPage();
      },
    });
  }

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
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  // Récap par statut sur l'ENSEMBLE filtré (pas la page) — se met à jour avec les
  // filtres / la recherche. Colonnes du tableau extraites pour le colSpan du pied.
  const statusRecap = buildStatusRecap(filtered);
  const columns = RIDE_COLUMNS((rid) => setAssignRideId(rid));

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
            {/* Réinitialiser TOUS les filtres (visible seulement si un filtre est
                actif), cohérent avec le « Effacer » de la date. */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-4"
              >
                <FilterX className="h-12 w-12" aria-hidden />
                Réinitialiser les filtres
              </Button>
            )}
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

      {/* Puces de filtres actifs (retirables) — rien si aucun filtre actif. */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-8" role="group" aria-label="Filtres actifs">
          {activeFilterChips.map((chip) => (
            <ActiveFilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      {/* Lot 4/4 — barre d'actions groupées, visible seulement si sélection. */}
      <CoursesBulkActions selectedIds={[...selectedIds]} onClear={clearSelection} />

      {isPending && (
        <div className="space-y-8" aria-label="Chargement des courses">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* État vide CONTEXTUEL : des filtres masquent-ils des résultats, ou la vue
          par défaut est-elle réellement vide ? Deux messages / deux actions. */}
      {!isPending && filtered.length === 0 && hasActiveFilters && (
        <EmptyState
          icon={FilterX}
          title="Aucune course ne correspond aux filtres"
          description="Des filtres actifs masquent peut-être des courses. Réinitialisez-les pour revoir toutes les courses."
          action={{
            onClick: resetFilters,
            label: 'Réinitialiser les filtres',
            icon: FilterX,
          }}
        />
      )}
      {!isPending && filtered.length === 0 && !hasActiveFilters && (
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
            columns={columns}
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
            // Récap par statut (ensemble filtré) via la prop `footer` existante.
            // colSpan = colonnes + 1 (colonne de sélection).
            footer={
              statusRecap.length > 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="text-muted-foreground px-12 py-8 text-xs tabular-nums"
                  >
                    {statusRecap.map((e) => `${e.count} ${e.label}`).join(' · ')}
                  </td>
                </tr>
              ) : undefined
            }
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            // Taille de page réglable : recalcule la pagination et revient page 1.
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          />
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

/**
 * Puce de FILTRE ACTIF (retirable) — libellé lisible + bouton × qui remet la
 * dimension au défaut. Le × est un contrôle clavier avec un libellé explicite ;
 * l'état est perceptible au-delà de la couleur (texte + icône ×).
 */
function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}): JSX.Element {
  return (
    <span className="border-border bg-muted/40 inline-flex items-center gap-4 rounded-full border py-2 pl-8 pr-2 text-xs">
      <span className="text-foreground">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer le filtre — ${label}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-16 w-16 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2"
      >
        <X className="h-12 w-12" aria-hidden />
      </button>
    </span>
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
 * Libellé de statut pour le récap de pied — réutilise la source canonique de
 * l'écran (`STATUS_FILTERS` : ordre + regroupement des annulées sous « Annulées »).
 * Aucun libellé réinventé ; repli sur le statut brut si absent (jamais attendu).
 */
function statusRecapLabel(status: string): string {
  if (status.startsWith('annulee')) return 'Annulées';
  return STATUS_FILTERS.find((f) => f.value === status)?.label ?? status;
}

/**
 * Répartition par statut sur l'ensemble filtré, dans l'ordre de `STATUS_FILTERS`,
 * statuts PRÉSENTS uniquement (aucune entrée à 0).
 */
function buildStatusRecap(rides: RideRowEnriched[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rides) {
    const label = statusRecapLabel(r.status);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return STATUS_FILTERS.filter((f) => f.value !== 'all')
    .map((f) => f.label)
    .filter((label) => counts.has(label))
    .map((label) => ({ label, count: counts.get(label) ?? 0 }));
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
