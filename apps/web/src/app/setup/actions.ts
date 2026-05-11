'use server';

/**
 * Server Actions /setup — détection d'état DB + init résiliente
 *
 * 3 états DB possibles :
 *   1. fresh   : aucune table → applique MIGRATIONS_SQL + SEED_SQL
 *   2. partial : tables OK mais seed pas fini → applique SEED_SQL seul (idempotent)
 *   3. ready   : tables + comptes auth OK → redirect /login
 *
 * Détection :
 *   - profiles count > 0 → state = ready
 *   - organizations table existe sans profiles peuplé → state = partial
 *   - organizations n'existe pas → state = fresh
 *
 * Le seed est idempotent grâce à `on conflict do update` dans seed.sql.
 * Les migrations ne le sont PAS — on les saute si la table organizations
 * existe déjà.
 */

import { Client } from 'pg';
import { MIGRATIONS_SQL, SEED_SQL } from '@/lib/setup-sql';

export type SetupResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type DatabaseState = 'fresh' | 'partial' | 'ready';

interface CheckResult {
  state: DatabaseState;
  reason: string;
}

function getConnectionString(): string | null {
  return (
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL ??
    null
  );
}

function newClient(connectionString: string, timeoutMs: number) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: timeoutMs,
    query_timeout: timeoutMs,
    connectionTimeoutMillis: 8_000,
  });
}

export async function checkDatabaseState(): Promise<CheckResult> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return { state: 'fresh', reason: 'POSTGRES_URL_NON_POOLING absent' };
  }

  const client = newClient(connectionString, 5_000);
  try {
    await client.connect();

    // 1. Tables présentes ?
    const tableCheck = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'profiles'
       ) as exists;`,
    );
    if (!tableCheck.rows[0]?.exists) {
      return { state: 'fresh', reason: 'Tables non créées' };
    }

    // 2. Comptes auth peuplés ?
    const profileCount = await client.query<{ count: string }>(
      'select count(*)::text as count from public.profiles;',
    );
    const count = Number(profileCount.rows[0]?.count ?? '0');
    if (count >= 3) {
      return { state: 'ready', reason: `${count} comptes en base` };
    }

    return {
      state: 'partial',
      reason: `Tables OK mais ${count} profil(s) sur 4 attendus`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { state: 'fresh', reason: `Échec détection (${msg})` };
  } finally {
    await client.end().catch(() => {});
  }
}

/** API publique conservée (signature ancienne) — wrapper sur checkDatabaseState. */
export async function checkDatabaseReady(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const { state, reason } = await checkDatabaseState();
  return { ready: state === 'ready', reason };
}

export async function initializeDatabase(): Promise<SetupResult> {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return {
      ok: false,
      error:
        "Connexion Postgres non configurée. Installer l'intégration Vercel ↔ Supabase d'abord.",
    };
  }

  // Détecte ce qui doit être appliqué
  const { state } = await checkDatabaseState();
  if (state === 'ready') {
    return {
      ok: true,
      message: 'Base déjà initialisée. Tu peux te connecter.',
    };
  }

  const client = newClient(connectionString, 55_000);
  try {
    await client.connect();

    // Verrou applicatif pour éviter race avec un autre init concurrent
    // (autre onglet, ou cd.yml en parallèle).
    await client.query('select pg_advisory_lock(74321);');

    try {
      if (state === 'fresh') {
        await client.query(MIGRATIONS_SQL);
      }
      // Le seed est toujours appliqué (idempotent via on conflict do update).
      await client.query(SEED_SQL);
    } finally {
      await client.query('select pg_advisory_unlock(74321);').catch(() => {});
    }

    return {
      ok: true,
      message:
        state === 'fresh'
          ? 'Base initialisée : 10 migrations + 4 comptes démo + 10 patients fictifs.'
          : 'Comptes démo (re)créés. Tu peux te connecter.',
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
