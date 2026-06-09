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
