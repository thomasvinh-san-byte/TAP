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

export type SetupResult = { ok: true; message: string } | { ok: false; error: string };

export type DatabaseState = 'fresh' | 'partial' | 'ready';

interface CheckResult {
  state: DatabaseState;
  reason: string;
}

function getConnectionString(): string | null {
  const raw =
    process.env.DATABASE_URL ?? // neutre (OVH, self-host) — prioritaire
    process.env.POSTGRES_URL_NON_POOLING ?? // injecté par l'intégration Vercel (repli)
    process.env.POSTGRES_URL ??
    null;
  if (!raw) return null;

  // Retire sslmode de l'URL pour laisser l'objet ssl du Client gagner.
  // Sinon node-postgres valide le cert auto-signé Supabase et plante avec
  // "self-signed certificate in certificate chain".
  try {
    const url = new URL(raw);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw;
  }
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
    return {
      state: 'fresh',
      reason: 'Aucune URL de connexion (DATABASE_URL / POSTGRES_URL absent)',
    };
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
  // OVH-05 — verrou de SÉCURITÉ côté serveur : l'init crée des données de démo,
  // elle ne doit JAMAIS être atteignable en production HDS. OFF par défaut ; à
  // poser explicitement (DEMO_SETUP_ENABLED=true) en dev/démo uniquement.
  if (process.env.DEMO_SETUP_ENABLED !== 'true') {
    return {
      ok: false,
      error:
        'Initialisation démo désactivée (DEMO_SETUP_ENABLED OFF). En production, la base est ' +
        "provisionnée et migrée par l'équipe, pas via ce bouton.",
    };
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    return {
      ok: false,
      error: 'Connexion Postgres non configurée (définir DATABASE_URL).',
    };
  }

  // Détecte l'état. Le SEED est RÉAPPLIQUÉ dans TOUS les états, y compris
  // `ready` : sur le distant, les comptes existent déjà (→ `ready`) mais le seed
  // des courses/patients a pu ne jamais être rejoué (planning/carte vides). Le
  // seed est idempotent (`on conflict` partout) → sûr à rejouer. Seul le SCHÉMA
  // (`MIGRATIONS_SQL`, non idempotent) reste réservé à `fresh`.
  const { state } = await checkDatabaseState();

  const client = newClient(connectionString, 55_000);
  try {
    await client.connect();

    // Verrou applicatif pour éviter race avec un autre init concurrent
    // (autre onglet, ou cd.yml en parallèle).
    await client.query('select pg_advisory_lock(74321);');

    let patients = 0;
    let rides = 0;
    try {
      if (state === 'fresh') {
        await client.query(MIGRATIONS_SQL);
      }
      // Seed idempotent (on conflict do update/nothing) — rejoué à chaque appel.
      await client.query(SEED_SQL);

      // Message HONNÊTE : compter réellement ce qui est en base après le seed
      // (plus de « 10 patients fictifs » en dur).
      const counts = await client.query<{ patients: string; rides: string }>(
        'select (select count(*) from public.patients)::text as patients, ' +
          '(select count(*) from public.rides)::text as rides;',
      );
      patients = Number(counts.rows[0]?.patients ?? '0');
      rides = Number(counts.rows[0]?.rides ?? '0');
    } finally {
      await client.query('select pg_advisory_unlock(74321);').catch(() => {});
    }

    const schemaNote =
      state === 'fresh'
        ? 'Schéma créé, données de démo appliquées'
        : 'Données de démo (ré)appliquées';
    return {
      ok: true,
      message: `${schemaNote} : ${patients} patient${patients > 1 ? 's' : ''} et ${rides} course${
        rides > 1 ? 's' : ''
      } en base.`,
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
