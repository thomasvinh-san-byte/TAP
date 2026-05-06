---
phase: 01-referentiel-patients
plan: 4
type: execute
wave: 2
depends_on: [2]
files_modified:
  - apps/web/package.json
  - apps/web/tsconfig.json
  - apps/web/next.config.mjs
  - apps/web/postcss.config.mjs
  - apps/web/tailwind.config.ts
  - apps/web/components.json
  - apps/web/.env.local.example
  - apps/web/middleware.ts
  - apps/web/src/lib/supabase/server.ts
  - apps/web/src/lib/supabase/client.ts
  - apps/web/src/lib/supabase/middleware.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/globals.css
  - apps/web/src/app/(auth)/login/page.tsx
  - apps/web/src/app/(auth)/login/login-form.client.tsx
  - apps/web/src/app/(auth)/login/actions.ts
  - apps/web/src/app/(app)/layout.tsx
  - apps/web/src/app/(app)/providers.client.tsx
  - apps/web/src/components/ui/button.tsx
  - apps/web/src/components/ui/input.tsx
  - apps/web/src/components/ui/label.tsx
  - apps/web/src/components/ui/sheet.tsx
  - apps/web/src/components/ui/skeleton.tsx
  - apps/web/src/components/ui/sonner.tsx
  - apps/web/src/components/ui/form.tsx
  - apps/web/src/lib/utils.ts
  - packages/database/src/index.ts
  - packages/database/src/middleware-client.ts
  - pnpm-workspace.yaml
autonomous: true
requirements:
  - PAT-01
  - PAT-03
must_haves:
  truths:
    - "pnpm dev démarre apps/web sur http://localhost:3000"
    - "Le middleware redirige toute route non-/login vers /login si user absent"
    - "La page /login affiche un formulaire (email + mot de passe) qui appelle Server Action signInAction"
    - "Après login régulateur, l'utilisateur est redirigé vers /patients (qui retourne 200 ou un état vide pour l'instant)"
    - "Le thème jour/nuit est piloté par CSS vars uniquement (pas de package next-themes)"
    - "apps/web n'importe que depuis @tap/* et les libs externes autorisées (Next, React, shadcn deps, @tanstack/react-query, react-hook-form, zod, lucide-react, sonner, @supabase/ssr)"
    - "Le typecheck monorepo passe ; le lint passe"
  artifacts:
    - path: apps/web/middleware.ts
      provides: "Middleware Supabase Auth PKCE — redirect /login si user absent"
      min_lines: 30
    - path: apps/web/src/app/layout.tsx
      provides: "Root layout : fonts, theme bootstrap, metadata"
      min_lines: 25
    - path: apps/web/src/app/globals.css
      provides: "CSS vars jour + nuit (palette bleu profond + terracotta)"
      min_lines: 50
    - path: apps/web/src/app/(auth)/login/page.tsx
      provides: "Page /login (RSC) qui rend LoginForm client"
      min_lines: 15
    - path: apps/web/src/app/(auth)/login/login-form.client.tsx
      provides: "Formulaire React Hook Form + Server Action signInAction"
      min_lines: 50
    - path: apps/web/src/app/(app)/layout.tsx
      provides: "Layout authentifié + providers (QueryClient, Sonner)"
      min_lines: 25
    - path: packages/database/src/middleware-client.ts
      provides: "createSupabaseMiddlewareClient (factory ADR-001 stricte)"
      min_lines: 25
  key_links:
    - from: apps/web/middleware.ts
      to: packages/database/src/middleware-client.ts
      via: import createSupabaseMiddlewareClient
      pattern: "createSupabaseMiddlewareClient"
    - from: apps/web/src/lib/supabase/server.ts
      to: packages/database/src/client-server.ts
      via: re-export
      pattern: "@tap/database"
    - from: apps/web/src/app/layout.tsx
      to: apps/web/src/app/globals.css
      via: import './globals.css'
      pattern: "globals.css"
---

<objective>
Scaffolder `apps/web` (Next.js 14 App Router strict + Tailwind + shadcn/ui + middleware Supabase Auth) avec UNIQUEMENT le minimum pour que la wave 3 puisse y greffer les écrans patient. Pas de cockpit, pas de saisie express. Page `/login` opérationnelle qui pose le contrat d'authentification PKCE.

Purpose: établir une base UI conforme aux 3 piliers CLAUDE.md (UX, design system, sécurité) pour que tout futur écran (Phase 2 saisie express, Phase 5 cockpit, etc.) hérite des bonnes conventions sans renégociation.

