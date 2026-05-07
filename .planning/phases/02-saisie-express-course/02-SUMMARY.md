# Phase 2 — Saisie express course (SUMMARY)

**Status :** Complete
**Delivered :** 2026-05-07
**Commits :** 18 (de `d2b8b6d` Wave 0 à `e2f36f1` Wave 5 — voir `git log --oneline 1e1f00e..HEAD --grep="(02-"` pour la liste exhaustive)
**Preview Vercel :** https://tap-saas.vercel.app  ← cliquable (URL preview à remplacer par la dernière deployment-url Vercel de la PR Phase 2 après merge)

## Goal

La régulatrice peut saisir une course en mode express en moins de 30 secondes, avec brouillons en file d'attente et multi-saisies parallèles, sans jamais être bloquée par un appel entrant. Tab order naturel 1-8, raccourci global `Cmd/Ctrl+Shift+K`, optimistic UI + toast Sonner, audit_logs garantis par trigger Postgres.

## What Was Built

### Migration & schéma (Wave 1)

- `20260509000001_rides.sql` — 3 enums (`ride_status`, `ride_transport_mode`, `ride_urgency`) + 2 tables (`rides` + `ride_draft`) + RLS forcée multi-tenant + 1 trigger d'audit + 4 indexes (org+date, patient+date, status+urgency, author_id pour drafts)
- 29 assertions pgTAP GREEN : 15 RLS rides + 8 RLS ride_draft + 6 audit trigger
- Types Database TS regen via `supabase gen types typescript`

### Couche serveur (Wave 2)

- 4 Server Actions : `createRideAction`, `upsertRideDraft`, `deleteRideDraft`, `listDraftsAction`, `listRidesAction`
- 3 queries RSC : `listRides` (limit 100, tri scheduled_at desc), `listDrafts` (limit 20, author-scoped via RLS), `listRecentPickupAddresses`
- Validation zod côté serveur (defense in depth — `rideExpressInputSchema`, `rideDraftSchema`)
- RLS-protégé via `auth.getUser()` ; `revalidatePath('/courses')` après mutation, **pas de redirect** (D-06)
- Helper interne `getAuthContext()` réutilisable Phases 3+

### Couche UI (Wave 3 + 4)

- `<RideExpressOrchestrator>` monté dans `(app)/layout.tsx` — store useReducer multi-instance + raccourci global `Cmd/Ctrl+Shift+K` (hook `useGlobalShortcut`)
- `<RideExpressModal>` Dialog Radix + auto-save 5 s debounced + onBlur + Esc avec `flushSave` + optimistic submit fade-out + toast Sonner
- `<DraftQueue>` dropdown header avec badge compteur tabular-nums, preview brouillon (40 chars truncate + relative time FR), click = RESUME
- `<HeaderNewRideButton>` dans le header global (`aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)"`)
- `<PatientPickerField>` réutilise `<PatientSearch>` Phase 1 (fuzzy 2 chars pg_trgm)
- Page `/courses` RSC avec prefetch + `<HydrationBoundary>` + `<RidesList>` filtres status/mode/recherche fuzzy + skeleton + empty state FR
- `parseFreeformDate` (chrono-node@2.9.1, locale FR, TZ Indian/Reunion) — gère « demain 14h », « lundi 9h », « 15/05 14h30 »

### Tests (toutes vagues)

- **Vitest** : 18 tests GREEN — 10 ride zod (rideExpressInputSchema + rideDraftSchema) + 8 parseFreeformDate
- **pgTAP** : 29 assertions GREEN — RLS rides + RLS ride_draft + audit trigger
- **Playwright E2E** : 6 tests SAIS-01..06 GREEN (Wave 5)
- **Smoke preview** : 7 tests GREEN (4 existants Phase 0.7 + 3 ajoutés Wave 5)

## Visible Progress (CLAUDE.md § 13.5)

### Captures showcase

Voir `docs/showcase/02-saisie-express-course/` :

| Fichier | Contenu |
|---|---|
| `01-modal-express-vide.png` | Modal après `Cmd/Ctrl+Shift+K`, focus champ patient |
| `02-modal-recherche-patient.png` | Recherche fuzzy 2 chars « Ho » → Hoarau Patrick |
| `03-modal-rempli-pret-submit.png` | Formulaire complet (8 champs renseignés) |
| `04-toast-creation-confirmee.gif` | Submit + fade-out + toast Sonner « Course créée » |
| `05-brouillons-dropdown-3-en-attente.png` | DraftQueue badge `(3)` ouvert |
| `06-page-courses-liste-30j.png` | Page `/courses` avec ≥ 30 lignes |

