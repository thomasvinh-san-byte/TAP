import type { DataProcessingRegisterInput } from '@tap/shared';

/**
 * Contenu-type du registre des traitements (art. 30 RGPD) — Phase 06.6.
 *
 * 6 entrées-types d'un transport sanitaire conventionné, proposées au
 * dirigeant en pré-remplissage. Ce sont des SUGGESTIONS, sourcées sur des
 * références publiques (CNIL, Code de commerce) — TAP ne certifie pas (D-13).
 * Le dirigeant les relit, les adapte et les valide sur l'écran de revue
 * (Wave 2) avant toute insertion. Une relecture par un juriste ou le DPO est
 * recommandée.
 *
 * Aucun nom propre de personne (NFR-001).
 *
 * Sourcing des durées de conservation :
 *  - Entrée 1 — 3 ans : durée de la relation (référentiel CNIL clients).
 *  - Entrée 2 — 10 ans : pièces comptables, Code de commerce art. L123-22
 *    (à compter de la clôture de l'exercice).
 *  - Entrée 3 — 5 ans : délai de prescription prud'homale (certaines pièces
 *    RH ont des durées propres — à ajuster par le dirigeant).
 *  - Entrée 4 — 5 ans en base active : référentiel CNIL « traitements de
 *    données de santé hors recherche » (puis archivage intermédiaire selon
 *    les durées légales).
 *  - Entrée 5 — 90 jours : CNIL (géolocalisation des véhicules) — 2 mois par
 *    principe, jusqu'à 1 an pour la preuve des interventions / l'optimisation
 *    des tournées ; 90 j retenu (cohérent CLAUDE.md § 6), puis purge.
 *  - Entrée 6 — 13 mois (395 j) : durée de vie maximale des cookies
 *    recommandée par la CNIL.
 */
export const REGISTRE_PREFILL_ENTRIES: DataProcessingRegisterInput[] = [
  // 1 — Planification et exécution des courses (base : exécution du contrat).
  {
    purpose:
      "Planifier, affecter et exécuter les courses de transport sanitaire des patients (prise de commande, attribution chauffeur et véhicule, suivi d'exécution).",
    legal_basis: 'contrat',
    data_categories: [
      'identité',
      'coordonnées',
      'adresses de prise en charge et de destination',
      'besoins de mobilité',
    ],
    data_subjects: ['patients'],
    recipients: ['personnel de régulation', 'chauffeur affecté'],
    retention_period_days: 1095,
    security_measures:
      "Hébergement avec contrôle d'accès, cloisonnement par organisation (RLS), accès authentifié restreint par rôle, journalisation des accès et des modifications.",
    international_transfer: false,
    international_transfer_safeguards: null,
  },
  // 2 — Facturation CGSS et comptabilité (base : obligation légale, 10 ans).
  {
    purpose:
      "Facturer les courses en tiers payant à la CGSS et tenir la comptabilité de l'entreprise.",
    legal_basis: 'obligation_legale',
    data_categories: [
      'identité',
      'numéro de sécurité sociale (NIR)',
      'prescriptions médicales de transport',
      'montants facturés',
    ],
    data_subjects: ['patients'],
    recipients: ['CGSS (organisme payeur)', 'expert-comptable'],
    retention_period_days: 3650,
    security_measures:
      'NIR chiffré (AES-256-GCM), clé conservée hors de la base de données ; cloisonnement par organisation (RLS) ; journalisation des accès et des modifications.',
    international_transfer: false,
    international_transfer_safeguards: null,
  },
  // 3 — Gestion des chauffeurs (base : exécution du contrat de travail).
  {
    purpose:
      'Gérer le personnel de conduite : embauche, suivi des habilitations (permis, carte professionnelle), affectation aux courses.',
    legal_basis: 'contrat',
    data_categories: [
      'identité',
      'coordonnées',
      'permis de conduire',
      'carte professionnelle de conducteur',
      'affectations et plannings',
    ],
    data_subjects: ['chauffeurs (salariés)'],
    recipients: ['dirigeant', 'personnel de régulation'],
    retention_period_days: 1825,
    security_measures:
      'Cloisonnement par organisation (RLS), accès restreint au dirigeant et à la régulation, journalisation des accès et des modifications. Durée de conservation à compter de la fin du contrat de travail.',
    international_transfer: false,
    international_transfer_safeguards: null,
  },
  // 4 — Données de santé pour l'adaptation du transport (base : mission
  // d'intérêt public ; catégorie particulière — condition art. 9-2).
  {
    purpose:
      'Adapter le transport aux besoins de santé du patient (mobilité réduite, dialyse, TPMR) : recueil des informations strictement nécessaires à un transport adapté et sûr.',
    legal_basis: 'mission_interet_public',
    data_categories: [
      'données de santé relatives à la mobilité et aux besoins de transport',
      'notes opérationnelles à caractère médical',
    ],
    data_subjects: ['patients'],
    recipients: ['personnel de régulation', "chauffeur affecté (selon le besoin d'en connaître)"],
    retention_period_days: 1825,
    security_measures:
      "Données de santé chiffrées au niveau applicatif, accès limité au besoin d'en connaître, cloisonnement par organisation (RLS), journalisation. Traitement nécessaire à la prise en charge sanitaire (condition de l'art. 9-2-h du RGPD : à confirmer avec votre conseil).",
    international_transfer: false,
    international_transfer_safeguards: null,
  },
  // 5 — Géolocalisation et adresses (base : exécution du contrat ; 90 j).
  {
    purpose:
      'Géolocaliser le véhicule pendant le service pour la régulation des courses et la preuve des interventions ; gérer les adresses de prise en charge et de destination.',
    legal_basis: 'contrat',
    data_categories: ['position géographique du véhicule pendant le service', 'adresses'],
    data_subjects: ['patients', 'chauffeurs'],
    recipients: ['personnel de régulation'],
    retention_period_days: 90,
    security_measures:
      'Capture uniquement pendant le service ; purge automatique à 90 jours ; cloisonnement par organisation (RLS) ; journalisation.',
    international_transfer: false,
    international_transfer_safeguards: null,
  },
  // 6 — Consentement aux cookies du site public (base : consentement).
  {
    purpose:
      'Recueillir et tracer le consentement des visiteurs du site public au dépôt de cookies.',
    legal_basis: 'consentement',
    data_categories: [
      'choix de consentement',
      'empreinte (hash) de session',
      'empreinte (hash) du navigateur',
    ],
    data_subjects: ['visiteurs du site public'],
    recipients: ['aucun (usage interne)'],
    retention_period_days: 395,
    security_measures:
      "Données pseudonymisées par hachage (pas d'identifiant direct) ; accès limité au rôle de service ; journalisation.",
    international_transfer: false,
    international_transfer_safeguards: null,
  },
];