Output: ~25 fichiers de scaffold, configs strictes, layout root + theme CSS vars, middleware auth, page login fonctionnelle.
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
@packages/database/src/client-server.ts
@packages/database/src/client-browser.ts
@packages/database/src/index.ts
@pnpm-workspace.yaml

<interfaces>
<!-- Helpers Supabase déjà disponibles (packages/database) -->
// packages/database/src/client-server.ts
export function createSupabaseServerClient(cookieStore: ReadonlyRequestCookies): SupabaseClient<Database>
// packages/database/src/client-browser.ts
export function createSupabaseBrowserClient(): SupabaseClient<Database>
// À AJOUTER en tâche 1 : packages/database/src/middleware-client.ts
export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse): SupabaseClient<Database>

<!-- Types Database (régénérés par PLAN-2) -->
// packages/database/src/types.gen.ts
export type Database = { public: { Tables: { patients, patient_constraint, patient_operational_note, organizations, profiles, audit_logs }, Enums: {...} } }

<!-- Pattern de palette (CLAUDE.md § 1 pilier 2) -->
- Bleu primaire profond
- Accent terracotta / ambre / corail (clin d'œil 974)
- 8 niveaux de gris finement nuancés
- Vert succès, orange attention, rouge alerte, bleu info
- Mode jour ET mode nuit, traités à parité
- Police unique : Inter
- Spacing strict : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
- Transitions 150 ms ease-out
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1 : Workspace setup — apps/web package + configs Next/Tailwind/TS + factory middleware ADR-001</name>
  <files>apps/web/package.json, apps/web/tsconfig.json, apps/web/next.config.mjs, apps/web/postcss.config.mjs, apps/web/tailwind.config.ts, apps/web/components.json, apps/web/.env.local.example, apps/web/src/lib/utils.ts, packages/database/src/middleware-client.ts, packages/database/src/index.ts, pnpm-workspace.yaml</files>
  <read_first>
    - /home/user/TAP/pnpm-workspace.yaml
    - /home/user/TAP/packages/database/package.json
    - /home/user/TAP/packages/database/src/client-server.ts (style createServerClient + cookies adapter)
    - /home/user/TAP/packages/database/src/index.ts (re-exports actuels)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 234-294 — bootstrap)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 484-557 — wrappers + middleware)
    - /home/user/TAP/CLAUDE.md (§ 7 conventions code, § 11 anti-patterns)
  </read_first>
  <action>
**Étape A — Vérifier que `apps/*` est inclus dans pnpm-workspace.yaml** :
- Lire `/home/user/TAP/pnpm-workspace.yaml`
- S'il ne contient pas `apps/*`, ajouter la ligne `  - "apps/*"` (sous `packages:` existant)

**Étape B — Créer la factory middleware dans `packages/database`** :

`packages/database/src/middleware-client.ts` (≥ 25 lignes) :
```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from './types';

/**
 * Crée un client Supabase pour Next.js middleware.
 * À utiliser uniquement depuis `apps/web/middleware.ts` (ADR-001 : `apps/*` dépendent
 * exclusivement de `packages/*`).
 */
export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.');
  }
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
          res.cookies.set({ name, value, ...options });
        });
      },
    },
  });
}
```

Mettre à jour `packages/database/src/index.ts` pour ré-exporter :
```ts
export { createSupabaseServerClient } from './client-server';
export { createSupabaseBrowserClient } from './client-browser';
export { createSupabaseMiddlewareClient } from './middleware-client';
export type { Database } from './types';
```

**Étape C — Créer `apps/web/package.json`** (style monorepo `@tap/*`) :
```json
{
  "name": "@tap/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@supabase/ssr": "^0.5.0",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.56.0",
    "@tap/database": "workspace:*",
    "@tap/shared": "workspace:*",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.439.0",
    "next": "^14.2.13",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.2",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4"
  }
}
```

**Étape D — `apps/web/tsconfig.json`** (extend du base) :
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "middleware.ts", "**/*.tsx", "**/*.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e/**/*"]
}
```

**Étape E — `apps/web/next.config.mjs`** :
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@tap/database', '@tap/shared'],
};
export default nextConfig;
```

**Étape F — `apps/web/postcss.config.mjs`** :
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

**Étape G — `apps/web/tailwind.config.ts`** (palette CSS vars + spacing strict CLAUDE.md §1) :
```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
      },
      spacing: {
        '4': '4px', '8': '8px', '12': '12px', '16': '16px',
        '24': '24px', '32': '32px', '48': '48px', '64': '64px',
      },
      transitionDuration: { DEFAULT: '150ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)' },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [animate],
};
export default config;
```

