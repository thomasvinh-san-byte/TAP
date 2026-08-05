/**
 * Tests Vitest — helpers purs date/heure de la saisie de course.
 *
 * Fonctions pures, aucune infrastructure. Le fuseau d'exécution est
 * `Indian/Reunion` (UTC+4, sans heure d'été) — fixé par vitest.config.ts
 * (`env.TZ`). Les assertions de fuseau caractérisent donc le comportement RÉEL
 * dans le fuseau de déploiement.
 *
 * Point de vigilance (caractérisé ici, amélioré au commit suivant) : la
 * combinaison date + heure produit aujourd'hui une valeur en TEMPS UNIVERSEL
 * (suffixe `Z`), alors que l'aval attend une valeur avec DÉCALAGE LOCAL.
 */
import { describe, it, expect } from 'vitest';
import { rideExpressInputSchema } from '@tap/shared';
import {
  SERVICE_START_HOUR,
  SERVICE_END_HOUR,
  TIME_INTERVAL_MIN,
  projectFromIso,
  sameDate,
  sameTime,
  combineDateTime,
  digitsOnly,
  formatDateMask,
  formatTimeMask,
} from './datetime-helpers';

describe('projectFromIso', () => {
  it('valeur valide → date (jour) + heure séparées (fuseau local Réunion)', () => {
    // Instant UTC 06:30Z = 10:30 à La Réunion (UTC+4).
    const { date, time } = projectFromIso('2026-05-13T06:30:00.000Z');
    expect(date).not.toBeNull();
    expect(time).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(4); // mai (0-indexé)
    expect(date!.getDate()).toBe(13);
    // date isolée = minuit local
    expect(date!.getHours()).toBe(0);
    expect(date!.getMinutes()).toBe(0);
    expect(time!.getHours()).toBe(10);
    expect(time!.getMinutes()).toBe(30);
  });

  it('valeur absente (null) → { null, null }', () => {
    expect(projectFromIso(null)).toEqual({ date: null, time: null });
  });

  it('valeur non analysable → { null, null }', () => {
    expect(projectFromIso('pas-une-date')).toEqual({ date: null, time: null });
  });
});

describe('sameDate', () => {
  it('même jour → true', () => {
    expect(sameDate(new Date(2026, 4, 13, 8, 0), new Date(2026, 4, 13, 20, 0))).toBe(true);
  });
  it('jour différent → false', () => {
    expect(sameDate(new Date(2026, 4, 13), new Date(2026, 4, 14))).toBe(false);
  });
  it('les deux absentes → true ; une seule absente → false', () => {
    expect(sameDate(null, null)).toBe(true);
    expect(sameDate(new Date(2026, 4, 13), null)).toBe(false);
    expect(sameDate(null, new Date(2026, 4, 13))).toBe(false);
  });
});

describe('sameTime', () => {
  it('même heure+minute → true (jour ignoré)', () => {
    expect(sameTime(new Date(2026, 4, 13, 10, 30), new Date(2020, 0, 1, 10, 30))).toBe(true);
  });
  it('heure ou minute différente → false', () => {
    expect(sameTime(new Date(0, 0, 0, 10, 30), new Date(0, 0, 0, 11, 30))).toBe(false);
    expect(sameTime(new Date(0, 0, 0, 10, 30), new Date(0, 0, 0, 10, 45))).toBe(false);
  });
  it('les deux absentes → true ; une seule absente → false', () => {
    expect(sameTime(null, null)).toBe(true);
    expect(sameTime(new Date(0, 0, 0, 10, 30), null)).toBe(false);
    expect(sameTime(null, new Date(0, 0, 0, 10, 30))).toBe(false);
  });
});

