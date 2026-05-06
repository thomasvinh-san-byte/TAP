# Phase 1 : Référentiel patients — Research

**Researched:** 2026-05-06
**Domain:** Référentiel patient HDS-compatible (chiffrement NIR, recherche fuzzy, audit) + bootstrap `apps/web` Next.js 14
**Confidence:** HIGH (stack frozen, décisions verrouillées dans CONTEXT.md, patterns code existants à dupliquer)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chiffrement NIR**
- D-01 — AES-256-GCM, IV 96 bits, tag 128 bits, payload `iv (12) || ciphertext || auth_tag (16)` en `bytea`
- D-02 — Clé V1 = variable d'env Vercel/Supabase `APP_NIR_ENCRYPTION_KEY` (32 octets base64). Migration KMS (Scaleway/AWS BYOK) tracée dans ADR-003 avant HDS prod. Vault auto-hébergé ÉCARTÉ V1.
- D-03 — **Edge Function Supabase Deno** (`supabase/functions/nir/index.ts`) avec endpoints `nir-encrypt`, `nir-decrypt`, `nir-hash`. Clé jamais dans bundle Vercel.
- D-04 — Recherche NIR via **HMAC-SHA256 déterministe** (`nir_search_hash bytea`), clé HMAC distincte `APP_NIR_SEARCH_KEY`. Pas dans la fuzzy.
- D-05 — Affichage masqué `1•••••••••76 23` par défaut. « Afficher NIR complet » → décrypt + insert `audit_logs` action `patient.nir.decrypt`. **Aucun log ne contient le NIR clair.**
- D-06 — Schéma : `nir_encrypted bytea`, `nir_search_hash bytea`. Pas de colonne NIR clair, jamais.

**Recherche fuzzy**
- D-07 — `pg_trgm` + index GIN (extension Postgres native, supportée Supabase)
- D-08 — Champs : `nom`, `prenom`, `telephone_normalized`. **Pas d'adresse V1.**
- D-09 — Colonne stockée générée `search_text` = `lower(unaccent(nom || ' ' || prenom || ' ' || telephone_normalized))`, indexée GIN `gin_trgm_ops`
- D-10 — Déclenchement à 2 caractères, debounce client 150 ms, top 10 triés par `similarity` desc, troncature > 50 résultats
- D-11 — Recherche dédiée NIR : champ séparé UI (icône clé), match exact via hash

**UX fiche patient**
- D-12 — Drawer latéral 400 px par défaut + page `/patients/[id]` URL partageable
- D-13 — Édition explicite via `/patients/[id]/edit` (pas inline V1), `react-hook-form` + `zodResolver`
- D-14 — Blocs V1 : en-tête → identité administrative → coordonnées → préférences → contraintes → note opérationnelle active
- D-15 — Reportés V1.5/V2 : historique courses, prescriptions, incidents, photos, documents

**Modèle données**
- D-16 — Préférences : enum `canal_contact_prefere ('sms'|'appel'|'aucun')` + `consentement_sms boolean` + `consentement_sms_at timestamptz`. Booléen faux par défaut, timestamp NULL tant que pas de consentement.
- D-17 — Contraintes : table satellite typée `patient_constraint`, enum `patient_constraint_type` (8 valeurs). Pas de JSONB.
- D-18 — Notes : table `patient_operational_note` avec historique en chaîne (`replaced_by_id`). Modification = INSERT + UPDATE ancienne ligne. Note active = `where replaced_by_id is null`.
- D-19 — Visibilité notes par chauffeur : NON Phase 1 (Phase 9).

**Audit (DEC-010 LOCKED)**
- D-20 — Actions Phase 1 : `patient.created`, `patient.updated`, `patient.archived`, `patient.unarchived`, `patient.nir.decrypt`, `patient_constraint.added`, `patient_constraint.removed`, `patient_operational_note.created`, `patient_operational_note.replaced`

**Bootstrap apps/web**
- D-21 — Next.js 14 App Router strict, Tailwind, shadcn/ui (init), Lucide. Layout + thèmes jour/nuit (CSS vars). Middleware Supabase Auth PKCE. Routes `/login`, `/patients`, `/patients/[id]`, `/patients/[id]/edit`. Composant `PatientDrawer`. **Pas de cockpit, pas de saisie express.**
- D-22 — `@tanstack/react-query` côté client + RSC côté serveur. Pas de Zustand/Redux V1.

**Tests**
- D-23 — Vitest validators, Deno test Edge Function, pgTAP RLS (3 tables), Playwright E2E flow complet
- D-24 — Cible ≥ 80 % `packages/domain`. Pas de 100 % branches (réservé pricing/recurrence par DEC-013).

### Claude's Discretion

- Granularité contraintes : table satellite typée (auditabilité)
- Ordre blocs fiche : administratif → préférences → opérationnel
- Couleur badge canal : laissée au design (palette terracotta/bleu)
- Composant Drawer : `Sheet` shadcn/ui, pas custom

### Deferred Ideas (OUT OF SCOPE)

