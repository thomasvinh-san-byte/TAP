/**
 * Helper CSV utf-8-sig Excel-FR-friendly (Phase 04.7 PLAN-2).
 *
 * - BOM `﻿` en tête (utf-8-sig) : Excel FR/Windows/macOS détecte
 *   l'encoding sans demander à l'utilisateur
 * - Séparateur `;` (point-virgule) : Excel FR par défaut
 * - Échappement guillemets doubles, valeurs contenant `;`, `"`, ou
 *   `\n` quoted
 * - Protection contre formula injection : préfixe `'` si la valeur
 *   commence par `=`, `+`, `-`, `@`, tab, ou CR
 *
 * Refs : T-04.7-08 (formula injection mitigation).
 */

const BOM = '﻿';
const SEP = ';';
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function formatEurFr(amount: number): string {
  return amount.toFixed(2).replace('.', ',');
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

export function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Protection formula injection
  if (s.length > 0 && FORMULA_PREFIXES.includes(s.charAt(0))) {
    s = `'${s}`;
  }
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsv).join(SEP);
  const bodyLines = rows.map((row) => row.map(escapeCsv).join(SEP));
  return BOM + [headerLine, ...bodyLines].join('\r\n');
}
