import { describe, it, expect } from 'vitest';
import { parseRRule } from '../rrule-helper';

describe('parseRRule', () => {
  it('retourne une instance RRule pour un string valide', () => {
    const rule = parseRRule(
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      new Date('2026-06-01T08:00:00Z'),
    );
    expect(rule).toBeDefined();
    expect(typeof rule.between).toBe('function');
  });

  it('throw une erreur claire pour un string invalide', () => {
    expect(() =>
      parseRRule('NOT_A_VALID_RRULE_STRING', new Date('2026-06-01T08:00:00Z')),
    ).toThrow(/RRULE invalide/);
  });
});
