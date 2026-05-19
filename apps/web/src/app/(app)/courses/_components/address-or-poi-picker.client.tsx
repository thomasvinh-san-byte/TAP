'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building, Hospital, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  listPoisMetierAction,
  type PoiMetierMin,
} from '@/lib/pois/actions';
import { geocodeBanSearch } from '@/lib/geocoding/ban';

/**
 * AddressOrPOIPicker — Phase 04.5 Wave C.2 (PLAN-3 T3.2).
 *
 * Sélecteur d'adresse combinant POI métier (lieux fréquents de
 * l'organisation : CHU, cliniques, EHPAD, dialyse, cabinets) ET
 * fallback BAN gouv.fr pour adresses libres.
 *
 * UI :
 *   - Mode pill : valeur déjà posée → MapPin/Hospital + texte + Changer
 *   - Mode recherche : Input avec 2 sections suggestion
 *     • POI matchés (en premier, avec icône type + ville)
 *     • Adresses BAN (en second, après séparateur)
 *
 * A11y (UI-SPEC R2) :
 *   - role="listbox" + aria-activedescendant sur l'input
 *   - Items en role="option" avec id stable
 *   - Navigation ↑↓ Enter Esc
 *   - aria-label clarifie le rôle (« Rechercher un lieu ou une adresse »)
 *
 * Comportement :
 *   - Debounce 200ms sur la requête BAN
 *   - POI : filtrage côté client (normalisation + includes)
 *   - Sélection POI : remonte au parent label + détails (notes_acces…)
 *   - Sélection BAN : remonte label uniquement
 *
 * Refs : PLAN-3 T3.2, D-09, DEC-035, UI-SPEC Surface A.
 */

// BanSuggestion étendue (kind/id) reste locale car spécifique au mixage
// BAN+POI de ce picker. Le shape sous-jacent (label/postcode/city/...)
// est mappé depuis le BanSuggestion du helper @/lib/geocoding/ban
// (Phase 04.9-quater #120).
interface BanSuggestion {
  kind: 'ban';
  id: string;
  label: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
  citycode: string;
}

interface PoiSuggestion {
  kind: 'poi';
  id: string;
  poi: PoiMetierMin;
}

type Suggestion = PoiSuggestion | BanSuggestion;

const MIN_QUERY_LENGTH = 2; // POI peuvent matcher dès 2 chars (« HG », « CHU »)
const BAN_MIN_QUERY_LENGTH = 3;
const BAN_LIMIT = 8;
const DEBOUNCE_MS = 200;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

