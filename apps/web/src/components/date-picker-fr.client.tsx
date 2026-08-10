'use client';

import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import { cn } from '@/lib/utils';

/**
 * Sélecteur de date à CALENDRIER en popup (locale française, format JJ/MM/AAAA).
 *
 * Réutilise react-datepicker (déjà en dépendance, cf. `BirthDateField` du
 * formulaire patient) — pas de nouvelle bibliothèque. Cliquer/focus le champ
 * ouvre le calendrier ; sélectionner un jour ferme le popup et émet la valeur.
 *
 * Contrat de données identique à `DateFieldFr` : la valeur exposée
 * (`value` / `onChange`) reste ISO `AAAA-MM-JJ` (chaîne vide = pas de date).
 * La conversion affichage (JJ/MM/AAAA) ↔ ISO est interne — la clé de cache et
 * la requête cliente restent inchangées.
 */

registerLocale('fr', fr);

const ISO_FMT = 'yyyy-MM-dd';

function isoToDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  try {
    const d = parse(iso, ISO_FMT, new Date());
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

interface DatePickerFieldFrProps {
  id?: string;
  /** Valeur ISO `AAAA-MM-JJ` (chaîne vide = aucune date sélectionnée). */
  value?: string;
  /** Émet la valeur ISO `AAAA-MM-JJ` (chaîne vide si effacée). */
  onChange?: (iso: string) => void;
  ariaLabel?: string;
  /** Classe portée par le conteneur (largeur/alignement dans la barre de filtres). */
  className?: string;
}

export function DatePickerFieldFr({
  id,
  value,
  onChange,
  ariaLabel,
  className,
}: DatePickerFieldFrProps): JSX.Element {
  const selected = isoToDate(value);
  return (
    <div className={cn('relative', className)}>
      <DatePicker
        id={id}
        selected={selected}
        onChange={(d) => onChange?.(d ? format(d, ISO_FMT) : '')}
        dateFormat="dd/MM/yyyy"
        placeholderText="jj/mm/aaaa"
        locale="fr"
        showYearDropdown
        dropdownMode="select"
        aria-label={ariaLabel}
        wrapperClassName="w-full"
        className={cn(
          'border-input bg-background h-10 w-full rounded-md border px-12 pr-32 text-sm tabular-nums',
          'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        )}
        autoComplete="off"
      />
      <CalendarIcon
        className="text-muted-foreground pointer-events-none absolute right-12 top-1/2 h-16 w-16 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}
