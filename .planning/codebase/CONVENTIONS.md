# Coding Conventions

**Analysis Date:** 2026-05-12

## Langue et ton

- Tous les messages d'erreur, commentaires, libellés UI, commits sont **en français** (CLAUDE.md § 7, NFR-002).
- **Aucun nom propre** dans le code, commits, commentaires, UI, mockups (NFR-001 — `.planning/regle-neutralite-et-ton.md`). Exception unique : `supabase/seed.demo.sql`.
- Ton sobre, factuel. **Pas d'émojis** dans les fichiers source, commits, UI.
- **Reformulation FR systématique** de toute erreur Supabase / Postgres / réseau. Jamais de stack trace ni de code Postgres exposé au client. Exemple `apps/web/src/app/(auth)/login/actions.ts:54` :
  ```ts
  if (error) {
    return { error: 'Identifiants invalides ou compte inexistant.' };
  }
  ```

## Naming Patterns

**Fichiers :**
- `kebab-case.ts` pour modules TS purs : `parse-freeform-date.ts`, `patient-anonymize.ts`.
- `kebab-case.client.tsx` pour Client Components React (suffixe `.client` explicite) : `login-form.client.tsx`, `dev-switcher.client.tsx`, `driver-form.client.tsx`, `patient-drawer.client.tsx`.
- `page.tsx`, `layout.tsx`, `actions.ts` (Next.js App Router conventions).
- Server Actions découpées en `actions/<verbe>.ts` + `actions/index.ts` (barrel) quand le total dépasse ~150 lignes : voir `apps/web/src/app/(app)/courses/actions/{create,edit,cancel,assignment,payment,list,_shared}.ts`.
- Préfixe `_` pour helpers non exportés vers le routing Next.js : `_shared.ts`, `_components/`, `_lib/queries.ts`.

**Symboles :**
- Composants React : `PascalCase` (`LoginForm`, `DriverForm`, `SubmitButton`).
- Server Actions : `camelCase` se terminant par `Action` : `signInAction`, `createRideAction`, `cancelRideAction`, `upsertRideDraft`.
- Hooks : `useXxx` (convention React standard).
- Variables / fonctions : `camelCase`.
- Constantes top-level : `SCREAMING_SNAKE_CASE` (`REGULATEUR_OR_DIRIGEANT`, `ACCOUNTS`, `TYPE_PERMIS_LABELS`).
- Schémas zod : `xxxSchema` (`signInSchema`, `rideExpressInputSchema`, `cancelRideInputSchema`). Type inféré : `type Xxx = z.infer<typeof xxxSchema>`.
- Tables et colonnes Postgres : `snake_case` (`ride_draft`, `cancel_motif`, `created_by`, `organization_id`).

## TypeScript

- `strict: true` + `noUncheckedIndexedAccess: true` + `noImplicitOverride: true` (`tsconfig.base.json`). Cible `ES2022`, module `ESNext`, `moduleResolution: Bundler`.
- Types Supabase générés via `pnpm db:types` → `packages/database/src/types.gen.ts`.
- Validation runtime **systématique** via zod, types TS dérivés via `z.infer<typeof schema>`.
- `any` interdit (CLAUDE.md § 7). Casts `as never` tolérés uniquement pour contourner les types Supabase manquants sur tables `as never` à l'INSERT — voir `apps/web/src/app/(app)/courses/actions/create.ts:48`.

## Style et formatage

- **Prettier** (`.prettierrc`) : `semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: 'always'`, `endOfLine: 'lf'`.
- Plugin `prettier-plugin-tailwindcss` actif pour le tri automatique des classes Tailwind.
- Vérification CI : `pnpm format:check` + `pnpm lint` (workflow `.github/workflows/ci.yml` job `lint`).

## Forms — useFormState / useFormStatus uniquement

**Pattern unique du repo** : `useFormState` + `useFormStatus` depuis `react-dom` (React 18). **PAS `react-hook-form`** malgré sa présence en `dependencies` (`apps/web/package.json` ligne `"react-hook-form": "^7.53.0"` — coup mort historique).

