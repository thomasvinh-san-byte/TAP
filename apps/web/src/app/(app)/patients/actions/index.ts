/**
 * Barrel des Server Actions du référentiel patient.
 *
 * Découpage en plusieurs fichiers pour respecter CLAUDE.md § 11 (≤ 300 L
 * par fichier) tout en gardant un point d'import unique côté UI :
 *   `import { ... } from '@/app/(app)/patients/actions'`
 *
 * - `_existing.ts` : actions héritées (create / update / decryptNir /
 *   searchPatientsAction / getPatientByIdAction).
 * - `get-ride-defaults.ts` : `getPatientRideDefaultsAction` (Plan 03.1-01,
 *   smart defaults mode + urgence depuis la dernière course du patient).
 */
export * from './_existing';
export * from './get-ride-defaults';
export * from './archive';
export * from './recurrences';
export * from './prescriptions';
