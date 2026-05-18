# Captures Visible Progress — Phase 04.9 PWA chauffeur enveloppe

Captures preuves démontrables (CLAUDE.md § 13.5 Visible Progress Mandate) de la livraison PWA cross-platform Option A LOCKED.

## Captures attendues (à fournir par dirigeant sur devices réels)

### iPhone (cible iPhone 13/14 ou SE)

- `iphone-home-screen.png` — icône `apple-touch-icon-180` sur écran d'accueil iOS
- `iphone-splash.png` — splash `apple-launch-*.png` visible 1-2s
- `iphone-conduite-standalone.png` — premier écran `/conduite` mode standalone (sans Safari chrome)

### Android (cible Samsung Galaxy A-series ou équivalent)

- `android-home-screen.png` — icône maskable dans launcher
- `android-splash.png` — splash auto-généré manifest (`background_color`)
- `android-conduite-standalone.png` — premier écran `/conduite` mode standalone

### Flow offline → sync

- `course-offline-sync.gif` (ou `.mp4` ≤ 5 Mo) :
  1. `/conduite` avec liste courses
  2. Toggle mode avion (icône statusbar)
  3. Click « Démarrer course »
  4. Toast « Mutation enregistrée »
  5. `ConnectionStatus` passe `offline_with_queue` + count=1
  6. Toggle mode avion off
  7. `ConnectionStatus` passe `synching` puis `online_idle`
  8. Mutations syncées (Dexie vide)

## Note

Les captures sont produites par le dirigeant lors de l'UAT informel Wave 6 sur devices réels (impossible côté agent — pas d'accès iPhone/Android physique).

Soit push sur la branche `feat/04.9-wave7-cloture` avant merge PR #116, soit commit séparé sur main après merge.

## Refs

- PR #109-#116 (8 PR cumulées Phase 04.9)
- PLAN-7.md (référentiel Wave 7)
- UI-SPEC PR #110 (wireframes ASCII des 4 états `ConnectionStatus`)
- CLAUDE.md § 13.5 Visible Progress Mandate
