# Direction artistique TAP — le « pourquoi » du design

> Document fondateur de l'identité visuelle. Il précède et gouverne tous les
> autres docs `design-system/` (qui décrivent le COMMENT : tokens, composants).
> Ici on fixe le POURQUOI : la personnalité, la couleur signature, le ton, les
> principes. Objectif : que chaque écran donne l'impression que « la même
> personne a tout fait, avec les mêmes principes » (critère Linear/Stripe,
> DEC-004). Toute décision UI future se tranche en revenant à ce document.

## 1. La personnalité en une phrase

**Un outil de métier sobre et dense, à la rigueur institutionnelle, réchauffé
d'une touche réunionnaise discrète.** Ni corporate-froid, ni folklore coloré.
Pro d'abord ; l'île se devine, ne s'affiche pas.

Trois mots-clés : **sobre, confiant, situé.**

- _Sobre_ : densité maîtrisée façon Linear, neutres dominants, rien de superflu.
- _Confiant_ : c'est un outil de santé/transport conventionné — il doit inspirer
  le sérieux et la fiabilité (registre institutionnel, parenté avec
  l'écosystème du Département de La Réunion / CGSS).
- _Situé_ : ancré à La Réunion, mais par petites touches (couleur, chaleur), pas
  par cliché. Le 974 se ressent, ne se crie pas.

## 2. La parenté chromatique (assumée, pas littérale)

TAP évolue dans l'écosystème institutionnel réunionnais (CGSS, transport
conventionné, donneurs d'ordres publics). La palette assume une **parenté** avec
cet univers — bleu institutionnel dominant — sans copier une charte officielle
(on s'en inspire, on ne la décalque pas).

**Heureuse coïncidence : la fondation existe déjà dans les tokens.**

- Action primaire = **bleu profond `hsl(217 92% 32%)`** (« bleu confiant »).
  C'est NOTRE bleu institutionnel, dans la famille de l'océan Indien et du bleu
  du Département. → On l'ASSUME comme couleur de fond identitaire.
- Accent = **terracotta `hsl(14 78% 55%)`** — la touche chaude réunionnaise
  (terre, soleil). Aujourd'hui utilisé 2 fois : c'est LE gisement à activer.
- Succès = **vert `hsl(142 71% 35%)`** (nature, pitons) — déjà cohérent.
- Tint chauffeur = **crème `hsl(45 100% 98%)`** — chaleur subtile PWA terrain.

> NB : les valeurs hex exactes d'une éventuelle reprise de la charte
> departement974.fr restent à caler sur la charte réelle (non extractible de
> façon fiable à distance — bot blocking). La direction ne dépend PAS de ces
> hex : elle pose les RÔLES. Si l'on veut un calage fin sur le bleu officiel du
> Département, ajuster la teinte du bleu action en gardant le rôle.

## 3. La règle d'or couleur : une couleur fait le travail

Principe Linear/Stripe (« l'orange Hermès ») : **palette quasi neutre + une
couleur signature rare = impact fort.** Erreur à éviter : colorer partout
(= ringard, dilue le sens).

**Rôles fixés :**

- **Neutres bleutés** (fonds, textes, bordures) = 90 % de l'écran. Le calme.
- **Bleu profond** = la structure de confiance : navigation active, liens,
  en-têtes de section, identité. Présent mais sobre.
- **Terracotta = LA couleur du moment-clé.** Réservé aux actions et instants qui
  comptent : créer une course, valider un pointage, lancer l'optimisation,
  confirmer un encaissement. Rare → fort. JAMAIS décoratif.
- **Vert succès / ambre alerte / rouge erreur** = strictement sémantiques
  (états), jamais esthétiques.

Test de discipline : si on ajoute du terracotta et que ça ne marque pas un
moment-clé, on le retire.

## 4. Le ton (copy)

Français **humain et situé**, jamais corporate-lorem.

- Clair et direct : la régulatrice est pressée (« Course créée », pas « Votre
  demande de création a été soumise avec succès »).
- Chaleureux sans familiarité : on vouvoie, on rassure, on n'infantilise pas.
- Les empty states ACCUEILLENT (« Aucune course pour l'instant — créez-en une
  avec N ») au lieu de constater le vide.
- Les erreurs orientent vers l'action, jamais la stack technique (cf. 06.22).

## 5. Principes de forme

- **Densité maîtrisée** (Linear) : pour la régulatrice 8h/jour, l'info dense est
  une QUALITÉ, pas un défaut — à condition que chaque élément mérite sa place.
  5-7 infos primaires par écran, regroupées, labellisées clairement.
- **Espacement** : « prends l'espace qui semble suffisant, puis double-le » pour
  respirer — sauf dans les zones denses assumées (tables cockpit).
- **Le détail fait le premium** : transitions cohérentes (respecter
  `prefers-reduced-motion`), focus soigné (beau ET accessible WCAG AA), rythme
  d'animation unique, états de survol discrets. « Le son de la portière. »
- **Une seule grammaire** : même en-tête, même placement des actions (primaire à
  droite), même position des filtres, sur TOUTES les familles.
- **Iconographie cohérente** : un seul jeu d'icônes (Lucide, déjà utilisé dans
  ~78 fichiers — à confirmer comme LE jeu unique), un seul style (trait, même
  graisse), tailles alignées sur l'échelle 8px, sens métier constant (une icône =
  un concept, jamais deux icônes pour la même idée ni l'inverse). Les icônes
  structurent le scan ; incohérentes, elles le brouillent.
- **Grammaire d'animation (le « détail premium » concret) — valeurs sourcées,
  non inventées.** Tokens de durée et d'easing UNIQUES, calés sur Material Design
  + NN/g + RETEX 2025-26 :
  - **Durées par type** : micro-interactions (hover, feedback bouton, focus)
    **100-200ms** (cible ~150ms) ; transitions standard (navigation, panneaux)
    **200-350ms** ; entrées notables (modale, toast) jusqu'à ~300ms ; au-delà de
    600ms = interdit sauf raison forte (ex. célébration de succès).
  - **Spécificité TAP desktop (cockpit)** : Material recommande des durées
    desktop PLUS COURTES que mobile — **150-200ms** — car moins perceptibles et
    devant rester immédiatement réactives. Le cockpit (desktop, 8h/jour) vise
    donc le bas de la fourchette ; la PWA chauffeur (mobile) peut aller un peu
    plus haut.
  - **Courbes (cubic-bezier nommées par Material)** : ease-out
    `cubic-bezier(0.0, 0.0, 0.2, 1)` pour l'apparition/feedback (démarre vite,
    décélère — « corps de texte » du mouvement) ; ease-in-out
    `cubic-bezier(0.4, 0.0, 0.2, 1)` pour la navigation/déplacement ; ease-in
    `cubic-bezier(0.4, 0.0, 1, 1)` pour les sorties. **Jamais de linéaire**
    (robotique) sauf barre de progression.
  - **Proportion (rime avec le 60-30-10 couleur)** : ~60% des animations en
    ease-out de référence, ~30% courbes secondaires, ~10% expressif (réservé aux
    moments-clés). Garde l'UI calme.
  - **Règles dures** : ≤ 2 effets distincts par écran (NN/g) ; animations
    INTERRUPTIBLES (ne jamais bloquer l'UI en attendant la fin) ; CSS `transform`
    + `opacity` uniquement pour rester à 60fps ; `prefers-reduced-motion`
    respecté systématiquement (réduire à une transition d'opacité minimale ou
    supprimer). Jamais d'animation purement décorative.
  - Aujourd'hui ~45 fichiers ont des transitions ad hoc → unifier en tokens
    `duration-*` / `ease-*` dans tailwind.config + tokens.

## 5bis. La STRUCTURE porte la hiérarchie (le cœur du near-monochrome)

**Near-monochrome ≠ absence de structure. C'est l'inverse : quand la couleur ne
hiérarchise plus, la STRUCTURE doit tout porter.** Sans cette grammaire, le
sobre devient une bouillie grise illisible. C'est le point le plus important de
toute la direction, et il vaut pour TOUT (écrans, composants, navigation, et
jusqu'à l'organisation du code).

**Règle d'accessibilité qui fonde tout (WCAG)** : ne JAMAIS faire reposer la
hiérarchie sur la couleur seule. Donc le near-monochrome n'est pas une
contrainte, c'est une discipline vertueuse : il OBLIGE à structurer proprement.

### Les 5 leviers de structure (par ordre de force, sans couleur)

1. **Espacement = relation (Gestalt proximité).** Ce qui est proche est perçu
   comme lié ; ce qui est espacé, comme distinct. L'espace est l'outil n°1 de
   regroupement. TAP a DÉJÀ l'échelle stricte 4/8/12/16/24/32/48/64px (pilier
   CLAUDE.md §2) — la fondation est là. La discipline : utiliser l'espace pour
   GROUPER (petit espace intra-groupe, grand espace inter-groupe), pas
   uniformément.

2. **Hiérarchie typographique (taille + graisse).** Le plus grand/gras = le plus
   important ; le plus petit/clair recule. **C'est LA faiblesse mesurée de TAP :**
   305 `text-sm` + 133 `text-xs` écrasent tout (vs 25 `text-2xl`, 7 `text-lg`,
   3 `text-xl`). Quasi tout est en petit → aucune gradation → l'œil ne sait pas
   où aller. À CORRIGER : une vraie échelle exprimée (titres de page, titres de
   section, corps, légende) appliquée avec discipline. La hiérarchie typo
   remplace la couleur comme guide du regard.

3. **Alignement et grille.** Multiples de 8px, alignement à gauche (lecteurs
   FR/occidentaux), grille cohérente. « Même un léger défaut d'alignement érode
   la confiance. » L'alignement communique les relations autant qu'il range.
   TAP : usage de grille hétérogène (grid-cols-2 dominant, max-w dispersés) → à
   rationaliser en gabarits de page cohérents.

4. **Profondeur subtile (ombres douces), pas la couleur.** Élévation pour
   distinguer les plans (carte > fond, modale > page) via ombres douces, jamais
   skeuomorphisme. Remplace avantageusement les aplats colorés pour séparer les
   zones.

5. **Frontières AVEC PARCIMONIE.** Les bordures/encadrés définissent
   l'appartenance et structurent vite les layouts denses — MAIS en abuser
   (tout encadrer) encombre et brouille la hiérarchie. Préférer l'espace et
   l'alignement ; n'encadrer que ce qui doit vraiment être délimité.

### Scan : placer selon le regard

Les utilisateurs scannent (F/Z), ne lisent pas. Titres et navigation en haut et
à gauche (où l'attention atterrit), action primaire en haut-droite (cohérent
grammaire §5). Le cockpit régulatrice doit se scanner en F : info critique en
haut-gauche.

### Principe directeur

« La meilleure hiérarchie est celle que l'utilisateur ne remarque pas » : il
sait instantanément où regarder/cliquer. Si l'écran semble « plat » ou
« chargé », c'est un défaut de structure (espace/typo/alignement), PAS un manque
de couleur — ne jamais corriger un problème de structure en ajoutant de la
couleur.

### Ça vaut aussi pour le code et les composants

La même exigence d'organisation s'applique en profondeur : composants rangés par
famille, nommage cohérent, un seul composant par responsabilité, gabarits de
page réutilisés (pas de mise en page refaite à la main page par page). Un écran
bien structuré naît d'un code bien structuré (≤300 lignes/fichier, ≤150/composant
— CON-008 déjà en place).

