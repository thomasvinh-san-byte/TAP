# Phase 1 : Référentiel patients - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 24 (créations + modifications)
**Analogs found:** 14 forts / 24 — 10 sans analog (apps/web n'existe pas encore, scaffold from scratch en s'appuyant sur les patterns standard Next.js 14 + RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260507XXXXXX_patients.sql` | migration SQL | DDL + RLS + triggers | `supabase/migrations/20260506000002_rls_foundations.sql` (RLS) + `20260506000001_foundations.sql` (DDL/triggers) | exact |
| `supabase/tests/patients.sql` | test pgTAP | DDL + RLS + isolation | `supabase/tests/foundations.sql` | exact |
| `supabase/tests/patient_constraint.sql` | test pgTAP | RLS + cascade | `supabase/tests/foundations.sql` | exact |
| `supabase/tests/patient_operational_note.sql` | test pgTAP | RLS + chaîne historique | `supabase/tests/foundations.sql` | exact |
| `supabase/functions/nir/index.ts` | edge function (Deno) | request-response + crypto | aucun (premier service Deno du repo) | no analog (pattern via RESEARCH.md §1) |
| `supabase/functions/nir/_test.ts` | test Deno | encrypt/decrypt round-trip | aucun | no analog |
| `supabase/functions/import_map.json` | config Deno | — | aucun | no analog |
| `packages/shared/src/validators/patient.ts` (extend) | validator zod | shared | `packages/shared/src/validators/patient.ts` (existant) + `ride.ts` (composition) | exact (extension) |
| `packages/shared/src/validators/patient-constraint.ts` | validator zod | shared | `packages/shared/src/validators/ride.ts` | role-match |
| `packages/shared/src/validators/patient-note.ts` | validator zod | shared | `packages/shared/src/validators/ride.ts` | role-match |
| `packages/shared/src/validators/__tests__/patient.test.ts` | test Vitest | unit | `packages/shared/src/validators/__tests__/common.test.ts` | exact |
| `packages/database/src/types.ts` (regenerate) | type stubs | shared | `packages/database/src/types.ts` (existant) | exact (extend) |
| `apps/web/package.json` | config | — | `packages/database/package.json` (style monorepo `@tap/*`) | partial |
| `apps/web/next.config.mjs` | config Next.js | — | aucun | no analog |
| `apps/web/tsconfig.json` | config TS | — | `packages/shared/tsconfig.json` | partial |
| `apps/web/tailwind.config.ts` | config Tailwind | — | aucun | no analog |
| `apps/web/postcss.config.mjs` | config PostCSS | — | aucun | no analog |
| `apps/web/middleware.ts` | middleware Next.js | request-response (auth) | `packages/database/src/client-server.ts` (createServerClient pattern) | partial |
| `apps/web/src/app/layout.tsx` | RSC layout | request-response | aucun | no analog |
| `apps/web/src/app/globals.css` | stylesheet | — | aucun | no analog |
| `apps/web/src/app/(auth)/login/page.tsx` | RSC + Client Component | auth flow | aucun (pattern via RESEARCH.md §4) | no analog |
| `apps/web/src/app/(app)/patients/page.tsx` | RSC + HydrationBoundary | request-response | aucun (pattern via RESEARCH.md §5) | no analog |
| `apps/web/src/app/(app)/patients/[id]/page.tsx` | RSC fiche complète | request-response | aucun | no analog |
| `apps/web/src/app/(app)/patients/[id]/edit/page.tsx` | RSC + Client form | mutation | aucun | no analog |
| `apps/web/src/app/(app)/patients/_components/patient-drawer.tsx` | Client Component | event-driven UI | aucun | no analog |
| `apps/web/src/app/(app)/patients/_components/patient-search.tsx` | Client Component | request-response (debounced) | aucun | no analog |
| `apps/web/src/app/(app)/patients/actions.ts` | Server Action | mutation + audit | `packages/shared/src/validators/patient.ts` (zod parse) + Pattern 1 RESEARCH.md | composite |
| `apps/web/src/lib/supabase/server.ts` | RSC helper | wrapper | `packages/database/src/client-server.ts` | exact |
| `apps/web/src/lib/supabase/client.ts` | client helper | wrapper | `packages/database/src/client-browser.ts` | exact |
| `apps/web/playwright.config.ts` | config E2E | — | aucun | no analog |
| `apps/web/e2e/patient-flow.spec.ts` | E2E Playwright | full flow | aucun | no analog |

## Pattern Assignments

### `supabase/migrations/20260507XXXXXX_patients.sql` (migration, DDL + RLS + triggers)

**Analog:** `supabase/migrations/20260506000002_rls_foundations.sql` (RLS) + `20260506000001_foundations.sql` (DDL/triggers)

**En-tête de migration commenté** (pattern depuis migration 001/002 — copier le bloc d'en-tête `=` style) :

```sql
-- =============================================================================
-- Migration 003 — Référentiel patients
-- =============================================================================
-- Crée :
--   - extensions pg_trgm + unaccent + wrapper unaccent_immutable
--   - type énuméré patient_constraint_type
--   - table patients (NIR chiffré bytea + hash bytea + search_text généré)
--   - table patient_constraint (satellite typée)
--   - table patient_operational_note (historique en chaîne)
--   - RLS forcée + 4 policies par table (SELECT/INSERT/UPDATE/DELETE)
--   - triggers updated_at + audit
-- =============================================================================
```

**Pattern RLS forcée** (analog migration 002, lignes 13-38 — à dupliquer pour `patients`, `patient_constraint`, `patient_operational_note`) :

```sql
alter table public.patients enable row level security;
alter table public.patients force row level security;

create policy patients_select_same_org
  on public.patients
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

create policy patients_insert_regulateur
  on public.patients
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy patients_update_regulateur
  on public.patients
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());

-- DELETE volontairement absent : archivage logique via colonne `archive`.
```

**Trigger `updated_at` réutilisable** (analog migration 001, lignes 36-44 + 81-84) :

```sql
-- public.set_updated_at() existe déjà en migration 001 — réutiliser.
create trigger patients_set_updated_at
  before update on public.patients
  for each row
  execute function public.set_updated_at();
```

**Pattern revoke + grant fin** (analog migration 002, lignes 159-166) :

```sql
revoke all on public.patients from anon;
revoke all on public.patient_constraint from anon;
revoke all on public.patient_operational_note from anon;

grant select, insert, update on public.patients to authenticated;
grant select, insert, delete on public.patient_constraint to authenticated;
grant select, insert, update on public.patient_operational_note to authenticated;
```

**Trigger d'audit avec exclusion NIR** (pattern issu de RESEARCH.md §3 + style migration 001 anti-escalation 82-117) :

```sql
create or replace function public.patients_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare action_name text;
begin
  action_name := 'patient.' || lower(tg_op);
  insert into public.audit_logs (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    public.current_user_role(),
    action_name,
    'patient',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE')
                  then to_jsonb(old) - 'nir_encrypted' - 'nir_search_hash'
                  else null end,
      'new', case when tg_op in ('UPDATE','INSERT')
                  then to_jsonb(new) - 'nir_encrypted' - 'nir_search_hash'
                  else null end
    )
  );
  return coalesce(new, old);
end;
$$;
```

**Différences vs analog :**
- Ajouter `archive boolean not null default false` (DELETE interdit, archivage logique).
- Index unique partiel `(organization_id, nir_search_hash) where archive = false` (DEC-D-04 + RESEARCH §3).
- Index GIN `gin_trgm_ops` sur la colonne générée `search_text`.
- Wrapper `public.unaccent_immutable()` IMMUTABLE (RESEARCH Pitfall 1) avant la colonne générée.
- Aucune fonction d'audit n'existait pour le moment (foundations utilisent INSERT direct depuis client) → premier trigger audit du repo.

---

### `supabase/tests/patients.sql` + `patient_constraint.sql` + `patient_operational_note.sql` (test pgTAP)

**Analog:** `supabase/tests/foundations.sql`

**Pattern transaction + plan + finish** (analog lignes 12-14 et 209-210) :

```sql
begin;

select plan(N);  -- N = nombre d'assertions

-- ... assertions ...

select * from finish();
rollback;
```

**Pattern "vérifier que RLS est forcée"** (analog lignes 28-40) :

```sql
select ok(
  (select relrowsecurity from pg_class where oid = 'public.patients'::regclass),
  'RLS activée sur patients'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.patients'::regclass),
  'RLS forcée sur patients'
);
```

**Pattern fixtures 2 tenants** (analog lignes 45-73 — à réutiliser tel quel : ces UUIDs peuvent être réintroduits puisque les tests roll back) :

```sql
insert into public.organizations (id, nom, ville, code_postal)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alpha-dir@test.tap', crypt('test1234!', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  -- ... bravo, alpha-reg
  ;

insert into public.profiles (id, organization_id, role, prenom, nom, email)
values
  ('aaaaaaaa-...', '11111111-...', 'dirigeant', 'Alpha', 'Dirigeant', 'alpha-dir@test.tap'),
  -- ... etc
  ;
```

**Pattern simulation rôle authentifié** (analog lignes 78-79, 102, 164) :

```sql
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ... assertions de visibilité ...

reset role;
reset "request.jwt.claim.sub";
```

**Pattern `throws_ok` pour vérifier blocage RLS / triggers** (analog lignes 120-145) :

```sql
select throws_ok(
  $$ delete from public.patients where id = '...' $$,
  '42501',
  null,
  'DELETE patient interdit (archivage logique seulement)'
);
```

**Tests à ajouter spécifiques à la phase :**
- Insertion d'un patient sans NIR → OK
- Insertion d'un patient avec NIR identique (même `nir_search_hash`) dans la même org → conflit unique
- Le même `nir_search_hash` dans une autre org → autorisé (multi-tenant)
- Audit_logs reçoit `patient.insert` + `delta` ne contient pas `nir_encrypted`
- `EXPLAIN` sur recherche `search_text % 'ho'` montre `Bitmap Index Scan` (RESEARCH Pitfall 3)
- `patient_operational_note` : INSERT note 1, INSERT note 2 + UPDATE note 1.replaced_by_id, vérifier qu'une seule a `replaced_by_id is null`
- `patient_constraint` : ON DELETE CASCADE depuis patients

---

### `supabase/functions/nir/index.ts` (edge function Deno, request-response + crypto)

**Analog:** aucun (premier service Deno du repo)

**Référence canonique :** RESEARCH.md §1 « NIR Encryption — Edge Function Deno » (lignes 98-137 et 514-535).

**Squelette à suivre** (tiré de RESEARCH §1) :

```ts
// supabase/functions/nir/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENC_KEY = await crypto.subtle.importKey(
  "raw",
  base64Decode(Deno.env.get("APP_NIR_ENCRYPTION_KEY")!),
  { name: "AES-GCM" },
  false,
  ["encrypt", "decrypt"],
);

const HMAC_KEY = await crypto.subtle.importKey(
  "raw",
  base64Decode(Deno.env.get("APP_NIR_SEARCH_KEY")!),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);

serve(async (req) => {
  // 1. Vérif JWT
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return new Response("Unauthorized", { status: 401 });

  // 2. Dispatch action (encrypt | decrypt | hash)
  const { action, payload, patientId } = await req.json();

  // 3. Pour decrypt : vérif user + INSERT audit_logs
  // 4. Réponse
});
```

**Style de code :** Le repo n'a pas encore de TS Deno — suivre les conventions standard Deno (modules HTTPS, top-level await OK, `Deno.env.get`). Le code TS doit rester `strict` comme partout (pas de `any`).

**Style de logs/erreurs :** PAS de `console.log(nir)` jamais. Réponses d'erreur en français côté client (CLAUDE.md §6) : `"NIR illisible"`, `"Non autorisé"`. Pas de stack trace.

**Différences vs ce qui existe ailleurs :**
- Pas d'analog dans `packages/*` (sont des modules npm, pas Deno).
- Le pattern `createSupabaseServerClient` de `packages/database/src/client-server.ts` (lignes 13-44) ne s'applique pas ici (Edge Function n'a pas de `cookieStore`). Utiliser directement `createClient` de `@supabase/supabase-js` avec le JWT du caller dans le header.

---

### `packages/shared/src/validators/patient.ts` (extend)

**Analog:** `packages/shared/src/validators/patient.ts` (existant — à étendre) + `packages/shared/src/validators/ride.ts` (style composition + refine)

**Style existant à conserver** (analog lignes 1-26) :

```ts
import { z } from 'zod';
import {
  adresseSchema,
  telephoneReunionSchema,
  nirFormatSchema,
} from './common';

export const canalContactSchema = z.enum(['sms', 'appel', 'aucun']);
export type CanalContact = z.infer<typeof canalContactSchema>;

export const patientSchema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis').max(80),
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  // ...
  canal_contact_prefere: canalContactSchema.default('appel'),
  consentement_sms: z.boolean().default(false),
  notes_operationnelles: z.string().trim().max(500).optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;
```

**Pattern `refine` + message FR** (analog `ride.ts` lignes 43-54 — à appliquer pour `consentement_sms_at` ↔ `consentement_sms`) :

```ts
.refine(
  (data) => !data.consentement_sms || Boolean(data.consentement_sms_at),
  {
    message: 'Horodatage de consentement requis si consentement_sms = true.',
    path: ['consentement_sms_at'],
  },
)
```

**Extensions à ajouter :**
- `consentement_sms_at: z.string().datetime().optional()` (ISO 8601, NULL si pas de consentement)
- `archive: z.boolean().default(false)`
- `genre: z.enum(['M','F','X']).optional()`
- `contact_urgence: z.object({ nom: z.string().max(80), telephone: telephoneReunionSchema }).optional()`
- Helper `normalizeNir(input: string): string` (suppression espaces, uppercase) — exporté pour usage avant chiffrement/hash
- Helper `normalizePhone(input: string): string` (réutilise le `transform` de `telephoneReunionSchema`) — exporté pour la colonne `telephone_normalized`

---

### `packages/shared/src/validators/patient-constraint.ts` (validator zod, shared) — NEW

**Analog:** `packages/shared/src/validators/ride.ts` (déclaration enum + objet zod typé)

**Pattern enum + objet** (analog `ride.ts` lignes 4-10) :

```ts
import { z } from 'zod';

export const typeTransportSchema = z.enum(['assis', 'tpmr']);
export type TypeTransport = z.infer<typeof typeTransportSchema>;
```

**Application à patient-constraint :**

```ts
import { z } from 'zod';

export const patientConstraintTypeSchema = z.enum([
  'medical_oxygene',
  'medical_fauteuil',
  'medical_brancard',
  'vehicule_tpmr',
  'horaire_matin',
  'horaire_apres_midi',
  'accompagnement_obligatoire',
  'autre',
]);
export type PatientConstraintType = z.infer<typeof patientConstraintTypeSchema>;

export const patientConstraintInputSchema = z.object({
  patient_id: z.string().uuid(),
  type: patientConstraintTypeSchema,
  note: z.string().trim().max(300).optional(),
});
export type PatientConstraintInput = z.infer<typeof patientConstraintInputSchema>;
```

---

### `packages/shared/src/validators/patient-note.ts` (validator zod, shared) — NEW

**Analog:** `packages/shared/src/validators/patient.ts` lignes 11-26 (cap 500 chars déjà au repo)

```ts
import { z } from 'zod';

export const patientOperationalNoteInputSchema = z.object({
  patient_id: z.string().uuid(),
  content: z.string().trim().min(1, 'Contenu requis').max(500),
});
export type PatientOperationalNoteInput = z.infer<typeof patientOperationalNoteInputSchema>;
```

---

### `packages/shared/src/validators/__tests__/patient.test.ts`

**Analog:** `packages/shared/src/validators/__tests__/common.test.ts`

**Pattern tests Vitest** (analog lignes 1-44) :

```ts
import { describe, expect, it } from 'vitest';
import { patientSchema, normalizeNir } from '../patient';

describe('patientSchema', () => {
  it('accepte un patient minimal valide', () => {
    expect(() => patientSchema.parse({
      prenom: 'Patrick', nom: 'Hoarau',
      date_naissance: '1980-01-23',
      adresse: { ligne1: '12 rue Pasteur', code_postal: '97400', ville: 'Saint-Denis' },
    })).not.toThrow();
  });

  it('refuse consentement_sms=true sans consentement_sms_at', () => {
    expect(() => patientSchema.parse({ /* ... */ consentement_sms: true })).toThrow();
  });
});

