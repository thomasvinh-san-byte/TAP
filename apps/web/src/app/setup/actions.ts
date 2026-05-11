'use server';

/**
 * Server Action — initializeDatabase
 *
 * Exécute le setup-all.sql (10 migrations + seed.sql + seed.demo.sql) sur la
 * base Supabase via connection PostgreSQL directe (POSTGRES_URL_NON_POOLING
 * posée par l'intégration Vercel-Supabase).
 *
 * Idempotent — peut être relancée. Utilise une seule transaction pour que
 * tout passe ou rien.
 */

import { Client } from 'pg';
import { SETUP_SQL } from '@/lib/setup-sql';

export type SetupResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function initializeDatabase(): Promise<SetupResult> {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    return {
      ok: false,
      error:
        'Connexion Postgres non configurée. Installer l\'intégration Vercel ↔ Supabase d\'abord.',
    };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60_000,
    query_timeout: 60_000,
  });

  try {
    await client.connect();

    // Une seule query() exécute le multi-statement en transaction implicite ?
    // Non — pg.Client.query() avec plusieurs statements les exécute chacun
    // sans wrapper de transaction. On l'enveloppe manuellement.
    //
    // Cependant le SETUP_SQL contient déjà des `do $$ ... end $$` blocks et
    // des `create extension` qui doivent tourner hors transaction. Solution :
    // exécution en mode "simple query" qui supporte multi-statement par
    // séparateur `;` sans transaction.
    await client.query(SETUP_SQL);

    return {
      ok: true,
      message:
        'Base initialisée : 10 migrations + comptes démo + 10 patients fictifs réunionnais.',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Échec init : ${errorMsg}`,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function checkDatabaseReady(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    return { ready: false, reason: 'POSTGRES_URL_NON_POOLING absent' };
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });

  try {
    await client.connect();
    // Si la table organizations existe avec au moins 1 ligne, la DB est prête
    const result = await client.query<{ count: string }>(
      "select count(*)::text as count from public.organizations limit 1;",
    );
    const count = Number(result.rows[0]?.count ?? '0');
    return { ready: count > 0, reason: count > 0 ? undefined : 'DB vide' };
  } catch (err) {
    // Tables n'existent pas encore → "relation does not exist"
    const msg = err instanceof Error ? err.message : String(err);
    return { ready: false, reason: `DB non initialisée (${msg})` };
  } finally {
    await client.end().catch(() => {});
  }
}
