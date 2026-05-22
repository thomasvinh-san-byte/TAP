# ADR-005 — Télétransmission B2/SEFi/CNDA différée

- **Statut** : Accepté
- **Date** : 2026-05-21
- **Remplace** : aucun ADR antérieur
- **Affecte** : Phase 06 (facturation CGSS), DEC-064, périmètre commercial V1.5

## Contexte

La facturation CGSS implique, à terme, une **télétransmission électronique** :
norme B2, échange SEFi, logiciel éditeur **certifié CNDA**, formulaire
606b. Une échéance réglementaire — facturation B2 par logiciel certifié au
**31 mai 2026** — a été identifiée pendant le discuss Phase 06.

Deux faits ont cadré la décision :

1. **L'échéance pèse sur le taxi qui télétransmet, pas sur l'éditeur.** La
   certification CNDA conditionne la capacité d'un transporteur **en
   activité** à télétransmettre. TAP est un SaaS en **bêta**, avec un
   design partner en test et **aucun client facturant la CGSS** depuis
   l'outil. L'échéance ne crée donc pas de pression réelle sur TAP.
2. **La télétransmission B2/SEFi/CNDA est un projet en soi** : certification
   logiciel, implémentation de la norme B2, formulaire 606b, tests SEFi.
   Intenable et sans valeur immédiate dans le périmètre de Phase 06.

La facturation a besoin, en V1.5, d'un livrable **concret et utilisable** :
un récapitulatif mensuel que le dirigeant peut produire et exploiter
manuellement.

## Décision

1. **Différer la télétransmission B2/SEFi/CNDA** et le formulaire 606b.
   Aucune implémentation en V1.5.
2. **Facturation V1.5 = PDF récapitulatif mensuel** (`/admin/facturation`),
   qui agrège les courses facturables CGSS et leurs montants calculés par le
   moteur de tarif (Phase 05.5). Document de contrôle interne, exploitable
   manuellement. Disclaimer explicite : « ne vaut pas bordereau de
   télétransmission B2/SEFi ».
3. **Réévaluer l'échéance** quand un client réel facture effectivement la
   CGSS via TAP. La télétransmission deviendra alors une **phase dédiée**
   (certification CNDA incluse).

## Conséquences

**Positives :**
- Phase 06 livre un incrément concret (PDF mensuel) sans s'engager dans un
  projet de certification hors de portée.
- Aucune dette technique : le PDF consomme le moteur de tarif existant.

**Négatives :**
- Pas de télétransmission électronique en V1.5. Acceptable : aucun client ne
  facture encore la CGSS depuis l'outil.

## Réactivation

Au premier client facturant réellement la CGSS via TAP : ouvrir une phase
dédiée « Télétransmission B2/CNDA » — certification logiciel CNDA, norme B2,
échange SEFi, formulaire 606b — avec une échéance réévaluée selon la
situation réelle du client.


## Amendement 2026-05-22 — recadrage réglementaire + positionnement (DEC-074)

Précision suite à l'audit des arrêtés Légifrance (16 mai + 29 juillet 2025) :
la géolocalisation certifiée Assurance maladie devient obligatoire au 1er janvier
2027 pour conserver le conventionnement, et SEFi remplace la norme B2 comme
facturation obligatoire au plus tard au 1er janvier 2027 (logiciel certifié CNDA
requis). La décision n'est plus seulement un « report » : par conception (DEC-074),
TAP reste un outil opérationnel non certifié et s'interface par export avec la
solution certifiée du taxi. Le fardeau de la certification (CNDA, SEFi, géoloc
certifiée) incombe au taxi et à sa solution certifiée, pas à TAP.
