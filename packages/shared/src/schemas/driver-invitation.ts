import { z } from 'zod';

/**
 * Schémas Zod du workflow d'invitation chauffeur (Phase 04, PLAN-3).
 *
 * Schémas DÉLIBÉRÉMENT séparés de `driverInputSchema` (DEC-026) — la fiche
 * chauffeur (référentiel RH dirigeant, Passe 1) et l'invitation (création
 * d'un compte auth, Passe 2) sont deux opérations distinctes avec deux
 * jeux de champs disjoints.
 *
 * Aligné avec :
 *   - migration `supabase/migrations/20260514000002_driver_invitations.sql`
 *   - DEC-027 (CGU obligatoire + audit log applicatif côté
 *     `acceptInvitationAction`)
 *   - NIST 2020+ password guidance (longueur seule, pas de complexity rule)
 */

// ─── Invitation côté dirigeant (inviteDriverAction) ─────────────────────
export const driverInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: 'Adresse e-mail invalide.' })
    .max(254, { message: 'Adresse e-mail trop longue.' }),
  driverId: z
    .string()
    .uuid({ message: 'Identifiant chauffeur invalide.' }),
});
export type DriverInvitationInput = z.infer<typeof driverInvitationSchema>;

// ─── Acceptation côté chauffeur (acceptInvitationAction) ────────────────
// NB : pas de règle de complexité — NIST SP 800-63B 2020+ recommande la
// longueur seule comme critère de force.
export const acceptInvitationSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: 'Mot de passe trop court (8 caractères minimum).' })
      .max(128, { message: 'Mot de passe trop long.' }),
    confirmPassword: z.string(),
    cguAccepted: z.literal(true, {
      errorMap: () => ({
        message: 'Vous devez accepter les CGU pour continuer.',
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
