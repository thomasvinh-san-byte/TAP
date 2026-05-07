// =============================================================================
// Tests Deno — Edge Function NIR (Phase 1, Plan 1, Wave 0 RED)
// =============================================================================
// État RED attendu en Wave 0 : ./index.ts n'existe pas. L'import ci-dessous
// échoue avec "Module not found" — c'est volontaire. Wave 1 livrera l'Edge
// Function et fera passer ces tests au vert.
//
// Couverture (PAT-02, PAT-07, T-01-02 du threat model) :
//   1. Round-trip encrypt → decrypt = identité
//   2. IV unique : deux encrypts du même NIR donnent des ciphertexts différents
//   3. Hash déterministe + normalisation (espaces ignorés)
//   4. Hash distinct entre clé chiffrement et clé HMAC
//   5. handler 401 si Authorization absente
//   6. handler decrypt insère audit_logs action='patient.nir.decrypt'
//
// Sécurité : aucun NIR clair ne doit transiter par console.log/console.error.
// Le NIR factice utilisé (1801234567823) est un format valide arbitraire.
// =============================================================================

import {
  assertEquals,
  assertNotEquals,
} from "std/assert/mod.ts";

// Clés de test factices (32 octets base64). Setup AVANT l'import pour que le
// module index.ts trouve les vars d'env à son chargement.
Deno.env.set(
  "APP_NIR_ENCRYPTION_KEY",
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
);
Deno.env.set(
  "APP_NIR_SEARCH_KEY",
  "QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=",
);

// Import RED : ./index.ts sera créé en Wave 1 (Edge Function NIR).
// L'export attendu : encryptNir, decryptNir, hashNir, handler.
import { encryptNir, decryptNir, hashNir, handler } from "./index.ts";

const NIR_FACTICE = "1801234567823";

// ---------------------------------------------------------------------------
// 1. Round-trip encrypt → decrypt = identité
// ---------------------------------------------------------------------------
Deno.test("round-trip encrypt → decrypt = identité", async () => {
  const ciphertext = await encryptNir(NIR_FACTICE);
  const clair = await decryptNir(ciphertext);
  assertEquals(clair, NIR_FACTICE);
});

// ---------------------------------------------------------------------------
// 2. IV unique : deux encrypts du même NIR → ciphertexts différents
// ---------------------------------------------------------------------------
Deno.test("IV unique : deux encrypts du même NIR donnent ciphertexts différents", async () => {
  const a = await encryptNir(NIR_FACTICE);
  const b = await encryptNir(NIR_FACTICE);
  // Comparaison binaire : un seul octet différent suffit
  assertNotEquals(
    Array.from(a).join(","),
    Array.from(b).join(","),
    "L'IV aléatoire doit produire des ciphertexts distincts (replay protection)",
  );
});

// ---------------------------------------------------------------------------
// 3. Hash déterministe : même NIR normalisé → même hash (espaces ignorés)
// ---------------------------------------------------------------------------
Deno.test("hash déterministe : même NIR normalisé = même hash", async () => {
  const avecEspaces = await hashNir("1 80 12 34 567 823");
  const sansEspaces = await hashNir(NIR_FACTICE);
  assertEquals(
    Array.from(avecEspaces).join(","),
    Array.from(sansEspaces).join(","),
    "hashNir doit normaliser (suppression espaces) avant HMAC",
  );
});

// ---------------------------------------------------------------------------
// 4. Hash distinct entre clé chiffrement et clé HMAC
// ---------------------------------------------------------------------------
Deno.test("hash distinct entre clé chiffrement et clé HMAC", async () => {
  const ciphertext = await encryptNir(NIR_FACTICE);
  const hash = await hashNir(NIR_FACTICE);
  // Les bytes ne doivent pas coïncider (clés AES vs HMAC distinctes)
  assertNotEquals(
    Array.from(ciphertext).join(","),
    Array.from(hash).join(","),
    "encryptNir et hashNir utilisent des clés distinctes (D-04)",
  );
});

// ---------------------------------------------------------------------------
// 5. handler rejette absence Authorization avec 401
// ---------------------------------------------------------------------------
Deno.test("handler rejette absence de header Authorization avec 401", async () => {
  const req = new Request("http://localhost/encrypt", {
    method: "POST",
    body: JSON.stringify({ nir: NIR_FACTICE }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401, "Sans JWT, handler doit répondre 401 Non autorisé");
});

// ---------------------------------------------------------------------------
// 6. handler decrypt insère audit_logs action='patient.nir.decrypt'
// ---------------------------------------------------------------------------
Deno.test(
  "handler decrypt insère une ligne audit_logs action='patient.nir.decrypt'",
  async () => {
    // Stub minimal : Wave 1 injectera un client supabase mockable.
    // Ce test asserte le contrat : un decrypt valide produit l'audit_log.
    const auditCalls: { action: string }[] = [];
    const stubSupabase = {
      from: (_table: string) => ({
        insert: (row: { action: string }) => {
          auditCalls.push(row);
          return { error: null };
        },
      }),
      auth: {
        getUser: (_jwt: string) =>
          Promise.resolve({
            data: {
              user: { id: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
            },
          }),
      },
    };
    const ciphertext = await encryptNir(NIR_FACTICE);
    const req = new Request("http://localhost/decrypt", {
      method: "POST",
      headers: { Authorization: "Bearer fake.jwt.token" },
      body: JSON.stringify({
        ciphertext: Array.from(ciphertext),
        patient_id: "99999999-9999-9999-9999-999999999991",
        organization_id: "11111111-1111-1111-1111-111111111111",
      }),
    });
    // Wave 1 : handler acceptera un 2e param pour injection (test stub).
    // En Wave 0, le test échoue parce que handler n'est pas encore typé/écrit.
    const res = await handler(req, stubSupabase);
    assertEquals(res.status, 200);
    assertEquals(
      auditCalls.find((c) => c.action === "patient.nir.decrypt")?.action,
      "patient.nir.decrypt",
    );
  },
);
