import { describe, it, expect } from 'vitest';
import { evaluateDrop } from './planning-drop';
import type { ReassignConflict } from './planning-conflicts';

const conflict: ReassignConflict = { count: 1, nearestScheduledAt: '2026-06-08T05:00:00Z' };

describe('evaluateDrop', () => {
  it('cible = ligne d’origine (même chauffeur) → noop', () => {
    expect(evaluateDrop('d1', 'd1', null)).toEqual({
      verdict: 'noop',
      label: 'Déjà sur ce chauffeur',
    });
  });

  it('course déjà non affectée reposée sur « Non affectées » → noop', () => {
    expect(evaluateDrop(null, null, null).verdict).toBe('noop');
  });

  it('vers « Non affectées » depuis un chauffeur → désaffectation saine', () => {
    expect(evaluateDrop('d1', null, null)).toEqual({
      verdict: 'unassign',
      label: "Retirer l'affectation",
    });
  });

  it('vers un autre chauffeur sans conflit → compatible', () => {
    expect(evaluateDrop('d1', 'd2', null).verdict).toBe('compatible');
    expect(evaluateDrop(null, 'd2', null).verdict).toBe('compatible');
  });

  it('vers un autre chauffeur avec conflit probable → conflict (jamais bloqué)', () => {
    expect(evaluateDrop('d1', 'd2', conflict)).toEqual({
      verdict: 'conflict',
      label: 'Conflit horaire probable',
    });
  });

  it('le conflit ne s’applique pas à une désaffectation', () => {
    // Cible nulle : la désaffectation prime, aucun conflit possible.
    expect(evaluateDrop('d1', null, conflict).verdict).toBe('unassign');
  });
});
