# Règle de neutralité et ton — projet TAP

> Fichier d'instructions permanent à charger en début de session.
> Toute production (code, UI, commentaires, commits, docs, ADR,
> SUMMARY, mockups) respecte les règles ci-dessous sans exception.

---

## 1. Aucun nom propre

Interdits dans toute production écrite :

- Noms de personnes physiques (utilisateurs, clients, équipiers,
  testeurs, design partners, dirigeants).
- Pseudos, prénoms, initiales identifiables.
- Mentions « Guillaume », « Marie », ou tout autre nom déjà
  apparu dans des conversations passées.

Utiliser à la place des rôles fonctionnels :

- `dirigeant` / `dirigeant·e`
- `régulateur` / `régulatrice`
- `chauffeur` / `chauffeuse`
- `patient` / `patiente`
- `design partner` (générique)
- `utilisateur authentifié` / `compte`

S'applique à :

- Variables, identifiants, classes, schemas DB
- Commentaires, JSDoc, docstrings
- Commits, descriptions de PR
- Données de seed et fixtures de test (utiliser noms fictifs
  réunionnais génériques type « Hoarau Patrick », « Payet Marie »
  uniquement dans le seed.demo.sql où ils sont nécessaires à
  l'illustration ; jamais réinjectés dans le code applicatif)
- Mockups, captures, screenshots inclus dans le repo
- Pages produit, marketing, légales

Données fictives du seed démo : OK car explicitement marquées
fictives, jamais corrélées à des personnes réelles, et
nécessaires au walkthrough. Hors seed, aucun nom propre.

---

## 2. Ton sobre, factuel, professionnel

Toute formulation UI tient sur ces principes :

- **Voix neutre instructionnelle.** Préférer l'infinitif ou
  l'impératif sec : « Saisir le tarif », « Confirmer la course ».
- **Pas de tutoiement amical.** Si une instruction directe est
  utile, elle reste fonctionnelle (« Saisis le tarif » plutôt que
  « Allez, c'est parti, tu remplis ! »).
- **Pas de vous infantilisant** non plus (« Veuillez avoir
  l'amabilité de... »). Le vous formel direct est OK.
- **Pas d'émojis** dans l'UI, jamais. Ni dans les notifications,
  ni dans les empty states, ni dans les toasts.
- **Pas d'humour, pas de blagues, pas de clins d'œil.** Pas de
  « Profite de ta journée », « Bon courage », « On y va ! »,
  « Yes ! ».
- **Pas de gamification.** Pas de badges « Bravo », pas de
  félicitations sur une action banale (un encaissement, une
  saisie, une déconnexion).
- **Pas de jargon technique** côté UI. « Identifiants invalides »
  plutôt que « Auth error 401 ». Reformuler systématiquement les
  erreurs Postgres / Supabase / fetch.

Référence mentale partagée : Linear, Plain, Stripe Dashboard,
Vercel Dashboard, Mercury. Lire un message une fois suffit.
Aucun adjectif ne traîne.

---

## 3. Empty states

Modèle :

1. Icône Lucide fine, taille modérée (24–48 px).
2. Titre factuel décrivant l'état (« Aucune course planifiée »,
   « Aucun patient enregistré », « Aucun chauffeur actif »).
3. Sous-titre muted décrivant la suite naturelle, sans
   instructions excessives (« Les courses du jour s'afficheront
   ici. », « Les patients ajoutés apparaîtront ici. »).

Interdit :

- Illustrations rigolotes, mascottes, dessins.
- Encouragements (« On commence ? », « C'est ici que la magie
  opère »).
- Boutons CTA placés dans l'empty state sauf si l'action est
  l'unique chose à faire à ce stade. Dans ce cas, libellé sec
  (« Nouveau patient », pas « Ajoute ton premier patient »).

---

## 4. Communications de l'agent

Réponses à l'utilisateur dans le chat :

- En français, claires et précises.
- Pas de blabla d'introduction (« Excellente question ! »).
- Pas d'éloges (« Excellent travail », « Belle décision »).
- Aller au fait. Trade-offs nommés en une phrase.
- Pas de récap mécanique « j'ai fait X puis Y puis Z » sauf si
  l'utilisateur le demande explicitement.

Le nom de l'utilisateur ne doit jamais apparaître dans une
réponse. Si la conversation passée l'évoque, l'agent l'ignore.

---

## 5. Commits, PRs, ADRs

Convention :

- Titre commit/PR : `type(scope): description en français` —
  factuel, présent ou infinitif. Pas de « Merci à », pas de
  « pour @qqn ».
- Description : ce qui change, pourquoi, ce qui n'est pas modifié.
  Pas de salutation, pas de signature manuelle (le footer
  `https://claude.ai/code/...` est ajouté automatiquement).
- Aucune mention d'une personne nommée dans le corps. Si un
  rôle a demandé le changement, écrire « rôle dirigeant
  demande... » ou « validé par design partner ».

---

## 6. ADR et docs internes

Les ADR (`docs/adr/`), notes d'observation
(`docs/observations/`), SUMMARY de phases (`.planning/phases/`) :

- Décrivent le système et la décision, pas la personne qui l'a
  prise.
- Si un acteur doit apparaître, citer le rôle (« le dirigeant »,
  « la régulatrice ») jamais le nom.
- Pas de citations directes attribuées (« Guillaume a dit que »).

---

## 7. Si l'agent doute

En cas d'ambiguïté sur une formulation :

- Choisir la version la plus courte et la plus neutre.
- Si l'utilisateur a fourni un libellé précis dans le brief,
  l'utiliser tel quel (source de vérité).
- Si une suggestion d'amélioration peut faire gagner en clarté,
  la proposer en commentaire de PR plutôt que de l'imposer.

---

## 8. Application rétroactive

Cette règle s'applique :

- À toute production future.
- Aux corrections de production existante quand l'agent y
  retouche pour une autre raison (opportuniste, pas de PR
  dédiée « purge des noms propres » sauf demande explicite).

---

**Fin du fichier. À relire à chaque nouvelle session.**
