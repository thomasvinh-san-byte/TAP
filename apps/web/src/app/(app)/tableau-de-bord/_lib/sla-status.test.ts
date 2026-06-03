import { describe, expect, it } from 'vitest';
import {
  evaluateBreachCnil72h,
  evaluateRequestDeadline,
  evaluateDpiaReview,
  evaluateRegisterReview,
  sortRulesByCriticity,
  type SlaRule,
} from './sla-status';

/**
 * Tests unitaires SLA factuels datés (Phase 06.11 Wave 3 — rattrapage Wave 1).
 *
 * Pure functions : on injecte `now` et des `rows` minimaux pour exercer
 * chaque branche rouge/orange/null. Pas de mock Supabase.
 */

const NOW = new Date('2026-06-03T12:00:00Z');

function hoursAgo(h: number): string {
  return new Date(NOW.getTime() - h * 3_600_000).toISOString();
}

function daysFromNow(d: number): string {
  return new Date(NOW.getTime() + d * 86_400_000).toISOString();
}

describe('evaluateBreachCnil72h', () => {
  it('rouge si une breach dépasse 72 h', () => {
    const rule = evaluateBreachCnil72h([{ detected_at: hoursAgo(80) }], NOW);
    expect(rule?.status).toBe('rouge');
    expect(rule?.id).toBe('breach-cnil-72h');
  });

  it('orange si une breach est entre 60 h et 72 h', () => {
    const rule = evaluateBreachCnil72h([{ detected_at: hoursAgo(65) }], NOW);
    expect(rule?.status).toBe('orange');
  });

  it('vert (null) si aucune breach dans la zone critique', () => {
    expect(evaluateBreachCnil72h([], NOW)).toBeNull();
    expect(evaluateBreachCnil72h([{ detected_at: hoursAgo(10) }], NOW)).toBeNull();
  });
});

describe('evaluateRequestDeadline', () => {
  it('rouge si au moins une demande est en délai dépassé', () => {
    const rule = evaluateRequestDeadline(
      [{ deadline_at: daysFromNow(-1) }, { deadline_at: daysFromNow(10) }],
      NOW,
    );
    expect(rule?.status).toBe('rouge');
  });

  it('orange si au moins une demande arrive à échéance < 5 jours', () => {
    const rule = evaluateRequestDeadline(
      [{ deadline_at: daysFromNow(3) }, { deadline_at: daysFromNow(20) }],
      NOW,
    );
    expect(rule?.status).toBe('orange');
  });

  it('vert (null) si toutes les demandes sont confortables', () => {
    expect(evaluateRequestDeadline([], NOW)).toBeNull();
    expect(evaluateRequestDeadline([{ deadline_at: daysFromNow(20) }], NOW)).toBeNull();
  });
});

describe('evaluateDpiaReview', () => {
  it('rouge si au moins une DPIA a une révision dépassée', () => {
    const rule = evaluateDpiaReview([{ title: 'DPIA A', next_review_at: daysFromNow(-5) }], NOW);
    expect(rule?.status).toBe('rouge');
  });

  it('orange si au moins une DPIA arrive à révision < 30 jours', () => {
    const rule = evaluateDpiaReview([{ title: 'DPIA B', next_review_at: daysFromNow(20) }], NOW);
    expect(rule?.status).toBe('orange');
  });
});

describe('evaluateRegisterReview', () => {
  it("orange si le registre n'a pas été révisé depuis > 12 mois", () => {
    const oldUpdate = new Date(NOW.getTime() - 400 * 86_400_000).toISOString();
    const rule = evaluateRegisterReview(oldUpdate, NOW);
    expect(rule?.status).toBe('orange');
  });

  it('vert (null) si dernière révision < 12 mois ou absente', () => {
    const recent = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    expect(evaluateRegisterReview(recent, NOW)).toBeNull();
    expect(evaluateRegisterReview(null, NOW)).toBeNull();
  });
});

describe('sortRulesByCriticity', () => {
  it('place les règles rouges avant les oranges', () => {
    const rules: SlaRule[] = [
      { id: 'register-review', status: 'orange', label: 'orange-1' },
      { id: 'breach-cnil-72h', status: 'rouge', label: 'rouge-1' },
      { id: 'request-deadline', status: 'orange', label: 'orange-2' },
    ];
    const sorted = sortRulesByCriticity(rules);
    expect(sorted[0]?.status).toBe('rouge');
    expect(sorted[1]?.status).toBe('orange');
    expect(sorted[2]?.status).toBe('orange');
  });

  it('renvoie un tableau vide pour un tableau vide (toutes vertes)', () => {
    expect(sortRulesByCriticity([])).toEqual([]);
  });
});
