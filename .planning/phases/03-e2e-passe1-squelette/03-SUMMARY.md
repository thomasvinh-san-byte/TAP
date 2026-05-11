---
phase: 03-e2e-passe1-squelette
plan: cloture-passe-1
subsystem: e2e-passe-1-cloture
tags: [e2e, passe-1, edit-course, role-guards, anonymisation, driver-48h]
wave: cloture
requires: ["03-a", "03-b", "03-c", "03-d", "03-e", "03-g", "03-h", "03-i"]
provides:
  - "Migration SQL anonymisation profils démo (@demo.tap)"
  - "Role guards layouts (régulateur ↔ chauffeur, defense in depth RLS)"
  - "Driver query 48h (J + J+1) avec regroupement UI 'Aujourd'hui / Demain'"
  - "Édition d'une course existante (Server Action + modal en mode édition)"
  - "Bouton « Modifier » sur drawer course (statuts validee/assignee)"
  - "Showcase placeholders 10 captures pour validation manuelle"
affects:
  - "CLAUDE.md § 14 (Passe 1 close après validation manuelle dirigeant)"
  - "supabase/seed.sql + seed.demo.sql + setup-all.sql + setup-sql.ts"
  - "apps/web/(app)/layout.tsx + apps/web/(driver)/layout.tsx"
tech-stack:
  added: []
  patterns:
    - "Server Action zod safeParse + RLS Postgres + whitelist rôle applicative"
    - "Reducer OPEN_NEW / OPEN_EDIT exclusifs (rideId présent ⇒ mode édition)"
    - "Pré-chargement ride via hook dédié (use-ride-prefill) — extraction CLAUDE.md § 11"
    - "Borne TZ Indian/Reunion 48h (start, tomorrowStart, end) — pas d'Intl"
