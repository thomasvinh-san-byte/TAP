---
phase: 04.5
plan: 4
plan_number: 4
slug: filtrage-permis-vehicule
type: execute
status: draft
estimated_hours: 1.5
wave: 3
depends_on: ["1"]
files_modified:
  - packages/shared/src/utils/driver-vehicle-compat.ts
  - packages/shared/src/utils/driver-vehicle-compat.test.ts
  - apps/web/src/app/(app)/courses/_components/assign-modal.client.tsx
  - apps/web/tests/e2e/assign-modal-compat.spec.ts
autonomous: true
requirements:
  - NFR-006
  - CONCERNS-MAJOR-PERMIS
decisions_implemented:
  - D-11
  - DEC-038
tags:
  - assignation
  - validation
  - ux
  - concerns
must_haves:
  truths:
    - "Modal assignation filtre par défaut les chauffeurs compatibles avec le véhicule sélectionné"
    - "Toggle « Afficher tous » bascule en mode urgence avec warning si incompatible sélectionné"
    - "La matrice de compatibilité couvre 4 types véhicule × 4 combinations permis (16 cas testés)"
    - "Le bouton submit reste actif même en mode urgence (DEC-029 esprit pragmatique)"
  artifacts:
    - path: "packages/shared/src/utils/driver-vehicle-compat.ts"
      provides: "Fonction pure isCompatible + matrice règles"
    - path: "packages/shared/src/utils/driver-vehicle-compat.test.ts"
      provides: "Vitest 100 % branch coverage matrice 16 cas"
    - path: "apps/web/src/app/(app)/courses/_components/assign-modal.client.tsx"
      provides: "UI toggle pills + filter useMemo + warning bloc incompatible"
  key_links:
    - from: "assign-modal.client.tsx"
      to: "isCompatible(driver, vehicle)"
      via: "useMemo filteredDrivers"
      pattern: "isCompatible.*useMemo"
    - from: "warning bloc"
      to: "selectedDriverId incompatible"
      via: "role='alert' aria-live='polite'"
      pattern: "AlertTriangle.*warning"
---

<objective>
T4 — Filtrage permis/véhicule : lever la dette CONCERNS.md severity **major** (« Pas de couplage type_permis ↔ vehicle.type V1 », ligne 45 du `assign-modal.client.tsx`). La régulatrice ne peut plus assigner par erreur un chauffeur sans permis TPMR à un véhicule TPMR (cas réel UAT 2026-05-14).

Purpose : règle métier non négociable. Un véhicule TPMR exige un chauffeur formé TPMR (réglementation 974). Sans ce filtre, la régulatrice peut commettre une erreur d'affectation qui se révèle au démarrage de course → patient en attente, course replanifiée, journée bousculée.

Output : 1 util pur testé + 1 modal refondue avec toggle pills + warning + matrice 16 cas testée.

Estimation 1.5 h plafond — tâche simple, UI déjà spec'd en UI-SPEC Surface C.
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

# Fichier à refondre
@apps/web/src/app/(app)/courses/_components/assign-modal.client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 4.1 — Util pur isCompatible + matrice 16 cas Vitest</name>
  <files>
    packages/shared/src/utils/driver-vehicle-compat.ts,
    packages/shared/src/utils/driver-vehicle-compat.test.ts
  </files>
  <action>
Per D-11, DEC-038. Util pur sans dépendance. Implémenté côté `packages/shared` pour réutilisation Server Action future (validation côté serveur quand modal soumise).

Étapes :

1. **Créer `packages/shared/src/utils/driver-vehicle-compat.ts`** :
   ```ts
   export type VehicleType = 'tpmr' | 'vsl' | 'taxi' | 'ambulance';
   export type PermisType = 'tpmr' | 'taxi' | 'vsl' | 'ambulance' | 'b';

   export interface CompatibilityInput {
     driver: { type_permis: ReadonlyArray<string> };
     vehicle: { type: string };
   }

   /**
    * Matrice compatibilité chauffeur ↔ véhicule (règles métier 974).
    * - tpmr : exige permis tpmr (formation spécifique 974)
    * - vsl : accepte vsl OU taxi (taxi conventionné peut faire VSL)
    * - taxi : exige taxi
    * - ambulance : exige ambulance
    */
   export function isCompatible(input: CompatibilityInput): boolean {
     const { driver, vehicle } = input;
     const permis = new Set(driver.type_permis);
     switch (vehicle.type) {
       case 'tpmr':
         return permis.has('tpmr');
       case 'vsl':
         return permis.has('vsl') || permis.has('taxi');
       case 'taxi':
         return permis.has('taxi');
       case 'ambulance':
         return permis.has('ambulance');
       default:
         return false; // type inconnu → refus par défaut (defense in depth)
     }
   }
   ```

