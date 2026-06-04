# ADR-010 — Solveur d'optimisation = heuristique TypeScript native dans `apps/web`

- **Statut** : Accepté
- **Date** : 2026-06-04
- **Supersede** : ADR-008 (Hébergement Vercel Python serverless), ADR-009 (Pattern container long-running pour algos coûteux)
- **Affecte** : `apps/web/src/lib/optimizer/`, `apps/web/src/app/api/optimizer/route.ts`, `packages/optimizer-client/`, Phase 06.7, Phase 06.10, Phase 06.12, DEC-079, DEC-080, DEC-093

## Contexte

Au moment de la Phase 06.7 (livrée 2026-06-01), le solveur d'optimisation de tournées a été implémenté en Python avec OR-Tools (microservice `services/optimizer`, déplacé à `apps/web/py/solver/`). L'objectif initial était de disposer d'un solveur PDPTW (Pickup & Delivery with Time Windows) capable de tenir face à des volumes importants.

L'hébergement sur Vercel Python serverless s'est révélé impossible à stabiliser en 5 tentatives consécutives (PR #196..#199, puis Phase 06.10 6 PR supplémentaires) — binaires OR-Tools ~75 MB, cold start incompatible avec UX régulatrice, plafond `maxDuration` 10 s sur plan Hobby. La décision dirigeant du 2026-06-01 a activé `OPTIMIZER_USE_MOCK=true` en production et preview pour débloquer la livraison fonctionnelle, en reportant la réactivation du solveur réel à une « Phase 06.12 candidate ».

L'enquête open-source de Phase 06.10 (`docs/dette-technique/2026-06-03-enquete-patterns-solveur-cout.md`) a recensé 3 options pour réactiver OR-Tools : (A) Vercel Pro + cron warm-up (~20 $/mois, 1-2 h), (B) refactor WASM (12-20 h), (C) container long-running tiers (4-8 h, ~5-20 $/mois).

### Revue critique 2026-06-04

Deux faits ont changé la lecture entre 2026-06-01 et 2026-06-04 :

1. **Volume réel** : ≤ 500 courses absolu, en pratique quelques dizaines par jour. Le contrat zod plafonne déjà à `rides.max(200)`. OR-Tools est calibré pour des problèmes 1000+ waypoints — disproportionné ici.
2. **Caractéristique du domaine** : pour fenêtres temporelles petites + horaires quasi-fixes (dialyse programmée 3×/semaine = cas TAP majoritaire), une heuristique greedy cluster-first/route-second est quasi-optimale d'après la littérature OR sur PDPTW à fenêtres serrées.

S'y ajoute la nature des indicateurs : tous les calculs (taux mutualisation, km à vide) sont déjà affichés comme **« estimés » (DEC-081)** — l'exactitude n'est pas contractuelle, ni vis-à-vis du client, ni vis-à-vis de la régulatrice.

## Décision

Réimplémenter le solveur en **heuristique TypeScript native** dans `apps/web/src/lib/optimizer/`. Supprimer intégralement OR-Tools, le microservice Python, le mock et toute logique d'hébergement séparé.

### Algorithme retenu (cluster-first / route-second)

1. **Pré-filtre** par compatibilité de fenêtres temporelles (port direct du `_pre_filter_rides` Python). Tolérances ±30 min programmée, ±60 urgente, ±15 immédiate.
2. **Clustering** par compatibilité fenêtre + `transport_mode` → `vehicle.type` + capacité véhicule. Apparie greedy 2 par 2, extension à n si capacité.
3. **Routing** : nearest-neighbor sur Haversine corrigée (DEC-056). Pas de 2-opt (volume trop petit pour gain tangible).
4. **`km_a_vide_estimes`** = somme Haversine corrigée des trajets sans passager entre dropoff et pickup suivant.

### Contrat préservé

`packages/optimizer-client/contract.ts` (zod `SolveRequestSchema` / `SolveResponseSchema`) reste l'interface canonique. `solveLocal()` produit exactement le même `SolveResponse` que l'ancien Python — réversible par contrat.

`transform.ts` (`ridesToSolveRequest`, `solveResponseToProposal`) et `contract.ts` conservés sans modification.

### Supressions

- `apps/web/py/solver/` (13 fichiers Python : solver.py, _extract.py, haversine.py, models.py, index.py, requirements*.txt, tests/, README.md, pytest.ini).
- `apps/web/src/app/api/optimizer/_mock-solver.ts`.
- `apps/web/vercel.json` : `builds` Python + `routes` `/api/solver/*` retirés.
- `packages/optimizer-client/client.ts` : fonction `solve()` HTTP + `OptimizerError` retirées (fichier conservé vide pour historique git, plus re-exporté par `index.ts`).
- `packages/optimizer-client/src/__tests__/client.test.ts` : tests du client HTTP supprimés.
- Commentaire `middleware.ts` référant à `apps/web/py/solver/` retiré.

### Variables d'environnement

`OPTIMIZER_USE_MOCK` et `OPTIMIZER_SERVICE_URL` deviennent obsolètes — à retirer du dashboard Vercel après merge (preview + production).

## Conséquences

### Positives

- **Suppression de la SEULE vraie barrière** (hébergement Python). Plus de plan Vercel Pro à arbitrer, plus de container tiers à provisionner. Le projet reste sur le plan Hobby Vercel + Supabase déjà payés.
- **Coût marginal nul**. Plus de service tiers, plus de cold start, plus de runbook bascule 2 projets (`docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md`) à maintenir.
- **Latence drastiquement réduite**. Auparavant : 1-3 s cold start + 30 s timeout client. Maintenant : quelques millisecondes pour ≤ 200 courses. UX régulatrice : feedback < 100 ms (CLAUDE.md objectif).
- **Réversibilité par contrat**. Si le volume franchit 1000+ courses (improbable au stade actuel), réintroduire OR-Tools comme implémentation alternative de `solve()` est trivial — le contrat zod gère l'interface, `solveLocal()` peut redevenir un fallback ou une route dédiée.
- **Plus simple à raisonner**. Tout dans TypeScript, dans `apps/web`, testé par Vitest comme le reste du code applicatif.

### Négatives / dette

- L'heuristique n'est **pas optimale au sens mathématique**. Pour des configurations adverses (centaines de courses entrelacées sur 4 véhicules), un solveur OR-Tools pourrait trouver un plan ~5-10 % meilleur. Trade-off acceptable : (a) le volume réel rend ce gain marginal en valeur absolue, (b) les indicateurs sont déjà « estimés » DEC-081, (c) la décision est réversible par contrat.
- **Pas de 2-opt** dans la V1. Si le retour terrain montre des trajets clairement sous-optimaux, ajouter une passe 2-opt simple est un effort < 4 h.
- **Pas de contraintes TPMR poussées** (alors qu'OR-Tools avait `SetAllowedVehiclesForIndex`). L'heuristique TS s'appuie sur le mapping `COMPATIBILITY` (transport_mode → vehicle.type) — couvre le cas tpmr → tpmr de manière équivalente pour les configurations actuelles.

### Documentation rendue obsolète

- ADR-008 « Hébergement Vercel Python » : superseded.
- ADR-009 « Pattern container long-running » : superseded (le pattern reste valide en général, mais le solveur n'y entre plus).
- `docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md` : sans objet pour le solveur — à archiver ou à recadrer s'il sert à d'autres services à l'avenir.
- `docs/dette-technique/2026-06-01-phase-06.7-cloture.md` : D1 (hébergement Python) clôturée par cette décision.
- `docs/dette-technique/2026-06-03-enquete-patterns-solveur-cout.md` : les 3 options A/B/C deviennent caduques pour le solveur (conservées pour traçabilité décisionnelle).

## Trace décisionnelle

DEC-093 (inscrite dans `.planning/STATE.md` Decisions + `.planning/journal.md`) :
« Solveur d'optimisation réimplémenté en heuristique TS native ; OR-Tools / Python / mock / hébergement séparé abandonnés. Motif : volume ≤ 500 rend OR-Tools disproportionné ; supprime la barrière d'hébergement. Contrat `@tap/optimizer-client` inchangé → réversible. »
