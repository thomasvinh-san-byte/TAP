# Qualité de complétion des formulaires

> Phase 06.17 — `2026-06-04`. Doctrine d'aide à la saisie selon les
> normes UX/a11y consensuelles (NN/G, Deque, Shopify Polaris, USWDS,
> W3C APG). Application au code TAP : composants `<Field>` et
> `<Combobox>`.

---

## 1. Helper text vs placeholder (D-02)

**Si l'utilisateur a besoin de l'indice pour réussir le champ, l'indice
va dans un helper text persistant**, JAMAIS dans un placeholder.

| Cas                                                  | Helper (`hint`)                                | Placeholder                          |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Format imposé (immatriculation, NIR, téléphone)      | ✓ « Format : AB-123-CD »                       | Exemple court : « AB-123-CD »        |
| Bornes numériques (places assises 1-9)               | ✓ « 1 à 9 »                                    | — (numérique, pas d'exemple utile)   |
| Instruction critique (« 30 caractères max »)         | ✓                                              | — (jamais d'instruction critique)    |
| Texte libre sans contrainte (description optionnelle) | — (hint inutile)                              | Optionnel, exemple ou rien           |
| Reformulation du label                               | ✗                                              | ✗ (jamais — accessibilité)           |

Pourquoi : le placeholder disparaît dès la première frappe — il est
invisible quand l'utilisateur en a le plus besoin (vérification,
correction). Le helper text persiste sous le champ.

## 2. Composant `<Field>` (D-01)

```ts
import { Field } from '@/components/form/field';

<Field
  id="immatriculation"
  label="Immatriculation"
  hint="Format : AB-123-CD"
  placeholder="AB-123-CD"
  required
/>
```

Props : `id` (obligatoire), `label`, `hint?`, `error?`, plus tout
attribut HTML standard d'input. Le hint est lié à l'input via
`aria-describedby` ; l'erreur (si présente) remplace le hint
visuellement mais reste liée.

## 3. Numériques bornés sans spinner (D-03)

`type="number"` produit des spinners up/down et réagit à la molette
souris (bug récurrent NN/G — l'utilisateur change involontairement la
valeur en scrollant). Pour les bornes serrées entières connues :

```tsx
<Field
  id="places_assises"
  label="Places assises"
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  hint="1 à 9"
/>
```

- `type="text"` : pas de spinner desktop, pas de capture molette.
- `inputMode="numeric"` : clavier numérique mobile (iOS, Android).
- `pattern="[0-9]*"` : validation HTML5 + hint visuel.
- Validation `min/max` côté Server Action (zod) **inchangée**.

## 4. Composant `<Combobox>` éditable (D-04)

Pattern W3C ARIA Authoring Practices Guide « Editable combobox with
list autocomplete ». Construit sur les primitives existantes (Input +
Label + positionnement absolu), **0 nouvelle dépendance** (DEC-003).

```tsx
import { Combobox } from '@/components/form/combobox.client';

const [marque, setMarque] = useState('');

<Combobox
  id="marque"
  label="Marque"
  options={['Renault', 'Peugeot', 'Citroën']}
  value={marque}
  onChange={setMarque}
  hint="Liste indicative — saisie libre permise."
/>;
```

Caractéristiques :

- `role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-autocomplete="list"`, `aria-activedescendant`.
- Listbox `role="listbox"` avec `<li role="option" aria-selected>`.
- Clavier : ↑/↓ navigation, Enter commit, Échap ferme, Tab ferme +
  sort.
- Filtrage flou côté client (normalisation NFD pour les accents,
  includes case-insensitive).
- **Saisie libre par défaut** (`allowFreeText: true`) — la valeur
  hors liste est acceptée. Pour forcer une option, passer
  `allowFreeText={false}`.
- Soumission de formulaire : la combobox rend un `<input>` HTML
  standard. Pas besoin de `<input type="hidden">` séparé.

## 5. Comboboxes dépendantes — Marque / Modèle (D-05, D-06)

Catalogue `apps/web/src/lib/vehicles/catalog.ts` :

```ts
export const VEHICLE_CATALOG: Record<string, readonly string[]> = {
  Renault: ['Clio', 'Kangoo', 'Master', /* … */],
  Peugeot: ['208', 'Boxer', 'Expert', 'Partner', /* … */],
  /* … */
};
```

Dans le formulaire :

```tsx
const [marque, setMarque] = useState('');
const [modele, setModele] = useState('');
const modelOptions = useMemo(() => modelsForBrand(marque), [marque]);

<Combobox
  id="marque"
  options={VEHICLE_BRANDS}
  value={marque}
  onChange={setMarque}
  hint="Liste indicative — saisie libre permise."
/>
<Combobox
  id="modele"
  options={modelOptions}
  value={modele}
  onChange={setModele}
  hint={modelOptions.length > 0 ? `Modèles connus pour ${marque}.` : 'Saisie libre.'}
/>
```

- Marque connue → modèles filtrés depuis le catalogue.
- Marque libre/inconnue → modèle reste en saisie libre pure
  (`options=[]`).
- **Pas de reset du modèle** au changement de marque (évite
  d'effacer une saisie en cours).

## 6. Normalisation au submit (D-07)

Les valeurs saisies librement passent par `normalizeBrandOrModel` côté
Server Action :

- `trim` des espaces.
- Title Case sur les mots (« renault » → « Renault »).
- Préservation des acronymes ALL CAPS (BMW, VW).

Les valeurs choisies dans la combobox passent inchangées (déjà
canoniques). Évite les doublons d'orthographe sans bloquer la saisie.

## 7. Migration des `Field` locaux

Avant Phase 06.17, deux composants définissaient leur propre `Field` :

- `apps/web/src/app/(admin)/admin/vehicules/_components/vehicle-form.client.tsx`
- `apps/web/src/app/(admin)/admin/chauffeurs/_components/driver-form.client.tsx`

Tous deux migrés vers `import { Field } from '@/components/form/field'`.
**Tout nouveau formulaire** consomme `<Field>` du module commun.

## 8. Évolutions futures (hors V1)

- Helper text inline d'erreur live (validation client `onBlur`).
- Combobox **groupée** (sections — ex : marques fréquentes vs autres).
- Auto-réparation des saisies (« 95-AB-12 » → « AB-123-CD » via masque
  d'input) — pas V1, pattern à cadrer si besoin terrain.
- Migration des autres formulaires (patient, course) vers `<Field>` à
  mesure des PR ultérieures (déjà compatible : la signature
  `<Field>` est rétro-compatible avec l'ancien `Field` local).

## 9. Sources

- Nielsen Norman Group — Form Design Guidelines (helper text persistant)
- Deque University — Placeholders are problematic (a11y)
- Shopify Polaris — Form patterns (helper + aria-describedby)
- USWDS US.gov — Form input (`inputMode` numeric)
- W3C ARIA Authoring Practices Guide — Editable combobox with list
  autocomplete
