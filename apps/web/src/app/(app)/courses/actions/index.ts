/**
 * Barrel d'exports public du module Server Actions Courses.
 *
 * Découpage interne (CLAUDE.md § 11 — ≤ 300 lignes par fichier) :
 *   - `_shared.ts`    : helpers + ActionState (sans 'use server')
 *   - `create.ts`     : createRideAction + drafts (upsert / delete / list)
 *   - `assignment.ts` : assignRideAction + unassignRideAction
 *   - `payment.ts`    : updateRidePaymentAction
 *   - `list.ts`       : wrappers `useQuery` (rides simples / enrichis /
 *                       audit / drivers / vehicles)
 *
 * Les callers importent inchangés via `import { ... } from '../actions'`
 * (Next.js + TS résolvent automatiquement vers `actions/index.ts`).
 */

export type { ActionState } from './_shared';

export { createRideAction, upsertRideDraft, deleteRideDraft, listDraftsAction } from './create';
export { assignRideAction, unassignRideAction } from './assignment';
export { updateRidePaymentAction } from './payment';
export {
  listRidesAction,
  listRidesEnrichedAction,
  getRideByIdAction,
  getRideAuditLogAction,
  listActiveDriversAction,
  listActiveVehiclesAction,
} from './list';
