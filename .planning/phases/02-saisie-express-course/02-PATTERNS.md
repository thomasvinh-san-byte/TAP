# Phase 2 : Saisie express course — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 17 (à créer ou étendre)
**Analogs found:** 16 / 17 (1 sans analog direct — multi-instance modal store)

---

## File Classification

| Fichier à créer / modifier | Rôle | Data flow | Analog le plus proche | Qualité du match |
|---|---|---|---|---|
| `supabase/migrations/20260509000001_rides.sql` | migration (DB) | request-response (CRUD + audit) | `supabase/migrations/20260507000001_patients.sql` | exact |
| `supabase/tests/rides_rls.sql` | test (pgTAP) | request-response | `supabase/tests/patients.sql` | exact |
| `supabase/tests/ride_draft_rls.sql` | test (pgTAP) | request-response | `supabase/tests/patient_operational_note.sql` (proche) + `patients.sql` | role-match |
| `supabase/tests/rides_audit.sql` | test (pgTAP) | event (trigger) | `supabase/tests/check_breach_deadlines.sql` (audit_logs assertions) + `patients.sql` lignes 195-218 | role-match |
| `apps/web/src/app/(app)/courses/page.tsx` | server component (RSC) | request-response | `apps/web/src/app/(app)/patients/page.tsx` | exact |
| `apps/web/src/app/(app)/courses/actions.ts` | server (Server Actions) | CRUD | `apps/web/src/app/(app)/patients/actions.ts` + `constraints.actions.ts` | exact |
| `apps/web/src/app/(app)/courses/_lib/queries.ts` | server (queries RSC) | request-response | `apps/web/src/app/(app)/patients/queries.ts` | exact |
| `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx` | client component (form) | request-response (mutation) | `apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` + `patient-search.client.tsx` (réutilisé) | exact |
| `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` | client component (store useReducer) | event-driven (multi-instance) | **no analog** (greenfield) ; hint cookie-banner.client.tsx pour `useEffect+window.addEventListener` cleanup | partial |
| `apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx` | client component (dropdown) | request-response | `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` (useQuery + RSC fallback) | role-match |
| `apps/web/src/app/(app)/courses/_components/rides-list.client.tsx` | client component (table) | request-response | `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` | exact |
| `apps/web/src/app/(app)/layout.tsx` (modifié) | server layout | request-response | (lui-même — extension) | self |
| `apps/web/src/lib/keyboard-shortcuts.tsx` | client hook | event-driven (DOM) | `apps/web/src/components/cookie-banner.client.tsx` (useEffect + window listener cleanup, lignes 36-45) | role-match |
| `packages/shared/src/utils/parse-freeform-date.ts` | utility (pure, shared) | transform | `packages/shared/src/utils/patient-note.ts` + `packages/shared/src/validators/common.ts` (verifyLuhn pure helper) | role-match |
| `packages/shared/src/utils/__tests__/parse-freeform-date.test.ts` | test (Vitest) | transform | `packages/shared/src/utils/__tests__/patient-note.test.ts` (mock pattern) — pour parser pur, plutôt `validators/__tests__/patient.test.ts` | exact |
| `packages/shared/src/validators/ride.ts` (refonte) | shared validator | transform | `packages/shared/src/validators/patient.ts` + `common.ts` | exact |
| `packages/shared/src/validators/__tests__/ride.test.ts` | test (Vitest) | transform | `packages/shared/src/validators/__tests__/patient.test.ts` | exact |
| `apps/web/tests/e2e/saisie-express.spec.ts` | test E2E | request-response timing | `apps/web/tests/admin/breach-countdown.spec.ts` + `tests/smoke/preview.spec.ts` | role-match |
| `apps/web/tests/smoke/preview.spec.ts` (étendu) | test smoke | request-response | (lui-même) | self |

---

## Pattern Assignments

### `supabase/migrations/20260509000001_rides.sql` (migration, DB CRUD + audit)

**Analog :** `supabase/migrations/20260507000001_patients.sql`

**Header structure** (lignes 1-12) — copier le commentaire d'en-tête multi-section :
```sql
-- =============================================================================
-- Migration 004 — Courses (rides + ride_draft)
-- =============================================================================
-- Crée :
--   - types énumérés ride_transport_mode (4) + ride_urgency (3) + ride_status (8)
--   - tables rides + ride_draft
--   - RLS forcée + policies (regulateur + dirigeant ; brouillons author-scoped)
--   - 2 triggers updated_at + 1 trigger d'audit (rides uniquement, pas ride_draft)
--   - index org+scheduled_at, patient_idx, partial status='validee'
-- =============================================================================
```

**Pattern enums + tables** (lignes 27-69 du patients.sql, à dupliquer pour rides) :
```sql
create type public.ride_transport_mode as enum
  ('taxi_conventionne', 'tpmr', 'vsl', 'ambulance');
-- … (idem ride_urgency, ride_status — voir CONTEXT.md D-01)

create table public.rides (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  -- … (voir CONTEXT.md D-01 pour la liste complète)
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
```

