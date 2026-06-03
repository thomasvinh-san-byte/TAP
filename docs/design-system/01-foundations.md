# Design system TAP — Foundations

> Phase 06.13 — `2026-06-03`. Document de doctrine et de conventions
> visuelles. **Documente l'existant**, ne décrit pas un objectif futur.
> Toutes les valeurs sont traçables dans
> `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts` et
> `apps/web/src/styles/tokens.json` (source de vérité W3C).

---

## 1. Préface

### Raison d'être

Au moment de la rédaction (post Phase 06.11), le SaaS TAP a accumulé
**5 patterns réutilisables sans doctrine commune** : `KpiCard`,
`EmptyState`, `RideBadge`, `SlaBadgesCard`, `HautsBadge`. Les
inspirations FOSS sont jusqu'ici opportunistes (Doctolib, Stripe,
Solvice, HVI, RoadWarrior, tule2236, NHS). Ce document formalise les
fondations pour que les phases suivantes (06.14 migration tokens,
06.15 refonte data tables, 06.16 refonte settings, etc.) s'appuient sur
une base commune.

### Doctrine d'accessibilité (DEC-088 LOCKED)

- **Cible** : WCAG 2.1 AA + RGAA 4.1.2.
- **Transition WCAG 2.2** : reportée à une phase ultérieure
  (vraisemblablement Phase 09 HDS).
- **Rationale** : RGAA 4.1.2 reste la transposition française de
  référence pour 2026. Pas de sur-engagement prématuré tant qu'aucun
  audit formel n'est exigé par un client. Le RGPD impose de
  *démontrer* la conformité ; l'accessibilité impose de *viser* un
  niveau et de le *documenter*.
- **Minimum non négociable** sur tout composant TAP :
  - contraste 4.5:1 sur texte body (3:1 sur grand texte ≥ 18 px) ;
  - focus visible (anneau, jamais retiré) ;
  - navigation clavier complète ;
  - couleur jamais seule (toujours doublée d'un texte ou d'une icône) ;
  - landmarks ARIA pour la structure de page (`<main>`, `<header>`,
    `<nav>`, `<aside>`) ;
  - cible tactile ≥ 44 px côté régulateur, ≥ 56 px côté chauffeur.

### Étoile polaire hybride (DEC-089 LOCKED)

Inspirations par domaine, ré-implémentées en shadcn/Tailwind. **Aucune
lib externe adoptée** :

| Domaine                                | Référence FOSS                  |
| -------------------------------------- | ------------------------------- |
| Data tables, dashboards, data viz      | IBM Carbon                      |
| Tokens élévation, settings, navigation | Atlassian DS                    |
| Santé, accessibilité, ARIA             | NHS Digital Service Manual v10  |
| Settings/billing/forms                 | Stripe + Polaris (déjà adopté)  |
| Smart defaults                         | Doctolib (déjà adopté)          |

### Portée

- **V1** : `apps/web/` (régulateur + admin + PWA chauffeur, qui
  partagent les CSS vars / tailwind config).
- **Hors V1** : exports PDF (`@react-pdf/renderer`, chantier reporté
  DEC-091), mobile native (Phase 07 si déclenchée).

---

## 2. Couleurs sémantiques

Toutes les couleurs sont définies en composantes HSL dans
`globals.css` (sans `hsl(…)` wrapper), exposées comme variables CSS
puis consommées via Tailwind. **Le mode jour ET le mode nuit sont
traités à parité** (CLAUDE.md § 1 pilier 2) — chaque variable a un
pendant `[data-theme='dark']`.

### Surfaces

| Token sémantique         | CSS var             | Mode jour           | Mode nuit           | Tailwind        |
| ------------------------ | ------------------- | ------------------- | ------------------- | --------------- |
| `color.surface.primary`  | `--background`      | `hsl(0 0% 100%)`    | `hsl(222 47% 8%)`   | `bg-background` |
| `color.surface.muted`    | `--muted`           | `hsl(210 40% 96%)`  | `hsl(217 33% 17%)`  | `bg-muted`      |
| `color.surface.driver`   | `--driver-surface`  | `hsl(45 100% 98%)`  | `hsl(30 25% 10%)`   | (custom CSS)    |

### Texte