**Justification documentée** dans `apps/web/src/app/(auth)/login/login-form.client.tsx:33-35` :
> « Pas de `react-hook-form` ici : le formulaire est trivial et `useFormState` + validation zod côté serveur suffisent. »

**Trois fichiers de référence :**

1. `apps/web/src/app/(auth)/login/login-form.client.tsx` — pattern minimal 2 champs :
   ```tsx
   'use client';
   import { useFormState, useFormStatus } from 'react-dom';
   import { signInAction, type SignInState } from './actions';

   const initialState: SignInState = {};

   function SubmitButton() {
     const { pending } = useFormStatus();
     return <Button type="submit" disabled={pending} aria-busy={pending} className="w-full h-12">
       {pending ? 'Connexion en cours…' : 'Se connecter'}
     </Button>;
   }

   export function LoginForm() {
     const [state, formAction] = useFormState(signInAction, initialState);
     return (
       <form action={formAction} className="space-y-16" noValidate>
         <Input id="email" name="email" type="email" required />
         {state.error ? <p role="alert" aria-live="polite">{state.error}</p> : null}
         <SubmitButton />
       </form>
     );
   }
   ```

2. `apps/web/src/app/dev/dev-switcher.client.tsx` — pattern multi-cards démo (chaque card a son propre `useFormState`).

3. `apps/web/src/app/(admin)/admin/chauffeurs/_components/driver-form.client.tsx` — pattern édition avec `.bind(null, driverId)` pour partial-apply de l'ID :
   ```tsx
   const action = initial
     ? updateDriverAction.bind(null, initial.id)
     : createDriverAction;
   const [state, formAction] = useFormState<ActionState, FormData>(action, {});
   ```
   et erreurs par champ via `state.fieldErrors` flatté depuis `ZodError.flatten().fieldErrors`.

## Server Actions

**Signature canonique** pour les actions liées à `useFormState` :
```ts
export async function xxxAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState>
```

**Pour les actions invoquées directement (non `useFormState`)** : signature à objet typé zod (`apps/web/src/app/(app)/courses/actions/create.ts:29`) :
```ts
export async function createRideAction(
  args: z.infer<typeof createRideInputSchema>,
): Promise<ActionState>
```