**RLS forcée + policies** (lignes 114-138 — calque exact, role check `regulateur` OR `dirigeant`) :
```sql
alter table public.rides enable row level security;
alter table public.rides force row level security;

create policy rides_select_same_org on public.rides
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy rides_insert_regulateur on public.rides
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );
-- pas de DELETE → archivage logique via colonne archive
```

**Trigger d'audit** (lignes 199-222 — copier `patients_audit_trigger`, **renommer en `rides_audit_trigger`**, **retirer le filtre `- 'nir_encrypted' - 'nir_search_hash'`** car rides n'a pas de chiffrement applicatif) :
```sql
create or replace function public.rides_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'ride.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'ride', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger rides_audit_trigger
  after insert or update or delete on public.rides
  for each row execute function public.rides_audit_trigger();
```

**Pour `ride_draft`** : RLS scope = `author_id = auth.uid() AND organization_id = current_organization_id()` (cf. CONTEXT.md D-02 + RESEARCH §Pitfall 4). **PAS de trigger d'audit** sur `ride_draft` (donnée transitoire).

**Revoke / Grant** (lignes 273-278) :
```sql
revoke all on public.rides from anon;
grant select, insert, update on public.rides to authenticated;
revoke all on public.ride_draft from anon;
grant select, insert, update, delete on public.ride_draft to authenticated;
```

**Différences à apporter :**
- Pas de wrapper `unaccent_immutable` (pas de fuzzy search sur rides V1 — la recherche se fait sur patient → join)
- Pas de colonne générée `search_text`
- Pas de chiffrement applicatif → audit trigger SANS filtre de colonnes

---

### `supabase/tests/rides_rls.sql` (test pgTAP)

**Analog :** `supabase/tests/patients.sql` (lignes 1-285, parfaitement calquable)

**Fixtures multi-tenant** (lignes 23-57) — RÉUTILISER tel quel :
```sql
begin;
select plan(15);  -- ajuster selon nombre d'assertions

-- Org Alpha + Bravo + alpha-dir + alpha-reg + bravo-reg
-- (cf. patients.sql lignes 29-57 — 100 % réutilisable)
```

**Assertions RLS critiques** (à dupliquer en remplaçant `patients` par `rides`) :
```sql
-- 1-2. RLS activée + forcée
select ok((select relrowsecurity from pg_class where oid = 'public.rides'::regclass), 'RLS activée');
select ok((select relforcerowsecurity from pg_class where oid = 'public.rides'::regclass), 'RLS forcée');

-- 9-12. Isolation tenant
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';  -- alpha-reg
select lives_ok($$ insert into rides (...) values (...) $$, 'alpha-reg crée une course');

set local "request.jwt.claim.sub" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';  -- bravo-reg
select is((select count(*)::int from rides), 0, 'bravo-reg ne voit pas Alpha');
select throws_ok($$ insert into rides ... organization_id = alpha ... $$, '42501', null,
  'bravo-reg ne peut pas créer dans Alpha (RLS WITH CHECK)');
```

**Différences à apporter :**
- Tests spécifiques rides : statut par défaut `validee`, transport_mode default `taxi_conventionne`, urgency default `programmee`
- Pas de tests fuzzy/GIN/NIR (hors scope rides)
- Test supplémentaire : un chauffeur authentifié ne voit RIEN (`has_role('chauffeur')` ⇒ select count = 0) — extension du modèle Phase 1

---

### `supabase/tests/ride_draft_rls.sql` (test pgTAP)

**Analog primaire :** `supabase/tests/patients.sql` (fixtures + isolation)
**Analog secondaire :** Pitfall 4 RESEARCH — test multi-orgs cross-author

**Pattern critique** : **2 users dans la même org** (alpha-reg `cccccccc...` ET un 2e régulateur Alpha `eeeeeeee...` à ajouter en fixture). Vérifier que cccc voit ses propres brouillons, pas ceux de eeee, alors que les deux sont dans Alpha :
```sql
-- Fixture étendue : 2 users dans Alpha
insert into auth.users (id, ...) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', ..., 'alpha-reg2@test.tap', ...);
insert into public.profiles (id, organization_id, role, ...) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-...', 'regulateur', ...);

-- alpha-reg1 crée 1 brouillon
set local "request.jwt.claim.sub" = 'cccccccc-...';
insert into ride_draft (organization_id, author_id, payload) values
  ('11111111-...', 'cccccccc-...', '{}'::jsonb);

-- alpha-reg2 (même org) ne voit PAS le brouillon de reg1
set local "request.jwt.claim.sub" = 'eeeeeeee-...';
select is((select count(*)::int from ride_draft), 0,
  'reg2 (même org) ne voit aucun brouillon de reg1 (author_id scoping)');
```

---

### `supabase/tests/rides_audit.sql` (test pgTAP)

**Analog primaire :** `supabase/tests/patients.sql` lignes 195-218 (assertions audit_logs)
**Analog secondaire :** `supabase/tests/check_breach_deadlines.sql` (pattern audit_logs query)

