---
phase: 04.7
plan: 2
plan_number: 2
slug: caisse-regulateur
type: execute
status: draft
estimated_hours: 1.5-2
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/(app)/courses/caisse/page.tsx (NEW)
  - apps/web/src/app/(app)/courses/caisse/_components/caisse-summary.client.tsx (NEW)
  - apps/web/src/app/(app)/courses/caisse/_components/caisse-table.client.tsx (NEW)
  - apps/web/src/app/(app)/courses/caisse/_components/caisse-toolbar.client.tsx (NEW)
  - apps/web/src/app/(app)/courses/caisse/_lib/queries-caisse.ts (NEW)
  - apps/web/src/app/(app)/courses/actions/caisse.ts (NEW)
  - apps/web/src/app/(app)/courses/actions/index.ts (modif barrel)
  - apps/web/src/lib/csv.ts (NEW ou helper inline)
  - apps/web/src/components/app-sidebar.tsx (modif — ajout entrée Caisse)
  - apps/web/tests/e2e/caisse.spec.ts (NEW)
autonomous: true
decisions_implemented:
  - DEC-043
tags:
  - caisse
  - admin
  - csv
  - rls
must_haves:
  truths:
    - "Page /courses/caisse rendue conformément UI-PATTERNS layout admin"
    - "Sub-header total jour + 4 sous-totaux par mode paiement (cash/CB/chèque/CGSS différé)"
    - "Table dense 5 colonnes (Date, Patient, Chauffeur, Mode, Tarif) avec tri par colonne aria-sort"
    - "Filtres URL params (?date=YYYY-MM-DD&driver_id=...&sort=...&dir=...)"
    - "Export CSV utf-8-sig + ; + dates jj/mm/aaaa + montants virgule FR"
    - "Permissions régulateur + dirigeant only (DEC-043), chauffeur 403"
    - "Empty state Wallet centré si 0 rides encaissées"
    - "RLS Postgres scope organization_id (queries serveur)"
    - "Test E2E caisse.spec.ts couvre golden path + export CSV"
  artifacts:
    - path: "apps/web/src/app/(app)/courses/caisse/page.tsx"
      provides: "Surface C — Server Component page caisse"
    - path: "apps/web/src/app/(app)/courses/caisse/_lib/queries-caisse.ts"
      provides: "listRidesEncaissees(params) avec filtres serveur"
    - path: "apps/web/src/app/(app)/courses/actions/caisse.ts"
      provides: "exportCaisseCsvAction streaming server-side"
  key_links:
    - from: "page.tsx"
      to: "queries-caisse.ts"
      via: "Server Component direct call (pas Server Action wrapper)"
      pattern: "const rides = await listRidesEncaissees({ date, driverId, sort })"
    - from: "caisse-toolbar.client.tsx bouton Export"
      to: "exportCaisseCsvAction"
      via: "form action ou link href avec params"
      pattern: "Content-Disposition: attachment; filename=caisse-YYYY-MM-DD.csv"
---

<objective>
T2 — Caisse régulateur : page `/courses/caisse` Stripe Balance-like avec total jour, sous-totaux par mode paiement, table dense filtrable/triable, export CSV utf-8-sig Excel-FR-friendly. Permissions strictes régulateur + dirigeant (DEC-043). RLS Postgres scope organisation.

Output : 1 page Server Component + 3 composants Client (Summary, Table, Toolbar) + 1 module queries serveur + 1 Server Action export + helper CSV + 1 test E2E.

Verrous : DEC-043 LOCKED, V8 conformité UI-PATTERNS, V4 tests E2E avant merge, V7 row count check N/A (queries lecture).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/UI-PATTERNS.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-CONTEXT.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-UI-SPEC.md

# Patterns existants
@apps/web/src/app/(app)/courses/_lib/queries.ts
@apps/web/src/app/(admin)/admin/chauffeurs/page.tsx
@apps/web/src/lib/auth/require-admin-or-regulateur.ts

# Composants à réutiliser
@apps/web/src/components/ui/badge.tsx
@apps/web/src/components/ui/button.tsx
@apps/web/src/components/ui/initials-avatar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 2.1 — Queries caisse + helper CSV + Server Action export</name>
  <files>
    apps/web/src/app/(app)/courses/caisse/_lib/queries-caisse.ts,
    apps/web/src/lib/csv.ts,
    apps/web/src/app/(app)/courses/actions/caisse.ts,
    apps/web/src/app/(app)/courses/actions/index.ts
  </files>
  <action>
Per DEC-043. Couche données + export server-side.

Étapes :

