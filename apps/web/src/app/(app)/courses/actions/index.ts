/**
 * Barrel d'exports public du module Server Actions Courses.
 *
 * Découpage interne (CLAUDE.md § 11 — ≤ 300 lignes par fichier) :
 *   - `_shared.ts`    : helpers + ActionState (sans 'use server')
 *   - `create.ts`     : createRideAction + drafts (upsert / delete / list)
 *   - `edit.ts`       : updateRideAction (édition course validee/assignee)
 *   - `cancel.ts`     : cancelRideAction (annulation course validee/assignee)
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
export { updateRideAction } from './edit';
export { checkDuplicateRideAction } from './check-duplicate';
export { cancelRideAction } from './cancel';
export { assignRideAction, unassignRideAction, assignVehicleAction } from './assignment';
export { updateRidePaymentAction } from './payment';
export { exportCaisseCsvAction } from './caisse';
export type { ExportCaisseResult } from './caisse';
export { overrideRideTarifAction } from './override';
export type { OverrideTarifState } from './override';
export {
  listRidesAction,
  listRidesEnrichedAction,
  getRideByIdAction,
  getRideAuditLogAction,
  listActiveDriversAction,
  listActiveVehiclesAction,
  getActiveTariffGridAction,
  getAssignmentComplianceContextAction,
} from './list';