**Assertions à dupliquer** (lignes 196-218 patients.sql) :
```sql
-- Après INSERT/UPDATE/DELETE → ligne audit_logs présente
select ok(
  (select exists(
     select 1 from public.audit_logs
       where action = 'ride.insert'
         and entity_type = 'ride'
         and organization_id = '11111111-...'
   )),
  'audit_logs reçoit ride.insert'
);

-- metadata->new contient les colonnes attendues
select ok(
  (select (metadata->'new') ? 'patient_id'
     from public.audit_logs where action = 'ride.insert' limit 1),
  'metadata new contient patient_id'
);
```

---

### `apps/web/src/app/(app)/courses/page.tsx` (server component RSC)

**Analog :** `apps/web/src/app/(app)/patients/page.tsx` (45 lignes, structure quasi identique)

**Imports + prefetch pattern** (lignes 1-27) :
```tsx
import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from '@tanstack/react-query';
import { listRides } from './_lib/queries';
import { RidesList } from './_components/rides-list.client';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Courses — TAP Régulation' };

export default async function CoursesPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['rides', { filter: 'all' }],
    queryFn: () => listRides({}),
  });
  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        {/* PAS de Link href="/courses/new" — bouton "+ Nouvelle course"
            ouvre le modal global via un client component (cf. orchestrator) */}
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <RidesList />
      </HydrationBoundary>
    </div>
  );
}
```

**Différences à apporter :**
- Pas de route `/courses/new` (DEC-015 : modal global, pas de page dédiée)
- Le bouton « + Nouvelle course » est dans le `(app)/layout.tsx` (header global), pas dans la page

---

### `apps/web/src/app/(app)/courses/actions.ts` (Server Actions)

**Analog :** `apps/web/src/app/(app)/patients/actions.ts` + `constraints.actions.ts`

**Imports + boilerplate** (lignes 1-34 patients/actions.ts) :
```ts
'use server';
import { revalidatePath } from 'next/cache';
import {
  rideExpressInputSchema,
  rideDraftSchema,
} from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; success?: boolean };
```

**Pattern Server Action (createRideAction)** — calquer `createPatientAction` (lignes 68-160 patients/actions.ts) :
```ts
export async function createRideAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Parse zod côté serveur (defense in depth)
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = rideExpressInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  // 2. Auth check (lignes 81-83)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' };

  // 3. Profile org_id (lignes 85-91)
  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id).single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  // 4. INSERT (lignes 108-137)
  const { data: row, error } = await supabase
    .from('rides')
    .insert({ organization_id: profile.organization_id, ...parsed.data,
              created_by: user.id, updated_by: user.id } as never)
    .select('id').single();
  if (error || !row) return { error: 'Création course impossible.' };

  // 5. Si fromDraftId : DELETE le brouillon
  // (idem pattern patient note replacement)

  // 6. revalidatePath (ligne 158)
  revalidatePath('/courses');
  return { success: true };
}
```

**Pattern upsertRideDraft idempotent** — voir RESEARCH § C3 pour la signature exacte. Calquer le mini-pattern de `addPatientConstraintAction` (constraints.actions.ts lignes 20-62) pour l'auth check + INSERT compact.

**Différences à apporter :**
- Pas de `redirect()` après création (le modal se ferme client-side, toast Sonner) — différence majeure vs `createPatientAction` qui redirige vers `/patients/[id]`
- Server Action retourne `{ success: true, id: row.id }` plutôt que de redirect
- Pas de chiffrement NIR à gérer
- `upsertRideDraft` utilise `.upsert(..., { onConflict: 'id' })` plutôt que `.insert()`

---

### `apps/web/src/app/(app)/courses/_lib/queries.ts` (queries RSC)

**Analog :** `apps/web/src/app/(app)/patients/queries.ts` (115 lignes)

**Pattern imports + types Database** (lignes 12-13) :
```ts
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@tap/database/types';

export type RideRow = Database['public']['Tables']['rides']['Row'];
```

**Pattern listRides** — copier la structure de `searchPatients` (lignes 34-68) :
```ts
export async function listRides(params: {
  status?: string; transport_mode?: string; q?: string;
}) {
  const supabase = createClient();
  let q = supabase.from('rides')
    .select('id, patient_id, scheduled_at, pickup_address, dropoff_address, status, transport_mode, urgency, created_at')
    .order('scheduled_at', { ascending: false })
    .limit(100);
  if (params.status) q = q.eq('status', params.status);
  if (params.transport_mode) q = q.eq('transport_mode', params.transport_mode);
  const { data, error } = await q;
  if (error) throw new Error('Lecture courses impossible');
  return data ?? [];
}
```

**Pattern recentAddresses (D-09 spécifics)** — RPC ou query directe :
```ts
export async function listRecentPickupAddresses(patientId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('rides')
    .select('pickup_address, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(5);
  // dédupliquer en JS (Postgres distinct on est plus complexe)
  const seen = new Set<string>();
  return (data ?? []).filter(r => !seen.has(r.pickup_address) && seen.add(r.pickup_address));
}
```

**Pattern listDrafts** — calquer `searchPatients` (RLS auto-filtre `author_id = auth.uid()`) :
```ts
export async function listDrafts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ride_draft')
    .select('id, payload, patient_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Lecture brouillons impossible');
  return data ?? [];
}
```

---

### `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx` (modal form)

