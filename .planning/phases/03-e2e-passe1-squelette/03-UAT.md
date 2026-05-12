---
status: complete
phase: 03-e2e-passe1-squelette
source:
  - .planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md
started: "2026-05-12T08:00:00Z"
updated: "2026-05-12T08:00:00Z"
mode: manual-walkthrough-pre-recorded
note: |
  Walkthrough joué manuellement par le dev solo sur preview Vercel
  (rituel pivot v2 § 5/5 captures publiables). Les 16 tests reflètent
  fidèlement le script § « Walkthrough script » de 03-SUMMARY.md.
  /gsd-verify-work 03 invoqué pour enregistrer le résultat dans le
  format UAT.md attendu par GSD (audit-uat tracking), pas pour rejouer
  les tests un par un.
---

## Current Test

number: 16
name: Course annulée — boutons Modifier/Annuler invisibles
expected: Statut figé, plus d'action utilisateur possible
awaiting: none (session complete)

## Tests

### 1. Login + comptes démo anonymisés
expected: Sur /login, les 3 comptes démo affichent « Dirigeant Démo / Régulateur Démo / Chauffeur Démo » (aucun nom propre).
result: pass

### 2. Switch session via /dev — redirection régulateur
expected: Sur /dev, cliquer « Régulateur Démo » → redirection /patients.
result: pass

### 3. Bouton « + Nouvelle course » header /patients
expected: Modal s'ouvre vide depuis le bouton header. Esc ferme proprement.
result: pass

### 4. Ouverture modal depuis drawer patient
expected: Click ligne patient → drawer s'ouvre → « Créer une course pour ce patient » → modal s'ouvre avec patient déjà en pill.
result: pass

### 5. Création course — date freeform + adresses
expected: Saisir « demain 10h » + pickup + dropoff, submit, toast succès.
result: pass

### 6. Édition course existante
expected: Sur /courses, drawer course → bouton « Modifier » → modal titré « Modifier la course » avec valeurs pré-remplies.
result: pass

### 7. Submit modification course
expected: Changer la date → « Enregistrer les modifications » → toast « Course modifiée » → drawer reflète la nouvelle valeur.
result: pass

### 8. Assignation chauffeur
expected: Drawer course modifiée → « Assigner un chauffeur » → choisir « Chauffeur Démo » → drawer reflète statut assignée.
result: pass

### 9. Switch session chauffeur
expected: /dev → « Chauffeur Démo » → redirection /conduite.
result: pass

### 10. Vue chauffeur clusters J + J+1
expected: /conduite affiche 2 sections « Aujourd'hui » + « Demain » (avec une course J+1 créée en amont).
result: pass

### 11. Démarrer + clôturer course (mobile 375)
expected: /conduite mobile → démarrer → clôturer via modal bottom-sheet (paiement + montant).
result: pass

### 12. Role guards layouts
expected: Chauffeur sur /patients → redirect /conduite. Régulateur sur /conduite → redirect /patients.
result: pass

### 13. CRUD admin chauffeurs
expected: /admin/chauffeurs → « Nouveau chauffeur » → types de permis cochés → chauffeur apparaît dans la liste avec badges.
result: pass

### 14. CRUD admin véhicules + check unique
expected: /admin/vehicules → créer un véhicule. Recréer même immatriculation → message FR « Cette immatriculation existe déjà ».
result: pass

### 15. Annulation course avec motif
expected: Sur /courses, drawer course validée → « Annuler » → modal motif → saisir motif → « Annuler la course » → toast « Course annulée » + badge « Annulée ».
result: pass

### 16. Course annulée — boutons figés
expected: Réouverture de la course annulée → les boutons « Modifier » et « Annuler » ne sont plus visibles (statut figé).
result: pass

## Summary

total: 16
passed: 16
issues: 0
pending: 0
skipped: 0
blocked: 0

## Captures Visible Progress

10 captures `docs/showcase/03-e2e-passe1-squelette/` produites en parallèle
du walkthrough (placeholders remplacés par captures réelles preview Vercel) :

- 01-shell-mode-jour.png
- 02-shell-mode-nuit.png
- 03-liste-patients-enrichie.png
- 04-liste-courses-colonnes-denses.png
- 05-drawer-course-assignee.png
- 06-modal-edition-course.png
- 07-modal-assignation-chauffeur.png
- 08-conduite-chauffeur-mobile-375.png
- 09-modal-cloture-bottom-sheet.png
- 10-page-dev-switch-session.png

Rituel pivot v2 § 5/5 : ratio captures publiables / pas-prêtes ≥ 1:1 — VALIDÉ.

## Gaps

(aucun — tous les tests passent)
