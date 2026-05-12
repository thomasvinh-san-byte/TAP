/**
 * Barrel des Server Actions du référentiel patient.
 *
 * Découpage en plusieurs fichiers pour respecter CLAUDE.md § 11 (≤ 300 L
 * par fichier) tout en gardant un point d'import unique côté UI :
 *   `import { ... } from '@/app/(app)/patients/actions'`
 *
 * - `_existing.ts` : actions héritées (create / update / decryptNir /
 *   searchPatientsAction / getPatientByIdAction).
 *
 * Plan 03.1-01 ajoutera ici l'export de `getPatientRideDefaultsAction`
 * via un fichier dédié `./get-ride-defaults.ts`.
 */
export * from './_existing';
