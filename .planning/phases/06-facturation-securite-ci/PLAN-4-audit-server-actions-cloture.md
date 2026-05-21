# PLAN-4 — Bloc E.2 : audit Server Actions + clôture Phase 06

**Phase** : 06 Facturation CGSS + audit sécurité + dettes CI
**Wave** : 3/3 (clôture — après PLAN-2 et PLAN-3)
**Dépendances** : PLAN-2 (facturation) + PLAN-3 (audit RLS) mergés. La clôture récapitule tout.
**Estimation** : 3-5 h
**Refs** : 06-CONTEXT.md (Bloc E, D-11, DEC-063..067), CONCERNS.md § « Server Actions row count check (DEC-041) » + § « Audit permissions Server Actions modules admin » (candidate DEC-040), DEC-041 row count, ADR-004 (modèle ADR différé), DEC-032 CD push, CLAUDE.md § 6

---

## Goal

Deux parties : (1) auditer les **38 Server Actions** du repo et leur appliquer systématiquement le guard d'autorisation (`require*`, DEC-040 promue LOCKED) et le pattern row count check (DEC-041) ; (2) **clôturer la Phase 06** — SUMMARY, formalisation ROADMAP (resserrer 06 + créer 06.5 / 06.7), promotion des DEC, ADR de report. ZÉRO UI.

---

## Partie 1 — Audit Server Actions

### Livrable 1 — Inventaire

**Fichier à créer** : `.planning/phases/06-facturation-securite-ci/SERVER-ACTIONS-AUDIT.md`.

Inventorier les **38 fichiers `'use server'`** (`grep -rl "'use server'" apps/web/src`). Pour chaque export de Server Action, un tableau : `fichier` × `action` × `guard require* présent` × `pattern DEC-041 row count présent (si UPDATE/DELETE)` × `verdict`.

Périmètre connu (CONCERNS, non exhaustif) :
- `(admin)/admin/chauffeurs/actions.ts` — `createDriver`, `updateDriver`, `archiveDriver`, `deactivateDriver`, `reactivateDriver`, `unarchiveDriver`, `inviteDriver`, `resendInvitation`
- `(admin)/admin/vehicules/actions.ts` — `requireDirigeant` **local** (duplication à remplacer par le helper partagé)
- `(admin)/admin/legal/{registre,dpia,dpa,breaches,requests,dpo}/actions.ts` — **aucun `require*`** côté Server Action (privilege gap T-04.5-27)
- `(admin)/admin/tarifs/actions.ts`, `(admin)/admin/maintenance/actions.ts`
- `(app)/courses/actions/*.ts`, `(app)/patients/actions/*.ts`, `(driver)/conduite/actions.ts`, cockpit, etc.
- la nouvelle `queries-facturation` de PLAN-2 (lecture seule — vérifier qu'elle est bien sous `requireDirigeantPage`).

### Livrable 2 — Promotion DEC-040 + correctifs

**DEC-040** (candidate inscrite CONCERNS) est **promue LOCKED** : toute Server Action modifiant des données admin DOIT commencer par un guard `require*` partagé (`@/lib/auth/require-dirigeant`, `@/lib/auth/require-admin-or-regulateur`). Pas de fonction `requireX` locale (duplication interdite).

Correctifs (fichiers à modifier) :
1. `(admin)/admin/vehicules/actions.ts` — remplacer le `requireDirigeant` local par l'import du helper partagé.
2. `(admin)/admin/legal/{registre,dpia,dpa,breaches,requests,dpo}/actions.ts` — ajouter `requireDirigeant()` (ou équivalent) en tête de chaque export `'use server'`.
3. Toute autre Server Action sans guard détectée à l'inventaire.
4. **DEC-041 row count check** : toute Server Action `UPDATE`/`DELETE` sur table RLS doit faire `.select('id')` + vérifier `data.length` (`if (!data || data.length === 0) return { error: 'Modification refusée — droits insuffisants.' }`). Appliquer partout où c'est manquant (Phase 04.5 ne l'a posé que sur `startRideAction` / `endRideAction`).

### Livrable 3 — Tests E2E error-path

**Fichiers à créer** : `apps/web/tests/e2e/*.spec.ts` (gabarit Playwright existant).

E2E « error-path RLS blocking » : une Server Action invoquée par un rôle non autorisé / cross-org refuse côté serveur (pas seulement l'UI cachée). Minimum : un régulateur tente une action `legal/*` → assert refus serveur ; un cross-org tente un `UPDATE` → assert `error` (pas un faux `success`). 2-3 E2E ciblés (CLAUDE.md § 9 — pragmatique, golden path de l'error-path).

---

## Partie 2 — Clôture Phase 06

### Livrable 4 — Formalisation ROADMAP (action de séquençage en attente depuis le discuss)

**Fichier à modifier** : `.planning/ROADMAP.md`.

1. **Resserrer la ligne Phase 06** : la réécrire pour refléter le périmètre réel — « E2E Passe 4 (partie 1) : Facturation CGSS PDF + audit RLS/Server Actions systémique + dettes CI ». Retirer HDS / OR-Tools / B2B de la ligne 06.
2. **Ajouter Phase 06.5** : « Migration HDS » — sous-phase dédiée (DEC-065), `Depends on: Phase 06`, discuss propre + ADR pour le choix fournisseur.
3. **Ajouter Phase 06.7** : « OR-Tools optimisation de tournées » — sous-phase dédiée (DEC-066), microservice Python.
4. Mentionner dans la section « Dépendances héritées » le report B2B + B2/CNDA (DEC-067 / DEC-064).
   Bloc « Phase Details » : ajouter les sections détaillées 06 (resserrée) / 06.5 / 06.7.

