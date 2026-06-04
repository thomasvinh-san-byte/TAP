# Workflow design tokens — Phase 06.14

> Phase 06.14 — `2026-06-04`. Comment éditer, régénérer et consommer
> les design tokens TAP. Source unique : `tokens.json` + `tokens.dark.json`
> (Token Sets DTCG 2025.10). Outputs générés : `tokens.generated.css` +
> `tokens.generated.ts`.

---

## 1. Sources et outputs

```
apps/web/src/styles/
├── tokens.json           ← SOURCE light (W3C DTCG, éditable à la main)
├── tokens.dark.json      ← SOURCE dark overrides (Token Sets DTCG, 19 chromatiques)
├── tokens.generated.css  ← OUTPUT (ne pas éditer — régénéré au build)
└── tokens.generated.ts   ← OUTPUT (ne pas éditer — export hex pour PDF/PWA)
```

Les outputs portent l'en-tête `/* GÉNÉRÉ par tokens:build — ne pas éditer */`.
Toute modification manuelle sera écrasée à la prochaine génération.

## 2. Workflow : éditer un token

1. **Éditer la source** :
   - Modifier une valeur light → `tokens.json`.
   - Modifier une variante dark → `tokens.dark.json`.
   - Ajouter un nouveau token → `tokens.json` (light), puis si chromatique
     avec variante sombre, l'override dans `tokens.dark.json`.
2. **Régénérer les outputs** :
   ```bash
   pnpm --filter @tap/web tokens:build
   ```
3. **Vérifier le diff** :
   ```bash
   git diff apps/web/src/styles/tokens.generated.{css,ts}
   ```
4. **Commit** : la source ET les outputs régénérés dans le même commit.

## 3. Bascule de thème (light / dark)

Le thème est piloté par l'attribut `data-theme` sur `<html>`. Script
anti-FOUC dans `apps/web/src/app/layout.tsx` qui lit `localStorage.theme`
puis applique `data-theme="dark"` AVANT le rendu React.

```html
<!-- mode jour (défaut) -->
<html lang="fr">

<!-- mode nuit -->
<html lang="fr" data-theme="dark">
```

Le bloc `[data-theme='dark']` du fragment généré applique les 19
overrides chromatiques. Les invariants (spacing, typo, radius, shadow,
motion, touchTarget) restent inchangés — voir DEC-01 (Token Sets).

## 4. Pipeline de génération

```
tokens.json + tokens.dark.json
    │
    ├──► style-dictionary.config.mjs (v4, ESM)
    │       │
    │       ├──► customFormat tap/css-themed
    │       │       │
    │       │       └──► tokens.generated.css
    │       │              (:root + [data-theme='dark'])
    │       │
    │       └──► customFormat tap/js-hex
    │               │
    │               └──► tokens.generated.ts
    │                      (export const tokensLight / tokensDark)
    │
    └──► consommateurs :
           - globals.css     (@import en tête)
           - tailwind.config.ts (hsl(var(--x) / <alpha-value>))
           - pdf-template.tsx   (import { tokensLight })
           - layout.tsx         (themeColor PWA)
```

`tokens:build` est branché dans le script `build` (`pnpm tokens:build &&
next build`) — voir D-11. Vercel et tout build local régénèrent
automatiquement.

## 5. Consommateurs JavaScript / TypeScript

`tokens.generated.ts` est consommé là où les CSS vars ne marchent pas
(contextes hors-DOM, runtime Node) :

| Fichier                                                                                          | Usage                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `apps/web/src/lib/pdf/pdf-template.tsx`                                                          | Couleur primaire des PDF (`@react-pdf/renderer`).  |
| `apps/web/src/app/layout.tsx`                                                                    | `themeColor` du manifest PWA (barre de statut iOS / Android). |
| `apps/web/src/app/api/admin/facturation/pdf/_components/facture-cgss-pdf.tsx` (gris uniquement)  | Pas de migration V1 : ne contient que des gris neutres sans token équivalent dans la palette TAP. |

## 6. Convention de nommage CSS vars (D-12)

Le mapping `token path → nom de var CSS` est défini dans
`apps/web/style-dictionary.config.mjs` (objet `VAR_NAME_MAP`). Il
préserve les noms existants déjà consommés par `tailwind.config.ts` et
les overrides `react-datepicker` :

| Token DTCG                  | Var CSS                  |
| --------------------------- | ------------------------ |
| `color.surface.primary`     | `--background`           |
| `color.text.primary`        | `--foreground`           |
| `color.action.primary`      | `--primary`              |
| `color.text.onAction`       | `--primary-foreground`   |
| `color.surface.popover`     | `--popover`              |
| `color.text.onPopover`      | `--popover-foreground`   |
| …                           | …                        |

Voir la table complète dans `style-dictionary.config.mjs`. **Ajouter un
nouveau token mappé** : éditer `VAR_NAME_MAP`, régénérer, vérifier que
le consommateur Tailwind/CSS attendait bien ce nom.

## 7. Pattern alpha Tailwind (D-07)

Les couleurs Tailwind sont déclarées en `hsl(var(--x) / <alpha-value>)`
(voir `tailwind.config.ts:17-42`). Le placeholder `<alpha-value>` est
substitué automatiquement par Tailwind quand on utilise les utilitaires
d'opacité :

```html
<div class="bg-primary">…</div>       <!-- opacité 100 % -->
<div class="bg-primary/50">…</div>    <!-- opacité 50 % -->
<div class="text-foreground/70">…</div>
```

**Ne pas** ajouter `<alpha-value>` dans `globals.css` ni en CSS inline :
le placeholder n'est interprété que par le compilateur Tailwind.

## 8. Liens

- `01-foundations.md` : doctrine d'accessibilité + conventions visuelles
  (Phase 06.13).
- `02-patterns-emergents.md` : 5 patterns réutilisables qui consomment
  les CSS vars (Phase 06.13).
- `.planning/phases/06.14-migration-tokens-tailwind/06.14-CONTEXT.md` :
  décisions D-01 à D-12 (Phase 06.14).
- DTCG Format Module 2025.10 — `designtokens.org/tr/drafts/format`.
- Style Dictionary 4.x — `styledictionary.com`.