1. **`queries-caisse.ts`** : fonctions serveur (pas `'use server'`, appelées par Server Components).
   ```ts
   import { createClient } from '@/lib/supabase/server';

   export interface CaisseFilters {
     date: string; // YYYY-MM-DD
     driverId?: string;
     paymentMethod?: 'cash' | 'cb' | 'cheque' | 'cgss_differe';
     sort?: 'date' | 'patient' | 'chauffeur' | 'tarif';
     dir?: 'asc' | 'desc';
   }

   export interface CaisseRow {
     id: string;
     scheduled_at: string;
     ended_at: string | null;
     tarif_amount_eur: number | null;
     payment_method: string | null;
     payment_status: string | null;
     payment_received_at: string | null;
     patient_nom: string;
     patient_prenom: string;
     driver_nom: string;
   }

   export interface CaisseTotals {
     total_eur: number;
     count: number;
     by_method: Record<string, number>; // cash / cb / cheque / cgss_differe → € total
   }

   export async function listRidesEncaissees(
     filters: CaisseFilters,
   ): Promise<{ rows: CaisseRow[]; totals: CaisseTotals }> {
     const supabase = createClient();
     // RLS scope automatique organization_id = current_organization_id()
     // Filtre status terminee + payment_status encaisse + date range
     const dateStart = new Date(`${filters.date}T00:00:00.000Z`).toISOString();
     const dateEnd = new Date(`${filters.date}T23:59:59.999Z`).toISOString();

     let q = supabase
       .from('rides')
       .select(`
         id, scheduled_at, ended_at,
         tarif_amount_eur, payment_method, payment_status, payment_received_at,
         patient:patients!inner(nom, prenom),
         driver:drivers(nom_affichage)
       `)
       .eq('status', 'terminee')
       .eq('payment_status', 'encaisse')
       .gte('ended_at', dateStart)
       .lte('ended_at', dateEnd);

     if (filters.driverId) q = q.eq('driver_id', filters.driverId);
     if (filters.paymentMethod) q = q.eq('payment_method', filters.paymentMethod);

     // Tri serveur — sort = 'date' → ended_at, etc.
     const sortCol = filters.sort === 'tarif' ? 'tarif_amount_eur' : 'ended_at';
     q = q.order(sortCol, { ascending: filters.dir === 'asc' });

     const res = await q;
     if (res.error) return { rows: [], totals: { total_eur: 0, count: 0, by_method: {} } };

     const rows: CaisseRow[] = (res.data as never[]).map((r) => ({
       id: r.id, scheduled_at: r.scheduled_at, ended_at: r.ended_at,
       tarif_amount_eur: r.tarif_amount_eur,
       payment_method: r.payment_method,
       payment_status: r.payment_status,
       payment_received_at: r.payment_received_at,
       patient_nom: r.patient?.nom ?? '',
       patient_prenom: r.patient?.prenom ?? '',
       driver_nom: r.driver?.nom_affichage ?? '',
     }));

     const totals: CaisseTotals = {
       total_eur: rows.reduce((acc, r) => acc + Number(r.tarif_amount_eur ?? 0), 0),
       count: rows.length,
       by_method: rows.reduce((acc, r) => {
         const m = r.payment_method ?? 'inconnu';
         acc[m] = (acc[m] ?? 0) + Number(r.tarif_amount_eur ?? 0);
         return acc;
       }, {} as Record<string, number>),
     };

     return { rows, totals };
   }
   ```

2. **`apps/web/src/lib/csv.ts`** : helper Excel FR.
   ```ts
   const BOM = '﻿';
   const SEP = ';';

   export function formatEurFr(amount: number): string {
     return amount.toFixed(2).replace('.', ',');
   }

   export function formatDateFr(iso: string): string {
     const d = new Date(iso);
     const pad = (n: number) => String(n).padStart(2, '0');
     return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
   }

   export function escapeCsv(v: string | number | null | undefined): string {
     if (v === null || v === undefined) return '';
     const s = String(v);
     return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
   }

   export function toCsv(headers: string[], rows: string[][]): string {
     const headerLine = headers.map(escapeCsv).join(SEP);
     const bodyLines = rows.map((row) => row.map(escapeCsv).join(SEP));
     return BOM + [headerLine, ...bodyLines].join('\r\n');
   }
   ```