async function fetchBanSuggestions(q: string): Promise<BanSuggestion[]> {
  if (q.trim().length < BAN_MIN_QUERY_LENGTH) return [];
  const results = await geocodeBanSearch(q, { limit: BAN_LIMIT });
  // Mapping vers la variante locale avec kind + id (mixage POI).
  return results.map((r, i) => ({
    kind: 'ban' as const,
    id: `ban-${r.citycode || 'x'}-${i}`,
    label: r.label,
    postcode: r.postcode,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    citycode: r.citycode,
  }));
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PoiIcon({ type }: { type: string }): JSX.Element {
  if (type === 'hopital' || type === 'clinique') {
    return <Hospital className="h-16 w-16 shrink-0 text-primary" aria-hidden />;
  }
  if (type === 'ehpad' || type === 'foyer_medicalise') {
    return <Building className="h-16 w-16 shrink-0 text-primary" aria-hidden />;
  }
  return <MapPin className="h-16 w-16 shrink-0 text-primary" aria-hidden />;
}

export interface AddressOrPOIPickerSelection {
  label: string;
  postcode?: string;
  city?: string;
  notesAcces?: string | null;
  poiId?: string;
  /** Coordonnées WGS84 — propagées au parent pour persistance rides (DEC-044). */
  lat?: number;
  lng?: number;
  citycode?: string;
}

interface Props {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (label: string) => void;
  onSelect?: (selection: AddressOrPOIPickerSelection) => void;
  onBlur?: () => void;
  tabIndex?: number;
  error?: string | null;
}

export function AddressOrPOIPicker({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  onSelect,
  onBlur,
  tabIndex,
  error,
}: Props): JSX.Element {
  const [picked, setPicked] = React.useState<boolean>(value.length > 0);
  const [highlightIdx, setHighlightIdx] = React.useState(0);
  const debouncedQuery = useDebouncedValue(value, DEBOUNCE_MS);
  const listboxId = `${id}-listbox`;

  // POI : chargés une fois pour l'organisation, filtrés en local.
  const poisQuery = useQuery({
    queryKey: ['pois-metier'],
    queryFn: () => listPoisMetierAction(),
    staleTime: 60_000 * 5,
    retry: false,
  });
  const allPois = poisQuery.data ?? [];

  const banResults = useQuery({
    queryKey: ['ban-search-poi', debouncedQuery],
    queryFn: () => fetchBanSuggestions(debouncedQuery),
    enabled:
      !picked && debouncedQuery.trim().length >= BAN_MIN_QUERY_LENGTH,
    staleTime: 10_000,
    retry: false,
  });

  React.useEffect(() => {
    if (banResults.isError) {
      toast.warning(
        "Suggestions d'adresse indisponibles, saisie libre acceptée.",
      );
    }
  }, [banResults.isError]);

  // Filtrage POI local (normalisation + includes sur nom_court + nom_long + adresse)
  const poiSuggestions = React.useMemo<PoiSuggestion[]>(() => {
    const q = value.trim();
    if (q.length < MIN_QUERY_LENGTH) return [];
    const nq = normalize(q);
    return allPois
      .filter((p) => {
        const hay = normalize(
          [p.nom_court, p.nom_long ?? '', p.adresse, p.ville].join(' '),
        );
        return hay.includes(nq);
      })
      .slice(0, 5)
      .map((p) => ({ kind: 'poi' as const, id: `poi-${p.id}`, poi: p }));
  }, [allPois, value]);

  const banSuggestions = banResults.data ?? [];
  const allSuggestions: Suggestion[] = [...poiSuggestions, ...banSuggestions];

  React.useEffect(() => {
    if (highlightIdx >= allSuggestions.length) setHighlightIdx(0);
  }, [allSuggestions.length, highlightIdx]);

  const select = React.useCallback(
    (s: Suggestion) => {
      if (s.kind === 'poi') {
        const labelText = `${s.poi.nom_court} — ${s.poi.adresse}, ${s.poi.code_postal} ${s.poi.ville}`;
        setPicked(true);
        onChange(labelText);
        onSelect?.({
          label: labelText,
          postcode: s.poi.code_postal,
          city: s.poi.ville,
          notesAcces: s.poi.notes_acces,
          poiId: s.poi.id,
          lat: s.poi.latitude ?? undefined,
          lng: s.poi.longitude ?? undefined,
          // POI : pas de citycode INSEE V1.5 (code_postal suffit)
        });
      } else {
        setPicked(true);
        onChange(s.label);
        onSelect?.({
          label: s.label,
          postcode: s.postcode,
          city: s.city,
          lat: s.lat,
          lng: s.lng,
          citycode: s.citycode || undefined,
        });
      }
      onBlur?.();
    },
    [onChange, onSelect, onBlur],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (picked) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, allSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const s = allSuggestions[highlightIdx];
      if (s) {
        e.preventDefault();
        select(s);
      }
    } else if (e.key === 'Escape') {
      onBlur?.();
    }
  };

  // Mode pill : adresse sélectionnée ou pré-remplie
  if (picked && value.length > 0) {
    return (
      <div className="space-y-8">
        <Label>{label}</Label>
        <div
          className={cn(
            'flex items-center justify-between gap-12 rounded-md border border-input bg-muted/30 px-12 py-12',
            error && 'border-destructive',
          )}
        >
          <div className="flex items-center gap-12 min-w-0 flex-1">
            <MapPin
              className="h-16 w-16 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span
              className="font-medium truncate"
              title={value}
            >
              {value}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked(false);
              onChange('');
              onBlur?.();
            }}
            aria-label={`Changer ${label}`}
            className="shrink-0 gap-8"
          >
            <X className="h-12 w-12" aria-hidden />
            Changer
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const activeId =
    !picked && allSuggestions[highlightIdx]
      ? allSuggestions[highlightIdx].id
      : undefined;

  return (
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 h-16 w-16 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setHighlightIdx(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // Délai pour permettre le clic sur une option
            setTimeout(() => onBlur?.(), 100);
          }}
          placeholder="Rechercher un lieu ou une adresse…"
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-controls={listboxId}
          aria-expanded={allSuggestions.length > 0}
          aria-activedescendant={activeId}
          role="combobox"
          autoComplete="off"
          tabIndex={tabIndex}
          className={cn(
            'pl-32',
            error && 'border-destructive focus-visible:ring-destructive',
          )}
        />
      </div>

      {value.trim().length > 0 && value.trim().length < MIN_QUERY_LENGTH && (
        <p className="text-xs text-muted-foreground">
          Tapez au moins {MIN_QUERY_LENGTH} caractères pour rechercher.
        </p>
      )}

      {allSuggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Suggestions"
          className="max-h-[280px] overflow-y-auto divide-y divide-border rounded-md border border-border"
        >
          {poiSuggestions.length > 0 && (
            <li className="px-12 py-6 text-xs font-medium uppercase tracking-wide text-muted-foreground bg-muted/40">
              Lieux fréquents
            </li>
          )}
          {poiSuggestions.map((s, idx) => {
            const realIdx = idx;
            const isActive = realIdx === highlightIdx;
            return (
              <li key={s.id}>
                <button
                  id={s.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => select(s)}
                  onMouseEnter={() => setHighlightIdx(realIdx)}
                  className={cn(
                    'flex w-full items-start gap-12 px-12 py-12 text-left transition-colors duration-150',
                    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive && 'bg-muted',
                  )}
                  style={{ minHeight: 56 }}
                >
                  <PoiIcon type={s.poi.type_poi} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.poi.nom_court}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.poi.adresse} · {s.poi.code_postal} {s.poi.ville}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {banSuggestions.length > 0 && (
            <li className="px-12 py-6 text-xs font-medium uppercase tracking-wide text-muted-foreground bg-muted/40">
              Adresses
            </li>
          )}
          {banSuggestions.map((s, idx) => {
            const realIdx = poiSuggestions.length + idx;
            const isActive = realIdx === highlightIdx;
            return (
              <li key={s.id}>
                <button
                  id={s.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => select(s)}
                  onMouseEnter={() => setHighlightIdx(realIdx)}
                  className={cn(
                    'flex w-full items-start gap-12 px-12 py-12 text-left transition-colors duration-150',
                    'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive && 'bg-muted',
                  )}
                  style={{ minHeight: 56 }}
                >
                  <MapPin
                    className="h-16 w-16 shrink-0 text-muted-foreground mt-2"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.label}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