describe('normalizeNir', () => {
  it('supprime les espaces', () => {
    expect(normalizeNir('1 80 01 23 456 789 23')).toBe('1800123456789 23'.replace(/\s/g, ''));
  });
});
```

---

### `packages/database/src/types.ts` (regenerate after migration 003)

**Analog:** `packages/database/src/types.ts` (existant)

**Pattern :** Le fichier actuel est un stub manuel décrit lignes 1-83. La régénération se fait via `pnpm db:types` (script déjà présent dans `package.json` racine ligne 26 → écrit dans `packages/database/src/types.gen.ts`). **Préférer** importer depuis `types.gen.ts` quand il existe (commentaire explicite ligne 7 du stub) ; sinon étendre le stub manuellement avec les 3 nouvelles tables et l'enum `patient_constraint_type`.

**Pattern type Database** (analog lignes 58-83) :

```ts
export interface Database {
  public: {
    Tables: {
      patients: {
        Row: Patient;
        Insert: Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'search_text'> &
          Partial<Pick<Patient, 'id'>>;
        Update: Partial<Omit<Patient, 'id' | 'created_at' | 'updated_at' | 'search_text'>>;
      };
      // patient_constraint, patient_operational_note...
    };
    Enums: {
      user_role: UserRole;
      patient_constraint_type: PatientConstraintType;
      canal_contact_prefere: CanalContact;
    };
  };
}
```

---

### `apps/web/src/lib/supabase/server.ts` + `client.ts` (RSC + browser helpers)

**Analog:** `packages/database/src/client-server.ts` + `packages/database/src/client-browser.ts`

**Note ADR-001 :** `apps/web` doit dépendre **uniquement** de `packages/*`. Ces fichiers `apps/web/src/lib/supabase/*` doivent être de simples **re-exports** ou **wrappers minces** au-dessus de `@tap/database`, pas une duplication de logique.

**Pattern à reproduire** (analog `client-server.ts` lignes 1-44) — adapté Next.js 14 App Router avec `cookies()` :

```ts
// apps/web/src/lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@tap/database/server';

export function createClient() {
  return createSupabaseServerClient(cookies());
}
```

```ts
// apps/web/src/lib/supabase/client.ts
export { createSupabaseBrowserClient as createClient } from '@tap/database/browser';
```

**Style de garde env vars** (analog lignes 14-20) :

```ts
if (!url || !anonKey) {
  throw new Error(
    'Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.',
  );
}
```

→ Déjà géré par `@tap/database`, ne pas dupliquer dans `apps/web`.

---

### `apps/web/middleware.ts` (Next.js middleware, request-response)

**Analog:** aucun analog dans le repo. Pattern issu de RESEARCH.md §4 (lignes 251-275) + style des helpers de `packages/database/src/client-server.ts`.

**Squelette autoritaire** (RESEARCH §4) — à coller :

```ts
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
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
```

**Réutiliser `@tap/database` plutôt que `@supabase/ssr` direct** (ADR-001) — soit ajouter une factory `createSupabaseMiddlewareClient(req, res)` dans `packages/database/src/`, soit conserver l'import direct `@supabase/ssr` dans `apps/web/middleware.ts` en cohérence avec `client-server.ts` (qui importe `@supabase/ssr` directement). **Recommandation au planner :** ajouter `createSupabaseMiddlewareClient` à `packages/database` pour rester ADR-001 strict.

---

### `apps/web/src/app/(app)/patients/page.tsx` (RSC + HydrationBoundary)

**Analog:** aucun. Pattern RESEARCH.md §5 (lignes 300-322).

**Squelette autoritaire** :

```tsx
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/server';
import { PatientsList } from './_components/patients-list.client';

export default async function PatientsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['patients', { q: '' }],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('patients')
        .select('id, nom, prenom, telephone')
        .eq('archive', false)
        .limit(20);
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

**Anti-patterns (CLAUDE.md §11) :**
- Pas de `useEffect` pour fetch initial
- Pas de logique métier dans ce composant — déléguer à `packages/shared` ou Server Actions

---

### `apps/web/src/app/(app)/patients/_components/patient-search.tsx` (Client, debounced)

**Analog:** aucun. Pattern RESEARCH §5 lignes 329-344.

```tsx
'use client';
import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';

export function PatientsList() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const { data, isPending } = useQuery({
    queryKey: ['patients', { q: dq }],
    queryFn: () => searchPatients(dq),
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev, // évite skeleton flash
  });
  // skeleton si isPending && !data, sinon liste
}
```

**Règles UX (CLAUDE.md §1) :**
- Skeleton screens (jamais spinners) si `isPending` > 500 ms
- Feedback < 100 ms perçu via `placeholderData: (prev) => prev`
- Recherche déclenchée à 2 chars (pas 1, pas 3) — guard `dq.length === 0 || dq.length >= 2`

---

### `apps/web/src/app/(app)/patients/_components/patient-drawer.tsx` (Client)

**Analog:** aucun. Pattern RESEARCH §Pattern 2 (lignes 442-455).

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle }
  from '@/components/ui/sheet';

export function PatientDrawer({ patientId, open, onOpenChange }) {
  const { data } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient(patientId),
    enabled: open,
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        {/* en-tête → identité → coordonnées → préférences → contraintes → note */}
      </SheetContent>
    </Sheet>
  );
}
```

**Limites code (CLAUDE.md §11) :** ≤ 150 lignes pour ce composant. Si dépassement, sortir chaque bloc (`PatientHeader`, `PatientIdentity`, `PatientContact`, `PatientPreferences`, `PatientConstraints`, `PatientNote`) en sous-composant.

---

### `apps/web/src/app/(app)/patients/actions.ts` (Server Actions)

**Analog:** Pattern 1 RESEARCH (lignes 422-437) + `packages/shared/src/validators/patient.ts` pour zod.parse.

```ts
'use server';
import { patientSchema } from '@tap/shared/validators';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createPatient(input: unknown) {
  const data = patientSchema.parse(input);                          // 1. zod
  const supabase = createClient();
  const nirEncrypted = data.nir
    ? await encryptNirEdge(data.nir, supabase)                      // Edge Function
    : null;
  const nirHash = data.nir ? await hashNirEdge(data.nir, supabase) : null;
  const { data: row, error } = await supabase.from('patients').insert({
    ...data,
    nir_encrypted: nirEncrypted,
    nir_search_hash: nirHash,
    nir: undefined,
  }).select('id').single();                                         // 2. RLS + 3. audit trigger
  if (error) throw new Error('Création impossible');
  revalidatePath('/patients');
  return row;
}
```

**Mandat CLAUDE.md §10 — séquence obligatoire `Validation zod → Vérification autorisation (RLS) → Transaction → Audit log → Réponse` :** zod (ligne 1), RLS implicite via supabase-js anon, audit trigger Postgres (créé en migration 003), pas d'audit log côté JS.

---

## Shared Patterns

### Multi-tenant (organization_id + helpers RLS)

**Source:** `supabase/migrations/20260506000001_foundations.sql` lignes 129-180 (helpers `current_organization_id()`, `current_user_role()`, `has_role()`).

**Apply to:** Toutes les tables Phase 1 (`patients`, `patient_constraint`, `patient_operational_note`).

```sql
-- Helpers déjà disponibles, les utiliser dans toutes les policies :
public.current_organization_id()    -- UUID org du caller
public.current_user_role()          -- enum user_role du caller
public.has_role('regulateur'::public.user_role)  -- bool
```

**Règle :** chaque table métier a `organization_id uuid not null references organizations(id)` + index `(organization_id, ...)` + RLS forcée.

---

### Audit logs (table existante, INSERT depuis triggers)

**Source:** `supabase/migrations/20260506000001_foundations.sql` lignes 185-208 (table `audit_logs`) + RLS migration 002 lignes 130-152.

**Apply to:** `patients`, `patient_constraint`, `patient_operational_note` (triggers AFTER INSERT/UPDATE/DELETE) + Edge Function `nir/decrypt` (insert direct).

**Schéma utile** (analog lignes 185-195) :

```sql
create table public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_role public.user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

