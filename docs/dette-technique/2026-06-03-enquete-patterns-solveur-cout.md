# Enquête open-source — patterns d'hébergement solveur OR-Tools (2026-06-03)

## Méthode et périmètre

Enquête menée le 2026-06-03 par recherche ciblée sur 4 axes : (1) patterns d'hébergement utilisés par la communauté pour des solveurs OR-Tools en production ; (2) alternatives WebAssembly à OR-Tools pour rester côté client/edge ; (3) fonctionnalités Vercel récentes (Fluid Compute, Scale-to-One, Workflows) ; (4) trade-offs effort/coût/robustesse pour le stade bêta TAP.

Contexte déclencheur : Phase 06.10 Wave 1 a livré une chaîne Vercel Python OR-Tools techniquement fonctionnelle (`/api/solver/health` répond 200, `/api/solver/solve` traite des payloads valides en ~7-8 s), mais le walkthrough complet reste bloqué sur Vercel Hobby par le plafond `maxDuration` 10 s (cold start ~3 s + solving ~5 s > plafond plan). Décision dirigeant 2026-06-03 : trace les patterns viables pour réactivation ultérieure du vrai solveur, garder mock pendant phase tests.

## Les 4 patterns viables identifiés

### Pattern 1 — Container long-running

| Aspect | Détail |
|---|---|
| Stack | Fly.io, Railway, Cloud Run avec min instances ≥ 1 |
| Coût | ~5-20 $/mois selon fournisseur |
| Cold start | Aucun (container warm 24/7) |
| Effort de bascule | 4-8 h (provision + Dockerfile + déploiement + env vars) |
| Verdict 2026-06-03 | **Bloqué** par directive dirigeant « pas de container payant pendant tests » |

Avantages : pas de cold start, pas de plafond `maxDuration` côté plan SaaS, pattern standard communauté VRP (cf. ADR-009 + enquête 2026-06-01 — VROOM, KaRRi, pgRouting+VROOM tous en container long-running). Inconvénient : ajout de fournisseur récurrent au budget infra bêta.

### Pattern 2 — WebAssembly in-process (`reinterpretcat/vrp` Rust+WASM)

| Aspect | Détail |
|---|---|
| Stack | `reinterpretcat/vrp` (~472 étoiles, Rust + WASM bindings via wasm-bindgen) |
| Coût | Aucun (exécution côté serveur Vercel ou côté navigateur) |
| Cold start | ~50 ms (chargement du module WASM, pas de runtime Python) |
| Effort de bascule | 12-20 h (refactor `apps/web/api/solver/` → bindings Rust + intégration WASM côté Route Handler ou client) |
| Verdict 2026-06-03 | **Candidate Phase 06.11** — alternative la plus alignée avec ADR-009 et la stack TS du projet |

Avantages : qualité d'optimisation proche d'OR-Tools, stack 100 % TS-friendly, exécution edge possible (Vercel Edge Functions), pas de cold start lourd. Inconvénient : courbe d'apprentissage Rust + WASM bindings, refactor non trivial du contrat existant.

### Pattern 3 — Cron warm-up + Fluid Compute Scale-to-One (Vercel Pro)

| Aspect | Détail |
|---|---|
| Stack | Vercel Pro (Fluid Compute + Scale to One pour fonction Python) + cron Vercel pour warm-up |
| Coût | Vercel Pro ~20 $/mois (équivalent container long-running) |
| Cold start | Partiel — le cron warm-up ramène à ~100-300 ms après inactivité courte |
| Effort de bascule | 1-2 h (upgrade plan + ajouter cron + ajuster `maxDuration` à 60 s) |
| Verdict 2026-06-03 | **Bloqué Hobby** — Scale-to-One nécessite Vercel Pro |

Avantages : reste sur la stack actuelle, effort minimal, conserve le code Python existant. Inconvénient : coût plan Pro équivalent à un container long-running sans bénéfice supplémentaire évident pour le stade bêta.

### Pattern 4 — Pré-calcul en arrière-plan (Vercel Workflows)

| Aspect | Détail |
|---|---|
| Stack | Vercel Workflows (Beta 2026) + Supabase Realtime pour notifier la fin de calcul |
| Coût | Workflows facturés à l'usage (~quelques $ par mois pour le volume bêta) |
| Cold start | N/A — le calcul est asynchrone, l'UI affiche un état « en cours » jusqu'à notification Realtime |
| Effort de bascule | 8-16 h (refactor flow asynchrone côté UI + branchement Workflows + canal Realtime) |
| Verdict 2026-06-03 | **Candidate Phase 06.12** — pertinente si l'optimisation devient une tâche batch (ex. récurrence dialyse week-end) |

Avantages : aucun problème de cold start ou de timeout, expérience utilisateur honnête (« calcul en cours, notification dans 30 s »). Inconvénient : refactor important du flow synchrone actuel `/cockpit/optimisation`, gestion d'état asynchrone côté UI.

## 3 patterns transversaux confirmés

1. **Pas de serverless pour algorithmes coûteux** — ADR-009 LOCKED. Les 4 critères (binaires > 30 MB, cold start > 2 s, burst sans scale, calcul > 1 s/req) sont tous présents pour OR-Tools. Les patterns 2 et 4 contournent en passant respectivement à l'edge (WASM) ou à l'asynchrone.
2. **Geocoding au moment de la saisie UI** — confirmé par Wave 2 Phase 06.10 (cas A déjà câblé depuis Phase 04.7 / DEC-044).
3. **BFF / Route Handler enrichit la réponse** du microservice avant UI — confirmé par Wave 4 Phase 06.7 (`enrichProposal()` dans `apps/web/src/app/api/optimizer/route.ts`).

## Recommandation 2026-06-03

Pour le stade bêta (pas de prospect demandant OR-Tools réel) : **mock activé en production et preview**. Le mock produit des regroupements 2-par-2 cohérents avec le contrat zod, l'enrichissement Wave 4 fonctionne correctement (libellés véhicules, adresses lisibles).

Pour la réactivation ultérieure (priorisée par dirigeant) :
- **Court terme rapide** (~1-2 h, ~20 $/mois) : Pattern 3 — bascule Vercel Pro + cron warm-up.
- **Court terme gratuit mais effort** (~12-20 h, 0 $/mois) : Pattern 2 — refactor WASM `reinterpretcat/vrp`.
- **Long terme batch** (~8-16 h, ~5 $/mois) : Pattern 4 — pré-calcul Workflows pour récurrences.

---

*Capitalisation 2026-06-03 d'une enquête menée par le dirigeant et Claude-chat. Sert de référence pour la cadrage d'une éventuelle Phase 06.11 « Refactor solveur Wave 1bis ».*
