---
phase: 01-referentiel-patients
plan: 3
type: execute
wave: 1
depends_on: [1]
files_modified:
  - supabase/functions/nir/index.ts
  - supabase/functions/nir/_shared/auth.ts
  - supabase/functions/nir/_shared/crypto.ts
  - supabase/functions/_shared/cors.ts
  - .env.example
autonomous: true
requirements:
  - PAT-02
  - PAT-07
must_haves:
  truths:
    - "L'Edge Function nir expose 3 endpoints (encrypt, decrypt, hash) et refuse 401 sans JWT valide"
    - "Le NIR ne sort jamais en clair des logs serveur ni des stack traces (réponse 'NIR illisible' / 'Non autorisé')"
    - "L'endpoint decrypt insère lui-même une ligne audit_logs action='patient.nir.decrypt' avec entity_id = patient_id"
    - "Le format ciphertext bytea = version (1 byte 0x01) || iv (12) || ciphertext || tag (16)"
    - "L'action encrypt retourne { nir_encrypted, nir_search_hash, nir_last4 } — nir_last4 au format 'XX YY' (regex /^[0-9]{2} [0-9]{2}$/) calculé sur le NIR normalisé (B-6 fix)"
    - "Les 6 tests Deno de PLAN-1 passent en GREEN"
    - "Les clés APP_NIR_ENCRYPTION_KEY et APP_NIR_SEARCH_KEY sont distinctes, jamais commit, déclarées dans .env.example sans valeur"
  artifacts:
    - path: supabase/functions/nir/index.ts
      provides: "Handler HTTP serve() avec dispatch encrypt/decrypt/hash + auth JWT + audit"
      min_lines: 80
    - path: supabase/functions/nir/_shared/crypto.ts
      provides: "encryptNir, decryptNir, hashNir, normalizeNir helpers Deno"
      min_lines: 60
    - path: supabase/functions/nir/_shared/auth.ts
      provides: "withAuth(handler) wrapper qui vérifie JWT et expose user + organization_id"
      min_lines: 30
    - path: .env.example
      provides: "Documentation des 2 secrets (sans valeurs)"
      min_lines: 1
  key_links:
    - from: supabase/functions/nir/index.ts
      to: supabase/functions/nir/_shared/auth.ts
      via: import withAuth
      pattern: "withAuth"
    - from: supabase/functions/nir/index.ts
      to: public.audit_logs
      via: supabase admin client insert
      pattern: "patient.nir.decrypt"
    - from: supabase/functions/nir/_shared/crypto.ts
      to: Web Crypto API
      via: crypto.subtle.encrypt / sign
      pattern: "AES-GCM|HMAC.*SHA-256"
---

<objective>
Livrer l'Edge Function `nir` qui isole la cryptographie NIR du bundle Vercel : 3 endpoints HTTP authentifiés JWT pour encrypt / decrypt / hash, avec audit log forcé sur decrypt et zéro fuite de NIR clair en logs.

Purpose: la clé `APP_NIR_ENCRYPTION_KEY` ne doit JAMAIS toucher le bundle Next.js. Cette Edge Function est l'unique surface où le NIR clair existe en mémoire ; elle reste minimaliste (3 fonctions pures + 1 dispatcher + 1 wrapper auth) pour être auditable.

Output: 1 handler ≤ 80 lignes + 2 modules `_shared` + tests Deno GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-referentiel-patients/01-CONTEXT.md
@.planning/phases/01-referentiel-patients/01-RESEARCH.md
@.planning/phases/01-referentiel-patients/01-PATTERNS.md
@CLAUDE.md
@supabase/functions/nir/index.test.ts

<interfaces>
<!-- Format payload bytea (D-01 + open question §2 RESEARCH adoptée : préfixe version) -->
bytea = version (1, 0x01) || iv (12) || ciphertext (variable) || auth_tag (16)
- Pour NIR 13 chars : payload = 1 + 12 + 13 + 16 = 42 bytes

