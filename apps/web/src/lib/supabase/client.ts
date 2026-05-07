/**
 * Client Supabase côté navigateur (composants client).
 * Re-export thin depuis @tap/database (ADR-001 — apps/* dépendent uniquement de packages/*).
 */
export { createSupabaseBrowserClient as createClient } from '@tap/database';