## 5ter. STRUCTURE ENTRE LES ÉCRANS — architecture de l'information (le rangement)

La structure intra-écran (§5bis) ne suffit pas : il faut AUSSI que les pages
soient bien RANGÉES entre elles. Une app peut avoir des écrans parfaits et une
arborescence incohérente — l'utilisateur se perd alors entre les écrans, pas
dedans. L'audit a relevé des points concrets à juger (à trancher en discuss, pas
actés ici) :

**Incohérences de rangement relevées (à arbitrer) :**

1. **« Caisse » : onglet de 1er niveau mais URL enfant.** La nav régulateur
   affiche Caisse au même rang que Cockpit/Courses, alors que l'URL est
   `/courses/caisse` (enfant de Courses). La navigation et l'arborescence se
   contredisent. → Soit Caisse monte en 1er niveau (`/caisse`), soit elle
   redevient un sous-onglet de Courses dans la nav. Choisir.
2. **L'argent à deux endroits** : « Caisse » (régulateur, encaissement course)
   vs « Facturation » (dirigeant, /admin). Séparation par rôle peut-être
   légitime, mais à ASSUMER explicitement (sont-ce deux moments distincts du
   même flux financier ? le nommage doit le dire).
3. **« Chauffeurs » traverse les familles** : onglet de la nav régulateur qui
   pointe vers `/admin/chauffeurs` (zone admin). Soit la gestion chauffeurs est
   régulateur (et sort de /admin), soit elle est admin (et quitte la nav
   régulateur). La frontière (app)/(admin) doit être nette.