| Token                  | CSS var               | Mode jour           | Mode nuit           | Tailwind                  |
| ---------------------- | --------------------- | ------------------- | ------------------- | ------------------------- |
| `color.text.primary`   | `--foreground`        | `hsl(222 47% 11%)`  | `hsl(210 40% 96%)`  | `text-foreground`         |
| `color.text.muted`     | `--muted-foreground`  | `hsl(215 16% 47%)`  | `hsl(215 20% 65%)`  | `text-muted-foreground`   |
| `color.text.onAction`  | `--primary-foreground`| `hsl(0 0% 100%)`    | `hsl(222 47% 11%)`  | `text-primary-foreground` |

### Actions

| Token                    | CSS var       | Mode jour           | Mode nuit           | Tailwind     |
| ------------------------ | ------------- | ------------------- | ------------------- | ------------ |
| `color.action.primary`   | `--primary`   | `hsl(217 92% 32%)`  | `hsl(217 91% 60%)`  | `bg-primary` |
| `color.action.accent`    | `--accent`    | `hsl(14 78% 55%)`   | `hsl(14 78% 60%)`   | `bg-accent`  |
| `color.action.focusRing` | `--ring`      | `hsl(217 92% 32%)`  | `hsl(217 91% 60%)`  | `ring-ring`  |

### Feedback

| Token                       | CSS var          | Mode jour           | Mode nuit           | Tailwind          |
| --------------------------- | ---------------- | ------------------- | ------------------- | ----------------- |
| `color.feedback.success`    | `--success`      | `hsl(142 71% 35%)`  | `hsl(142 71% 45%)`  | `text-success` (sémantique cible) |
| `color.feedback.warning`    | `--warning`      | `hsl(32 95% 50%)`   | `hsl(32 95% 55%)`   | `text-warning`    |
| `color.feedback.danger`     | `--destructive`  | `hsl(0 72% 51%)`    | `hsl(0 63% 50%)`    | `text-destructive`|
| `color.feedback.info`       | `--info`         | `hsl(217 91% 60%)`  | `hsl(217 91% 70%)`  | `text-info`       |

> **Note d'usage** : pendant la transition, plusieurs composants utilisent
> encore les classes Tailwind brutes (`text-green-700`, `text-amber-700`,
> `text-red-300`, etc.) au lieu des tokens sémantiques. La migration sera
> traitée en Phase 06.14. Ce document acte la cible.

### Bordures

| Token                  | CSS var    | Mode jour           | Mode nuit           | Tailwind     |
| ---------------------- | ---------- | ------------------- | ------------------- | ------------ |
| `color.border.default` | `--border` | `hsl(214 32% 91%)`  | `hsl(217 33% 22%)`  | `border`     |
| `color.border.input`   | `--input`  | `hsl(214 32% 91%)`  | `hsl(217 33% 22%)`  | `border-input` |

---

## 3. Échelle d'espacement

Échelle stricte définie dans `tailwind.config.ts` :

```ts
spacing: { '4': '4px', '8': '8px', '12': '12px', '16': '16px',
           '24': '24px', '32': '32px', '48': '48px', '64': '64px' }
```

**Règle absolue** (CLAUDE.md § 1 pilier 2) : aucune valeur
intermédiaire (jamais de `p-10`, `gap-20`, etc.). 8 niveaux suffisent
pour tout l'UI.

| Token         | Valeur | Tailwind  | Usage typique                                  |
| ------------- | ------ | --------- | ---------------------------------------------- |
| `spacing.0`   | 0      | `p-0`     | Reset.                                         |
| `spacing.4`   | 4 px   | `gap-4`   | Espacement dense entre badges, icône+texte.    |
| `spacing.8`   | 8 px   | `gap-8`   | Lignes de liste, groupes de boutons.           |
| `spacing.12`  | 12 px  | `gap-12`  | Boutons + texte d'action.                      |
| `spacing.16`  | 16 px  | `p-16`    | Padding standard des cards.                    |
| `spacing.24`  | 24 px  | `gap-24`  | Espacement entre sections.                     |
| `spacing.32`  | 32 px  | `px-32`   | Marges de container desktop.                   |
| `spacing.48`  | 48 px  | `py-48`   | Padding des empty states centrés.              |
| `spacing.64`  | 64 px  | `py-64`   | Espacement de section très large.              |

---

## 4. Typographie

### Famille unique

