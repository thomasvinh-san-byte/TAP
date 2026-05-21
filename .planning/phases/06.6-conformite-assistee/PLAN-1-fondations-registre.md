# PLAN-1 — Wave 1 : Fondations registre (contenu juridique + champ partagé + action batch)

**Phase** : 06.6 Conformité assistée (pré-remplissage RGPD)
**Wave** : 1/3 — fondations. Prérequis des Waves 2 et 3.
**Dépendances** : aucune. `main` = #160.
**Estimation** : 3-5 h (la rédaction du contenu juridique est le poste principal).
**Refs** : `06.6-CONTEXT.md` (D-02b, D-03, D-08, D-11, D-12, D-13), `06.6-UI-SPEC.md` (§5 contenu, §9 composants), `CLAUDE.md` §6 / §9 / §11, `RLS-AUDIT.md` (registre append-only), `SERVER-ACTIONS-AUDIT.md` (DEC-040 guard).

---

## Goal

Poser les trois fondations que les Waves 2 et 3 consomment :
1. **`RegistreFields`** — fragment de champs extrait de `registre-drawer.client.tsx`, réutilisé par le drawer ET les cartes de revue (anti-divergence — verrou V4).
2. **`registre-prefill-content.ts`** — les 6 entrées-types du registre, contenu juridique affiné et sourcé. **Livrable rédactionnel central de la phase.**
3. **Server Action d'insertion en lot** — insère uniquement les entrées transmises (= cochées par le dirigeant), jamais d'INSERT direct non validé (D-02b).

---

## Le contenu des 6 entrées-types — `registre-prefill-content.ts`

Constantes typées, **zéro nom propre de personne** (NFR-001 / verrou V7). Chaque entrée renseigne les champs NOT NULL de `data_processing_register`. Les durées et bases ci-dessous sont **des suggestions sourcées sur des références publiques** — TAP ne certifie pas (D-13).