**Pipeline obligatoire** (CLAUDE.md § 10) :
1. `'use server';` en tête de fichier (sauf `_shared.ts` qui n'exporte aucune Server Action).
2. `safeParse` zod sur l'input. Erreur → retour FR `parsed.error.errors[0]?.message ?? 'Saisie invalide.'`.
3. `getAuthContext()` (variante minimale dans `_shared.ts` ou complète dans `@/lib/auth/get-auth-context`). `null` → `'Session expirée. Reconnectez-vous.'`.
4. Whitelist rôle applicative pour mutations sensibles : `if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as never)) return { error: 'Action réservée au régulateur.' };` — defense in depth en plus de RLS Postgres.
5. Mutation Supabase via `ctx.supabase`. **Jamais** de `service_role` côté client.
6. Audit log **par trigger Postgres** (`rides_audit_trigger`, `drivers_audit_trigger`) — jamais par code applicatif.
7. `revalidatePath('/courses')` (+ `/cockpit` si concerné).
8. Retour `{ success: true, id }` ou `{ error: '…' }`.

**Type `ActionState` partagé** (`actions/_shared.ts:24`) :
```ts
export type ActionState = {
  error?: string;
  success?: boolean;
  id?: string;
};
```
Variante étendue avec `fieldErrors?: Record<string, string>` pour les forms multi-champs (`admin/chauffeurs/actions.ts:21`).

**Open redirect protection** systématique (login) :
```ts
const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/patients';
```

## Tailwind spacing — échelle 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 uniquement

CLAUDE.md § 5 + NFR-003 : aucune valeur intermédiaire (`px-3`, `px-4`, `px-6` interdits).

**Classes autorisées et observées :**
- Padding : `p-16`, `p-24`, `px-12`, `py-8`, `py-12`.
- Gap : `gap-8`, `gap-12`, `gap-16`.
- Hauteurs cibles : `h-12` (48 px, bouton desktop), `h-16` (checkbox 64 px), `h-48`.
- Espacement vertical : `space-y-8`, `space-y-16`, `space-y-24`, `space-y-32`.

Exemples : `driver-form.client.tsx:62` `className="space-y-16"` ; `dev-switcher.client.tsx:64` `className="w-full h-12 justify-center gap-8"`.

**Piège — classes de hauteur `h-*` :** l'échelle custom du repo s'**ajoute** au default Tailwind via `theme.extend.spacing` (`apps/web/tailwind.config.ts`), elle ne le remplace pas. Les clés non couvertes par le custom (`10`, `40`, etc.) tombent sur l'échelle default en `rem` :
- `h-10` → `2.5rem` = **40 px** ✅ (utilisé par `Input` shadcn `apps/web/src/components/ui/input.tsx:13`)
- `h-40` → `10rem` = **160 px** ❌ (régression visuelle massive)

Règle : pour la hauteur d'un Input / Select / Button taille default, écrire `h-10` (et non `h-40`). Pour un bouton chauffeur ≥ 56 px (PWA mobile, CLAUDE.md § 5), écrire `h-14` (default `3.5rem` = 56 px). L'échelle custom px reste valable pour `padding`, `gap`, `space-*`, `width` fixes et tout ce qui n'est pas hauteur de champ de formulaire.

## Sheet / Drawer — largeurs fixes

**Patient drawer = 400 px fixe** ; **course/ride drawer = 480 px fixe**. Vérifié par E2E `boundingBox().width === 400` (`apps/web/e2e/patient-flow.spec.ts:57`).

| Drawer | Fichier | Largeur |
|---|---|---|
| Patient | `apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx:48` | 400 px |
| Course | `apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx:100` | 480 px |
| Driver | `apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx:130` | 480 px |
| DPIA / DPA / Breach / Request | `apps/web/src/app/(admin)/admin/legal/*/_components/*.client.tsx` | 400 px |

**Classes canoniques** :
```tsx
<SheetContent
  side="right"
  className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto"
>
```
La triple répétition `w-[400px] sm:w-[400px] sm:max-w-[400px]` neutralise les variants Radix `sm:max-w-sm` par défaut (cf. `apps/web/src/components/ui/sheet.tsx:40`).

## Imports

**Ordre observé** (Prettier ne le force pas, mais convention de fait) :
1. Imports React / Next.js : `import { revalidatePath } from 'next/cache';`
2. Imports tiers : `import { z } from 'zod';`
3. Imports workspace : `import { rideExpressInputSchema } from '@tap/shared';`
4. Imports applicatifs absolus via alias `@/` : `import { createClient } from '@/lib/supabase/server';`
5. Imports relatifs : `import { getAuthContext, type ActionState } from './_shared';`

**Aliases TS** : `@/*` mappé sur `apps/web/src/*` (cf. `apps/web/tsconfig.json`). Packages workspace via `@tap/shared`, `@tap/database`.

**Re-exports via barrel** systématique pour respecter la limite ≤ 300L/fichier : voir `apps/web/src/app/(app)/courses/actions/index.ts` qui réexporte 8 fichiers de Server Actions.

## Validation zod

- Schémas centralisés dans `packages/shared/src/validators/` (`patient.ts`, `ride.ts`, `driver.ts`, `vehicle.ts`, `common.ts`, `legal.ts`, `patient-constraint.ts`, `patient-note.ts`).
- **Messages d'erreur en français** intégrés au schéma : `z.string().uuid('Patient requis')`, `z.string().datetime({ offset: true, message: 'Date/heure requise' })`.
- Defaults métier dans le schéma : `.default('taxi_conventionne')`, `.default('programmee')`.
- Reformulation au call-site : `parsed.error.errors[0]?.message ?? 'Saisie invalide.'`.
- Multi-erreurs par champ : `z.ZodError.flatten().fieldErrors` flatté en `Record<string, string>` (helper `flattenFieldErrors` dans `admin/chauffeurs/actions.ts:45`).
- `FormData` brut : `formData.get('email') ?? undefined` (coerce `null` → `undefined` car `.optional()` zod ne digère que `undefined`).

## React / Next.js

- **App Router uniquement**. Server Components par défaut ; `'use client'` seulement quand nécessaire.
- Suffixe `.client.tsx` obligatoire sur tout Client Component (convention de nommage du repo).
- Pas de `useEffect` pour fetch initial (CLAUDE.md § 7). Données via Server Components ou wrappers Server Actions consommés par React Query (`@tanstack/react-query`).
- Pas de `console.log` en commit.
- `'use server';` ou `'use client';` en première ligne du fichier.
- `import 'server-only';` en tête des fichiers serveur partagés (`actions/_shared.ts:21`).

## Dates et localisation

- **TZ unique côté navigateur régulatrice** : `Indian/Reunion` (UTC+4). Configurée dans `apps/web/playwright.config.ts:36` (`timezoneId: 'Indian/Reunion'`) et `packages/shared/vitest.config.ts:10` (`env: { TZ: 'Indian/Reunion' }`).
- **Côté DB** : ISO 8601 UTC stockée.
- **Saisie libre** parseée via `chrono-node` locale FR avec `forwardDate: true` (`packages/shared/src/utils/parse-freeform-date.ts:31`) :
  ```ts
  parsed = chrono.fr.parseDate(input, ref, { forwardDate: true });
  ```
- Reformulation messages : `'Date requise'`, `'Format non reconnu — exemples : 15/05 14h30, demain 8h, lundi 9h'`, `'Date dans le passé'`.
- Date passée refusée systématiquement (DEC-005).
- **Picker date+heure transactionnel** (Phase 03.2.6 finalisée) : pattern `DateTimeFields` deux champs distincts (`apps/web/src/app/(app)/courses/_components/ride-express-form-fields.client.tsx`) — date à gauche (`dd/MM/yyyy`), heure à droite (`HH:mm`), grid-cols-2 gap-12. Chaque champ = `react-datepicker` v7 + `customInput` maison avec masque d'auto-insertion des séparateurs (`13052026` → `13/05/2026`, `1430` → `14:30`), `inputMode="numeric"`, `maxLength` 10/5, `enterKeyHint` next/done, `autoComplete="off"`, `strictParsing`, `isClearable`. L'icône Calendar/Clock est intégrée via wrapper `relative` + position `absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none` + padding-left `pl-32` sur l'input — **jamais via `showIcon` natif react-datepicker** (positionnement CSS interne moins prévisible). Locale `fr` forcée (`registerLocale('fr', fr)`), `calendarStartDay={1}` lundi, `todayButton="Aujourd'hui"`, `previousMonthAriaLabel`/`nextMonthAriaLabel` français. Garde-fous métier : `minDate={today}`, `minTime`/`maxTime` 05:00-22:00 (plage service taxi conventionné Réunion), `timeIntervals={15}`, `filterTime` dynamique (exclut créneaux passés si date = aujourd'hui). Portal externe via `portalId="datepicker-portal"` (ancré dans `apps/web/src/app/layout.tsx`) — zéro collision z-index avec les Sheet Radix. `onBlur` propagé depuis le modal parent pour autosave. Pour calendriers de filtre/range stats (Passe 3+), `react-datepicker` reste l'option par défaut ; ne pas réintroduire `react-day-picker` ni `@radix-ui/react-popover` sans justification documentée.
- **Classes de hauteur Tailwind** : pour tout champ de formulaire (Input/Select/Button taille default), écrire `h-10` (échelle Tailwind par défaut en rem = 40 px). L'échelle custom px du projet (`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`) reste valable pour `padding`, `gap`, `space-*`, `pl-*`/`pr-*`, et tout ce qui n'est pas hauteur de champ. Détail : `apps/web/tailwind.config.ts` utilise `theme.extend.spacing` ; les clés non couvertes par le custom (`10`, `40`, etc.) tombent sur le default Tailwind en rem (`h-40` = `10rem` = **160 px**, piège classique).

## Archivage logique — jamais de DELETE

**D-01 du repo** + CLAUDE.md anti-pattern : pas de `DELETE` sur tables métier. Pattern d'archivage :
```ts
archive: z.boolean().default(false),
archive_at: timestampz,
actif: z.boolean().default(true),
```
Voir `archiveDriverAction` dans `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts`. Le grant Postgres confirme : `not has_table_privilege('authenticated', 'public.rides', 'DELETE')` (`supabase/tests/rides_rls.sql:222`).

**Exception tolérée** : tables purement transitoires `ride_draft` (donnée RGPD-sensible, jamais audit) — DELETE autorisé filtré par `author_id = auth.uid()` via RLS.

## Defense in depth (RLS + role guards)

- **RLS Postgres FORCÉE** sur toute table métier (`alter table … force row level security;`) — testé par pgTAP `select relforcerowsecurity from pg_class`.
- **Role guards applicatifs** redondants dans les layouts (admin) et les Server Actions (whitelist `REGULATEUR_OR_DIRIGEANT`, `requireDirigeant()`).
- Toutes les colonnes `organization_id`, `created_by`, `updated_by` posées explicitement à l'INSERT (jamais auto via trigger — DRY ailleurs : RLS valide la cohérence).

## Limites de taille (CLAUDE.md § 11)

- **Fichier ≤ 300 lignes** : appliqué strictement. Le module Courses actions est découpé en 7 fichiers (`create.ts` 140L, `assignment.ts` 116L, etc.) plutôt qu'un seul fichier monolithique. Barrel `actions/index.ts` réexpose l'API publique.
- **Composant React ≤ 150 lignes**.
- **Fonction ≤ 50 lignes**.
- **Imbrication ≤ 3 niveaux**.
- Pas de magic numbers / strings — extraire en constantes (`ACCOUNTS`, `TYPE_PERMIS_LABELS`).

## Commentaires

- En français systématiquement.
- En-tête de fichier : encadré ASCII `// ===...===` ou JSDoc commençant par le contexte métier + référence ADR/DEC/Phase. Exemple `apps/web/src/app/(app)/courses/actions/cancel.ts:3-18`.
- Référence systématique aux décisions : `D-05`, `D-06`, `DEC-013`, `DEC-016`, `PAT-01`, `CLAUDE.md § 10`, `CDC v2 § 5.8`.
- Pas de TODO sans ticket associé (au minimum référence à un PLAN ou ADR).

## Commits

Conventional commits **en français** : `type(scope): description`.

Types observés : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

Exemples : `feat(courses): saisie express modal + brouillons`, `fix(rls): drivers cross-tenant insert`.

## Error handling

- **Jamais** de stack trace ou code Postgres affichés au client.
- Toute branche d'erreur retourne un `ActionState` avec `error: string` en français.
- Pour les forms : préférer `fieldErrors: Record<string, string>` pour pointer le champ fautif.
- `aria-live="polite"` + `role="alert"` sur les containers d'erreur (`login-form.client.tsx:69`).
- Vérification existence/permission via `.maybeSingle()` puis short-circuit FR : `if (!data) return { error: 'Course non modifiable : …' };`.

## Anti-patterns interdits (CLAUDE.md § 11)

- ❌ Logique métier dans composants React (déléguer à `packages/shared` ou Server Actions).
- ❌ Calcul tarification ailleurs que `packages/pricing` (Phase 4+).
- ❌ Requêtes Supabase sans typage généré.
- ❌ `useEffect` pour data initiale.
- ❌ Fichier > 300L, composant > 150L, fonction > 50L.
- ❌ `service_role` côté client.
- ❌ Désactiver RLS pour déboguer.
- ❌ SQL avec interpolation (toujours `.eq()` / `.in()` paramétrés).
- ❌ Noms propres dans le code (sauf `seed.demo.sql`).
- ❌ Émojis dans l'UI ou les fichiers source.

---

*Convention analysis: 2026-05-12*
