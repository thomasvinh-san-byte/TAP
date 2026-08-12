import 'server-only';

/**
 * Release toggles (pattern Fowler, DEC-141/144) — évaluation CENTRALISÉE et
 * uniforme (côté serveur).
 *
 * Deux régimes distincts :
 *
 * 1. Features LIVRÉES (périmètre construit et mergé) → **ON par défaut**. La
 *    variable d'environnement devient un simple KILL-SWITCH : poser `= "false"`
 *    pour désactiver en cas d'incident. Absente ou vide = activée. C'est le cas
 *    de la messagerie interne (§5.22 : fil général + non-lu + photo) et de
 *    l'upload de justificatifs (Supabase Storage, bucket privé, DEC-077, sous
 *    DPA en bêta).
 *
 * 2. Features en ÉCHAFAUDAGE (dépendance externe non satisfaite) → **OFF par
 *    défaut**, activées explicitement (`=== 'true'`). Évaluées à leur point
 *    d'usage, PAS ici : `GEOLOC_ENABLED` (attend l'HDS — donnée de santé,
 *    DEC-075) et `EMAIL_ENABLED` (attend le choix d'un provider ; `send()`
 *    reste no-op). Les exposer produirait une coquille non fonctionnelle.
 */

/** Messagerie interne (§5.22) — LIVRÉE → ON par défaut (kill-switch `MESSAGING_ENABLED=false`). */
export function isMessagingEnabled(): boolean {
  return process.env.MESSAGING_ENABLED !== 'false';
}

/** Upload de justificatifs (Supabase Storage, DEC-077) — LIVRÉ → ON par défaut (kill-switch `UPLOAD_DOCS_ENABLED=false`). */
export function isUploadDocsEnabled(): boolean {
  return process.env.UPLOAD_DOCS_ENABLED !== 'false';
}