| # | `purpose` | `legal_basis` | `data_categories[]` | `data_subjects[]` | `recipients[]` | `retention_period_days` | `security_measures` |
|---|---|---|---|---|---|---|---|
| 1 | Planifier, affecter et exécuter les courses de transport sanitaire des patients | `contrat` | identité, coordonnées, adresses de prise en charge et destination, besoins de mobilité | patients | régulation, chauffeur affecté | **1095** (3 ans après la dernière course) | RLS multi-tenant, accès authentifié par rôle, journalisation `audit_logs` |
| 2 | Facturer les courses en tiers payant CGSS et tenir la comptabilité | `obligation_legale` | identité, NIR, prescriptions de transport, montants facturés | patients | CGSS, expert-comptable | **3650** (10 ans — pièces comptables) | NIR chiffré AES-256-GCM (clé hors base), RLS, `audit_logs` |
| 3 | Gérer les chauffeurs : embauche, habilitations, affectations | `contrat` | identité, coordonnées, permis, carte professionnelle, affectations | chauffeurs (salariés) | dirigeant, régulation | **1825** (5 ans après la fin du contrat) | RLS, accès restreint dirigeant/régulation, `audit_logs` |
| 4 | Adapter le transport aux besoins de santé du patient (mobilité réduite, dialyse, TPMR) | `mission_interet_public` | données de santé liées à la mobilité, notes opérationnelles médicales | patients | régulation, chauffeur affecté (besoin d'en connaître) | **1825** (5 ans en base active après la dernière intervention) | données de santé chiffrées applicatif, accès au besoin d'en connaître, RLS, `audit_logs` |
| 5 | Géolocaliser le véhicule pendant le service et gérer les adresses | `contrat` | position géographique du véhicule pendant le service, adresses | patients, chauffeurs | régulation | **90** (base chaude puis purge) | capture pendant le service uniquement, purge automatique 90 j, RLS |
| 6 | Recueillir et tracer le consentement aux cookies du site public | `consentement` | choix de consentement, hash de session, hash navigateur | visiteurs du site public | aucun (usage interne) | **395** (≈ 13 mois) | pseudonymisation par hachage, accès rôle de service, journalisation |

Tous : `international_transfer = false`, `international_transfer_safeguards = null`.

### Sourcing des durées (à reporter en commentaire dans le fichier)

- **Entrée 2 — 10 ans** : pièces comptables, Code de commerce art. L123-22 (conservation à compter de la clôture de l'exercice).
- **Entrée 3 — 5 ans** : délai de prescription prud'homale ; certaines pièces RH ont des durées propres — valeur à ajuster par le dirigeant.
- **Entrée 4 — 5 ans base active** : référentiel CNIL « traitements de données de santé hors recherche » (5 ans à compter de la dernière intervention, puis archivage intermédiaire selon les durées légales).
- **Entrée 5 — 90 j** : CNIL (géolocalisation des véhicules) — 2 mois par principe, jusqu'à 1 an pour la preuve des interventions / l'optimisation des tournées ; 90 j retenu (cohérent CLAUDE.md §6).
- **Entrées 1 — 3 ans** : durée de la relation (référentiel CNIL clients) — à confirmer.
- **Entrée 6 — 13 mois** : durée de vie maximale des cookies recommandée par la CNIL.

### Condition de l'art. 9-2 RGPD — entrée 4 (données de santé)

L'entrée 4 traite une **catégorie particulière** de données (santé). Le champ `legal_basis` ne porte que la base de l'art. 6 (`mission_interet_public`). La condition de levée de l'interdiction de l'art. 9-1 est **mentionnée en texte** dans `security_measures` (ou en fin de `purpose`), formulée comme **suggestion à valider**, jamais comme verdict :

> « Traitement nécessaire à la prise en charge sanitaire (condition de l'art. 9-2-h du RGPD — à confirmer avec votre conseil). »

Aucune affirmation définitive de TAP (D-13 / verrou V3).

---

## Fichiers à créer / modifier

### Champ partagé (2)
- `apps/web/src/app/(admin)/admin/legal/registre/_components/registre-fields.client.tsx` (NEW) — fragment présentationnel : les 8 champs du registre (`purpose`, `legal_basis` select des 6 valeurs enum, `data_categories`, `data_subjects`, `recipients`, `retention_period_days`, `security_measures`, `international_transfer`). Accepte des valeurs initiales en props (pour le pré-remplissage). Aucune logique de soumission — purement les champs.
- `apps/web/src/app/(admin)/admin/legal/registre/_components/registre-drawer.client.tsx` (MODIFY) — consommer `RegistreFields`. Comportement et rendu inchangés côté utilisateur ; objectif = source unique des champs.

### Contenu (1)
- `apps/web/src/app/(admin)/admin/legal/registre/_lib/registre-prefill-content.ts` (NEW) — constante `REGISTRE_PREFILL_ENTRIES` : 6 objets typés (voir tableau ci-dessus). Commentaire de sourcing par durée. Type partagé `RegistreEntryInput` aligné sur `dataProcessingRegisterSchema` de `@tap/shared`.

### Server Action insertion en lot (1)
- `apps/web/src/app/(admin)/admin/legal/registre/actions.ts` (MODIFY) — ajouter `prefillDataProcessingRegisterAction(entries: RegistreEntryInput[])` :
  - Garde `requireDirigeant()` (DEC-040) — sinon `{ error: 'Action réservée au dirigeant.' }`.
  - **Idempotence forte (D-09)** : compter les lignes `data_processing_register` de l'organisation ; si > 0, refuser (`{ error: 'Le registre contient déjà des entrées.' }`). Empêche un double pré-remplissage même avec deux onglets ouverts.
  - Valider **chaque** entrée reçue via `dataProcessingRegisterSchema` (réutilise la validation existante) ; rejeter le lot si une entrée est invalide.
  - INSERT des seules entrées reçues (= cochées par le dirigeant — D-02b). `created_by` / `updated_by` = dirigeant. Boucle d'`insert` ou `insert` multi-lignes.
  - `revalidatePath('/admin/legal/registre')`. Retour `{ success: true, inserted: N }`.
  - L'`audit_logs` est écrit automatiquement par le trigger `data_processing_register_audit_trigger` (D-11) — aucun code d'audit à ajouter.

---

## Approche test (CLAUDE.md §9)

- **Aucun nouveau test unitaire.** Pas de table nouvelle → pas de pgTAP. CLAUDE.md §9 interdit explicitement le Vitest sur les Server Actions ; `registre-prefill-content.ts` est une constante (tester une constante = anti-pattern §9). La validation de chaque entrée passe par `dataProcessingRegisterSchema` déjà testé en amont.
- Le comportement de l'action (insère seulement les entrées cochées, garde dirigeant, idempotence) est couvert par l'**E2E golden path de la Wave 2**.

---

## Critères de complétion (GREEN)

- `RegistreFields` existe ; `registre-drawer` le consomme ; le drawer de création unitaire fonctionne à l'identique (champs, validation, soumission inchangés).
- `registre-prefill-content.ts` exporte les 6 entrées-types, valeurs conformes au tableau, sourcing en commentaire, zéro nom propre.
- `prefillDataProcessingRegisterAction` : garde dirigeant, refus si registre non vide, insertion des seules entrées reçues.
- `pnpm typecheck` PASS, `pnpm --filter @tap/web build` PASS. Chaque fichier ≤ 300 LOC, composant ≤ 150 LOC.

---

## Anti-patterns / NE PAS FAIRE

- ❌ INSERT direct des 6 entrées sans passer par les entrées transmises (cochées) — registre append-only (D-02b / V2).
- ❌ Réinventer les champs du registre — extraire `RegistreFields`, ne pas dupliquer (V4).
- ❌ Présenter le contenu comme une conformité certifiée (D-13 / V3).
- ❌ Mettre un nom propre de personne dans le contenu (NFR-001 / V7).
- ❌ Ajouter du code d'audit — le trigger BDD s'en charge (D-11).
- ❌ Créer un test Vitest sur la Server Action ou sur la constante de contenu (CLAUDE.md §9).