3. **`actions/caisse.ts`** : Server Action export.
   ```ts
   'use server';

   import { z } from 'zod';
   import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
   import { listRidesEncaissees, type CaisseFilters } from '../caisse/_lib/queries-caisse';
   import { toCsv, formatEurFr, formatDateFr } from '@/lib/csv';

   const exportSchema = z.object({
     date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
     driverId: z.string().uuid().optional(),
     paymentMethod: z.enum(['cash', 'cb', 'cheque', 'cgss_differe']).optional(),
   });

   export async function exportCaisseCsvAction(
     input: z.infer<typeof exportSchema>,
   ): Promise<{ csv?: string; filename?: string; error?: string }> {
     const parsed = exportSchema.safeParse(input);
     if (!parsed.success) return { error: 'Filtres invalides.' };
     const ctx = await requireAdminOrRegulateur();
     if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

     const { rows } = await listRidesEncaissees(parsed.data as CaisseFilters);
     const csv = toCsv(
       ['Date', 'Patient', 'Chauffeur', 'Mode paiement', 'Tarif (€)'],
       rows.map((r) => [
         formatDateFr(r.ended_at ?? r.scheduled_at),
         `${r.patient_nom} ${r.patient_prenom}`.trim(),
         r.driver_nom,
         labelPaymentMethod(r.payment_method),
         formatEurFr(Number(r.tarif_amount_eur ?? 0)),
       ]),
     );

     return { csv, filename: `caisse-${parsed.data.date}.csv` };
   }

   function labelPaymentMethod(m: string | null): string {
     switch (m) {
       case 'cash': return 'Cash';
       case 'cb': return 'CB';
       case 'cheque': return 'Chèque';
       case 'cgss_differe': return 'CGSS différé';
       default: return '';
     }
   }
   ```

   Note : Server Action retourne le CSV en string + filename, le composant client déclenche le download via Blob + anchor (pattern courant Next.js Server Actions).

4. **`actions/index.ts`** : ajouter `exportCaisseCsvAction`.

Hors scope : pagination serveur (différée si volume > 50/jour observé), tri serveur paginé (V1.5 tri en mémoire suffit).
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
  </verify>
  <done>
    - listRidesEncaissees retourne rows + totaux par mode
    - Helper CSV utf-8-sig + ; + format FR opérationnel
    - exportCaisseCsvAction protégée requireAdminOrRegulateur
    - Filtres serveur (date, driverId, paymentMethod) appliqués
  </done>
  <rollback>
    Supprimer `apps/web/src/app/(app)/courses/caisse/_lib/` + `actions/caisse.ts`. Pas d'impact runtime.
  </rollback>
</task>

<task type="auto">
  <name>Task 2.2 — Page /courses/caisse + composants UI (Summary, Table, Toolbar) + sidebar</name>
  <files>
    apps/web/src/app/(app)/courses/caisse/page.tsx,
    apps/web/src/app/(app)/courses/caisse/_components/caisse-summary.client.tsx,
    apps/web/src/app/(app)/courses/caisse/_components/caisse-table.client.tsx,
    apps/web/src/app/(app)/courses/caisse/_components/caisse-toolbar.client.tsx,
    apps/web/src/components/app-sidebar.tsx
  </files>
  <action>
Per UI-SPEC Surface C + UI-PATTERNS.md layout admin.

Étapes :

1. **`page.tsx`** Server Component :
   ```tsx
   import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
   import { listRidesEncaissees, type CaisseFilters } from './_lib/queries-caisse';
   import { listActiveDriversAction } from '../actions';
   import { CaisseToolbar } from './_components/caisse-toolbar.client';
   import { CaisseSummary } from './_components/caisse-summary.client';
   import { CaisseTable } from './_components/caisse-table.client';

   export const metadata = { title: 'Caisse — TAP Régulation' };

   interface PageProps {
     searchParams: { date?: string; driver_id?: string; payment_method?: string; sort?: string; dir?: string };
   }

   export default async function CaissePage({ searchParams }: PageProps) {
     await requireAdminOrRegulateurPage();
     const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
     const filters: CaisseFilters = {
       date,
       driverId: searchParams.driver_id,
       paymentMethod: searchParams.payment_method as never,
       sort: (searchParams.sort as never) ?? 'date',
       dir: (searchParams.dir as never) ?? 'desc',
     };
     const [{ rows, totals }, drivers] = await Promise.all([
       listRidesEncaissees(filters),
       listActiveDriversAction(),
     ]);

     return (
       <div className="space-y-24 max-w-[1280px]">
         <header>
           <h1 className="text-2xl font-semibold tracking-tight">Caisse</h1>
           <p className="text-sm text-muted-foreground">
             Encaissements de la journée. Total et détail par course.
           </p>
         </header>
         <CaisseToolbar date={date} drivers={drivers} filters={filters} />
         <CaisseSummary totals={totals} />
         <CaisseTable rows={rows} filters={filters} />
       </div>
     );
   }
   ```

   Pré-requis : créer `apps/web/src/lib/auth/require-admin-or-regulateur-page.ts` si n'existe pas (miroir `require-dirigeant-page.ts` Phase 1.5).

2. **`caisse-summary.client.tsx`** :
   - Container `rounded-md border border-border bg-muted/20 p-16`
   - Total jour `text-2xl font-semibold tabular-nums` + count en muted
   - Grille `grid grid-cols-4 gap-12` avec 4 modes paiement (label + montant tabular-nums)

