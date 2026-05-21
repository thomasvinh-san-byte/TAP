/**
 * Trame squelette DPIA — Phase 06.6 (D-05).
 *
 * Structure d'analyse d'impact pour le transport de données de santé. La
 * trame fournit le titre et le périmètre — elle n'émet AUCUN verdict de
 * risque : `risks_identified` et `mitigations` sont laissés vides, le niveau
 * de risque résiduel non renseigné. L'identification et l'évaluation des
 * risques restent la responsabilité du dirigeant (avec son DPO si besoin).
 */

export const DPIA_PREFILL_TRAME = {
  title: "Analyse d'impact relative à la protection des données — transport de données de santé",
  scope:
    'Traitement des données de santé des patients dans le cadre du transport sanitaire conventionné (mobilité réduite, dialyse, TPMR) : recueil, planification, exécution et traçabilité des courses.',
};
