# Doctrine d'alignement — cartes & tableaux de bord

Établie Phase 06.49 (DEC-128), à partir de la refonte du Tableau de bord et de
la référence Cockpit. Réutilisable sur tout écran à cartes (Conformité,
Caisse, listes synthétiques…). But : un écran se lit comme un SYSTÈME, pas comme
une pile de blocs hétérogènes qui scrolle.

## 1. Tenir sur une page (au-dessus de la ligne de flottaison)
- Un écran de monitoring met l'essentiel dans le 1er viewport (~900px desktop).
- Si le contenu tient mais l'écran scrolle, le problème est le LAYOUT (sections
  empilées pleine largeur, gros `space-y`, cartes hautes), pas la quantité d'info.
- Préférer des RANGÉES de cartes compactes à des sections empilées pleine largeur.

## 2. Anatomie de carte FIXE
Toutes les cartes d'une famille suivent la même ossature verticale :
```
[label muted text-sm] → [corps] → [action mt-auto]
```
- Le `corps` est un SLOT (valeur simple, ventilation, multi-lignes, liste
  d'alertes…) — jamais une composition divergente qui casse l'alignement.
- `h-full` sur la carte + `items-stretch` sur la grille → hauteurs égales par
  rangée, valeurs sur la même ligne de base.
- Valeur : `text-2xl tabular-nums` (chiffres alignés). Pas de `text-3xl` qui
  gonfle la hauteur de rangée.
- `action` collée en bas (`mt-auto`) → les actions s'alignent entre cartes.

## 3. Échelle d'espacement unique (resserrée)
N'utiliser que ces valeurs (scale 4/8/12/16) :
- section-gap : **16px** (`space-y-16` page, `space-y-8` titre→grille)
- card-gap (grille) : **12px** (`gap-12`)
- card-padding : **16px** (`p-16`)
- stack-gap interne : **4px** (`gap-4`)
Pas de `space-y-24` / `gap-16` ad hoc. Rythme dense type Cockpit.

## 4. Couleurs sémantiques en TOKENS
- `text-success` / `text-warning` / `text-destructive` (+ `bg-*`), jamais
  `text-green-700` / `text-amber-700` en brut. Déclinés jour+nuit par les tokens.
- Tout état couleur est DOUBLÉ d'un texte (WCAG 1.4.1) — la couleur n'est jamais
  le seul porteur d'information.

## 5. Layout en rangées homogènes
- Grouper par intention (« À traiter », « Activité », « Conformité »).
- Une rangée = une grille `grid items-stretch gap-12` avec un nombre de colonnes
  qui se replie proprement (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`).
- Densifier l'info plutôt que l'empiler : un détail secondaire (ventilation,
  sous-total 7j) va en `context` de la carte, pas dans une carte dédiée haute.

## Application 06.49 (Tableau de bord)
- 3 rangées : À traiter (3 col) · Activité du mois (6 KPIs, 1 rangée) ·
  Conformité & échéances (2 col). Tient sans scroll sur un viewport desktop.
- `KpiCard` unifiée (anatomie fixe + slots), `SlaBadgesCard` + `ComplianceCard`
  passées en `h-full`, couleurs en tokens.
- Données inchangées (mêmes KPIs/valeurs/liens) — refonte présentation/densité.

## Refs
`apps/web/src/app/(app)/tableau-de-bord/` (page + kpi-card + compliance-card +
sla-badges-card) ; Cockpit (référence de densité) ; tokens success/warning/
destructive (tailwind.config + tokens.generated.css).

## RÈGLE TRANSVERSALE — préserver les valeurs métier du contexte (TAP/CGSS/974)

Les composants et patrons partagés portent la STRUCTURE (alignement, espacement,
mécanique). Ils ne définissent JAMAIS les VALEURS métier, qui restent propres à
chaque écran et au contexte du projet (transport sanitaire conventionné CGSS, La
Réunion) :

- Libellés et vocabulaire métier (statuts Validée/Affectée, modes Taxi
  conventionné/TPMR, canal SMS/Appel, permis, CGSS…) — jamais génériques.
- Défauts métier délibérés (ex. filtre courses = aujourd'hui, « focus
  régulatrice »).
- Colonnes/champs spécifiques par entité.
- Formats locaux FR/974 (dates/heures FR, téléphones 0262/0263/0692/0693, CP
  974).
- Tri et seuils adaptés au contexte d'usage.

Un patron partagé est un CONTENANT paramétrable : il reçoit ces valeurs, il ne
les remplace pas. Lisser ces spécificités vers du générique = régression métier,
à refuser.
