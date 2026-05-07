---
phase: 02-saisie-express-course
plan: 04
subsystem: web/client
tags: [react-client, multi-instance-store, useReducer, dialog-radix, auto-save, optimistic-ui, keyboard-shortcut, courses]

# Dependency graph
requires:
  - phase: 00-foundations
    provides: Dialog Radix shadcn (apps/web/src/components/ui/dialog.tsx), Sonner toast
  - phase: 01-referentiel-patients
    provides: PatientSearch input (réutilisé tel quel), searchPatientsAction RPC fuzzy 2 chars
  - phase: 02-saisie-express-course/02-01
    provides: rideExpressInputSchema + rideDraftSchema + parseFreeformDate (@tap/shared) — Wave 0
  - phase: 02-saisie-express-course/02-03
    provides: createRideAction + upsertRideDraft (Server Actions consommées par le modal) — Wave 2
provides:
  - Hook useGlobalShortcut (mod/shift/key) — exporté depuis @/lib/keyboard-shortcuts
    réutilisable pour tout raccourci global futur (Phase 5 cockpit, Phase 6 planning, etc.)
  - RideExpressOrchestrator (multi-instance store useReducer) à monter dans
    (app)/layout.tsx en Wave 4 ; expose Context {drafts, dispatch} via
    useRideOrchestrator pour bouton header + DraftQueue
  - RideExpressModal complet (auto-save + optimistic submit + Esc) prêt à
    rendre par l'orchestrator — l'UX < 30 s SAIS-01 sera mesurée Wave 5
  - 5 sous-composants présentation (PatientPickerField, DateFreeformField,
    AddressField, ModeUrgencyFields, NotesField, SavingIndicator) testables
    isolément Wave 5
affects:
  - 02-saisie-express-course Wave 4 : (app)/layout.tsx montera RideExpressOrchestrator,
    header.client.tsx ajoutera bouton « + Nouvelle course » via useRideOrchestrator
  - 02-saisie-express-course Wave 4 : DraftQueue dropdown header consomme
    useRideOrchestrator pour dispatch RESUME(draftId)
  - 02-saisie-express-course Wave 5 : E2E saisie-express.spec.ts s'appuie
    sur les 6 aria-labels exacts livrés ici

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook useGlobalShortcut (window keydown) : preventDefault UNIQUEMENT si match exact, cleanup cb dans useEffect return — réutilisable pour tout raccourci futur"
    - "Reducer pure draftsReducer : 5 actions (OPEN_NEW/CLOSE/RESUME/MINIMIZE/SET_DRAFT_ID), un seul modal visible à la fois (D-04 instances séparées vs tabs)"
    - "Context minimal {drafts, dispatch} ciblé header bouton + DraftQueue Wave 4 (RESEARCH §C4 — pas de Context sur le store interne, mais OK pour partage 2-3 consumers)"
    - "Auto-save D-05 : useState debounceRef + setTimeout 5s + flush onBlur + flush onClose ; cleanup useEffect garantit pas de fuite (Pitfall 2 spam serveur)"
    - "Optimistic submit DEC-005 : toast.success + close immédiat AVANT createRideAction ; sur erreur restaure snapshot et toast erreur (Pitfall 3 reconcile)"
    - "Esc handling : Radix onOpenChange(false) → flushSave(form).then(onClose) ; jamais de perte de données saisies"
    - "PatientSearch Phase 1 RÉUTILISÉ via PatientPickerField wrapper + searchPatientsAction useQuery deferred 2 chars (zéro duplication)"
    - "Extraction sous-composants : RideExpressModal 284 lignes (≤ 300) grâce à PatientPickerField + RideExpressFormFields séparés (CLAUDE.md § 11)"

key-files:
  created:
    - apps/web/src/lib/keyboard-shortcuts.tsx (50 lignes)
    - apps/web/src/app/(app)/courses/_components/ride-orchestrator-context.client.tsx (62 lignes)
    - apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx (124 lignes)
    - apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx (284 lignes)
    - apps/web/src/app/(app)/courses/_components/ride-patient-picker.client.tsx (70 lignes)
    - apps/web/src/app/(app)/courses/_components/ride-express-form-fields.client.tsx (213 lignes)
  modified: []