```ts
fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
```

**Inter** chargée via system fallback (pas de lien Google Fonts dans
le repo à ce jour — laissé au navigateur ou installation OS).
`font-feature-settings: 'tnum'` activé sur `<html>` dans `globals.css`
pour chiffres tabulaires (impératif lisibilité tableaux).

### Échelle

| Token                | Valeur | Usage typique                                       |
| -------------------- | ------ | --------------------------------------------------- |
| `typography.fontSize.xs`    | 12 px | Captions, deltas N vs N-1, labels denses.   |
| `typography.fontSize.sm`    | 14 px | Texte de table, descriptions, boutons.      |
| `typography.fontSize.base`  | 16 px | Texte de corps par défaut.                  |
| `typography.fontSize.lg`    | 18 px | Texte d'action PWA chauffeur (CLAUDE.md § 5). |
| `typography.fontSize.xl`    | 20 px | Valeurs principales KPI multi.              |
| `typography.fontSize.2xl`   | 24 px | Titres de page H1.                          |
| `typography.fontSize.3xl`   | 30 px | Valeurs principales KPI simple / ventilation. |

### Graisses

`normal` 400, `medium` 500, `semibold` 600, `bold` 700. La graisse
800/900 n'est pas utilisée dans le repo.

### Letter spacing

- `tracking-tight` (`-0.025em`) : H1, titres de page.
- `tracking-wide` (`0.025em`) : labels uppercase de section (ex :
  « À TRAITER », « ACTIVITÉ »).

---

## 5. Rayons (radii)

Base définie par CSS var `--radius: 8px`. Variantes Tailwind dérivées
par `calc()` dans `tailwind.config.ts` :

| Token         | Valeur | Tailwind     | Usage                              |
| ------------- | ------ | ------------ | ---------------------------------- |
| `radius.sm`   | 4 px   | `rounded-sm` | Badges, chips, petits éléments.    |
| `radius.md`   | 6 px   | `rounded-md` | Boutons, inputs.                   |
| `radius.lg`   | 8 px   | `rounded-lg` | Cards, panels, modals.             |
| `radius.full` | 9999 px| `rounded-full`| Pastilles rondes, avatars circulaires. |

---

## 6. Élévation (shadows)

3 niveaux maximum (doctrine Atlassian). Documentés dans `tokens.json`
mais **pas encore consommés systématiquement** dans le code — la
migration vers `shadow-subtle/raised/overlay` viendra en Phase 06.14.

| Token            | Valeur (mode jour)                  | Usage typique                                       |
| ---------------- | ----------------------------------- | --------------------------------------------------- |
| `shadow.subtle`  | `0 1px 2px rgba(0, 0, 0, 0.05)`     | Cards de KPI au repos.                              |
| `shadow.raised`  | `0 4px 6px rgba(0, 0, 0, 0.07)`     | Hover sur cards interactifs.                        |
| `shadow.overlay` | `0 10px 15px rgba(0, 0, 0, 0.10)`   | Modals, sheets, popovers (Radix), datepicker.       |

> **Mode sombre** : pour V1 les ombres sont conservées telles quelles
> (transparence noir 5/7/10 %). Une révision dédiée mode sombre est
> à planifier si une vraie palette d'ombres sombre est requise (cf.
> Atlassian DS qui propose `shadow.overlay.dark`).

---

## 7. Motion

### Durations

| Token             | Valeur | Usage                                                |
| ----------------- | ------ | ---------------------------------------------------- |
| `motion.duration.fast`   | 150 ms | Défaut Tailwind (`transitionDuration.DEFAULT`). Hover, focus, micro-interactions. |
| `motion.duration.medium` | 200 ms | `.animate-fade-in`, `.cockpit-row-fade-in`, `.cockpit-noshow-slide-in`. |
| `motion.duration.slow`   | 400 ms | Stagger animation chorégraphiée (CLAUDE.md § 1 pilier 2 — < 600 ms total). |

### Easings

| Token                  | Valeur                            | Usage          |
| ---------------------- | --------------------------------- | -------------- |
| `motion.easing.out`    | `cubic-bezier(0, 0, 0.2, 1)`      | Apparition.    |
| `motion.easing.in`     | `cubic-bezier(0.4, 0, 1, 1)`      | Disparition.   |
| `motion.easing.inOut`  | `cubic-bezier(0.4, 0, 0.2, 1)`    | Bidirectionnel (toggle, pulse). |

