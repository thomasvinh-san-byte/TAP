'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * CaisseCloture (CAISSE-03) — rapprochement de fin de journée : compare le
 * montant ATTENDU par mode encaissable physiquement (espèces / CB / chèque,
 * déjà calculé par la ventilation du jour) au montant réellement COMPTÉ, et
 * affiche l'écart (par mode + total).
 *
 * Le CGSS différé est EXCLU du rapprochement (tiers payant réglé plus tard par
 * la caisse — rien à compter dans le tiroir) : affiché à part, pour information.
 *
 * Outil de CONTRÔLE, pas un registre comptable/légal (doctrine « la caisse n'est
 * pas un module compta »). Calcul à l'écran, sans recalcul des ventes.
 * Persistance de la clôture (trace horodatée + auteur) cadrée séparément.
 */

const ENCAISSABLE = [
  { key: 'cash', label: 'Espèces' },
  { key: 'cb', label: 'CB' },
  { key: 'cheque', label: 'Chèque' },
] as const;

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

/** Écart signé : « +X,XX € » / « −X,XX € » / « 0,00 € ». */
function formatSignedEur(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${formatEur(Math.abs(n))}`;
}

/** Parse une saisie euro (virgule ou point) → nombre, ou null si vide/invalide. */
function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Libellé + classe de l'écart (couleur réservée à l'anomalie, signe + mot). */
function ecartMeta(ecart: number | null): { label: string; className: string } {
  if (ecart === null) return { label: '—', className: 'text-muted-foreground' };
  if (ecart === 0) return { label: 'Équilibré', className: 'text-muted-foreground' };
  if (ecart > 0)
    return { label: `${formatSignedEur(ecart)} · Excédent`, className: 'text-warning font-medium' };
  return { label: `${formatSignedEur(ecart)} · Manque`, className: 'text-destructive font-medium' };
}

export function CaisseCloture({ byMethod }: { byMethod: Record<string, number> }): JSX.Element {
  const [counted, setCounted] = React.useState<Record<string, string>>({});

  const rows = ENCAISSABLE.map((m) => {
    const expected = byMethod[m.key] ?? 0;
    const countedNum = parseAmount(counted[m.key] ?? '');
    const ecart = countedNum === null ? null : countedNum - expected;
    return { ...m, expected, countedNum, ecart };
  });

  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalCounted = rows.reduce((s, r) => s + (r.countedNum ?? 0), 0);
  const anyEntered = rows.some((r) => r.countedNum !== null);
  const totalEcart = anyEntered ? totalCounted - totalExpected : null;
  const totalMeta = ecartMeta(totalEcart);
  const cgss = byMethod['cgss_differe'] ?? 0;

  return (
    <section
      aria-labelledby="cloture-title"
      className="border-border bg-muted/20 space-y-16 rounded-md border p-16"
    >
      <div>
        <h2 id="cloture-title" className="text-base font-semibold">
          Clôture de caisse
        </h2>
        <p className="text-muted-foreground text-sm">
          Rapprochement de fin de journée : saisir le compté par mode, comparer à l&apos;attendu.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase tracking-wide">
              <th className="px-8 py-4 text-left font-medium">Mode</th>
              <th className="px-8 py-4 text-right font-medium">Attendu</th>
              <th className="px-8 py-4 text-right font-medium">Compté</th>
              <th className="px-8 py-4 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = ecartMeta(r.ecart);
              const inputId = `cloture-${r.key}`;
              return (
                <tr key={r.key} className="border-border/60 border-t">
                  <td className="px-8 py-8">
                    <label htmlFor={inputId}>{r.label}</label>
                  </td>
                  <td className="px-8 py-8 text-right font-mono tabular-nums">
                    {formatEur(r.expected)}
                  </td>
                  <td className="px-8 py-8 text-right">
                    <Input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      value={counted[r.key] ?? ''}
                      onChange={(e) => setCounted((c) => ({ ...c, [r.key]: e.target.value }))}
                      placeholder="0,00"
                      aria-label={`Montant compté — ${r.label}`}
                      className="ml-auto h-8 w-[110px] text-right font-mono tabular-nums"
                    />
                  </td>
                  <td className={cn('px-8 py-8 text-right font-mono tabular-nums', meta.className)}>
                    {meta.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-border border-t-2 font-semibold">
              <td className="px-8 py-8">Total encaissable</td>
              <td className="px-8 py-8 text-right font-mono tabular-nums">
                {formatEur(totalExpected)}
              </td>
              <td className="px-8 py-8 text-right font-mono tabular-nums">
                {anyEntered ? formatEur(totalCounted) : '—'}
              </td>
              <td
                className={cn('px-8 py-8 text-right font-mono tabular-nums', totalMeta.className)}
                aria-live="polite"
              >
                {totalMeta.label}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-muted-foreground border-border/60 border-t pt-12 text-xs">
        CGSS différé : <span className="font-mono tabular-nums">{formatEur(cgss)}</span> — tiers
        payant réglé plus tard par la caisse, hors rapprochement (non compté dans le tiroir).
      </p>
    </section>
  );
}