### Livrable 5 — Promotion des DEC dans PROJECT.md

**Fichier à modifier** : `.planning/PROJECT.md` (bloc `<decisions locked="true">`).

Inscrire LOCKED : **DEC-040** (guard `require*` Server Actions), **DEC-063** (Phase 06 resserrée), **DEC-064** (facturation PDF / B2-CNDA différé), **DEC-065** (HDS = 06.5), **DEC-066** (OR-Tools = 06.7), **DEC-067** (B2B différé). Reprendre les libellés de `06-CONTEXT.md` § « DEC candidates ». Prochain numéro libre après inscription = DEC-068.

### Livrable 6 — ADR de report

**Fichiers à créer** : `docs/adr/ADR-005-*.md` et `docs/adr/ADR-006-*.md` (numéros à confirmer — dernier ADR = ADR-004). Calqués sur le **modèle ADR-004** (Contexte / Décision / Conséquences / Réactivation) :
- ADR « Télétransmission B2/SEFi/CNDA différée » — l'échéance du 31 mai 2026 pèse sur le taxi qui télétransmet, pas sur l'éditeur en bêta ; facturation V1.5 = PDF récapitulatif ; réactivation = phase dédiée quand un client réel facture.
- ADR « Portail B2B multi-tenant différé » — anti-construction avant product-market fit ; réactivation = décision business au 1er client payant.

(Un seul ADR couvrant les deux reports est acceptable si plus cohérent — au choix de l'exécutant, calqué ADR-004.)

### Livrable 7 — SUMMARY + STATE + CONCERNS

- `.planning/phases/06-facturation-securite-ci/06-SUMMARY.md` (NEW) — récap des 4 waves, success criteria du CONTEXT cochés, DEC inscrites, patterns méthodologiques, checklist UAT dirigeant, captures Visible Progress (`/admin/facturation`), items reportés.
- `.planning/STATE.md` (MODIFY) — `progress.completed_phases` 7 → 8, `completed_plans` +4, `percent` recalculé ; `status` / `stopped_at` / `last_activity` de clôture.
- `.planning/codebase/CONCERNS.md` (MODIFY) — marquer résolus : audit RLS systémique, audit Server Actions, dettes CI D1/D2/D3, advisors. Ajouter : hypothèse « facturable CGSS = transport_mode + exclusion paiement direct » (champ dédié `is_conventionne` si distinction fine un jour) ; piste « persister `PricingResult` » si décomposition par course demandée ; reliquat D3 éventuel.

---

## Critères GREEN

- `SERVER-ACTIONS-AUDIT.md` : 38 fichiers `'use server'` inventoriés, chaque action avec verdict guard / row count.
- Toutes les Server Actions admin : guard `require*` partagé en tête (DEC-040) ; toutes les `UPDATE`/`DELETE` : pattern DEC-041 row count. Plus de `requireX` local dupliqué.
- E2E error-path verts : une Server Action refuse une invocation cross-rôle / cross-org côté serveur.
- `ROADMAP.md` : Phase 06 resserrée + entrées 06.5 et 06.7 ajoutées (Phases + Phase Details).
- `PROJECT.md` : DEC-040 + DEC-063..067 inscrits LOCKED.
- 2 ADR (ou 1) de report créés, calqués ADR-004.
- `06-SUMMARY.md` complet ; `STATE.md` `completed_phases` 7 → 8 ; `CONCERNS.md` à jour.
- `pnpm typecheck` + `pnpm --filter @tap/web build` PASS. Preview Vercel verte, smoke Playwright vert.

---

## Risques + mitigations

- **Volume 38 Server Actions** : si la wave déborde, traiter par lot de modules (admin d'abord — c'est là que sont les trous T-04.5-27). L'inventaire d'abord, les correctifs par lot.
- **Régression guard** : ajouter un `require*` peut casser un flux légitime (ex. une action appelée par un rôle non prévu). Mitigation : vérifier chaque ajout contre le rôle réel attendu (la matrice RLS de PLAN-3 sert de référence croisée).
- **ROADMAP — numéros de phase** : 06.5 / 06.7 doivent s'insérer proprement dans la numérotation décimale existante (cohérent 04.5/04.7/04.9/05.5). Pas de renumérotation des phases existantes.
- **DEC déjà partiellement listées** : DEC-040 est une *candidate* dans CONCERNS — la promouvoir, ne pas créer de doublon de numéro.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Oublier la formalisation ROADMAP (verrou V7 — action en attente depuis le discuss et l'ui-spec).
- ❌ Traiter un `SECURITY DEFINER` ou un guard légitime comme un bug.
- ❌ Laisser un `requireX` local dupliqué (DEC-040 — helper partagé obligatoire).
- ❌ Inventer une UI pour cet audit (Bloc E sans surface).
- ❌ Réviser un DEC LOCKED existant (DEC-001..062) — seulement inscrire les nouveaux.
- ❌ Planifier la télétransmission B2/CNDA (différée — ADR de report).
- ❌ Appliquer les migrations via MCP (DEC-032 — CD push exclusif).
- ❌ Marquer la Phase 06 complète sans preview Vercel verte + walkthrough (CLAUDE.md § 13.5).
