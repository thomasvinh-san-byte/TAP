---
phase: 04.5
plan: 2
plan_number: 2
slug: qualite-saisie-patient
type: execute
status: draft
estimated_hours: 3
wave: 2
depends_on: ["1"]
files_modified:
  - packages/shared/src/validators/patient.ts
  - packages/shared/src/validators/common.ts
  - packages/shared/src/constants/villes-974.ts
  - packages/shared/src/utils/nir-checksum.ts
  - packages/shared/src/utils/nir-checksum.test.ts
  - apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
  - apps/web/tests/e2e/patient-form-validation.spec.ts
autonomous: true
requirements:
  - NFR-006
  - PAT-01
  - PAT-02
  - CONCERNS-UAT-F3
  - CONCERNS-UAT-F4
decisions_implemented:
  - D-04
  - D-05
  - D-06
  - D-07
  - DEC-036
tags:
  - validation
  - patient
  - rgpd
  - ui-masks
must_haves:
  truths:
    - "Un NIR à 15 chiffres avec clé contrôle invalide est refusé à la saisie avec message explicite"
    - "Un téléphone métropole (06/07/02) est refusé avec message FR sans jargon"
    - "Une date de naissance avec âge < 0 ou > 130 ans est refusée"
    - "Une ville hors liste 24 communes 974 est refusée (refus saisie libre)"
    - "Un code postal saisi avec 5 chiffres déclenche auto-complétion ville si match exact"
    - "Un nom contenant des chiffres ou symboles est refusé"
    - "Le DatePicker FR JJ/MM/AAAA remplace l'input type=date natif"
  artifacts:
    - path: "packages/shared/src/constants/villes-974.ts"
      provides: "Liste fermée 24 communes INSEE 974 + mapping CP→Ville dominante"
    - path: "packages/shared/src/utils/nir-checksum.ts"
      provides: "Fonction pure computeNirChecksum + isNirChecksumValid (algo INSEE, Corse 2A/2B)"
    - path: "packages/shared/src/validators/patient.ts"
      provides: "Schémas Zod étendus : clé NIR, range âge, regex nom, enum villes"
    - path: "apps/web/src/app/(app)/patients/_components/patient-form.client.tsx"
      provides: "UI masques DatePicker + NIR + Téléphone + CP + Ville"
    - path: "apps/web/tests/e2e/patient-form-validation.spec.ts"
      provides: "E2E 7 scénarios validation patient"
  key_links:
    - from: "packages/shared/src/utils/nir-checksum.ts"
      to: "patient.ts schéma Zod"
      via: "refine nir → isNirChecksumValid(value)"
      pattern: "refine.*isNirChecksumValid"
    - from: "apps/web/src/app/(app)/patients/_components/patient-form.client.tsx"
      to: "villes-974.ts constante"
      via: "z.enum(VILLES_974) + select shadcn fermé"
      pattern: "VILLES_974"
    - from: "patient-form.client.tsx"
      to: "react-datepicker (Phase 03.2 réutilisation)"
      via: "DatePicker locale fr + format JJ/MM/AAAA"
      pattern: "registerLocale.*fr|locale=\"fr\""
---

<objective>
T2 — Qualité saisie patient : verrouiller la qualité des données patient à la source par des masques structuraux UI + des schémas Zod étendus (clé contrôle NIR, range âge, enum villes 974, regex nom), en rebaptisant tous les messages d'erreur en FR sans jargon (DEC-030).