<!-- Variables d'environnement Edge Function (Deno.env.get) -->
APP_NIR_ENCRYPTION_KEY  : 32 bytes base64, jamais commit
APP_NIR_SEARCH_KEY      : 32 bytes base64 distincte, jamais commit
SUPABASE_URL            : auto-injecté Supabase (https://<ref>.supabase.co)
SUPABASE_SERVICE_ROLE_KEY : auto-injecté Supabase (utilisé pour audit_logs INSERT après vérif JWT du caller)
SUPABASE_ANON_KEY       : auto-injecté Supabase

<!-- Endpoints HTTP -->
POST /functions/v1/nir          { action: 'encrypt', nir: string }              → { nir_encrypted: base64, nir_search_hash: base64, nir_last4: string ("XX YY") }
POST /functions/v1/nir          { action: 'decrypt', encrypted: base64, patientId: uuid } → { nir: string } + audit insert
POST /functions/v1/nir          { action: 'hash', nir: string }                 → { hash: base64 }

<!-- Tests Deno qui contraignent l'API (PLAN-1 tâche 2) -->
Imports attendus depuis ./index.ts : encryptNir, decryptNir, hashNir, handler
6 cas : round-trip, IV unique, hash déterministe + normalisation, hash ≠ encrypt, JWT 401, audit insert sur decrypt
+ cas additionnel B-6 : encrypt action returns nir_last4 au format "XX YY" (regex /^[0-9]{2} [0-9]{2}$/)
  - Ex : encrypt({ nir: '185097401234567' }) → nir_last4 === '45 67' (les 4 derniers chars `4567` formatés `45 67`)
  - Round-trip property : decrypt(nir_encrypted) === '185097401234567' (NIR normalisé identique)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Tâche 1 : Module crypto Deno (encryptNir, decryptNir, hashNir, normalizeNir)</name>
  <files>supabase/functions/nir/_shared/crypto.ts</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 99-137, 514-535 — squelette + base64Decode + Web Crypto)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 261-309 — pas d'analog Deno, suivre RESEARCH)
    - /home/user/TAP/supabase/functions/nir/index.test.ts (créé PLAN-1 — contrat exact à satisfaire)
    - /home/user/TAP/CLAUDE.md (§ 6 sécurité, § 11 anti-patterns — pas de console.log NIR)
  </read_first>
  <behavior>
  - Test (déjà rédigé en PLAN-1) : `decryptNir(await encryptNir("1801234567823")) === "1801234567823"`
  - Test : `(await encryptNir(nir)).slice(1,13) !== (await encryptNir(nir)).slice(1,13)` (IV différents = bytes 1..13 du payload)
  - Test : `await hashNir("1 80 12 34 567 823")` égal à `await hashNir("1801234567823")` (normalisation espaces)
  - Test : `await hashNir(nir) !== await encryptNir(nir)` (clés distinctes → bytes différents)
  - Test : `decryptNir(payload_corrompu)` lève Error avec message exact `"NIR illisible"` (jamais le message technique Web Crypto)
  </behavior>
  <action>
Créer `supabase/functions/nir/_shared/crypto.ts` (≥ 60 lignes, ≤ 200) :