3. **`caisse-table.client.tsx`** :
   - Tableau `divide-y divide-border rounded-md border border-border`
   - Headers `<th>` cliquables avec `aria-sort` (Link Next vers `?sort=...&dir=...`)
   - 5 colonnes selon UI-SPEC § Surface C
   - Badge sémantique mode paiement (cash=outline, CB=secondary blue accent, chèque=warning, CGSS différé=destructive)
   - Click row → ouvrir ride-drawer (lien Next vers `?ride=ID`)
   - Empty state Wallet centré si `rows.length === 0`
   - `<tfoot>` sticky bottom avec total

4. **`caisse-toolbar.client.tsx`** :
   - Navigation date « < Hier | Aujourd'hui | Demain > » avec date input central
   - Select chauffeur (Tous + drivers liste)
   - Bouton Export CSV → appel `exportCaisseCsvAction` → Blob download
   - Pas de SearchInput V1.5 (low priority)

5. **`app-sidebar.tsx`** : ajouter entrée « Caisse » sous « Courses » (icône Wallet Lucide).

Permissions : `requireAdminOrRegulateurPage()` au début de Server Component — redirect /403 si chauffeur ou anon.

R1 contraste WCAG AA validé sur badges Mode paiement (palettes existantes Phase 04.5 PR #81).
R2 a11y : table tri via `<th>` button + `aria-sort` + Enter/Space.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
    Manual : login régulateur → /courses/caisse → page rendue. Login chauffeur → /courses/caisse → 403.
  </verify>
  <done>
    - Page /courses/caisse rendue + sidebar entrée Caisse
    - 3 composants Client opérationnels
    - Permissions DEC-043 appliquées (DOM + serveur)
    - Empty state visible si pas de ride encaissée
    - Tri colonne fonctionnel via URL params
  </done>
  <rollback>
    Supprimer `apps/web/src/app/(app)/courses/caisse/` + revert sidebar.
  </rollback>
</task>

<task type="auto">
  <name>Task 2.3 — Test E2E caisse.spec.ts</name>
  <files>
    apps/web/tests/e2e/caisse.spec.ts
  </files>
  <action>
Couvre golden path régulateur + export CSV + 403 chauffeur.

Scénarios :
- **S1 Régulateur** : login régulateur → /courses/caisse → header « Caisse » visible
- **S2 Total** : assert sub-header total jour visible avec `€` formaté FR
- **S3 Filtres** : changer date `?date=2026-05-14` → assert URL + rendu mis à jour
- **S4 Tri** : cliquer header colonne Tarif → URL contient `?sort=tarif&dir=desc`
- **S5 Export CSV** : cliquer bouton Export → Playwright `expect download` → vérifier filename `caisse-YYYY-MM-DD.csv`
- **S6 Chauffeur 403** : login chauffeur → /courses/caisse → assert page 403 ou redirect

Skip propre si pas de ride encaissée ce jour (seed démo). Document dette test idempotence dans CONCERNS si pertinent.
  </action>
  <verify>
    <automated>cd apps/web && pnpm exec playwright test tests/e2e/caisse.spec.ts --reporter=line</automated>
  </verify>
  <done>
    - 6 scénarios E2E PASS ou SKIP propre
    - Aucun FAIL flaky
  </done>
  <rollback>
    `git revert` du test file.
  </rollback>
</task>

</tasks>

<threat_model>
| Threat | Mitigation |
|---|---|
| T-04.7-06 Chauffeur accède /courses/caisse | requireAdminOrRegulateurPage + RLS Postgres |
| T-04.7-07 Cross-org leak CSV export | RLS scope organization_id appliquée queries |
| T-04.7-08 Injection CSV (formula injection Excel) | escapeCsv préfixe `'` si valeur commence par `=`, `+`, `-`, `@` (à ajouter helper) |
| T-04.7-09 DoS export énorme | V1.5 pas de pagination. À monitorer si volume > 1000 lignes |
</threat_model>

<verification>
1. TypeScript strict OK
2. Page rendue Server Component + 3 Client components
3. Permissions DEC-043 verrouillées DOM + serveur
4. Export CSV téléchargeable + filename conforme + encoding utf-8-sig
5. Test E2E PASS
</verification>

<success_criteria>
- [ ] DEC-043 LOCKED dans PROJECT.md
- [ ] Page /courses/caisse accessible régulateur + dirigeant
- [ ] Chauffeur reçoit 403
- [ ] Total jour + 4 sous-totaux affichés
- [ ] Export CSV ouvert dans Excel FR sans encoding cassé
- [ ] Capture preview Vercel `.planning/phases/04.7-pricing-mockup-caisse/captures/C-page-caisse.png`
</success_criteria>

<output>
Créer `04.7-2-SUMMARY.md` après exécution.
</output>
