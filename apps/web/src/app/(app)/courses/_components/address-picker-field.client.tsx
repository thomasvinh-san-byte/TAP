'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Sélecteur d'adresse — autocomplétion via Base Adresse Nationale gouv.fr
 * (api-adresse.data.gouv.fr, gratuit, illimité, couvre 974 — Phase 03.2.7,
 * D-ADDR-01..06).
 *
 * Pattern UX aligné sur PatientPickerField (pill + bouton Changer) :
 *   - Mode pill : une suggestion BAN a été sélectionnée OU `value` initial
 *     non vide (édition d'une course existante).
 *   - Mode recherche : input avec icône MapPin + liste de suggestions
 *     filtrées sur postcode commençant par 974 + score >= 0.4.
 *
 * Filet de sécurité (D-ADDR-04 fallback saisie libre) :
 *   - Si l'utilisateur tape une adresse hors BAN (lieu-dit, exploitation
 *     agricole), pas de suggestion match. Le texte brut reste dans l'input,
 *     onChange parent est propagé à chaque keystroke. À la perte de focus,
 *     la valeur est conservée comme label sans coords.
 *
 * Erreurs réseau (D-ADDR-05) :
 *   - Toast Sonner discret si la BAN est indisponible. PAS de blocage modal.
 *
 * V1 : seul le label est remonté au parent (pickup_address / dropoff_address
 * string). Les détails postcode/city/citycode/lat/lng sont disponibles dans
 * la suggestion mais non persistés (D-ADDR-06 : migration BDD reportée
 * Phase 4 CGSS).
 */

interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    postcode?: string;
    city?: string;
    citycode?: string;
    score?: number;
  };
}

interface BanResponse {
  features: BanFeature[];
}

interface BanSuggestion {
  label: string;
  postcode: string;
  city: string;
  citycode: string;
  lat: number;
  lng: number;
  score: number;
}

const BAN_REUNION_LAT = -21.115;
const BAN_REUNION_LON = 55.536;
const MIN_QUERY_LENGTH = 3;
// Score plancher BAN — calibration Phase 04.5 (UAT Réunion : 0.4 acceptait
// trop d'adresses métropole avec préfixe similaire). 0.5 = compromis
// précision / rappel sur les noms de rue 974.
const MIN_SCORE = 0.5;
// Limite remontée à 10 (vs 8) : 974 a beaucoup d'homonymies entre communes
// (ex : « Rue de la Paix » présent à Saint-Denis, Saint-Pierre, Le Tampon),
// 10 résultats permettent à la régulatrice de discriminer sans scroll.
const BAN_LIMIT = 10;
const REUNION_POSTCODE_PREFIX = '974';
// Debounce 200 ms : équilibre entre fluidité (saisie rapide) et coût réseau.
// L'API BAN gouv.fr est gratuite mais sa latence peut atteindre 800 ms à
// l'heure de pointe — moins on hit, plus la liste de résultats est stable.
const DEBOUNCE_MS = 200;

async function fetchBanSuggestions(q: string): Promise<BanSuggestion[]> {
  if (q.trim().length < MIN_QUERY_LENGTH) return [];
  const url = new URL('https://api-adresse.data.gouv.fr/search/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(BAN_LIMIT));
  url.searchParams.set('autocomplete', '1');
  url.searchParams.set('lat', String(BAN_REUNION_LAT));
  url.searchParams.set('lon', String(BAN_REUNION_LON));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('BAN unavailable');
  const json = (await res.json()) as BanResponse;
  return json.features
    .filter(
      (f) =>
        f.properties.postcode?.startsWith(REUNION_POSTCODE_PREFIX) ?? false,
    )
    .filter((f) => (f.properties.score ?? 0) >= MIN_SCORE)
    .map((f) => ({
      label: f.properties.label,
      postcode: f.properties.postcode ?? '',
      city: f.properties.city ?? '',
      citycode: f.properties.citycode ?? '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      score: f.properties.score ?? 0,
    }));
}

/**
 * Debounce simple sur une valeur React : ne renvoie la nouvelle valeur que
 * lorsque l'utilisateur n'a pas tapé depuis `delay` ms. Réduit la pression
 * sur l'API BAN gouv.fr et stabilise la liste de résultats pendant la
 * frappe.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (label: string) => void;
  onBlur?: () => void;
  tabIndex?: number;
  error?: string | null;
}

export function AddressPickerField({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  onBlur,
  tabIndex,
  error,
}: Props): JSX.Element {
  // `picked` = une suggestion BAN a été sélectionnée OU édition existante
  // avec une adresse déjà posée au mount. L'utilisateur peut revenir en
  // mode recherche via le bouton Changer.
  const [picked, setPicked] = useState<boolean>(value.length > 0);
  const debouncedQuery = useDebouncedValue(value, DEBOUNCE_MS);

  const results = useQuery({
    queryKey: ['ban-search', debouncedQuery],
    queryFn: () => fetchBanSuggestions(debouncedQuery),
    enabled: !picked && debouncedQuery.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 10_000,
    retry: false,
  });

  useEffect(() => {
    if (results.isError) {
      toast.warning(
        "Suggestions d'adresse indisponibles, saisie libre acceptée.",
      );
    }
  }, [results.isError]);

  // Mode pill : suggestion sélectionnée OU adresse préremplis (édition)
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
          <div className="flex items-center gap-12 min-w-0">
            <MapPin
              className="h-16 w-16 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="font-medium truncate">{value}</span>
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
            aria-label={`Changer l'adresse pour ${label}`}
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

  // Mode recherche : input + suggestions BAN
  const suggestions = results.data ?? [];
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
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="Rechercher (n° rue, ville…)"
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
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

      {suggestions.length > 0 && (
        <ul
          className="max-h-[200px] overflow-y-auto divide-y divide-border rounded-md border border-border"
          aria-label="Suggestions d'adresses"
        >
          {suggestions.map((s) => (
            <li key={`${s.citycode}-${s.label}`}>
              <button
                type="button"
                onClick={() => {
                  setPicked(true);
                  onChange(s.label);
                  onBlur?.();
                }}
                className="flex w-full items-center gap-12 px-12 py-12 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <MapPin
                  className="h-16 w-16 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.postcode} {s.city}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.trim().length >= MIN_QUERY_LENGTH &&
        !results.isPending &&
        !results.isError &&
        suggestions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Aucune adresse 974 ne correspond à « {value.trim()} ». La saisie
            libre est conservée.
          </p>
        )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
