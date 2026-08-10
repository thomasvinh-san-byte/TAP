'use client';

import * as React from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { format, parse } from 'date-fns';
import { Calendar as CalendarIcon, Check, CircleDashed, X } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import {
  VILLES_974,
  cpDominantVille,
  isNirChecksumValid,
  isNirChecksumStrict,
  NIR_FORMAT_REGEX,
} from '@tap/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { cn } from '@/lib/utils';

registerLocale('fr', fr);

/**
 * Champs contrôlés du formulaire patient — Phase 04.5 Wave C.1.
 *
 * Pattern : chaque field garde un state contrôlé pour les masques + une
 * indication visuelle (clé NIR, ville auto), et émet la valeur canonique
 * via un `<input type="hidden" name="..." value="..." />` que la Server
 * Action recevra via FormData. L'utilisateur voit le masque, le serveur
 * voit la valeur brute conforme au schéma Zod (PR #80).
 *
 * Refs : PLAN-2 T2.2, DEC-036, UI-SPEC Surface B.
 */

const NIR_DISPLAY_FORMAT =
  /^([12]?)([0-9]{0,2})([0-9]{0,2})([0-9]{0,2}|2A|2B)?([0-9]{0,3})([0-9]{0,3})([0-9]{0,2})/i;

function formatNirDisplay(raw: string): string {
  const u = raw.replace(/\s+/g, '').toUpperCase().slice(0, 15);
  const m = NIR_DISPLAY_FORMAT.exec(u);
  if (!m) return u;
  return [m[1], m[2], m[3], m[4], m[5], m[6], m[7]].filter((p) => p && p.length > 0).join(' ');
}

function formatTelDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4)}`;
  if (d.length <= 8) {
    return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6)}`;
  }
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

const VILLES_ITEMS = VILLES_974.map((v) => ({ value: v, label: v }));

// =============================================================================
// BirthDateField — react-datepicker FR locale, format JJ/MM/AAAA, helper
// =============================================================================

interface BirthDateFieldProps {
  id?: string;
  name: string;
  defaultValue?: string; // AAAA-MM-JJ
  required?: boolean;
}

export function BirthDateField({
  id = 'date_naissance',
  name,
  defaultValue,
  required,
}: BirthDateFieldProps): JSX.Element {
  const initial = React.useMemo(() => {
    if (!defaultValue) return null;
    try {
      return parse(defaultValue, 'yyyy-MM-dd', new Date());
    } catch {
      return null;
    }
  }, [defaultValue]);

  const [date, setDate] = React.useState<Date | null>(initial);
  const iso = date ? format(date, 'yyyy-MM-dd') : '';

  // Migré sur le socle <Field> en mode contrôle enfant (LOT 2) : l'étiquette
  // (avec astérisque si `required`), l'aide et les liaisons a11y viennent du
  // socle ; le DatePicker et le champ caché canonique (valeur ISO transmise au
  // serveur) sont INCHANGÉS.
  return (
    <Field id={id} label="Date de naissance" required={required}>
      {(control) => (
        <>
          <div className="relative">
            <DatePicker
              id={control.id}
              selected={date}
              onChange={(d) => setDate(d)}
              dateFormat="dd/MM/yyyy"
              placeholderText="JJ/MM/AAAA"
              locale="fr"
              showYearDropdown
              dropdownMode="select"
              maxDate={new Date()}
              minDate={new Date('1895-01-01')}
              aria-label="Date de naissance"
              aria-describedby={control['aria-describedby']}
              aria-required={control['aria-required']}
              className={cn(
                'border-input bg-background h-10 w-full rounded-md border px-12 pr-32 text-sm',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
              )}
              autoComplete="off"
            />
            <CalendarIcon
              className="text-muted-foreground pointer-events-none absolute right-12 top-1/2 h-16 w-16 -translate-y-1/2"
              aria-hidden
            />
          </div>
          <input type="hidden" name={name} value={iso} />
        </>
      )}
    </Field>
  );
}