```ts
// supabase/functions/nir/_shared/crypto.ts
// Cryptographie NIR — AES-256-GCM + HMAC-SHA256 via Web Crypto.
// Clés en variables d'env Deno (jamais bundle Vercel).
// Aucun console.log ne contient le NIR clair.

const VERSION_BYTE = 0x01; // future-proof migration KMS (cf. RESEARCH open question §2)

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function getEnvKey(name: string): Uint8Array {
  const raw = Deno.env.get(name);
  if (!raw) throw new Error(`Configuration manquante : ${name}`);
  const bytes = base64ToBytes(raw);
  if (bytes.length !== 32) {
    throw new Error(`Clé ${name} invalide : 32 bytes attendus, ${bytes.length} reçus`);
  }
  return bytes;
}

let _encKey: CryptoKey | null = null;
async function getEncryptionKey(): Promise<CryptoKey> {
  if (_encKey) return _encKey;
  _encKey = await crypto.subtle.importKey(
    'raw', getEnvKey('APP_NIR_ENCRYPTION_KEY'),
    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
  );
  return _encKey;
}

let _hmacKey: CryptoKey | null = null;
async function getHmacKey(): Promise<CryptoKey> {
  if (_hmacKey) return _hmacKey;
  _hmacKey = await crypto.subtle.importKey(
    'raw', getEnvKey('APP_NIR_SEARCH_KEY'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return _hmacKey;
}

export function normalizeNir(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export async function encryptNir(nir: string): Promise<string> {
  const normalized = normalizeNir(nir);
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(normalized)),
  );
  // payload = version (1) || iv (12) || ciphertext || tag (16, suffixe Web Crypto)
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = VERSION_BYTE;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return bytesToBase64(out);
}

export async function decryptNir(encryptedB64: string): Promise<string> {
  try {
    const buf = base64ToBytes(encryptedB64);
    if (buf.length < 1 + 12 + 16) throw new Error('payload trop court');
    if (buf[0] !== VERSION_BYTE) throw new Error('version inconnue');
    const iv = buf.slice(1, 13);
    const ctWithTag = buf.slice(13);
    const key = await getEncryptionKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ctWithTag);
    return new TextDecoder().decode(plain);
  } catch {
    // Toute erreur cryptographique remonte avec un message générique en français.
    // Aucune information technique côté caller.
    throw new Error('NIR illisible');
  }
}

export async function hashNir(nir: string): Promise<string> {
  const normalized = normalizeNir(nir);
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
  return bytesToBase64(new Uint8Array(sig));
}
```