**Analog primaire :** `apps/web/src/app/(app)/patients/_components/patient-form.client.tsx` (60 lignes — pattern useFormState + sections)
**Réutilisation directe :** `<PatientSearch>` de `patient-search.client.tsx` pour le champ patient

**Pattern useFormState + Server Action** (lignes 1-29 patient-form.client.tsx) :
```tsx
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PatientSearch } from '../../patients/_components/patient-search.client';  // RÉUTILISÉ
import { createRideAction, type ActionState } from '../actions';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-48">
      {pending ? 'Création…' : children}
    </Button>
  );
}

export function RideExpressModal({ open, onOpenChange, draftId }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(createRideAction, {});
  // … wrap dans <Dialog> Radix (cf. composant à installer via shadcn add dialog)
}
```

**Wrapper Dialog (Radix)** — analogiser sur `Sheet` (apps/web/src/components/ui/sheet.tsx lignes 1-12) :
```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
const Dialog = DialogPrimitive.Root;
const DialogContent = DialogPrimitive.Content;
// (le composant `dialog.tsx` à créer via `npx shadcn-ui@latest add dialog`)
```

**Différences à apporter :**
- Champ patient = `<PatientSearch>` interne avec `useQuery(['patients', { q }])` (pattern patients-list.client.tsx lignes 32-38)
- Champ date freeform = simple `<Input>` + onBlur → `parseFreeformDate(value)` (RESEARCH § C5)
- `<datalist>` HTML5 pour les 5 dernières adresses pickup
- Auto-save debounce 5s + onBlur → `upsertRideDraft` Server Action (RESEARCH § C3)
- Submit en `useOptimistic` + close immédiat + toast `Sonner` (RESEARCH § C6) — NE PAS utiliser `useFormState` seul si on veut le close < 100 ms ; option : `useTransition` + state local `isSubmitting`
- **Pas de `redirect`** — le modal se ferme côté client après réponse OK
- 7 champs max (CONTEXT.md D-09) : labels exacts pour E2E `getByLabel(/^…$/)` :
  - « Rechercher un patient » (réutilisé, déjà aria-label dans patient-search.client.tsx ligne 28)
  - « Date et heure »
  - « Adresse de prise en charge »
  - « Adresse de destination »
  - « Mode de transport »
  - « Urgence »
  - « Notes »

---

### `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` (multi-instance store)

**Analog :** **AUCUN** dans le codebase (pattern greenfield).
**Hint partiel :** `apps/web/src/components/cookie-banner.client.tsx` lignes 36-45 (useEffect + window event listener + cleanup) pour le hook `useGlobalShortcut` interne ; sinon RESEARCH § C1 + § C4 sont la spec exhaustive.

**Pattern à implémenter (RESEARCH § C4)** — `useReducer` local au composant orchestrateur :
```tsx
'use client';
import { useReducer, useCallback } from 'react';
import { useGlobalShortcut } from '@/lib/keyboard-shortcuts';
import { RideExpressModal } from './ride-express-modal.client';

type Draft = { tempKey: string; draftId?: string; minimized: boolean };
type Action =
  | { type: 'OPEN_NEW' }
  | { type: 'CLOSE'; tempKey: string }
  | { type: 'RESUME'; draftId: string }
  | { type: 'MINIMIZE'; tempKey: string };

function draftsReducer(state: Draft[], a: Action): Draft[] {
  // ~30 lignes — voir RESEARCH § C4 pour la spec exacte
}

export function RideExpressOrchestrator() {
  const [drafts, dispatch] = useReducer(draftsReducer, []);
  useGlobalShortcut(
    { mod: true, shift: true, key: 'k' },
    useCallback(() => dispatch({ type: 'OPEN_NEW' }), []),
  );
  // Render N <RideExpressModal> — un seul visible (le dernier non-minimisé)
  const visible = drafts.find(d => !d.minimized);
  return visible ? (
    <RideExpressModal
      key={visible.tempKey}
      tempKey={visible.tempKey}
      draftId={visible.draftId}
      onClose={() => dispatch({ type: 'CLOSE', tempKey: visible.tempKey })}
      onMinimize={() => dispatch({ type: 'MINIMIZE', tempKey: visible.tempKey })}
    />
  ) : null;
}
```

**Notes** :
- Pas de Context (cf. RESEARCH § C4 — overkill, re-render large)
- Le composant est monté dans `(app)/layout.tsx` une seule fois — sœur du `<DraftQueue>`

---

### `apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx` (header dropdown)

**Analog :** `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` (pattern useQuery + RSC bootstrap)

