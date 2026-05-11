# Phase 3 — E2E Passe 1 (squelette + clôture)

Captures Visible Progress (CLAUDE.md § 13.5) à produire après merge de la
PR clôture Passe 1, pour validation manuelle dirigeant et rituel 5/5.

Convention de nommage : numéro à 2 chiffres + slug en français
(`NN-slug-en-francais.{png,gif}`).

## Captures attendues

- `01-shell-mode-jour.png` — shell régulateur en mode jour (header sticky, tabs Patients/Courses, UserMenu)
- `02-shell-mode-nuit.png` — shell régulateur en mode nuit (même cadrage)
- `03-liste-patients-enrichie.png` — `/patients` avec header 2 CTA (« + Nouvelle course » + « Nouveau patient »)
- `04-liste-courses-colonnes-denses.png` — `/courses` 30 lignes, colonnes denses, filtres actifs
- `05-drawer-course-assignee.png` — drawer course statut « assignée » avec bouton « Modifier » visible
- `06-modal-edition-course.png` — modal édition pré-remplie, titre « Modifier la course », bouton « Enregistrer les modifications »
- `07-modal-assignation-chauffeur.png` — modal assignation chauffeur + véhicule
- `08-conduite-chauffeur-mobile-375.png` — `/conduite` mobile 375 px, clusters « Aujourd'hui » + « Demain »
- `09-modal-cloture-bottom-sheet.png` — modal clôture mobile bottom-sheet (paiement)
- `10-page-dev-switch-session.png` — page `/dev` 3 cards démo (DD / RD / CD)

Les captures **doivent** utiliser le seed démo 974 (Phase 0.7) après
application de la migration `20260513000002_anonymize_seed_profiles.sql` —
aucun nom propre ne doit apparaître côté profils démo.

## Walkthrough script

Détaillé dans `.planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md`
section « Walkthrough script » (12 étapes).

## Statut

| Item | Statut |
|---|---|
| Convention de nommage | OK (ce fichier) |
| Captures `.png` / `.gif` | À produire post-merge sur preview Vercel |
| Walkthrough script | OK (`03-SUMMARY.md`) |
| URL preview Vercel | À compléter après merge |
| Rituel 5/5 | À jouer après captures |
