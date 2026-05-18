# Plan-7 — Captures Visible Progress + documentation finale

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 7/7
**Dépendances**: Wave 6 (E2E + UAT GREEN)
**Estimation**: 0.5h (vélocité projetée 10-15 min réel)
**Refs**: CLAUDE.md § 13.5 Visible Progress Mandate, VISION.md UAT informel

---

## Goal

Captures preuves + documentation finale Phase 04.9. Clôture pipeline GSD 5/5 verify-work intégrée.

---

## Captures à produire

### 1. PWA installée iPhone réel

Dossier `.planning/phases/04.9-pwa-chauffeur-enveloppe/captures/` :
- `iphone-home-screen.png` — icône `apple-touch-icon-180` sur écran d'accueil iOS
- `iphone-splash.png` — splash `apple-launch-1170x2532.png` visible 1-2s
- `iphone-conduite-standalone.png` — premier écran `/conduite` mode standalone (sans Safari chrome)

### 2. PWA installée Android réel

- `android-home-screen.png` — icône maskable dans launcher
- `android-splash.png` — splash auto-généré manifest (background_color)
- `android-conduite-standalone.png` — premier écran `/conduite`

### 3. Course offline + sync (GIF/MP4 ~10s)

- `course-offline-sync.gif` (ou `.mp4` ≤ 5 Mo) :
  1. `/conduite` avec liste courses
  2. Toggle mode avion (icône statusbar)
  3. Click « Démarrer course »
  4. Toast « Mutation enregistrée »
  5. ConnectionStatus passe `offline_with_queue` + count=1
  6. Toggle mode avion off
  7. ConnectionStatus passe `synching` puis `online_idle`
  8. Mutations syncées (Dexie vide)

---

## Fichiers à créer

- `.planning/phases/04.9-pwa-chauffeur-enveloppe/captures/` (dossier)
- `.planning/phases/04.9-pwa-chauffeur-enveloppe/04.9-SUMMARY.md`

## Fichiers à modifier

- `.planning/STATE.md` — `last_activity` Phase 04.9 livrée, progress completed_phases +1
- `.planning/codebase/CONCERNS.md` — section items différés Phase 04.9 → 05/06
- `.planning/ROADMAP.md` — case Phase 04.9 cochée `[x]`

---

## `04.9-SUMMARY.md` (~150 lignes)

Structure :

```markdown
# Phase 04.9 — PWA chauffeur enveloppe — SUMMARY

## Statut
Livrée [date]. Pipeline GSD 5/5 complet.

## 7 PR cumulées
- PR #109 discuss
- PR #110 UI-SPEC
- PR #111 plan
- PR #112 Wave 1 (Route Handlers + idempotency)
- PR #113 Wave 2 (Assets PWA)
- ...

## Vélocité
Estimé : 9.5h. Réel : Xh. Vélocité : Y% (cohérent historique 04.5/04.7).

## Captures Visible Progress
- captures/iphone-* (3 fichiers)
- captures/android-* (3 fichiers)
- captures/course-offline-sync.gif

## Frictions UAT remontées
[Liste éventuelle + hotfix-bis si applicable]

## Décisions émergentes
DEC-046+ si applicable (nouvelles décisions découvertes en execute).

## Items différés Phase 05 / 06
- Cache PWA régulateur /courses (Phase 05)
- Hors-ligne > 1h (Phase 06)
- Web Push notifications VAPID (Phase 06)
- Géolocalisation temps réel (Phase 06)
- Slide bidirectionnel iOS-style (Phase UI dédiée)
- Idempotency cleanup pg_cron (Phase 06)
- Réplication initiale rides_mirror (Phase 06)
- Migration api-adresse → Géoplateforme IGN (Phase 06, sans impact PWA chauffeur)
- Sentry observability service worker (Phase 06)
- Background Sync API quand iOS supporte (Phase futur)
```

---

## Modifications `STATE.md`

```yaml
status: Phase 04.9 livrée — PWA chauffeur opérationnelle iPhone + Android
stopped_at: Phase 04.9 complete — ready Phase 05 récurrences + cockpit
progress:
  completed_phases: 5  # +1
  completed_plans: 39  # +7 waves
last_activity: 2026-05-XX — Phase 04.9 PWA chauffeur enveloppe livrée
  complète (7 PR cumulées #109-#118 selon numérotation finale)...
```

---

## Modifications `CONCERNS.md`

Section nouvelle « Items différés Phase 04.9 → 05/06 » :
- Cache PWA régulateur `/courses` (Phase 05)
- Hors-ligne > 1h (Phase 06)
- Web Push VAPID (Phase 06)
- Géolocalisation temps réel (Phase 06)
- Idempotency cleanup pg_cron (Phase 06)
- Réplication initiale rides_mirror (Phase 06)

Note : dette `api-adresse → Géoplateforme IGN` reste comme inscrit PR #105 (impact PWA chauffeur = nul, pas d'autocomplete côté driver).

---

## Modifications `ROADMAP.md`

Cocher la case Phase 04.9 : `[ ]` → `[x]` (lignes 248-281).

Mettre à jour estimation réelle vs prévue dans le tableau global si présent.

---

## Critères GREEN Wave 7

- 6 captures PWA installée (3 iPhone + 3 Android) sauvegardées sous `captures/`
- 1 capture GIF/MP4 course offline + sync ≤ 5 Mo
- `04.9-SUMMARY.md` ~150 lignes complet
- `STATE.md` progress updated (completed_phases +1, completed_plans +7)
- `CONCERNS.md` items différés Phase 05/06 inscrits
- `ROADMAP.md` case Phase 04.9 cochée `[x]`
- 1 commit final clôture phase pushé sur main (via PR)

---

## Anti-patterns / NE PAS FAIRE

- ❌ Captures cropped / floues (preuve démontrable obligatoire, design partner doit pouvoir voir)
- ❌ GIF > 5 Mo (limite CLAUDE.md § 13.5)
- ❌ Skip captures Android (Option A LOCKED PR #109 — 2 devices)
- ❌ SUMMARY générique sans frictions UAT remontées (transparence sur ce qui n'a pas marché)
- ❌ Démarrer Phase 05 sans clôturer Wave 7 (pipeline GSD strict)
- ❌ Modifier décisions LOCKED ou refactor sous prétexte de cleanup
- ❌ Inscrire items « à revoir Phase suivante » sans dette CONCERNS structurée
