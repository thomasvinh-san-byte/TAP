---
phase: 01-referentiel-patients
plan: 4
subsystem: apps/web bootstrap (Next.js 14 App Router + Tailwind + shadcn/ui + Supabase Auth)
tags: [nextjs, tailwind, shadcn, supabase-auth, theme, tanstack-query]
requires: [01-2, 01-3]
provides:
  - "apps/web workspace pnpm fonctionnel (build Next.js 14 propre)"
  - "Middleware Supabase Auth PKCE (getUser, redirect /login si non authentifié)"
  - "Wrappers @/lib/supabase/{server,client,middleware} re-exportant @tap/database (ADR-001)"
  - "Theme jour/nuit via CSS vars uniquement (data-theme=dark sur <html>, anti-FOUC inline, sans next-themes)"
  - "Page /login fonctionnelle (Server Action signInAction, message erreur FR reformulé, bouton h-12)"
  - "Providers TanStack Query + Sonner Toaster"
  - "Composants shadcn/ui de base : button, input, label, sheet, skeleton, sonner, form"
  - "Factory createSupabaseMiddlewareClient ajoutée à @tap/database"
affects:
  - "Wave 3 (PLAN-5) UI patient : pourra greffer /patients, /patients/[id], /patients/[id]/edit, PatientDrawer sous (app)/layout.tsx"
tech-stack:
  added:
    - "next 14.2 (App Router, RSC, src/ layout, middleware src/)"
    - "react 18.3 + react-dom (useFormState/useFormStatus pour Server Actions)"
    - "@tanstack/react-query 5.56 (+ devtools) — DEC-022"
    - "react-hook-form 7.53 + @hookform/resolvers 3.9 + zod 3.23"
    - "tailwindcss 3.4 + tailwindcss-animate + tailwind-merge + clsx + class-variance-authority"
    - "lucide-react 0.439 (icônes ligne fine, famille unique)"
    - "sonner 1.5 (toasts riches, fallback skeleton-friendly)"
    - "@radix-ui/react-{slot,label,dialog} (peer deps des composants shadcn)"
  patterns:
    - "Re-export ADR-001 strict : apps/web/src/lib/supabase/* → @tap/database, jamais @supabase/* directement"
    - "Anti-FOUC inline script dans <head> du root layout (pas de next-themes)"
    - "Spacing strict 4/8/12/16/24/32/48/64 px dans tailwind.config.ts (aucune valeur intermédiaire)"
    - "Reformulation FR systématique des erreurs Supabase Auth (jamais 'Invalid login credentials')"
    - "Open-redirect protection : `next` doit commencer par `/` (pas `//`), fallback `/patients`"
    - "Garde-fou serveur dans (app)/layout.tsx en complément du middleware (ceinture+bretelles)"
key-files:
  created:
    - apps/web/.env.local.example
    - apps/web/.gitignore
    - apps/web/components.json
    - apps/web/next-env.d.ts
    - apps/web/next.config.mjs
    - apps/web/postcss.config.mjs
    - apps/web/tailwind.config.ts
    - apps/web/src/app/(app)/layout.tsx
    - apps/web/src/app/(app)/providers.client.tsx
    - apps/web/src/app/(auth)/login/actions.ts
    - apps/web/src/app/(auth)/login/login-form.client.tsx
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/form.tsx
    - apps/web/src/components/ui/input.tsx
    - apps/web/src/components/ui/label.tsx
    - apps/web/src/components/ui/sheet.tsx
    - apps/web/src/components/ui/skeleton.tsx
    - apps/web/src/components/ui/sonner.tsx
    - apps/web/src/lib/supabase/client.ts
    - apps/web/src/lib/supabase/middleware.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/lib/utils.ts
    - apps/web/src/middleware.ts
    - packages/database/src/middleware-client.ts
  modified:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - packages/database/package.json
    - packages/database/src/index.ts
    - pnpm-lock.yaml