**Pattern useQuery + RSC prefetch** (lignes 32-38 patients-list) :
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DraftQueue({ onResume }: { onResume: (id: string) => void }) {
  const { data } = useQuery({
    queryKey: ['ride-drafts'],
    queryFn: () => listDraftsAction(),  // wrapper Server Action
    staleTime: 5_000,
  });
  const count = data?.length ?? 0;
  return (
    <button type="button" aria-label={`Brouillons (${count})`} className="...">
      <Inbox className="h-16 w-16" aria-hidden />
      {count > 0 && <Badge variant="secondary">{count}</Badge>}
      {/* Dropdown Radix (à installer via shadcn add dropdown-menu) */}
    </button>
  );
}
```

**Différences à apporter :**
- Composant `DropdownMenu` shadcn à installer (`npx shadcn-ui@latest add dropdown-menu`)
- Click sur item brouillon → `onResume(draftId)` qui dispatch `{type: 'RESUME', draftId}` à l'orchestrateur

---

### `apps/web/src/app/(app)/courses/_components/rides-list.client.tsx` (table + filtres)

**Analog :** `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` (100 lignes — pattern complet)

Calquer **intégralement** la structure :
- `useState` pour les filtres (`status`, `transport_mode`, `q`)
- `useDeferredValue` pour le query (lignes 28-29)
- `useQuery` avec `queryKey: ['rides', { … }]` (lignes 32-38)
- `<Skeleton>` pendant loading (lignes 50-58)
- Empty state explicite « Aucune course ne correspond » (lignes 60-64)
- `<ul role="list">` ou `<table>` avec `aria-label="Résultats"` (lignes 67-91)
- Click sur ligne → ouvre drawer fiche patient (Phase 1) ou détail course (V1.5)

---

### `apps/web/src/app/(app)/layout.tsx` (modification du layout existant)

**Analog :** lui-même (extension)

**Modification à apporter** (insérer entre les lignes 44 et 46) :
```tsx
import { RideExpressOrchestrator } from './courses/_components/ride-express-orchestrator.client';
import { DraftQueue } from './courses/_components/draft-queue.client';

// Dans le JSX :
<header className="border-b px-24 py-12 flex items-center justify-between">
  <Link href="/cockpit" className="font-semibold">TAP Régulation</Link>
  <nav className="flex gap-16 items-center">
    <Link href="/patients">Patients</Link>
    <Link href="/courses">Courses</Link>
    <DraftQueue />              {/* compteur brouillons */}
    {/* Bouton "+ Nouvelle course" qui dispatch OPEN_NEW à l'orchestrateur */}
  </nav>
</header>
{/* … */}
<RideExpressOrchestrator />     {/* monté ici → écoute Cmd+Shift+K global */}
```

**Note :** le bouton « + » et la `DraftQueue` doivent partager le `dispatch` de l'orchestrateur. **Décision impl** : soit promote le `useReducer` au layout (déconseillé — Server Component) soit Context minimal pour ces 2 enfants. Le planner devra trancher.

---

### `apps/web/src/lib/keyboard-shortcuts.tsx` (hook global)

**Analog :** `apps/web/src/components/cookie-banner.client.tsx` lignes 36-45 (pattern useEffect + window listener + cleanup)

**Code à extraire (cookie-banner.client.tsx 36-45)** — modèle de cleanup :
```tsx
useEffect(() => {
  const handler = () => { /* … */ };
  window.addEventListener('cookie-consent-reset', handler);
  return () => window.removeEventListener('cookie-consent-reset', handler);
}, []);
```

**Spec finale (RESEARCH § C1, exemple 3)** :
```tsx
'use client';
import { useEffect } from 'react';
interface ShortcutDef { mod: boolean; shift?: boolean; key: string; }
export function useGlobalShortcut(def: ShortcutDef, cb: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modOk = def.mod ? (e.metaKey || e.ctrlKey) : true;
      const shiftOk = def.shift ? e.shiftKey : !e.shiftKey;
      if (modOk && shiftOk && e.key.toLowerCase() === def.key) {
        e.preventDefault(); cb();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [def, cb]);
}
```

**Note d'extension :** fichier `.tsx` (pas `.ts`) car la déclaration `'use client'` est plus claire et autorise des composants (`<KeyboardShortcutsProvider>`) ultérieurement.

---

### `packages/shared/src/utils/parse-freeform-date.ts` (helper pur)

**Analog :** `packages/shared/src/utils/patient-note.ts` (pour la structure helper pur ≤ 50 lignes) + `packages/shared/src/validators/common.ts` lignes 39-51 (`verifyLuhn` — helper pur sans dépendance Supabase)

**Pattern helper pur** (verifyLuhn — common.ts 39-51) :
```ts
function verifyLuhn(siret: string): boolean {
  // … logique pure, signature simple ({input}) → boolean
}
```

**Spec parse-freeform-date (RESEARCH § C5)** :
```ts
import * as chrono from 'chrono-node';

export type ParseResult =
  | { ok: true; iso: string }
  | { ok: false; reason: string };

export function parseFreeformDate(input: string, ref: Date = new Date()): ParseResult {
  if (!input || input.trim().length === 0) {
    return { ok: false, reason: 'Date requise' };
  }
  const result = chrono.fr.parseDate(input, ref, { forwardDate: true });
  if (!result) return { ok: false, reason: 'Format non reconnu — exemples : 15/05 14h30, demain 8h, lundi 9h' };
  if (result.getTime() < Date.now()) return { ok: false, reason: 'Date dans le passé' };
  return { ok: true, iso: result.toISOString() };
}
```

**Différences à apporter :**
- Importer `chrono-node` (à ajouter via `pnpm --filter @tap/shared add chrono-node@2.9.1`)
- Exporter via `packages/shared/src/utils/index.ts` (pattern `patient-note.ts`)

---

### `packages/shared/src/utils/__tests__/parse-freeform-date.test.ts` (Vitest)

**Analog :** `packages/shared/src/validators/__tests__/patient.test.ts` (cas paramétrés simples — pour parser pur, plus pertinent que `patient-note.test.ts` qui mocke Supabase)

**Pattern (patient.test.ts 14-57)** :
```ts
import { describe, expect, it } from 'vitest';
import { parseFreeformDate } from '../parse-freeform-date';