2. **Créer `packages/shared/src/utils/driver-vehicle-compat.test.ts`** (Vitest 100 % branch coverage, 16 cas matriciels) :
   - 4 types véhicule × 4 combinaisons permis = 16 paires
   - Combinaisons permis testées :
     - `['b']` (permis B uniquement)
     - `['taxi']`
     - `['tpmr']`
     - `['taxi', 'tpmr', 'ambulance']` (chauffeur multi-permis)
   - Assertions attendues (extrait) :
     - tpmr × [b] → false
     - tpmr × [taxi] → false
     - tpmr × [tpmr] → true
     - tpmr × [taxi,tpmr,ambulance] → true
     - vsl × [b] → false
     - vsl × [taxi] → true (taxi conventionné fait VSL)
     - vsl × [tpmr] → false (TPMR seul ne fait pas VSL)
     - vsl × [taxi,tpmr,ambulance] → true
     - taxi × [b] → false
     - taxi × [taxi] → true
     - taxi × [tpmr] → false
     - taxi × [taxi,tpmr,ambulance] → true
     - ambulance × [b] → false
     - ambulance × [taxi] → false
     - ambulance × [tpmr] → false
     - ambulance × [taxi,tpmr,ambulance] → true
   - 1 test bonus : type véhicule inconnu (`'autre'`) → false (defense in depth).

Hors scope explicite :
- Pas de validation côté Server Action `assignDriverToRide` dans ce plan (différable PLAN-04.5-bis si nécessaire). V1 = filter UI suffit, RLS reste defense in depth indirect.