decisions:
  - "Composants shadcn créés manuellement (registre HTTP shadcn/ui inaccessible depuis le sandbox sans token). Code identique au registre officiel (MIT)."
  - "Middleware déplacé en `apps/web/src/middleware.ts` (et non `apps/web/middleware.ts`). Avec le `src/` layout, Next.js 14 cherche `src/middleware.ts` ; mettre `middleware.ts` à la racine de `apps/web` est silencieusement ignoré (smoke test : 404 au lieu de 307 redirect)."
  - "Pas de `react-hook-form` sur le formulaire de login (2 champs triviaux). useFormState + zod côté serveur suffisent. RHF sera utilisé en PLAN-5 pour le formulaire patient (15+ champs typés)."
  - "Bouton login h-12 (48 px) : conforme spacing system desktop régulateur (CLAUDE.md § 5). Les 56 px sont réservés à la PWA chauffeur (mobile, mains occupées)."
  - "Garde-fou serveur dans `(app)/layout.tsx` (re-check `getUser()` + `redirect('/login')`) en plus du middleware. Coût : 1 round-trip Supabase Auth par render. Bénéfice : si le middleware est court-circuité (matcher mal écrit, edge case), le RSC ne rend pas la page protégée."
metrics:
  duration: ~25 minutes
  tasks: 3
  files_created: 27
  files_modified: 5
  completed: 2026-05-07T05:28:32Z
---

# Phase 01 Plan 4 : apps/web bootstrap Summary

Bootstrap minimal et strict de `apps/web` (Next.js 14 App Router + Tailwind + shadcn/ui + Supabase Auth PKCE), prêt à recevoir la couche UI patient (PLAN-5).

## Composants shadcn/ui ajoutés (chemins)

| Composant | Fichier | Notes |
|-----------|---------|-------|
| Button | `apps/web/src/components/ui/button.tsx` | 6 variants × 4 sizes ; `asChild` via `@radix-ui/react-slot` |
| Input | `apps/web/src/components/ui/input.tsx` | Standard html input + classes Tailwind tokens design system |
| Label | `apps/web/src/components/ui/label.tsx` | Radix Label primitive |
| Sheet | `apps/web/src/components/ui/sheet.tsx` | Drawer 4 sides (right par défaut) — base du futur `PatientDrawer` (D-12) |
| Skeleton | `apps/web/src/components/ui/skeleton.tsx` | `animate-pulse` muted (CLAUDE.md § 1 : jamais de spinners > 500 ms) |
| Sonner | `apps/web/src/components/ui/sonner.tsx` | Toaster wrapper avec classes design system |
| Form | `apps/web/src/components/ui/form.tsx` | RHF FormProvider + FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage typés zod |

## Utilitaires exposés à PLAN-5

```ts
// apps/web/src/lib/utils.ts
export function cn(...inputs: ClassValue[]): string;

// apps/web/src/lib/supabase/server.ts
export function createClient(): SupabaseClient<Database>;  // RSC + Server Actions

// apps/web/src/lib/supabase/client.ts
export { createSupabaseBrowserClient as createClient };    // Client Components

// apps/web/src/lib/supabase/middleware.ts
export { createSupabaseMiddlewareClient };                  // (utilisé par src/middleware.ts)

// apps/web/src/app/(app)/providers.client.tsx
export function Providers({ children }): JSX.Element;       // QueryClientProvider + Sonner
```

## Routes existantes après ce plan

| URL | Type | Source | Comportement |
|-----|------|--------|--------------|
| `/login` | RSC + Client form | `apps/web/src/app/(auth)/login/page.tsx` | Formulaire email/mot de passe, Server Action `signInAction`, redirect `/patients` (ou `?next=…`) après succès |
| `/` (et toute route hors `/login`) | — | Middleware + (app)/layout | Redirect 307 vers `/login?next=<pathname>` si non authentifié |
| `(app)/layout.tsx` | Layout authentifié | `apps/web/src/app/(app)/layout.tsx` | Header avec lien `Patients`, providers TanStack/Sonner. Redirect serveur si `getUser()` null. **Note PLAN-5** : la nav `Patients` du header est déjà câblée — il reste à implémenter `(app)/patients/page.tsx`, `(app)/patients/[id]/page.tsx`, `(app)/patients/[id]/edit/page.tsx`, `PatientDrawer`. |

## Palette CSS vars (globals.css)

Tokens HSL en `:root` (mode jour) et `[data-theme="dark"]` (mode nuit). À utiliser via `hsl(var(--token))` dans Tailwind config :

