# PLAN-3 — Wave 3 : DPA + DPIA + aide contextuelle + clôture

**Phase** : 06.6 Conformité assistée (pré-remplissage RGPD)
**Wave** : 3/3 — le reste, plus léger ; le poids de la phase est sur les Waves 1-2.
**Dépendances** : PLAN-1 et PLAN-2 mergés (réutilise le pattern revue-puis-insertion et le contenu en constantes).
**Estimation** : 3-4 h.
**Refs** : `06.6-CONTEXT.md` (D-04, D-05, D-06, D-13), `06.6-UI-SPEC.md` (§6 S4, §7 S5, §8 S6), migrations `dpa_record` / `dpia_record`, `CLAUDE.md` §9 / §11 / §13.5.

---

## Goal

Compléter la conformité assistée hors registre : pré-remplir les fiches DPA des sous-traitants techniques, proposer une trame squelette DPIA, enrichir l'aide contextuelle des pages vides par nature, puis clôturer la phase.

---

## Bloc A — DPA : revue des fiches sous-traitants

Même pattern revue-puis-insertion (D-04). **2 fiches** pré-saisies — sous-traitants techniques connus de TAP.

### Contenu (`dpa-prefill-content.ts`)

| `subprocessor_name` | `subprocessor_role` | `dpa_version` | `signed_at` | `notes` |
|---|---|---|---|---|
| Supabase | Hébergement de la base de données, authentification et stockage de fichiers | *(vide — à compléter)* | *(vide — à saisir)* | Sous-traitant technique. Joindre le DPA signé. Vérifier la localisation des données et le statut HDS (cf. Phase 06.5). |
| Vercel | Hébergement de l'application web (front-end) | *(vide — à compléter)* | *(vide — à saisir)* | Sous-traitant technique. Joindre le DPA signé. |

### Fichiers
- `apps/web/src/app/(admin)/admin/legal/dpa/_lib/dpa-prefill-content.ts` (NEW) — constante 2 fiches.
- `apps/web/src/app/(admin)/admin/legal/dpa/pre-remplir/page.tsx` (NEW) — Server Component `requireDirigeantPage()`, garde « 0 entrée DPA » → redirect sinon.
- `apps/web/src/app/(admin)/admin/legal/dpa/pre-remplir/_components/dpa-prefill-review.client.tsx` (NEW) — disclaimer D-07 + 2 cartes + bouton d'insertion.
- `apps/web/src/app/(admin)/admin/legal/dpa/_components/` état vide (MODIFY) — bouton « Pré-remplir les fiches sous-traitants » si 0 entrée.
- `apps/web/src/app/(admin)/admin/legal/dpa/actions.ts` (MODIFY) — `prefillDpaRecordsAction` : garde `requireDirigeant`, idempotence (refus si DPA non vide), insertion des fiches cochées.

### Contrainte schéma — champs NOT NULL saisis par le dirigeant
`dpa_record.signed_at` (date) **et** `dpa_record.dpa_version` (text) sont `NOT NULL`. La carte de revue les présente **vides et obligatoires, mis en évidence** : le dirigeant les saisit lui-même. TAP **décrit** la fiche, ne **valide pas** le contrat (D-04 / verrou V6). Insertion bloquée pour une fiche cochée dont `signed_at` ou `dpa_version` est vide — message sous le champ. `dpa_document_url` reste optionnel (hors pré-remplissage).

---

## Bloc B — DPIA : trame squelette

Déclenchée depuis l'état vide de `/admin/legal/dpia` (D-05). Écran de confirmation léger — la DPIA est éditable (policy UPDATE) et archivable (`status`), le risque est faible.

### Contenu (`dpia-prefill-content.ts`)

- `title` : « Analyse d'impact relative à la protection des données — transport de données de santé »
- `scope` : « Traitement des données de santé des patients dans le cadre du transport sanitaire conventionné (mobilité réduite, dialyse, TPMR) : recueil, planification, exécution et traçabilité des courses. »
- `risks_identified` : `[]` — **vide**. TAP n'émet **aucun verdict de risque** (D-05 / verrou V5).
- `mitigations` : `[]` — **vide**.
- `residual_risk_level` : `null` ; `cnil_consultation_required` : `false`.
- `reviewed_at` : pré-rempli à la date du jour (champ `NOT NULL`, éditable).
- `next_review_at` : pré-rempli à J+1 an (champ `NOT NULL`, éditable).
- `status` : `'brouillon'`.

