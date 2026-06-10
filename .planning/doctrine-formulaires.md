# Doctrine formulaire — back-office TAP

Établie Phase 06.51 (DEC-130), à partir de la refonte du formulaire patient.
Réutilisable sur tout formulaire de saisie (véhicule, chauffeur, tarifs…).
Complémentaire de la doctrine d'alignement (`doctrine-alignement-dashboard.md`).

## 1. Quand 2 colonnes, quand 1 colonne
- **1 colonne** = bon défaut pour 90 % des formulaires (conversion grand public,
  parcours linéaire court).
- **2 colonnes « tout visible »** = justifié pour la **saisie de données dense
  répétée en back-office** (la régulatrice saisit des patients à la chaîne et
  doit relire/contrôler d'un coup). Recherche : multi-colonnes pertinent quand
  l'utilisateur entre de nombreux points liés simultanément (admin, compta).
- **Souple** : 2 colonnes si assez de sections, sinon 1. Toujours **1 colonne
  < lg** (mobile).

## 2. Anti-saut de champ (Baymard) — lecture LIGNE PAR LIGNE
Le multi-colonnes mal fait fait sauter des champs. Parade : chaque **section**
se lit gauche→droite, ligne par ligne (`FormRow`). **Jamais** « une colonne
entière puis l'autre » pour des champs d'une même section. L'ordre de tabulation
suit la lecture (DOM = ordre visuel par ligne).

## 3. Patron de layout PARTAGÉ (`components/form/form-layout.tsx`)
- `FormColumns` : grille `lg:grid-cols-2 gap-24` (1 col < lg).
- `FormColumn` : pile verticale de sections (`space-y-24`).
- `FormSection` : titre xs uppercase muted + champs (`space-y-12`).
- `FormRow` : ligne de champs liés (`grid-cols-2 gap-12`), lus gauche→droite.
- `FormActions` : barre en bas, filet séparateur (`border-t pt-16`), boutons
  alignés à droite (Annuler secondaire + soumission primaire bleu).
Le form lui-même : `mx-auto w-full max-w-[980px] space-y-24`.

## 4. Largeur de champ selon le CONTENU
- Champs courts en largeur **réduite** : date, code postal, sexe, téléphone
  (~220-240px max) — pas pleine largeur (évite le champ étiré illisible).
- Champs longs **larges** : adresse, complément, note.

## 5. Champs HOMOGÈNES
- Tous au gabarit `<Input>` (h-10), même radius, même focus.
- `ui/Textarea` pour les zones de texte (jamais un `<textarea>` stylé à la main).
- Labels **au-dessus** du champ (jamais à gauche/placeholder-only).
- **Selects** : `ui/Select` (Radix) est CONTRÔLÉ et n'a **pas** de `name` → il ne
  soumet pas dans un `<form action>` natif. Deux options : (a) `ui/Select` +
  `<input type="hidden" name=...>` (cf. ville), (b) `<select name>` natif stylé
  au gabarit Input (cf. genre/canal). Ne pas remplacer un select natif soumettant
  par un `ui/Select` sans hidden input — ça casse l'envoi.

## 6. Espacement (échelle unique)
- field-gap intra-section : **12px** (`space-y-12`)
- section-gap dans une colonne : **24px** (`space-y-24`)
- colonnes : **24px** (`gap-24`)
- action bar : `pt-16` au-dessus du filet.

## 7. Accessibilité
- Labels liés (`htmlFor`/`id`), helpers via `aria-describedby`, `aria-invalid`.
- Tabulation ligne par ligne (pas de saut visuel ↔ DOM).
- Focus outline (cf. DEC-126) ; jour+nuit par tokens.

## 8. Page vs drawer — choix par densité (DEC-139, sourcé Eleken/Zuora/LogRocket 2026)
- **Page** = formulaire **dense** (> ~10 champs, sections multiples, saisie de
  référence à relire d'un coup — ex. patient 13 champs).
- **Drawer (Sheet)** = **formulaire de base** (≤ ~6 champs — ex. chauffeur 5,
  véhicule 6). Un drawer n'est PAS une page comprimée : il a sa propre structure.
- **Drawer structuré en 3 zones** : `SheetHeader` figé (titre + description) ·
  **corps scrollable** (`flex-1 overflow-y-auto`) · `SheetFooter` ANCRÉ en bas
  (`border-t`, bouton primaire + Annuler ghost). Le bouton de soumission vit dans
  le footer (le `<form>` enveloppe corps + footer). `SheetContent` = `flex
  flex-col p-0`, zones internes paddées. La largeur du form épouse le drawer
  (`w-full`) — pas de `max-w` global vestige de page (les `max-w` par champ
  restent légitimes).
- Une section réduite à **une seule checkbox** (statut « actif ») n'a PAS de
  titre-kicker `FormSection` : ligne discrète séparée par un filet
  (`border-t pt-12`) — éviter l'effet « vide segmenté ».

## 9. Checkbox = primitive `ui/Checkbox` (DEC-139)
- **Jamais** de `<input type="checkbox">` brut (pas de focus ring, état coché
  incohérent jour/nuit). Toujours `components/ui/checkbox.tsx` : vrai input natif
  (clavier, `name`/`value`/`defaultChecked` pour la soumission), tokenisé (carré
  18px, coché `bg-primary` + coche blanche, focus ring), cible tactile 24px.
- Choix multiple visuel (ex. permis) = **chips cliquables** : `<label>` englobant
  (toute la pastille est la cible) + `has-[:checked]:border-primary
  has-[:checked]:bg-primary/10`. La checkbox réelle porte le `name`/`value`.

## 10. Troncature & débordement — `min-w-0` sur les conteneurs (DEC-142)
- **Tout conteneur `grid`/`flex` qui héberge du texte tronquable doit porter
  `min-w-0`** (sur lui et/ou ses items). Par spec CSS, un item flex/grid a
  `min-width: auto` (= aussi large que son contenu) : une seule chaîne insécable
  (longue adresse, e-mail) pousse la largeur et fait déborder le parent. **Un
  seul ancêtre sans `min-w-0` neutralise TOUS les `truncate` des enfants** (le
  `truncate` ne peut rétrécir que si la chaîne de parents le permet).
- Primitives partagées : mettre le garde-fou sur le PARENT pour être robuste
  quels que soient les enfants. Ex. `DialogContent` (grid) porte `[&>*]:min-w-0`
  (force `min-width: 0` sur ses enfants directs) → corrige les 14 modals d'un
  coup. Sourcé : CSS-Tricks « Preventing a Grid Blowout », W3C csswg, MDN.
- Complément gratuit : `title={valeur}` sur un `<span class="truncate">` →
  tooltip natif révélant le texte complet au survol (accessible, standard).

## Application 06.51 (patient)
- 2 colonnes : GAUCHE Identité + Préférences ; DROITE Coordonnées + Note.
- Sexe/Canal = `<select>` natifs au gabarit Input ; ville = `ui/Select` + hidden.
- Note = `ui/Textarea`. Date/CP/sexe/téléphone réduits. Barre `FormActions`
  (Annuler + « Créer le patient » / « Enregistrer »).
- Données, validation zod, Server Actions, chiffrement NIR INCHANGÉS.

## Refs
`components/form/form-layout.tsx` ; `patients/_components/patient-form*.tsx` ;
`ui/input`, `ui/textarea`, `ui/select`. Lot suivant : appliquer le patron à
véhicule + chauffeur.

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