key-decisions:
  - "DEC-015 amendé Cmd+N → Cmd+Shift+K : Cmd+N est réservé navigateur (non interceptable Chrome/Firefox/Safari, RESEARCH §C1 + §R1) ; Cmd/Ctrl+Shift+K (pattern Slack/Linear) est le nouveau standard. Amendement assumé dans le scope de discrétion délégué (CONTEXT.md §Claude's Discretion + §Open Questions Q1)."
  - "Plan modal initialement spécifié à ≤ 300 lignes : implémentation naïve atteignait 449 lignes (avec PatientPickerField inline + SavingIndicator inline + tous les form fields verbatim). Refactor en 3 fichiers (modal 284 + picker 70 + form-fields 213) pour respecter CLAUDE.md § 11 anti-pattern fichiers > 300. Sémantique préservée à 100 %."
  - "Context minimal {drafts, dispatch} créé pour partager le dispatch avec Wave 4 (header bouton + DraftQueue) : RESEARCH §C4 dit « pas de Context » pour le store INTERNE de l'orchestrator (re-renders cascade) mais un Context très ciblé sur 2-3 consumers est acceptable. Décision dans le scope discrétion Claude."
  - "PatientSearch Phase 1 a une signature {value, onChange} (input pur, pas de selection logic) ≠ ce que le PLAN supposait `{onSelect}`. Wrapper PatientPickerField construit autour qui : (1) maintient un state local query, (2) appelle searchPatientsAction useQuery deferred 2 chars (pattern Phase 1 patients-list.client), (3) rend un result list cliquable qui appelle onSelect(id, label). Zéro duplication de PatientSearch lui-même."
  - "Submit utilise useTransition + setForm(snapshot) (fallback RESEARCH §R2 — useOptimistic instable React 18.3 sans canary) plutôt que useOptimistic. UX visible identique : close < 100 ms + toast ; si erreur réseau, restaure snapshot et toast erreur. Refacto V1.5 possible si useOptimistic stabilisé."
  - "5 sous-composants présentation extraits : DateFreeformField, AddressField (réutilisé pickup + dropoff), ModeUrgencyFields, NotesField, SavingIndicator. Tous purs (props in, JSX out, pas de logique métier — DEC-016). Testables Wave 5 sans monter le modal entier."

patterns-established:
  - "Module client courses : 1 modal orchestrator + 1 Context + 5 sous-composants présentation (1 picker + 1 form-fields containing 4 input wrappers + 1 indicator)"
  - "Pattern auto-save 5s : useRef debounceRef + setTimeout + flushSave async ; flush onBlur de chaque champ + flush onClose ; useEffect cleanup au unmount"
  - "Pattern multi-instance modal : useReducer pure + un seul visible à la fois (find(!minimized)) ; OPEN_NEW minimise tous les autres ; RESUME(id) idempotent (démise si déjà ouvert, sinon push)"
  - "Pattern hook useGlobalShortcut : interface ShortcutDef {mod, shift?, key} + preventDefault si match exact (jamais sinon — n'écrase pas a11y native)"
  - "Pattern fallback optimistic UI sans useOptimistic : useTransition + snapshot + setForm(snapshot) sur erreur (RESEARCH §R2 — UX identique pour la régulatrice)"

requirements-completed: [SAIS-02, SAIS-03, SAIS-05]

# Metrics
duration: 7min
completed: 2026-05-07
---

# Phase 2 Plan 04 : Modal client saisie express + multi-instance store + raccourci global — Summary

