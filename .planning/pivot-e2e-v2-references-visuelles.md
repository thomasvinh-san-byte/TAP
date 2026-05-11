# Références visuelles — Annexe du Brief E2E v2

**Date** : 2026-05-11
**Statut** : Annexe au brief `pivot-e2e-v2-2026-05-11.md`. À lire en complément, pas en remplacement. Claude Code doit charger les deux fichiers en début de session.

---

## 0. Comment utiliser ce document

Claude Code ne « voit » pas les sites web visuellement. Il peut en lire le HTML, le contenu textuel, les documentations, mais pas le rendu. Les références visuelles servent donc à trois choses, dans cet ordre :

1. **Donner un cadre mental partagé** entre toi et Claude Code. Quand on écrit « densité type Linear » dans un prompt, l'expression doit signifier la même chose pour toi (qui valides visuellement) et pour Claude Code (qui sait que ça implique des marges réduites, du tabular-nums, des séparateurs subtils, etc.).

2. **Te donner un référentiel de validation visuelle**, à toi Guillaume. Tu valides les preview Vercel non pas dans l'absolu, mais en comparant mentalement à ces références. Si ce que tu vois ressemble à Linear/Onfleet, c'est bon. Si ça ressemble à un Bootstrap 2014, c'est non.

3. **Permettre à Claude Code de consulter la doc / blog / case study** de ces produits via web_fetch quand il a besoin de comprendre un pattern (ex : « comment Linear gère le focus trap dans son drawer »).

Pour chaque référence, j'indique : URL, ce qu'il faut **observer précisément** (pas juste « regarde Linear »), et **dans quel prompt du brief v2** elle s'applique. Tu peux aussi lire l'inverse : « pour le prompt 03-C, quelles refs ? » en cherchant le code 03-C dans le doc.

---

## 1. Référence métier maître

Une seule référence à mettre au-dessus de toutes les autres : **Onfleet**. Pourquoi : c'est exactement le métier de dispatch + driver app + tracking + completion. La structure de leur produit (dispatcher web + driver mobile + admin + analytics) est un cadre mental à comprendre avant même de regarder Linear ou Stripe.

**Onfleet**
- URL produit : `https://onfleet.com/`
- Pages utiles : `https://onfleet.com/dispatcher`, `https://onfleet.com/driver-app`
- Ce qu'il faut observer : la structure de la vue dispatcher (carte + liste de tâches à droite), l'écran chauffeur mobile (une grande carte par task avec gros bouton primaire en bas), la gestion des statuts visuels par couleur, le minimalisme du driver onboarding.
- Limites : leur UX visuelle a vieilli, ne pas copier les couleurs ni la typographie. Copier la structure et l'ergonomie.
- Concerné : prompts 03-D (écrans régulateur) + 03-E (écran chauffeur) + Passe 3 cockpit + Passe 4 OR-Tools.

---

## 2. Bibliothèque par contexte

### 2.1 Shell d'application (header, nav, menu user)

Concerné : **prompt 03-C** principalement.

**Linear** — `https://linear.app/`
À observer : densité du header (56 px hauteur), menu user top-right avec avatar coloré et dropdown propre, transitions onglet actif sous-lignées. La page d'accueil contient des captures statiques de l'app.

**Vercel Dashboard** — `https://vercel.com/dashboard` (login requis, sinon `https://vercel.com/`)
À observer : header minimaliste, navigation par projet en sub-nav, menu user top-right impeccable en mode jour comme en mode nuit. Excellence du dark mode.

**Raycast** — `https://www.raycast.com/`
À observer : extension panel, palette de commandes, gestion des raccourcis clavier visibles dans l'UI. À mémoriser pour la suite si on étend le Cmd+Shift+K en command palette globale (Passe 3 ou +).

**Arc Browser** — `https://arc.net/`
À observer : chrome minimaliste, sidebar latérale, transitions douces. À éviter de copier directement (trop personnel comme browser), mais utile comme inspiration de minimalisme assumé.

**Cursor** — `https://cursor.com/`
À observer : interface IDE forkée de VS Code avec dark mode soigné, density haute mais lisible. Référence pour mode nuit dense.

### 2.2 Listes denses régulateur

Concerné : **prompts 03-D** (liste patients, liste courses).