4. **« Optimisation » sous /cockpit** : défendable (outil du régulateur en
   poste), à valider comme choix conscient.

**Principes de rangement (la grammaire inter-écrans) :**

- **L'URL reflète la hiérarchie réelle** : un enfant d'URL est un enfant
  conceptuel. Si deux choses sont au même niveau de nav, elles devraient l'être
  en URL (cohérence mentale).
- **Une famille = un domaine cohérent** : (app) = travail quotidien régulateur,
  (admin) = configuration/pilotage dirigeant, (driver) = terrain, (public) =
  légal externe. Une page ne doit pas « fuir » d'une famille à l'autre dans la
  nav.
- **Nav par rôle** (déjà en place via `tabsForRole`, bon) : chaque rôle voit son
  univers, pas celui des autres. À préserver et affiner.
- **Profondeur maîtrisée** : viser ≤ 2-3 niveaux pour atteindre une tâche
  fréquente (l'arbo actuelle monte à 4 niveaux sur le légal/RGPD — acceptable car
  rare, mais le quotidien régulateur doit rester plat).
- **Nommage = vocabulaire métier** : les labels parlent le langage de la
  régulatrice (Cockpit, Courses, Caisse), pas le jargon technique. Déjà bien.

**À NE PAS faire** : réorganiser l'arborescence sans nécessité (casse les URLs,
la mémoire musculaire, les liens). Le rangement se juge, se rationalise quand
c'est incohérent, mais ne se chamboule pas par goût. Tout changement d'URL = à
peser (redirections, habitudes).