describe('parseFreeformDate', () => {
  const ref = new Date('2026-05-07T08:00:00+04:00');  // Indian/Reunion

  it('1. accepte « 15/05 14h30 » → 2026-05-15 14:30 Indian/Reunion', () => {
    const r = parseFreeformDate('15/05 14h30', ref);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-05-15T10:30:00.000Z');
  });

  it('2. accepte « demain 8h »', () => { /* … */ });
  it('3. accepte « lundi 9h » → prochain lundi (forwardDate)', () => { /* … */ });
  it('4. rejette « 30/02 » avec reason explicite', () => { /* … */ });
  it('5. rejette une date passée « 01/05/2025 »', () => { /* … */ });
  it('6. rejette saisie vide', () => { /* … */ });
});
```

**Note critique (RESEARCH § Pitfall 5)** : le test DOIT être exécuté avec `TZ=Indian/Reunion` ou utiliser `vi.setSystemTime(ref)` pour figer le contexte. Vérifier que `playwright.config.ts` utilise déjà `timezoneId: 'Indian/Reunion'` (ligne 38) → cohérence de la chaîne.

---

### `packages/shared/src/validators/ride.ts` (refonte complète)

**Analog :** `packages/shared/src/validators/patient.ts` (79 lignes — pattern composition `z.object` + refines + types `z.infer`)

**Imports à reprendre** (patient.ts 1-7) :
```ts
import { z } from 'zod';
import {
  codePostalReunionSchema,
} from './common';
```

**Pattern composition + types** (patient.ts 51-78) :
```ts
export const rideTransportModeSchema = z.enum(['taxi_conventionne', 'tpmr', 'vsl', 'ambulance']);
export const rideUrgencySchema = z.enum(['programmee', 'urgente', 'immediate']);

export const rideExpressInputSchema = z.object({
  patient_id: z.string().uuid('Patient requis'),
  scheduled_at: z.string().datetime({ offset: true, message: 'Date/heure requise' }),
  pickup_address: z.string().trim().min(3, 'Adresse de prise en charge requise').max(200),
  pickup_postal_code: codePostalReunionSchema.optional(),
  pickup_city: z.string().trim().max(80).optional(),
  dropoff_address: z.string().trim().min(3, 'Adresse de destination requise').max(200),
  dropoff_postal_code: codePostalReunionSchema.optional(),
  dropoff_city: z.string().trim().max(80).optional(),
  transport_mode: rideTransportModeSchema.default('taxi_conventionne'),
  urgency: rideUrgencySchema.default('programmee'),
  notes_regulateur: z.string().trim().max(500).optional(),
});
export type RideExpressInput = z.infer<typeof rideExpressInputSchema>;

// Brouillon : tous champs optionnels
export const rideDraftSchema = rideExpressInputSchema.partial();
export type RideDraftInput = z.infer<typeof rideDraftSchema>;
```

**Différences à apporter (CRITIQUES — R3 RESEARCH) :**
- **SUPPRIMER** `courseExpressSchema` (existant Phase 0 stub, modèle incompatible)
- **SUPPRIMER** `typeTransportSchema` enum 2-valeurs (`assis`, `tpmr`) — remplacé par 4-valeurs
- `grep -r "courseExpressSchema\|typeTransportSchema" /home/user/TAP` avant de supprimer pour vérifier zéro consommateur
- Mettre à jour `packages/shared/src/index.ts` pour exporter les nouveaux symboles

---

### `packages/shared/src/validators/__tests__/ride.test.ts` (Vitest)

**Analog :** `packages/shared/src/validators/__tests__/patient.test.ts` (lignes 1-57)

Pattern identique à patient.test.ts — `describe` par schema, `baseValide` réutilisable, ~10 cas :
```ts
import { describe, expect, it } from 'vitest';
import { rideExpressInputSchema, rideDraftSchema } from '../ride';