**Étape H — `apps/web/components.json`** (config shadcn) :
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

**Étape I — `apps/web/src/lib/utils.ts`** :
```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Étape J — `apps/web/.env.local.example`** :
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Service role : utilisé UNIQUEMENT dans les tests E2E (helper auth + lecture audit_logs)
SUPABASE_SERVICE_ROLE_KEY=
```

**Étape K — `pnpm install`** depuis la racine pour résoudre les workspace deps.
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm install 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm typecheck 2&gt;&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/package.json && test -f apps/web/tsconfig.json && test -f apps/web/next.config.mjs && test -f apps/web/tailwind.config.ts`
    - `grep -c '"@tap/database": "workspace:\\*"' apps/web/package.json` == 1
    - `grep -c '"@tap/shared": "workspace:\\*"' apps/web/package.json` == 1
    - `grep -c 'transpilePackages' apps/web/next.config.mjs` == 1
    - `grep -c 'apps/\\*' pnpm-workspace.yaml` == 1
    - `wc -l packages/database/src/middleware-client.ts` ≥ 25
    - `grep -c "createSupabaseMiddlewareClient" packages/database/src/index.ts` == 1
    - `grep -c '"4": "4px"' apps/web/tailwind.config.ts` == 1 (spacing strict)
    - `grep -c "'4'" apps/web/tailwind.config.ts || grep -c '"4"' apps/web/tailwind.config.ts` ≥ 1 (spacing strict)
    - `pnpm install` exit 0
    - `pnpm typecheck` exit 0
  </acceptance_criteria>
  <done>Workspace apps/web câblé, factory middleware ajoutée à @tap/database, dépendances installées, typecheck propre.</done>
</task>

<task type="auto">
  <name>Tâche 2 : Layout root + theme CSS vars + middleware auth + wrappers Supabase apps/web</name>
  <files>apps/web/src/app/layout.tsx, apps/web/src/app/globals.css, apps/web/middleware.ts, apps/web/src/lib/supabase/server.ts, apps/web/src/lib/supabase/client.ts, apps/web/src/lib/supabase/middleware.ts, apps/web/src/app/(app)/layout.tsx, apps/web/src/app/(app)/providers.client.tsx</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 251-292 — middleware ; 296-322 — RSC + HydrationBoundary)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 484-559)
    - /home/user/TAP/CLAUDE.md (§ 1 piliers UX, § 7 conventions Next.js)
    - /home/user/TAP/packages/database/src/client-server.ts (pattern cookies adapter)
  </read_first>
  <action>
**apps/web/src/app/globals.css** (≥ 50 lignes — theme CSS vars jour + nuit + reset minimal) :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Palette jour */
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 217 92% 32%;             /* bleu profond */
    --primary-foreground: 0 0% 100%;
    --accent: 14 78% 55%;                /* terracotta */
    --accent-foreground: 0 0% 100%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --ring: 217 92% 32%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 71% 35%;
    --warning: 32 95% 50%;
    --info: 217 91% 60%;
    --radius: 8px;
  }

  [data-theme="dark"] {
    /* Palette nuit (parité, pas inversion brute) */
    --background: 222 47% 8%;
    --foreground: 210 40% 96%;
    --primary: 217 91% 60%;
    --primary-foreground: 222 47% 11%;
    --accent: 14 78% 60%;
    --accent-foreground: 222 47% 8%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --border: 217 33% 22%;
    --ring: 217 91% 60%;
    --destructive: 0 63% 50%;
    --destructive-foreground: 0 0% 100%;
    --success: 142 71% 45%;
    --warning: 32 95% 55%;
    --info: 217 91% 70%;
  }

  * { border-color: hsl(var(--border)); }
  html { font-feature-settings: "tnum"; /* chiffres tabulaires (CLAUDE.md § 1) */ }
  body { background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: 'Inter', system-ui, sans-serif; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```

**apps/web/src/app/layout.tsx** (≥ 25 lignes — root layout + script anti-FOUC theme) :
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TAP Réunion — Régulation',
  description: 'Régulation, optimisation et communication patient pour TAP/taxi conventionné CGSS.',
};

