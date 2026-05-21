'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { geocodeBanSearch, type BanSuggestion } from '@/lib/geocoding/ban';

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

// Re-export rétro-compat : patient-address-field importe BanSuggestion
// depuis ce fichier (wrapper Phase 04.7-bis). Le type vient désormais
// du helper centralisé @/lib/geocoding/ban (Phase 04.9-quater #120).
export type { BanSuggestion };

const MIN_QUERY_LENGTH = 3;
// Limite remontée à 10 (vs 8 du picker mixte) : 974 a beaucoup
// d'homonymies entre communes (ex : « Rue de la Paix » présent à
// Saint-Denis, Saint-Pierre, Le Tampon), 10 résultats permettent à la
// régulatrice de discriminer sans scroll.
const BAN_LIMIT = 10;
// Debounce 200 ms : équilibre entre fluidité (saisie rapide) et coût
// réseau. Géoplateforme IGN est gratuite mais sa latence peut atteindre
// 800 ms à l'heure de pointe — moins on hit, plus la liste de résultats
// est stable.
const DEBOUNCE_MS = 200;

async function fetchBanSuggestions(q: string): Promise<BanSuggestion[]> {
  if (q.trim().length < MIN_QUERY_LENGTH) return [];
  return geocodeBanSearch(q, { limit: BAN_LIMIT });
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
  /**
   * Callback optionnel appelé en plus de `onChange` quand l'utilisateur
   * sélectionne une suggestion BAN. Remonte la suggestion complète
   * (postcode + city + lat + lng) pour permettre au parent de pré-remplir
   * d'autres champs liés (code postal, ville). Pas appelé en mode saisie
   * libre (D-ADDR-04 fallback).
   */
  onSelect?: (suggestion: BanSuggestion) => void;
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
  onSelect,
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
      toast.warning("Suggestions d'adresse indisponibles, saisie libre acceptée.");
    }
  }, [results.isError]);

  // Mode pill : suggestion sélectionnée OU adresse préremplis (édition)
  if (picked && value.length > 0) {
    return (
      <div className="space-y-8">
        <Label>{label}</Label>
        <div
          className={cn(
            'border-input bg-muted/30 flex items-center justify-between gap-12 rounded-md border px-12 py-12',
            error && 'border-destructive',
          )}
        >
          <div className="flex min-w-0 items-center gap-12">
            <MapPin className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
            <span className="truncate font-medium">{value}</span>
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
          <p className="text-destructive text-xs" role="alert">
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
          className="text-muted-foreground pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
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
          className={cn('pl-32', error && 'border-destructive focus-visible:ring-destructive')}
        />
      </div>

      {value.trim().length > 0 && value.trim().length < MIN_QUERY_LENGTH && (
        <p className="text-muted-foreground text-xs">
          Tapez au moins {MIN_QUERY_LENGTH} caractères pour rechercher.
        </p>
      )}

      {suggestions.length > 0 && (
        <ul
          className="divide-border border-border max-h-[200px] divide-y overflow-y-auto rounded-md border"
          aria-label="Suggestions d'adresses"
        >
          {suggestions.map((s) => (
            <li key={`${s.citycode}-${s.label}`}>
              <button
                type="button"
                onClick={() => {
                  setPicked(true);
                  onChange(s.label);
                  onSelect?.(s);
                  onBlur?.();
                }}
                className="hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-12 px-12 py-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <MapPin className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.label}</div>
                  <div className="text-muted-foreground truncate text-xs">
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
          <p className="text-muted-foreground text-xs">
            Aucune adresse 974 ne correspond à « {value.trim()} ». La saisie libre est conservée.
          </p>
        )}

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
