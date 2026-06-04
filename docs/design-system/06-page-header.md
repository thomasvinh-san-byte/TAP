# En-tête de page — composant `<PageHeader>`

> Phase 06.16 — `2026-06-04`. Composant en-tête de page commun aux 16
> pages admin (esprit Linear/Stripe : sobre, dense). Présentation pure,
> 0 logique métier.

---

## 1. Pourquoi un composant unique

Avant 06.16, chaque `page.tsx` admin réimplémentait son `<header>`
manuellement (`<h1>` 2xl semibold tracking-tight + `<p>` muted text-sm).
Une seule page (`legal/registre`) avait des actions en header.
La Phase 06.16 (Strict dirigeant) extrait UNIQUEMENT cet en-tête dans
`apps/web/src/components/page-header/`. Toolbar recherche/filtres
différée (recoupe l'API tri/pagination du `<DataTable>` laissée en V2).

## 2. API

```ts
import { PageHeader } from '@/components/page-header';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode; // slot CTA/boutons à droite
  className?: string;
}
```

## 3. Exemple minimal

```tsx
<PageHeader
  title="Chauffeurs"
  description="Référentiel des chauffeurs de l'organisation."
/>
```

## 4. Exemple avec actions (modèle `legal/registre`)

```tsx
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { ExportPdfButton } from './_components/export-pdf-button.client';

<PageHeader
  title="Registre des traitements"
  description="Recensez quelles données patients vous utilisez et pourquoi…"
  actions={
    <>
      <ExportPdfButton />
      <Button asChild>
        <Link href="#nouveau">
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvelle entrée
        </Link>
      </Button>
    </>
  }
/>
```

## 5. Comportement de mise en page

- Sans `actions` : le `<header>` rend simplement le bloc titre/description.
- Avec `actions` : `<header className="flex items-center justify-between gap-16">`,
  bloc gauche titre/description, bloc droit `<div className="flex gap-12">`
  pour les actions.

## 6. Accessibilité (RGAA)

- Le composant rend un `<h1>` unique — **un seul** par page (responsabilité
  de l'appelant : ne pas appeler `<PageHeader>` deux fois).
- `<p>` description sémantique standard (lue par les lecteurs d'écran
  comme contexte du titre).
- Aucune couleur seule (NFR-003) — la description utilise
  `text-muted-foreground`, contraste WCAG AA assuré par les tokens 06.14.

## 7. Tokens consommés

- `text-2xl font-semibold tracking-tight` (titre).
- `text-muted-foreground mt-4 text-sm` (description).
- `gap-12` / `gap-16` (échelle 06.14).
- **Aucun hex en dur.**

## 8. Liste des 16 pages migrées

| Page                                                                                          | Actions header               |
| --------------------------------------------------------------------------------------------- | ---------------------------- |
| `(admin)/admin/chauffeurs/page.tsx`                                                           | —                            |
| `(admin)/admin/facturation/page.tsx`                                                          | —                            |
| `(admin)/admin/legal/page.tsx`                                                                | —                            |
| `(admin)/admin/legal/breaches/page.tsx`                                                       | —                            |
| `(admin)/admin/legal/dpa/page.tsx`                                                            | —                            |
| `(admin)/admin/legal/dpa/pre-remplir/page.tsx`                                                | —                            |
| `(admin)/admin/legal/dpia/page.tsx`                                                           | —                            |
| `(admin)/admin/legal/dpia/pre-remplir/page.tsx`                                               | —                            |
| `(admin)/admin/legal/dpo/page.tsx`                                                            | —                            |
| `(admin)/admin/legal/registre/page.tsx`                                                       | `ExportPdfButton` + Nouvelle |
| `(admin)/admin/legal/registre/pre-remplir/page.tsx`                                           | —                            |
| `(admin)/admin/legal/requests/page.tsx`                                                       | —                            |
| `(admin)/admin/maintenance/page.tsx`                                                          | —                            |
| `(admin)/admin/sms-templates/page.tsx`                                                        | —                            |
| `(admin)/admin/tarifs/page.tsx`                                                               | —                            |
| `(admin)/admin/vehicules/page.tsx`                                                            | —                            |

## 9. Hors périmètre

- **Chrome globale** (`(admin)/layout.tsx`, `AdminTopBar`, `NavTabs`,
  `LegalNavMenu`) : inchangée. Le composant `<PageHeader>` ne touche
  QUE le `<header>` interne de chaque `page.tsx`.
- **Pages hors `(admin)`** : `(app)` régulateur et `(driver)` PWA gardent
  leurs en-têtes spécifiques (densités et besoins différents).
- **Toolbar recherche/filtres** : différée (Strict). Sera cadrée
  séparément si besoin terrain confirmé — recoupe le tri généralisé du
  `<DataTable>` (V2).
- **Refonte typographique / espacements** : le composant reproduit le
  pattern existant à l'identique. Pas de chantier d'évolution typographique
  V1.