**Règles spéciales NIR :**
- `metadata` (= `delta` dans RESEARCH §3) ne doit JAMAIS contenir `nir_encrypted` ni `nir_search_hash` (filtrés via `to_jsonb(...) - 'nir_encrypted' - 'nir_search_hash'`)
- Action `patient.nir.decrypt` insérée par l'Edge Function uniquement, jamais par trigger

---

### Validation zod côté client + serveur (un seul schéma)

**Source:** `packages/shared/src/validators/common.ts` + `packages/shared/src/validators/patient.ts` (existants).

**Apply to:** Tous les formulaires `apps/web` + tous les Server Actions + Edge Function inputs (ré-implémentation manuelle car Deno ≠ npm).

**Pattern :** un schéma zod, deux usages :

```ts
// Côté client (formulaire) :
import { patientSchema } from '@tap/shared/validators';
import { zodResolver } from '@hookform/resolvers/zod';
const form = useForm({ resolver: zodResolver(patientSchema) });

// Côté serveur (Server Action) :
const data = patientSchema.parse(input);
```

---

### Trigger `updated_at`

**Source:** `supabase/migrations/20260506000001_foundations.sql` lignes 36-44 (fonction `public.set_updated_at()`).

**Apply to:** Toute table avec colonne `updated_at` (= `patients` et `patient_operational_note` ; `patient_constraint` n'a que `created_at` car les contraintes sont add/remove, pas update).

```sql
create trigger <nom_table>_set_updated_at
  before update on public.<nom_table>
  for each row
  execute function public.set_updated_at();
```

---

### Re-exports de barrel (validators)

**Source:** `packages/shared/src/validators/index.ts`

```ts
export * from './common';
export * from './patient';
export * from './ride';
```

**Apply to:** Ajouter `export * from './patient-constraint';` et `export * from './patient-note';` à `packages/shared/src/validators/index.ts` lors de leur création.

---

### Convention en-tête de migration

**Source:** Migrations 001 et 002, lignes 1-13 chacune.

**Apply to:** Migration 003.

```sql
-- =============================================================================
-- Migration 003 — Référentiel patients
-- =============================================================================
-- <objectif en 1-3 lignes>
-- =============================================================================
```

Pattern : ligne pleine de `=`, titre court, ligne pleine de `=`, description en français, ligne pleine.

---

## No Analog Found

Files with no close match in the codebase (planner should rely on RESEARCH.md sections 1, 4, 5 — patterns standards Next.js 14 + Supabase + shadcn/ui).

| File | Role | Data Flow | Reason | Reference |
|------|------|-----------|--------|-----------|
| `supabase/functions/nir/index.ts` | Edge Function | crypto + JWT | Premier service Deno du repo | RESEARCH §1 |
| `supabase/functions/nir/_test.ts` | Deno test | round-trip | Pas d'autre test Deno | RESEARCH §6 |
| `supabase/functions/import_map.json` | config Deno | — | — | docs Supabase Edge Functions |
| `apps/web/package.json` | config | — | `apps/web` n'existe pas | RESEARCH §4 |
| `apps/web/next.config.mjs` | config Next.js | — | — | docs Next.js 14 App Router |
| `apps/web/tailwind.config.ts` | config Tailwind | — | — | docs Tailwind + shadcn `init -d` |
| `apps/web/postcss.config.mjs` | config PostCSS | — | — | docs Tailwind v3+ |
| `apps/web/middleware.ts` | middleware Next | auth | Pattern unique au repo | RESEARCH §4 lignes 251-275 |
| `apps/web/src/app/layout.tsx` | RSC root layout | — | — | docs Next.js |
| `apps/web/src/app/globals.css` | CSS vars | — | Theme jour/nuit (D-21) | RESEARCH §4 « Theme via CSS vars » |
| `apps/web/src/app/(auth)/login/page.tsx` | Auth flow | — | — | docs `@supabase/ssr` |
| `apps/web/src/app/(app)/layout.tsx` | Layout providers | — | — | RESEARCH §5 (QueryClient + Theme) |
| `apps/web/src/app/(app)/patients/page.tsx` | RSC liste | — | — | RESEARCH §5 |
| `apps/web/src/app/(app)/patients/[id]/page.tsx` | RSC fiche | — | — | RESEARCH §5 |
| `apps/web/src/app/(app)/patients/[id]/edit/page.tsx` | Form edit | — | — | RESEARCH §5 + `react-hook-form` + `zodResolver` |
| `apps/web/src/app/(app)/patients/_components/patient-drawer.tsx` | Client UI | — | — | RESEARCH Pattern 2 |
| `apps/web/src/app/(app)/patients/_components/patient-search.tsx` | Client UI | debounce | — | RESEARCH §5 useDeferredValue |
| `apps/web/playwright.config.ts` | Config E2E | — | — | docs Playwright + RESEARCH §6 |
| `apps/web/e2e/patient-flow.spec.ts` | E2E | full flow | — | RESEARCH §6 lignes 360-374 |

**Recommandation au planner :** pour chacun de ces fichiers, citer explicitement la section de RESEARCH.md dans la tâche. Le planner peut ajouter à chaque tâche concernée une référence du type `voir RESEARCH.md §4 lignes 251-275`.

---

## Metadata

**Analog search scope:**
- `/home/user/TAP/supabase/migrations/` (2 fichiers)
- `/home/user/TAP/supabase/tests/` (1 fichier)
- `/home/user/TAP/packages/shared/src/` (5 fichiers TS)
- `/home/user/TAP/packages/database/src/` (4 fichiers TS)
- `/home/user/TAP/.github/workflows/` (3 fichiers YAML)
- `/home/user/TAP/` configs racine (`package.json`, `turbo.json`, `tsconfig.base.json`, `.env.example`, `supabase/config.toml`)

**Files scanned:** ~22 fichiers

**Key insights:**
- 100% des patterns SQL/migration ont un analog fort (migrations 001/002 + tests foundations.sql sont des modèles complets)
- 100% des patterns validators zod ont un analog fort (patient.ts existe déjà, ride.ts donne le style composé)
- 0% des patterns Next.js / apps/web / Edge Function ont un analog dans le repo — première vague à scaffolder. Le planner doit donc s'appuyer fortement sur RESEARCH.md §1 (NIR Edge Function), §4 (apps/web bootstrap), §5 (RSC + HydrationBoundary + drawer) qui contiennent déjà des squelettes de code production-ready.
- Les helpers RLS (`current_organization_id`, `has_role`, `current_user_role`) sont prêts à l'emploi dans toutes les policies de la migration 003 — pas besoin d'écrire de fonction supplémentaire pour la sécurité multi-tenant.
- La fonction `public.set_updated_at()` est partagée et réutilisable pour `patients` et `patient_operational_note`.
- L'audit_logs est append-only via RLS existante (`audit_logs_insert_self`) — les triggers Postgres et l'Edge Function pourront y insérer sans modification du schéma RLS.

**Pattern extraction date:** 2026-05-06