Purpose : éliminer 5 frictions UAT 2026-05-14 (NIR 20 caractères accepté, date 30/02 acceptée, téléphone US accepté, ville libre acceptée, message d'erreur dev). Cible RGPD données santé : refuser une donnée patient invalide est moins coûteux qu'une fiche fantôme à corriger plus tard.

Output : 1 nouvelle constante (villes-974), 1 nouvel util pur testé (nir-checksum), 2 fichiers validators étendus, 1 formulaire patient refondu côté UI, 1 test E2E couvrant 7 scénarios.

Audit codebase : ~80 % des schémas Zod existent déjà dans `packages/shared/src/validators/` (telephoneReunionSchema, nirFormatSchema, codePostalReunionSchema). Le travail réel = compléter (clé NIR + enum villes + range âge + regex nom) et refondre l'UI.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md
@.planning/phases/04.5-robustesse-regulateur/04.5-UI-SPEC.md
@.planning/UI-PATTERNS.md
@.planning/codebase/CONCERNS.md

# Schémas Zod existants à étendre
@packages/shared/src/validators/patient.ts
@packages/shared/src/validators/common.ts

# Formulaire patient à refondre côté UI
@apps/web/src/app/(app)/patients/_components/patient-form.client.tsx

# Pattern react-datepicker FR à réutiliser (Phase 03.2)
@apps/web/src/app/(app)/courses/_components/date-time-fields.client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 2.1 — Constantes + util NIR + extensions schémas Zod</name>
  <files>
    packages/shared/src/constants/villes-974.ts,
    packages/shared/src/utils/nir-checksum.ts,
    packages/shared/src/utils/nir-checksum.test.ts,
    packages/shared/src/validators/patient.ts,
    packages/shared/src/validators/common.ts
  </files>
  <action>
Per D-04, A-01, A-02. Étape backend pure : créer les constantes + util + étendre les schémas Zod. Aucune UI ici.

⚠️ Note time-cap : algo NIR clé contrôle peut prendre jusqu'à 1 h (spike 30 min INSEE + impl + tests 100 % branch). Tâche entière estimée 1.5 h (au seuil ⚠️) mais découpe non recommandée — les 3 fichiers (constants + utils + validators) sont étroitement couplés.

**Fallback time-box (W5 checker)** : si après 1 h l'algo NIR clé contrôle n'est pas testé GREEN avec couverture 100 % branch, basculer en **mode dégradé** :
  1. `isNirChecksumValid(nir: string): boolean` retourne `true` par défaut (refine Zod `.refine(() => true, ...)` permissive)
  2. Validation déléguée à l'Edge Function `nir-encrypt` côté serveur (rejet tardif moins UX-friendly mais pas bloquant)
  3. Documenter la dette dans `.planning/codebase/CONCERNS.md` section nouvelle « Phase 04.5 — NIR clé contrôle livrée en mode dégradé »
  4. Livrer le reste de Task 2.1 (villes 974 enum, regex nom/prénom, range âge) sans bloquer la phase
  5. Ouvrir issue future « Phase 04.5-bis ou 04.7 : implémenter algo NIR INSEE complet avec gestion Corse 2A/2B »
Ce fallback préserve le time-cap V6 (1.5 h ⚠️ → max 1.5 h strict) sans casser le pipeline.

Étapes :

1. **Créer `packages/shared/src/constants/villes-974.ts`** :
   - Exporter `VILLES_974: readonly string[]` avec exactement 24 communes INSEE officielle (référence : insee.fr code département 974). Liste : Saint-Denis, Saint-Paul, Saint-Pierre, Le Tampon, Saint-André, Saint-Louis, Saint-Benoît, Le Port, Saint-Joseph, Saint-Leu, Sainte-Marie, La Possession, Sainte-Suzanne, Bras-Panon, Petite-Île, Saint-Philippe, Les Avirons, L'Étang-Salé, Cilaos, Salazie, Entre-Deux, La Plaine-des-Palmistes, Sainte-Rose, Trois-Bassins.
   - Exporter `CP_TO_VILLE_DOMINANTE: Readonly<Record<string, string>>` mapping CP 5 chiffres → ville dominante (ex: '97400' → 'Saint-Denis', '97410' → 'Saint-Pierre', '97430' → 'Le Tampon'). Couvrir au moins les 12 CP les plus fréquents 974.
   - Pas de typage `as const` global qui ferait perdre la lecture runtime — utiliser `Object.freeze` ou simple `const` typé.

2. **Créer `packages/shared/src/utils/nir-checksum.ts`** :
   - Exporter `computeNirChecksum(nir15: string): number` qui implémente l'algo INSEE officiel : prendre les 13 premiers chiffres (sexe + année + mois + département + commune + ordre), traiter les départements Corse `2A → 19`, `2B → 18` (remplacement caractère par chiffre avant calcul), calculer `97 − (N mod 97)` où N = entier des 13 premiers chiffres traités.
   - Exporter `isNirChecksumValid(nir15: string): boolean` qui vérifie : 15 caractères, 13 premiers en chiffres ou 2A/2B en pos 6-7, 2 derniers = clé attendue.
   - Gestion robuste : retourner `false` (jamais throw) pour entrée invalide structurelle. Ne JAMAIS logger l'entrée (RGPD — NIR data santé).

3. **Créer `packages/shared/src/utils/nir-checksum.test.ts`** (Vitest 100 % branch coverage) :
   - Cas valides (4) : `1 76 05 25 974 001 12` (homme né 1976 mai 25 Réunion), `2 85 03 75 056 042 65` (femme métropole), un cas Corse 2A, un cas Corse 2B.
   - Cas invalides (5) : clé fausse (off-by-one), 14 chiffres, 16 chiffres, lettres autres que 2A/2B aux positions 6-7, entrée vide.
   - Bénéficier de la grille Wikipedia/INSEE pour cross-check (cas réels publics, pas de PII).

4. **Étendre `packages/shared/src/validators/patient.ts`** :
   - Sur `nirFormatSchema` existant (regex `^[12][0-9]{14}$`) : ajouter `.refine(isNirChecksumValid, { message: 'La clé de contrôle du NIR est invalide. Vérifiez la saisie.' })`.
   - Sur `date_naissance` existant : ajouter `.refine((d) => { const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000); return age >= 0 && age <= 130; }, { message: 'Date invalide. Format attendu : JJ/MM/AAAA, âge entre 0 et 130 ans.' })`.
   - Ajouter à `nom` et `prenom` (existant min/max) : `.regex(/^[A-Za-zÀ-ÿ\s'-]+$/, { message: 'Lettres uniquement (accents, tirets et apostrophes autorisés).' })`.
   - Sur le sous-schéma `adresse` : remplacer la string libre `ville` par `z.enum(VILLES_974)` importé depuis `../constants/villes-974`. Si le schéma adresse n'a pas encore `ville`, créer le champ.
   - Reformuler les messages d'erreur existants (telephone, code_postal) en respectant DEC-030 (FR sans jargon, exemple inline, guillemets `«»` à la place des doubles quotes — voir copy ci-dessous depuis UI-SPEC).

5. **Étendre `packages/shared/src/validators/common.ts`** :
   - Si `codePostalReunionSchema` est défini ici, ajouter helper exporté `cpDominantVille(cp: string): string | null` qui lit `CP_TO_VILLE_DOMINANTE`.

Messages d'erreur consolidés (depuis UI-SPEC § Copywriting Contract — strict) :
- NIR format : « Le NIR doit comporter 15 chiffres : sexe, année, mois, département, commune, ordre, clé. Exemple : 1 76 05 25 974 001 12. »
- NIR clé : « La clé de contrôle du NIR est invalide. Vérifiez la saisie. »
- Téléphone : « Le numéro doit commencer par 0262, 0263, 0692 ou 0693 (10 chiffres). »
- Date naissance : « Date invalide. Format attendu : JJ/MM/AAAA, âge entre 0 et 130 ans. »
- Code postal : « Code postal Réunion : 974 + 2 chiffres (ex : 97400). »
- Ville : « Sélectionnez une commune dans la liste (24 communes Réunion). »
- Nom/prénom : « Lettres uniquement (accents, tirets et apostrophes autorisés). »

Hors scope explicite :
- Pas de modification du chiffrement NIR Edge Function (déjà livré Phase 1)
- Pas de modification du hash NIR pour recherche fuzzy (déjà livré Phase 1)
- Pas de migration BDD (les contraintes restent applicatives Zod, table `patients` inchangée)

Threat model ASVS L1 :
- T-04.5-04 (SQL Injection via ville libre) : Mitigée par `z.enum(VILLES_974)` — refus saisie hors liste + cast côté serveur avec prepared statements existants Supabase.
- T-04.5-05 (PII Disclosure — NIR loggué) : Mitigée par règle absolue dans `nir-checksum.ts` : `try/catch` sans logger l'entrée. Aucun `console.log(nir)`.
- T-04.5-06 (Algo NIR brute force) : Acceptée (validation côté client est UX, validation finale RLS côté serveur via trigger reste). Le NIR clé contrôle évite les saisies typo, pas un mécanisme de sécurité.
  </action>
  <verify>
    <automated>cd packages/shared && pnpm vitest run src/utils/nir-checksum.test.ts --coverage</automated>
    <automated>cd packages/shared && pnpm tsc --noEmit</automated>
    Couverture branch : 100 % attendu sur `nir-checksum.ts` (DEC-013 esprit — algo critique data santé).
  </verify>
  <done>
    - `villes-974.ts` exporte 24 communes + mapping CP dominante
    - `nir-checksum.ts` 100 % branch coverage Vitest, jamais throw, jamais log entrée
    - Schémas Zod patient refusent : NIR clé invalide, âge > 130, ville hors liste, nom avec chiffres
    - Messages d'erreur DEC-030 conformes (FR, exemple inline, guillemets `«»` si reformulation)
  </done>
  <rollback>
    `git revert` du commit validators. Les schémas existants pré-extension restent fonctionnels (ne briser pas l'API en place).
  </rollback>
</task>

<task type="auto">
  <name>Task 2.2 — UI masques formulaire patient (DatePicker + NIR + Téléphone + CP + Ville)</name>
  <files>
    apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
  </files>
  <action>
Per D-05, D-06, UI-SPEC Surface B. Refondre le formulaire patient côté UI pour appliquer les masques visuels stricts. Aucune modif des schémas Zod (faits en Task 2.1) — uniquement intégration UI.

Étapes :

1. **DatePicker FR** sur `date_naissance` :
   - Remplacer `<input type="date">` natif par `react-datepicker` (déjà importé Phase 03.2 dans `date-time-fields.client.tsx` — copier la config `registerLocale('fr', fr)` et `dateFormat="dd/MM/yyyy"`).
   - Wrapper avec `<Label>` shadcn + icône `Calendar` Lucide à droite (cliquable pour ouvrir picker).
   - Placeholder « JJ/MM/AAAA » visible.
   - Hauteur input 40 px (h-10 shadcn).

2. **Input NIR masque progressif** :
   - Wrapper personnalisé : afficher visuellement `X 00 00 00 000 000 00` avec espaces non-saisis. Implémentation : `useState` valeur brute (string 15 chiffres max) + dérivé d'affichage avec `format()` qui insère les espaces. `onChange` strip les espaces avant push state.
   - Indicateur clé contrôle à droite du champ :
     - 0-13 caractères : icône `CircleDashed` (Lucide, `text-muted-foreground`)
     - 14 caractères : `CircleDashed` (en attente clé)
     - 15 caractères + `isNirChecksumValid(value) === true` : `CheckCircle2` (`text-success`)
     - 15 caractères + invalide : `XCircle` (`text-destructive`)
   - Helper text caption muted par défaut : « 15 chiffres : sexe + année + mois + département + commune + ordre + clé. »
   - `autocomplete="off"`, `inputMode="numeric"`, max 240 px largeur, `font-variant-numeric: tabular-nums`.
   - RGPD : pas de `console.log(value)`, pas de `data-*` attribut contenant le NIR.

3. **Input Téléphone masque** :
   - Format affichage `0X XX XX XX XX` (espaces visuels, valeur brute 10 chiffres au state).
   - `inputMode="tel"`, max 200 px largeur, `font-variant-numeric: tabular-nums`.
   - Helper caption : « Fixe Réunion ou mobile Réunion. »
   - Pas de changement de schéma (A-03 verrouillé, schéma existant `telephoneReunionSchema` conservé).

4. **Code Postal + Ville (auto-complétion liée)** :
   - Layout : `grid grid-cols-[120px_1fr] gap-12`.
   - **Code postal** : préfixe `974` rendu en `<span className="bg-muted text-muted-foreground px-8 py-6 border border-r-0 rounded-l-md">974</span>` collé à un `<Input>` `maxLength={2}` `inputMode="numeric"` ne acceptant que `[0-9]`. Valeur brute envoyée au schéma = `'974' + 2 chiffres` (concaténation transparente).
   - **Ville** : `<Select>` shadcn avec `<SelectContent>` listant `VILLES_974`. Filtrer par recherche fuzzy via `Command` shadcn ou simple filter `input` Combobox (selon convention repo).
   - **Auto-complétion** : `useEffect` ou onChange CP : si `cp.length === 5` et `CP_TO_VILLE_DOMINANTE[cp]` existe, setter `ville` automatiquement. La régulatrice peut toujours override en re-cliquant le Select.

5. **Nom + Prénom** :
   - `grid grid-cols-2 gap-12`.
   - CSS `text-transform: capitalize` sur l'input visuel uniquement (className Tailwind `capitalize`). Valeur state inchangée (la transformation Zod si nécessaire est en Task 2.1).
   - Messages d'erreur inline reformulés (Task 2.1 fournit le texte).

6. **Pattern erreur inline unifié** (UI-SPEC Surface B § « Pattern erreur inline ») :
   - Chaque champ : `<div className="space-y-8"><Label/><Input aria-invalid={!!error} aria-describedby={error ? `${id}-error` : `${id}-help`} className={cn(error && 'border-destructive focus-visible:ring-destructive')}/>{!error && <p id="${id}-help" className="text-xs text-muted-foreground">{helper}</p>}{error && <p id="${id}-error" className="text-xs text-destructive" role="alert">{error}</p>}</div>`
   - Helper et erreur jamais simultanés.

7. **A11y** :
   - DatePicker : `aria-label="Date de naissance"`.
   - NIR indicateur : doubler par `aria-live="polite"` sur le helper text qui change de texte « Format complet » / « Clé valide » / « Clé invalide » (sinon discrimination non-voyants).
   - CP / Ville : `aria-describedby` pointe sur l'helper du couple.

Hors scope explicite :
- Pas de tooltip (verrou UI-SPEC — helper text suffit).
- Pas de modification des préférences communication (section conservée telle quelle, hors périmètre 04.5).
- Pas de modification du champ adresse (refondu en PLAN-3 Task 3.2 via `AddressOrPOIPicker`).

Threat model ASVS L1 :
- T-04.5-07 (XSS via valeur NIR injectée dans helper) : Mitigée par React rendering — les valeurs dans `text-xs text-destructive` proviennent uniquement de Zod messages constants (pas d'interpolation `{value}`).
- T-04.5-08 (Clickjacking DatePicker overlay) : Mitigée par `react-datepicker` z-index respecté + CSP existant Vercel.
- T-04.5-09 (PII Leak via aria-live NIR) : Mitigée par message générique « Clé valide » / « Clé invalide » — jamais le NIR lui-même n'est annoncé.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(app\\)/patients</automated>
    Manual sur preview Vercel : ouvrir Sheet patient, vérifier les 5 masques (DatePicker FR, NIR avec indicateur, Téléphone, CP+Ville auto-complétion, Nom regex).
  </verify>
  <done>
    - DatePicker FR JJ/MM/AAAA fonctionnel (calendrier ouvrable, locale fr)
    - NIR avec indicateur clé visuel (3 états) + masque progressif
    - Téléphone masque visuel `0X XX XX XX XX`
    - Code postal préfixe disabled, 2 chiffres saisissables
    - Ville Select fermé 24 communes, auto-complété si CP match dominant
    - Nom/Prénom capitalize CSS
    - Helper text DEC-030 conforme sous chaque champ par défaut
    - Erreur inline `text-xs text-destructive` après blur/submit
  </done>
  <rollback>
    `git revert` du commit UI. Les valeurs brutes envoyées au schéma Zod restent identiques (séparation stricte état brut / affichage formaté).
  </rollback>
</task>

<task type="auto">
  <name>Task 2.3 — Test E2E patient-form-validation (7 scénarios)</name>
  <files>
    apps/web/tests/e2e/patient-form-validation.spec.ts
  </files>
  <action>
Per D-07. Nouveau fichier Playwright E2E couvrant les 7 scénarios documentés en CONTEXT.md (UAT 2026-05-14).

Étapes :

1. **Setup** : `loginAs(page, 'regulateur')` (helper existant), naviguer sur `/patients`, cliquer « Nouveau patient » pour ouvrir le Sheet.

2. **Scénarios** (7 tests `test('...', async ({ page }) => { ... })`) :
   - **S1 — Nom avec chiffres refusé** : saisir « John123 » dans nom, blur, assert erreur inline `text-destructive` contient « Lettres uniquement ».
   - **S2 — NIR 20 caractères refusé** : tenter de saisir 20 chiffres dans NIR, assert que le state ne dépasse pas 15 (maxLength côté composant) ET assert que la submit déclenche erreur clé contrôle si les 15 ne valident pas.
   - **S3 — Date 30/02 refusée** : ouvrir DatePicker, naviguer à février, vérifier que 30/02 n'est pas cliquable (DatePicker FR refuse nativement). Alternativement, saisir manuellement « 30/02/1990 » et assert refus.
   - **S4 — Téléphone US refusé** : saisir « +1 555 123 4567 », blur, assert erreur « Le numéro doit commencer par 0262, 0263, 0692 ou 0693 ».
   - **S5 — Code postal métropole refusé** : tenter de saisir CP commençant par autre chose que `974` — impossible UI-side (préfixe disabled). Vérifier que le champ n'accepte que 2 chiffres après le préfixe.
   - **S6 — Adresse hors BAN libre** : (S6 testée en PLAN-3 Task 3.4, ici NO-OP ou skip avec `test.fixme`).
   - **S7 — Submit valide** : remplir tous les champs avec valeurs valides (Hoarau Patrick, 1 76 05 25 974 001 12 ou clé recalculée, 0262 21 90 00, 97400 Saint-Denis, date 1976-05-25, etc.), assert Sheet se ferme + toast succès + nouveau patient visible dans la liste.

3. **Cleanup** : si S7 crée un patient, le supprimer en fin de test (Supabase service_role helper de test). V1 acceptable non-idempotent avec `test.skip` explicite si patient déjà existant.

Hors scope explicite :
- Pas de test sur le chiffrement NIR (déjà couvert tests Phase 1 Deno).
- Pas de test perf (< 30 s, etc.) — réservé aux smoke E2E.
- Pas de test multi-browser (Chrome only V1 — DEC `playwright.config.ts` existant).

Threat model ASVS L1 :
- T-04.5-10 (Test bypass auth via direct URL) : Mitigée par `loginAs` helper qui passe par /login réel + cookies session.
- T-04.5-11 (Test leak NIR fictif réel) : Acceptée — le NIR test `1 76 05 25 974 001 12` (homme né 1976 mai 25 Saint-Denis ordre 001) est public dans les exemples INSEE. Pas un vrai NIR d'un vrai patient.
  </action>
  <verify>
    <automated>cd apps/web && pnpm playwright test tests/e2e/patient-form-validation.spec.ts</automated>
    Doit être GREEN en CI cloud sur push (CLAUDE.md § 13.5 — preview = canonical).
  </verify>
  <done>
    - 7 scénarios test couvrent les 7 frictions UAT
    - GREEN sur preview Vercel cloud (pas sandbox-blocked)
    - Cleanup BDD si non-idempotent OU skip explicite avec raison
  </done>
  <rollback>
    `git revert` du test file. Aucun impact production (test only).
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action `createPatient` | Saisie patient (NIR PII data santé) traverse vers BDD Supabase |
| Schéma Zod client → Schéma Zod serveur | Double validation (defense in depth) |
| react-datepicker → state React | Date utilisateur convertie en ISO string |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-04 | Tampering | Ville libre saisie | mitigate | `z.enum(VILLES_974)` côté Zod + Select fermé UI |
| T-04.5-05 | Information Disclosure | NIR loggué côté client | mitigate | `nir-checksum.ts` ne logge jamais l'entrée, pas de `console.log(nir)` |
| T-04.5-06 | Spoofing | Algo NIR brute force | accept | Validation client = UX, validation finale RLS/trigger reste |
| T-04.5-07 | Tampering | XSS via helper text | mitigate | Messages Zod constants, pas d'interpolation valeur user |
| T-04.5-08 | Tampering | Clickjacking DatePicker | mitigate | CSP Vercel existant, z-index react-datepicker |
| T-04.5-09 | Information Disclosure | aria-live NIR | mitigate | Annonce « Clé valide / invalide » uniquement, jamais le NIR |
| T-04.5-10 | Spoofing | Test E2E bypass auth | mitigate | `loginAs` helper passe par /login + cookies session |
| T-04.5-11 | Information Disclosure | NIR test fictif | accept | NIR `1 76 05 25 974 001 12` est exemple public INSEE |
</threat_model>

<verification>
- Vitest 100 % branch coverage sur `nir-checksum.ts`
- TypeScript strict OK sur `packages/shared` et `apps/web`
- Lint OK sur les fichiers modifiés
- Playwright E2E patient-form-validation GREEN en CI cloud sur preview Vercel
- Audit grep DEC-030 : aucun message technique brut (`validation failed`, `invalid format`) dans les nouveaux messages
</verification>

<success_criteria>
- DEC-036 inscriptible : masques saisie patient stricts livrés
- 5 frictions UAT 2026-05-14 (NIR 20 chars, date 30/02, téléphone US, ville libre, message dev) closes
- 80 % des schémas Zod existants conservés (réutilisation, pas duplication)
- Régulatrice de démo peut créer un patient en < 60 s sans message d'erreur incompréhensible
</success_criteria>

<output>
À la fin du plan, créer `.planning/phases/04.5-robustesse-regulateur/04.5-02-SUMMARY.md` synthétisant :
- Décisions implémentées (D-04, D-05, D-06, D-07, DEC-036)
- Couverture Vitest nir-checksum (% branch)
- Captures Playwright E2E (7/7 GREEN)
- Captures UI Sheet patient avec masques (à pousser dans `docs/showcase/04.5-robustesse-regulateur/`)
- Lien preview Vercel
</output>
