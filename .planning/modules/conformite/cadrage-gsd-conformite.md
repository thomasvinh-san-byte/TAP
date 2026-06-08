# Cadrage GSD — Module Conformité réglementaire (CdC §5.21)

Phase DISCUSS du module entier, AVANT d'écrire les lots 2-3. Objectif : trancher
AVEC le dirigeant les décisions structurantes, plutôt que les improviser lot par
lot. Conforme à la méthode GSD (discuss → ui → plan → execute → ship) — réintroduite
pour les MODULES FONCTIONNELS NEUFS. Vérifié sur le code 2026-06-08.

## Règle de méthode actée (à inscrire dans le projet)
- **Module fonctionnel neuf** (table/RLS/cron/logique métier nouvelle) → GSD complet :
  cadrage discuss validé par le dirigeant → puis lots execute DÉRIVÉS du cadrage.
- **Incarnation / raffinement UI sur existant** → rythme lot-par-lot léger acceptable
  (risque faible, audit post-merge suffit).
Justification : sur un module neuf, une décision d'archi prise à la volée se FIGE
dans la migration (coûteux à défaire) et contamine les lots suivants.

## Périmètre CdC §5.21 (rappel intégral)
**Échéances suivies (8) :** carte pro chauffeur · visite médicale d'aptitude ·
formation continue · contrôle technique véhicule · visite annuelle taxi (préfecture)
· assurance véhicule · licence taxi · convention CGSS (signature + avenants).
**Mécanisme d'alerte :** alertes automatiques à 90/60/30/7 j avant échéance ·
notification dirigeant (email + dashboard) ET régulateur (cockpit) · blocage
planification d'un chauffeur/véhicule non-conforme (paramétrable).

## Lot 1 — LIVRÉ (06.33, DEC-112) — état vérifié
✅ Table `compliance_items` (entity_type driver/vehicle/organization, 8 kinds en
CHECK, issued_at/expires_at/document_url, RLS multi-tenant + test pgTAP dédié).
✅ Helper `complianceStatus` (@tap/shared) : ok/soon/expired, fenêtre 90j, paliers
[90,60,30,7] DÉJÀ anticipés, tests Vitest.
✅ Saisie driver-form + vehicle-form + écran `/admin/conformite` (convention CGSS).
✅ Badge d'état dans les listes.
Fondation SAINE pour bâtir les lots 2-3.

## Principe directeur acté (2026-06-08)
**Phase = construction des FONCTIONNALITÉS, pas branchement d'INFRASTRUCTURE.**
Tout ce qui ajoute une plateforme/dépendance payante ou un hébergeur est REPOUSSÉ
(provider email transactionnel, etc.). On construit la fonctionnalité avec ce qui
est déjà en place (Supabase, pg_cron gratuit) ; le branchement des canaux externes
viendra après (vraisemblablement avec le chantier HDS/infra). La logique d'alerte
est conçue pour que ces canaux, une fois branchés, consomment le même socle sans
refonte.

→ **Q1 TRANCHÉE : alertes IN-APP uniquement** (cockpit + dashboard). Email/push =
branchement ultérieur, hors périmètre actuel.

## RETEX secteur + FOSS (on ne réinvente pas la roue)

Recherche menée sur les logiciels de flotte/compliance et les projets FOSS, pour
adosser les choix à l'existant éprouvé :