describe('rideExpressInputSchema', () => {
  const baseValide = {
    patient_id: '11111111-1111-1111-1111-111111111111',
    scheduled_at: '2026-05-15T14:30:00+04:00',
    pickup_address: '12 rue Pasteur',
    dropoff_address: 'CHU Bellepierre',
  };

  it('1. accepte une saisie minimale valide avec defaults', () => {
    const p = rideExpressInputSchema.parse(baseValide);
    expect(p.transport_mode).toBe('taxi_conventionne');
    expect(p.urgency).toBe('programmee');
  });

  it('2. refuse un patient_id non-UUID', () => { /* … */ });
  it('3. refuse une scheduled_at sans offset (format invalide)', () => { /* … */ });
  it('4. refuse pickup_address < 3 chars', () => { /* … */ });
  it('5. refuse code postal hors Réunion', () => { /* … */ });
  it('6. accepte un brouillon partiel (rideDraftSchema)', () => { /* … */ });
  it('7. notes_regulateur > 500 chars rejetées', () => { /* … */ });
});
```

---

### `apps/web/tests/e2e/saisie-express.spec.ts` (Playwright E2E timing)

**Analog primaire :** `apps/web/tests/admin/breach-countdown.spec.ts` (auth + Server Action UI flow)
**Analog secondaire :** `apps/web/tests/smoke/preview.spec.ts` (login flow, env var skip)

**Imports + setup** (breach-countdown.spec.ts 11-22 + preview.spec.ts 14-26) :
```ts
import { test, expect } from '@playwright/test';

const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

test.describe('Saisie express course (SAIS-01..06)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
    await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'));
  });
  // … 6 tests SAIS-01..06
});
```

**Pattern timing SAIS-01** (RESEARCH exemple 4) :
```ts
test('SAIS-01 saisie complète < 30 s', async ({ page }) => {
  await page.goto('/cockpit');  // ou /patients selon état Phase 2
  const t0 = Date.now();
  await page.keyboard.press('Control+Shift+K');
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 500 });
  await page.getByLabel('Rechercher un patient').fill('Ho');
  await page.getByText(/Hoarau Patrick/i).click();
  await page.getByLabel('Date et heure').fill('15/05 14h30');
  await page.getByLabel('Adresse de prise en charge').fill('12 rue Pasteur, Saint-Denis');
  await page.getByLabel('Adresse de destination').fill('CHU Bellepierre');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Course créée/i)).toBeVisible({ timeout: 1000 });
  expect(Date.now() - t0).toBeLessThan(30_000);
});
```

**Pattern audit assertion (SAIS-06)** — calquer breach-countdown.spec.ts ligne 38-41 :
```ts
test('SAIS-06 audit log ride.insert créé', async ({ page, request }) => {
  // … créer une course
  // → assertion via API admin route OU via Supabase direct (si fixture seed.demo.sql alimente un user dirigeant qui peut lire audit_logs)
});
```

**Différences à apporter :**
- Ajouter un `data-testid="ride-modal"` ou utiliser `getByRole('dialog')` strict (Radix Dialog rend `role="dialog"`)
- Tests SAIS-04 (pause/reprise brouillon) : ouvrir modal, taper 2 champs, presser Esc, ouvrir DraftQueue, click brouillon → modal réouvre avec valeurs
- Tests SAIS-05 (multi-saisies) : 3 fois `Control+Shift+K`, vérifier que `DraftQueue` badge passe à 2 (le 3e est visible, les 2 premiers minimisés)

---

### `apps/web/tests/smoke/preview.spec.ts` (étension du smoke existant)

**Analog :** lui-même (lignes 1-55)

**Ajouts à insérer après ligne 54** :
```ts
test('route /courses accessible après login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'));
  await page.goto('/courses');
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
});

test('bouton + Nouvelle course visible dans header global', async ({ page }) => {
  // … login démo
  await page.goto('/patients');  // depuis n'importe quelle route (app)
  await expect(page.getByRole('button', { name: /nouvelle course/i })).toBeVisible();
});
```

---

## Shared Patterns (cross-cutting)

### Authentification + Authorization (Server Actions)

**Source :** `apps/web/src/app/(app)/patients/actions.ts` lignes 81-91
**Apply to :** `courses/actions.ts` (createRideAction, upsertRideDraft, deleteRideDraft)

```ts
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: 'Session expirée. Reconnectez-vous.' };

const profileRes = await supabase
  .from('profiles')
  .select('organization_id')
  .eq('id', user.id).single();
const profile = profileRes.data as { organization_id: string } | null;
if (!profile) return { error: 'Profil introuvable.' };
```

**Note :** la vérification de rôle `regulateur`/`dirigeant` est **déléguée à RLS Postgres** (policies `with check (has_role(...))`) — ne PAS dupliquer en JS, principe DRY + source de vérité serveur.

### RLS pattern (migrations DB)

**Source :** `supabase/migrations/20260507000001_patients.sql` lignes 114-138
**Apply to :** toute migration qui crée une table métier

```sql
alter table public.<table> enable row level security;
alter table public.<table> force row level security;

create policy <table>_select_same_org on public.<table>
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy <table>_insert_regulateur on public.<table>
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (public.has_role('regulateur'::public.user_role)
         or public.has_role('dirigeant'::public.user_role))
  );
