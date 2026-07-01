import { describe, it, expect } from 'vitest';
import {
  generateFec,
  formatFecDate,
  formatFecAmount,
  FEC_FIELDS,
  FEC_SEPARATOR,
  DEFAULT_FEC_ACCOUNTS,
  type FecEncaissement,
} from '../fec';

const SIREN = '123456789';
const CLOTURE = '2026-06-30T00:00:00.000Z';

function enc(over: Partial<FecEncaissement> = {}): FecEncaissement {
  return {
    pieceRef: 'COURSE-1',
    date: '2026-06-10T09:00:00.000Z',
    amountEur: 24.5,
    method: 'cash',
    ...over,
  };
}

describe('formatFecDate', () => {
  it('produit AAAAMMJJ sans séparateur (UTC)', () => {
    expect(formatFecDate('2026-06-05T23:00:00.000Z')).toBe('20260605');
    expect(formatFecDate(CLOTURE)).toBe('20260630');
  });
});

describe('formatFecAmount', () => {
  it('deux décimales, virgule décimale, pas de séparateur de milliers', () => {
    expect(formatFecAmount(24.5)).toBe('24,50');
    expect(formatFecAmount(1234.5)).toBe('1234,50');
    expect(formatFecAmount(0)).toBe('0,00');
  });
});

describe('generateFec — structure', () => {
  it('en-tête = les 18 champs exacts dans l’ordre, séparés par pipe', () => {
    const { content } = generateFec({ siren: SIREN, clotureDate: CLOTURE, encaissements: [enc()] });
    const header = content.split('\r\n')[0]!;
    expect(header).toBe(FEC_FIELDS.join(FEC_SEPARATOR));
    expect(header.split(FEC_SEPARATOR)).toHaveLength(18);
  });

  it('chaque ligne a exactement 18 colonnes', () => {
    const { content } = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [enc(), enc({ pieceRef: 'COURSE-2', method: 'cb', amountEur: 10 })],
    });
    for (const line of content.split('\r\n')) {
      expect(line.split(FEC_SEPARATOR)).toHaveLength(18);
    }
  });

  it('ne contient jamais de point-virgule', () => {
    const { content } = generateFec({ siren: SIREN, clotureDate: CLOTURE, encaissements: [enc()] });
    expect(content).not.toContain(';');
  });

  it('nomme le fichier SIREN + FEC + AAAAMMJJ(clôture) + .txt', () => {
    const { filename } = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [enc()],
    });
    expect(filename).toBe('123456789FEC20260630.txt');
  });
});

describe('generateFec — écritures', () => {
  it('produit 2 lignes équilibrées par encaissement (débit = crédit)', () => {
    const res = generateFec({ siren: SIREN, clotureDate: CLOTURE, encaissements: [enc()] });
    expect(res.entryCount).toBe(1);
    expect(res.lineCount).toBe(2);
    expect(res.totalDebit).toBe(24.5);
    expect(res.totalCredit).toBe(24.5);
    expect(res.balanced).toBe(true);
  });

  it('numérote les écritures sans trou ni inversion (tri chronologique)', () => {
    const res = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [
        enc({ pieceRef: 'B', date: '2026-06-20T00:00:00.000Z' }),
        enc({ pieceRef: 'A', date: '2026-06-05T00:00:00.000Z' }),
        enc({ pieceRef: 'C', date: '2026-06-12T00:00:00.000Z' }),
      ],
    });
    const rows = res.content.split('\r\n').slice(1);
    const numByLine = rows.map((r) => r.split(FEC_SEPARATOR)[2]);
    // 3 écritures × 2 lignes = numéros 1,1,2,2,3,3, continus.
    expect(numByLine).toEqual(['1', '1', '2', '2', '3', '3']);
    // La première écriture doit être la plus ancienne (date 20260605, pièce A).
    const firstDebit = rows[0]!.split(FEC_SEPARATOR);
    expect(firstDebit[3]).toBe('20260605');
    expect(firstDebit[8]).toBe('A');
  });

  it('mappe le compte de débit selon le mode de règlement', () => {
    const res = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [
        enc({ pieceRef: 'CASH', method: 'cash', date: '2026-06-01T00:00:00.000Z' }),
        enc({ pieceRef: 'CB', method: 'cb', date: '2026-06-02T00:00:00.000Z' }),
        enc({ pieceRef: 'CGSS', method: 'cgss_differe', date: '2026-06-03T00:00:00.000Z' }),
      ],
    });
    const rows = res.content.split('\r\n').slice(1);
    // Ligne débit de chaque écriture (indices 0,2,4) : CompteNum en colonne 5.
    expect(rows[0]!.split(FEC_SEPARATOR)[4]).toBe(DEFAULT_FEC_ACCOUNTS.compteCaisseNum);
    expect(rows[2]!.split(FEC_SEPARATOR)[4]).toBe(DEFAULT_FEC_ACCOUNTS.compteBanqueNum);
    expect(rows[4]!.split(FEC_SEPARATOR)[4]).toBe(DEFAULT_FEC_ACCOUNTS.compteClientCgssNum);
    // Toutes les lignes crédit portent le compte de ventes.
    expect(rows[1]!.split(FEC_SEPARATOR)[4]).toBe(DEFAULT_FEC_ACCOUNTS.compteVenteNum);
  });

  it('laisse vides mais présentes les colonnes non applicables', () => {
    const res = generateFec({ siren: SIREN, clotureDate: CLOTURE, encaissements: [enc()] });
    const debitLine = res.content.split('\r\n')[1]!.split(FEC_SEPARATOR);
    // CompAuxNum(6), CompAuxLib(7), EcritureLet(13), DateLet(14), Montantdevise(16), Idevise(17)
    for (const idx of [6, 7, 13, 14, 16, 17]) expect(debitLine[idx]).toBe('');
    // Debit rempli, Credit à 0,00 sur la ligne de débit.
    expect(debitLine[11]).toBe('24,50');
    expect(debitLine[12]).toBe('0,00');
  });

  it('ignore les montants nuls (pas d’écriture déséquilibrée)', () => {
    const res = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [enc({ amountEur: 0 }), enc({ pieceRef: 'OK', amountEur: 12 })],
    });
    expect(res.entryCount).toBe(1);
    expect(res.balanced).toBe(true);
  });

  it('accepte des comptes paramétrés (plan comptable propre)', () => {
    const res = generateFec({
      siren: SIREN,
      clotureDate: CLOTURE,
      encaissements: [enc()],
      accounts: { ...DEFAULT_FEC_ACCOUNTS, compteVenteNum: '707100', journalCode: 'VT' },
    });
    const rows = res.content.split('\r\n').slice(1);
    expect(rows[0]!.split(FEC_SEPARATOR)[0]).toBe('VT');
    expect(rows[1]!.split(FEC_SEPARATOR)[4]).toBe('707100');
  });
});

describe('generateFec — garde SIREN', () => {
  it('rejette un SIREN non conforme', () => {
    expect(() => generateFec({ siren: '123', clotureDate: CLOTURE, encaissements: [] })).toThrow();
    expect(() =>
      generateFec({ siren: '12345678A', clotureDate: CLOTURE, encaissements: [] }),
    ).toThrow();
  });
});