## 6. Contraintes non négociables (rappel, intégrées à la direction)

- **WCAG 2.1 AA** : contraste ≥ 4.5:1 partout. Le terracotta sur blanc et le
  bleu sur blanc doivent passer (vérifier ; si le terracotta texte échoue,
  l'utiliser en fond avec texte clair, pas en texte fin).
- **Chauffeur (DEC-014)** : cibles ≥ 56 px, 1 action/écran, contraste renforcé
  extérieur, +20 % police, mode contraste élevé. La direction « sobre dense » du
  cockpit NE s'applique PAS telle quelle au chauffeur : lui, c'est grand, simple,
  lisible au soleil. Deux déclinaisons d'une même âme.
- **Jour + nuit** : toute couleur a son équivalent nuit (le bleu nuit
  `hsl(217 91% 60%)` existe déjà). Tester la signature terracotta en sombre.

## 7. Faiblesses connues que la direction doit RÉSOUDRE (ne pas oublier)

Ces points, relevés à l'audit, sont les chantiers d'INCARNATION de la direction —
ils ne sont pas cosmétiques, ils sont la mise en œuvre :

1. **Grammaire divergente** : `PageHeader` dans 16 fichiers admin, **0 dans le
   cœur métier** (cockpit/courses/patients/tableau-de-bord). → Unifier l'en-tête
   partout = condition n°1 du « même personne a tout fait ».
2. **Perception de vitesse** : seulement 2 `loading.tsx` / ~25 pages. → Skeletons
   cohérents sur toutes les pages à fetch (le skeleton EST un détail premium).
3. **Empty states inégaux** (12 pages) → présents et accueillants partout où une
   liste peut être vide.
4. **Skeletons inégaux** (11 usages) → systématiser.
5. **Raccourcis clavier localisés** (modales seulement) → système power-user
   cohérent pour la régulatrice (mnémoniques, sans conflit OS, helper de
   découverte).
6. **Couleur signature dormante** : terracotta 2 usages, tint crème invisible →
   activer selon les rôles du §3.
7. **Hiérarchie typographique écrasée** (faiblesse de STRUCTURE, la plus
   importante) : 305 `text-sm` + 133 `text-xs` dominent vs 25 `text-2xl` / 7
   `text-lg` / 3 `text-xl`. Quasi tout en petit texte → aucune gradation, l'œil
   ne sait pas où aller. → Exprimer une vraie échelle typo (cf. §5bis levier 2).
   C'est ce qui fait le plus « plat/utilitaire » aujourd'hui.
8. **Grille de page hétérogène** : gabarits non systématisés (max-w dispersés,
   grilles ad hoc) → rationaliser en gabarits réutilisés (cf. §5bis levier 3).

## 8. Méthode d'incarnation (par familles, après ce doc)

1. Ce document validé = la référence. Le geler dans `docs/design-system/00-direction.md`.
2. **Friction log** par famille (parcourir comme l'utilisateur réel, noter
   frictions + écrans « sans âme »).
3. **Incarner famille par famille**, ordre métier :
   a. **Régulation (app)** — grammaire unifiée (PageHeader), terracotta sur les
   moments-clés, densité cockpit assumée, skeletons, raccourcis. Plus fort ROI.
   b. **Chauffeur (driver)** — déclinaison « grande et lisible » de l'âme
   (DEC-014), tint crème assumé, contraste extérieur.
   c. **Admin** — déjà le plus cohérent (PageHeader) ; aligner sur la direction
   (terracotta moments-clés, copy).
   d. **Auth + Public** — vérif cohérence, parenté typographique.
4. **Geler dans les tokens/composants** : la direction devient structurelle
   (terracotta = variant « action-clé » de Button, en-tête = composant imposé),
   donc impossible à trahir par dérive.

## 9. Décisions dirigeant — ÉTAT

**Validé (2026-06-05) :**

- ✓ Personnalité « sobre / confiant / situé », bleu institutionnel dominant +
  touche terracotta réunionnaise.
- ✓ Terracotta = couleur du moment-clé (action qui compte), jamais décoratif.
- ✓ Cap « near-monochrome + une couleur signature rare », gravé 60-30-10 +
  échelle neutre 6-10 paliers dans les tokens.
- ✓ Boussole d'inspiration : Linear (densité) tempéré Frappe « Espresso »
  (anti-distraction métier).
- ✓ **near-monochrome ≠ sans structure** : la STRUCTURE porte la hiérarchie
  (§5bis). S'applique à TOUT (écrans, composants, navigation, code).

**Validé (suite) :**

- ✓ Bleu : on garde le bleu actuel « dans la famille institutionnelle »
  (`hsl(217 92% 32%)`), PAS de calage pixel sur la charte du Département.
- ✓ Grammaire d'animation : valeurs sourcées Material/NN-g (§5 forme), non
  inventées.

**Validé (méthode d'incarnation) :**

- ✓ Friction log : DÉDUIT du code par l'audit, ENRICHI des retours terrain du
  dirigeant au fil de l'eau (les deux combinés, pas l'un ou l'autre).
- ✓ Incohérences de rangement (Caisse niveau/URL, argent à 2 endroits,
  Chauffeurs inter-familles) : tranchées EN CONTEXTE, pendant l'incarnation de
  la famille concernée (Régulation), pas dans l'abstrait en amont.

**Tout est tranché. La direction est prête à être gelée puis incarnée.**

## Refs

DEC-004 (Linear/Stripe/Notion), DEC-014 (chauffeur), CON-005 (a11y) ;
tokens.json (bleu action `217 92% 32%`, accent terracotta `14 78% 55%`, succès
`142 71% 35%`, tint driver `45 100% 98%`) ; analyse-ui-ux (faiblesses) ;
vision-ux-n+1 ; écosystème departement974.fr (parenté bleu institutionnel) ;
RETEX pixeldarts/figma/stripe (une couleur fait le travail, opinionated, détail
premium) ; animation : Material Design duration-easing (desktop 150-200ms,
courbes cubic-bezier nommées), NN/g (≤2 effets/écran, >1s perturbe), baraa.app
(proportion 60/30/10 du mouvement, courbes = langage), moldstud/equal/ripplix
(durées par type 100-600ms, interruptible, 60fps transform+opacity).
