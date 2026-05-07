---
phase: 02-saisie-express-course
plan: 05
subsystem: web/client + web/rsc
tags: [layout-integration, header-global, dropdown-menu, draft-queue, courses-page, rsc-prefetch, hydration-boundary, server-action-wrapper]

# Dependency graph
requires:
  - phase: 02-saisie-express-course/02-04
    provides: RideExpressOrchestrator, useRideOrchestrator Context, RideExpressModal
  - phase: 02-saisie-express-course/02-03
    provides: listDraftsAction, deleteRideDraft, listRides RSC query
  - phase: 01-referentiel-patients
    provides: pattern HydrationBoundary + useDeferredValue + Skeleton + empty state
  - phase: 00-foundations
    provides: shadcn DropdownMenu, Badge, Input, Skeleton, Button, Tanstack Query Providers
provides:
  - Layout (app) global avec orchestrator monté — D-03 modal accessible depuis n'importe quelle route
  - Bouton « + Nouvelle course » header (SAIS-02 cible E2E aria-label « Nouvelle course (Cmd/Ctrl+Shift+K) »)
  - DraftQueue dropdown header — SAIS-04 reprise brouillon en 1 click
  - Page /courses RSC + RidesList client (D-07 minimale Phase 2 — filtres + recherche + skeleton + empty state)
  - listRidesAction (Server Action wrapper) réutilisable pour tout besoin client de listRides
