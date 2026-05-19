# Plan-1 — Migrations BDD + packages/recurrence MVP

**Phase**: 05 Récurrences + Cockpit + SMS + Patient absent
**Wave**: 1/7
**Dépendances**: aucune (démarre direct)
**Estimation**: 1.5h (vélocité projetée 20-30 min réel)
**Refs**: DEC-046 rrule.js, DEC-047 eager 3 mois, DEC-050 RÉVISÉ pg_cron+pg_net, DEC-013 100% branches, DEC-032 CD push exclusif

---

## Goal

Poser les fondations BDD Phase 05 (7 migrations) + le moteur de récurrences `packages/recurrence` testé 100% branches Vitest. Aucune UI cette wave — focus data + logique pure.

---

## Fichiers à créer

### Migrations BDD (7)

- `supabase/migrations/20260519000001_ride_recurrences.sql`
- `supabase/migrations/20260519000002_ride_recurrence_exceptions.sql`
- `supabase/migrations/20260519000003_holidays_974.sql`
- `supabase/migrations/20260519000004_sms_messages.sql`
- `supabase/migrations/20260519000005_sms_templates.sql`
- `supabase/migrations/20260519000006_rides_no_show_columns.sql`
- `supabase/migrations/20260519000007_pg_net_pg_cron_setup.sql`

### packages/recurrence (6 fichiers)

- `packages/recurrence/package.json`
- `packages/recurrence/tsconfig.json`
- `packages/recurrence/vitest.config.ts` (100% branches DEC-013)
- `packages/recurrence/src/index.ts`
- `packages/recurrence/src/rrule-helper.ts`
- `packages/recurrence/src/holidays-974.ts`
- `packages/recurrence/src/generate-occurrences.ts`
- `packages/recurrence/src/__tests__/generate-occurrences.test.ts` (sample 100% branches)

---

## Schémas migrations

### `ride_recurrences`

```sql
create table public.ride_recurrences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid null references public.prescriptions(id),
  rrule_str text not null, -- RFC 5545 RRULE string
  start_date date not null,
  end_date date null,
  pickup_address text not null,
  pickup_lat numeric(10,7) null,
  pickup_lng numeric(10,7) null,
  pickup_citycode text null,
  dropoff_address text not null,
  dropoff_lat numeric(10,7) null,
  dropoff_lng numeric(10,7) null,
  dropoff_citycode text null,
  transport_mode text not null,
  urgency text not null default 'normale',
  archived_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ride_recurrences enable row level security;

create policy ride_recurrences_select_org on public.ride_recurrences
  for select to authenticated using (organization_id = (select public.current_organization_id()));
create policy ride_recurrences_insert_regulateur on public.ride_recurrences
  for insert to authenticated with check (
    organization_id = (select public.current_organization_id())
    and (public.has_role('regulateur'::public.user_role) or public.has_role('dirigeant'::public.user_role))
  );
create policy ride_recurrences_update_regulateur on public.ride_recurrences
  for update to authenticated using (organization_id = (select public.current_organization_id()))
  with check (organization_id = (select public.current_organization_id()));

create index ride_recurrences_patient_id_idx on public.ride_recurrences (patient_id);
create index ride_recurrences_organization_id_idx on public.ride_recurrences (organization_id);
```

Activer aussi la colonne `ride_recurrence_id` sur `rides` (commentée historique 20260509000001_rides.sql:59) :

```sql
alter table public.rides
  add column ride_recurrence_id uuid null references public.ride_recurrences(id) on delete set null;
```

### `ride_recurrence_exceptions`

```sql
create table public.ride_recurrence_exceptions (
  id uuid primary key default gen_random_uuid(),
  ride_recurrence_id uuid not null references public.ride_recurrences(id) on delete cascade,
  excluded_date date not null,
  reason text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ride_recurrence_id, excluded_date)
);

alter table public.ride_recurrence_exceptions enable row level security;
create policy ride_recurrence_exceptions_org on public.ride_recurrence_exceptions
  for all to authenticated using (
    ride_recurrence_id in (
      select id from public.ride_recurrences
      where organization_id = (select public.current_organization_id())
    )
  );
```

