# ADR-011 — Next.js 15.5 + Request APIs async (React 18 conservé)

- **Statut** : Accepté
- **Date** : 2026-06-05
- **Complète** : ADR-007 (stratégie versions stack)
- **Affecte** : `apps/web` (Next.js, MDX, Serwist), `packages/database` (peerDep)

## Contexte

Le projet est resté sur Next.js 14.2 jusqu'à fin Phase 06.18 (livraison 2026-06-04). La trajectoire d'attente était : « monter à 15.5 quand la rupture des Request APIs (`params`/`searchParams`/`cookies`/`headers` async) sera comprise et le périmètre cartographié ». Cette phase l'a fait.

Faits qui ont forcé la montée :
1. Next 16 supprime la compat sync TEMPORAIRE des Request APIs maintenue en 15.x. Migrer maintenant pour ne pas y revenir.
2. `typedRoutes` est passé stable en 15.5 (`experimental` → top-level). Bénéfice direct sur la traçabilité des `href`.
3. La rupture du cache `fetch()` (Next 15 n'active plus le cache `force-cache` par défaut) est tranchée par notre périmètre : 1 seul fetch isomorphe (`lib/geocoding/ban.ts`), 6 autres CLIENT (non concernés).
4. Sur 17 pages serveur dynamiques + 4 routes API + 6 usages `cookies()`/`headers()`, l'audit a montré que la migration était mécanique. Le codemod officiel a tout fait sauf 2 casts `UnsafeUnwrapped*` retirés à la main et 84 sites `createClient()` à rendre `await createClient()` (sed automatisé).

## Décision

**Monter à Next.js 15.5** (résolution 15.5.19 au moment du commit).
**React 18 conservé** (`^18.3.1`) — React 19 reste hors périmètre (ADR-007).
**Migration async complète** — interdit de garder des casts `UnsafeUnwrappedCookies` / `UnsafeUnwrappedHeaders` ou des `params`/`searchParams` sync. Tout est awaited.

### Changements de surface

**Versions** :
- `next` : `^14.2.35` → `^15.5.0`.
- `@types/react`, `@types/react-dom`, `react`, `react-dom` : inchangés (`^18.3.x`).
- `next-mdx-remote` : `6.0.0` → `5.0.0` (6.x bundle React 19).
- `@serwist/next`, `@serwist/precaching`, `serwist` : déjà `^9`, résolus à 9.5.11 (compatibles Next 15).
- `packages/database` peerDep `next` : `^14.2.35` → `^15.5.0`.

**Codemods exécutés** :
- `@next/codemod@canary next-async-request-api .` : 17 fichiers transformés, 0 erreur, 0 `@next-codemod-error` marker.

**Reprise manuelle** :
- `lib/supabase/server.ts:createClient` rendue **async** ; 84 sites consommateurs migrés à `const supabase = await createClient()` (sed automatisé).
- 8 sites typés `ReturnType<typeof createClient>` rebrandés en `Awaited<ReturnType<typeof createClient>>`.
- `admin/chauffeurs/actions.ts:resolveOrigin` rendue async (`await headers()`), 2 callers `await resolveOrigin()`.
- `lib/geocoding/ban.ts` : `fetch(url, { cache: 'no-store' })` explicite + commentaire (D-04).
- `next.config.mjs` : suppression du `async rewrites()` `/api/solver/*` mort (orphelin Phase 06.12, ADR-010).
- `next.config.mjs` : `typedRoutes` activé au top-level (stable 15.5).

**Incident MDX résolu** :
- `next-mdx-remote@6.0.0` cassait au SSG avec « A React Element from an older version of React was rendered » (bundle React 19 vs React 18 runtime).
- Downgrade 6 → 5 + bascule de `compileMDX` à `<MDXRemote>` (rendu direct RSC) + `force-dynamic` sur les 5 pages `/legal/*`.

### Ce qu'on N'a PAS fait (et pourquoi)

- **Turbopack en dev** : pas imposé. L'expérience HMR webpack reste suffisante, pas de friction observée.
- **ESLint `ignoreDuringBuilds: true`** : conservé. Next 15 supporte la flat config mais activer le lint au build risquerait de faire échouer Vercel sur les 9 warnings préexistants hors périmètre. Le lint reste assuré par le job CI dédié.
- **React 19** : différé. ADR-007 reste valable, la décision React est découplée de la décision Next.

## Conséquences

### Positives

- **Migration alignée avec la trajectoire 16+**. Quand Next 16 arrivera, l'effort sera marginal.
- **Toutes les Request APIs sont awaited** : pas de surprise au runtime, pas de warning « sync-dynamic-apis ».
- **`typedRoutes` actif** : `<Link href="...">` désormais typé contre les routes du repo. Bénéfice direct pour refactors et renommages.
- **`createClient` async cohérent** : `cookies()` est awaité au point d'accès Supabase serveur, plus de risque de cookies stale.
- **Périmètre MDX clarifié** : `<MDXRemote>` direct + `force-dynamic` sur `/legal/*` est plus simple à raisonner que `compileMDX` + SSG. La complexité revient si on veut SSG (V2).

### Négatives / dette

- **`/legal/*` rendues dynamiques** : 5 pages servies à la demande au lieu du build. Latence négligeable pour des pages légales rarement consultées. À tracer si le volume devient critique (V2).
- **`next-mdx-remote@5`** : version stable mais en retrait vs 6. Migration à 6 sera couplée à React 19 (hors périmètre).
- **`ignoreDuringBuilds: true` reste** : 9 warnings préexistants hors périmètre. Phase nettoyage CI séparée à programmer.

### Documentation impactée

- ADR-007 stratégie versions stack : reste valable, ce ADR-011 la complète.

## Trace décisionnelle

DEC-095 (inscrite dans `.planning/STATE.md` Decisions + `.planning/journal.md`) :
« Next.js 14.2 → 15.5 + migration async complète des Request APIs. React 18 conservé. `createClient` Supabase serveur passe async, 84 sites consommateurs migrés. `next-mdx-remote` downgradé 6→5 pour compatibilité React 18 + Next 15 SSG (pages /legal/* en force-dynamic). Rewrite `/api/solver` mort purgé (orphelin Phase 06.12). `typedRoutes` activé (stable 15.5). ESLint au build conservé désactivé. »