Threat model ASVS L1 :
- T-04.5-21 (Permis array forge côté client) : Mitigée partiellement. La validation finale doit aller côté Server Action (futur). V1 = UI uniquement.
- T-04.5-22 (Type véhicule inconnu) : Mitigée par `default: return false` (defense in depth — préfère refuser que d'autoriser).
  </action>
  <verify>
    <automated>cd packages/shared && pnpm vitest run src/utils/driver-vehicle-compat.test.ts --coverage</automated>
    Couverture branch attendue : 100 %.
  </verify>
  <done>
    - isCompatible exporté, signature stable
    - 16 cas + 1 cas defense in depth = 17 tests GREEN
    - 100 % branch coverage Vitest
  </done>
  <rollback>
    `git revert`. Aucun impact production (util pur non encore consommé).
  </rollback>
</task>

<task type="auto">
  <name>Task 4.2 — Modal assignation UI (toggle pills + filter useMemo + warning + E2E)</name>
  <files>
    apps/web/src/app/(app)/courses/_components/assign-modal.client.tsx,
    apps/web/tests/e2e/assign-modal-compat.spec.ts
  </files>
  <action>
Per D-11, UI-SPEC Surface C, DEC-038. Refondre `assign-modal.client.tsx` ligne 45 « Pas de couplage type_permis ↔ vehicle.type V1 » pour appliquer le filtre.

Étapes :

1. **Importer l'util** : `import { isCompatible } from '@taprun/shared/utils/driver-vehicle-compat'` (adapter le chemin selon convention monorepo).

2. **Ajouter state local** : `const [showCompatibleOnly, setShowCompatibleOnly] = useState(true)`.

3. **Étendre le `useMemo` filteredDrivers existant (ligne ~90-92)** :
   ```ts
   const filteredDrivers = useMemo(() => {
     if (!selectedVehicle) return drivers; // aucun véhicule sélectionné → liste complète
     const withCompat = drivers.map((d) => ({
       ...d,
       compatible: isCompatible({ driver: d, vehicle: selectedVehicle }),
     }));
     if (showCompatibleOnly) {
       return withCompat.filter((d) => d.compatible);
     }
     // Mode "Afficher tous" : compatibles d'abord, puis incompatibles, alphabétique nom
     return withCompat.sort((a, b) => {
       if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
       return a.nom_affichage.localeCompare(b.nom_affichage, 'fr');
     });
   }, [drivers, selectedVehicle, showCompatibleOnly]);
   ```

4. **Ajouter toolbar toggle pills** (UI-SPEC Surface C § Toolbar) au-dessus de la liste des chauffeurs :
   ```tsx
   <div className="inline-flex rounded-md border border-border bg-muted/40 p-2" role="tablist">
     <button
       role="tab"
       aria-selected={showCompatibleOnly}
       onClick={() => setShowCompatibleOnly(true)}
       className={cn(
         'px-12 py-6 text-sm rounded-sm transition-colors',
         showCompatibleOnly
           ? 'bg-background shadow-sm text-foreground'
           : 'text-muted-foreground hover:text-foreground'
       )}
     >Compatibles</button>
     <button
       role="tab"
       aria-selected={!showCompatibleOnly}
       onClick={() => setShowCompatibleOnly(false)}
       className={...}
     >Afficher tous</button>
   </div>
   ```

5. **Badge sémantique par ligne chauffeur** (UI-SPEC § ListItem) :
   - Compatible : `<Badge className="bg-success/10 text-success border-success/20">Compatible</Badge>`
   - Incompatible : `<Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Incompatible</Badge>`
   - Maximum 1 badge par ligne (DEC-034 conformité, OK).

6. **Recommandation R1 UI-SPEC — validation contraste WCAG AA** :
   - Avant merge, tester en preview Vercel le contraste effectif `bg-destructive/10 + text-destructive` sur fond `bg-background` ET sur `hover:bg-muted`.
   - Si contraste < 4.5:1 (échec WCAG AA) → fallback : retirer `bg-destructive/10` et garder uniquement `text-destructive` + bordure `border-destructive` plus visible.
   - Documenter le choix retenu dans le SUMMARY.

7. **Warning bloc si incompatible sélectionné** :
   ```tsx
   {selectedDriver && !isCompatible({ driver: selectedDriver, vehicle: selectedVehicle }) && (
     <div
       role="alert"
       aria-live="polite"
       className="flex items-start gap-12 bg-warning/10 border border-warning/20 rounded-md px-16 py-12"
     >
       <AlertTriangle className="h-16 w-16 text-warning shrink-0 mt-2" />
       <p className="text-sm text-destructive">
         Ce chauffeur n'a pas le permis requis pour ce véhicule. Confirmez en connaissance de cause.
       </p>
     </div>
   )}
   ```

8. **Recommandation R3 UI-SPEC — harmonisation couleur warning** :
   - Choisir une seule couleur cohérente : soit warning (bg + text + icon = warning), soit destructive (bg + text + icon = destructive).
   - Recommandation interne : garder `bg-warning/10` (jaune doux contexte attention) + `text-destructive` POUR LE TEXTE seulement (rouge urgence message), et `text-warning` pour l'icône → c'est PLUS expressif (« attention » + « danger »). Mais documenter ce choix explicitement.
   - Alternative : tout en `destructive` (cohérence couleur unique). Trancher pendant l'exécution avec capture pour le dirigeant.

9. **Toolbar empty state** :
   - Si `filteredDrivers.length === 0` en mode `Compatibles` :
     ```tsx
     <div className="flex flex-col items-center justify-center py-48 text-center">
       <CarTaxiFront className="h-32 w-32 text-muted-foreground mb-12" />
       <p className="text-sm font-medium">Aucun chauffeur compatible avec un véhicule {selectedVehicle.type}.</p>
       <p className="text-xs text-muted-foreground mt-8">Activez « Afficher tous » pour basculer en mode urgence.</p>
       <Button variant="secondary" className="mt-16" onClick={() => setShowCompatibleOnly(false)}>Afficher tous</Button>
     </div>
     ```

10. **Bouton submit reste actif** même si incompatible sélectionné (DEC-029 esprit pragmatique — l'urgence prime, le warning informe).

11. **Créer test E2E `assign-modal-compat.spec.ts`** :
    - **Test 1 — Filtre par défaut** : login régulateur → ouvrir course → cliquer Assigner → sélectionner véhicule TPMR → assert liste affichée ne contient QUE des chauffeurs avec `tpmr` dans permis.
    - **Test 2 — Toggle Afficher tous** : cliquer pill « Afficher tous » → assert chauffeurs sans TPMR apparaissent en bas avec badge Incompatible.
    - **Test 3 — Warning incompatible** : sélectionner un chauffeur incompatible → assert warning bloc visible avec texte « Ce chauffeur n'a pas le permis requis... ».
    - **Test 4 — Empty state** : sélectionner un véhicule pour lequel aucun chauffeur n'est compatible → assert empty state visible + bouton « Afficher tous » qui bascule le toggle.

Hors scope explicite :
- Pas de validation finale Server Action (différable). V1 = UI filter suffit.
- Pas de notification automatique au dirigeant si assignation incompatible (V2 — audit logs déjà tracent).

Threat model ASVS L1 :
- T-04.5-23 (Bypass UI filter via DevTools) : Mitigée partiellement. Un utilisateur déterminé peut forger un POST. Validation finale serveur reste à faire V2 (différable, audit_logs reste trace).
- T-04.5-24 (Sélection silencieuse incompatible) : Mitigée par warning bloc + badge destructive. La régulatrice ne peut pas ignorer visuellement.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(app\\)/courses/_components/assign-modal.client.tsx</automated>
    <automated>cd apps/web && pnpm playwright test tests/e2e/assign-modal-compat.spec.ts</automated>
    Manual : tester WCAG AA contraste badge Incompatible (R1) + cohérence couleur warning (R3) en preview Vercel.
  </verify>
  <done>
    - useMemo filteredDrivers utilise isCompatible
    - Toggle pills « Compatibles » / « Afficher tous » fonctionnel
    - Badge Compatible / Incompatible avec contraste WCAG AA validé (R1) : si < 4.5:1, fallback `text-destructive` sans fond
    - Warning bloc cohérence couleur : choix LOCK = `bg-warning/10` + `text-warning` (icône AlertTriangle) + `text-destructive` (texte titre uniquement) — mélange volontaire signal/explication, conforme UI-SPEC L513-518 (R3)
    - Clé React liste chauffeurs inclut `vehicle.type` mutable : `key={\`${driver.id}-${selectedVehicle?.type ?? 'none'}\`}` pour forcer re-mount du badge Compatible/Incompatible au changement de véhicule sélectionné (DEC-033 LOCKED)
    - Empty state avec CTA Afficher tous
    - 4 tests E2E GREEN
    - Bouton submit reste actif en mode urgence
  </done>
  <rollback>
    `git revert` du commit. Le filter UI revient à l'état pré-fix (toujours afficher tous, ligne 45 « Pas de couplage V1 » restaurée). L'util pur reste publié sans consommateur — pas d'impact.
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client filter UI → Server Action `assignDriverToRide` | Validation côté serveur reste TODO V2 |
| `driver.type_permis` array | Source = BDD via RLS authentifiée, faible risque forge |
| Régulatrice → assignation incompatible | Acceptée si warning affiché (DEC-029 esprit) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-21 | Tampering | Permis array forge client | accept | V1 UI-only. V2 validation Server Action. Audit logs tracent |
| T-04.5-22 | Tampering | Type véhicule inconnu | mitigate | `default: return false` defense in depth |
| T-04.5-23 | Spoofing | Bypass UI filter DevTools | accept | UI uniquement V1, audit trail RLS reste |
| T-04.5-24 | Repudiation | Sélection silencieuse incompatible | mitigate | Warning bloc visible + badge destructive |
</threat_model>

<verification>
- Vitest 100 % branch coverage GREEN
- Playwright 4/4 GREEN sur preview Vercel
- Audit visuel R1 + R3 documenté dans SUMMARY (capture avant/après contraste badge + choix couleur warning)
- Modal assignation : toggle fonctionnel, warning bloc visible, empty state CTA
</verification>

<success_criteria>
- DEC-038 inscriptible : modal assignation filtre permis-véhicule
- Dette CONCERNS.md severity major levée
- 0 régression : toutes les courses peuvent toujours être assignées (mode urgence accessible)
- Recommandations R1 + R3 UI-SPEC validées et documentées
</success_criteria>

<output>
À la fin du plan, créer `.planning/phases/04.5-robustesse-regulateur/04.5-04-SUMMARY.md` synthétisant :
- DEC-038 inscrite PROJECT.md (pending checker)
- 17 tests Vitest GREEN (16 matrice + 1 defense in depth)
- 4 Playwright GREEN
- Captures avant/après modal dans `docs/showcase/04.5-robustesse-regulateur/`
- Choix R3 documenté (couleur warning unique vs cohérence sémantique)
</output>
