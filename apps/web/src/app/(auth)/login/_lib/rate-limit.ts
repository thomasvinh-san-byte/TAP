import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Limitation applicative de la CONNEXION (durcissement force brute / bourrage
 * d'identifiants). Généralise la brique du portail public
 * (`legal/request/[token]/_lib/rate-limit.ts`) à deux dimensions :
 *
 *   - PAR COMPTE (empreinte de l'identifiant) — protection principale ;
 *   - PAR ORIGINE réseau (empreinte de l'IP) — complément.
 *
 * Fenêtre glissante : on compte les tentatives récentes (succès OU échec) et on
 * refuse au-delà du seuil de l'une OU l'autre dimension. Le compteur n'est PAS
 * remis à zéro sur une connexion réussie (sinon la protection se contourne).
 *
 * Anti-déni-de-service : ralentissement progressif, jamais de verrouillage dur.
 * L'appelant NE réenregistre PAS une tentative déjà bloquée → la fenêtre draine
 * d'elle-même même sous attaque continue, et l'utilisateur légitime récupère
 * (voie de reprise : mot de passe oublié, non concernée par cette limite).
 *
 * Confidentialité : identifiant et IP ne sont JAMAIS stockés en clair — seules
 * des empreintes SHA-256. Écriture via le client service_role (table non
 * lisible par les rôles applicatifs).
 */

/** Fenêtre glissante commune aux deux dimensions. */
const WINDOW_MS = 15 * 60_000; // 15 minutes
/** Seuil par compte — bas (un utilisateur légitime dépasse rarement). */
export const MAX_ATTEMPTS_PER_ACCOUNT = 10;
/** Seuil par origine — plus haut (sortie réseau partagée = plusieurs légitimes). */
export const MAX_ATTEMPTS_PER_IP = 40;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Empreinte de l'identifiant (email normalisé) — jamais l'email en clair. */
function identifierHash(email: string): string {
  return sha256(email.trim().toLowerCase());
}

/** Empreinte de l'origine réseau — jamais l'IP en clair. */
function ipHash(ip: string): string {
  return sha256(ip);
}

async function countSince(column: 'identifier_hash' | 'ip_hash', hash: string): Promise<number> {
  const sb = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await sb
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq(column, hash)
    .gte('attempted_at', since);
  return count ?? 0;
}

export type ThrottleResult = { limited: boolean; reason?: 'account' | 'ip' };

/**
 * Vérifie la limite AVANT toute tentative d'authentification. Ne compte que —
 * n'enregistre rien (pour ne pas prolonger la fenêtre sous attaque continue).
 */
export async function checkLoginThrottle(input: {
  email: string;
  ip: string;
}): Promise<ThrottleResult> {
  const [accountCount, ipCount] = await Promise.all([
    countSince('identifier_hash', identifierHash(input.email)),
    countSince('ip_hash', ipHash(input.ip)),
  ]);
  if (accountCount >= MAX_ATTEMPTS_PER_ACCOUNT) return { limited: true, reason: 'account' };
  if (ipCount >= MAX_ATTEMPTS_PER_IP) return { limited: true, reason: 'ip' };
  return { limited: false };
}

/**
 * Enregistre une tentative RÉELLEMENT effectuée (succès ou échec), avec ses deux
 * empreintes. À n'appeler QUE pour une tentative non bloquée (anti-DoS).
 */
export async function recordLoginAttempt(input: {
  email: string;
  ip: string;
  success: boolean;
}): Promise<void> {
  const sb = createAdminClient();
  await sb.from('login_attempts').insert({
    identifier_hash: identifierHash(input.email),
    ip_hash: ipHash(input.ip),
    success: input.success,
  });
}