// =============================================================================
// NirField — masque progressif + indicateur clé contrôle INSEE
// =============================================================================

interface NirFieldProps {
  defaultValue?: string;
}

export function NirField({ defaultValue }: NirFieldProps): JSX.Element {
  const [raw, setRaw] = React.useState<string>(
    (defaultValue ?? '').replace(/\s+/g, '').toUpperCase(),
  );

  const canonical = raw.slice(0, 15);
  const length = canonical.length;
  const isComplete = length === 15;
  const isFormatOk = isComplete && NIR_FORMAT_REGEX.test(canonical);
  const isChecksumOk = isComplete && isNirChecksumValid(canonical);

  // Hotfix UX 2026-05-15 : en mode démo (strict=false), on traite « format OK »
  // comme valide. En mode strict (production), il faut format + clé.
  const isValid = isNirChecksumStrict ? isChecksumOk : isFormatOk;

  let indicator: 'pending' | 'valid' | 'invalid';
  if (!isComplete) indicator = 'pending';
  else if (isValid) indicator = 'valid';
  else indicator = 'invalid';

  let liveMessage: string;
  if (length === 0) {
    liveMessage = '';
  } else if (length < 15) {
    liveMessage = `${length} caractères saisis sur 15.`;
  } else if (isNirChecksumStrict) {
    liveMessage = isValid ? 'Clé de contrôle NIR valide.' : 'Clé de contrôle NIR invalide.';
  } else {
    liveMessage = isValid ? 'Format NIR valide.' : 'Format NIR invalide.';
  }

  return (
    <div className="space-y-8">
      <Label htmlFor="nir">NIR</Label>
      <div className="relative max-w-[320px]">
        <Input
          id="nir"
          inputMode="numeric"
          autoComplete="off"
          // PR3 06.17 : maxLength HTML5 = 15 chiffres + 4 espaces de mise
          // en forme (X 00 00 00 000 000 00). Le bornage métier reste
          // dans onChange (`slice(0, 15)` sur les chiffres seuls).
          maxLength={19}
          value={formatNirDisplay(raw)}
          onChange={(e) => {
            const next = e.target.value.replace(/\s+/g, '').toUpperCase();
            setRaw(next.slice(0, 15));
          }}
          placeholder="X 00 00 00 000 000 00"
          aria-describedby="nir-help nir-live"
          aria-invalid={indicator === 'invalid'}
          className={cn(
            'pr-32 font-mono tabular-nums tracking-wide',
            indicator === 'invalid' && 'border-destructive focus-visible:ring-destructive',
            indicator === 'valid' && 'border-success',
          )}
        />
        <span
          className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2"
          aria-hidden
        >
          {indicator === 'pending' && <CircleDashed className="text-muted-foreground h-16 w-16" />}
          {indicator === 'valid' && <Check className="text-success h-16 w-16" />}
          {indicator === 'invalid' && <X className="text-destructive h-16 w-16" />}
        </span>
      </div>
      <p id="nir-help" className="text-muted-foreground text-sm">
        {isNirChecksumStrict ? 'Ex : 1 76 05 25 974 001 69.' : 'Ex : 1 76 05 25 974 001 12.'}
      </p>
      <p className="text-muted-foreground text-xs">Facultatif. Chiffré (RGPD).</p>
      <p
        id="nir-live"
        aria-live="polite"
        className={cn(
          'text-xs',
          indicator === 'valid' && 'text-success',
          indicator === 'invalid' && 'text-destructive',
          indicator === 'pending' && 'sr-only',
        )}
      >
        {liveMessage}
      </p>
      <input type="hidden" name="nir" value={canonical} />
    </div>
  );
}

// =============================================================================
// TelField — masque progressif 0X XX XX XX XX, validation préfixe Réunion
// =============================================================================

interface TelFieldProps {
  defaultValue?: string;
  required?: boolean;
}