### Fichiers
- `apps/web/src/app/(admin)/admin/legal/dpia/_lib/dpia-prefill-content.ts` (NEW) — constante de la trame.
- `apps/web/src/app/(admin)/admin/legal/dpia/_components/` état vide (MODIFY) — bouton « Créer une trame DPIA » si 0 entrée.
- `apps/web/src/app/(admin)/admin/legal/dpia/pre-remplir/page.tsx` (NEW) ou écran de confirmation léger — `title` + `scope` éditables, `reviewed_at` / `next_review_at` éditables (défauts pré-remplis), disclaimer rappelant que la trame ne contient aucun verdict de risque.
- `apps/web/src/app/(admin)/admin/legal/dpia/actions.ts` (MODIFY) — `prefillDpiaRecordAction` : garde `requireDirigeant`, insertion d'une trame `status = 'brouillon'`.

---

## Bloc C — Aide contextuelle breaches / requests / dpo

**Aucun pré-remplissage de données** (D-06 / verrou V6). Seul l'état vide reçoit un texte guide.

- `apps/web/src/app/(admin)/admin/legal/breaches/` (MODIFY) — état vide enrichi : « Cette page restera vide tant qu'aucune donnée patient n'aura fuité, été perdue ou volée — c'est une bonne nouvelle. En cas d'incident, déclarez-le ici : vous avez 72 h pour notifier la CNIL, et un compte à rebours vous accompagne. »
- `apps/web/src/app/(admin)/admin/legal/requests/` (MODIFY) — état vide enrichi : « Vous suivrez ici les demandes RGPD de vos patients (accès, rectification, effacement…). Une page vide signifie qu'aucune demande n'est en cours. Vous disposez de 30 jours pour répondre à chaque demande. »
- `apps/web/src/app/(admin)/admin/legal/dpo/` — `DpoForm` **existant, non refait** (verrou V6). Au plus, un état vide légèrement plus explicite si les champs `organizations.dpo_*` sont vides. Optionnel.

---

## Bloc D — Clôture de la phase

- `06.6-SUMMARY.md` — récap des 3 waves, 7 success criteria cochés, walkthrough script, captures Visible Progress. **Recommande explicitement une relecture du registre par un juriste ou le DPO avant de s'en prévaloir** (D-13 / verrou V3) — le pré-remplissage est un brouillon, pas une certification.
- `ROADMAP.md` — Phase 06.6 cochée `[x]` avec suffixe de livraison (l'entrée 06.6 a été ajoutée au ROADMAP par PR #158).
- `STATE.md` — `completed_phases` / `completed_plans` incrémentés ; prochaine étape.
- `CONCERNS.md` — résoudre l'item « Conformité assistée — pré-remplissage RGPD » ; reporter les pistes (fiche DPA fournisseur SMS quand choisi, assistant de rédaction des risques DPIA, indicateurs de complétude — cf. `06.6-CONTEXT.md` Deferred Ideas).
- DEC-068..070 (candidates du discuss) à promouvoir LOCKED dans `PROJECT.md`.
- Captures `docs/showcase/06.6-conformite-assistee/`.

---

## Approche test (CLAUDE.md §9)

- Pas de table nouvelle → pas de pgTAP. Pas de logique pure non triviale → pas de Vitest (les contenus sont des constantes, les actions des boucles d'insert — §9 interdit le Vitest sur Server Actions).
- L'E2E golden path de la Wave 2 couvre le mécanisme central. Wave 3 : extension légère possible du smoke preview pour vérifier que les pages `/admin/legal/dpa` et `/admin/legal/dpia` rendent leur bouton de pré-remplissage — sinon revue manuelle dirigeant.

---

## Critères de complétion (GREEN)

- DPA : sur 0 fiche, bouton de pré-remplissage → écran de revue 2 fiches ; `signed_at` et `dpa_version` vides obligatoires, insertion bloquée par fiche si manquants ; insertion des fiches cochées.
- DPIA : sur 0 entrée, bouton « Créer une trame DPIA » → trame `brouillon` insérée, `risks_identified` / `mitigations` vides, `reviewed_at` / `next_review_at` renseignés.
- breaches / requests : état vide enrichi d'un texte d'aide ; **aucune donnée fictive insérée**. dpo : `DpoForm` inchangé.
- `06.6-SUMMARY.md` rédigé, recommande la relecture juriste/DPO.
- `pnpm typecheck` PASS, `pnpm --filter @tap/web build` PASS. Fichiers ≤ 300 LOC, composants ≤ 150 LOC.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Pré-remplir `dpa_record.signed_at` ou `dpa_version` à la place du dirigeant (D-04 / V6).
- ❌ Faire émettre un verdict de risque par la trame DPIA — `risks_identified` / `mitigations` restent vides (D-05 / V5).
- ❌ Pré-remplir breaches ou requests avec des incidents / demandes fictifs (D-06 / V6).
- ❌ Refaire le `DpoForm` — il existe déjà (V6).
- ❌ Présenter le pré-remplissage comme une conformité certifiée — le SUMMARY recommande la relecture juriste/DPO (D-13 / V3).
- ❌ INSERT direct sans écran de revue / confirmation (D-02b / V2).
- ❌ Créer un test Vitest sur les Server Actions ou les constantes de contenu (CLAUDE.md §9).
