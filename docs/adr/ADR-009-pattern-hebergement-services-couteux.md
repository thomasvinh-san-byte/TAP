# ADR-009 — Pattern « container long-running » pour algorithmes coûteux

- **Statut** : **Superseded par ADR-010** (2026-06-04) — au sens : le solveur d'optimisation ne suit plus ce pattern ; il a été réimplémenté en heuristique TS native, plus aucun binaire natif coûteux ne reste dans le projet.
- **Date** : 2026-06-01
- **Remplace** : aucun (précise et conditionne DEC-079 / ADR-008)
- **Affecte** : `apps/web/api/solver/` (OR-Tools), futurs services type ML / OSRM / geocoding intensif
- **Note 2026-06-04** : Cette ADR est superseded par [ADR-010](./ADR-010-solveur-heuristique-ts-native.md) sur l'application au solveur d'optimisation. Le **pattern général** « container long-running pour binaire natif > 30 MB » reste valide en théorie pour des services futurs (ML, OSRM, géocodage intensif) — mais aucun service du projet ne le remplit aujourd'hui.

## Contexte

Cinq PR de fix consécutives sur l'hébergement Vercel Python du solveur OR-Tools n'ont pas débloqué le 404 sur `/api/solver/health` (PR #195 refactor hybride, #196 middleware exclude, #197 router FastAPI sans double-prefix, #198 `vercel.json` au Root Directory, #199 rewrite Next.js `/api/solver/:path*`). Sans accès direct aux logs Functions du dashboard Vercel, le diagnostic à distance s'est épuisé. Décision dirigeant du 2026-06-01 (cf. ADR-008 révision 2026-06-01) : mocker le solveur via `OPTIMIZER_USE_MOCK=true` pour débloquer la Phase 06.7 Wave 3.

L'enquête open-source du même jour (`docs/dette-technique/2026-06-01-enquete-open-source-dettes.md`) a confirmé qu'**aucun projet VRP open-source significatif ne déploie en serverless** :

- **VROOM** (~1700 étoiles, OPTITransLab) : container long-running, REST.
- **KaRRi** (Karlsruhe Institute of Technology) : service JVM long-running.
- **pgRouting + VROOM** : combinaison PostgreSQL + container Python.

Pattern observé : binaires natifs lourds (OR-Tools ~75 MB unzipped), cold start incompatible avec UX régulatrice (1-3 s par requête déjà), usage en burst sans bénéfice de scale horizontal. Notre tentative initiale allait à contre-courant de la communauté.

## Décision

Pour tout service qui remplit un ou plusieurs des critères suivants, **préférer un container long-running** (Render, Fly.io, VPS auto-hébergé) à un déploiement serverless :

- (a) binaires natifs > 30 MB ;
- (b) cold start mesuré > 2 s ;
- (c) pattern d'usage en burst sans bénéfice de scale horizontal ;
- (d) calcul > 1 s par requête.

**Le critère prime sur le coût.** Économiser 7 $/mois ne justifie pas un cold start de 30 s qui dégrade l'UX régulatrice.

## Trajectoire pour le solveur OR-Tools spécifiquement

- **Tentative 1 (Wave 1 Phase 06.10)** : déplacement physique du code Python hors de `/api/` Next.js (vers `/py/solver/` à la racine du projet Vercel) + rewrites Next.js. Pattern documenté par Vercel (template officiel `vercel/examples/nextjs-flask-starter`, issue communautaire #6598) **non encore essayé** par TAP — les 5 PR précédentes ont tenté tous les contournements (middleware, FastAPI prefix, rewrites bidirectionnels) sans tenter le déplacement physique. Critère de succès : `/api/solver/health` retourne 200 sur preview en moins de 4 h de travail. Critère d'abandon : 4 h écoulées sans succès.
- **Tentative 2 (Wave 1bis Phase 06.10, si Tentative 1 échoue)** : bascule Render Starter Docker (~7 $/mois, container warm, pas de cold start). ADR-008 sera amendée à ce moment-là pour acter la bascule. DEC-079 (Vercel Python LOCKED) sera rééexaminée.

## Alternatives considérées

1. **Acharnement Vercel sans changement de pattern** — éliminé. 5 PR de fix sans succès, le pattern lui-même est en cause (le constat communautaire le confirme).
2. **Bascule directe Render sans tenter Vercel `/py/`** — éliminé pour cette PR car la piste `/py/` n'a jamais été essayée et coûterait au plus 4 h. Si elle marche, c'est gratuit et on reste sur la stack actuelle. Si elle échoue, on bascule Render.
3. **Self-hébergement VPS** — différé. Plus de friction opérationnelle (TLS, monitoring, reboots) sans bénéfice pour le stade bêta.

## Conséquences

- **DEC-079** (Vercel Python LOCKED) devient **conditionnelle au succès de Tentative 1**. Si Tentative 2 est déclenchée, DEC-079 sera rééexaminée et ADR-008 amendée.
- **Le mock `OPTIMIZER_USE_MOCK=true`** reste actif sur production tant que la qualité OR-Tools n'est pas validée par walkthrough complet sur données réelles.
- **Le `Dockerfile`** historique de `services/optimizer/` reste référencé dans l'historique Git (commit pré-bascule hybride) — réutilisable tel quel pour Render.
- **Pas de nouvelle dette technique** créée par cet ADR — il acte un pattern, pas une nouvelle décision opérationnelle.
- **Futurs services à enjeu** (OSRM auto-hébergé Phase 10, géoloc certifiée 2027, éventuels services ML) : ADR-009 sert de garde-fou — pas de tentative serverless pour ces services sans audit explicite contre les 4 critères.

## Sources

- Enquête open-source : `docs/dette-technique/2026-06-01-enquete-open-source-dettes.md`
- ADR-008 amendée 2026-06-01 (révision « bascule architecture hybride » + révision « mock du solveur »)
- Issue Vercel #6598 (déplacement Python hors `/api/`)
- Template `vercel/examples/nextjs-flask-starter`
- VROOM Project (`github.com/VROOM-Project`)
- KaRRi Karlsruhe Institute of Technology
- Comparatifs Render / Fly.io / Railway 2026 (offres Starter $7/mois)