| Token | Jour | Nuit |
|-------|------|------|
| `--background` | `0 0% 100%` | `222 47% 8%` |
| `--foreground` | `222 47% 11%` | `210 40% 96%` |
| `--primary` (bleu profond) | `217 92% 32%` | `217 91% 60%` (atténué) |
| `--accent` (terracotta 974) | `14 78% 55%` | `14 78% 60%` |
| `--muted` | `210 40% 96%` | `217 33% 17%` |
| `--border` / `--input` / `--ring` | `214 32% 91%` / idem / `217 92% 32%` | `217 33% 22%` / idem / `217 91% 60%` |
| `--destructive` | `0 72% 51%` | `0 63% 50%` |
| `--success` / `--warning` / `--info` | `142 71% 35%` / `32 95% 50%` / `217 91% 60%` | `142 71% 45%` / `32 95% 55%` / `217 91% 70%` |
| `--radius` | `8px` | (hérité) |

Le toggle s'effectue par `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`. Anti-FOUC inline dans `<head>` du root layout. Toggle UI à implémenter en PLAN-5 (composant `ThemeToggle` dans le header).

## Vérifications passées

- `pnpm typecheck` exit 0 sur tous les workspaces (3 packages : @tap/database, @tap/shared, @tap/web)
- `pnpm -C apps/web build` exit 0 (middleware 80.9 kB, /login 9.69 kB First Load 96.9 kB)
- Smoke test dev server avec env var fake : `/patients` → 307 `Location: /login?next=%2Fpatients` ; `/` → 307 `Location: /login` ; `/login` → 200 avec textes `TAP Régulation`, `Connectez-vous`, `Mot de passe`, `Se connecter`
- ADR-001 strict : aucun `@supabase/(ssr|supabase-js)` hors `apps/web/src/lib/supabase/*`
- Sécurité : `getUser()` seul (2 occurrences : middleware + (app)/layout) ; jamais `.auth.getSession(`
- Code limits : aucun fichier > 82 lignes (limite 300) ; aucun composant > 80 lignes (limite 150) ; aucune fonction > 50 lignes
- Hygiene : 0 `console.{log,error,warn,info}`, 0 `useEffect.*fetch|useEffect.*supabase`, 0 emoji UI, 0 jargon technique brut

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registre shadcn/ui HTTP inaccessible depuis le sandbox**
- **Found during:** Tâche 3
- **Issue:** `pnpm dlx shadcn@latest add ...` retourne `403 unauthorized` (`https://ui.shadcn.com/r/...`). Le plan suggérait un fallback CLI version 4.6.0 — même blocage.
- **Fix:** Composants créés manuellement avec le code MIT canonique (button, input, label, sheet, skeleton, sonner, form). Aucun adaptation maison — strictement les mêmes que le registre. Ajout des peer deps Radix (`@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-dialog`) à `apps/web/package.json`.
- **Files modified:** `apps/web/src/components/ui/*.tsx` (7 fichiers), `apps/web/package.json`
- **Commit:** 33a9d43

**2. [Rule 1 - Bug] Middleware ignoré silencieusement à la racine du workspace**
- **Found during:** Tâche 2 → smoke test Tâche 3
- **Issue:** `apps/web/middleware.ts` placé à la racine du workspace est ignoré par Next.js 14 quand le `src/` layout est utilisé. Symptôme : `/patients` retourne 404 (page absente) au lieu de 307 (redirect /login). Le matcher était correct, getUser() retournait bien null, mais le middleware ne s'exécutait jamais.
- **Cause:** Avec `src/` layout, Next.js cherche `src/middleware.ts`, pas `middleware.ts`. Comportement non-erreur (pas de log), donc difficile à détecter sans smoke test HTTP.
- **Fix:** `git mv apps/web/middleware.ts apps/web/src/middleware.ts`. Mise à jour `tsconfig.json include` (la nouvelle position est déjà couverte par `src/**/*.ts`). Rebuild OK : `Middleware  80.9 kB` apparaît dans la sortie `next build`. Smoke test re-passé : `/patients` → 307 `/login?next=%2Fpatients` confirmé.
- **Files modified:** `apps/web/{middleware.ts → src/middleware.ts}`, `apps/web/tsconfig.json`
- **Commit:** 33a9d43

### Auth gates

Aucun. Le plan ne nécessitait pas d'authentification externe (toutes les actions étaient en cwd local + npm registry public pour les peer deps).

## Notes pour PLAN-5

