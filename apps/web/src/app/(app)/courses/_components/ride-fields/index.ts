/**
 * Barrel `ride-fields/` — API publique des sous-composants du modal saisie
 * express d'une course (Phase 06.27 lot 4).
 *
 * Issu du découpage de `ride-express-form-fields.client.tsx` (493 l.,
 * > limite CON-008 de 300) en 5 modules par responsabilité :
 *
 *   - `types.ts`                       — types + options (TransportMode, Urgency)
 *   - `datetime-helpers.ts`            — helpers purs date/heure (testable)
 *   - `masked-inputs.client.tsx`       — DateMaskedInput, TimeMaskedInput
 *   - `datetime-fields.client.tsx`     — DateTimeFields (react-datepicker)
 *   - `field-groups.client.tsx`        — AddressField, ModeUrgencyFields,
 *                                        NotesField, SavingIndicator
 *
 * L'API publique (noms d'exports) est PRÉSERVÉE — comportement inchangé.
 */

export type { TransportMode, Urgency } from './types';
export { DateTimeFields } from './datetime-fields.client';
export {
  AddressField,
  ModeUrgencyFields,
  NotesField,
  SavingIndicator,
} from './field-groups.client';
