# Gabarit de prompt autoporteur (architecte-chat → Claude Code)

> Copier ce squelette pour chaque lot. Tout doit être INLINE : CC ne va rien
> chercher ailleurs. Remplir chaque section ; supprimer les crochets.

---

## Prompt Claude Code — [Titre court du lot]

[1-3 phrases : ce que fait le lot et pourquoi maintenant. Mentionner si dérivé
d'une maquette validée. Dater la vérification du code.]

### Pourquoi

[Le besoin (métier + utilisateur). Si décision UI/archi : résumer la recherche
sourcée qui justifie le choix — avec la substance, pas juste « j'ai cherché ».]

### État vérifié

[Ce qui existe RÉELLEMENT dans le code aujourd'hui : fichiers, composants, props,
patterns en place, bricolages à remplacer. Vérifié par lecture/grep, pas
supposé. Lister les SPÉCIFICITÉS MÉTIER à préserver.]

### Maquette de référence (si refonte visuelle)

[Nom du fichier maquette validé + description de ce qu'il montre.]

### Décisions fermées

- **D-01 — [intitulé]**. [décision précise, non ambiguë]
- **D-02 — [intitulé]**. […]
- **D-0n — Périmètre**. [ce qui est touché / ce qui reste INCHANGÉ : données,
  validation, logique, valeurs métier]
- **D-0n — Préserver les valeurs métier**. [rappeler la règle si des patrons
  partagés sont en jeu : structure partagée, valeurs contextuelles intactes]

### Garde-fous

DEC-032 (push via branche+PR), guard-commit (typecheck+format+tests verts),
≤300 LOC/fichier (CON-008), WCAG AA/RGAA, jour+nuit (tokens, 0 hex en dur),
prefers-reduced-motion, NFR-001 (aucun nom propre du seed en dur), DEC-003 (zéro
nouvelle dépendance), direction DEC-101 (sobre, bleu institutionnel, terracotta
rare). [+ garde-fous spécifiques au lot.] Ne pas s'abonner.

### Tâches

- T1 […]
- T2 […]
- Tn validation.

### Validation

```
[commandes grep/typecheck/build/test qui PROUVENT que les décisions sont appliquées]
```

- [critères lisibles : ce qu'on doit constater à l'écran, jour+nuit, responsive,
  valeurs métier intactes. Renvoyer à la maquette si applicable.]

### Cadrage planning

Phase 06.NN « [titre] ». ROADMAP : cocher. DEC-NNN : « [texte de la décision pour
PROJECT.md, autoporteur et traçable] ». [ADR si archi lourde.]

### Commit / PR

Branche `feat/06.NN-[slug]`. Commit `feat(06.NN): [titre]`. PR avant/après
(jour+nuit + mobile si pertinent). 0 migration / 0 dépendance [adapter]. Ne pas
s'abonner.
Après merge : sync STATE + ROADMAP. [Versements `.planning/` éventuels. Lot
suivant.]

---

## Rappels de qualité du prompt

- Une décision ambiguë = un aller-retour. Fermer chaque décision.
- Toujours une section « État vérifié » FONDÉE sur le code réel.
- Toujours préserver les valeurs métier quand un patron partagé est touché.
- La validation doit être VÉRIFIABLE (commandes), pas juste déclarative.
- Numéro de phase : prendre le suivant libre ; vérifier qu'aucune phase en
  attente de merge n'occupe déjà le numéro.