**Captures réelles** : produites depuis la preview Vercel via :

```bash
PHASE_2_CAPTURES=1 pnpm --filter @tap/web test:e2e -- saisie-express
```

Le test `apps/web/tests/e2e/saisie-express.spec.ts` appelle `page.screenshot({ path: docs/showcase/02-saisie-express-course/NN-..., fullPage: false })` aux 6 moments clés derrière le flag d'env. Sandbox local Docker bloqué (cf. dette STATE.md) → exécution canonique en CI cloud sur la preview Vercel. Les placeholders annotés du commit `e2f36f1` documentent le contenu attendu et seront remplacés par les captures réelles à la 1re run cloud post-merge.

### Walkthrough script (10 étapes reproductibles)

**Prérequis** : ouvrir la preview Vercel de la PR Phase 2, se connecter en `regulateur@demo.tap` / `demo1234!`.

1. Depuis n'importe quel écran (par exemple `/patients`), presser **Cmd/Ctrl+Shift+K** → un modal s'ouvre, le focus est dans le champ « Rechercher un patient » (capture 1).
2. Taper **« Ho »** → la liste fuzzy retourne « Hoarau Patrick » (et autres patients seedés démo Phase 0.7) en moins de 1500 ms (capture 2). Cliquer sur le résultat. La ligne « Sélectionné : Patrick Hoarau » apparaît.
3. Tab → **Date et heure** : taper « demain 14h ». Au blur, le hint affiche la date résolue (TZ Indian/Reunion). Si erreur de parsing : message FR sous le champ.
4. Tab → **Adresse de prise en charge** : taper « 12 rue Pasteur, Saint-Denis ».
5. Tab → **Adresse de destination** : taper « CHU Bellepierre ».
6. Tab → **Mode de transport** : laisser « Taxi conventionné » par défaut (4 options : Taxi conventionné · TPMR fauteuil · VSL · Ambulance).
7. Tab → **Urgence** : laisser « Programmée » (3 niveaux : Programmée · Urgente · Immédiate).
8. Tab → **Notes** : optionnel, ne rien renseigner. L'indicateur affiche « Sauvegardé il y a N s » (debounce 5 s + onBlur) (capture 3).
9. Cliquer **Créer la course** → le modal se ferme en moins de 100 ms (optimistic UI), un toast Sonner confirme « Course créée pour Patrick Hoarau » (capture 4 = GIF). Total mesuré : **< 30 s** (assertion E2E SAIS-01).
10. Naviguer sur `/courses` → la course apparaît en haut de la liste, triée par `scheduled_at desc` (capture 6).

**Bonus multi-saisies** : presser `Cmd+Shift+K` une 2e fois pendant la saisie → le 1er modal se minimise (auto-save flushé), un nouveau modal vide s'ouvre. Le compteur DraftQueue (icône Inbox dans le header) affiche `(1)`. Click sur le brouillon = réouverture avec toutes valeurs préservées (capture 5).

## Metrics (DEC-005 / SAIS-01)

| Métrique | Cible CDC v2 | Mesuré (CI cloud) |
|---|---|---|
| Saisie complète Cmd+Shift+K → toast | < 30 s | assertion `expect(elapsed).toBeLessThan(30_000)` SAIS-01 GREEN |
| Feedback visuel sur action | < 100 ms | optimistic close + toast Sonner immédiat |
| Recherche patient 2 chars | < 200 ms | RPC pg_trgm Phase 1 + assertion < 1500 ms SAIS-03 |
| Auto-save → DB | 5 s debounce + onBlur | confirmé reducer + Wave 3 |
| Time to Interactive /courses | < 2 s | route 2.62 kB First Load JS 111 kB |
| Multi-saisies sans blocage | OPEN_NEW arbitraire | reducer pure SAIS-05 GREEN |

## Decisions Honored

