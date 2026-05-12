## Conflict Detection Report

**Mode** : merge
**Précédence appliquée** : ADR > SPEC > PRD > DOC (manifest override per-doc)
**Sources analysées (run 2026-05-12)** : 3 documents (3 SPEC)
**Sources cumulées (depuis run 2026-05-11)** : 8 documents (2 ADR, 3 SPEC, 0 PRD, 3 DOC)
**Cycle detection** : aucun cycle dans le graphe `cross_refs` (3 nœuds, 1 arête : passes-2-3-4 → pivot-e2e-v2)

> Précédent rapport (run 2026-05-11, mode `new`, 5 docs ingérés) archivé dans
> les commentaires Git. Ce rapport remplace le précédent.

---

### BLOCKERS (0)

Aucun.

Justification :
- Aucun ADR ingéré dans ce run → pas de contradiction LOCKED-vs-LOCKED entre
  ADRs nouveaux.
- Confrontation aux 16 décisions verrouillées de PROJECT.md (`<decisions
  locked="true">` : DEC-001 à DEC-016) : aucune des 3 SPECs n'introduit de
  décision contradictoire.
  - `regle-neutralite-et-ton.md` (NFR transverse) renforce DEC-011
    (« Localisation FR + conventions de nommage ») sans le contredire.
    Additif : interdiction noms propres = nouvelle contrainte non
    couverte par DEC-011 strictement.
  - `pivot-e2e-v2-2026-05-11.md` est aligné sur ADR-003 (déjà LOCKED dans
    le repo, non-ingérée car non listée dans le manifest courant). Le
    SPEC formalise les principes UX de DEC-004/DEC-005 sans les
    contredire — additif (design tokens + spacing scale + double goal).
  - `passes-2-3-4-detail.md` ne contient pas de décisions formelles, juste
    du périmètre. Aucune contradiction.
- Confrontation aux `<decisions>` blocks des CONTEXT.md de phases livrées
  (01, 01.5, 02) : scopes disjoints, aucune contradiction.
- Aucun document classifié `UNKNOWN` à confiance basse.
- Aucun cycle de référence croisée.

---

### WARNINGS (1)

**[WARNING] Désalignement structurel ROADMAP.md ↔ pivot-e2e-v2 SPEC**

- **Found** : `.planning/ROADMAP.md` (issu de l'ingest run 2026-05-11) liste
  les phases selon la **numérotation CDC originale** :
  - Phase 3 = « Moteur tarification CGSS »
  - Phase 4 = « Moteur récurrences »
  - Phase 9 = « PWA chauffeur »
  - …jusqu'à Phase 17.
- **Expected** : `.planning/pivot-e2e-v2-2026-05-11.md` (SPEC, prec=1)
  prescrit la **numérotation E2E par passes** (cf. ADR-003 LOCKED) :
  - Passe 1 (Phase 03) = « Squelette E2E » (déjà livrée 03-A à 03-cloture)
  - Passe 2 (Phase 04) = « PWA + tarif CGSS auto + caisse »
  - Passe 3 (Phase 05) = « Récurrences + cockpit + SMS »
  - Passe 4 (Phase 06+) = « HDS + OR-Tools + B2B »
- **Impact** : la résolution `route_merge_mode` ne peut pas appliquer le
  SPEC sans détruire l'ordonnancement existant (phases déjà livrées 01,
  01.5, 02, 03 portent les vrais artefacts). La synthèse ne peut pas
  auto-pick sans risque de perte de provenance.
- **→ Résolution proposée** :
  1. Conserver la numérotation **disque** (01, 01.5, 02, 03 = squelette E2E
     déjà livré) qui est la source de vérité.
  2. Retirer de ROADMAP.md les phases 3-17 héritées de la numérotation CDC
     pré-pivot (« Moteur tarification CGSS », etc.) qui sont obsolètes.
  3. Réinjecter à la place les **passes 2/3/4** détaillées dans
     `passes-2-3-4-detail.md` aux numéros 04, 05, 06 (alignés ADR-003).
  4. Le 03-cloture-bis (annulation course + CRUD admin) reste en clôture
     de Passe 1 (déjà mergé sur branche feature `feat/03-cloture-bis-…`).
- **Décision requise** : approuver ce plan de réécriture ROADMAP, ou
  abort pour le faire manuellement. Voir étape `route_merge_mode`.

---

### INFO (3) — Auto-resolved

**[INFO] CON-015..016 — Neutralité + ton sobre**

- Note : `regle-neutralite-et-ton.md` (SPEC, prec=0) introduit deux
  contraintes transverses (CON-015 noms propres interdits, CON-016 ton
  sobre) qui complètent DEC-011 sans le contredire. Ajoutées à
  `.planning/intel/constraints.md`. À promouvoir en NFR-001/NFR-002 dans
  REQUIREMENTS.md lors de la route merge.

**[INFO] CON-017..020 — Méthode E2E + design tokens + interaction patterns**

- Note : `pivot-e2e-v2-2026-05-11.md` (SPEC, prec=1) introduit 4
  contraintes additives (CON-017 double goal par passe, CON-018 spacing
  scale strict 4/8/12/16/24/32/48/64, CON-019 identité visuelle bleu
  primaire + accent terracotta + Inter tnum + Lucide, CON-020 états
  interactifs et animations standard). Renforcent DEC-004/DEC-005 sans
  les contredire. Ajoutées à `.planning/intel/constraints.md`.

**[INFO] CON-021 — Périmètres détaillés des passes 2/3/4**

- Note : `passes-2-3-4-detail.md` (SPEC, prec=2) précise le scope
  fonctionnel et UX des 3 passes restantes. Servira à seeder les phases
  04/05/06 de la nouvelle ROADMAP en route_merge_mode. Ajouté à
  `.planning/intel/constraints.md`.

---

## Résumé

- **0 BLOCKER** — l'ingest peut écrire les destination files.
- **1 WARNING** — désalignement structurel ROADMAP, requiert décision
  utilisateur dans `route_merge_mode` (approve | revise | abort).
- **3 INFO** — auto-résolus, traçabilité complète préservée.
- **Statut** : AWAITING USER (la WARNING gate doit être franchie avant
  d'écrire ROADMAP.md / REQUIREMENTS.md).