### Reduced motion

`@media (prefers-reduced-motion: reduce)` réduit toutes les
`animation-duration` et `transition-duration` à `0.01ms` globalement
dans `globals.css`. Les keyframes spécifiques (cockpit, slide-in, etc.)
ont également une règle dédiée. **Respect non négociable** (WCAG 2.1
Critère 2.3.3).

---

## 8. Doctrine accessibilité datée — check-list WCAG 2.1 AA

Liste opérationnelle à vérifier sur tout nouvel écran TAP. La cible
RGAA 4.1.2 reprend ces points en français avec critères de test.

### Couleur & contraste

- [x] Contraste texte/fond ≥ 4.5:1 (texte standard) ou ≥ 3:1 (≥ 18 px
      ou ≥ 14 px bold). Vérifiable via DevTools couleur picker.
- [x] Couleur jamais seule porteuse d'information (NFR-003). Toujours
      doubler par texte, icône ou pattern. Exemples : `RideBadge`
      affiche le mot « Urgente » à côté de l'icône `Zap` ;
      `SlaBadgesCard` affiche le texte de la règle à côté de la
      pastille colorée.

### Focus & clavier

- [x] Focus visible sur tout élément interactif (`focus-visible:ring-2
      focus-visible:ring-ring focus-visible:ring-offset-2`). Jamais
      `outline: none` sans alternative visuelle.
- [x] Navigation clavier complète : Tab parcourt l'ordre logique,
      Shift+Tab inverse, Espace/Entrée active.
- [x] Tooltips accessibles au clavier : `tabIndex={0}` sur les badges
      avec `title` (cf. `HautsBadge`).

### Structure sémantique

- [x] `<h1>` unique par page, hiérarchie `<h2>` / `<h3>` respectée.
- [x] Landmarks ARIA : `<main>` au minimum, `<header>`/`<nav>` si
      pertinent (cf. `layout.tsx` régulateur).
- [x] `aria-labelledby` sur les sections (cf. `SlaBadgesCard`,
      `ComparativeView`).
- [x] `aria-label` sur les boutons icône-seule.
- [x] `aria-hidden` sur les icônes décoratives accompagnant un texte.

### Cibles tactiles

- [x] Régulateur : `min-h-[44px]` sur tous les boutons d'action (cf.
      `KpiCard`, `SlaBadgesCard`, `EmptyState`). WCAG 2.1 niveau AAA
      mais déjà appliqué.
- [x] Chauffeur PWA : `≥ 56 px` (CLAUDE.md § 5). Texte d'action ≥ 18 px.

### Reduced motion

- [x] `prefers-reduced-motion` respecté globalement (cf. § 7).

### À ajouter au fil de l'eau (non-bloquant V1)

- [ ] **Skip links** vers `<main>` pour clavier-only. Manquant dans
      `layout.tsx` régulateur — à ajouter Phase 06.14 ou 06.15.
- [ ] **Audit Lighthouse / axe-core** automatisé en CI. Non installé
      V1 — à cadrer dans une phase dédiée si nécessaire (Access42 ou
      audit interne).
- [ ] **Migration explicite vers RGAA 4.1.2 test sheets** : aujourd'hui
      la conformité est par construction (suivi des doctrines WCAG),
      pas auditée formellement. À envisager avant un audit client.

---

## 9. Évolutions possibles (hors périmètre 06.13)

- **Phase 06.14** : faire consommer `tokens.json` par
  `tailwind.config.ts` (via un script de génération, ou import direct).
  Bascule progressive des classes Tailwind brutes (`text-green-700`,
  `border-amber-300`, etc.) vers les tokens sémantiques
  (`text-feedback-success`, `border-feedback-warning`).
- **Phase 06.15** : refonte des data tables (cockpit, courses,
  patients) selon doctrine Carbon — densité, alignement, tri,
  pagination, hover, sélection.
- **Phase 06.16** : refonte settings/admin selon doctrine Linear +
  Stripe — formulaires denses, save bar persistante, états dirty
  visibles.
- **Phase ultérieure (HDS ou audit)** : transition WCAG 2.2 + audit
  RGAA 4.1.2 par Access42 ou équivalent.