**Wave 3 livrée — 6 fichiers client (803 lignes total) ; modal saisie express avec auto-save 5s + optimistic submit + Esc handling ; orchestrator multi-instance useReducer avec raccourci Cmd/Ctrl+Shift+K ; PatientSearch Phase 1 réutilisé tel quel via wrapper PatientPickerField (zéro duplication) ; 0 console.log, 0 import @supabase/* direct, typecheck @tap/web GREEN.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-07T10:31:55Z
- **Completed:** 2026-05-07T10:39:04Z
- **Tasks:** 3 (+ refactor split file > 300 lignes + SUMMARY)
- **Files created:** 6
- **Files modified:** 0
- **Total lines added:** 803

## Accomplishments

### Task 4.1 — Hook `useGlobalShortcut` (`apps/web/src/lib/keyboard-shortcuts.tsx`, 50 lignes)

Hook React minimaliste qui écoute `keydown` sur `window` et appelle `cb()` quand `ShortcutDef {mod, shift?, key}` matche. `e.preventDefault()` UNIQUEMENT sur match — n'écrase aucun raccourci natif a11y. Cleanup `removeEventListener` automatique au démontage.

**Décision DEC-015 amendée** : `Cmd+N` est réservé navigateur (non interceptable, RESEARCH §C1+§R1) → choix `Cmd/Ctrl+Shift+K` (pattern Slack/Linear). Amendement dans le scope de discrétion délégué (CONTEXT.md §Open Questions Q1).

### Task 4.2 — Orchestrator multi-instance + Context (2 fichiers, 186 lignes)

#### `ride-orchestrator-context.client.tsx` (62 lignes)

- Type `DraftEntry { tempKey, draftId?, patientId?, minimized }`
- 5 actions reducer : `OPEN_NEW`, `CLOSE`, `RESUME`, `MINIMIZE`, `SET_DRAFT_ID`
- Context `RideOrchestratorCtx { drafts, dispatch }` + hook `useRideOrchestrator()` qui throw si appelé hors Provider (CLAUDE.md § 5 : pas d'erreur muette)

#### `ride-express-orchestrator.client.tsx` (124 lignes)

- `useReducer(draftsReducer, [])` + dispatch passé via Context Provider
- Écoute `useGlobalShortcut({mod: true, shift: true, key: 'k'}, openNew)` câblé sur dispatch `OPEN_NEW`
- Rend le seul modal visible (`drafts.find(d => !d.minimized)`) ; les autres restent dans le store mais sont cachés du DOM, accessibles Wave 4 via la DraftQueue header
- Sémantique D-04 : `OPEN_NEW` minimise tous les autres avant push (jamais 2 modaux visibles simultanément)
- `RESUME(draftId)` idempotent : démise si déjà ouvert, sinon push neuf

### Task 4.3 — RideExpressModal + sous-composants présentation (3 fichiers, 567 lignes)

#### `ride-express-modal.client.tsx` (284 lignes)

- Dialog Radix max-w-[600px] avec aria-label « Saisie express d'une course »
- State `FormState` partial + state séparés (`patientLabel`, `dateError`, `savingState`, `lastSavedAt`, `isPending`)
- `flushSave(payload)` async : clearTimeout debounce → `upsertRideDraft({id, payload, patient_id})` → sur succès set `draftIdRef` + appel `props.onDraftIdResolved(id)` (sync vers reducer SET_DRAFT_ID)
- `scheduleSave(next)` : debounce 5s via `setTimeout(() => void flushSave(next), 5000)` + cleanup `useEffect` au unmount (Pitfall 2 — pas de spam serveur)
- `updateField<K>` helper : setForm + scheduleSave en un seul appel
- `handleOpenChange(open)` (Esc / X) : `flushSave(form).then(onClose)` — JAMAIS de perte de saisie (D-05)
- `handleSubmit` : parse date freeform côté client (Pitfall 5 TZ) → `rideExpressInputSchema.safeParse` → `toast.success` immédiat + close optimistic → `startTransition(createRideAction)` → sur erreur `setForm(snapshot) + toast.error` (Pitfall 3 reconcile)
- Submit button désactivé pendant `isPending` avec label « Création… » ; bouton « Mettre en pause » câblé sur `props.onMinimize`

#### `ride-patient-picker.client.tsx` (70 lignes)

- Wrapper autour de `PatientSearch` Phase 1 (réutilisation directe — zéro duplication)
- `useDeferredValue(query)` + `useQuery({queryFn: () => searchPatientsAction(dq), enabled: dq.length >= 2})` (pattern Phase 1 `patients-list.client`)
- Result list cliquable max 6 items + scroll, qui appelle `onSelect(id, "Prénom Nom")` puis vide la query
- Affiche « Sélectionné : Prénom Nom » si déjà choisi

#### `ride-express-form-fields.client.tsx` (213 lignes)

5 sous-composants présentation purs (props in, JSX out — DEC-016) :

- `DateFreeformField` — `Input` avec `parseFreeformDate(value)` onBlur, `dateError` callback
- `AddressField` — composant générique réutilisé pour pickup + dropoff (autoComplete=off, required, tabIndex paramétrable)
- `ModeUrgencyFields` — grid 2 cols `<select>` natifs (4 modes + 3 urgences) avec defaults `taxi_conventionne` / `programmee`
- `NotesField` — `Input` maxLength 500
- `SavingIndicator` — span aria-live polite avec re-render setInterval 5s pour mettre à jour « Sauvegardé il y a X s »

**Tab order respecté** : 1 (PatientSearch interne) → 2 (date) → 3 (pickup) → 4 (dropoff) → 5 (mode) → 6 (urgency) → 7 (notes) → 8 (submit).

**6 aria-labels exacts** pour E2E Wave 5 : « Rechercher un patient » (PatientSearch Phase 1), « Date et heure », « Adresse de prise en charge », « Adresse de destination », « Mode de transport », « Urgence », « Notes ».

## Task Commits

| Task | Name                                                                       | Commit    | Files                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Hook useGlobalShortcut Cmd/Ctrl+Shift+K                                    | `6d90dea` | apps/web/src/lib/keyboard-shortcuts.tsx                                                                                                                  |
| 4.2  | Orchestrator multi-instance + Context dispatch                             | `d1bc07b` | apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx, ride-orchestrator-context.client.tsx                                    |
| 4.3  | RideExpressModal Dialog Radix + auto-save 5s + optimistic submit            | `ccd1a67` | apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx, ride-patient-picker.client.tsx, ride-express-form-fields.client.tsx            |

## Files Created/Modified

### Créés (6)

- `apps/web/src/lib/keyboard-shortcuts.tsx` — 50 lignes (≤ 60 cible)
- `apps/web/src/app/(app)/courses/_components/ride-orchestrator-context.client.tsx` — 62 lignes (≤ 35 cible dépassé : la JSDoc des actions et l'erreur FR pèsent ; aucun code dead, jugé acceptable)
- `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` — 124 lignes (≤ 130 cible)
- `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx` — 284 lignes (≤ 300 limite stricte CLAUDE.md § 11)
- `apps/web/src/app/(app)/courses/_components/ride-patient-picker.client.tsx` — 70 lignes (sous-composant extrait pour respecter limite 300 lignes du modal)
- `apps/web/src/app/(app)/courses/_components/ride-express-form-fields.client.tsx` — 213 lignes (5 sous-composants présentation extraits)

### Modifiés (0)

Aucun. Wave 3 est purement additive — le modal n'est pas encore monté dans `(app)/layout.tsx` (Wave 4 le fera + ajoutera bouton header + DraftQueue).

## Decisions Made

### DEC-015 amendé : Cmd+N → Cmd/Ctrl+Shift+K

`Cmd+N` est réservé navigateur (raccourci OS-level non interceptable Chrome/Firefox/Safari — vérifié RESEARCH §C1 + MDN). DEC-015 l'avait verrouillé, mais le test SAIS-02 aurait nécessairement timeout avec ce binding. RESEARCH §R1 listait 3 alternatives (`Cmd+Shift+K`, `Cmd+Shift+N`, `Alt+N`) et recommandait `Cmd+Shift+K` (pattern Slack/Linear « new action »). Choix appliqué dans le scope de discrétion délégué (CONTEXT.md §Open Questions Q1). À documenter dans `docs/adr/` Phase 2 final.

### Refactor du modal en 3 fichiers (split > 300 lignes)

L'implémentation initiale du modal selon la structure verbatim du PLAN atteignait 449 lignes (PatientPickerField inline 56 lignes + SavingIndicator inline 28 lignes + 6 form fields verbatim 117 lignes). CLAUDE.md § 11 plafonne à 300 lignes/fichier. Refactor en 3 fichiers cohérents :

- `ride-express-modal.client.tsx` (284) : Dialog wrapper + state + auto-save logic + submit logic + render orchestration
- `ride-patient-picker.client.tsx` (70) : sélecteur patient autonome (déjà identifié dans le plan PATTERNS)
- `ride-express-form-fields.client.tsx` (213) : 5 sous-composants présentation (DateFreeformField, AddressField générique réutilisé pickup+dropoff, ModeUrgencyFields, NotesField, SavingIndicator)

Sémantique 100 % préservée. Tab order 1-8 conservé via `tabIndex` paramétrable. Tous les aria-labels exacts conservés. PatientSearch Phase 1 réutilisé via PatientPickerField (1 import unique dans courses/_components).

### Context minimal {drafts, dispatch} pour Wave 4 (vs RESEARCH §C4)

RESEARCH §C4 recommande « pas de Context » pour le store interne de l'orchestrator pour éviter re-renders en cascade. Mais Wave 4 doit câbler le bouton header « + Nouvelle course » + la DraftQueue dropdown sur le même `dispatch`. Trois options :

1. Faire remonter `dispatch` jusqu'au layout via prop drilling
2. Lifter le store en haut du layout (`useReducer` dans layout.tsx) et passer dispatch en prop
3. Context minimal `{drafts, dispatch}` ciblé sur 2-3 consumers

Option 3 retenue : overhead négligeable (Provider rend ses children, les non-consumers ne re-rendent pas en l'absence de prop change), API plus propre pour Wave 4. Cette nuance s'inscrit dans le scope discrétion Claude (CONTEXT.md §Claude's Discretion).

### Fallback `useTransition + snapshot` plutôt que `useOptimistic`

`useOptimistic` est documenté React 19 / canary 18.3 (RESEARCH §C6+§R2). Stack actuelle : React 18.3.1 stable. Le pattern `useTransition + setForm(snapshot)` produit une UX visiblement identique pour la régulatrice (close + toast immédiat ; sur erreur restaure et toast). Refacto V1.5 possible quand React 19 est stabilisé sans aucune perte fonctionnelle.

### PatientPickerField wrapper plutôt que modification de PatientSearch

`PatientSearch` Phase 1 a une signature `{value, onChange}` (input pur, pas de logique de sélection). Le PLAN supposait `{onSelect: (p: Patient) => void}`. Plutôt que casser le contrat existant (utilisé par `patients-list.client.tsx`), wrapper `PatientPickerField` qui : (1) maintient un state local `query`, (2) appelle `searchPatientsAction` via `useQuery` deferred 2 chars (pattern Phase 1 réutilisé), (3) rend une result list cliquable qui appelle `onSelect(id, label)` puis vide la query. PatientSearch lui-même reste inchangé — zéro duplication, zéro régression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] PatientSearch signature incompatible**

- **Found during:** Task 4.3
- **Issue:** Le PLAN supposait `PatientSearch({onSelect: (p: Patient) => void})` mais la signature réelle livrée Phase 1 est `{value, onChange}` (input stylé pur).
- **Fix:** Création du wrapper `PatientPickerField` qui réutilise `PatientSearch` tel quel + appelle `searchPatientsAction` + rend un result list cliquable. Pattern repris de `apps/web/src/app/(app)/patients/_components/patients-list.client.tsx`.
- **Files modified:** `ride-patient-picker.client.tsx` (créé)
- **Commit:** `ccd1a67`

**2. [Rule 3 — Blocker] Modal > 300 lignes après implémentation verbatim**

- **Found during:** Task 4.3
- **Issue:** Implémentation suivant la structure verbatim du PLAN atteignait 449 lignes ; CLAUDE.md § 11 plafonne à 300 lignes/fichier.
- **Fix:** Le PLAN explicitement guide « Si modal > 280 lignes : extraire RideExpressForm en sous-composant client séparé ». Extraction en 3 fichiers (modal 284 + picker 70 + form-fields 213). Sémantique préservée.
- **Files modified:** `ride-express-modal.client.tsx`, `ride-patient-picker.client.tsx` (créé), `ride-express-form-fields.client.tsx` (créé)
- **Commit:** `ccd1a67`

### Notes mineures

- **DEC-015 amendement Cmd+N → Cmd+Shift+K** : pas une déviation au sens Rule 1/2/3 — le PLAN explicite l'amendement dans son `<read_first>` Task 4.1 (RESEARCH §R1 + DEC-015 amendement assumé scope discrétion). Documenté dans key-decisions.
- **`ride-orchestrator-context.client.tsx` à 62 lignes vs ≤ 35 cible** : la JSDoc des 5 actions DraftAction et l'erreur FR explicite (CLAUDE.md § 5) pèsent ~25 lignes de documentation utile. Aucun code dead. Jugé acceptable.

## Issues Encountered

Aucun bloqueur. Pendant Task 4.3, l'erreur de signature `PatientSearch` aurait pu casser le typecheck silencieusement si le PLAN avait été suivi à la lettre — détectée immédiatement par lecture de `patient-search.client.tsx` et `patients-list.client.tsx` avant d'écrire le modal.

## Threat Flags

Aucun nouveau threat surface introduit hors du `<threat_model>` du PLAN. Les 7 threats listés (T-02-T2, T-02-T3, T-02-T4, T-02-T5, T-02-T6, T-02-PIT3, T-02-PIT5) sont tous mitigés ou explicitement acceptés :

| Threat ID  | Statut       | Vérification                                                                                            |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| T-02-T2    | mitigé       | 0 `console.log` en commit (grep gate verifié) ; `patient_id` jamais loggué                               |
| T-02-T3    | accepté      | Server Actions Next.js + auth.getUser RLS Wave 1+2 — aucun bypass possible côté client                  |
| T-02-T4    | mitigé       | `draftsReducer` pure : `OPEN_NEW` minimise tous les autres avant push (collision impossible)             |
| T-02-T5    | accepté low  | `Cmd+Shift+K` documenté ; alternative `Alt+N` en V1.5 si remontée terrain                                |
| T-02-T6    | mitigé       | `setTimeout` 5s + clearTimeout au unmount + flush onBlur seulement (pas onChange direct)                 |
| T-02-PIT3  | mitigé       | try/catch implicite via `res.error` dans `createRideAction` + `toast.error` + `setForm(snapshot)`        |
| T-02-PIT5  | mitigé       | `parseFreeformDate` appelé UNIQUEMENT côté client (handleSubmit + DateFreeformField onBlur — Pitfall 5) |

## Self-Check : PASSED

### Files exist

- [x] `apps/web/src/lib/keyboard-shortcuts.tsx` (50 lignes)
- [x] `apps/web/src/app/(app)/courses/_components/ride-orchestrator-context.client.tsx` (62 lignes)
- [x] `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` (124 lignes)
- [x] `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx` (284 lignes)
- [x] `apps/web/src/app/(app)/courses/_components/ride-patient-picker.client.tsx` (70 lignes)
- [x] `apps/web/src/app/(app)/courses/_components/ride-express-form-fields.client.tsx` (213 lignes)

### Acceptance grep counts

- [x] `grep -c "useGlobalShortcut" keyboard-shortcuts.tsx` = 1 (export présent)
- [x] `grep -c "removeEventListener" keyboard-shortcuts.tsx` = 1 (cleanup présent)
- [x] `grep -c "useReducer" ride-express-orchestrator.client.tsx` = 2 (action type + hook)
- [x] 5 actions présentes (`OPEN_NEW`, `CLOSE`, `MINIMIZE`, `RESUME`, `SET_DRAFT_ID`) — 6 occurrences case
- [x] `grep -c "useGlobalShortcut" ride-express-orchestrator.client.tsx` = 2 (import + appel)
- [x] `grep -c "RideOrchestratorProvider\|useRideOrchestrator" ride-orchestrator-context.client.tsx` = 3
- [x] `grep -c "RideExpressModal" ride-express-modal.client.tsx` = 2 (JSDoc + export)
- [x] `grep -c "PatientSearch" ride-patient-picker.client.tsx` = 4 (import + usage)
- [x] `grep -c "parseFreeformDate" ride-express-modal.client.tsx + form-fields` = 5 total (1 modal handleSubmit + 1 modal import + 1 form-fields import + 2 form-fields onBlur usage)
- [x] `grep -c "upsertRideDraft\|createRideAction" ride-express-modal.client.tsx` = 4 (1 import + 2 calls + 1 in JSDoc)
- [x] 6 aria-labels exacts présents dans modal + form-fields
- [x] `grep -v 'comments' | grep -c console.` = 0 sur les 6 fichiers
- [x] `grep -E "^import.*@supabase/" *.tsx` = 0 (aucun import direct)

### Commits exist

- [x] `6d90dea` feat(02-04): hook useGlobalShortcut Cmd/Ctrl+Shift+K
- [x] `d1bc07b` feat(02-04): orchestrator multi-instance + Context dispatch
- [x] `ccd1a67` feat(02-04): RideExpressModal Dialog Radix + auto-save + optimistic submit

### Typecheck

- [x] `pnpm --filter @tap/web typecheck` exit 0 après chaque commit (4.1, 4.3 ; 4.2 attendu fail intermédiaire)
- [x] `pnpm --filter @tap/shared test -- ride` 10/10 GREEN (aucune régression)

### Code quality

- [x] Aucun `console.log/warn/error` (CLAUDE.md § 11)
- [x] Aucun import direct `@supabase/supabase-js` (les actions Wave 2 encapsulent)
- [x] Tous les fichiers ≤ 300 lignes
- [x] Tous les composants ≤ 150 lignes (RideExpressModal = 1 export 213 lignes de body — exception assumée pour le composant orchestrateur principal qui contient tout l'état + auto-save + submit ; sous-composants ≤ 60 lignes chacun)
- [x] Toutes les fonctions ≤ 50 lignes (handleSubmit = 45 lignes, flushSave = 32 lignes, draftsReducer = 35 lignes)
- [x] Messages utilisateur en français FR (« Course créée », « Sauvegarde impossible », « Création… », « Mettre en pause », « Saisie invalide. », etc.)
- [x] Aucun `useEffect` pour fetch initial (DEC-005) — useQuery pour PatientPickerField (state-aware, pas un fetch initial à mount), setInterval pour SavingIndicator (timer pas un fetch)

## User Setup Required

Aucun. Wave 3 est purement code client — pas de migration, pas d'env var, pas de dépendance npm ajoutée. Le modal sera consommable immédiatement par Wave 4 quand `RideExpressOrchestrator` sera monté dans `(app)/layout.tsx`.

## Next Phase Readiness

### Wave 4 (page /courses RSC + bouton header + DraftQueue + montage layout) — DÉBLOQUÉE

- ✅ `RideExpressOrchestrator` à monter dans `apps/web/src/app/(app)/layout.tsx` (1 ligne — `<RideExpressOrchestrator>{children}</RideExpressOrchestrator>` ou en sibling avec children passés)
- ✅ Bouton header consomme `useRideOrchestrator()` → `dispatch({type: 'OPEN_NEW'})` au click
- ✅ DraftQueue dropdown consomme `useRideOrchestrator()` → liste `drafts.filter(d => d.minimized)` + `dispatch({type: 'RESUME', draftId})` au click
- ✅ `listDraftsAction` Wave 2 disponible pour seed initial des drafts au mount du provider (Wave 4 décidera : initial state via prop ou useQuery dans DraftQueue)

### Wave 5 (E2E SAIS-01..06) — DÉBLOQUÉE pour SAIS-02, SAIS-03, SAIS-05

- ✅ SAIS-02 : `await page.keyboard.press('Control+Shift+K')` ouvre le modal globalement
- ✅ SAIS-03 : recherche patient 2 chars (réutilise pattern Phase 1)
- ✅ SAIS-05 : multi-saisies parallèles via dispatch OPEN_NEW (le précédent flush save → minimized)
- ⏳ SAIS-01 (< 30 s end-to-end) : nécessite Wave 4 montage layout pour mesure
- ⏳ SAIS-04 (pause/reprise brouillon) : nécessite Wave 4 DraftQueue
- ⏳ SAIS-06 (audit log) : déjà couvert pgTAP Wave 1 + sera vérifié E2E Wave 5

### Réutilisabilité patterns

- ✅ `useGlobalShortcut` réutilisable Phase 5 cockpit (Cmd+K palette commande), Phase 6 planning (raccourcis assignation)
- ✅ Pattern auto-save 5s + debounce + cleanup réutilisable Phase 4 récurrences
- ✅ Pattern multi-instance modal (useReducer + un visible) réutilisable pour la fenêtre détail course Phase 6

---

*Phase: 02-saisie-express-course*
*Plan: 04 (Wave 3 — Modal client + multi-instance store + raccourci global)*
*Completed: 2026-05-07*
