# Phase 4 — Passe 2 (PWA + tarif standard) — Context (esquisse)

**Pivot ADR** : ADR-003 (2026-05-11)
**Status** : Esquisse — détails à compléter à l'approche de la phase

---

## Goal

Le chauffeur a une PWA installable qui fonctionne 5 minutes hors-ligne pour les actions critiques. Le tarif du cas standard CGSS (taxi conventionné, forfait court trajet) se calcule automatiquement à la clôture. La régulatrice voit un récap caisse en fin de journée chauffeur.

## Périmètre

**Dans :**

- Manifest PWA + service worker minimal (workbox ou hand-rolled)
- Sync différée des actions « Démarrer » / « Clôturer » via IndexedDB + queue
- `packages/pricing` package créé : 1 grille tarifaire CGSS hardcodée pour le forfait court trajet, 100 % tests Vitest
- `tarif_source = 'cgss_auto'` calculé à la clôture, override manuel possible
- Récap caisse `/admin/caisse` : par chauffeur, par jour, total encaissé
- Affichage TTS du nom patient + adresse au démarrage (option simple)

**Hors :**

- Grilles tarifaires multiples (nuit, dimanche, brancardage, kilométrique) — Passe 3
- Récurrences — Passe 3
- Cockpit temps réel — Passe 3
- Optimisation tournée — Passe 4

## Critère de fin

Un chauffeur fait sa journée sans le dev, en zone à signal médiocre. La régulatrice valide le récap caisse du soir. Le calcul automatique tarif est correct sur 10 courses témoins (validation manuelle face à la grille CGSS).

## Estimation grossière

8 à 12 jours-dev.
