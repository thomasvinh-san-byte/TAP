# Cadrage GSD — Facturation bloc 2 : tarification du transport partagé (CdC §5.19, §7 ; module 5.14 mutualisation)

Phase DISCUSS du bloc, AVANT execute (méthode GSD pour un chantier de tarification
neuf). Objectif : figer les règles conventionnelles d'abattement du transport
partagé et le patron de persistance AVANT de coder, car ce bloc a une DÉPENDANCE
métier (comment naît un transport partagé) qu'il ne faut pas improviser. Établi
2026-07-02. Fait suite au bloc 1 (exonération + refus de partage, livré
Facturation-01) — voir `registre-travaux-repousses.md` §4.2 (report du pricing
partagé) et §4.2 « conformité détour T5 » (décret détour déjà appliqué au solveur).

## Pourquoi ce bloc
La mutualisation (plusieurs patients dans le même véhicule) est ~60 % de l'activité
réelle (dialyse, chimio) et le levier économique central du métier. Le décret la
récompense côté remboursement CGSS par un ABATTEMENT sur la facture de chaque
patient partagé : moins cher pour l'assurance maladie, viable pour le transporteur
grâce au volume. Sans ce calcul, TAP facture chaque patient au plein tarif alors
que la course était partagée — surfacturation CGSS (risque de rejet / litige) et
perte de l'avantage concurrentiel de la régulation optimisée. Le bloc 1 a posé le
régime de prise en charge par transport ; le bloc 2 pose l'ABATTEMENT partage qui
s'insère AVANT ce régime.

## Ce qui est tranché (barème conventionnel — à paramétrer, pas à coder en dur)
Abattement appliqué à la facture de CHAQUE patient d'un transport partagé, selon
le nombre de patients réellement transportés ensemble :

- **2 patients : abattement 23 %**
- **3 patients : abattement 35 %**
- **4 patients et plus : abattement 37 %** (plafond : au-delà de **8 patients**, on
  ne descend pas davantage)

Dérogation longue distance :
- **Un patient transporté SEUL sur un trajet ≥ seuil local (min. 30 km)** bénéficie
  d'un **abattement de 5 %** sur SA SEULE facture. C'est une minoration distincte
  de l'abattement partage (elle vise le trajet long non partagé), portée par le
  patient concerné, pas par le groupe.

Assiette et règles de calcul :
- **Assiette de l'abattement = la totalité de la facture, HORS péage et HORS
  supplément mobilité réduite** (ces deux postes ne sont pas abattus).
- **Les péages sont divisés par le nombre de patients** transportés (partage du
  coût réel du péage), puis rajoutés hors abattement.
- **Barème entièrement paramétrable** : taux, seuils, plafond de patients, seuil
  km de la dérogation → grille versionnée (comme la grille tarifaire CGSS,
  `tariff_grid` versionnée), jamais de constante en dur dans le code.

Nature du calcul (cadrage conceptuel, pour ne pas se tromper de modèle) :
- C'est un **abattement réglementaire simple, par course, appliqué à chaque
  facture patient**. Ce n'est **PAS** un problème de théorie des jeux / partage
  équitable de coût (Shapley, etc.), **PAS** un « arrondi réparti » entre patients.
  Chaque patient reçoit son tarif plein puis se voit appliquer le taux d'abattement
  correspondant au nombre de co-transportés. La somme des factures abattues n'a pas
  à égaler un coût total réparti — le décret raisonne facture par facture.

Ordre des opérations (verrou de calcul) :
1. **Tarif plein** de la course (moteur CGSS `computeCgssFromDistance`, inchangé —
   grille injectée, DEC-057).
2. **Abattement partage** (bloc 2) sur l'assiette hors péage / hors mobilité réduite.
3. **Régime de prise en charge** (bloc 1 : taux assurance / ticket modérateur /
   franchise) appliqué APRÈS l'abattement.
Cet ordre est structurant : le régime de prise en charge (bloc 1) opère sur un
montant DÉJÀ abattu, pas sur le tarif plein.

Cas du refus de transport partagé (articulation avec le bloc 1) :
- Un patient qui REFUSE le partage est facturé au **plein tarif** (aucun abattement)
  et **hors tiers payant** pour les soins itératifs (déjà tracé bloc 1 :
  `transport_partage_refuse`, `MENTION_REFUS_TRANSPORT_PARTAGE`). Le bloc 2 ne fait
  que ne PAS abattre sa facture ; la conséquence tiers payant reste pilotée par le
  bloc 1.

## OBSTACLE central (à trancher AVANT de coder) : le transport partagé n'est pas persisté
Aujourd'hui, la mutualisation n'existe qu'en calcul ÉPHÉMÈRE côté solveur
(`solve-local.ts`, contrat `@tap/optimizer-client`) : le regroupement est proposé
puis exécuté, mais **aucune entité « groupe de partage » n'est stockée**. Or
l'abattement a besoin, au moment de la facture, de connaître :
- le **nombre de patients réellement transportés ensemble** (détermine le taux) ;
- l'**ordre de passage** (dépose/prise en charge), qui porte l'éligibilité à la
  dérogation longue distance (un patient seul sur un long segment).