- ADR-003 KMS production (placeholder seulement)
- Recherche par adresse, inline edit, historique notes UI, photos patient, visibilité chauffeur, ROR/RPPS, import CSV, dédoublonnage UI fusion → V1.5/V2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAT-01 | Régulatrice crée fiche patient (coordonnées, NIR, date naissance, genre) | Migration 003 + `patientSchema` étendu + page `/patients/new` (formulaire shadcn) + Edge Function `nir-encrypt` + `nir-hash` |
| PAT-02 | NIR chiffré AES-256-GCM, clé hors Supabase, jamais loggué | Edge Function Deno + `crypto.subtle` + clé Deno.env, audit log sans payload NIR |
| PAT-03 | Consultation fiche en < 1 clic depuis recherche | `PatientDrawer` (shadcn `Sheet`) ouvert au clic sur résultat fuzzy |
| PAT-04 | Recherche fuzzy ≥ 2 chars (nom, prénom, téléphone) | `pg_trgm` + GIN + colonne stockée `search_text` + debounce 150 ms |
| PAT-05 | Préférences (SMS/appel/aucun) + contraintes | Enum `canal_contact_prefere` + table `patient_constraint` typée |
| PAT-06 | Note opérationnelle libre | Table `patient_operational_note` historique en chaîne |
| PAT-07 | Mutations dans `audit_logs` | Triggers Postgres + INSERT depuis Edge Function (`patient.nir.decrypt`) |
</phase_requirements>

## Domain Context

