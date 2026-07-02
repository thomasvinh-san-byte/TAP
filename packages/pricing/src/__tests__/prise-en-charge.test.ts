import { describe, it, expect } from 'vitest';
import {
  computePriseEnCharge,
  PRISE_EN_CHARGE_CONFIG_V1,
  MENTION_REFUS_TRANSPORT_PARTAGE,
  type PriseEnChargeConfig,
} from '../prise-en-charge';

describe('computePriseEnCharge — taux', () => {
  it('cas général (taux null) : 65 % assurance, 35 % ticket modérateur', () => {
    const r = computePriseEnCharge({ tarifEur: 100 });
    expect(r.tauxPct).toBe(65);
    expect(r.partAssuranceEur).toBe(65);
    expect(r.ticketModerateurEur).toBe(35);
    expect(r.partPatientEur).toBe(35);
    expect(r.tiersPayantApplicable).toBe(true);
  });

  it('ALD exonérante en lien : 100 % assurance, 0 patient', () => {
    const r = computePriseEnCharge({ tarifEur: 100, taux: 100, exonerationMotif: 'ald_lien' });
    expect(r.partAssuranceEur).toBe(100);
    expect(r.ticketModerateurEur).toBe(0);
    expect(r.partPatientEur).toBe(0);
  });

  it('ALD NON exonérante : 55 % (nuance vs 65 %)', () => {
    const r = computePriseEnCharge({ tarifEur: 100, taux: 55 });
    expect(r.tauxPct).toBe(55);
    expect(r.partAssuranceEur).toBe(55);
    expect(r.partPatientEur).toBe(45);
  });

  it('accident du travail : 100 %', () => {
    const r = computePriseEnCharge({
      tarifEur: 80,
      taux: 100,
      exonerationMotif: 'accident_travail',
    });
    expect(r.partAssuranceEur).toBe(80);
    expect(r.partPatientEur).toBe(0);
  });

  it('arrondit au centime', () => {
    const r = computePriseEnCharge({ tarifEur: 33.33 });
    expect(r.partAssuranceEur).toBe(21.66); // 33.33*0.65 = 21.6645 → 21.66
    expect(r.ticketModerateurEur).toBe(11.67);
  });

  it('tarif nul/invalide → 0 partout', () => {
    const r = computePriseEnCharge({ tarifEur: 0 });
    expect(r.partAssuranceEur).toBe(0);
    expect(r.partPatientEur).toBe(0);
  });
});

describe('computePriseEnCharge — franchise médicale', () => {
  it('franchise 2 € par défaut (cas général)', () => {
    expect(computePriseEnCharge({ tarifEur: 100 }).franchiseEur).toBe(2);
  });

  it('exonérée pour maternité / CSS / AME', () => {
    for (const motif of ['maternite', 'css', 'ame'] as const) {
      expect(
        computePriseEnCharge({ tarifEur: 100, taux: 100, exonerationMotif: motif }).franchiseEur,
      ).toBe(0);
    }
  });

  it('exonérée pour transport d’urgence', () => {
    expect(computePriseEnCharge({ tarifEur: 100, urgence: true }).franchiseEur).toBe(0);
  });

  it('AT/MP NON exonéré de franchise (per règle vérifiée)', () => {
    expect(
      computePriseEnCharge({ tarifEur: 100, taux: 100, exonerationMotif: 'accident_travail' })
        .franchiseEur,
    ).toBe(2);
  });
});

describe('computePriseEnCharge — refus du transport partagé', () => {
  it('refus + soins itératifs (hors CSS/AME) → hors tiers payant + mention', () => {
    const r = computePriseEnCharge({
      tarifEur: 100,
      transportPartageRefuse: true,
      soinsIteratifs: true,
    });
    expect(r.refusPartagePris).toBe(true);
    expect(r.tiersPayantApplicable).toBe(false);
    expect(r.partAssuranceEur).toBe(0);
    expect(r.partPatientEur).toBe(100); // patient avance la totalité
    expect(r.mentionRefusPartage).toBe(MENTION_REFUS_TRANSPORT_PARTAGE);
  });

  it('refus SANS soins itératifs → sans effet (tiers payant maintenu)', () => {
    const r = computePriseEnCharge({ tarifEur: 100, transportPartageRefuse: true });
    expect(r.refusPartagePris).toBe(false);
    expect(r.tiersPayantApplicable).toBe(true);
    expect(r.mentionRefusPartage).toBeNull();
  });

  it('refus mais bénéficiaire CSS/AME → hors périmètre (tiers payant maintenu)', () => {
    for (const motif of ['css', 'ame'] as const) {
      const r = computePriseEnCharge({
        tarifEur: 100,
        taux: 100,
        exonerationMotif: motif,
        transportPartageRefuse: true,
        soinsIteratifs: true,
      });
      expect(r.refusPartagePris).toBe(false);
      expect(r.tiersPayantApplicable).toBe(true);
    }
  });

  it('pas de minoration active (décret non paru) — part assurance = taux plein', () => {
    // Le refus retire le tiers payant mais n'applique AUCUNE minoration du droit.
    const r = computePriseEnCharge({
      tarifEur: 100,
      transportPartageRefuse: true,
      soinsIteratifs: true,
    });
    // ticket modérateur théorique reste au taux plein (65 %) → 35, pas minoré.
    expect(r.ticketModerateurEur).toBe(35);
    expect(PRISE_EN_CHARGE_CONFIG_V1.minorationRefusPct).toBe(0);
  });
});

describe('computePriseEnCharge — paramétrable', () => {
  it('accepte une config alternative (taux non en dur)', () => {
    const alt: PriseEnChargeConfig = {
      ...PRISE_EN_CHARGE_CONFIG_V1,
      tauxGeneralPct: 70,
      franchiseParTrajetEur: 1,
    };
    const r = computePriseEnCharge({ tarifEur: 100, config: alt });
    expect(r.partAssuranceEur).toBe(70);
    expect(r.franchiseEur).toBe(1);
  });
});