**Conventions strictes :**
- Aucun `console.log` n'inclut `nir`, `normalized`, ou `plain`. **Pas de log du tout dans ce module.**
- Le `catch` de `decryptNir` est intentionnellement vide-message-générique (CLAUDE.md § 6 : « Aucune erreur Postgres brute au client », même règle ici)
- Fichier ≤ 200 lignes ; chaque fonction ≤ 50 lignes
- Aucune dépendance npm ; uniquement Web Crypto + standard Deno
  </action>
  <verify>
    <automated>cd /home/user/TAP/supabase/functions &amp;&amp; APP_NIR_ENCRYPTION_KEY=$(openssl rand -base64 32) APP_NIR_SEARCH_KEY=$(openssl rand -base64 32) deno test --allow-env --allow-net --allow-read nir/index.test.ts 2&gt;&amp;1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/functions/nir/_shared/crypto.ts` ≥ 60 et ≤ 200
    - `grep -c "export.*encryptNir\\|export.*decryptNir\\|export.*hashNir\\|export.*normalizeNir" supabase/functions/nir/_shared/crypto.ts` == 4
    - `grep -c "AES-GCM" supabase/functions/nir/_shared/crypto.ts` ≥ 2
    - `grep -c "HMAC" supabase/functions/nir/_shared/crypto.ts` ≥ 2
    - `grep -c "VERSION_BYTE\\|0x01" supabase/functions/nir/_shared/crypto.ts` ≥ 2
    - `grep -c "console" supabase/functions/nir/_shared/crypto.ts` == 0 (pas de log)
    - `grep -c "NIR illisible" supabase/functions/nir/_shared/crypto.ts` == 1
    - `! grep -E "console\\.(log|error|warn|info|debug)" supabase/functions/nir/_shared/crypto.ts`
    - 4 des 6 tests Deno passent (cas 1-4, indépendants du handler) : `deno test ... 2>&1 | grep -cE "ok"` ≥ 4
  </acceptance_criteria>
  <done>Module crypto isolé, 4 fonctions exportées, gestion d'erreur générique en français, 0 log de NIR clair.</done>
</task>

<task type="auto" tdd="true">
  <name>Tâche 2 : Wrapper auth JWT + dispatcher HTTP + audit decrypt</name>
  <files>supabase/functions/nir/index.ts, supabase/functions/nir/_shared/auth.ts, supabase/functions/_shared/cors.ts</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 121-137 — vérification JWT + insert audit_logs depuis Edge Function)
    - /home/user/TAP/supabase/functions/nir/_shared/crypto.ts (créé tâche 1)
    - /home/user/TAP/supabase/functions/nir/index.test.ts (cas 5-6 : JWT 401, audit insert)
  </read_first>
  <behavior>
  - Test : `POST /functions/v1/nir` sans header `Authorization` → status 401, body `"Non autorisé"`, sans log du payload
  - Test : `POST /functions/v1/nir` avec JWT invalide → status 401
  - Test : `POST /functions/v1/nir` avec JWT valide + body `{action:'decrypt', encrypted:'...', patientId:'<uuid>'}` insère une ligne dans `audit_logs` avec `action='patient.nir.decrypt'`, `entity_id = patientId`, `actor_id = user.id`
  - Test : `POST` action inconnue → status 400 `"Action inconnue"`
  - Test : OPTIONS preflight CORS → status 200 avec headers `Access-Control-Allow-*`
  </behavior>
  <action>
**supabase/functions/_shared/cors.ts** (≥ 10 lignes — réutilisable par autres Edge Functions futures) :
```ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // restreint en prod via Vercel domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}
```

**supabase/functions/nir/_shared/auth.ts** (≥ 30 lignes) :
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AuthContext {
  userId: string;
  organizationId: string;
  jwt: string;
}

// Wrapper : extrait + valide le JWT du caller, retourne user + org.
// L'Edge Function utilise ensuite un client SERVICE_ROLE pour insérer dans audit_logs
// (le caller n'écrit pas lui-même dans audit_logs — pattern PATTERNS.md ligne 711-714).
export async function authenticate(req: Request): Promise<AuthContext> {
  const auth = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!auth) throw new AuthError('Non autorisé');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error } = await supabase.auth.getUser(auth);
  if (error || !user) throw new AuthError('Non autorisé');

  // Récupère organization_id depuis le profile du user (RLS via JWT).
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${auth}` } }, auth: { persistSession: false } },
  );
  const { data: profile } = await userClient
    .from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile) throw new AuthError('Non autorisé');

  return { userId: user.id, organizationId: profile.organization_id, jwt: auth };
}

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = 'AuthError'; }
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
```

**supabase/functions/nir/index.ts** (≥ 80 lignes, ≤ 150) :
```ts
// Edge Function : chiffrement / déchiffrement / hash NIR.
// Endpoints :
//   POST /functions/v1/nir { action:'encrypt', nir }                   → { nir_encrypted, nir_search_hash, nir_last4 }
//   POST /functions/v1/nir { action:'decrypt', encrypted, patientId }  → { nir } + audit
//   POST /functions/v1/nir { action:'hash', nir }                      → { hash }
import { serve } from 'std/http/server.ts';
import { encryptNir, decryptNir, hashNir, normalizeNir } from './_shared/crypto.ts';
import { authenticate, adminClient, AuthError } from './_shared/auth.ts';
import { corsHeaders, preflight } from '../_shared/cors.ts';

// Re-export pour les tests Deno (PLAN-1 tâche 2 importe depuis ./index.ts)
export { encryptNir, decryptNir, hashNir };

interface EncryptRequest { action: 'encrypt'; nir: string }
interface DecryptRequest { action: 'decrypt'; encrypted: string; patientId: string }
interface HashRequest    { action: 'hash'; nir: string }
type NirRequest = EncryptRequest | DecryptRequest | HashRequest;

// Réponse encrypt — Server Action (PLAN-5) persiste les 3 champs dans la même UPDATE.
export interface EncryptResponse { nir_encrypted: string; nir_search_hash: string; nir_last4: string }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleEncrypt(req: EncryptRequest): Promise<Response> {
  if (typeof req.nir !== 'string' || req.nir.length === 0) {
    return jsonResponse({ error: 'NIR invalide' }, 400);
  }
  // Normalisation locale (sans espaces) — encryptNir et hashNir normalisent eux-mêmes,
  // mais on en a besoin ici pour calculer nir_last4 à partir du même formulaire normalisé.
  const nirNormalized = normalizeNir(req.nir);
  // NIR normalisé = 15 chars (13 racine + 2 clé). Les 4 derniers = 2-digit "fin commune" + 2-digit clé.
  // Format affiché : "XX YY" (2 chiffres, espace, 2 chiffres) — token de display non sensible.
  const last4 = nirNormalized.slice(-4);
  const nir_last4 = `${last4.slice(0, 2)} ${last4.slice(2, 4)}`;
  const nir_encrypted = await encryptNir(req.nir);
  const nir_search_hash = await hashNir(req.nir);
  return jsonResponse({ nir_encrypted, nir_search_hash, nir_last4 });
}

