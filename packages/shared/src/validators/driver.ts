import { z } from 'zod';

/**
 * Validateur input chauffeur (clôture-bis Passe 1).
 *
 * Aligné sur le schéma SQL `public.drivers` (migration 011) :
 *   nom_affichage / telephone / numero_licence / type_permis (text[])
 *   / actif. `profile_id` est rattaché plus tard (invitation chauffeur,
 *   Passe 2+) — pas exposé dans le formulaire dirigeant V1.
 *
 * `type_permis` accepte un sous-ensemble {taxi, ambulance, vsl, tpmr}
 * — la DB ne contraint pas (text[] libre) mais le zod cadre l'UI.
 */
export const TYPE_PERMIS_VALUES = ['taxi', 'ambulance', 'vsl', 'tpmr'] as const;
export type TypePermis = (typeof TYPE_PERMIS_VALUES)[number];

/**
 * Statut chauffeur (§5.6, CHAUFFEUR-01) — source de vérité unique côté DB
 * (colonne `drivers.status`). `archive` n'est pas saisi via le formulaire : il
 * relève du flux d'archivage dédié (motif + confirmation, dirigeant).
 */
export const DRIVER_STATUS_VALUES = ['actif', 'conge', 'suspendu', 'archive'] as const;
export type DriverStatus = (typeof DRIVER_STATUS_VALUES)[number];

/** Statuts saisissables dans le formulaire chauffeur (hors archivage). */
export const DRIVER_FORM_STATUS_VALUES = ['actif', 'conge', 'suspendu'] as const;
export type DriverFormStatus = (typeof DRIVER_FORM_STATUS_VALUES)[number];

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  actif: 'Actif',
  conge: 'En congé',
  suspendu: 'Suspendu',
  archive: 'Archivé',
};

/**
 * Compétences chauffeur (§5.6, CHAUFFEUR-02) — énumération fermée extensible
 * (colonne `drivers.competences` text[], sans check DB). Attribut d'affectation :
 * éclaire le choix du régulateur, hors solveur.
 */
export const DRIVER_COMPETENCE_VALUES = [
  'accueil_personnes_agees',
  'gestion_fauteuil',
  'conduite_douce',
] as const;
export type DriverCompetence = (typeof DRIVER_COMPETENCE_VALUES)[number];

export const DRIVER_COMPETENCE_LABELS: Record<DriverCompetence, string> = {
  accueil_personnes_agees: 'Accueil personnes âgées',
  gestion_fauteuil: 'Gestion fauteuil roulant',
  conduite_douce: 'Conduite douce',
};

/**
 * Langues parlées par le chauffeur (§5.6, CHAUFFEUR-02) — énumération fermée
 * extensible (colonne `drivers.langues` text[], sans check DB).
 */
export const DRIVER_LANGUE_VALUES = ['francais', 'creole', 'anglais'] as const;
export type DriverLangue = (typeof DRIVER_LANGUE_VALUES)[number];

export const DRIVER_LANGUE_LABELS: Record<DriverLangue, string> = {
  francais: 'Français',
  creole: 'Créole',
  anglais: 'Anglais',
};

export const driverInputSchema = z.object({
  nom_affichage: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(80, 'Le nom doit faire au maximum 80 caractères.'),
  telephone: z.string().trim().max(20).optional().or(z.literal('')),
  numero_licence: z.string().trim().max(40).optional().or(z.literal('')),
  type_permis: z.array(z.enum(TYPE_PERMIS_VALUES)).default([]),
  competences: z.array(z.enum(DRIVER_COMPETENCE_VALUES)).default([]),
  langues: z.array(z.enum(DRIVER_LANGUE_VALUES)).default([]),
  status: z.enum(DRIVER_FORM_STATUS_VALUES).default('actif'),
});

export type DriverInput = z.infer<typeof driverInputSchema>;

/**
 * Confirmation renforcée pour archivage chauffeur (DEC-029 hotfix Phase 04).
 *
 * Élargissement du droit d'archivage au régulateur (option C dirigeant) :
 * pour limiter les erreurs irréversibles, exiger un motif libre + saisie
 * explicite du mot « ARCHIVER » avant soumission. Le motif est tracé en BDD
 * (`drivers.archive_motif`) et dans `audit_logs` (action `driver_archived`).
 */
export const archiveDriverInputSchema = z.object({
  motif: z
    .string()
    .trim()
    .min(10, 'Motif requis (10 caractères minimum).')
    .max(500, 'Motif trop long (500 caractères maximum).'),
  confirmation: z.literal('ARCHIVER', {
    errorMap: () => ({
      message: 'Saisir exactement « ARCHIVER » pour confirmer.',
    }),
  }),
});

export type ArchiveDriverInput = z.infer<typeof archiveDriverInputSchema>;

/**
 * Confirmation simple — désactivation chauffeur (DEC-029 sémantique 4
 * actions). Réversible facilement (réactivation instantanée), un simple
 * coche suffit.
 */
export const deactivateDriverInputSchema = z.object({
  confirmation: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation requise.' }),
  }),
});

export type DeactivateDriverInput = z.infer<typeof deactivateDriverInputSchema>;

/**
 * Confirmation simple — désarchivage chauffeur (DEC-029 sémantique 4
 * actions). Le chauffeur est réintégré au système, désactivé par défaut.
 */
export const unarchiveDriverInputSchema = z.object({
  confirmation: z.literal(true, {
    errorMap: () => ({ message: 'Confirmation requise.' }),
  }),
});

export type UnarchiveDriverInput = z.infer<typeof unarchiveDriverInputSchema>;