**Linear** (issues view) — `https://linear.app/method/issues`
À observer : ligne par issue, alignement vertical strict, hover background subtil, badges status, avatars compacts, dates en relative time. C'est LA référence absolue pour la liste régulateur.

**Attio** — `https://attio.com/`
À observer : CRM nouvelle génération avec listes denses customisables, colonnes flexibles, agrégations en pied de table. Plus dense que Linear, à étudier pour la Passe 3 cockpit.

**Pylon** — `https://usepylon.com/`
À observer : plateforme support B2B, listes de tickets dense avec aperçu inline, statuts colorés, gestion d'inbox claire. Très proche de ce qu'on veut pour le cockpit régulateur.

**Stripe Dashboard** — `https://stripe.com/docs/dashboard`
À observer : listes de payments, customers, balance. Très utile pour la table récap caisse (Passe 2). Chiffres tabulaires impeccables, totaux clairs.

**Plain** — `https://www.plain.com/`
À observer : un des meilleurs design systems B2B 2024. Listes denses, drawers, timelines, mode nuit excellent. Référence prioritaire pour le drawer patient et le drawer course.

### 2.3 Drawers et side panels

Concerné : **prompts 03-D** (drawer patient, drawer course, drawer chauffeur, drawer véhicule).

**Linear** (issue panel) — sur `https://linear.app/method`
À observer : drawer side-right de 480 px, sections empilées avec séparateurs subtils, header sticky avec actions, scroll interne, focus trap propre, Esc pour fermer.

**Stripe** (customer drawer) — voir documentation `https://stripe.com/docs/dashboard/customers`
À observer : panneau latéral pour les détails customer avec timeline d'événements, infos identité en haut, transactions chronologiques.

**Notion** (sidebar preview) — `https://www.notion.so/`
À observer : panneau peek lateral léger, transitions douces, header minimal.

**Height** — `https://height.app/`
À observer : task drawer avec sections empilées, gestion des commentaires inline, breadcrumb interne au drawer.

### 2.4 Modals et formulaires

Concerné : **prompts 03-D** (modal assignation), **03-E** (modal clôture course).

**Stripe Checkout** (mobile) — `https://stripe.com/payments/checkout`
À observer : modal bottom-sheet sur mobile, focus auto sur le champ critique, validation inline, bouton primaire 56 px en bas. Référence pour le 03-E modal clôture chauffeur.

**Linear** (new issue modal) — sur `https://linear.app/`
À observer : modal centré desktop, raccourcis clavier visibles (Cmd+Entrée pour valider), comboboxes assignee/labels minimalistes. Référence pour 03-D modal assignation.

**Calendly** (booking flow) — `https://calendly.com/`
À observer : enchaînement modaux avec stepper, transitions, validation. Utile pour les flows multi-étapes en Passe 3.

**Cron** (add event) — Cron a été racheté par Notion et est devenu Notion Calendar — `https://www.notion.com/product/calendar`
À observer : création d'event rapide sur mobile, gros boutons, sélection date/heure avec input freeform (référence pour Cmd+Shift+K déjà en place).

### 2.5 Mobile chauffeur (cartes empilées, gros boutons)

Concerné : **prompt 03-E** (écran /conduite).

**Things 3** — `https://culturedcode.com/things/`
À observer : today view avec cartes empilées épurées, hiérarchie claire, focus sur l'essentiel. Mobile + desktop. Référence absolue pour la sérénité visuelle de l'écran chauffeur.

**Onfleet driver app** — `https://onfleet.com/driver-app`
À observer : structure d'une journée chauffeur réelle, cartes par task, bouton primaire grand en bas, gestion start/complete. Référence métier directe.

**Uber Driver** — pas de page publique stable, mais beaucoup de screenshots sur le web. Chercher « Uber Driver app interface » dans Google Images ou regarder `https://www.uber.com/us/en/drive/`
À observer : interface tactile pour conditions terrain (soleil, mains occupées), boutons surdimensionnés, swipe pour confirmer actions critiques. À étudier pour la Passe 2 quand on ira plus loin sur le UX terrain.

**Sunsama** — `https://www.sunsama.com/`
À observer : daily planning, cartes empilées avec drag-and-drop, focus sur la journée. Référence pour la sérénité du chauffeur.

**Apple Reminders** — natif iOS
À observer : liste verticale épurée, gros boutons, geste swipe pour compléter. Sert de baseline pour ce qu'un utilisateur mobile attend par défaut.

