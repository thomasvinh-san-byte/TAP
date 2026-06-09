# Méthode de travail — l'architecte-chat (binôme avec Claude Code)

> À lire par toute personne (ou tout Claude) qui reprend le rôle
> « architecte-chat » du projet TAP. Ce document décrit le RÔLE et la MÉTHODE,
> pas le code (voir `CLAUDE.md` pour le quoi technique, `.claude/README.md`
> pour la couche Claude Code).

## 1. Les trois rôles du pipeline

1. **Dirigeant (humain)** : tranche les arbitrages produit, colle les prompts
   dans Claude Code, merge les PR. Seul à décider ; exige des recherches
   sourcées et la vérification de l'état réel avant toute proposition.
2. **Claude Code (CC)** : écrit le code, crée branches + PR. Exécute des
   prompts AUTOPORTEURS. Ne décide rien de structurant seul.
3. **Architecte-chat (ce rôle)** : lit l'état réel du repo, recherche, tranche
   les décisions techniques/UX, produit les PROMPTS autoporteurs que le
   dirigeant colle, et AUDITE le code réel après merge. N'édite jamais le repo
   applicatif lui-même.

## 2. Règles d'or (non négociables)

- **Prompts AUTOPORTEURS** : un seul bloc, tout inline (pourquoi, état réel
  vérifié, décisions fermées, garde-fous, tâches, validation,
  branche/commit/PR). CC ne doit jamais avoir à deviner ni à aller chercher du
  contexte ailleurs.
- **Trancher ICI, pas déléguer à CC** : toute décision structurante (archi, UX,
  choix de pattern) est prise et figée dans le prompt. CC implémente, il
  n'arbitre pas.
- **Recherche sourcée AVANT décision** : aucune décision UI/archi à l'instinct.
  On cherche (web), on cite, on tranche. « Pas de rustine : traiter la cause
  racine. »
- **Vérifier l'ÉTAT RÉEL avant de proposer** : toujours lire le code réel sur
  `main` (cloné en lecture seule), jamais se fier au résumé d'une PR. Examiner
  des échantillons concrets avant de conclure.
- **Audit APRÈS merge, sur le code réel** : ne jamais croire le résumé de CC.
  Vérifier par grep/lecture que la décision est bien appliquée (et que rien n'a
  régressé).

## 3. La règle « maquette avant code » (acquise au prix d'allers-retours)

Pour TOUTE refonte visuelle : produire une maquette HTML jetable validée par le
dirigeant AVANT d'écrire le prompt d'implémentation. On tranche le visuel là où
le coût de changement est nul (un fichier HTML), pas dans le code.

- **Preuve par l'usage** : les écrans cadrés par maquette (dashboard,
  conformité, formulaires, listes, mobile) = zéro aller-retour. Ceux faits sans
  maquette (login, 4 itérations) = cycle réactif coûteux.
- Les maquettes vivent dans `.planning/mockups/` (versionnées).

## 4. La règle « préserver les valeurs métier »

Les composants/patrons partagés portent la STRUCTURE (alignement, espacement,
mécanique). Ils ne portent JAMAIS les VALEURS métier : vocabulaire CGSS
(Validée/Affectée, Taxi conventionné/TPMR), défauts délibérés (filtre courses =
aujourd'hui « focus régulatrice »), colonnes/champs spécifiques, formats FR/974,
tri/seuils contextuels. Un patron = un CONTENANT paramétrable. Lisser une
spécificité = régression métier, à refuser.

## 5. Discipline GSD

- Nouveau module fonctionnel → phase DISCUSS complète validée par le dirigeant
  AVANT l'EXECUTE. Raffinement UI sur code existant → rythme plus léger, lot par
  lot.
- Décisions nommées : format DEC-NNN. Décisions d'archi lourdes : ADR-NNN.
- Doctrines = fichiers LOCKED dans `.planning/` (réutilisables, ne pas
  réinventer).
- Travaux repoussés : registre explicite (`registre-travaux-repousses.md`) avec
  décision, raison, condition de déblocage, catégorie (🗳 délibéré / 💳 achat /
  🔍 choix technique / 📄 info externe).

## 6. Boucle de travail concrète

1. Le dirigeant signale un besoin (souvent via captures d'écran).
2. Architecte-chat : `git pull` du repo (lecture seule), lit l'état réel.
3. Si besoin de trancher un choix UI/archi → recherche sourcée (web), on cite.
4. Si refonte visuelle → maquette HTML → validation dirigeant.
5. Architecte-chat produit le prompt autoporteur (gabarit § voir
   `PROMPT-MODELE.md`).
6. Dirigeant colle dans CC → CC crée la PR → dirigeant merge.
7. Architecte-chat : audit post-merge sur le code réel (grep/lecture), verdict.
8. Doctrines/maquettes/registres → versés dans `.planning/`.

## 7. Limites connues de l'architecte-chat

- PAS d'accès API GitHub (PR ouvertes, statut de merge). Le `git pull` ne montre
  que `main`. CONSÉQUENCE : ne demander un « check main » qu'APRÈS un merge
  effectif ; sinon l'état est identique = temps perdu. Le dirigeant voit les PR
  sur GitHub ; le rôle utile de l'architecte = audit APRÈS merge.
- N'édite jamais le repo applicatif : il produit des prompts, CC écrit le code.

## 8. Pour démarrer (repreneur)

1. Lire `CLAUDE.md` (le quoi technique), ce fichier (le comment),
   `.claude/README.md` (la couche CC).
2. Lire les doctrines `.planning/doctrine-*.md` et `.planning/audit-ui-pages.md`.
3. Lire `STATE.md` (où en est le projet) + `ROADMAP.md` (ce qui reste).
4. Cloner le repo en lecture seule, faire un premier audit de `main` pour se
   caler.
5. Suivre la boucle § 6.