```

### Audit trigger pattern

**Source :** `supabase/migrations/20260507000001_patients.sql` lignes 199-222
**Apply to :** `rides` (PAS `ride_draft`)

Pattern complet ci-dessus dans la section migration. Filtre de colonnes (`- 'nir_encrypted'`) **non requis** pour rides (pas de chiffrement applicatif).

### Validation zod composition

**Source :** `packages/shared/src/validators/patient.ts` + `common.ts`
**Apply to :** `validators/ride.ts`

```ts
import { codePostalReunionSchema } from './common';
// Réutiliser TOUJOURS les helpers communs plutôt que regex inline.
// Messages en français court ; un seul message clair par champ.
```

### Server Component prefetch + HydrationBoundary

**Source :** `apps/web/src/app/(app)/patients/page.tsx` lignes 22-44
**Apply to :** `courses/page.tsx`

```tsx
const queryClient = new QueryClient();
await queryClient.prefetchQuery({ queryKey: […], queryFn: () => listX() });
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ListClient />
  </HydrationBoundary>
);
```

### Client useQuery pattern (no useEffect-fetch)

**Source :** `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx` lignes 28-38
**Apply to :** `rides-list.client.tsx`, `draft-queue.client.tsx`

```tsx
const dq = useDeferredValue(q);
const { data, isPending } = useQuery({
  queryKey: ['rides', { q: dq }],
  queryFn: () => listRidesAction({ q: dq }),
  enabled: dq.length === 0 || dq.length >= 2,
  placeholderData: (prev) => prev,
  staleTime: 5_000,
});
```

### useEffect + window listener cleanup

**Source :** `apps/web/src/components/cookie-banner.client.tsx` lignes 36-45
**Apply to :** `lib/keyboard-shortcuts.tsx`

Toujours retourner la fonction de cleanup `removeEventListener` dans le `useEffect`.

### Test pgTAP fixtures multi-tenant

**Source :** `supabase/tests/patients.sql` lignes 23-57
**Apply to :** `rides_rls.sql`, `ride_draft_rls.sql`, `rides_audit.sql`

Réutiliser **mot pour mot** les UUID `aaaaaaaa-`/`cccccccc-`/`dddddddd-` et les orgs `11111111-`/`22222222-` pour cohérence avec la suite de tests existante.

### Test E2E login démo

**Source :** `apps/web/tests/smoke/preview.spec.ts` lignes 16-17, 46-54
**Apply to :** `tests/e2e/saisie-express.spec.ts` (beforeEach)

Constantes `REG_DEMO_EMAIL` / `REG_DEMO_PASSWORD` à dupliquer (ou centraliser dans un fichier helper si > 3 specs). La config Playwright a déjà `timezoneId: 'Indian/Reunion'` ligne 38 → pas de setup TZ supplémentaire requis.

---

## No Analog Found

| Fichier | Rôle | Data flow | Raison |
|---|---|---|---|
| `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` | client (store useReducer multi-instance) | event-driven | **Premier composant orchestrateur** dans le codebase (cookie-banner gère 1 instance singleton ; ici N instances). Le planner doit se référer à RESEARCH § C4 (spec exhaustive) plutôt qu'à un analog. |

**Mitigation :** RESEARCH.md fournit le squelette complet du reducer (§ C4) + la spec d'affichage (un seul Dialog visible, autres minimisés). Le pattern useEffect + cleanup pour le hook clavier interne est calqué sur cookie-banner.

---

## Documentation captures (Visible Progress D-12)

| Fichier | Rôle | Notes |
|---|---|---|
| `docs/showcase/02-saisie-express-course/01-modal-express-vide.png` | content (image) | À produire post-implémentation. Placeholder OK en Wave 0. |
| `docs/showcase/02-saisie-express-course/02-modal-recherche-patient.png` | content | idem |
| `docs/showcase/02-saisie-express-course/03-modal-rempli-prêt-submit.png` | content | idem |
| `docs/showcase/02-saisie-express-course/04-toast-creation-confirmee.gif` | content (animation) | idem |
| `docs/showcase/02-saisie-express-course/05-brouillons-dropdown-3-en-attente.png` | content | idem |
| `docs/showcase/02-saisie-express-course/06-page-courses-liste-30j.png` | content | idem |

**Pattern précédent à imiter (si existant) :** `ls /home/user/TAP/docs/showcase/` — vérifier la convention de nommage de Phase 1 ou 1.5. Aucune référence connue côté code, ces captures sont gérées hors codebase Git ou via LFS — non bloquant pour le planner.

---

## Metadata

**Analog search scope :**
- `/home/user/TAP/supabase/migrations/` (8 migrations)
- `/home/user/TAP/supabase/tests/` (11 fichiers pgTAP)
- `/home/user/TAP/apps/web/src/app/(app)/` (layout + patients/*)
- `/home/user/TAP/apps/web/src/components/` (ui/, cookie-banner, footer)
- `/home/user/TAP/apps/web/src/lib/` (supabase, nir-client, utils, cookie-consent)
- `/home/user/TAP/apps/web/tests/` (admin, public, portail, smoke)
- `/home/user/TAP/packages/shared/src/` (validators, utils, tests)

**Files scanned :** ~35 fichiers analysés intégralement ou en sections ciblées.
**Analogs strong (3-5 priorité haute identifiés) :**
1. `patients.sql` migration (pour rides + ride_draft)
2. `patients/actions.ts` (pour courses/actions.ts)
3. `patients/queries.ts` (pour courses/_lib/queries.ts)
4. `patients/_components/patients-list.client.tsx` (pour rides-list + draft-queue)
5. `patients/_components/patient-form.client.tsx` (pour ride-express-modal)

**Pattern extraction date :** 2026-05-07