### `holidays_974` (seed inclus)

```sql
create table public.holidays_974 (
  date date primary key,
  label text not null
);

insert into public.holidays_974 (date, label) values
  ('2026-01-01', 'Jour de l''An'),
  ('2026-04-06', 'Lundi de Pâques'),
  ('2026-05-01', 'Fête du Travail'),
  ('2026-05-08', 'Victoire 1945'),
  ('2026-05-14', 'Ascension'),
  ('2026-05-25', 'Lundi de Pentecôte'),
  ('2026-07-14', 'Fête nationale'),
  ('2026-08-15', 'Assomption'),
  ('2026-11-01', 'Toussaint'),
  ('2026-11-11', 'Armistice'),
  ('2026-12-20', 'Abolition de l''esclavage (974)'),
  ('2026-12-25', 'Noël'),
  ('2027-01-01', 'Jour de l''An'),
  ('2027-03-29', 'Lundi de Pâques'),
  -- ... années 2027/2028 idem (à compléter)
;

-- Lecture publique (tous les rôles authenticated)
alter table public.holidays_974 enable row level security;
create policy holidays_974_read on public.holidays_974
  for select to authenticated using (true);
```

### `sms_messages` (tracking delivery)

```sql
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  patient_id uuid null references public.patients(id),
  ride_id uuid null references public.rides(id),
  template_key text not null, -- 'j1_reminder' | 'j2h_reminder' | 'manual'
  to_phone text not null,
  body_rendered text not null,
  twilio_message_sid text null,
  delivery_status text not null default 'queued' check (delivery_status in
    ('queued','sent','delivered','failed','undelivered','skipped_consent_revoked')),
  delivery_error text null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.sms_messages enable row level security;
create policy sms_messages_org on public.sms_messages
  for select to authenticated using (organization_id = (select public.current_organization_id()));
```

### `sms_templates` (j1 + j2h seed)

```sql
create table public.sms_templates (
  key text primary key, -- 'j1_reminder' | 'j2h_reminder'
  body text not null check (length(body) <= 160),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.sms_templates (key, body, updated_by) values
  ('j1_reminder',
   'Bonjour {{patient_prenom}}, rappel course demain {{date}} a {{heure}} avec {{chauffeur_prenom}}. TAP Reunion.',
   '00000000-0000-0000-0000-000000000001'),
  ('j2h_reminder',
   '{{patient_prenom}}, votre course est dans 2h ({{heure}}). {{chauffeur_prenom}} vient vous chercher. TAP Reunion.',
   '00000000-0000-0000-0000-000000000001');

alter table public.sms_templates enable row level security;
create policy sms_templates_read on public.sms_templates
  for select to authenticated using (true);
create policy sms_templates_update_dirigeant on public.sms_templates
  for update to authenticated using (public.has_role('dirigeant'::public.user_role))
  with check (public.has_role('dirigeant'::public.user_role));
```

### `rides_no_show_columns`

```sql
alter table public.rides
  add column no_show_at timestamptz null,
  add column no_show_motif text null;

create index rides_no_show_at_idx on public.rides (no_show_at) where no_show_at is not null;
```

### `pg_net_pg_cron_setup`