**Première brique du bloc 2 = persister un « groupe de partage »**, entité DISTINCTE
du groupe de commande B2B (`ride_groups`, 07.03) : le `ride_group` B2B modélise une
DEMANDE émanant d'un donneur d'ordres (workflow acceptation/refus) ; le groupe de
partage modélise l'EXÉCUTION mutualisée réelle (qui a partagé le véhicule, dans quel
ordre). Ne pas confondre ni réutiliser tel quel `ride_groups` — même si un jour un
groupe de commande donne lieu à un groupe de partage, ce sont deux faits distincts.

## Patron de persistance proposé (aligné sur l'existant)
- **Fait figé, sourcé** : l'abattement appliqué est un fait comptable ; il se
  capture au moment où le partage devient certain (comme le gel du tarif à la
  clôture, D-09). La facture AGRÈGE des montants stockés, elle ne recalcule pas
  (doctrine D-09) — donc le taux d'abattement retenu et le nombre de co-transportés
  sont figés sur la course, pas re-dérivés a posteriori.
- **Table parent + référence nullable sur la course** : même motif que les
  récurrences (`ride_recurrence_id`) et les demandes groupées (`ride_group_id`) —
  table `partage_...` (à nommer) + colonne nullable `rides.partage_group_id`
  (NULL = course non partagée, cas nominal monopatient). RLS org, comme toute table
  métier.
- **Capture à la transition d'état** : l'appartenance au groupe de partage et
  l'ordre de passage se figent lors d'une transition de statut identifiée (même
  logique que le gel du tarif). L'**ordre de passage du solveur DOIT être persisté**
  (il porte la dérogation longue distance) — ce n'est pas une donnée éphémère de
  calcul, c'est une entrée de facturation.
- **Journalisation événementielle ÉCARTÉE** : pas de table d'événements de partage
  (surdimensionné pour V1). Le fait figé sur la course + la table parent suffisent.

## Décision métier à TRANCHER (dirigeant / au contact d'un transporteur réel)
**Comment naît un transport partagé ?** Deux modèles possibles, qui déterminent le
POINT DE CAPTURE du groupe de partage :
1. **Solveur → proposition acceptée** : la mutualisation est UNIQUEMENT proposée par
   l'optimisation puis validée par la régulation (le groupe de partage se fige à
   l'acceptation de la proposition).
2. **Solveur OU composition manuelle** : la régulatrice peut aussi composer un
   partage à la main (le groupe de partage doit alors pouvoir être créé/édité hors
   solveur, avec saisie de l'ordre de passage).

Cette décision se prend **au contact d'un transporteur réel** (design partner) :
elle conditionne l'ergonomie et le point de capture (transition d'état vs création
manuelle). Tant qu'elle n'est pas tranchée, on ne fige pas le schéma d'écriture du
groupe de partage. Voir `registre-travaux-repousses.md` §4.2.

## Anti-patterns (à ne pas faire)
- Coder les taux 23 / 35 / 37 / 5 % ou le seuil 30 km en dur (doivent être dans une
  grille versionnée, comme la tarification CGSS).
- Abattre le péage ou le supplément mobilité réduite (hors assiette).
- Recalculer l'abattement à la facture au lieu d'agréger le fait figé (violerait D-09).
- Réutiliser `ride_groups` (demande B2B) comme groupe de partage (exécution) — deux
  faits distincts.
- Traiter le partage comme un partage équitable de coût (théorie des jeux) : c'est un
  abattement réglementaire par facture.
- Modéliser le groupe de partage avant de trancher son mode de naissance (solveur
  seul vs manuel) : le point de capture en dépend.

## Reco
Ne PAS démarrer l'écriture tant que la décision « mode de naissance du partage »
n'est pas prise avec un transporteur réel (elle change le schéma). En attendant :
- Le barème ci-dessus est stable (décret) → il peut être préparé comme grille
  versionnée paramétrable sans dépendre de la décision.
- La brique « persister un groupe de partage + ordre de passage » est le vrai
  préalable technique ; elle attend la décision de capture.
- Le décret détour (T5, DEC-169) est DÉJÀ appliqué au solveur (un groupement non
  conforme n'est pas proposé) ; le bloc 2 ne touche pas à cette conformité, il
  ajoute la TARIFICATION du groupement conforme.

## Refs
CdC §5.19 (caisse/paiements), §7 (moteur tarification CGSS), module 5.14
(mutualisation). Décret détour n°2025-202 du 28/02/2025 (DEC-169). Bloc 1 :
`packages/pricing/src/prise-en-charge.ts`, migration
`20260613000020_rides_prise_en_charge.sql`. Existant réutilisable : moteur
`computeCgssFromDistance` (grille injectée, DEC-057), grille versionnée
`tariff_grid`, patrons de référence nullable `ride_recurrence_id` /
`ride_group_id`, solveur `solve-local.ts` / `@tap/optimizer-client`. Registre :
`registre-travaux-repousses.md` §4.2 (report du pricing partagé + conformité détour).
Doctrine D-09 (la facture agrège, ne recalcule pas). Paramétrage : grille versionnée
obligatoire (aucun taux en dur).