describe('combineDateTime', () => {
  it('absence de l’une ou l’autre → null', () => {
    expect(combineDateTime(null, new Date(0, 0, 0, 10, 30))).toBeNull();
    expect(combineDateTime(new Date(2026, 4, 13), null)).toBeNull();
    expect(combineDateTime(null, null)).toBeNull();
  });

  // AMÉLIORÉ (commit 2) : sortie avec DÉCALAGE LOCAL Réunion (+04:00) au lieu du
  // temps universel (`Z`). Même INSTANT qu'avant (06:30Z), mais heure murale
  // explicite et indépendante du fuseau du poste. (Au commit 1, ce test attendait
  // '2026-05-13T06:30:00.000Z' — correction volontaire du fuseau.)
  it('[corrigé] combinaison valide → ISO à décalage local (+04:00), même instant', () => {
    const iso = combineDateTime(new Date(2026, 4, 13), new Date(0, 0, 0, 10, 30));
    expect(iso).toBe('2026-05-13T10:30:00+04:00');
    expect(new Date(iso!).getTime()).toBe(new Date('2026-05-13T06:30:00.000Z').getTime());
  });

  // Minuit : 00:30 reste le 13/05 en heure murale locale (plus de recul d'un jour
  // dû à la conversion UTC) ; l'instant demeure identique (veille 20:30Z).
  it('[corrigé] minuit/limite : 00:30 → 13/05 00:30+04:00 (instant = veille 20:30Z)', () => {
    const iso = combineDateTime(new Date(2026, 4, 13), new Date(0, 0, 0, 0, 30));
    expect(iso).toBe('2026-05-13T00:30:00+04:00');
    expect(new Date(iso!).getTime()).toBe(new Date('2026-05-12T20:30:00.000Z').getTime());
  });

  it('aller-retour projeter → recombiner : instant STABLE', () => {
    const original = '2026-05-13T06:30:00.000Z';
    const { date, time } = projectFromIso(original);
    const recombined = combineDateTime(date, time);
    expect(recombined).not.toBeNull();
    // Stabilité = même INSTANT (indépendant du format de sortie).
    expect(new Date(recombined!).getTime()).toBe(new Date(original).getTime());
  });

  it('[corrigé] relecture d’une valeur à décalage local (+04:00) : aller-retour stable', () => {
    const original = '2026-05-13T10:30:00+04:00';
    const { date, time } = projectFromIso(original);
    expect(date!.getDate()).toBe(13);
    expect(time!.getHours()).toBe(10);
    expect(time!.getMinutes()).toBe(30);
    const recombined = combineDateTime(date, time);
    expect(recombined).toBe('2026-05-13T10:30:00+04:00');
    expect(new Date(recombined!).getTime()).toBe(new Date(original).getTime());
  });
});

describe('cohérence de bout en bout (validation aval)', () => {
  it('[corrigé] la valeur combinée est acceptée par scheduled_at (datetime offset)', () => {
    const iso = combineDateTime(new Date(2026, 4, 13), new Date(0, 0, 0, 10, 30));
    // La validation aval exige `z.string().datetime({ offset: true })` : le
    // décalage explicite +04:00 est accepté (le `Z` l'était aussi — même schéma).
    const res = rideExpressInputSchema.shape.scheduled_at.safeParse(iso);
    expect(res.success).toBe(true);
  });
});

describe('digitsOnly', () => {
  it('retire tout caractère non numérique', () => {
    expect(digitsOnly('13/05/2026')).toBe('13052026');
    expect(digitsOnly('14:30')).toBe('1430');
    expect(digitsOnly('ab12cd34')).toBe('1234');
    expect(digitsOnly('')).toBe('');
  });
});

describe('formatDateMask', () => {
  it('vide → ""', () => expect(formatDateMask('')).toBe(''));
  it('partiel (≤2, ≤4)', () => {
    expect(formatDateMask('1')).toBe('1');
    expect(formatDateMask('13')).toBe('13');
    expect(formatDateMask('1305')).toBe('13/05');
    expect(formatDateMask('130')).toBe('13/0');
  });
  it('complet → JJ/MM/AAAA', () => {
    expect(formatDateMask('13052026')).toBe('13/05/2026');
  });
  it('trop long → tronqué à 8 chiffres', () => {
    expect(formatDateMask('130520261234')).toBe('13/05/2026');
  });
});

describe('formatTimeMask', () => {
  it('vide → ""', () => expect(formatTimeMask('')).toBe(''));
  it('partiel (≤2)', () => {
    expect(formatTimeMask('1')).toBe('1');
    expect(formatTimeMask('14')).toBe('14');
    expect(formatTimeMask('143')).toBe('14:3');
  });
  it('complet → HH:MM', () => {
    expect(formatTimeMask('1430')).toBe('14:30');
  });
  it('trop long → tronqué à 4 chiffres', () => {
    expect(formatTimeMask('143059')).toBe('14:30');
  });
});

describe('bornes de service', () => {
  it('constantes (première/dernière heure, intervalle)', () => {
    expect(SERVICE_START_HOUR).toBe(5);
    expect(SERVICE_END_HOUR).toBe(22);
    expect(TIME_INTERVAL_MIN).toBe(15);
    expect(SERVICE_START_HOUR).toBeLessThan(SERVICE_END_HOUR);
  });
});