```sql
create extension if not exists pg_net;

-- Vault déjà activé (supabase_vault 0.3.1)
-- Secret à créer hors migration (sécurité — instruction console post-merge) :
--   select vault.create_secret('XXXX-32-chars-uuid', 'cron_app_token');

select cron.schedule(
  'sms-reminder-j1',
  '0 14 * * *', -- 14h UTC = 18h Reunion (UTC+4)
  $$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'sms-reminder-j2h',
  '0 * * * *', -- toutes les heures
  $$
  select net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j2h',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_app_token')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## packages/recurrence — structure

### `package.json`

```json
{
  "name": "@tap/recurrence",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "rrule": "^2.8.1"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^2.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### `src/holidays-974.ts`

```ts
// Liste lue à l'init depuis BDD via Server Action (Wave 3 consommation).
// Helper pur ici pour test unitaire :
export function isHoliday974(date: Date, holidays: Set<string>): boolean {
  const iso = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return holidays.has(iso);
}
```

### `src/rrule-helper.ts`

```ts
import { rrulestr, RRule } from 'rrule';

export function parseRRule(rruleStr: string, dtstart: Date): RRule {
  return rrulestr(rruleStr, { dtstart }) as RRule;
}
```

### `src/generate-occurrences.ts`

```ts
import { parseRRule } from './rrule-helper';
import { isHoliday974 } from './holidays-974';

export interface GenerateOptions {
  rruleStr: string;
  dtstart: Date;
  until: Date;
  holidays974: Set<string>; // YYYY-MM-DD
  excludedDates?: Set<string>; // exceptions manuelles
}

export function generateOccurrences(opts: GenerateOptions): Date[] {
  const rule = parseRRule(opts.rruleStr, opts.dtstart);
  const all = rule.between(opts.dtstart, opts.until, true);
  return all.filter((d) => {
    if (isHoliday974(d, opts.holidays974)) return false;
    if (opts.excludedDates?.has(d.toISOString().slice(0, 10))) return false;
    return true;
  });
}
```

### `vitest.config.ts` — 100% branches DEC-013

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
    },
  },
});
```

### Tests sample 100% branches

- `generateOccurrences` weekly MWF avec dtstart lundi + until 1 mois → 12 occurrences
- Filtre holiday974 (14 juillet 2026 = mardi → si récurrence Tue → skipped)
- Filtre excludedDates manuel
- RRULE invalide → throw

---

## Success criteria Wave 1

1. 7 migrations appliquées via CD push exclusif (DEC-032), pas via MCP
2. `packages/recurrence` `pnpm test` GREEN avec 100% branches/functions/lines/statements
3. `pnpm typecheck` PASS (workspace inclus)
4. `cron.job` table montre 2 entries (`sms-reminder-j1`, `sms-reminder-j2h`)
5. `select * from public.holidays_974` retourne 12+ rows
6. `select * from public.sms_templates` retourne 2 rows seed

---

## Risques + Mitigations

- **Vault secret manuel post-merge** : doc step explicite dans SUMMARY Wave 1 (`vault.create_secret('XXXX', 'cron_app_token')`). Le secret est PAR ENVIRONNEMENT (staging/prod). Cohérent ENV vars Vercel séparées.
- **Timezone cron** : pg_cron UTC par défaut. `0 14 * * *` UTC = 18h Réunion (UTC+4). Documenter dans migration.
- **rrule.js dépendance** : DEC-046 LOCKED, maturité OK V1.5. Note CONCERNS Phase 06 (rrule-temporal).

---

## Anti-patterns / NE PAS FAIRE

- ❌ Apply migration via MCP `apply_migration` (DEC-032 strict, CD push uniquement)
- ❌ Skip Vitest 100% branches packages/recurrence (DEC-013 absolu)
- ❌ Hardcoder Vault secret dans migration (sécurité)
- ❌ Génération occurrences sans filter holidays_974 (RECU-02 NON respecté)
- ❌ Modifier colonnes existantes `rides` autres que `no_show_at`/`no_show_motif`

---

## Commit message proposé

```
feat(05-w1): migrations BDD Phase 05 + packages/recurrence MVP 100% branches

7 migrations : ride_recurrences + exceptions + holidays_974 +
sms_messages + sms_templates + rides no_show columns +
pg_net_pg_cron_setup (cron.schedule J-1 + J-2h vers Route Handler
Next.js via Vault secret).

packages/recurrence : rrule.js wrapper + generateOccurrences avec
EXDATE holidays_974 + Vitest 100% branches/functions/lines.

Refs : DEC-046/047/050/013/032, 05-CONTEXT.md PR #121.
```
