# Journal — Module Conformité réglementaire (CdC §5.21)

Trace des décisions, lots et audits du module. Tenu pour éviter les dérives et
permettre une reprise (méthode GSD réintroduite pour les modules fonctionnels neufs).

## Décisions de méthode
- 2026-06-08 : réintroduction GSD pour modules fonctionnels neufs (cadrage discuss
  validé AVANT execute). Rythme lot-par-lot léger conservé pour l'incarnation UI.
- 2026-06-08 : PRINCIPE — phase = construction des fonctionnalités, PAS branchement
  d'infra. Plateformes payantes / hébergeur / provider email REPOUSSÉS. On bâtit avec
  l'existant (Supabase, pg_cron). Q1 alertes tranchée : IN-APP uniquement.

## DEC du module
| DEC | Objet | Lot |
|-----|-------|-----|
| DEC-112 | compliance_items + saisie + statut (fondation) | Lot 1 (06.33) ✅ |
| DEC-113 | alertes échéance in-app dérivées (cockpit + dashboard) | Lot 2 (06.34) ✅ |
| DEC-114 | contrôle planification souple/paramétrable (assign + optim) | Lot 3 (06.35) ✅ |

## État des lots
| Lot | Phase | Statut | Audit post-merge |
|-----|-------|--------|------------------|
| 1 Fondation | 06.33 | ✅ mergé #259 | Table+RLS+pgTAP OK, helper+tests OK, saisie+écran conformité OK. Fondation saine. |
| 2 Alertes | 06.34 | ✅ mergé #260 | getComplianceAlerts dérivé (0 migration), source partagée cockpit+dashboard, badge accessible (icône+texte), 2 variantes panel/card, helper testé. Conforme. |
| 3 Blocage planif | 06.35 | ✅ mergé #261 | block REVÉRIFIÉ serveur (checkAssignmentCompliance), optim filtre non-conformes en block / signale en warn, réglage dirigeant Zod, helper entité testé, logique factorisée _lib/compliance-planning. Conforme. |
| (Email transactionnel) | ? | ⏸ conditionnel Q1 | — |

## Constats / écarts notables
- Pas de système d'email transactionnel dans TAP (email = Supabase Auth invites ;
  SMS = Twilio patients). → impacte la stratégie d'alerte lot 2 (Q1).
- ComplianceCard (tableau-de-bord) = conformité RGPD documentaire, DISTINCT du
  module 5.21 (conformité réglementaire métier). Pas de doublon.

## RETEX / sources
- fleetms (FOSS, github jmnda-dev) : reminders génériques typés = valide notre
  compliance_items. Secteur : alertes 30/60/90j, statut dérivé temps réel.
  Blocage : visibilité > verrou dur (dur réservé sécurité immédiate type DVIR).
  Fleetbase : actions réversibles, humain approuve.

## Observations (dette mineure, non bloquante)
- Imports cross-domaine profonds : les actions courses + l'optimiseur importent
  `(admin)/admin/conformite/_lib/compliance-planning`. Fonctionne, mais ce helper
  de planification gagnerait à vivre dans un lib plus neutre (packages/shared ou
  lib partagé) si on y retouche. À surveiller, pas un lot dédié.

## MODULE COMPLET ✅ (2026-06-08)
Les 3 lots livrés. Module Conformité réglementaire (CdC §5.21) entièrement couvert :
fondation (compliance_items) → alertes in-app dérivées → contrôle planification
souple/paramétrable. Premier creux du CdC entièrement comblé, en méthode GSD.
Reste hors module : canal email/push (branchement infra, repoussé).