affects:
  - 02-saisie-express-course Wave 5 : E2E `saisie-express.spec.ts` peut désormais
    cibler `getByRole('button', { name: /Nouvelle course/ })` + valider SAIS-04
    (ouvrir modal → Mettre en pause → cliquer brouillon dans DraftQueue → modal réouvert)
  - Phase 5 cockpit, Phase 6 planning : pattern « Server Action wrapper pour useQuery »
    (`listRidesAction`) réutilisable pour exposer une RSC query côté client sans
    casser la frontière `next/headers`

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action wrapper pour useQuery côté client (`listRidesAction`) :
       contourne la contrainte Next.js 14 que les Client Components ne peuvent
       pas importer un module qui transitivement importe `next/headers`. La
       Server Action ré-importe dynamiquement la query RSC (`await import(...)`),
       l'exécution serveur est garantie par la directive `'use server'` du fichier."
    - "DropdownMenu shadcn pattern : `<DropdownMenuTrigger asChild><Button>`
       + `<DropdownMenuContent align='end' className='max-h-... overflow-y-auto'>`
       + `<DropdownMenuItem onSelect={(e) => { e.preventDefault(); ... }}>` pour
       contrôler la fermeture (sans onSelect.preventDefault, Radix close au click,
       on ne pourrait pas faire le dispatch RESUME proprement)."
    - "Pattern intégration orchestrator + provider : monter UNE FOIS dans le
       layout authentifié, exposer dispatch via Context aux 2 consumers
       (HeaderNewRideButton + DraftQueue), modal rendu en sibling du content
       principal (Radix Portal s'occupe du z-index)."
    - "Type-only import depuis `_lib/queries.ts` côté Client Component : OK
       car les types sont effacés au build, seuls les imports runtime
       déclencheraient l'erreur next/headers."

key-files:
  created:
    - apps/web/src/app/(app)/courses/_components/header-new-ride-button.client.tsx (30 lignes)
    - apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx (151 lignes)
    - apps/web/src/app/(app)/courses/_components/rides-list.client.tsx (201 lignes)
    - apps/web/src/app/(app)/courses/page.tsx (44 lignes)
  modified:
    - apps/web/src/app/(app)/layout.tsx (50 → 71 lignes — Orchestrator + bouton + DraftQueue + lien Courses)
    - apps/web/src/app/(app)/courses/actions.ts (+listRidesAction wrapper)

key-decisions:
  - "DEC-EXEC-01 — listRidesAction Server Action wrapper créée pour contourner
     next/headers en Client Component. Pattern : `const { listRides } = await
     import('./_lib/queries'); return listRides(parsed.data);` dans un fichier
     `'use server'`. Sécurité préservée : RLS Postgres reste source de vérité.
     C'est le pendant exact de `searchPatientsAction` Phase 1 (CLAUDE.md cohérence
     pattern). Détecté au build (RSC server.ts → cookies → next/headers chaîne
     d'import bloquée par Next.js 14)."
  - "DEC-EXEC-02 — Type-only import préservé pour RideRow/RideStatus/
     RideTransportMode depuis `_lib/queries.ts` (TS efface les imports type
     au build). Évite de dupliquer les types dans `actions.ts` ou un fichier
     séparé. Pattern courant et sûr."
  - "Budget rides-list.client.tsx 201 lignes vs ≤ 200 cible PLAN : 1 ligne
     au-dessus, bien sous le plafond CLAUDE.md § 11 (300). Trim non
     nécessaire — la lisibilité du tableau (6 colonnes Badge sémantiques)
     est privilégiée."

patterns-established:
  - "Server Action wrapper pour exposer une query RSC à un Client Component
     qui en a besoin via useQuery. Réutilisable dès Phase 5 cockpit + Phase 6
     planning, n'importe quelle liste filtrable côté client doit suivre ce
     pattern (pas d'import direct du module RSC dans un Client Component)."
  - "Header global authentifié avec navigation + actions globales : pattern
     définitif livré. Toute action métier transverse (palette commande Phase 5,
     bouton + Phase 4 récurrence, etc.) viendra s'ajouter ici, en consommant
     son propre orchestrator/Context monté en racine du layout."

requirements-completed: [SAIS-04, SAIS-05]

# Metrics
duration: ~4min
completed: 2026-05-07
---

# Phase 2 Plan 05 : Intégration UI saisie express (Wave 4) — Summary

**Wave 4 livrée — 4 fichiers créés (426 lignes) + 2 fichiers modifiés ; layout authentifié monte l'orchestrator + bouton « + Nouvelle course » + DraftQueue dropdown ; page /courses RSC + RidesList client avec filtres + recherche + skeleton + empty state ; build production GREEN, route /courses 2.62 kB.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-07T10:43:00Z (post Wave 3 commit f2f096c)
- **Completed:** 2026-05-07T10:47:00Z
- **Tasks:** 3 livrées en commit atomique unique (selon recommandation du PLAN)
- **Files created:** 4
- **Files modified:** 2
- **Net lines added:** +491 / -17

## Accomplishments

### Task 5.1 — Layout intégration (`apps/web/src/app/(app)/layout.tsx`, 71 lignes)

Layout authentifié étendu : `<RideExpressOrchestrator>` enveloppe le `<div className="min-h-screen flex flex-col">`. Le orchestrator monte le Provider Context et écoute `Cmd/Ctrl+Shift+K` (Wave 3). Header global enrichi de :

- Lien `Patients` (existant)
- Lien `Courses` (nouveau — `href="/courses"`)
- `<DraftQueue />` dropdown (nouveau)
- `<HeaderNewRideButton />` (nouveau)

Le garde-fou serveur `redirect('/login')` reste inchangé, le pattern `Providers` également (Tanstack Query Provider Wave 3).

### Task 5.2 — HeaderNewRideButton (`apps/web/src/app/(app)/courses/_components/header-new-ride-button.client.tsx`, 30 lignes)

Bouton header minimaliste qui consomme `useRideOrchestrator()` et dispatch `{type: 'OPEN_NEW'}` au click. `aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)"` annonce le raccourci pour les utilisateurs clavier ET sert de selector E2E SAIS-02 stable.

### Task 5.3 — DraftQueue (`apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx`, 151 lignes)

Dropdown header brouillons (SAIS-04) :

- `useQuery({queryKey: ['ride-drafts'], queryFn: listDraftsAction, refetchInterval: 10_000, staleTime: 5_000})` — pas de useEffect-fetch (DEC-005)
- Trigger `<Button variant="ghost">` avec icône Lucide `Inbox` + `<Badge>` count tabular-nums si > 0
- `aria-label="Brouillons (N)"` (E2E SAIS-04)
- Content max-h 400 px + overflow-y-auto si > 5 brouillons
- Label dynamique : « Aucun brouillon en cours » | `${N} brouillon(s) en cours`
- Items affichent : preview adresses (truncate 40 chars), date relative FR (« il y a X min », « à l'instant », « il y a X j »), bouton trash interne (stopPropagation pour ne pas déclencher le RESUME)
- `onSelect={(e) => { e.preventDefault(); handleResume(...) }}` — sans `preventDefault` Radix fermerait avant le dispatch
- `handleDelete` : `await deleteRideDraft(id)` puis `queryClient.invalidateQueries({queryKey: ['ride-drafts']})`

### Task 5.4 — Page /courses RSC (`apps/web/src/app/(app)/courses/page.tsx`, 44 lignes)

Server Component RSC :

- `metadata.title = 'Courses — TAP Régulation'`
- `dynamic = 'force-dynamic'` (RLS-filtré donc pas de cache statique possible)
- `prefetchQuery({queryKey: ['rides', { status: 'all', mode: 'all' }], queryFn: () => listRides({})})` puis `<HydrationBoundary state={dehydrate(queryClient)}>` autour de `<RidesList />`
- Header : titre + texte d'aide avec `<kbd>Cmd/Ctrl+Shift+K</kbd>` (UX raccourci visible)

### Task 5.5 — RidesList client (`apps/web/src/app/(app)/courses/_components/rides-list.client.tsx`, 201 lignes)

Tableau client interactif (D-07) :

- 3 contrôles : `<Input>` recherche fuzzy (aria-label « Rechercher dans les adresses »), `<select>` statut (aria-label « Filtre statut »), `<select>` mode (aria-label « Filtre mode de transport »)
- `useDeferredValue(q)` pour la recherche (debounce React natif)
- `useQuery({queryKey: ['rides', {status, mode}], queryFn: listRidesAction, placeholderData: prev, staleTime: 5_000})`
- Recherche fuzzy locale (filter sur `pickup_address` + `dropoff_address`)
- Skeleton loading 5 rectangles (jamais de spinner — Pilier 1 UX)
- Empty state explicite FR « Aucune course ne correspond aux critères. »
- Tableau 6 colonnes : Date (locale FR `dateStyle: 'short', timeStyle: 'short'` + tabular-nums), Patient (id slice, lien Phase 6), Trajet (truncate max-w 280), Mode (Badge outline), Urgence (Badge `destructive` si `immediate` sinon `secondary`), Statut (Badge secondary)
- Labels FR via `URGENCY_LABEL`, `STATUS_LABEL`, `MODE_LABEL` records
- Type-only import depuis `_lib/queries` (RideRow, RideStatus, RideTransportMode) — types effacés au build, ne déclenche pas la chaîne next/headers

### Bonus — listRidesAction Server Action wrapper (`apps/web/src/app/(app)/courses/actions.ts`, +27 lignes)

Wrapper Server Action exposant `listRides` pour useQuery côté client :

```ts
export async function listRidesAction(params = {}) {
  const parsed = listRidesParamsSchema.safeParse(params);
  if (!parsed.success) return [];
  const { listRides } = await import('./_lib/queries');
  return listRides(parsed.data);
}
```

Pattern miroir de `searchPatientsAction` Phase 1. Permet à `RidesList` d'invoquer la query RSC via `useQuery` sans importer directement `_lib/queries` (qui transitivement importe `next/headers`, interdit en Client Component Next.js 14).

## Task Commits

| Task | Name                                                                                      | Commit    | Files                                                                                                                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1+5.2+5.3+5.4+5.5 | page /courses + DraftQueue header + bouton Nouvelle course intégré          | `c2ce1c7` | apps/web/src/app/(app)/layout.tsx, courses/actions.ts, courses/page.tsx, courses/_components/header-new-ride-button.client.tsx, draft-queue.client.tsx, rides-list.client.tsx |

Commit unique conformément à la recommandation du PLAN Task 5.1 (« Recommandation : commit unique couvrant Tasks 5.1-5.3 »). Tasks 5.4-5.5 (page + RidesList) sont du même commit pour garantir build GREEN — séparer aurait laissé un commit intermédiaire RED (page importe RidesList).

## Files Created/Modified

### Créés (4)

- `apps/web/src/app/(app)/courses/_components/header-new-ride-button.client.tsx` — 30 lignes (cible ≤ 30)
- `apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx` — 151 lignes (cible ≤ 130 — dépassement +21 lignes pour les helpers `formatPreview` + `formatRelative` qui sont des fonctions pures FR localisées, intentionnel)
- `apps/web/src/app/(app)/courses/_components/rides-list.client.tsx` — 201 lignes (cible ≤ 200 — dépassement +1 ligne, négligeable, plafond CLAUDE.md 300 respecté)
- `apps/web/src/app/(app)/courses/page.tsx` — 44 lignes (cible ≤ 50)

### Modifiés (2)

- `apps/web/src/app/(app)/layout.tsx` — 50 → 71 lignes (cible ≤ 75) : import + monte `<RideExpressOrchestrator>` + ajoute lien Courses + DraftQueue + HeaderNewRideButton
- `apps/web/src/app/(app)/courses/actions.ts` — +27 lignes (`listRidesAction` Server Action wrapper)

## Decisions Made

### DEC-EXEC-01 — Server Action wrapper `listRidesAction` (déviation Rule 3 — bloqueur build)

Le PLAN supposait que `RidesList` (Client Component) pouvait directement importer `listRides` depuis `_lib/queries.ts`. Au build production, Next.js 14 a refusé :

```
You're importing a component that needs next/headers. That only works in a
Server Component which is not supported in the pages/ directory.
Import trace: src/lib/supabase/server.ts ← _lib/queries.ts ← rides-list.client.tsx
```

`_lib/queries.ts` importe `createClient` de `@/lib/supabase/server` qui importe `next/headers` — chaîne légitime côté serveur, interdite côté client. Solution miroir de Phase 1 (`searchPatientsAction` wrapper) :

1. Créer `listRidesAction` dans `actions.ts` (`'use server'`)
2. Faire un `dynamic import` de `_lib/queries.ts` (le code RSC reste serveur, JAMAIS expédié au browser)
3. `RidesList` importe `listRidesAction` depuis `actions.ts` (Server Action) + types-only depuis `_lib/queries` (effacés au build)

Pattern réutilisable Phase 5/6. Sécurité 100 % préservée (RLS Postgres source de vérité).

### DEC-EXEC-02 — Commit atomique unique pour les 5 sous-tasks

Le PLAN Task 5.1 explicitait : « Recommandation : commit unique couvrant Tasks 5.1-5.3 ». J'ai étendu à Tasks 5.4 + 5.5 car séparer aurait laissé un commit RED (page.tsx importe `<RidesList>` qui n'existerait pas encore). 1 commit atomique GREEN > 5 commits RED-RED-RED-GREEN-GREEN. Bisect-friendly : tout le PLAN-05 est dans `c2ce1c7`.

### DEC-EXEC-03 — Recherche fuzzy côté client (pas de RPC)

Pour la Phase 2 D-07 page /courses minimale, la recherche fuzzy filtre `pickup_address`/`dropoff_address` côté client (sur les ≤ 100 lignes retournées par `listRides`). Aucun RPC `pg_trgm` côté serveur. Décisions respectées :

- D-07 : page minimale Phase 2, exhaustivité Phase 5 cockpit
- Pilier 1 UX : retour < 100 ms (filter JS sur 100 items est instantané)
- Sécurité : 100 lignes max retournées par `listRides`, pas de risque DoS côté client

Phase 5 ajoutera un RPC `search_rides(q)` quand le volume passera en milliers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Bloqueur build] Import `listRides` depuis `_lib/queries.ts` impossible côté client**

- **Found during:** Vérification finale `pnpm --filter @tap/web build`
- **Issue:** `next/headers` chaîne d'import bloquée pour Client Component (RSC server.ts → \_lib/queries.ts → rides-list.client.tsx).
- **Fix:** Créé `listRidesAction` Server Action wrapper dans `courses/actions.ts` ; `rides-list.client.tsx` consomme `listRidesAction` (runtime) + types-only `RideRow/RideStatus/RideTransportMode` depuis `_lib/queries`. Pattern miroir Phase 1 `searchPatientsAction`.
- **Files modified:** `apps/web/src/app/(app)/courses/actions.ts` (+27 lignes), `rides-list.client.tsx` (import changé)
- **Commit:** `c2ce1c7`

### Notes mineures

- **DraftQueue 151 lignes vs 130 cible PLAN** : les helpers `formatPreview` + `formatRelative` (fonctions pures FR localisées) ajoutent ~20 lignes mais améliorent significativement la lisibilité (vs inliner ces formats dans le JSX). Bien sous plafond CLAUDE.md 300.
- **rides-list 201 lignes vs 200 cible PLAN** : 1 ligne au-dessus, négligeable.

## Issues Encountered

Le seul bloqueur (next/headers en Client Component) a été détecté à la première compilation production. Le typecheck `pnpm --filter @tap/web typecheck` passait silencieusement (`tsc --noEmit` ne fait pas la vérification frontière RSC/Client Component que Next.js fait au build). Lecon : toujours lancer un `pnpm build` complet après ajout d'un Client Component qui consomme une query, pas juste typecheck.

## Threat Flags

Aucun nouveau threat surface introduit hors du `<threat_model>` du PLAN. Les 5 threats listés (T-02-T1, T-02-T2, T-02-T6, T-02-V5, T-02-T7) sont tous mitigés ou explicitement acceptés selon le plan :

| Threat ID | Statut       | Vérification                                                                                         |
| --------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| T-02-T1   | mitigé       | `(app)/layout.tsx` redirige vers /login si !user (inchangé Phase 1) — `getUser()` server-side        |
| T-02-T2   | mitigé       | React échappe les strings au render ; payload contraint zod par `rideDraftSchema` Wave 0             |
| T-02-T6   | accepté low  | refetchInterval 10s + staleTime 5s + invalidateQueries ciblées limitent les appels superflus         |
| T-02-V5   | mitigé       | `STATUS_FILTERS`/`MODE_FILTERS` constantes + cast contrôlé `as RideStatus`/`as RideTransportMode` ; côté serveur Postgres reject les valeurs hors enum |
| T-02-T7   | accepté      | Suppression brouillon sans confirmation — D-10 brouillons transitoires hors audit log ; UX V1.5 Ctrl+Z possible |

`listRidesAction` est un nouveau threat surface mineur : Server Action accessible client-side, validée via `listRidesParamsSchema` zod (status/transport_mode/urgency optionnels strings), RLS Postgres filtre tout le reste. Pas de nouveau flag.

## Self-Check : PASSED

### Files exist

- [x] `apps/web/src/app/(app)/layout.tsx` (71 lignes — modifié)
- [x] `apps/web/src/app/(app)/courses/page.tsx` (44 lignes — créé)
- [x] `apps/web/src/app/(app)/courses/_components/header-new-ride-button.client.tsx` (30 lignes — créé)
- [x] `apps/web/src/app/(app)/courses/_components/draft-queue.client.tsx` (151 lignes — créé)
- [x] `apps/web/src/app/(app)/courses/_components/rides-list.client.tsx` (201 lignes — créé)
- [x] `apps/web/src/app/(app)/courses/actions.ts` (modifié +27 lignes)

### Acceptance grep counts

- [x] `grep -c "RideExpressOrchestrator" layout.tsx` = 4 (import JSDoc + import + usage open + close)
- [x] `grep -c "HeaderNewRideButton" layout.tsx` = 2 (import + usage)
- [x] `grep -c "DraftQueue" layout.tsx` = 3 (import + usage + JSDoc)
- [x] `grep -c 'href="/courses"' layout.tsx` = 1 (lien nav)
- [x] `grep -c "useRideOrchestrator" header-new-ride-button.client.tsx` = 3 (import + usage + JSDoc)
- [x] `grep -c "OPEN_NEW" header-new-ride-button.client.tsx` = 2 (dispatch + JSDoc)
- [x] `grep -c "useQuery" draft-queue.client.tsx` = 4 (import useQuery + useQueryClient + usage + JSDoc)
- [x] `grep -c "RESUME" draft-queue.client.tsx` = 2 (dispatch + JSDoc)
- [x] `grep -c "deleteRideDraft" draft-queue.client.tsx` = 2 (import + usage)
- [x] `grep -c "Brouillons (" draft-queue.client.tsx` = 1 (aria-label)
- [x] `grep -c "HydrationBoundary" page.tsx` = 3 (import + usage open + close)
- [x] `grep -c "prefetchQuery" page.tsx` = 1 (call)
- [x] `grep -c "useQuery|useDeferredValue|Skeleton|Aucune course" rides-list.client.tsx` = 8

### Code quality

- [x] Aucun `console.log/warn/error` (5 fichiers, 0 occurrences hors commentaires)
- [x] Aucun `useEffect` pour fetch (0 occurrences hors mentions explicites de l'anti-pattern dans les JSDoc)
- [x] Aucun import direct `@supabase/supabase-js`
- [x] Tous les fichiers ≤ 300 lignes (max 201 sur rides-list.client.tsx)
- [x] Toutes les fonctions ≤ 50 lignes
- [x] Messages utilisateur en français FR (« Brouillons », « Chargement… », « Vos brouillons apparaîtront ici. », « Aucun brouillon en cours », « Aucune course ne correspond aux critères. », « Rechercher dans les adresses… », « Filtre statut », « Filtre mode de transport », « Tous statuts », labels enums français complets, etc.)
- [x] Boutons gros (Button size="sm" héritent shadcn h-36 ≥ 36 px ; règle ≥ 56 px réservée chauffeur PWA cf. CLAUDE.md § 5)

### Commits exist

- [x] `c2ce1c7` feat(02-05): page /courses + DraftQueue header + bouton Nouvelle course intégré

### Build & typecheck

- [x] `pnpm --filter @tap/web typecheck` exit 0
- [x] `pnpm --filter @tap/web build` exit 0 — route `/courses` 2.62 kB, First Load JS 111 kB, toutes les autres routes inchangées (smoke `/login`/`/patients` non régressés)

## User Setup Required

Aucun. Wave 4 est purement code client + SSR — pas de migration, pas d'env var, pas de dépendance npm ajoutée. Le bouton header + DraftQueue + page /courses sont accessibles immédiatement à n'importe quel utilisateur authentifié dont le rôle Postgres permet la lecture des `rides` (`regulateur`, `dirigeant`, `chauffeur` selon RLS Wave 1).

## Next Phase Readiness

### Wave 5 (E2E saisie-express + Visible Progress) — DÉBLOQUÉE

- ✅ SAIS-01 (< 30 s end-to-end) : `Cmd+Shift+K` ouvre modal globalement → flow saisie complet → toast → close
- ✅ SAIS-02 : raccourci global testable (`page.keyboard.press('Control+Shift+K')`)
- ✅ SAIS-03 : recherche patient 2 chars (Wave 3 livré, smoke test depuis modal)
- ✅ SAIS-04 : DraftQueue dropdown header — ouvrir modal → Mettre en pause → cliquer brouillon dans `[aria-label^="Brouillons"]` → modal réouvert avec valeurs restaurées
- ✅ SAIS-05 : multi-saisies parallèles via deuxième `Cmd+Shift+K` (le 1er flush save → minimized → visible dans DraftQueue)
- ✅ SAIS-06 : audit log déjà couvert pgTAP Wave 1 — vérifié E2E via `audit_logs` query après création

Selectors stables livrés Wave 3 + 4 :

- `[aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)"]` (header bouton)
- `[aria-label^="Brouillons ("]` (DraftQueue trigger)
- `[aria-label="Saisie express d'une course"]` (modal Wave 3)
- `[aria-label="Rechercher dans les adresses"]` (RidesList search)
- `[aria-label="Filtre statut"]` + `[aria-label="Filtre mode de transport"]`
- `[aria-label="Liste des courses"]` (table)

### Visible Progress 6 captures à produire Wave 5

1. /courses empty state (« Aucune course ne correspond aux critères. »)
2. Modal saisie express ouvert avec formulaire vierge
3. Recherche patient 2 chars (résultat dropdown)
4. Modal en cours de remplissage (auto-save « Sauvegardé il y a 2 s »)
5. DraftQueue ouvert avec 2 brouillons (preview + relative time)
6. /courses avec liste 5+ courses (filtres actifs)

---

*Phase: 02-saisie-express-course*
*Plan: 05 (Wave 4 — Layout intégration + DraftQueue + page /courses)*
*Completed: 2026-05-07*