**Mercury** (banking mobile) — `https://mercury.com/`
À observer : mobile-first banking propre, cartes claires, mode nuit excellent. Référence pour la confiance visuelle (un chauffeur saisit du tarif, c'est de l'argent).

### 2.6 Mode nuit

Concerné : tous les prompts, vérification globale en **03-C** + walkthrough fin Passe 1.

**Vercel** — `https://vercel.com/`
À observer : mode nuit considéré pas inversé, palette dédiée chaude. Référence absolue pour le dark mode.

**Linear** — `https://linear.app/`
À observer : mode nuit avec contrastes maîtrisés, accents préservés.

**Notion** — `https://www.notion.so/`
À observer : mode nuit avec gestion fine des hiérarchies de gris.

**Raycast** — `https://www.raycast.com/`
À observer : mode nuit IDE-like, dense, lisible longtemps.

**Cursor** — `https://cursor.com/`
À observer : forks de VS Code dark themes, dense + lisible 8h/jour. Référence pour la régulatrice qui passe 8h dans l'outil.

### 2.7 Timeline / activity feed

Concerné : **prompt 03-D** (drawer course → onglet historique audit_logs).

**Linear** (activity sidebar) — sur `https://linear.app/method`
À observer : timeline verticale, événements avec icônes, dates relatives, regroupement temporel. Référence directe pour l'historique audit course.

**GitHub** (issue/PR timeline) — n'importe quelle issue publique, ex `https://github.com/vercel/next.js/issues/1`
À observer : timeline verticale extensible, événements typés (commit, comment, label change), expansion progressive.

**Stripe Events Log** — voir docs `https://stripe.com/docs/dashboard`
À observer : feed temps réel des événements webhook, classification par type, recherche.

**Datadog Event Stream** — `https://docs.datadoghq.com/service_management/events/`
À observer : feed dense d'événements ops, filtrage par tag, regroupement temporel. Référence pour la Passe 3 cockpit temps réel.

### 2.8 Empty states

Concerné : tous les écrans qui peuvent être vides (notamment **prompt 03-D** liste chauffeurs vide, **03-E** /conduite sans course).

**Linear** — toute page vide dans l'app
À observer : illustration ligne fine, texte explicatif court, action primaire pour sortir de l'état vide. Pas d'humour, pas d'illustration colorée enfantine.

**Stripe Atlas** — `https://stripe.com/atlas`
À observer : empty states pédagogiques, parfois mini-tutoriels intégrés. Référence pour onboarding initial dirigeant en Passe 4.

**Pitch** — `https://pitch.com/`
À observer : empty states avec preview de ce qui va apparaître, suggestion de templates.

### 2.9 Avatars / initiales

Concerné : **prompt 03-C** (composant `InitialsAvatar`) + **03-D** (liste patients).

**Linear** — partout dans l'app
À observer : avatar circulaire 24/32 px avec initiales, fond coloré déterministe par hash du nom, fallback élégant en l'absence de photo.

**Notion** — partout dans l'app
À observer : palette d'avatars dans la palette de tokens, cohérence cross-écran.

**Slack** — `https://slack.com/`
À observer : initials avatar quand pas de photo, gestion des statuts (online/offline/busy) via point coloré sur l'avatar.

### 2.10 Inputs et données numériques

Concerné : **prompt 03-E** (input tarif tabular-nums), **prompt 03-D** (filtres listes).

**Stripe** (forms partout) — voir `https://stripe.com/docs/payments/payment-element`
À observer : forms parfaits, validation inline, tabular-nums systématique sur montants, focus visible. Référence absolue pour la qualité d'input.

**Tally** — `https://tally.so/`
À observer : forms beaux, transitions douces entre champs, validation progressive. Référence pour les forms dirigeant longs (création patient).

**Linear** (filter bar) — sur `https://linear.app/`
À observer : filtres par segments, combinaisons multiples, persistance en URL.

---

## 3. Références métier proches (étude prioritaire)

Ces produits font ce qu'on fait, ou très proche. À étudier en profondeur quand on entre sur leur sujet.

### 3.1 Onfleet (déjà cité §1)

Au-delà du dispatcher/driver, étudier aussi : **gestion des proof of delivery** (signature, photo, scan), **règles d'auto-assignment** (Passe 4 = OR-Tools), **driver onboarding** (Passe 4 = ajout de chauffeurs en série).