const themeBootstrap = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) { /* localStorage indisponible */ }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**apps/web/middleware.ts** (≥ 30 lignes — ADR-001 strict via @tap/database) :
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@tap/database';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createSupabaseMiddlewareClient(request, response);

  // Refresh session si expirée. getUser() valide côté serveur (pas getSession() qui lit le cookie sans valider).
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login');
  const isPublicAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (!user && !isAuthRoute && !isPublicAsset) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (user && isAuthRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/patients';
    return NextResponse.redirect(homeUrl);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
```

**apps/web/src/lib/supabase/server.ts** (re-export thin via @tap/database) :
```ts
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@tap/database';

export function createClient() {
  return createSupabaseServerClient(cookies());
}
```

**apps/web/src/lib/supabase/client.ts** :
```ts
export { createSupabaseBrowserClient as createClient } from '@tap/database';
```

**apps/web/src/lib/supabase/middleware.ts** (re-export pour cohérence) :
```ts
export { createSupabaseMiddlewareClient } from '@tap/database';
```

**apps/web/src/app/(app)/providers.client.tsx** (≥ 20 lignes — QueryClientProvider + Sonner Toaster) :
```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
```

**apps/web/src/app/(app)/layout.tsx** (≥ 25 lignes — wrap providers + nav minimal) :
```tsx
import { Providers } from './providers.client';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <header className="border-b px-24 py-12 flex items-center justify-between">
          <Link href="/patients" className="font-semibold text-foreground">TAP Régulation</Link>
          <nav className="flex gap-16 text-sm text-muted-foreground">
            <Link href="/patients">Patients</Link>
          </nav>
        </header>
        <main className="flex-1 px-24 py-24 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
```

**Conventions strictes CLAUDE.md :**
- Aucun import direct `@supabase/supabase-js` ou `@supabase/ssr` dans `apps/web/**` SAUF `apps/web/middleware.ts` et les wrappers `lib/supabase/*` qui passent par `@tap/database`
- Aucune utilisation de `useEffect` pour fetch initial
- `'use client'` strictement aux composants nécessitant interaction
- Texte UI en français
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm typecheck 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm -C apps/web build 2&gt;&amp;1 | tail -15</antml-parameter></automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/web/src/app/globals.css` ≥ 50
    - `wc -l apps/web/src/app/layout.tsx` ≥ 25
    - `wc -l apps/web/middleware.ts` ≥ 30
    - `grep -c "data-theme.*dark" apps/web/src/app/globals.css` ≥ 1
    - `grep -c "prefers-reduced-motion" apps/web/src/app/globals.css` == 1
    - `grep -c "tnum" apps/web/src/app/globals.css` ≥ 1 (chiffres tabulaires)
    - `grep -c "@tap/database" apps/web/middleware.ts` == 1
    - `! grep -E "@supabase/(ssr|supabase-js)" apps/web/src/app/ apps/web/middleware.ts -r --include="*.ts" --include="*.tsx" | grep -v "lib/supabase"` (pas d'import direct hors wrappers)
    - `grep -c "redirect.*\\/login" apps/web/middleware.ts` ≥ 1
    - `grep -c "getUser()" apps/web/middleware.ts` == 1 (pas getSession)
    - `pnpm typecheck` exit 0
    - `pnpm -C apps/web build` exit 0
  </acceptance_criteria>
  <done>Layout root + theme CSS vars + middleware ADR-001 strict + wrappers Supabase apps/web. Le build Next.js passe.</done>
</task>

<task type="auto">
  <name>Tâche 3 : Composants shadcn/ui de base + page /login + Server Action signInAction</name>
  <files>apps/web/src/components/ui/button.tsx, apps/web/src/components/ui/input.tsx, apps/web/src/components/ui/label.tsx, apps/web/src/components/ui/sheet.tsx, apps/web/src/components/ui/skeleton.tsx, apps/web/src/components/ui/sonner.tsx, apps/web/src/components/ui/form.tsx, apps/web/src/app/(auth)/login/page.tsx, apps/web/src/app/(auth)/login/login-form.client.tsx, apps/web/src/app/(auth)/login/actions.ts</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 240-249 — composants shadcn nécessaires)
    - /home/user/TAP/CLAUDE.md (§ 1 pilier 2 design system, § 5 règles UX, § 11 anti-patterns)
    - /home/user/TAP/apps/web/src/lib/utils.ts (helper cn)
  </read_first>
  <action>
**Étape A — Initialiser shadcn et ajouter les composants** (les composants seront copiés au repo, pas pulled depuis npm) :

```bash
cd /home/user/TAP/apps/web
# Composants minimaux Phase 1 — d'autres seront ajoutés par les phases suivantes.
pnpm dlx shadcn@latest add button input label form sheet skeleton sonner --overwrite
```

Vérifier après commande que les fichiers `apps/web/src/components/ui/{button,input,label,form,sheet,skeleton,sonner}.tsx` existent.

**Si shadcn add échoue** (CLI nouvelle version, options changées) — créer manuellement les composants à partir de la doc shadcn officielle. Le code source des composants shadcn est public (MIT license). Ne PAS modifier les composants ; les wrapper si besoin.

**Étape B — Server Action `signInAction`** :

`apps/web/src/app/(auth)/login/actions.ts` :
```ts
'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  next: z.string().optional(),
});

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Reformulation française systématique (CLAUDE.md § 5 « aucun message d'erreur technique brut »).
    return { error: 'Identifiants invalides ou compte inexistant.' };
  }
  redirect(parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : '/patients');
}
```

**Étape C — Page `/login` (RSC)** :

`apps/web/src/app/(auth)/login/page.tsx` (≥ 15 lignes) :
```tsx
import { LoginForm } from './login-form.client';

export const metadata = { title: 'Connexion — TAP Régulation' };

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-24 bg-background">
      <div className="w-full max-w-[400px] space-y-32">
        <header className="text-center space-y-8">
          <h1 className="text-2xl font-semibold text-foreground">TAP Régulation</h1>
          <p className="text-muted-foreground text-sm">Connectez-vous pour accéder au référentiel patient.</p>
        </header>
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
```

**Étape D — `login-form.client.tsx`** (≥ 50 lignes — react-hook-form + zodResolver + useFormState pour l'erreur Server Action) :
```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFormState, useFormStatus } from 'react-dom';
import { signInAction, type SignInState } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full h-48">
      {pending ? 'Connexion…' : 'Se connecter'}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState<SignInState, FormData>(signInAction, {});
  const { register, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  return (
    <form action={formAction} className="space-y-16" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-8">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username" required {...register('email')} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-8">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" type="password" autoComplete="current-password" required {...register('password')} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
```

**Vérification finale** :
- `pnpm -C apps/web build` exit 0
- `pnpm -C apps/web dev` démarre, GET http://localhost:3000/login retourne 200 (vérifier avec curl en arrière-plan)
- GET http://localhost:3000/patients sans cookie → 307 redirect vers `/login?next=/patients`

**Conventions strictes :**
- Composants shadcn `ui/*` non modifiés (comme demandé par CLAUDE.md § 5)
- Boutons Login = h-48 (48 px de hauteur, conforme spacing system)
- Aucun emoji UI, aucun jargon technique
- Messages erreur en français
- `'use client'` uniquement sur le formulaire, page reste RSC
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm -C apps/web build 2&gt;&amp;1 | tail -10 &amp;&amp; pnpm -C apps/web dev &amp;&gt; /tmp/web.log &amp; sleep 8 &amp;&amp; curl -s -o /dev/null -w "login=%{http_code}\n" http://localhost:3000/login &amp;&amp; curl -s -o /dev/null -w "patients=%{http_code}\n" http://localhost:3000/patients ; kill %1 2&gt;/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/src/components/ui/button.tsx -a -f apps/web/src/components/ui/sheet.tsx -a -f apps/web/src/components/ui/form.tsx -a -f apps/web/src/components/ui/skeleton.tsx`
    - `wc -l apps/web/src/app/(auth)/login/page.tsx` ≥ 15
    - `wc -l apps/web/src/app/(auth)/login/login-form.client.tsx` ≥ 50
    - `wc -l apps/web/src/app/(auth)/login/actions.ts` ≥ 25
    - `grep -c "'use server'\\|\"use server\"" apps/web/src/app/(auth)/login/actions.ts` == 1
    - `grep -c "'use client'\\|\"use client\"" apps/web/src/app/(auth)/login/login-form.client.tsx` == 1
    - `grep -c "Identifiants invalides ou compte inexistant" apps/web/src/app/(auth)/login/actions.ts` == 1 (message FR reformulé)
    - `grep -c "redirect" apps/web/src/app/(auth)/login/actions.ts` ≥ 1
    - `! grep -rE "console\\.log" apps/web/src/`
    - `! grep -rE "@supabase/(ssr|supabase-js)" apps/web/src/app/(auth)/`
    - HTTP `login=200` ET `patients=307` (vérifié dans le verify command)
    - `pnpm -C apps/web build` exit 0
  </acceptance_criteria>
  <done>Composants shadcn de base ajoutés, page /login fonctionnelle avec Server Action, redirection middleware vérifiée, build Next.js propre.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Next.js middleware | Cookies sb-* sont httpOnly + SameSite=Lax (gérés par @supabase/ssr) |
| Server Action → Supabase Auth | `signInWithPassword` côté serveur, jamais le mot de passe en clair côté client |
| `apps/web` → externes | Restreint à : Next, React, shadcn deps, @tanstack/react-query, react-hook-form, zod, lucide-react, sonner. Jamais @supabase/* direct (passe par @tap/database) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04-01 | Spoofing | bypass middleware via path matcher mal écrit | HIGH | mitigate | Matcher exclut uniquement `_next/static`, `_next/image`, `favicon.ico`, `api/health` ; toute autre route est gardée. Test E2E PLAN-1 cas 5 (audit_logs lookup) tombe en 401 si bypass |
| T-04-02 | Tampering | redirection open redirect via `?next=https://evil` | MEDIUM | mitigate | `signInAction` valide `parsed.data.next.startsWith('/')` avant redirect ; sinon fallback `/patients`. À tester unitaire ultérieurement |
| T-04-03 | Information Disclosure | message d'erreur Auth fuit l'existence d'un email | LOW | mitigate | Message reformulé `"Identifiants invalides ou compte inexistant"` — pas de différentiation user-not-found vs wrong-password |
| T-04-04 | Repudiation | login non audité (audit_logs) | MEDIUM | accept | Phase 1 ne stocke pas les logins dans audit_logs (DEC-010 D-20 limite aux actions patient). Le log d'auth Supabase natif suffit ; revisiter en phase 8 si besoin de corrélation |
| T-04-05 | Information Disclosure | secret leak via logs build Next.js | LOW | mitigate | `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont par design publics ; `SUPABASE_SERVICE_ROLE_KEY` jamais utilisé dans `apps/web/src/`, uniquement dans `apps/web/e2e/` (vérification grep ci-dessous) |
| T-04-06 | Elevation of Privilege | use of getSession() au lieu de getUser() | HIGH | mitigate | `getUser()` côté server (validé Supabase) au lieu de `getSession()` (lit cookie sans valider). Acceptance criteria force ce choix |
</threat_model>

<verification>
- `pnpm install && pnpm typecheck && pnpm -C apps/web build` chaîne complète exit 0
- `! grep -rE "from \\\"@supabase/(ssr|supabase-js)\\\"" apps/web/src/app/` (apps/web/src/app n'importe jamais directement les libs Supabase)
- `! grep -rE "useEffect.*fetch\\|useEffect.*supabase" apps/web/src/` (pas de useEffect pour fetch initial — CLAUDE.md § 7)
- `! grep -rE "console\\.log\\|console\\.error" apps/web/src/` (CLAUDE.md § 11 — pas de console laissé)
- `! grep -rE "SUPABASE_SERVICE_ROLE_KEY" apps/web/src/` (service_role jamais dans le bundle apps/web ; OK si présent dans e2e/)
- `grep -c "getUser()" apps/web/middleware.ts apps/web/src/app/(app)/layout.tsx` ≥ 2 (jamais getSession)
- `pnpm -C apps/web dev` démarre, login retourne 200, patients retourne 307 redirect
</verification>

<success_criteria>
- `apps/web` est un workspace pnpm fonctionnel avec build Next.js 14 propre
- Middleware redirige correctement (un test manuel : naviguer `/patients` → redirect `/login?next=/patients`)
- Page `/login` rend un formulaire conforme au design system (h-48 sur le bouton primaire, message FR reformulé)
- ADR-001 respecté : aucun import direct `@supabase/*` hors `packages/database` ; `apps/web` consomme uniquement `@tap/*`
- Theme jour/nuit pilotable via `data-theme="dark"` sur `<html>`, sans dépendance package, anti-FOUC inline
- Pas de useEffect pour fetch, pas de console.log, pas d'emoji UI, pas de jargon technique
</success_criteria>

<output>
Après complétion, créer `.planning/phases/01-referentiel-patients/01-4-SUMMARY.md` documentant :
- Liste exacte des composants shadcn ajoutés (avec chemin)
- Snippets utilitaires exposés à PLAN-5 : `cn()`, `createClient()` (server + browser), `Providers`, palette CSS vars
- URL des routes existantes : `/login`, `/patients` (vide pour l'instant), `(app)/layout.tsx` est l'enveloppe authentifiée
- Note pour PLAN-5 : la nav `Patients` du header est déjà en place ; il faut juste implémenter la page liste + drawer + détail + edit
</output>
