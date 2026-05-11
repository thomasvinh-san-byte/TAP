# Phase 3 — Passe 1 (squelette E2E) — Pattern Map

**Status** : Squelette à instruire (PATTERNS non encore mappés)

> Ce fichier reste un squelette tant qu'un cycle d'instruction PATTERNS n'a pas été lancé. Il a vocation à être rempli avant le premier 03-01-PLAN, en suivant la même structure que `02-PATTERNS.md`.

---

## Instructions de remplissage

Avant d'écrire `03-01-PLAN.md`, produire ce document en mappant chaque fichier à créer / modifier sur son analog le plus proche (Phase 1 ou Phase 2 majoritairement). Sections attendues :

1. **File Classification** — tableau `Fichier | Rôle | Data flow | Analog le plus proche | Qualité du match` couvrant :
   - 3 migrations Supabase (drivers, vehicles, rides_execution)
   - 3 fichiers pgTAP RLS (drivers, vehicles, rides extension)
   - Server Actions courses étendues (assign / unassign / updatePayment)
   - Server Actions driver (start / end)
   - Queries RSC (drivers list, vehicles list, ride detail, ride day list)
   - Pages dirigeant : `/admin/chauffeurs`, `/admin/vehicules` (page + formulaire + liste)
   - Pages régulateur : `/courses` étendu + `/courses/[id]` drawer
   - Pages chauffeur : `(driver)/layout.tsx` + `(driver)/conduite/page.tsx` + `(driver)/conduite/[rideId]/page.tsx`
   - Composants client (formulaires, modal de clôture, liste journalière mobile)
   - Validators `packages/shared/src/validators/{driver,vehicle,ride-execution}.ts`
   - Seed étendu (3 chauffeurs + 3 véhicules 974)
   - E2E `apps/web/tests/e2e/passe1.spec.ts`

2. **Pattern Assignments** — pour chaque fichier non trivial, citer le fichier analog avec lignes précises et indiquer ce qui se copie / ce qui dévie.

3. **Greenfield zones** — identifier les zones sans analog direct (probablement : layout `(driver)` mobile-first, modal de clôture chauffeur avec saisie tarif). Pour ces zones, noter les hints (composants shadcn existants, conventions design system).

4. **Risques de pattern** — relever où les patterns Phase 1/2 pourraient mal vieillir en contexte mobile chauffeur (taille des boutons 56px, espacement clé, pas de modal centré sur 375px).

---

## Sources d'inspiration confirmées

- `supabase/migrations/20260507000001_patients.sql` — pattern migration + RLS + audit trigger
- `supabase/migrations/20260509000001_rides.sql` — pattern ALTER table cohabitant avec types enum
- `supabase/tests/patients.sql` — pattern pgTAP RLS multi-rôles
- `apps/web/src/app/(app)/patients/` — pattern CRUD régulateur (page RSC + actions + drawer)
- `apps/web/src/app/(app)/courses/` — pattern liste + Server Actions transactionnelles
- `packages/shared/src/validators/patient.ts` — pattern zod + `z.infer` partagé front/back
- `apps/web/tests/e2e/saisie-express.spec.ts` — pattern E2E avec login multi-rôles

## Zone sans analog (à concevoir avec soin)

- Layout `(driver)` mobile-first : aucun analog dans le repo. Pilier UX 1 (CLAUDE.md §1) impose 56px boutons, 18px texte, une action principale par écran. Le design system shadcn existant doit être consulté pour Button size variants ou wrapper local.