- La nav `Patients` du header `(app)/layout.tsx` est déjà câblée (`<Link href="/patients">Patients</Link>`).
- `Providers` (TanStack Query + Sonner) sont actifs sur tout le groupe `(app)`. Pour bénéficier de la prefetch RSC + hydration côté client : envelopper le contenu de la page liste patient dans `<HydrationBoundary state={dehydrate(queryClient)}>` après prefetch dans le RSC (cf. `01-RESEARCH.md` lignes 296–322).
- Le drawer `Sheet` (Radix Dialog) est dispo : pour le `PatientDrawer` 400 px (D-12), utiliser `<SheetContent side="right" className="w-[400px] sm:max-w-[400px]">`.
- La Server Action `signInAction` est isolée dans `apps/web/src/app/(auth)/login/actions.ts` ; le pattern (zod parse → autorisation Supabase → redirect/return state) est à dupliquer pour `createPatientAction`.
- Pour invoquer l'Edge Function NIR (PLAN-3) depuis une Server Action, utiliser `supabase.functions.invoke('nir/encrypt', { body: { nir } })` (le client Supabase server-side est typé `Database` et supporte les functions out-of-the-box).
- Le toggle de thème (jour/nuit) UI n'est PAS encore implémenté — uniquement le bootstrap JS. À ajouter en PLAN-5 ou plus tard sous forme de composant `<ThemeToggle />` (Lucide `Sun`/`Moon` icons + `localStorage.setItem('theme', ...)`).

## Threat Flags

Aucun nouveau surface introduit hors du `<threat_model>` du plan. Les 6 threats T-04-01 à T-04-06 sont mitigés ou acceptés tels que documentés dans le plan :

- T-04-01 (bypass middleware) : matcher conforme + ceinture-bretelles RSC dans `(app)/layout.tsx`
- T-04-02 (open redirect) : `next.startsWith('/') && !next.startsWith('//')`, fallback `/patients`
- T-04-03 (info disclosure auth) : message `"Identifiants invalides ou compte inexistant"` non-différenciant
- T-04-04 (login non audité) : accepté — Supabase Auth log natif suffit en V1, à revisiter en phase 8
- T-04-05 (secret leak) : `SUPABASE_SERVICE_ROLE_KEY` jamais référencé dans `apps/web/src/`
- T-04-06 (getSession bypass) : enforcé — 0 occurrence de `.auth.getSession(`, 2 occurrences de `getUser()`

## Self-Check: PASSED

**Files verified present:**
- FOUND: apps/web/package.json (modified)
- FOUND: apps/web/tsconfig.json (modified)
- FOUND: apps/web/next.config.mjs
- FOUND: apps/web/postcss.config.mjs
- FOUND: apps/web/tailwind.config.ts
- FOUND: apps/web/components.json
- FOUND: apps/web/.env.local.example
- FOUND: apps/web/.gitignore
- FOUND: apps/web/next-env.d.ts
- FOUND: apps/web/src/middleware.ts (37 lines, ≥ 30)
- FOUND: apps/web/src/lib/utils.ts
- FOUND: apps/web/src/lib/supabase/server.ts
- FOUND: apps/web/src/lib/supabase/client.ts
- FOUND: apps/web/src/lib/supabase/middleware.ts
- FOUND: apps/web/src/app/layout.tsx (43 lines, ≥ 25)
- FOUND: apps/web/src/app/globals.css (82 lines, ≥ 50)
- FOUND: apps/web/src/app/(app)/layout.tsx
- FOUND: apps/web/src/app/(app)/providers.client.tsx
- FOUND: apps/web/src/app/(auth)/login/page.tsx (27 lines, ≥ 15)
- FOUND: apps/web/src/app/(auth)/login/login-form.client.tsx (80 lines, ≥ 50)
- FOUND: apps/web/src/app/(auth)/login/actions.ts (55 lines, ≥ 25)
- FOUND: apps/web/src/components/ui/{button,input,label,sheet,skeleton,sonner,form}.tsx
- FOUND: packages/database/src/middleware-client.ts (39 lines, ≥ 25)

**Commits verified:**
- FOUND: f29d6ea `feat(01-4): configs Next.js 14 + Tailwind + shadcn/ui apps/web`
- FOUND: bdf3dd2 `feat(01-4): wrappers Supabase + middleware Auth PKCE (ADR-001 réexport)`
- FOUND: 33a9d43 `feat(01-4): layout + theme jour/nuit + login + providers TanStack`
