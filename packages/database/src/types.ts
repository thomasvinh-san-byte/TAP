/**
 * Types domaine miroir des tables Supabase.
 *
 * La source de vérité du type `Database` est `./types.gen.ts`, régénéré
 * via `pnpm db:types` après chaque migration. Le re-export ci-dessous est
 * la voie unique pour les consommateurs (`@tap/database`).
 *
 * Les interfaces locales `Organization`, `Profile`, `AuditLog` et `UserRole`
 * sont conservées comme types domaine lisibles à utiliser directement dans
 * la logique métier (ex : `function archive(org: Organization)`). Elles
 * restent alignées sur les types générés mais ne sont plus utilisées par
 * le `Database` type — celui-ci provient désormais exclusivement de
 * `types.gen.ts`.
 */

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './types.gen';

export type UserRole = 'dirigeant' | 'regulateur' | 'chauffeur';

export interface Organization {
  id: string;
  nom: string;
  siret: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  numero_agrement_cgss: string | null;
  date_creation: string;
  date_archivage: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  role: UserRole;
  prenom: string;
  nom: string;
  telephone: string | null;
  email: string;
  actif: boolean;
  date_archivage: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
