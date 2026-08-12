import 'server-only';

/**
 * Accès Storage des photos de messagerie interne — ENCAPSULÉ (CON-001, même
 * doctrine que `compliance-documents`). Bucket PRIVÉ : lecture par URL signée
 * uniquement (jamais d'URL publique). Migrer vers HDS en prod ne touchera que
 * ce module.
 */

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments';

/** Liste blanche MIME (cohérente avec `allowed_mime_types` du bucket). */
export const MESSAGE_IMAGE_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Taille max (cohérente avec `file_size_limit` du bucket : 5 Mio). */
export const MESSAGE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** URL signée de lecture — TTL court. */
export const MESSAGE_IMAGE_SIGNED_URL_TTL = 300;

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'photo';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 100) || 'photo';
}

/**
 * Chemin d'objet org-scoped : `{organization_id}/{ride_id}/{uuid}-{fichier}`.
 * Le 1er segment (organisation) est la clé de cloisonnement RLS.
 */
export function buildMessageImagePath(args: {
  organizationId: string;
  rideId: string;
  filename: string;
  uuid: string;
}): string {
  return `${args.organizationId}/${args.rideId}/${args.uuid}-${sanitizeFilename(args.filename)}`;
}