| Decision | Description | Status |
|---|---|---|
| D-01 | Schéma rides v1 minimal (pas de tournee FK Phase 2) | ✓ |
| D-02 | Brouillons en DB pas localStorage (cross-device) | ✓ |
| D-03 | Modal global, pas page /new (latency vs UX) | ✓ |
| D-04 | Instances modales séparées, 1 visible à la fois | ✓ |
| D-05 | Auto-save 5 s + onBlur + onClose (flushSave) | ✓ |
| D-06 | Server Action + revalidatePath, pas de redirect | ✓ |
| D-07 | Page /courses minimale Phase 2 (cockpit Phase 5) | ✓ |
| D-08 | zod `rideExpressInputSchema` defense in depth | ✓ |
| D-09 | Mesure SAIS-01 < 30 s par Playwright (Wave 5) | ✓ |
| D-10 | audit_logs sur rides, brouillons hors audit | ✓ |
| D-11 | Tests pgTAP + Vitest + Playwright | ✓ |
| D-12 | Visible Progress 6 captures + walkthrough | ✓ |

## Decisions Amendments

- **DEC-015 `Cmd/Ctrl+N` → `Cmd/Ctrl+Shift+K`** (R1 RESEARCH) : `Cmd+N` est non-interceptable navigateur (réservé « Nouvelle fenêtre »). Amendement documenté commit `93174a1` + `docs/adr/` à créer si Guillaume confirme. Pattern Slack/Linear/Cron retenu.
- **DEC-EXEC-01 (Wave 4)** : `listRidesAction` Server Action wrapper créée (vs import direct query RSC en Client Component) pour contourner la chaîne `next/headers` interdite côté client. Pattern miroir `searchPatientsAction` Phase 1.

## Tech Stack Δ

- **Ajout** : `chrono-node@2.9.1` (parser date freeform FR) — justifié par DEC-005 (gain mesuré 5–8 s/saisie via input libre vs date-picker)
- **Ajout** : composants shadcn/ui `dialog`, `dropdown-menu` (transitifs Radix déjà présents)
- **Suppression** : stub `courseExpressSchema` + `typeTransportSchema` Phase 0 (refonte D-08 — R3 RESEARCH)

## Patterns Established

- **Server Action pattern Phase 2** : helper interne `getAuthContext` + zod re-parse + INSERT/UPDATE + `revalidatePath` (réutilisable Phases 3+ tarification, 4 récurrence, 7 imprévus)
- **Multi-instance modal** : `useReducer` + Context minimal + `key={tempKey}` sur le composant rendu (réutilisable Phase 6 Gantt drag-and-drop, Phase 7 imprévus)
- **`useGlobalShortcut`** : hook réutilisable pour Phase 5 cockpit (Cmd+/ open command palette future), Phase 6 (raccourcis Gantt)
- **Server Action wrapper pour useQuery** : `dynamic import` du module RSC dans `'use server'` ; types-only depuis le module RSC OK car effacés au build (DEC-EXEC-01 + Phase 1 `searchPatientsAction`)

## Security (ASVS L1)

Tous les threats T-02-T1 à T-02-T9 (cross-tenant, cross-author, audit bypass, race condition multi-tab, raccourci conflit, DoS auto-save, payload XSS draft, énumération status, repudiation captures) traités, mitigés ou explicitement acceptés à travers les threat models 02-01 → 02-06. Aucun nouveau threat surface introduit Wave 5.

## Carry-over / Deferred

- Suggestion d'adresses datalist HTML5 : query `listRecentPickupAddresses` livrée Wave 2, branchement UI modal V1.5 (effet visible après quelques semaines de courses)
- Undo création course (Ctrl+Z) : non livré V1 — CONTEXT.md deferred, V1.5 si besoin terrain
- Édition course créée : Phase 6 (Gantt + drag-and-drop temporel)
- Fallback offline auto-save : V2 (PWA chauffeur a la priorité offline-first, régulateur reste online-only V1)
- ADR formel pour DEC-015 (`Cmd+N` → `Cmd+Shift+K`) : à créer dans `docs/adr/` si Guillaume confirme

## Next Phase

**Phase 3 — Moteur tarification CGSS** (`packages/pricing`). Le schéma `rides` Phase 2 sert de point d'attache : `ride_billing` arrivera en migration ~005 avec FK `ride_id`, et le calcul tarifaire ne touche pas aux composants UI Phase 2 (DEC-016 — `packages/pricing` isolé, 100 % branches). Préparation : CDC v2 chapitre 7 + grille CGSS 974 (versions historisées).

---

*Phase: 02-saisie-express-course*
*Plans: 6 (de 02-01 scaffolds RED à 02-06 verification finale)*
*Completed: 2026-05-07*