### 3.2 Routific

URL : `https://routific.com/`
Pourquoi : route optimization SaaS, interface planner pour optimiser des tournées multi-stops. Référence Passe 4 OR-Tools.
À observer : visualisation des tournées sur carte, gestion contraintes (temps, capacité), comparaison avant/après optimisation.

### 3.3 Bringg

URL : `https://www.bringg.com/`
Pourquoi : plateforme delivery + dispatch enterprise. Plus mature qu'Onfleet, moins design.
À observer : dashboard ops avec KPIs, gestion multi-flotte. Référence pour la Passe 4 portail dirigeant + B2B.

### 3.4 Tookan

URL : `https://www.jungleworks.com/tookan/`
Pourquoi : delivery management. Référence négative aussi : design un peu daté.
À observer : ce qu'il faut éviter en termes d'overdesign (trop de couleurs, trop de cartes empilées).

### 3.5 Doctolib

URL : `https://www.doctolib.fr/`
Pourquoi : référence française dans le médical, ton et conventions visuelles adaptés au public francophone professionnel de santé.
À observer : navigation pro Doctolib (côté médecin), gestion d'agenda patient, dossier patient, communication SMS/email aux patients. Référence pour Passe 3 SMS rappel.

### 3.6 Maiia

URL : `https://www.maiia.com/`
Pourquoi : concurrent FR de Doctolib, parfois plus moderne.
À observer : interface dossier patient, prise de rendez-vous.

### 3.7 Headway (santé mentale US)

URL : `https://headway.co/`
Pourquoi : excellente UX moderne, dossiers patients, agenda, paiements. L'une des plus belles applis B2B santé 2024.
À observer : drawer patient, timeline rendez-vous, gestion facturation. Référence prioritaire pour les drawers patient + course.

### 3.8 Sword Health / Hinge Health

URL : `https://swordhealth.com/`, `https://www.hingehealth.com/`
Pourquoi : santé digitale moderne, UX léchée.
À observer : minimalisme, mode patient mobile très soigné. Inspiration pour la sérénité visuelle.

### 3.9 Plain (support B2B)

URL : `https://www.plain.com/`
Pourquoi : design system B2B le plus reconnu 2024. Drawer + timeline + mode nuit + tokens cohérents.
À observer : ce que tu peux imiter sans complexe. Plain a poussé l'opinion design B2B vers le minimalisme propre.

### 3.10 Apps de routage français spécifiques

**Mapotempo** (route planning FR) — `https://www.mapotempo.com/`
Pourquoi : routage open-source français. Référence métier locale.
À observer : interface planner FR, vocabulaire métier français.

**ChronoServices** — pas toujours de site public, mais existe dans le secteur TAP français
Pourquoi : concurrent local potentiel. À chercher pour benchmark.

---

## 4. Anti-références (à éviter explicitement)

Ces produits font des choix qu'il ne faut PAS reproduire, même si Claude Code pourrait être tenté de les imiter par habitude des datasets.

**Salesforce** — `https://www.salesforce.com/`
Pourquoi éviter : densité excessive, années 2010, surcharge de menus, paradigme « tout en un » désorganisé. Ne jamais regarder pour s'inspirer.

**SAP / Microsoft Dynamics**
Pourquoi éviter : enterprise daté, gris pâles, gestion de l'espace catastrophique. Anti-références absolues.

**Doctolib côté médecin (anciennes versions)**
Pourquoi éviter en partie : peut servir pour le vocabulaire FR, mais leur densité est trop faible pour un cockpit de régulation 8h/jour. À étudier mais ne pas copier directement.

**Tout SaaS qui ressemble à du Bootstrap 2014**
Pourquoi éviter : bordures épaisses, ombres dures, gradients de boutons, mélange d'icônes. Le test : si l'écran pourrait être un screenshot ancien sur Dribbble, c'est non.

**Outlook / Gmail (côté workflow)**
Pourquoi éviter : trop email-centric pour un cockpit. À ne pas confondre avec un dispatcher.

---

## 5. Mapping référence → prompt du brief v2

Tableau récap pour Guillaume au moment de coller un prompt dans Claude Code. Pour chaque prompt, les 3-5 références les plus importantes à mentionner.

