---
phase: 04.5
plan: 6
plan_number: 6
slug: decoupes-refactor-visuel
type: execute
status: draft
estimated_hours: 1.5
wave: 4
depends_on: ["1", "2", "3", "4", "5"]
deferred_if: "cumul > 12 h cumulées en fin Wave 3 — sortir en 04.5-bis"
files_modified:
  - apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx
  - apps/web/src/app/(app)/courses/_components/ride-express-form-sections.client.tsx
  - apps/web/src/app/(app)/courses/_components/ride-express-form-footer.client.tsx
  - apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx
  - apps/web/src/app/(app)/courses/_components/ride-drawer-sections.client.tsx
  - apps/web/src/app/(app)/courses/_components/ride-drawer-actions.client.tsx
  - apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx
  - docs/showcase/04.5-refactor-design/
autonomous: true
requirements:
  - NFR-006
  - CONCERNS-FILES-300L
decisions_implemented:
  - D-15
  - D-16
  - D-17
  - DEC-034
tags:
  - refactor
  - design-system
  - debt
  - differable
must_haves:
  truths:
    - "Si ride-express-modal.client.tsx > 300L au début exécution, il est découpé en 2 sous-composants ; sinon NO-OP documenté"
    - "ride-drawer.client.tsx (337L) est découpé en 2 sous-composants chacun < 300L"
    - "drivers-list.client.tsx applique UI-PATTERNS.md DEC-034 (divide-y dense, toggle pill, actions inline DEC-029 conservées)"
    - "Captures avant/après /admin/chauffeurs publiées dans docs/showcase/04.5-refactor-design/"
  artifacts:
    - path: "apps/web/src/app/(app)/courses/_components/ride-drawer-sections.client.tsx"
      provides: "Sections drawer extraites (header + meta + payment + actions)"
    - path: "apps/web/src/app/(app)/courses/_components/ride-drawer-actions.client.tsx"
      provides: "Actions drawer extraites (boutons annulation/édition/etc.)"
    - path: "apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx"
      provides: "Liste chauffeurs alignée DEC-034 design system"
  key_links:
    - from: "ride-drawer.client.tsx"
      to: "ride-drawer-sections + ride-drawer-actions"
      via: "imports + JSX composition"
      pattern: "RideDrawerSections|RideDrawerActions"
    - from: "drivers-list.client.tsx"
      to: "UI-PATTERNS.md DEC-034"
      via: "divide-y dense + toggle pill + InitialsAvatar 32px"
      pattern: "divide-y divide-border"
---

<objective>
T6 — Découpes + refactor visuel : trois nettoyages d'hygiène structurelle et visuelle. Différables Phase 04.5-bis si Phase 04.5 dépasse 12 h cumulées à mi-parcours (signal alerte au dirigeant).

Purpose :
- T6.1 audit ride-express-modal.client.tsx : déjà à 291 L au CONTEXT.md → probable NO-OP, effort transféré.
- T6.2 découpe ride-drawer.client.tsx (337 L > 300 L) : règle CLAUDE.md (fichier < 300 L). Découpe en 2 sous-composants.
- T6.3 refactor visuel /admin/chauffeurs (A-04 verrouillé) : aligner sur UI-PATTERNS.md DEC-034 ligne par ligne. Application directe, pas de nouvelle spec.

Output : 0 ou 2 nouveaux fichiers Section/Footer pour T6.1, 2 nouveaux fichiers Section/Actions pour T6.2, 1 fichier drivers-list.client.tsx refondu pour T6.3, 6+ captures avant/après.

Estimation 1.5 h. **Si Phase 04.5 cumule > 12 h en début de PLAN-6, signaler au dirigeant → 04.5-bis.**
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md
@.planning/UI-PATTERNS.md
@.planning/codebase/CONCERNS.md

# Fichiers à découper / refactor
@apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx
@apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx
@apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx

# Référence visuelle cible (densité)
@apps/web/src/app/(admin)/admin/vehicules/_components/vehicules-list.client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 6.1 — Audit + découpe conditionnelle ride-express-modal.client.tsx</name>
  <files>
    apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-express-form-sections.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-express-form-footer.client.tsx
  </files>
  <action>
Per D-15. **Étape 1 : audit en début d'exécution**.

Étapes :

1. **Mesurer** : `wc -l apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx`.

2. **Si < 300 L** :
   - **NO-OP**. Le hotfix Phase 04 a déjà trimmé le fichier.
   - Documenter dans le SUMMARY : « T6.1 NO-OP — fichier mesuré à {N} L (< 300), pas de découpe nécessaire. Effort transféré sur T6.3. »
   - Passer à Task 6.2.

