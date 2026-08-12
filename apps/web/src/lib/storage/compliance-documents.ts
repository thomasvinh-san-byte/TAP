import 'server-only';
import type { ComplianceEntityType } from '@tap/shared';

/**
 * Accès Storage des justificatifs de conformité — ENCAPSULÉ (CON-001).
 *
 * Toute la connaissance du bucket (nom, chemin, contraintes) vit ici : migrer le
 * bucket vers une infra HDS en prod ne touchera que ce module, pas les appelants.
 * Bucket PRIVÉ — la lecture passe par URL signée (jamais d'URL publique).
 */

export const COMPLIANCE_BUCKET = 'compliance-documents';

/** Liste blanche MIME (cohérente avec `allowed_mime_types` du bucket). */
export const COMPLIANCE_ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** Taille max (cohérente avec `file_size_limit` du bucket : 10 Mio). */
export const COMPLIANCE_MAX_BYTES = 10 * 1024 * 1024;

/** Durée de validité d'une URL signée de lecture (secondes) — courte. */
export const COMPLIANCE_SIGNED_URL_TTL = 120;

/** Normalise un nom de fichier (évite les caractères de chemin / exotiques). */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return cleaned.slice(0, 100) || 'document';
}

/**
 * Construit le chemin d'objet org-scoped :
 * `{organization_id}/{entity_type}/{entity_id|org}/{uuid}-{fichier}`.
 * Le 1er segment (organisation) est la clé de cloisonnement RLS ; l'UUID rend le
 * chemin non devinable.
 */
export function buildCompliancePath(args: {
  organizationId: string;
  entityType: ComplianceEntityType;
  entityId: string | null;
  filename: string;
  uuid: string;
}): string {
  const entitySegment = args.entityId ?? 'org';
  return `${args.organizationId}/${args.entityType}/${entitySegment}/${args.uuid}-${sanitizeFilename(args.filename)}`;
}

/** Vérifie que le chemin appartient bien à l'organisation (défense applicative). */
export function pathBelongsToOrg(path: string, organizationId: string): boolean {
  return path.split('/')[0] === organizationId;
}
