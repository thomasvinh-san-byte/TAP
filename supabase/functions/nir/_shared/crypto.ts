// supabase/functions/nir/_shared/crypto.ts
// Cryptographie NIR — AES-256-GCM + HMAC-SHA256 via Web Crypto API native Deno.
// Les clés vivent dans Deno.env (Edge Function Supabase) ; jamais dans le bundle
// Vercel ni dans un Server Action accessible côté client.
//
// Sécurité (CLAUDE.md § 6, threat model T-03-01) :
// - Aucun console.* dans ce module : le NIR clair ne doit pas fuiter en log.
// - Le catch de decryptNir remplace toute erreur Web Crypto par un message
//   générique en français, jamais le détail technique au caller.
// - Le préfixe de version (0x01) permet une migration KMS future sans casse
//   (cf. RESEARCH.md open question §2 — D-02 placeholder ADR-003).

const VERSION_BYTE = 0x01; // payload = VERSION_BYTE || iv(12) || ct || tag(16)

// ---- helpers base64 (pas de dépendance, Deno natif via atob/btoa) -----------

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

// ---- chargement clé 32 bytes (fail-fast au démarrage) -----------------------

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
    'raw',
    getEnvKey('APP_NIR_ENCRYPTION_KEY'),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  return _encKey;
}

let _hmacKey: CryptoKey | null = null;
async function getHmacKey(): Promise<CryptoKey> {
  if (_hmacKey) return _hmacKey;
  _hmacKey = await crypto.subtle.importKey(
    'raw',
    getEnvKey('APP_NIR_SEARCH_KEY'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return _hmacKey;
}

// ---- API publique -----------------------------------------------------------

/** Normalise un NIR : supprime tous les espaces, uppercase (clé corse 2A/2B). */
export function normalizeNir(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Chiffre un NIR. Retourne un payload base64 :
 *   VERSION_BYTE (1) || iv (12) || ciphertext || auth_tag (16)
 * IV aléatoire 96 bits frais à chaque appel (replay protection — T-03-04).
 */
export async function encryptNir(nir: string): Promise<string> {
  const normalized = normalizeNir(nir);
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(normalized)),
  );
  const out = new Uint8Array(1 + iv.length + ct.length);
  out[0] = VERSION_BYTE;
  out.set(iv, 1);
  out.set(ct, 1 + iv.length);
  return bytesToBase64(out);
}

/**
 * Déchiffre un payload base64 produit par encryptNir.
 * Toute erreur (payload tronqué, version inconnue, tag GCM invalide, clé
 * absente) remonte avec un message générique. Aucun détail technique ne fuit
 * au caller (CLAUDE.md § 6).
 */
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
    throw new Error('NIR illisible');
  }
}

/**
 * Hash déterministe HMAC-SHA256 du NIR normalisé, encodé base64.
 * Clé HMAC distincte de la clé AES (D-04, T-03-05). Permet la recherche par
 * NIR exact sans jamais exposer la valeur clair.
 */
export async function hashNir(nir: string): Promise<string> {
  const normalized = normalizeNir(nir);
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
  return bytesToBase64(new Uint8Array(sig));
}