3. **Si ≥ 300 L** :
   - Découper en 2 sous-composants client :
     - `ride-express-form-sections.client.tsx` : JSX des sections du formulaire (patient + adresse + date/heure + type véhicule)
     - `ride-express-form-footer.client.tsx` : JSX des actions de bas (Annuler, Brouillon, Enregistrer)
   - L'orchestrateur `ride-express-modal.client.tsx` conserve : state, useForm, useFormState, Server Action call, importation des deux sous-composants.
   - Vérifier que chaque fichier résultant est `< 300 L` par `wc -l`.
   - Conserver les imports et les hooks (`useForm`, `useFormState`) dans l'orchestrateur — ne pas pousser les hooks dans les sous-composants (rule of hooks préservée, props drilling acceptable).

Hors scope explicite :
- Pas de refactor logique métier (juste découpe structurelle).
- Pas de modification du comportement formulaire.

Threat model ASVS L1 : aucun nouveau threat (refactor pur).
  </action>
  <verify>
    <automated>cd /home/user/TAP && wc -l apps/web/src/app/\\(app\\)/courses/_components/ride-express-modal.client.tsx</automated>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(app\\)/courses</automated>
    Manual : ouvrir saisie express, vérifier que tous les champs + boutons fonctionnent comme avant.
  </verify>
  <done>
    - Si NO-OP : statut documenté dans SUMMARY, fichier inchangé
    - Si découpe : 3 fichiers résultants chacun < 300 L, comportement identique
    - typecheck + lint GREEN
  </done>
  <rollback>
    `git revert` du commit découpe. Le fichier orchestrateur revient à l'état pré-découpe.
  </rollback>
</task>

<task type="auto">
  <name>Task 6.2 — Découpe ride-drawer.client.tsx (337L → < 300L par fichier)</name>
  <files>
    apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-drawer-sections.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-drawer-actions.client.tsx
  </files>
  <action>
Per D-16. Fichier à 337 L confirmé > 300 L → découpe obligatoire.

Étapes :

1. **Identifier les sections logiques** dans `ride-drawer.client.tsx` :
   - Header (statut course, ride.id, badge statut)
   - Meta (patient, dates, addresses, véhicule, chauffeur)
   - Pricing (PricingBreakdown — Phase 04.7 le complétera, V1 placeholder ok)
   - Payment (encaissement on/off)
   - Actions (Démarrer / Clôturer / Éditer / Annuler / Affecter)
   - Footer (timestamps, audit info)

2. **Extraire dans `ride-drawer-sections.client.tsx`** :
   - Header + Meta + Pricing + Payment + Footer (JSX read-only à 90 %)
   - Props : `ride` typé depuis `types.gen.ts`, `patient`, `driver`, `vehicle`

3. **Extraire dans `ride-drawer-actions.client.tsx`** :
   - Boutons d'action + handlers `onClick` (qui appellent Server Actions ou ouvrent des modales)
   - Props : `ride`, callbacks `onStart`, `onEnd`, `onEdit`, `onCancel`, `onAssign`

4. **Vérifier `wc -l`** des 3 fichiers : chacun doit être `< 300 L`.

5. **Comportement identique** : tests E2E existants Phase 03 doivent rester GREEN.

Hors scope explicite :
- Pas de refactor logique (juste split structurel).
- Pas de migration vers Server Component.

Threat model ASVS L1 : aucun nouveau threat (refactor pur).
  </action>
  <verify>
    <automated>cd /home/user/TAP && wc -l apps/web/src/app/\\(app\\)/courses/_components/ride-drawer*.client.tsx</automated>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(app\\)/courses</automated>
    Manual : ouvrir un ride drawer, vérifier que tous les sections + actions s'affichent et fonctionnent.
  </verify>
  <done>
    - 3 fichiers résultants chacun < 300 L
    - Tests Playwright Phase 03 GREEN (regression)
    - typecheck + lint GREEN
  </done>
  <rollback>
    `git revert` du commit. Le fichier orchestrateur revient à 337 L pré-découpe.
  </rollback>
</task>

<task type="auto">
  <name>Task 6.3 — Refactor visuel /admin/chauffeurs (DEC-034 application directe)</name>
  <files>
    apps/web/src/app/(admin)/admin/chauffeurs/_components/drivers-list.client.tsx,
    docs/showcase/04.5-refactor-design/
  </files>
  <action>
Per D-17, A-04, DEC-034. Application directe UI-PATTERNS.md ligne par ligne. **Pas de nouvelle spec UI** — juste implémentation conforme.

Étapes :

1. **Lire UI-PATTERNS.md** intégralement avant de toucher au fichier.

