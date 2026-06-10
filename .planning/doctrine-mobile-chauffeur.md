# Doctrine — parcours chauffeur mobile (PWA terrain)

> Doctrine durable issue de la Phase 06.55 (DEC-134). À relire avant toute
> évolution de l'écran chauffeur (`apps/web/src/app/(driver)/`).

## Principe : nature DISTINCTE du back-office

Le chauffeur est sur le terrain : soleil, batterie, **une seule main**, mains
parfois occupées, réseau 3G. L'écran chauffeur n'est pas une version réduite du
back-office régulateur — c'est un produit à part avec ses propres règles.

`(driver)` layout = `<main mx-auto max-w-[640px]>` : mobile assumé. Le « vide »
sur grand écran est un **artefact** (la PWA est utilisée sur téléphone) — ne pas
sur-corriger le rendu desktop.

## Règles sourcées

### 1. Zone du pouce

Actions primaires **en bas** de l'écran/carte, cible **≥ 44px** (h-11). La
primaire (Démarrer / Clôturer) = `h-14` (56px). Les actions lourdes
(« Patient absent », course perdue) sont **un cran moins proéminentes**
(`h-12` outline) et **détachées** par un écart + filet (anti mis-tap, DEC-014).

### 2. Modales d'action → bottom-sheet (jamais boîte centrée)

Sur mobile, une modale d'action devient un **bottom-sheet** ancré en bas : le
pouce est déjà en bas (les actions partent du bas de carte), une boîte centrée
oblige à remonter. Sourcé Material Design (bottom sheets) / LogRocket (mobile
modal patterns).

Composant partagé : `components/ui/bottom-sheet.tsx`, construit sur **Radix
Dialog** → focus trap, `aria-modal`, fermeture Escape + backdrop **gratuits**
(RGAA). Ajoute poignée de glissement + **drag-to-dismiss** tactile (seuil 96px).
Fermeture : swipe poignée, backdrop, Escape, ou boutons d'action en bas.
`title` obligatoire (rendu `h2` Radix → accessible et ciblable par les E2E
`getByRole('heading')`). `prefers-reduced-motion` neutralise animations +
snap-back (règle globale `globals.css`).

Migrés : `end-ride-modal` (Clôturer), `no-show-modal` (Patient absent).

### 3. Notice RGPD par COUCHES (layered privacy notice)

Notice géoloc à deux couches, **sans dark pattern** (refus aussi accessible que
le reste) :

- **1re couche TOUJOURS visible** — courte mais informative : **quoi + pourquoi
  + rétention**. Ex. « À chaque pointage, votre position est captée et liée à la
  course. Conservée 90 j max. »
- **« En savoir plus »** (`aria-expanded` + `aria-controls`) déplie le détail :
  service uniquement (jamais en continu), permission refusable (le pointage
  marche sans GPS), retrait / contact DPO.

Dismiss **mémorisé** (`localStorage`) — ne pas réafficher le pavé à chaque
visite. Fond/encadré discret conservé.

### 4. Pas de debug visible en prod

Tout bandeau de diagnostic (« PWA debug · état détecté ») est **DEV uniquement**
(`process.env.NODE_ENV !== 'production'` → inliné, retiré du bundle prod). Le
prompt d'install légitime (Android/Chrome installable, iOS Safari instructions)
reste ; l'état `unsupported` (desktop/Firefox iOS) ne rend rien.

### 5. Clavier numérique

Tout champ numérique conserve un `inputMode` adapté : tarif = `"decimal"`
(clavier chiffres), motif = texte. **Ne jamais régresser** le tarif vers
`type="number"` ou un clavier alpha. (Audit app : le reste est déjà sain.)

## Carte course (anatomie)

Liseré d'état 4px en haut (orange `en_cours` / vert `terminee` / neutre /
rouge annulée) · heure `text-2xl tabular-nums` · patient · meta `mode · urgence`
· trajet départ→arrivée dans un sous-bloc `bg-muted/50`. **Libellés métier
conservés** : Taxi conv., TPMR, VSL, Ambulance ; Programmée, Urgente, Immédiate.

## Périmètre 06.55 (présentation/ergonomie)

Logique métier (`endRideAction`, no-show, capture géoloc, pointage, file
offline Dexie) **INCHANGÉE**. Libellés métier conservés. `max-w-640` conservé.
0 migration, 0 dépendance.

## Reste à enchaîner (plan d'audit)

cockpit/optimisation, pages texte légales, utilitaires.
