import { z } from 'zod';
import { adresseSchema, telephoneReunionSchema, nirFieldSchema } from './common';

export const canalContactSchema = z.enum(['sms', 'appel', 'aucun']);
export type CanalContact = z.infer<typeof canalContactSchema>;

/**
 * Genre administratif (D-16) — liste close de 3 valeurs.
 * Aligné sur le CHECK genre in ('M','F','X') de public.patients.
 * Pas de label "autre" en clair pour respecter le mental model administratif
 * français (NIR commence par 1 ou 2 — on garde X pour les rares cas non
 * binaires sans rentrer dans un débat hors-scope V1).
 */
export const genreSchema = z.enum(['M', 'F', 'X']);
export type Genre = z.infer<typeof genreSchema>;

/**
 * Contact d'urgence — couple nom + téléphone réunionnais validé.
 * Champ optionnel sur le patient mais s'il est présent, les 2 sous-champs
 * sont obligatoires (zod object par défaut).
 */
export const contactUrgenceSchema = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  telephone: telephoneReunionSchema,
});
export type ContactUrgence = z.infer<typeof contactUrgenceSchema>;

/**
 * Normalisation NIR avant chiffrement / hash :
 * suppression des espaces et uppercase pour gérer la clé corse 2A/2B.
 * Source unique de normalisation — utiliser AVANT tout appel à l'Edge
 * Function nir-encrypt / nir-hash (PLAN-3).
 */
export function normalizeNir(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normalisation téléphone — strip espaces, points, tirets.
 * Aligné avec le transform interne de telephoneReunionSchema.
 * Utilisée pour la colonne telephone_normalized (recherche fuzzy, D-09).
 */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s.-]/g, '');
}

const nameRegex = /^[A-Za-zÀ-ÿ\s'-]+$/;
const nameMessage = 'Lettres uniquement (accents, tirets et apostrophes autorisés).';

function isPlausibleBirthDate(value: string): boolean {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!m) return false;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  // Date doit round-trip (refuse 30/02 → roule à 02/03)
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
    return false;
  }
  const ageYears = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return ageYears >= 0 && ageYears <= 130;
}

export const patientSchema = z
  .object({
    prenom: z.string().trim().min(1, 'Prénom requis').max(80).regex(nameRegex, nameMessage),
    nom: z.string().trim().min(1, 'Nom requis').max(80).regex(nameRegex, nameMessage),
    date_naissance: z
      .string()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format attendu : AAAA-MM-JJ')
      .refine(isPlausibleBirthDate, {
        message: 'Date invalide. Format attendu : JJ/MM/AAAA, âge entre 0 et 130 ans.',
      }),
    genre: genreSchema.optional(),
    telephone: telephoneReunionSchema.optional(),
    // NIR optionnel : peut être saisi plus tard, chiffré côté serveur.
    // Phase 04.5 hotfix : nirFieldSchema résout strict/format au runtime
    // via NEXT_PUBLIC_NIR_CHECKSUM_STRICT (cf. common.ts).
    nir: nirFieldSchema.optional(),
    adresse: adresseSchema,
    contact_urgence: contactUrgenceSchema.optional(),
    canal_contact_prefere: canalContactSchema.default('appel'),
    consentement_sms: z.boolean().default(false),
    consentement_sms_at: z.string().datetime({ offset: true }).optional(),
    notes_operationnelles: z.string().trim().max(500).optional(),
    archive: z.boolean().default(false),
  })
  .refine((data) => !data.consentement_sms || Boolean(data.consentement_sms_at), {
    message: 'Horodatage de consentement requis si consentement_sms = true.',
    path: ['consentement_sms_at'],
  });

export type PatientInput = z.infer<typeof patientSchema>;