async function handleHash(req: HashRequest): Promise<Response> {
  if (typeof req.nir !== 'string' || req.nir.length === 0) {
    return jsonResponse({ error: 'NIR invalide' }, 400);
  }
  const hash = await hashNir(req.nir);
  return jsonResponse({ hash });
}

async function handleDecrypt(req: DecryptRequest, ctx: { userId: string; organizationId: string }): Promise<Response> {
  if (typeof req.encrypted !== 'string' || typeof req.patientId !== 'string') {
    return jsonResponse({ error: 'Paramètres invalides' }, 400);
  }
  const nir = await decryptNir(req.encrypted);
  // Audit log forcé : impossible à oublier côté caller.
  await adminClient().from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    action: 'patient.nir.decrypt',
    entity_type: 'patient',
    entity_id: req.patientId,
    metadata: {}, // jamais le NIR
  });
  return jsonResponse({ nir });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non supportée' }, 405);

  let auth;
  try {
    auth = await authenticate(req);
  } catch (e) {
    return jsonResponse({ error: e instanceof AuthError ? e.message : 'Non autorisé' }, 401);
  }

  let body: NirRequest;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: 'JSON invalide' }, 400);
  }

  switch (body.action) {
    case 'encrypt': return handleEncrypt(body);
    case 'hash':    return handleHash(body);
    case 'decrypt': return handleDecrypt(body, { userId: auth.userId, organizationId: auth.organizationId });
    default:        return jsonResponse({ error: 'Action inconnue' }, 400);
  }
}

serve(handler);
```

**.env.example** — ajouter (sans valeurs) :
```
# Edge Function NIR — clés AES-256 + HMAC-SHA256 (32 bytes base64 chacune, distinctes).
# À générer via : openssl rand -base64 32
APP_NIR_ENCRYPTION_KEY=
APP_NIR_SEARCH_KEY=
```

**Conventions strictes :**
- Aucun `console.log` (recherche : `grep -c console.log supabase/functions/nir/` doit retourner 0)
- Messages d'erreur en français, génériques (`"Non autorisé"`, `"NIR illisible"`, `"Paramètres invalides"`)
- Fichier `index.ts` ≤ 150 lignes ; chaque fonction ≤ 50 lignes (CLAUDE.md § 11)
- Aucun NIR dans le `metadata` de l'audit_log (clé `metadata: {}` explicite)
- L'export `{ encryptNir, decryptNir, hashNir }` permet aux tests Deno PLAN-1 d'importer depuis `./index.ts`
  </action>
  <verify>
    <automated>cd /home/user/TAP/supabase/functions &amp;&amp; APP_NIR_ENCRYPTION_KEY=$(openssl rand -base64 32) APP_NIR_SEARCH_KEY=$(openssl rand -base64 32) SUPABASE_URL=http://localhost:54321 SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test deno test --allow-env --allow-net --allow-read nir/index.test.ts 2&gt;&amp;1 | tail -25</antml-parameter></automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/functions/nir/index.ts` ≥ 80 et ≤ 150
    - `wc -l supabase/functions/nir/_shared/auth.ts` ≥ 30
    - `wc -l supabase/functions/_shared/cors.ts` ≥ 10
    - `grep -c "export" supabase/functions/nir/index.ts` ≥ 4 (handler + re-exports)
    - `grep -c "patient.nir.decrypt" supabase/functions/nir/index.ts` == 1
    - `grep -c "metadata: {}" supabase/functions/nir/index.ts` ≥ 1
    - **B-6 fix** : `grep -E "nir_last4" supabase/functions/nir/index.ts` retourne ≥ 1 ligne dans le chemin encrypt
    - **B-6 fix** : la réponse TypeScript de l'action encrypt déclare `nir_last4: string` (présent dans `EncryptResponse` ou équivalent)
    - **B-6 fix** : test Deno valide que la sortie `nir_last4` matche `/^[0-9]{2} [0-9]{2}$/` (2 chiffres, espace, 2 chiffres)
    - **B-6 fix** : test round-trip — `decrypt(nir_encrypted)` retourne le NIR normalisé d'origine (les 4 derniers chars correspondent à `nir_last4` sans l'espace)
    - `grep -c "Non autorisé" supabase/functions/nir/index.ts supabase/functions/nir/_shared/auth.ts` ≥ 2
    - `! grep -rE "console\\.(log|error|warn|info|debug)" supabase/functions/nir/`
    - `grep -c "APP_NIR_ENCRYPTION_KEY\\|APP_NIR_SEARCH_KEY" .env.example` == 2
    - `grep -E "APP_NIR_ENCRYPTION_KEY=." .env.example | grep -vc "APP_NIR_ENCRYPTION_KEY=$"` == 0 (variable déclarée vide, jamais avec valeur)
    - `deno test ... 2>&1 | grep -cE "^ok " ` ≥ 6 (les 6 cas du PLAN-1 verts ; cas 6 audit insert utilise un mock client)
    - `deno test ... 2>&1 | grep -cE "FAILED"` == 0
  </acceptance_criteria>
  <done>Edge Function `nir` opérationnelle : handler ≤ 150 lignes, dispatcher 3 actions, JWT obligatoire, audit log forcé sur decrypt, 0 fuite NIR en logs, 6/6 tests Deno verts.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Caller (Server Action / browser) → Edge Function | JWT obligatoire ; aucune confiance dans le caller |
