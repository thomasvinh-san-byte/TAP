# Segmented control — composants `<SegmentedControl>` / `<SegmentedNav>`

> Phase 06.31 — `2026-06-05`. Toggle multi-segments sobre façon
> Linear / iOS. Remplace le pattern « bouton enfoncé » fait-main
> dupliqué dans patients, chauffeurs et assign-modal.

---

## 1. Pourquoi un composant unique

Avant 06.31, le toggle « Actifs / Archivés » était dupliqué à
l'identique dans 3 écrans (patients-list, drivers-list, assign-modal).
Style daté :

- Conteneur `p-2` trop serré (pastille active collait aux bords).
- Différenciation portée par une OMBRE seule (`bg-background shadow-sm`
  sur `bg-muted/40`) → aspect « bouton enfoncé » daté.
- Pas de poids typo sur l'actif.
- Pas de transition de la pastille.
- Pas de focus ring soigné.

La Phase 06.31 factorise dans `components/ui/segmented-control.tsx`
selon la direction DEC-101 §5 (détail premium) et §5bis (structure
code = structure visuelle).

## 2. API

### `<SegmentedControl>` — state local (button)

```ts
import { SegmentedControl } from '@/components/ui/segmented-control';

interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onValueChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}
```

Usage :

```tsx
<SegmentedControl
  ariaLabel="Filtre archive patients"
  value={scope}
  onValueChange={setScope}
  options={[
    { value: 'active', label: 'Actifs' },
    { value: 'archived', label: 'Archivés' },
  ]}
/>
```

### `<SegmentedNav>` — navigation URL (Link)

Variante pour les filtres portés par l'URL (deep-link, partage, retour
arrière navigateur). Identique visuellement.

```ts
interface SegmentedNavOption<T extends string> extends SegmentOption<T> {
  href: LinkProps['href'];
}

interface SegmentedNavProps<T extends string> {
  options: SegmentedNavOption<T>[];
  value: T;
  ariaLabel: string;
  className?: string;
}
```

Usage :

```tsx
<SegmentedNav<Vue>
  ariaLabel="Filtre chauffeurs"
  value={currentVue}
  options={[
    { value: 'actifs', label: 'Actifs', href: '/admin/chauffeurs?vue=actifs' },
    { value: 'archives', label: 'Archivés', href: '/admin/chauffeurs?vue=archives' },
  ]}
/>
```

## 3. Cible visuelle (sobre)

- **Conteneur** : `bg-muted` + `rounded-lg` + `p-4` + `gap-4` entre segments.
  Pas de bordure (la pastille active suffit à différencier).
- **Segment actif** : `bg-background` + `text-foreground` + `font-medium`
  + ombre token `shadow-sm`. La pastille gagne par contraste de fond
  + poids typo, l'ombre n'est qu'un soutien léger.
- **Segment inactif** : `text-muted-foreground`, hover `text-foreground`
  + `bg-background/50` léger.
- **Transition** : `transition-all duration-150` ease-out (grammaire
  animation §5). `prefers-reduced-motion` couvert par la règle globale
  `globals.css:30-37`.
- **Focus visible** : `ring-2 ring-ring ring-offset-2 ring-offset-muted`
  (RGAA).
- **Cibles tactiles** : `py-6 px-12` minimum.
- **0 hex en dur** : uniquement tokens `bg-muted`, `bg-background`,
  `text-foreground`, `text-muted-foreground`, `shadow-sm`, `ring-ring`.
  Jour + nuit OK par construction.

## 4. Accessibilité

- `role="tablist"` sur le conteneur.
- `role="tab"` + `aria-selected={boolean}` sur chaque segment.
- `aria-label` obligatoire (prop `ariaLabel`).
- Contraste texte actif (`--foreground`) vs inactif (`--muted-foreground`)
  conforme WCAG AA (4.5:1).
- Focus ring visible au clavier (RGAA).

## 5. Quand l'utiliser

- Filtres bi-état ou tri-état d'une liste (Actifs / Archivés ;
  Aujourd'hui / Demain ; Compatibles / Afficher tous).
- Toggle entre 2-4 vues complémentaires sur le même contenu.

**NE PAS l'utiliser pour** :

- Plus de 4 segments → `<Tabs>` Radix (vrai composant tablist scrollable).
- Choix unique dans un formulaire → `<RadioGroup>` shadcn.
- Action plutôt que vue → boutons standards.

## 6. Usages actuels

| Fichier | Variante | Filtre |
|---|---|---|
| `(app)/patients/_components/patients-list.client.tsx` | `<SegmentedControl>` | Actifs / Archivés |
| `(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` | `<SegmentedNav>` | Actifs / Archivés (URL) |
| `(app)/courses/_components/assign-modal.client.tsx` | `<SegmentedControl>` | Compatibles / Afficher tous |