| Prompt | Refs prioritaires |
|---|---|
| 03-A Migrations | Aucune (pas de UI) |
| 03-B Server Actions | Aucune (pas de UI) |
| 03-C Shell refonte | Linear (header), Vercel (dark mode), Plain (drawer), Notion (menu user) |
| 03-D Écrans dirigeant + régulateur | Linear (liste issues), Onfleet (dispatcher), Plain (drawers), Stripe (drawer customer), Attio (CRM dense) |
| 03-E Écran chauffeur /conduite | Things 3 (cartes empilées), Onfleet driver, Stripe Checkout mobile (modal bottom-sheet), Cron mobile (date input), Mercury (confiance financière) |
| 03-F E2E + SUMMARY | Aucune (pas de UI) |
| Passe 2 PWA | Vercel PWA installable, Linear PWA, Cron iOS |
| Passe 3 cockpit | Posthog (data dense), Datadog (event stream), Linear cycles, Pylon (support inbox) |
| Passe 3 SMS | Linear comments preview, Doctolib SMS patient, Front (email pro) |
| Passe 4 B2B | Stripe Atlas (onboarding), Plain partners (multi-tenant UI) |

---

## 6. Comment intégrer dans les prompts Claude Code

Quand tu colles un prompt du brief v2 (03-C, 03-D, etc.), **ajoute en haut du prompt** cette ligne après le contexte :

```
RÉFÉRENCES VISUELLES (cf. .planning/pivot-e2e-v2-references-visuelles.md
section X.Y) : [lister les 3-5 refs prioritaires du mapping §5
correspondant au prompt en cours]

Pour chacune, si tu as besoin de comprendre un pattern précis, tu peux
fetch leur page produit ou doc via web_fetch. Mais ne perds pas de
temps à fetch toutes les refs — utilise-les comme cadre mental
prioritairement.
```

Exemple pour le prompt 03-C :

```
RÉFÉRENCES VISUELLES (cf. .planning/pivot-e2e-v2-references-visuelles.md
§2.1, §2.6) :
- Linear (linear.app) — header compact, menu user top-right
- Vercel Dashboard — excellence dark mode
- Plain (plain.com) — drawer + design tokens B2B moderne
- Notion (notion.so) — menu user et toggle mode nuit

Tu peux fetch ces URLs si besoin de comprendre un pattern UI précis,
sinon utilise-les comme référence mentale partagée.
```

---

## 7. Comment valider visuellement (toi Guillaume)

Le risque sans design partner externe : se contenter de « ça marche » au lieu de « ça donne envie ». Le rituel à appliquer après chaque PR Claude Code mergée et déployée en preview :

**Étape 1 — Ouvre 3 onglets côte à côte.** Onglet 1 : ta preview Vercel. Onglet 2 : la référence visuelle principale du prompt (ex : `linear.app` pour 03-C). Onglet 3 : la référence métier (Onfleet ou Headway selon le contexte).

**Étape 2 — Compare 3 dimensions précises.**
1. **Densité** : la quantité d'info par écran sur ta preview est-elle équivalente à la référence ? Si tu as 3× moins d'info au m², il manque du contenu. Si tu as 3× plus, c'est surchargé.
2. **Typographie** : graisse, taille, alignement, tabular-nums. Ton écran a-t-il l'air aussi maîtrisé qu'une page Linear ?
3. **Couleur** : palette utilisée, contraste, mode nuit. Le terracotta `--accent` est-il visible quelque part ou seulement défini dans le CSS ?

**Étape 3 — Test du screenshot publiable.** Capture d'écran de la preview, tu la mets dans un slide « Voici notre produit » côte à côte avec Onfleet. Est-ce que c'est honteux, neutre, ou fier ? Si « fier », c'est validé. Si « neutre », on creuse. Si « honteux », un prompt correctif avant de passer au prochain.

**Étape 4 — La nuit, puis la grand-mère** (rappel brief v2 §7).

---

## 8. Évolution de ce document

Ce fichier vit. Au fur et à mesure que tu découvres des références nouvelles ou que tu utilises certaines plus que d'autres, mets à jour :
- Ajout d'une référence : section appropriée + ligne dans le mapping §5
- Référence qui ne sert finalement à rien : marque-la « non utilisée — à retirer »
- Nouvel anti-pattern observé : ajoute en §4

Une révision à chaque fin de passe (3 fois minimum d'ici la Passe 4).

---

**Fin de l'annexe références visuelles.**