| Edge Function → Postgres (audit_logs) | Service_role utilisé uniquement pour audit_logs INSERT, jamais pour lire/écrire patients |
| Edge Function → Web Crypto / clés Deno.env | Clés en mémoire process Edge ; jamais dans bundle Vercel ; jamais en log |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-01 | Information Disclosure | logs Deno / Sentry incluent NIR clair | HIGH | mitigate | Aucun `console.log` dans `_shared/crypto.ts` ni `index.ts` (assertions grep dans acceptance_criteria). Le `catch` de `decryptNir` remplace l'erreur native par `'NIR illisible'`. Test PLAN-1 cas 6 vérifie qu'aucune capture console n'inclut le NIR |
| T-03-02 | Spoofing | endpoint sans JWT ou JWT forgé | HIGH | mitigate | Wrapper `authenticate()` appelé en première ligne ; `supabase.auth.getUser(jwt)` valide la signature JWT côté Supabase. Test PLAN-1 cas 5 force ce chemin |
| T-03-03 | Repudiation | bypass audit_logs sur decrypt (oubli côté caller) | HIGH | mitigate | L'INSERT audit est dans la fonction, AVANT le retour de la réponse decrypt. Le caller ne peut pas désactiver l'audit. PLAN-1 cas 6 assertEquals sur `audit_logs.insert` |
| T-03-04 | Tampering | replay d'un même NIR chiffré (rejouer ciphertext) | MEDIUM | mitigate | IV aléatoire 96 bits par chiffrement (test PLAN-1 cas 2 : 2 encrypts du même NIR donnent 2 ciphertexts différents). Le tag GCM lève si payload modifié |
| T-03-05 | Information Disclosure | brute force NIR via hash search (HMAC) | MEDIUM | mitigate | Clé HMAC 32 bytes serveur (`APP_NIR_SEARCH_KEY`) — non brute-forçable sans la clé. Clé distincte de la clé AES (test PLAN-1 cas 4) |
| T-03-06 | Tampering | DoS sur Edge Function (flood) | LOW | accept | Edge Functions Supabase ont un rate limit par défaut ; flood réel = problème infra, pas Phase 1 |
| T-03-07 | Information Disclosure | clé AES exposée par mauvais .gitignore | HIGH | mitigate | `.env.example` ne contient que les noms (vérifié par acceptance criteria : valeur après `=` doit être vide). `.env` reste git-ignoré (vérifier en runtime : `git check-ignore .env`) |
</threat_model>

