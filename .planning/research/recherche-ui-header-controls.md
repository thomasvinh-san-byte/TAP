# Recherche UI — header surchargé & segmented control (sources secteur/FOSS)

Recherche demandée avant de trancher (header trop chargé + boutons Actifs/Archivés
qui détonnent). Sources : guides UX SaaS 2025-2026 + design systems. 2026-06-08.

## A. Header surchargé (11 entrées de nav)

### Constat sourcé
- **Seuil 5-7 entrées** : au-delà de ~7 destinations primaires, le scan se dégrade.
  Une top-bar horizontale marche pour 4-7 sections ; au-delà elle s'encombre et perd
  son avantage de hiérarchie (edana, lollypop).
- TAP = **11 entrées** (Tableau de bord, Cockpit, Patients, Courses, Caisse,
  Chauffeurs, Véhicules, Tarifs, Facturation, Conformité, Maintenance) + Légal +
  logo + actions droite → nettement au-dessus du seuil. Confirmé : surchargé.
- **Pattern recommandé pour produit multi-modules + rôles** : SIDEBAR verticale
  (gère hiérarchies profondes, listes longues, groupement ; idéale SaaS/dashboard/
  admin). Ou top-bar RÉDUITE à 5-6 + regroupement en menus.
- **Groupement** (clé si on garde le haut) : regrouper les items par relation
  (catégories) accélère la recherche vs scanner 11 items à plat.
- **Par rôle** : n'exposer que ce qui sert le rôle réduit la charge (déjà partiellement
  fait — REGULATEUR_TABS vs DIRIGEANT_TABS).
- **Responsive** : la top-bar à 11 items casse sur petit écran ; sidebar → drawer,
  ou top-bar → menu. Aujourd'hui aucun repli responsive du header.

### Options pour TAP (à trancher avec le dirigeant)
1. **Sidebar verticale** (la recommandation secteur pour ce profil). Gain : scale,
   groupement, scan vertical, place pour 11+ items. Coût : refonte de layout
   (le contenu se décale), gros chantier UI, change l'habitude.
2. **Top-bar regroupée** : ramener à ~5-6 entrées primaires + regrouper le reste en
   menus déroulants. Ex. grouper « Référentiels » (Patients, Chauffeurs, Véhicules),
   « Finances » (Caisse, Tarifs, Facturation), garder Cockpit/Courses/Tableau de bord
   en primaire, Conformité/Maintenance/Légal en menu « Administration ». Gain :
   garde la top-bar (peu de refonte), réduit la charge. Coût : 2 niveaux (un clic de
   plus pour les items groupés).
3. **Hybride** (fréquent en entreprise) : top-bar pour contexte global (logo, recherche,
   notif, compte) + sidebar pour la nav primaire.

### Reco
Le profil de TAP (11 modules, 2-3 rôles, usage 8h/j) correspond au cas d'école de la
**sidebar**. Mais c'est un GROS chantier (refonte layout). Étape intermédiaire à
moindre coût : **regroupement de la top-bar** (option 2) — réduit la surcharge tout
de suite sans refondre le layout. À trancher : sidebar (ambitieux) vs regroupement
(rapide). Recommandation : commencer par le regroupement, sidebar si le besoin
persiste. À VALIDER dirigeant (décision d'archi UI).

## B. Segmented control « Actifs / Archivés » (détonne)

### Constat sourcé — NUANCE vs ressenti
- Le fond plein sur le segment actif est LE BON pattern, PAS le défaut : les indices
  subtils (fond à peine plus clair, fine bordure) ne tiennent pas, surtout en dark
  mode. Il faut une approche par COUCHES : fond plein + graisse + contraste ≥4.5:1
  + profondeur optionnelle (eleken, groto).
- Donc « Actifs/Archivés » ne détonne PAS parce qu'il a un fond — il détonne parce
  qu'il est TROP GRAND/LOURD pour un contexte dense : « accorder la densité visuelle
  à l'UI environnante ; un segmented control taille "large" d'une lib mobile paraît
  lourd dans un dashboard dense et entre en compétition avec les données » (groto).
- « Les designers sur-emphasent souvent l'état actif → vibration visuelle ; contrer
  par des transitions graduées » (setproduct).
- Hauteur : doit s'ALIGNER sur les éléments adjacents (champ recherche, boutons) —
  pas une taille mobile.

### Diagnostic TAP
Sur la capture Patients, le « Actifs/Archivés » est trop HAUT/large par rapport au
champ de recherche voisin et aux lignes de table → il pèse trop. Le fond blanc actif
n'est pas le problème ; sa TAILLE et son poids le sont. Correctif : réduire la
densité (hauteur alignée sur la recherche, padding resserré, radius cohérent),
garder le fond plein actif mais plus discret (ombre très légère, pas de bordure
lourde), transition douce. Bref : le rendre plus PETIT et intégré, pas le
« déplomber » en enlevant le fond.

### Reco
Ajuster la DENSITÉ du SegmentedControl (composant déjà factorisé) : hauteur alignée
sur les inputs voisins, padding/radius resserrés, état actif = fond plein + graisse
+ ombre douce (couches), transition ≤150ms. Ne PAS revenir à un actif « sans fond »
(anti-pattern accessibilité). C'est de l'ajustement, pas une refonte.

## Synthèse décisions à trancher
1. **Header** : sidebar (ambitieux, recommandé secteur) OU regroupement top-bar
   (rapide, moindre coût) ? → reco : regroupement d'abord.
2. **Segmented control** : ajustement densité (hauteur/padding/radius alignés UI
   dense) en gardant le fond plein actif → pas de débat, application directe.

## Refs
eleken (segmented + nav), groto (densité), setproduct (vibration visuelle), lollypop
& edana (seuil 5-7, sidebar vs topbar), uxmovement (groupement). Direction DEC-101
(sobriété near-monochrome) à respecter dans tous les cas.
