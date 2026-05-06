/**
 * Types domaine miroir des tables Supabase fondations.
 *
 * Ce fichier décrit la forme attendue côté TS. La source de vérité reste
 * `types.gen.ts` (généré via `pnpm db:types`). Quand le fichier généré
 * existe, importer plutôt depuis lui.
 */

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

/**
 * Forme minimale du schéma Database pour @supabase/supabase-js.
 * Sera remplacée par le type généré dès la première exécution de
 * `pnpm db:types`.
 */
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at' | 'date_creation'> &
          Partial<Pick<Organization, 'id' | 'date_creation'>>;
        Update: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> &
          Partial<Pick<Profile, 'actif'>>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'> & Partial<Pick<AuditLog, 'id'>>;
        Update: never;
      };
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
