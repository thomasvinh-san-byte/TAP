# Showcase — Phase 06.7 : Optimisation de tournées

**Phase** : 06.7 — OR-Tools optimisation de tournées
**Livré** : 2026-06-01 (Wave 3)
**Écran principal** : `/cockpit/optimisation`

---

## Artefacts visuels

Les captures d'écran et enregistrements vidéo seront produits depuis la preview Vercel
après merge de la branche `plan/06.7-or-tools-wave3` et provision du service Python
(Task 0 — gate opérateur).

Format attendu :
- `cockpit-bouton-optimiser.png` — bouton « Optimiser la journée » dans l'en-tête du cockpit
- `ecran-optimisation-proposition.png` — vue comparative plan actuel / plan proposé avec indicateurs
- `groupement-accepte.png` — état d'un groupement après clic « Accepter » (bordure verte)
- `sheet-ajuster.png` — Sheet latéral « Ajuster » ouvert

Dimensions : PNG ≤ 500 Ko chacun.

---

## Walkthrough pour la régulatrice (5-10 étapes)

Ce script permet de valider visuellement la valeur livrée par la phase.

1. Aller sur `/cockpit` (connexion avec `regulateur@demo.tap` / `demo1234!` sur la preview Vercel).
2. Vérifier la présence du bouton « Optimiser la journée » (icône Sparkles) dans l'en-tête.
3. Cliquer le bouton — la page `/cockpit/optimisation` s'ouvre avec la date du jour.
4. Cliquer « Lancer le calcul » — un skeleton s'affiche pendant 2-5 secondes.
5. La proposition s'affiche : colonne gauche (Plan actuel) + colonne droite (Plan proposé), bande
   d'indicateurs « Taux de mutualisation estimé » et « Km à vide estimés » en haut.
6. Cliquer « Accepter » sur le premier groupement — la carte passe en bordure verte.
7. Cliquer « Ajuster » sur un autre groupement — le Sheet latéral s'ouvre, permettant de retirer
   une course ou de changer le véhicule.
8. Cliquer « Appliquer les groupements acceptés » — un dialog de confirmation s'affiche.
9. Confirmer — un toast de succès apparaît (« N groupement(s) enregistré(s). »).
10. Vérifier que le cockpit reste accessible pendant toute l'opération (D-14 : la navigation
    n'est jamais bloquée).

---

## Points de vérification pour la validation dirigeant (Task 4)

- Aucun libellé « affecté automatiquement » visible (D-14).
- Exactement 2 indicateurs, chacun contenant le mot « estimé » (D-19/D-20).
- Si des courses sans coordonnées sont présentes dans le seed, la section
  « Courses non incluses dans le calcul » est visible (D-17).
- Les zones de Hauts (Cilaos, Salazie) déclenchent le badge ambre « À vérifier » (D-10).

---

## Notes sur l'état du déploiement

La Wave 3 livre le code complet. Le déploiement du service Python (Task 0, gate opérateur)
est distinct :

- `services/optimizer/vercel.json` : configuré (Option A Vercel Services, maxDuration: 10).
- Provision Vercel : à réaliser par l'opérateur (voir `services/optimizer/README.md`).
- Mesure cold start (DEC-079 (c)) : en attente de la provision (p50/p95 à documenter ici).
- `OPTIMIZER_SERVICE_URL` : à configurer dans Vercel Settings (preview + production).

Tant que `OPTIMIZER_SERVICE_URL` n'est pas configuré, l'écran affiche un message d'erreur
sobre et le cockpit reste fonctionnel (T-06.7-12 mitigé).