key-files:
  created:
    - supabase/migrations/20260513000002_anonymize_seed_profiles.sql
    - apps/web/src/app/(app)/courses/actions/edit.ts
    - apps/web/src/app/(app)/courses/_components/use-ride-prefill.client.ts
    - .planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md (this file)
    - docs/showcase/03-e2e-passe1-squelette/README.md
    - docs/showcase/03-e2e-passe1-squelette/generate-placeholders.py
  modified:
    - apps/web/src/app/(app)/layout.tsx (guard rôle chauffeur → /conduite)
    - apps/web/src/app/(driver)/layout.tsx (guard rôle non chauffeur → /patients)
    - apps/web/src/app/(driver)/conduite/page.tsx (clusters Aujourd'hui/Demain)
    - apps/web/src/app/(driver)/conduite/_lib/queries.ts (listMyRidesUpcoming 48h)
    - apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx (mode édition)
    - apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx (OPEN_EDIT)
    - apps/web/src/app/(app)/courses/_components/ride-orchestrator-context.client.tsx (DraftAction)
    - apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx (bouton Modifier)
    - apps/web/src/app/(app)/courses/actions/index.ts (export updateRideAction)
    - supabase/seed.sql + supabase/seed.demo.sql + supabase/setup-all.sql + apps/web/src/lib/setup-sql.ts (libellés démo)
decisions:
  - "Édition course avancée de Passe 2 vers clôture Passe 1 — friction terrain trop fréquente pour différer."
  - "Pas de nouveau test Playwright (politique tests allégée Passe 1, CLAUDE.md § 9)."
  - "Update bloqué côté serveur si status ∉ {validee, assignee} — règle métier garde-fou en plus du masquage UI."
  - "Bucket today/tomorrow calculé côté serveur (queries.ts) pour éviter de réimporter la borne TZ dans la page RSC."
  - "Anonymisation appliquée via migration idempotente + patch sources (seed.sql / setup-all.sql) pour idempotence en cas de réinit DB."
metrics:
  duration_minutes: 60
  completed_date: 2026-05-13
  files_modified: 11
  files_created: 5
---

# Phase 3 — Clôture Passe 1 : 12 frictions + édition course

Consolidation des frictions identifiées en validation manuelle après livraison des sous-blocs 03-A à 03-E + 03-G/H/I. Avant ce commit, la Passe 1 fonctionnait sur les 6 maillons mais montrait des frictions d'usage qui empêchaient un design partner d'enchaîner sans assistance.

## Goal

Critère de succès Passe 1 (CLAUDE.md § 14, ADR-003) : *« Un design partner enchaîne 5 courses sans assistance. »*  
Les frictions résiduelles (édition impossible, profils démo nominatifs, vue chauffeur limitée à J, role guards permissifs) compromettaient ce critère.

## What was built

### Thème A — Recherche & sélection patient *(livré 03-G/H/I, conservé)*
- Migration `20260513000001_search_patients_ilike_fix.sql` (ILIKE substring + word_similarity fallback)
- PatientPickerField pattern pill + clear (Stripe / Linear / Doctolib)
- Sync `patientLabel` depuis `initialPatientId` (ouverture depuis drawer patient)

### Thème B — Création & édition de course
- B.1 + B.2 — *(livré 03-G/I, conservé)* : Select shadcn + erreurs validation par champ via `flatten().fieldErrors`
- **B.3 — Édition d'une course existante (ce commit)** :
  - Server Action `updateRideAction` (zod + RLS + whitelist rôle + filtre statut)
  - Reducer `OPEN_EDIT` dispatché par le drawer
  - Hook `useRidePrefill` (pré-chargement ride au mount, extrait pour CLAUDE.md § 11)
  - Modal en mode édition : titre dynamique, bouton submit dynamique, masquage auto-save + « Mettre en pause »
  - Bouton « Modifier » dans header drawer course (statuts validee/assignee uniquement)

### Thème C — Navigation contextuelle *(livré 03-G, conservé)*
- C.1 — Bouton « + Nouvelle course » sur header `/patients`
- C.2 — Bouton « Créer une course pour ce patient » dans drawer patient

### Thème D — Session & rôles
- D.1 — *(livré 03-G, conservé)* : page `/dev` switch session démo
- **D.2 — Role guards layouts (ce commit)** :
  - `(app)/layout.tsx` : sans session → `/login`, chauffeur → `/conduite`
  - `(driver)/layout.tsx` : sans session → `/login`, non chauffeur → `/patients`
- **D.3 — Anonymisation profils démo (ce commit)** :
  - Migration idempotente `20260513000002_anonymize_seed_profiles.sql`
  - Patch sources `seed.sql` / `seed.demo.sql` / `setup-all.sql` / `setup-sql.ts`
  - Avatars UserMenu : DD / RD / CD (« Dirigeant Démo », etc.)

### Thème E — Vue chauffeur
- **E.1 — `listMyRidesUpcoming` 48h (ce commit)** :
  - Borne TZ `Indian/Reunion` étendue de J à J+1
  - Clusters UI « Aujourd'hui » / « Demain » sur `/conduite`
  - Bucket calculé côté serveur, projection 50 max conservée

## Visible Progress

### URL preview
Vercel preview URL à coller après merge : *(à compléter)*

### Captures attendues
Placeholders dans `docs/showcase/03-e2e-passe1-squelette/` :

| # | Capture | Sujet |
|---|---|---|
| 01 | `01-shell-mode-jour.png` | Shell régulateur mode jour |
| 02 | `02-shell-mode-nuit.png` | Shell régulateur mode nuit |
| 03 | `03-liste-patients-enrichie.png` | `/patients` + 2 CTA header |
| 04 | `04-liste-courses-colonnes-denses.png` | `/courses` 30 lignes |
| 05 | `05-drawer-course-assignee.png` | Drawer course assignée + bouton Modifier |
| 06 | `06-modal-edition-course.png` | Modal édition course (B.3) |
| 07 | `07-modal-assignation-chauffeur.png` | Modal assignation chauffeur |
| 08 | `08-conduite-chauffeur-mobile-375.png` | `/conduite` mobile 375 px |
| 09 | `09-modal-cloture-bottom-sheet.png` | Modal clôture mobile bottom sheet |
| 10 | `10-page-dev-switch-session.png` | Page `/dev` 3 cards démo |

## Walkthrough script (validation manuelle dirigeant)

1. Ouvrir la preview Vercel sur `/login`. Confirmer que les 3 comptes démo affichent « Dirigeant Démo / Régulateur Démo / Chauffeur Démo » (aucun nom propre).
2. Aller sur `/dev`. Cliquer « Régulateur Démo ». Vérifier redirection `/patients`.
3. Cliquer « + Nouvelle course » du header `/patients`. Modal s'ouvre vide. Esc.
4. Cliquer sur une ligne patient. Drawer s'ouvre. Cliquer « Créer une course pour ce patient ». Modal s'ouvre avec patient déjà en pill.
5. Saisir date « demain 10h », pickup, dropoff. Submit. Toast succès.
6. Sur `/courses`, ouvrir la course créée (drawer). Cliquer « Modifier ». Modal s'ouvre titré « Modifier la course » avec valeurs pré-remplies.
7. Changer la date. Cliquer « Enregistrer les modifications ». Toast « Course modifiée ». Drawer revisite la valeur mise à jour.
8. Sur la course modifiée, cliquer « Assigner un chauffeur ». Choisir « Chauffeur Démo ». Drawer met à jour le statut.
9. Aller sur `/dev`. Switcher vers « Chauffeur Démo ». Vérifier redirection `/conduite`.
10. Sur `/conduite`, vérifier que les courses sont regroupées en deux sections « Aujourd'hui » + « Demain » (créer une course J+1 en amont via régulateur).
11. Sur `/conduite`, démarrer la course, la clôturer (modal bottom sheet mobile 375 px).
12. Tenter d'accéder à `/patients` connecté en chauffeur : redirect `/conduite`. Inverse : régulateur sur `/conduite` → redirect `/patients`.

## Frictions identifiées (à remonter après validation)

À compléter après validation manuelle.

## Dette tracée — reportée Passe 2

- Affichage acteur dans audit_log limité à `actor_role` seul (pas d'enrichissement nom).
- Modal assignation : pas de filtrage `type_permis` ↔ `vehicle.type`.
- Refonte login + `/welcome` + `/setup` → 04-B Passe 2.
- Manifest PWA + offline → Passe 2.
- CRUD admin chauffeurs / véhicules → Passe 2.
- Modal édition course : pas de différenciation visuelle « Modifier » vs « Créer » au-delà du titre. Améliorable Passe 2 si besoin.
- Modal `ride-express-modal.client.tsx` à 384 lignes (limite CLAUDE.md § 11 = 300). Dette préexistante de Phase 2 ; non refactorée pour rester dans le scope clôture.
- Drawer `ride-drawer.client.tsx` à 312 lignes (idem, marge fine).

## Tech stack Δ

Aucune nouvelle dépendance npm. Aucun nouveau composant `/components/ui/`. Aucun nouveau test Playwright.

## Suite

→ Validation manuelle dirigeant (walkthrough ci-dessus) → rituel 5/5 → ouverture Passe 2 dans session fraîche.  
Référence séquencement : `.planning/passes-2-3-4-detail.md`.
