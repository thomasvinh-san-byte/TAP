---
phase: 06.10-dettes-techniques-phase-06.7
type: summary
status: completed
date_start: 2026-06-01
date_end: 2026-06-03
---

# Phase 06.10 — Dettes techniques Phase 06.7 — SUMMARY

## Objectif initial

Résoudre les 4 dettes techniques tracées en clôture Phase 06.7 :

- **D1** : Hébergement service Python OR-Tools (microservice introuvable de PR #185-#199)
- **D2** : Pipeline geocoding au moment création course (courses UI sans coordonnées)
- **D3** : Passe UX écran optimisation (différée explicitement)
- **D4** : Audit casts `as TYPE[]` (différée explicitement)

## Ce qui a été livré

### Wave 1 — Hébergement Python (5 PR successives sur 2 jours)

- **PR #207** : Tentative 1 « relocate /py/ avec config moderne functions » → échec build attendu (`pattern doesn't match`). Documentée comme expérience d'apprentissage.
- **PR #208** : Tentative 2 « config legacy builds/routes » → build OK, 500 runtime.
- **PR #209** : Fix `sys.path` pour imports plats Python sur runtime Vercel → 500 résolu, 404 FastAPI.
- **PR #210** : Préfixe FastAPI conditionnel via env var `VERCEL=1` → 404 résolu, `/api/solver/health` répond 200.
- **PR #212** : Timeout client 5s→30s + maxDuration ajouté dans vercel.json builds config.

**Résultat technique** : la chaîne complète Vercel Python OR-Tools est fonctionnelle. `/api/solver/health` répond 200 en preview et production. `/api/solver/solve` traite des payloads valides en ~7-8s (cold start + solving).

**Résultat opérationnel** : sur Vercel Hobby, le walkthrough complet `/cockpit/optimisation` avec `OPTIMIZER_USE_MOCK=false` reste bloqué par le plafond maxDuration 10s du plan. Pour activer le vrai solveur en production, il faudrait : (a) basculer Vercel Pro (Scale-to-One + maxDuration 60s), ou (b) Pattern 2 WASM, ou (c) Pattern 4 pré-calcul. Décision dirigeant 2026-06-03 : rester sur mock pour la phase tests.

### Wave 2 — Pipeline geocoding (1 PR)

- **PR #211** : Audit complet du pipeline UI→DB. **Cas A déjà câblé depuis Phase 04.7 (DEC-044)** — pas de bug applicatif. Le diagnostic initial « 0/25 courses ont coords » venait du seed démo `supabase/seed.demo.sql` qui insère sans coords. Ajout de 3 tests Vitest de scellement dans `packages/shared/src/validators/__tests__/ride.test.ts` pour figer le contrat coords à l'avenir (cas avec coords, cas saisie libre sans coords, bornes lat/lng).

**Résultat** : aucune modification de code applicatif nécessaire. Une course créée via UI avec sélection d'une suggestion BAN persiste correctement ses 6 colonnes coords (vérifié en BDD).

## Décisions LOCKED dans cette phase

- **ADR-009** : pattern container long-running pour algorithmes coûteux — **confirmé** par l'expérience Wave 1. Les 4 critères (binaires>30 MB, cold start>2s, burst sans scale, calcul>1s/req) sont tous présents pour OR-Tools.
- **DEC-082** : Pré-filtrage fenêtres temporelles remplace AddDisjunction OR-Tools (inchangée).
- **DEC-083** : `CONTRACT_VERSION='1'` synchronisé TS↔Python (inchangée).

## Dettes ouvertes à l'issue de Phase 06.10

| Dette | Statut | Action |
|---|---|---|
| D1 hébergement Python | **techniquement résolu, opérationnellement reporté** | Mock activé en prod+preview, vraie bascule en Phase 06.11 candidate (WASM ou container Pro) |
| D2 pipeline geocoding | **résolu** (code déjà câblé, scellé par tests Vitest) | Aucune |
| D3 passe UX écran optimisation | **différé** | À cadrer dans une phase ultérieure |
| D4 audit casts `as TYPE[]` | **différé** | À cadrer dans une phase ultérieure |

## Capitalisations produites

- `docs/dette-technique/2026-06-01-enquete-dettes-techniques.md` (enquête initiale 4 dettes)
- `docs/dette-technique/2026-06-01-enquete-post-echec-wave1.md` (post-PR #207, analyse Vercel functions vs builds)
- `docs/dette-technique/2026-06-03-enquete-patterns-solveur-cout.md` (4 patterns d'hébergement solveur)
- `docs/adr/ADR-009-pattern-hebergement-services-couteux.md` (LOCKED)

## Phase candidate suivante

**Phase 06.11 « Refactor solveur Wave 1bis »** — à cadrer si la décision est prise de réactiver le vrai solveur OR-Tools. 3 options :

1. Bascule Vercel Pro + cron warm-up (~$20/mois, effort 1-2h).
2. Refactor WASM via `reinterpretcat/vrp` (effort 12-20h, aucun coût d'hébergement).
3. Container long-running sur Fly.io / Railway / Cloud Run (effort 4-8h, ~$5-20/mois).

Aucune urgence — le mock UX est fonctionnellement équivalent pour la phase tests.
