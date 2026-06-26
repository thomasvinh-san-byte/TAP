import { describe, it, expect } from 'vitest';
import { RIDE_CANCELLED_STATUSES } from '../ride';
import {
  ACTIVE_RIDE_STATUSES,
  RIDE_MODIFIABLE_STATUSES,
  RIDE_STATUSES,
  RIDE_TRANSITIONS,
  canTransition,
  cancellationTargetsAreKnown,
  isModifiableStatus,
  statusesAllowedTo,
} from '../ride-state-machine';

/**
 * Tests de la machine à états des courses (DEC-178). Garantissent que les
 * transitions légales passent, que les illégales sont bloquées, que les états
 * terminaux n'ont pas de sortie, et la cohérence avec les constantes existantes.
 */
describe('canTransition — transitions légales (reconstituées du code)', () => {
  const legal: [string, (typeof RIDE_STATUSES)[number]][] = [
    ['brouillon', 'validee'],
    ['brouillon', 'annulee_regulateur'],
    ['validee', 'assignee'],
    ['validee', 'annulee_regulateur'],
    ['validee', 'annulee_meteo'],
    ['validee', 'annulee_patient'],
    ['assignee', 'en_cours'],
    ['assignee', 'validee'],
    ['assignee', 'annulee_regulateur'],
    ['assignee', 'annulee_meteo'],
    ['en_cours', 'terminee'],
    ['en_cours', 'annulee_patient'],
  ];
  it.each(legal)('%s → %s est autorisée', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });
});

describe('canTransition — transitions illégales bloquées', () => {
  const illegal: [string, (typeof RIDE_STATUSES)[number]][] = [
    ['terminee', 'assignee'],
    ['terminee', 'en_cours'],
    ['brouillon', 'en_cours'],
    ['brouillon', 'terminee'],
    ['validee', 'terminee'],
    ['validee', 'en_cours'],
    ['en_cours', 'assignee'],
    ['annulee_regulateur', 'validee'],
    ['annulee_meteo', 'validee'],
    ['inconnu', 'validee'],
  ];
  it.each(illegal)('%s → %s est refusée', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('états terminaux', () => {
  const terminals = ['terminee', ...RIDE_CANCELLED_STATUSES] as const;
  it.each(terminals)('%s n’a aucune transition sortante', (s) => {
    expect(RIDE_TRANSITIONS[s]).toEqual([]);
  });
});

describe('cohérence avec les constantes', () => {
  it('toute cible d’annulation est un statut annulé connu', () => {
    expect(cancellationTargetsAreKnown()).toBe(true);
  });

  it('ACTIVE_RIDE_STATUSES = enum privé de brouillon et des annulations', () => {
    const expected = RIDE_STATUSES.filter(
      (s) => s !== 'brouillon' && !(RIDE_CANCELLED_STATUSES as readonly string[]).includes(s),
    );
    expect([...ACTIVE_RIDE_STATUSES].sort()).toEqual([...expected].sort());
  });

  it('RIDE_MODIFIABLE_STATUSES = sources d’une annulation météo (validee, assignee)', () => {
    expect([...RIDE_MODIFIABLE_STATUSES].sort()).toEqual(['assignee', 'validee']);
    expect(statusesAllowedTo('annulee_meteo').sort()).toEqual(['assignee', 'validee']);
    expect(isModifiableStatus('validee')).toBe(true);
    expect(isModifiableStatus('en_cours')).toBe(false);
    expect(isModifiableStatus('terminee')).toBe(false);
  });

  it('chaque statut a une entrée dans la table de transitions', () => {
    for (const s of RIDE_STATUSES) expect(RIDE_TRANSITIONS[s]).toBeDefined();
  });
});