2. **Refactor `drivers-list.client.tsx`** :
   - **Retirer les cards aérées** : si chaque chauffeur est un `<Card>` avec padding important, remplacer par item de liste `<li>` ou `<div>` dans un wrapper `divide-y divide-border rounded-md border border-border`.
   - **Adopter `divide-y` dense** : item hauteur ~56-64 px, `px-16 py-12` (scale 8 px), `hover:bg-muted`.
   - **Toggle Actifs / Archivés en pill discret** : conserver le toggle existant (Phase 04 hotfix DEC-029) mais le rendre conforme au pattern UI-PATTERNS.md « Filtres pills segmented control » :
     ```tsx
     <div className="inline-flex rounded-md border border-border bg-muted/40 p-2" role="tablist">
       <button role="tab" aria-selected={!showArchived} className={...}>Actifs</button>
       <button role="tab" aria-selected={showArchived} className={...}>Archivés</button>
     </div>
     ```
   - **Conserver les actions inline DEC-029** (Désactiver / Réactiver / Archiver / Désarchiver) : dropdown menu shadcn ou boutons icône à droite de chaque ligne.
   - **InitialsAvatar 32 px conservé** (existant) à gauche de chaque ligne.
   - **Densité comparable à `/admin/vehicules`** : prendre `vehicules-list.client.tsx` comme référence visuelle si déjà conforme DEC-034.

3. **Vérifier les 8 anti-patterns proscrits** UI-PATTERNS.md :
   - Pas de couleurs criardes saturées
   - Pas de boutons en dégradé / biseaux 3D
   - Pas de tableaux à bordures épaisses
   - Pas de mélange d'icônes hors Lucide
   - Pas de polices web datées
   - Pas d'emojis dans l'UI
   - Pas d'animations excessives
   - Pas de wireframes Bootstrap

4. **Spacing strict** : toutes les valeurs sur scale 4/8/12/16/24/32/48/64 (DEC-034). Auditer chaque `className` Tailwind.

5. **Captures avant/après** :
   - `docs/showcase/04.5-refactor-design/before-admin-chauffeurs.png`
   - `docs/showcase/04.5-refactor-design/after-admin-chauffeurs.png`
   - Mention « avant : cards aérées 80px / après : liste dense 56-64 px » dans le SUMMARY.

6. **Régression tests** :
   - Tests Playwright existants Phase 04 doivent rester GREEN (DEC-029 4 actions chauffeurs accessibles).

Hors scope explicite :
- Pas de refactor des Sheets d'édition chauffeur (différable).
- Pas de modification du comportement DEC-029.
- Pas de refactor /admin/vehicules ou /admin/legal/* (différables).
- Pas de Storybook ou page galerie.

Threat model ASVS L1 : aucun nouveau threat (refactor visuel pur, comportement préservé).
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(admin\\)/admin/chauffeurs</automated>
    <automated>cd apps/web && pnpm playwright test tests/e2e/admin-chauffeurs.spec.ts  # si existe (Phase 04)</automated>
    Manual : preview Vercel, naviguer /admin/chauffeurs, vérifier densité comparable à /admin/vehicules. Capture avant/après publiée dans docs/showcase/.
  </verify>
  <done>
    - drivers-list.client.tsx conforme DEC-034 (divide-y, toggle pill, actions inline conservées)
    - 8 anti-patterns proscrits absents
    - Spacing strict scale 8 px
    - 2 captures avant/après publiées
    - 0 régression DEC-029 (4 actions chauffeurs fonctionnelles)
  </done>
  <rollback>
    `git revert` du commit. La page revient à l'état pré-refactor (cards aérées). Les actions DEC-029 ne sont pas affectées (state managment dans le composant orchestrateur supérieur).
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Découpe composants client → comportement préservé | Risk regression UI silencieuse |
| UI-PATTERNS.md → drivers-list.client.tsx | Application sans nouvelle spec, source de vérité visuelle DEC-034 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-32 | Tampering | Refactor casse comportement | mitigate | Tests E2E Phase 03 + 04 GREEN avant merge |
| T-04.5-33 | Information Disclosure | Capture avant/après leak | accept | Captures = preview Vercel données démo (Hoarau/Payet/Grondin fictifs) |
</threat_model>

<verification>
- wc -l : 3 fichiers ride-drawer chacun < 300 L
- wc -l : ride-express-modal < 300 L (NO-OP ou découpé)
- typecheck + lint GREEN
- Tests E2E Phase 03 + 04 GREEN (régression nulle)
- drivers-list.client.tsx conforme DEC-034 (audit manuel UI-PATTERNS.md ligne par ligne)
- 6+ captures publiées dans docs/showcase/04.5-refactor-design/
</verification>

<success_criteria>
- D-15, D-16, D-17 implémentés
- DEC-034 appliquée à /admin/chauffeurs (cohérence visuelle vs /admin/vehicules)
- Règle CLAUDE.md < 300 L respectée sur ride-drawer + ride-express-modal
- Aucune régression fonctionnelle DEC-029
</success_criteria>

<output>
À la fin du plan, créer `.planning/phases/04.5-robustesse-regulateur/04.5-06-SUMMARY.md` synthétisant :
- Mesures wc -l avant/après par fichier
- Statut T6.1 (NO-OP ou découpé)
- Captures avant/après /admin/chauffeurs
- Audit UI-PATTERNS.md ligne par ligne signé OK
- Confirmation Phase 04.5 < 12 h cumulées (sinon : remontée 04.5-bis au dirigeant)
- Lien preview Vercel
</output>