export function TelField({ defaultValue, required }: TelFieldProps): JSX.Element {
  const [raw, setRaw] = React.useState<string>((defaultValue ?? '').replace(/\D/g, ''));
  const display = formatTelDisplay(raw);
  const isComplete = raw.length === 10;
  const isReunion = /^0(?:262|263|692|693)/.test(raw);
  const showError = isComplete && !isReunion;

  return (
    <div className="space-y-8">
      <Label htmlFor="telephone">Téléphone</Label>
      <Input
        id="telephone"
        inputMode="tel"
        autoComplete="tel"
        // PR3 06.17 : maxLength HTML5 = 14 (10 chiffres + 4 espaces de
        // mise en forme « 06 92 00 00 00 »). Bornage métier dans onChange.
        maxLength={14}
        value={display}
        onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="06 92 00 00 00"
        required={required}
        aria-describedby="telephone-help"
        aria-invalid={showError}
        className={cn(
          'max-w-[240px] tabular-nums',
          showError && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {showError ? (
        <p id="telephone-help" className="text-destructive text-xs" role="alert">
          Le numéro doit commencer par 0262, 0263, 0692 ou 0693 (10 chiffres).
        </p>
      ) : (
        <p id="telephone-help" className="text-muted-foreground text-sm">
          Réunion : 0262, 0263, 0692, 0693.
        </p>
      )}
      <input type="hidden" name="telephone" value={raw} />
    </div>
  );
}

// =============================================================================
// CityPostalCodeField — préfixe 974 disabled + Select fermé 24 communes
// =============================================================================

interface CityPostalCodeFieldProps {
  defaultCp?: string;
  defaultVille?: string;
}

export function CityPostalCodeField({
  defaultCp,
  defaultVille,
}: CityPostalCodeFieldProps): JSX.Element {
  const initialSuffix = (defaultCp ?? '').replace(/^974/, '').slice(0, 2);
  const [cpSuffix, setCpSuffix] = React.useState<string>(initialSuffix);
  const [ville, setVille] = React.useState<string>(defaultVille ?? '');
  const cp = '974' + cpSuffix;
  const isCpComplete = cpSuffix.length === 2;

  // Auto-complétion CP → ville dominante (seulement si la ville n'a pas
  // été explicitement choisie par l'utilisateur).
  const lastAutoCp = React.useRef<string>('');
  React.useEffect(() => {
    if (!isCpComplete) return;
    if (cp === lastAutoCp.current) return;
    const dominant = cpDominantVille(cp);
    if (dominant && (ville === '' || ville === lastAutoCp.current)) {
      setVille(dominant);
      lastAutoCp.current = cp;
    }
  }, [cp, isCpComplete, ville]);

  return (
    <div className="grid grid-cols-[120px_1fr] gap-12">
      <div className="space-y-8">
        <Label htmlFor="code_postal_suffix">Code postal</Label>
        <div className="flex">
          <span
            aria-hidden
            className="border-input bg-muted text-muted-foreground inline-flex items-center rounded-l-md border border-r-0 px-8 text-sm font-medium"
          >
            974
          </span>
          <Input
            id="code_postal_suffix"
            inputMode="numeric"
            maxLength={2}
            value={cpSuffix}
            onChange={(e) => setCpSuffix(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="00"
            required
            aria-label="Code postal, 2 derniers chiffres après 974"
            className="rounded-l-none tabular-nums"
          />
        </div>
        <p className="text-muted-foreground text-sm">974 + 2 chiffres (ex : 97400).</p>
        <input type="hidden" name="code_postal" value={cp} />
      </div>
      <div className="space-y-8">
        <Label htmlFor="ville">Ville</Label>
        <Select
          value={ville}
          onChange={setVille}
          items={VILLES_ITEMS}
          ariaLabel="Ville"
          placeholder="Sélectionnez une commune"
          triggerClassName="w-full"
        />
        <input type="hidden" name="ville" value={ville} />
      </div>
    </div>
  );
}