**Modèle de données — VALIDÉ par le FOSS.** `fleetms` (open source, GitHub
jmnda-dev) implémente des « renewal reminders génériques » par TYPE de document
(Assurance, Test d'émissions…) avec intervalles + notifications. C'est exactement
notre `compliance_items` (table générique + `kind`). Le lot 1 est donc aligné sur
le pattern FOSS de référence — pas de réinvention.

**Alertes multi-paliers — standard secteur.** Le standard est 30/60/90 j avant
échéance (notre 90/60/30/7 est plus fin). Repository centralisé + statut DÉRIVÉ
affiché en temps réel (dashboard « qui est dû / à renouveler »). → conforte Q2 :
affichage dérivé de l'état courant, pas de statut figé.

**Blocage — le secteur ET le FOSS privilégient la VISIBILITÉ, pas le verrou dur.**
Le pattern dominant = prévenir en rendant visible (« empêche d'exploiter SCIEMMENT
un véhicule non conforme » = l'humain décide informé). Le blocage dur est réservé
aux défauts de SÉCURITÉ immédiats (DVIR : pas de redispatch tant que non réparé),
pas aux échéances administratives. Fleetbase (automatisation poussée) garde le
principe : actions « explicables et réversibles, l'humain approuve ». → conforte
Q4 : souple par défaut, dur en option.

## Décisions à TRANCHER avec le dirigeant (avant lot 2-3)

### Lot 2 — Alertes automatiques

**Q1 — Canal de notification. ✅ TRANCHÉE : IN-APP uniquement** (cockpit + dashboard).
L'email/push transactionnel = branchement d'infra, REPOUSSÉ (principe directeur).
La logique d'alerte expose ses données de façon à ce qu'un canal externe futur les
consomme sans refonte.

**Q2 — Mécanisme cron.** pg_cron confirmé dispo prod (pattern breach-72h
réutilisable). Le cron calcule les items franchissant un palier (90/60/30/7) et
matérialise des alertes. Question : alertes STOCKÉES (table `compliance_alerts`)
ou DÉRIVÉES à la volée (requête sur compliance_items vs date) à l'affichage ?
- Dérivé = pas de table, toujours juste, mais pas d'état « lue/non-lue/snooze ».
- Stocké = permet accusé de réception, historique, anti-spam (ne pas re-alerter).
**Reco : dérivé pour l'affichage cockpit/dashboard (simple) + le cron sert surtout
au futur email/push.** À VALIDER selon besoin d'accusé de lecture.

**Q3 — Où afficher.** Cockpit (pattern alerts-panel existant) + tableau-de-bord
dirigeant (à côté du ComplianceCard RGPD, mais DISTINCT — un bloc « Échéances
réglementaires »). OK ?

### Lot 3 — Blocage planification

**Q4 — Sémantique du blocage.** Le CdC dit « blocage paramétrable ». À trancher :
- **Dur** : impossible d'assigner une course à un chauffeur/véhicule non-conforme
  (l'assign-modal refuse).
- **Souple** : avertissement visible mais assignation possible (la régulatrice
  garde la main, sa responsabilité).
- **Paramétrable** : réglage par organisation (dur/souple par type d'échéance ?).
**Reco : souple par défaut + paramétrable vers dur**, car bloquer dur une régul en
flux tendu peut casser l'exploitation (un CT expiré la veille ne doit pas figer
toute la journée). Mais c'est un ARBITRAGE MÉTIER fort → dirigeant tranche.

**Q5 — Point d'insertion.** assign-modal (assignation manuelle) + optimiseur
(assignation auto) doivent-ils TOUS DEUX respecter le blocage ? (cohérence : oui,
sinon l'optimiseur contourne la règle). Confirmer.

**Q6 — Périmètre du paramétrage.** Qui règle (dirigeant only ?), où (écran
conformité ? réglages org ?), granularité (global / par type d'échéance) ?

## Séquencement proposé (dérivé, après validation)
- **Lot 2** : alertes in-app (cockpit + dashboard) + cron de matérialisation.
  (Email/push = lot ultérieur si validé.)
- **Lot 3** : blocage planification selon Q4-Q6.
- **Lot ultérieur éventuel** : canal email transactionnel (si Q1=a).

## Questions dirigeant (synthèse — à trancher avant lot 2)
1. **Q1** Canal : in-app d'abord, email plus tard (a) — ou email tout de suite (b) ?
2. **Q2** Alertes dérivées (simple) ou stockées (accusé/historique) ?
3. **Q4** Blocage : souple+paramétrable (reco) ou dur d'emblée ?
4. **Q5** Le blocage s'applique à l'optimiseur aussi (pas que l'assign manuel) ?
5. **Q6** Paramétrage : qui/où/granularité ?

## Refs
CdC §5.21 (.docx source) ; DEC-112 (lot 1) ; pattern breach-72h (cron) ;
alerts-panel cockpit ; absence d'email transactionnel (constat code).
