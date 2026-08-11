import { describe, it, expect } from 'vitest';
import {
  EVENT_TO_STATUS,
  CGSS_EVENT_TYPES,
  CGSS_STATUSES,
  allowedEventsFor,
  isRejectEvent,
  REJECT_EVENTS,
} from './cgss-invoice-status';

describe('cgss-invoice-status', () => {
  it('mappe chaque type d événement vers un statut normé', () => {
    for (const e of CGSS_EVENT_TYPES) {
      expect(CGSS_STATUSES).toContain(EVENT_TO_STATUS[e]);
    }
  });

  it('les événements de rejet sont bien arl_negatif et rejet', () => {
    expect(REJECT_EVENTS).toEqual(['arl_negatif', 'rejet']);
    expect(isRejectEvent('arl_negatif')).toBe(true);
    expect(isRejectEvent('rejet')).toBe(true);
    expect(isRejectEvent('paiement')).toBe(false);
  });

  it('ne propose que des transitions cohérentes (pas de paiement avant ARL)', () => {
    expect(allowedEventsFor('a_teletransmettre')).toEqual(['teletransmission']);
    expect(allowedEventsFor('teletransmise')).not.toContain('paiement');
    expect(allowedEventsFor('reception_confirmee')).toContain('paiement');
    expect(allowedEventsFor('payee')).toEqual([]);
  });

  it('permet la retransmission depuis un rejet', () => {
    expect(allowedEventsFor('rejetee')).toContain('teletransmission');
    expect(allowedEventsFor('rejet_technique')).toContain('teletransmission');
  });

  it('toute transition proposée produit un statut normé', () => {
    for (const s of CGSS_STATUSES) {
      for (const e of allowedEventsFor(s)) {
        expect(CGSS_STATUSES).toContain(EVENT_TO_STATUS[e]);
      }
    }
  });
});
