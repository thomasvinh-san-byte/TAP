# PLAN-2 — Wave 2 : Écran de revue du registre (le cœur)

**Phase** : 06.6 Conformité assistée (pré-remplissage RGPD)
**Wave** : 2/3 — la pièce maîtresse de la phase.
**Dépendances** : PLAN-1 mergé (`RegistreFields`, `registre-prefill-content.ts`, `prefillDataProcessingRegisterAction`).
**Estimation** : 3-4 h.
**Refs** : `06.6-CONTEXT.md` (D-02b, D-07, D-08, D-09), `06.6-UI-SPEC.md` (§3 S1, §4 S2, §10 états), `CLAUDE.md` §9 / §11 / §13.5.

---

## Goal

Livrer le parcours « revue puis insertion » du registre : depuis l'état vide, le dirigeant déclenche le pré-remplissage, relit/édite/écarte les 6 entrées-types sur un écran de revue, et insère **uniquement** celles qu'il a validées. C'est la matérialisation de D-02b (jamais d'INSERT direct — le registre est append-only).

---

## Fichiers à créer / modifier

### Déclencheur état vide (1)
- `apps/web/src/app/(admin)/admin/legal/registre/_components/registre-list.client.tsx` (MODIFY) — enrichir la branche `entries.length === 0` : bloc d'amorçage (icône `FileText`, court texte « Votre registre est vide… ») + bouton primaire **« Pré-remplir avec les traitements types »** (lien vers `/admin/legal/registre/pre-remplir`) + le bouton « Créer une entrée manuellement » existant conservé. Visible **uniquement** si 0 entrée (D-09) — la branche non-vide reste la table inchangée.

### Page écran de revue (3)
- `apps/web/src/app/(admin)/admin/legal/registre/pre-remplir/page.tsx` (NEW) — Server Component, `requireDirigeantPage()`. **Garde d'idempotence** : compter les entrées du registre ; si > 0, `redirect('/admin/legal/registre')` (D-09 — l'écran de revue n'existe que pour un registre vide). Sinon rend `<RegistrePrefillReview>` avec `REGISTRE_PREFILL_ENTRIES`.
- `apps/web/src/app/(admin)/admin/legal/registre/pre-remplir/_components/registre-prefill-review.client.tsx` (NEW) — `'use client'`. Disclaimer D-07 en tête (bandeau `AlertTriangle`, ton sobre), texte « 6 entrées proposées — décochez celles à ne pas insérer », liste des 6 `RegistrePrefillCard`, barre d'action en bas (`Annuler` + `Insérer les N entrées cochées`). État local : la valeur courante de chaque entrée + la case « inclure ». Sur soumission : collecte les entrées cochées, appelle `prefillDataProcessingRegisterAction`, gère `pending` (`useTransition`), succès → `router.push('/admin/legal/registre')`, erreur → message sobre.
- `apps/web/src/app/(admin)/admin/legal/registre/pre-remplir/_components/registre-prefill-card.client.tsx` (NEW) — `'use client'`. En-tête = case à cocher « inclure » + numéro + intitulé court ; corps = `RegistreFields` pré-rempli et éditable. Décochée → corps grisé/réduit, valeurs non transmises.

### Disclaimer (texte D-07)

Bandeau en tête de l'écran de revue, **avant** les cartes :

> « Ces entrées sont des suggestions adaptées au transport sanitaire. Vérifiez et personnalisez chacune selon votre activité réelle. Vous restez responsable de leur exactitude et de leur mise à jour. Ceci ne constitue pas un conseil juridique. »

---

## États (UI-SPEC §10)

| État | Rendu |
|---|---|
| Registre vide | `registre-list` affiche le bloc d'amorçage + bouton « Pré-remplir » |
| Registre non vide | Table des entrées ; le déclencheur a disparu (D-09) |
| Écran de revue | Disclaimer + 6 cartes éditables ; bouton d'insertion actif si ≥ 1 cochée |
| Aucune entrée cochée | Bouton d'insertion désactivé (`aria-disabled`) |
| Insertion (pending) | Bouton en état `pending`, cartes non modifiables |
| Succès | Redirection vers `/admin/legal/registre` peuplé |
| Erreur | Message `text-destructive` sobre ; rien d'inséré si l'action échoue ; réessai possible |
| Accès direct `/pre-remplir` avec registre non vide | `redirect` vers la liste (garde page) |

---

## E2E golden path (Playwright)

`apps/web/tests/e2e/phase-06.6-prefill-registre.spec.ts` (NEW) — **le test canonique de la phase** (CLAUDE.md §9 / ADR-003 : 1 E2E golden path) :

1. Login démo dirigeant, aller sur `/admin/legal/registre` (registre vide).
2. Cliquer « Pré-remplir avec les traitements types » → arrive sur `/admin/legal/registre/pre-remplir`.
3. Vérifier la présence du disclaimer et des 6 cartes.
4. Décocher une entrée (ex. entrée 6 cookies).
5. Cliquer « Insérer les 5 entrées cochées ».
6. Retour sur `/admin/legal/registre` : la table contient **5** entrées, pas 6 ; l'entrée décochée est absente.
7. Vérifier que le bloc « Pré-remplir » a disparu (registre non vide — D-09).

Le smoke preview existant reste vert (pas de régression).

---

## Critères de complétion (GREEN)

- Sur un registre vide, le bouton « Pré-remplir » est visible ; sur un registre peuplé, il est absent.
- `/admin/legal/registre/pre-remplir` accessible dirigeant uniquement ; redirige si le registre n'est pas vide.
- L'écran de revue affiche le disclaimer en tête + 6 cartes éditables ; on peut éditer et décocher.
- L'insertion n'écrit que les entrées cochées ; les décochées n'apparaissent jamais au registre.
- Après insertion, redirection vers la liste peuplée ; pas de flag « suggéré » sur les entrées (D-08).
- E2E `phase-06.6-prefill-registre` vert ; smoke preview vert.
- `pnpm typecheck` PASS, `pnpm --filter @tap/web build` PASS. Fichiers ≤ 300 LOC, composants ≤ 150 LOC.

---

## Risques + mitigations

- **6 cartes-formulaires sur une page = composant volumineux** : `RegistrePrefillReview` orchestre, `RegistrePrefillCard` porte le détail → chaque fichier ≤ 150 LOC. Si `RegistrePrefillReview` approche la limite, extraire la barre d'action.
- **Double soumission (deux onglets)** : la garde page (registre non vide → redirect) + la garde de l'action (refus si registre non vide, PLAN-1) couvrent le cas. Défense en profondeur.
- **Perte de saisie si erreur réseau** : l'état local des cartes est conservé tant que la page n'est pas quittée — l'erreur n'efface pas les éditions.

---

## Anti-patterns / NE PAS FAIRE

- ❌ INSERT direct au clic « Pré-remplir » sans passer par l'écran de revue (D-02b / V2).
- ❌ Afficher le bouton « Pré-remplir » sur un registre non vide (D-09 / V9).
- ❌ Placer le disclaimer après les cartes ou l'omettre (D-07 / V8).
- ❌ Persister un flag « suggéré » sur les entrées insérées (D-08).
- ❌ `useEffect` pour charger les entrées-types — elles viennent de la constante `registre-prefill-content.ts` (Server Component).
- ❌ Dupliquer les champs du registre — utiliser `RegistreFields` (V4).
- ❌ framer-motion (NFR-004).