Cette phase pose les fondations data + UI du SaaS : la fiche patient est consommée par toutes les phases suivantes (saisie course, prescriptions, récurrences, SMS, planning, PWA chauffeur). Trois enjeux techniques se croisent — chiffrement applicatif HDS-compatible (NIR = donnée de santé identifiante), recherche fuzzy < 50 ms à plusieurs centaines de milliers de patients par tenant, et bootstrap propre de `apps/web` (qui n'existe pas encore). La règle d'or : **rien dans `apps/web` ne doit savoir comment le NIR est chiffré** — la clé reste dans l'Edge Function Deno, le front ne voit que l'API HTTP. Côté UX, on vise le niveau Linear/Stripe Dashboard avec drawer 400 px + édition explicite (pas inline V1) pour simplifier l'audit log.

**Primary recommendation:** Plan en 4 vagues — (Wave 0) tests scaffolding pgTAP/Deno/Vitest, (Wave 1) migration 003 + Edge Function NIR isolément testables, (Wave 2) bootstrap `apps/web` avec login + middleware, (Wave 3) UI patient (liste + drawer + page + edit) + audit logs. Chaque vague mergée avant la suivante, gate sur `pnpm db:test && pnpm test && pnpm e2e`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chiffrement/déchiffrement NIR | Edge Function (Deno) | — | Clé doit rester serveur, hors bundle Vercel ; Edge Function = isolation stricte avec auth JWT Supabase |
| Hash recherche NIR (HMAC) | Edge Function (Deno) | — | Même raisonnement : clé HMAC sensible, jamais côté client |
| Validation métier (zod) | `packages/shared` | Server Action + RSC | zod côté client (formulaire) ET côté serveur (mutation) — un seul schéma, deux usages |
| Recherche fuzzy patient | Database (Postgres) | Server Component | `pg_trgm` GIN exécute la requête, RSC streame le résultat ; pas de logique fuzzy en TS |
| RLS multi-tenant | Database (Postgres) | — | RLS forcée + helpers `current_organization_id()` ; jamais bypassé côté front |
| Audit logs (mutations) | Database (triggers) | Edge Function (NIR decrypt) | Triggers Postgres pour mutations table ; Edge Function insert audit_log pour decrypt (action sans mutation table) |
| UI fiche patient (drawer + page) | Next.js App Router (RSC + Client) | TanStack Query | RSC pour fetch initial + hydration, Client Component pour interactions ; pas de useEffect fetch initial |
| Auth + session | Middleware Next.js + `@supabase/ssr` | — | PKCE flow, cookies httpOnly, refresh côté server |

## Critical Implementation Decisions

### 1. NIR Encryption — Edge Function Deno

**Pourquoi Edge Function et pas Server Action :** la clé `APP_NIR_ENCRYPTION_KEY` doit être inaccessible au bundle Next.js. Une Server Action s'exécute dans le runtime Vercel — n'importe quel développeur ayant accès au repo peut potentiellement l'exfiltrer via une route mal sécurisée. L'Edge Function Deno isole la clé dans un environnement séparé avec son propre secret store Supabase, et expose une API HTTP authentifiée par JWT.

**Stack Deno :** Web Crypto API (`crypto.subtle`) — disponible nativement dans Deno, pas de dépendance npm.

**Format payload (binaire compact, stocké tel quel en `bytea`) :**

```ts
// supabase/functions/nir/index.ts (extrait, ≤ 50 lignes par fonction)
async function encryptNir(nir: string, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(nir))
  );
  // ct contient déjà le tag 16 bytes en suffixe (Web Crypto convention)
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out; // = iv (12) || ciphertext || auth_tag (16)
}
```

**Auth JWT-based dans Edge Function :** chaque endpoint vérifie le JWT du caller (header `Authorization: Bearer <jwt>`), extrait `sub` (user_id) et `organization_id` du custom claim, et **insère lui-même la ligne `audit_logs`** pour `patient.nir.decrypt`. Le client ne peut pas oublier l'audit.

```ts
// Vérif JWT + insertion audit dans le même flow decrypt
const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
if (!user) return new Response("Unauthorized", { status: 401 });
// ... decrypt ...
await supabaseAdmin.from("audit_logs").insert({
  organization_id: orgId, actor_id: user.id,
  action: "patient.nir.decrypt", target_type: "patient", target_id: patientId,
});
```

**Clés HMAC distinctes :** `APP_NIR_ENCRYPTION_KEY` (chiffrement) ≠ `APP_NIR_SEARCH_KEY` (HMAC). Si une clé est compromise, l'autre n'expose pas tout.

**HMAC-SHA256 avant hash :** normaliser le NIR (suppression espaces, uppercase si lettre clé corse 2A/2B) avant `crypto.subtle.sign("HMAC", searchKey, normalizedNir)`. Sans normalisation, deux saisies équivalentes produisent deux hashes différents.

### 2. pg_trgm + GIN — Ordre et Configuration

**Disponibilité Supabase :** `pg_trgm` ET `unaccent` sont activables sans demande spéciale (extensions Postgres standard supportées par Supabase managé). Pas de blocker.

**Ordre dans la migration :**

```sql
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- Table patients d'abord (sans search_text)
create table patients ( ... );

-- Puis colonne générée stockée
alter table patients add column search_text text generated always as (
  lower(public.unaccent(coalesce(nom, '') || ' ' || coalesce(prenom, '') || ' ' || coalesce(telephone_normalized, '')))
) stored;

-- Index GIN après la colonne (pas GiST : GIN plus rapide en lookup, légèrement plus lent à l'INSERT — acceptable pour patients)
create index patients_search_trgm_idx on patients using gin (search_text gin_trgm_ops);
```

**Note `unaccent` immutable :** `unaccent()` n'est pas IMMUTABLE par défaut, ce qui pose problème pour les colonnes générées stockées. Solution standard : créer un wrapper IMMUTABLE :

```sql
create or replace function public.unaccent_immutable(text)
returns text language sql immutable parallel safe as
$$ select public.unaccent('public.unaccent', $1) $$;
```

Utiliser `public.unaccent_immutable(...)` dans la `generated always as`.

**GIN vs GiST :** GIN choisi car patients = beaucoup de lookups, peu d'INSERT (création par régulatrice manuelle, pas de bulk). GiST aurait l'avantage en updates fréquents — non pertinent ici.

**Pattern de requête côté serveur :**

```sql
select id, nom, prenom, telephone, similarity(search_text, $1) as score
from patients
where organization_id = public.current_organization_id()
  and archive = false
  and search_text % $1            -- opérateur pg_trgm "match"
order by score desc
limit 10;
```

Le `%` opérateur déclenche l'index GIN. Sans lui (par exemple `like '%foo%'`), pas d'index.

### 3. Migration 003 — Schéma + Triggers + RLS

**Tables :** `patients`, `patient_constraint`, `patient_operational_note`. Toutes avec `organization_id uuid not null references organizations(id)`, RLS forcée, 4 policies (SELECT/INSERT/UPDATE/DELETE) basées sur `current_organization_id()` et `has_role()`.

**Pattern policy à dupliquer (depuis migration 002) :**

```sql
alter table public.patients enable row level security;
alter table public.patients force row level security;

create policy patients_select_same_org on public.patients for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patients_insert_regulateur on public.patients for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur') or public.has_role('dirigeant'))
  );

create policy patients_update_regulateur on public.patients for update to authenticated
  using (organization_id = public.current_organization_id() and (public.has_role('regulateur') or public.has_role('dirigeant')))
  with check (organization_id = public.current_organization_id());

-- DELETE interdit : archivage logique via colonne `archive boolean`
```

**Triggers :**

1. **`updated_at` auto** : `before update for each row` qui set `new.updated_at = now()`. Une fonction réutilisable au niveau schéma `public.set_updated_at()`.
2. **Audit trigger** : `after insert/update/delete` sur `patients`, `patient_constraint`, `patient_operational_note`. Insère dans `audit_logs` avec `action = TG_TABLE_NAME || '.' || lower(TG_OP)` et `delta = jsonb_build_object('old', to_jsonb(old) - 'nir_encrypted' - 'nir_search_hash', 'new', to_jsonb(new) - 'nir_encrypted' - 'nir_search_hash')`. **Critique : exclure `nir_encrypted` et `nir_search_hash` du delta.** Même chiffré, ne pas le dupliquer dans audit_logs.

**Index :**
- `patients (organization_id, archive)` — RLS + filtrage archives
- `patients (organization_id, nir_search_hash) where archive = false` — recherche NIR exacte
- `patients_search_trgm_idx` GIN sur `search_text` — fuzzy
- `patient_constraint (patient_id)` — fetch contraintes d'une fiche
- `patient_operational_note (patient_id) where replaced_by_id is null` — note active

**Contrainte unicité NIR par tenant :**

```sql
create unique index patients_nir_unique
  on public.patients (organization_id, nir_search_hash)
  where archive = false and nir_search_hash is not null;
```

Le hash déterministe permet l'unique constraint sans exposer le NIR.

### 4. apps/web Bootstrap

**Init shadcn/ui (commande exacte) :**

```bash
cd apps/web
pnpm dlx shadcn@latest init -d   # défauts : Tailwind, CSS vars, Slate base color, RSC
# Composants nécessaires Phase 1 :
pnpm dlx shadcn@latest add button input label form sheet dialog dropdown-menu \
  badge card skeleton sonner tabs separator avatar
```

**`-d` (defaults)** active : CSS vars (impératif pour theming jour/nuit propre), Tailwind, RSC. Pas d'`--no-css-variables` car D-21 impose CSS vars only.

**Middleware Supabase Auth (`apps/web/middleware.ts`) :** utiliser `@supabase/ssr` (le successeur de `@supabase/auth-helpers-nextjs`, deprecated). Pattern :

```ts
// apps/web/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"] };
```

**Route group structure :**

```
apps/web/app/
├── (auth)/login/page.tsx
├── (app)/
│   ├── layout.tsx                    # Header, nav, providers (QueryClient, Theme)
│   └── patients/
│       ├── page.tsx                  # Liste + recherche fuzzy (RSC)
│       ├── new/page.tsx              # Formulaire création
│       └── [id]/
│           ├── page.tsx              # Fiche complète
│           └── edit/page.tsx         # Édition
├── layout.tsx                        # Root, fonts, theme bootstrap
└── globals.css                       # CSS vars jour + nuit
```

**Theme via CSS vars uniquement :** déclarer `--background`, `--foreground`, `--primary` (bleu profond), `--accent` (terracotta) dans `:root` et `.dark`. Toggle via `data-theme="dark"` sur `<html>`. Pas de `next-themes` package — script inline anti-FOUC dans `<head>`.

### 5. Data Fetching — RSC + TanStack Query Hydration

**Pattern : RSC fetch initial → hydratation client → mutations via Server Actions.** Évite le useEffect-pour-fetch interdit (CLAUDE.md § 7).

```tsx
// app/(app)/patients/page.tsx — Server Component
import { HydrationBoundary, dehydrate, QueryClient } from "@tanstack/react-query";
import { createServerClient } from "@/lib/supabase/server";
import { PatientsList } from "./patients-list.client";

export default async function PatientsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["patients", { q: "" }],
    queryFn: async () => {
      const supabase = createServerClient();
      const { data } = await supabase.from("patients").select("id, nom, prenom, telephone").eq("archive", false).limit(20);
      return data ?? [];
    },
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatientsList />
    </HydrationBoundary>
  );
}
```

**Mutations via Server Actions** (pas de fetch côté client direct) — un point d'entrée unique pour validation zod + audit log. La régulatrice voit l'optimistic update instantanément (< 100 ms perçu) via `useOptimistic` ou `queryClient.setQueryData` avant `revalidatePath`.

**Recherche fuzzy debounce 150 ms :** `useDeferredValue` (React 18) sur l'input + `useQuery` paramétré par la valeur déférée. Plus idiomatique que `useDebounce` custom.

```tsx
"use client";
import { useState, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";

export function PatientsList() {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const { data, isPending } = useQuery({
    queryKey: ["patients", { q: dq }],
    queryFn: () => searchPatients(dq),
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev,            // évite skeleton flash
  });
  // ... skeleton si isPending && !data, sinon liste
}
```

**Skeleton screens (pas de spinners)** : `<Skeleton>` shadcn pour la liste pendant > 500 ms.

### 6. Tests — Stratégie Multi-couches

**pgTAP (par table)** : `supabase/tests/patients.sql` — 4 cas par table (isolation tenant A vs B, régulateur peut INSERT, chauffeur ne peut pas, DELETE refusé). Pattern à dupliquer du test foundations. Lancement : `pnpm db:test`.

**Deno test (Edge Function)** : `supabase/functions/nir/index.test.ts` — round-trip encrypt/decrypt assert eq, hash déterministe (même input → même output), IV différent à chaque encrypt (replay protection), JWT invalid → 401, audit log inséré sur decrypt. Lancement : `deno test --allow-env --allow-net`.

**Vitest validators** : `packages/shared/src/validators/patient.test.ts` — étendre tests existants pour `consentement_sms_at`, `patient_constraint`, normalisations NIR/téléphone.

**Playwright E2E (un seul flow critique Phase 1)** :

```ts
// apps/web/e2e/patient-flow.spec.ts
test("régulatrice crée + cherche + édite + audit", async ({ page }) => {
  await loginAsRegulateur(page);                                  // helper programmatique (signInWithPassword)
  await page.goto("/patients/new");
  await page.getByLabel("Nom").fill("Hoarau");
  await page.getByLabel("Prénom").fill("Patrick");
  await page.getByLabel("NIR").fill("1801234567823");
  // ... reste du formulaire
  await page.getByRole("button", { name: /créer/i }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+$/);
  // Recherche fuzzy
  await page.goto("/patients");
  await page.getByPlaceholder(/rechercher/i).fill("ho");
  await expect(page.getByText("Hoarau Patrick")).toBeVisible({ timeout: 1000 });
  // ... drawer, edit, vérif audit_logs via API service_role
});
```

**Login programmatique** : pas via UI à chaque test — créer un helper qui `POST` directement à `/auth/v1/token?grant_type=password` puis set les cookies. Sinon E2E lent.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (TS), Deno test (Edge Function), pgTAP (SQL), Playwright (E2E) |
| Config files | `vitest.config.ts` racine + `apps/web/playwright.config.ts` (Wave 0) ; `supabase/functions/deno.json` (Wave 0) |
| Quick run | `pnpm test --filter=@tap/shared` (validators seuls, < 5 s) |
| Full suite | `pnpm db:test && pnpm test && pnpm -C apps/web e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAT-01 | Création fiche patient avec NIR + coordonnées | E2E + unit zod | `pnpm -C apps/web e2e -g "crée"` + `pnpm test patient.test` | Wave 0 (e2e), partiel (validator) |
| PAT-02 | NIR chiffré AES-256-GCM, jamais en clair | Deno + pgTAP | `deno test supabase/functions/nir` + `pnpm db:test patients_nir.sql` | Wave 0 |
| PAT-03 | Consultation < 1 clic depuis recherche | E2E | `pnpm -C apps/web e2e -g "drawer"` | Wave 0 |
| PAT-04 | Recherche fuzzy ≥ 2 chars | E2E + integration | `pnpm -C apps/web e2e -g "fuzzy"` + `pnpm db:test patients_search.sql` | Wave 0 |
| PAT-05 | Préférences + contraintes | E2E + pgTAP RLS | `pnpm -C apps/web e2e -g "préférences"` + `pnpm db:test patient_constraint.sql` | Wave 0 |
| PAT-06 | Note opérationnelle | unit + pgTAP | `pnpm test note` + `pnpm db:test patient_operational_note.sql` | Wave 0 |
| PAT-07 | Audit logs sur mutations | pgTAP + E2E assertion | `pnpm db:test patients_audit.sql` + check `audit_logs` count en E2E | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --filter=<paquet touché>` (< 10 s)
- **Per wave merge:** `pnpm db:test && pnpm test`
- **Phase gate:** Full suite incluant Playwright vert avant `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `supabase/functions/nir/index.test.ts` — Deno test round-trip + hash + JWT
- [ ] `supabase/tests/patients.sql` — pgTAP RLS + audit + unicité NIR
- [ ] `supabase/tests/patient_constraint.sql` — pgTAP RLS
- [ ] `supabase/tests/patient_operational_note.sql` — pgTAP historique en chaîne
- [ ] `apps/web/playwright.config.ts` + helper `loginAsRegulateur`
- [ ] `apps/web/e2e/patient-flow.spec.ts` — flow E2E unique
- [ ] `packages/shared/src/validators/patient.test.ts` — extension tests existants

## Architecture Patterns

### Pattern 1 — Mutation Server Action (validation → autorisation → mutation → audit)

```ts
// apps/web/app/(app)/patients/actions.ts
"use server";
export async function createPatient(input: unknown) {
  const data = patientCreateSchema.parse(input);                  // 1. zod
  const supabase = createServerClient();
  const nirEncrypted = await encryptNirEdge(data.nir, supabase);  // Edge Function
  const nirHash = await hashNirEdge(data.nir, supabase);
  const { data: row, error } = await supabase.from("patients").insert({
    ...data, nir_encrypted: nirEncrypted, nir_search_hash: nirHash, nir: undefined,
  }).select("id").single();                                       // 2. RLS + 3. audit trigger
  if (error) throw new Error("Création impossible");
  revalidatePath("/patients");
  return row;
}
```

### Pattern 2 — Drawer Sheet shadcn

```tsx
// apps/web/components/patient-drawer.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function PatientDrawer({ patientId, open, onOpenChange }) {
  const { data } = useQuery({ queryKey: ["patient", patientId], queryFn: () => getPatient(patientId), enabled: open });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        {/* en-tête → identité → coordonnées → préférences → contraintes → note */}
      </SheetContent>
    </Sheet>
  );
}
```

### Anti-Patterns à éviter

- **Décrypter le NIR depuis un Server Component pour rendu :** non — toujours masqué, decrypt seulement sur clic explicite « Afficher »
- **Logger le NIR clair même en debug :** interdit, même en dev. Lint custom à ajouter (rule `no-restricted-syntax`).
- **Recherche fuzzy avec `like '%q%'`** : ne déclenche pas l'index GIN. Toujours `%` opérateur pg_trgm.
- **`unaccent()` non-immutable dans colonne générée** : Postgres refuse. Utiliser wrapper `unaccent_immutable`.
- **useEffect pour fetch initial** : interdit (CLAUDE.md § 7), passer par RSC + HydrationBoundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM | Implémentation maison | `crypto.subtle` Web Crypto (Deno) | API native, audit cryptographique fait |
| HMAC-SHA256 | Implémentation maison | `crypto.subtle.sign("HMAC", ...)` | idem |
| Recherche fuzzy | Levenshtein TS côté serveur | `pg_trgm` + GIN | Indexable, < 50 ms à des millions de lignes |
| Auth flow PKCE | Custom OAuth | `@supabase/ssr` + middleware | Cookies httpOnly, refresh, anti-CSRF gérés |
| Drawer / Sheet | Custom slide-in | shadcn `Sheet` | Focus trap, ESC, a11y |
| Form validation client | onChange manuel | `react-hook-form` + `zodResolver` | Un seul schéma zod, perf optimale |
| Debounce | setTimeout custom | `useDeferredValue` React 18 | Concurrent rendering aware |
| Audit logs frontend | Insert depuis client React | Triggers Postgres + Edge Function | Impossible à oublier, robuste à un bug front |
| Updated_at | Set manuel à chaque mutation | Trigger `before update` | Pareil — robuste |

## Common Pitfalls

### Pitfall 1 — Colonne générée + `unaccent()` non-immutable
**Ce qui plante :** `ERROR: generation expression is not immutable` à la création de la colonne `search_text`.
**Cause :** `public.unaccent(text)` est marquée STABLE, pas IMMUTABLE.
**Comment éviter :** créer un wrapper SQL function IMMUTABLE qui appelle `unaccent('public.unaccent', $1)`. Pattern documenté dans plusieurs projets healthcare.
**Signe précoce :** la migration échoue dès le premier essai.

### Pitfall 2 — Edge Function timeout ou JWT non-vérifié
**Ce qui plante :** decrypt ouvert à n'importe qui s'il fournit l'`anon key`. Exfiltration possible.
**Cause :** oublier de vérifier `Authorization: Bearer <jwt>` ET d'appeler `supabase.auth.getUser(jwt)` dans la fonction.
**Comment éviter :** wrapper `withAuth(handler)` au début de `index.ts` qui fail-fast 401 si pas de JWT valide. Test Deno qui appelle l'endpoint sans JWT et attend 401.
**Signe précoce :** test Deno couvre ce cas.

### Pitfall 3 — `pg_trgm` index non utilisé
**Ce qui plante :** recherche lente (> 500 ms) malgré l'index. `EXPLAIN ANALYZE` montre Seq Scan.
**Cause :** requête en `like '%q%'` au lieu de `search_text % $1`, ou pas de GIN_TRGM_OPS, ou recherche < 3 chars (par défaut `pg_trgm.similarity_threshold = 0.3` ignore queries trop courtes).
**Comment éviter :** EXPLAIN dans le test pgTAP, abaisser `set_limit(0.1)` ou utiliser `word_similarity` pour 2-char queries.
**Signe précoce :** test pgTAP avec `EXPLAIN` qui asserte présence de "Bitmap Index Scan".

### Pitfall 4 — Audit trigger qui logge le NIR chiffré
**Ce qui plante :** `audit_logs.delta` contient `nir_encrypted` en bytea — pas un fuite de NIR clair, mais bruit massif et duplique la donnée chiffrée.
**Cause :** trigger naïf `to_jsonb(new)`.
**Comment éviter :** `to_jsonb(new) - 'nir_encrypted' - 'nir_search_hash'` systématiquement.
**Signe précoce :** test pgTAP qui vérifie que `delta ? 'nir_encrypted'` = false.

### Pitfall 5 — `apps/web` avec dépendances directes Supabase
**Ce qui plante :** ADR-001 violé, `apps/*` doit dépendre QUE de `packages/*`.
**Cause :** `import { createClient } from "@supabase/supabase-js"` directement dans une route.
**Comment éviter :** toujours via `@tap/database` (`createServerClient`, `createBrowserClient` déjà exposés). Lint rule `no-restricted-imports` configurée.
**Signe précoce :** check ADR-001 dans le verify-work.

## Code Examples

### Edge Function NIR — squelette

```ts
// supabase/functions/nir/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENC_KEY = await crypto.subtle.importKey(
  "raw", base64Decode(Deno.env.get("APP_NIR_ENCRYPTION_KEY")!),
  { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
);
const HMAC_KEY = await crypto.subtle.importKey(
  "raw", base64Decode(Deno.env.get("APP_NIR_SEARCH_KEY")!),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
);

serve(async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();   // encrypt | decrypt | hash
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return new Response("Unauthorized", { status: 401 });
  // ... dispatch + audit
});
```

### Migration 003 — extrait audit trigger

```sql
create or replace function public.patients_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'patient.' || lower(tg_op);
  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, delta)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    action_name,
    'patient',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'nir_encrypted' - 'nir_search_hash' else null end,
      'new', case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) - 'nir_encrypted' - 'nir_search_hash' else null end
    )
  );
  return coalesce(new, old);
end; $$;
```

## Risks & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Clé NIR exposée dans bundle Vercel** | Faible (Edge Function isole) | Critique (RGPD santé, fuite) | Lint check `no-process-env-encryption-key` côté `apps/web` ; secret seulement dans Supabase Function env ; test Deno qui vérifie présence de la clé |
| **Migration 003 échoue en prod sur `unaccent` immutable** | Moyenne (premier vrai usage du pattern) | Bloquant déploiement | Wrapper `unaccent_immutable` testé en CI ; rollback documenté dans la migration |
| **E2E lent (> 60 s) à cause login UI à chaque test** | Élevée | Pipeline CI ralentie, dev frustrés | Helper `loginAsRegulateur` programmatique (signInWithPassword + cookies) dans Wave 0 |
| **Recherche fuzzy < 2 chars renvoie tout** | Moyenne | Pollution UI + RLS rate limit | Garde côté Server Action ET côté UI (`enabled: dq.length === 0 \|\| dq.length >= 2`) ; test E2E qui vérifie 1 char ne déclenche pas la query |
| **Conflit unicité NIR sur archives anciennes** | Moyenne (V1.5 quand on archive) | Création bloquée à tort | Index unique partiel `where archive = false` permet ré-création après archivage ; test pgTAP couvre les deux cas |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `unaccent` activable sans demande spéciale Supabase managé | pg_trgm config | [VERIFIED via doc Supabase extensions] — risque nul, fallback `lower()` seul si KO |
| A2 | `@supabase/ssr` package mature en mai 2026 | apps/web bootstrap | [CITED: supabase docs] — stable depuis 2024, faible risque |
| A3 | Edge Function Deno secrets (`Deno.env.get`) isolés du bundle Vercel | Edge Function | [VERIFIED: Supabase docs] — secrets gérés par `supabase secrets set`, jamais dans repo |
| A4 | `useDeferredValue` suffit pour debounce 150 ms côté React 18 | Data fetching | [ASSUMED] — comportement est concurrent-aware mais pas debounce strict ; si pas assez stable, fallback `useDebounce` custom |

## Open Questions

1. **Quel rôle peut consulter une fiche patient archivée ?**
   - Ce qu'on sait : DELETE interdit, archivage logique via colonne `archive boolean`.
   - Ce qui est flou : un régulateur voit-il les archives par défaut ? Filtre opt-in ?
   - Recommandation : par défaut `archive = false` filtré côté UI (RSC), toggle « Voir les archives » accessible aux dirigeants seulement. À acter en wave 3.

2. **Faut-il versionner le format ciphertext (préfixe `v1:` dans `bytea`) ?**
   - Ce qu'on sait : un seul algo retenu V1 (AES-256-GCM).
   - Ce qui est flou : si on change d'algo en V2, comment migrer ?
   - Recommandation : préfixer `0x01` (1 octet version) en tête du ciphertext maintenant. Coût zéro, future-proof la migration KMS (ADR-003).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | apps/web, packages/* | À vérifier (probablement ≥ 20) | — | — |
| pnpm | monorepo | À vérifier | — | — |
| Supabase CLI | migrations + Edge Functions | À vérifier | — | — |
| Deno | Edge Function tests locaux | À vérifier (bundlé avec Supabase CLI) | — | — |
| Postgres `pg_trgm` | recherche fuzzy | ✓ extension standard | — | — |
| Postgres `unaccent` | normalisation accents | ✓ extension standard | — | — |
| Playwright | E2E | À installer (Wave 0) | — | Tests E2E reportés (déconseillé) |

**Action Wave 0 :** runner `node --version && pnpm --version && supabase --version` dans la première tâche pour valider l'env. Installer Playwright via `pnpm -C apps/web dlx playwright install --with-deps chromium`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth PKCE flow + middleware |
| V3 Session Management | yes | Supabase cookies httpOnly + 15 min inactivité régulateur (CLAUDE.md § 6) |
| V4 Access Control | yes | RLS forcée par tenant + helpers `current_organization_id`, `has_role` |
| V5 Input Validation | yes | zod côté client + serveur (`packages/shared`) |
| V6 Cryptography | yes | AES-256-GCM via Web Crypto (jamais hand-roll), HMAC-SHA256, clés via Supabase secrets |
| V7 Error Handling & Logging | yes | Pas de NIR clair ni stack traces dans logs ; `audit_logs` append-only ; messages erreur reformulés en français |
| V9 Communications | yes | TLS 1.3 (Vercel + Supabase par défaut) |
| V13 API & Web Service | yes | Edge Function vérifie JWT à chaque appel |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fuite NIR via logs (server, CI, Sentry) | Information Disclosure | Triggers excluent `nir_encrypted` ; Edge Function ne logge jamais le payload ; Sentry beforeSend filtre |
| Cross-tenant leak via bug RLS | Information Disclosure | RLS forcée + tests pgTAP isolation systématiques + `force row level security` |
| Élévation de privilèges via mutation | Elevation of Privilege | Trigger `profiles_prevent_self_escalation` (déjà en place) ; pattern à dupliquer si besoin |
| Replay d'un NIR chiffré (même IV) | Tampering | IV aléatoire 96 bits par chiffrement (test Deno vérifie) |
| Brute force NIR via hash search | Information Disclosure | HMAC-SHA256 avec clé serveur — non-brute-forçable sans la clé |
| SQL injection via recherche fuzzy | Tampering | Requêtes paramétrées via supabase-js, pas d'interpolation |
| XSS depuis note opérationnelle | Tampering / EoP | React échappe par défaut ; pas de `dangerouslySetInnerHTML` |
| CSRF sur mutations | Spoofing | Cookies SameSite=Lax + Server Actions Next.js intégrent CSRF token |

## Sources

### Primary (HIGH confidence)
- `/home/user/TAP/CLAUDE.md` — instructions racine, sections 1, 5, 6, 7, 11
- `/home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md` — décisions D-01 à D-24 verrouillées
- `/home/user/TAP/supabase/migrations/20260506000002_rls_foundations.sql` — pattern RLS à dupliquer
- `/home/user/TAP/.planning/REQUIREMENTS.md` — PAT-01 à PAT-07
- Supabase docs (Edge Functions Deno secrets, `@supabase/ssr` middleware)
- Postgres docs (`pg_trgm`, GIN, generated columns, `unaccent` immutability)

### Secondary (MEDIUM confidence)
- ANSSI / DuoKey HDS — exigence AES-256 + clé hors hébergeur (cités dans CONTEXT.md)
- shadcn/ui official `init` flags + composants utilisés

### Tertiary (LOW confidence)
- A4 (`useDeferredValue` debounce stability) — à valider en E2E timing

## Project Constraints (from CLAUDE.md)

- **Pilier 1 UX :** feedback < 100 ms ; Time to Interactive < 2 s ; saisie express < 30 s (Phase 2 mais déjà à anticiper)
- **Pilier 2 design system :** spacing 4/8/12/16/24/32/48/64 px ; police unique (Inter/Manrope/Geist) ; Lucide icons ; pas d'emoji UI ; mode jour ET nuit ; skeleton screens (pas de spinners) ; transitions 150 ms ease-out
- **Pilier 3 sécurité :** RLS sur toute table métier ; AES-256-GCM clé hors Supabase ; audit_logs systématique ; pas de NIR / notes / tokens en log ; pas de service_role côté client ; pas de SQL avec interpolation
- **Code limits :** fichier ≤ 300 lignes, composant React ≤ 150, fonction ≤ 50, ≤ 3 niveaux d'imbrication
- **Naming :** kebab-case files, PascalCase components, camelCase vars, snake_case Postgres, SCREAMING_SNAKE_CASE constants
- **Validation :** zod côté client + serveur, types via `z.infer`
- **TS strict :** pas de `any` sauf cas justifié
- **Next.js :** App Router, RSC par défaut, pas de `useEffect` pour fetch initial
- **Langue :** UI / logs / commentaires en français ; commits `type(scope): description` français
- **Tests :** ≥ 80 % `packages/domain` ; RLS systématique en pgTAP
- **Anti-patterns interdits :** logique métier dans composants React (déléguer `packages/domain`) ; emojis UI ; spinners pour > 500 ms (skeleton) ; pop-ups confirmations actions banales ; jargon technique UI ; `console.log` en commit

## Metadata

**Confidence breakdown:**
- Standard stack : HIGH — frozen par CLAUDE.md + DEC-001..016, aucune nouvelle dépendance majeure
- Architecture (Edge Function NIR, RLS, RSC + TanStack) : HIGH — patterns standards documentés Supabase + Next.js
- Pitfalls : HIGH — issus de retours d'expérience documentés (`pg_trgm` immutable, JWT vérif, audit triggers)
- UX details (debounce 150 ms, drawer 400 px) : MEDIUM — à valider avec design partner régulatrice en wave 3

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 jours, stack stable)

---

## RESEARCH COMPLETE

**Phase :** 01 — Référentiel patients
**Confidence :** HIGH

### Key Findings
- Stack 100 % verrouillé par CONTEXT.md (D-01..D-24) — pas d'alternative à explorer côté planning
- Edge Function Deno **est** le bon emplacement du chiffrement (clé jamais dans bundle Vercel, JWT-auth + audit insertion forcée)
- Wrapper `unaccent_immutable` requis pour la colonne générée `search_text` — gotcha critique à anticiper en migration
- Bootstrap `apps/web` non-trivial : middleware `@supabase/ssr`, theme CSS vars only, RSC + HydrationBoundary + TanStack
- 3 vagues data + 1 vague tests (Wave 0) — gating clair entre migration / Edge Function / UI

### File Created
`/home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Frozen ; toutes dépendances déjà décidées |
| Architecture | HIGH | Patterns standards Supabase + Next.js 14, code existant à dupliquer |
| Pitfalls | HIGH | Pitfalls connus documentés + tests prévus pour chacun |
| UX timing details | MEDIUM | Validation design partner en wave 3 |

### Open Questions
- Visibilité archives par rôle (recommandation : filtre dirigeant only)
- Versionner format ciphertext via préfixe 1 octet (recommandé pour future migration KMS)

### Ready for Planning
Le planner peut décomposer en 4 vagues (Wave 0 tests scaffold → Wave 1 migration + Edge Function → Wave 2 apps/web bootstrap → Wave 3 UI patient + audit). Tous les requirements PAT-01..PAT-07 ont une cible test automatisée. Les 5 risques sont assortis de mitigations actionnables à intégrer en tâches.