<verification>
- `! grep -rE "console\\.(log|error|warn|info|debug)" supabase/functions/nir/` (0 log dans tout le dossier nir)
- `! grep -rnE "180123456" supabase/functions/nir/_shared/` (aucun NIR factice dur dans les modules de prod ; les NIR factices vivent uniquement dans les tests `_test.ts` ou `index.test.ts`)
- `cd supabase/functions && APP_NIR_ENCRYPTION_KEY=... APP_NIR_SEARCH_KEY=... SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... deno test --allow-env --allow-net --allow-read nir/index.test.ts` → 6 ok, 0 FAILED
- `wc -l supabase/functions/nir/index.ts` ≤ 150 (CLAUDE.md § 11)
- Aucune dépendance npm dans les fichiers Deno (`! grep -E "from ['\"][^./].*[^.ts]['\"]" supabase/functions/nir/_shared/crypto.ts | grep -v "https://\\|esm.sh\\|@supabase\\|std/"`)
</verification>

<success_criteria>
- 1 module crypto Deno (4 exports purs) + 1 module auth (wrapper JWT + admin client) + 1 dispatcher HTTP ≤ 150 lignes
- 6/6 tests Deno PLAN-1 passent : round-trip, IV unique, hash déterministe, hash ≠ encrypt, JWT 401, audit insert forcé
- L'action encrypt retourne `{ nir_encrypted, nir_search_hash, nir_last4 }` — `nir_last4` au format `"XX YY"` (B-6)
- 0 occurrence de `console.*` dans le dossier nir/
- 2 secrets déclarés vides dans `.env.example` (valeurs jamais commit)
- Format payload bytea figé : `version (1) || iv (12) || ciphertext || tag (16)` — préfixe version pour future migration KMS (RESEARCH open question §2)
- L'endpoint decrypt est le seul chemin qui produit du NIR clair, et il insère systématiquement une ligne audit_logs `patient.nir.decrypt`
- Decrypt audit unchanged : decrypt ne recalcule ni ne retourne `nir_last4` (déjà stocké en base lors de l'INSERT initial)
</success_criteria>

<output>
Après complétion, créer `.planning/phases/01-referentiel-patients/01-3-SUMMARY.md` documentant :
- Squelette public exporté de `_shared/crypto.ts` (4 fonctions, signatures)
- Format payload bytea (avec version 0x01)
- Liste des codes d'erreur HTTP retournés par `index.ts`
- Note pour PLAN-5 : pour appeler depuis un Server Action, utiliser `supabase.functions.invoke('nir', { body: { action, ... } })` qui injecte le JWT du caller automatiquement
- **B-6** : la réponse de l'action `encrypt` contient `{ nir_encrypted, nir_search_hash, nir_last4 }`. Le Server Action (PLAN-5) **doit persister `nir_last4` dans la même UPDATE** que `nir_encrypted` et `nir_search_hash` (un seul round-trip Postgres, atomique).
- **B-6** : l'action `decrypt` est inchangée — elle retourne uniquement le NIR clair. `nir_last4` est déjà stocké en base (colonne non sensible, pas de re-calcul nécessaire).
</output>

## Revision Log

- **2026-05-06 — Iteration 1/3 — B-6 fix appliqué** : l'action `encrypt` de l'Edge Function `nir` calcule et retourne désormais `nir_last4` (format `"XX YY"`, regex `/^[0-9]{2} [0-9]{2}$/`) à partir des 4 derniers caractères du NIR normalisé, afin que le Server Action (PLAN-5) puisse persister ce display token dans la même UPDATE que `nir_encrypted` et `nir_search_hash`. La signature de la réponse devient `{ nir_encrypted: string; nir_search_hash: string; nir_last4: string }`. L'action `decrypt` reste **inchangée** (elle retourne uniquement le NIR clair ; `nir_last4` est déjà stocké en base). Tests Deno mis à jour (cas additionnel : format `nir_last4` + round-trip property). Acceptance criteria ajoutés sur `grep "nir_last4"` et regex format.

