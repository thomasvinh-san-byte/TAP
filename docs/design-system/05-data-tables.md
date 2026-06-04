# Data tables — composant `<DataTable>`

> Phase 06.15 — `2026-06-04`. Composant data table sémantique commun.
> Uniformise les 13 surfaces de listes du SaaS. API extensible (tri,
> pagination prévus) ; V1 implémente uniquement le tri existant.

---

## 1. Pourquoi un composant unique

Avant 06.15, chaque table réimplémentait sa structure (8 `<table>` ad-hoc,
4 `<ul>/<li>` avec `divide-y`, 1 mixte). Aucun composant partagé. Résultat :
incohérence densité, padding, hover, a11y. La Phase 06.15 (Option 3
dirigeant) extrait UNIQUEMENT la présentation tabulaire dans
`apps/web/src/components/data-table/`. La logique métier (actions,
dialogues, Server Actions) reste dans chaque composant appelant.

## 2. API

```ts
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/data-table';

interface DataTableColumn<T> {
  key: string; // identifiant unique (aria-sort, sort.column)
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string; // '140px', '15%'
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableSort {
  column: string;
  dir: 'asc' | 'desc';
  hrefFor?: (column: string, nextDir: 'asc' | 'desc') => string; // tri par URL
  onSortChange?: (column: string, dir: 'asc' | 'desc') => void; // tri 100 % client
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string; // DEC-033 : inclure le champ mutable si requis
  ariaLabel: string;
  sort?: DataTableSort;
  loading?: boolean;
  loadingRows?: number; // défaut 5
  emptyState?: React.ReactNode; // ex : <EmptyState … />
  footer?: React.ReactNode; // ex : ligne « Total » caisse-table
  className?: string;
  rowClassName?: (row: T, index: number) => string; // animation par ligne
  onRowClick?: (row: T, index: number) => void; // clic ligne (drawer)
}
```

## 3. Exemple minimal

```tsx
'use client';

import { DataTable, type DataTableColumn } from '@/components/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Inbox } from 'lucide-react';

interface Demande {
  id: string;
  type: string;
  recue_le: string;
}

const COLUMNS: DataTableColumn<Demande>[] = [
  { key: 'type', header: 'Type', cell: (d) => d.type },
  {
    key: 'recue_le',
    header: 'Reçue le',
    cell: (d) => <span className="tabular-nums">{d.recue_le}</span>,
  },
];

export function MaListe({ demandes }: { demandes: Demande[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={demandes}
      rowKey={(d) => d.id}
      ariaLabel="Liste des demandes RGPD"
      emptyState={<EmptyState icon={Inbox} title="Aucune demande" />}
    />
  );
}
```

## 4. Tri par URL (modèle caisse-table)

Le seul tri V1 — généralisé depuis `caisse-table` — s'effectue via
`<Link>` Next.js avec deep-link (server-driven, partageable). La table
appelante définit `hrefFor` :

```tsx
const sortConfig: DataTableSort = {
  column: sort,
  dir,
  hrefFor: (column, nextDir) =>
    `/courses/caisse?${new URLSearchParams({ date, sort: column, dir: nextDir }).toString()}`,
};

<DataTable
  columns={COLUMNS}
  rows={rows}
  rowKey={(r) => r.id}
  ariaLabel="Encaissements du jour"
  sort={sortConfig}
/>;
```

Les colonnes triables ont `sortable: true`. Le header rend un `<Link>`
avec icône `ArrowUp` / `ArrowDown` / `ArrowUpDown` (lucide) et
`aria-sort` calculé (`ascending` / `descending` / `none`).

## 5. Clic de ligne (modèle rides-list / drivers-list / vehicles-list)

Pour les listes où la ligne entière ouvre un drawer :

```tsx
<DataTable
  columns={COLUMNS}
  rows={rides}
  rowKey={(r) => `${r.id}-${r.status}`}
  ariaLabel="Liste des courses"
  onRowClick={(r) => setOpenRideId(r.id)}
/>
```

Les boutons d'action dans les cellules DOIVENT appeler
`e.stopPropagation()` pour éviter de déclencher le drawer. Drivers-list
enveloppe les actions dans un `<div onClick={(e) => e.stopPropagation()}>`.

## 6. Animation par ligne (modèle cockpit)

Le cockpit applique une animation fade-in sur les nouvelles courses
(Realtime). `rowClassName` reçoit la ligne et l'index :

```tsx
<DataTable
  columns={COLUMNS}
  rows={rides}
  rowKey={(r) => `${r.id}:${r.status}`}
  ariaLabel="Cockpit"
  rowClassName={(r) => (newRideIds.has(r.id) ? 'cockpit-row-fade-in' : '')}
/>
```

## 7. État vide, état loading, footer

- `emptyState` : nœud rendu quand `rows.length === 0` (sauf si `loading`).
- `loading: true` : rend N skeletons miroirs (5 par défaut, `loadingRows: N`).
- `footer` : rendu dans `<tfoot>` (ex : ligne « Total » caisse).

## 8. Accessibilité (D-05)

- `<th scope="col">` automatique sur chaque colonne.
- `aria-sort` calculé pour les colonnes `sortable: true` (`ascending` /
  `descending` / `none`).
- Focus visible via `--ring` (tokens 06.14).
- `prefers-reduced-motion` respecté globalement (`globals.css`).
- Couleur jamais seule (NFR-003) — les status doivent porter un texte/
  icône à côté du fond coloré (les `<Badge>` consommés ici le font déjà).
- Cible tactile ≥ 44 px côté régulateur (les boutons d'action passent
  par `<Button>` de shadcn, déjà conforme).

## 9. Convention de clé React (DEC-033)

`rowKey` DOIT inclure les champs mutables qui déclenchent un re-mount
nécessaire pour éviter les actions figées :

- `caisse` : `r.id` (immutable).
- `cockpit` : `${ride.id}:${ride.status}` (re-mount au changement de statut).
- `rides-list` : `${r.id}-${r.status}` (idem).
- `vehicles` : `${v.id}-${v.actif}`.
- `drivers` : `${d.id}-${d.actif}-${d.archive}`.
- `breaches` : `${e.id}:${e.closed_at ?? 'open'}`.
- `dpia` : `${e.id}:${e.status}`.
- `requests` : `${e.id}:${e.status}`.
- `tariff-history` : `${g.id}:${g.isActive ? 'active' : 'archived'}`.

## 10. Liste des 13 consommateurs

| Fichier                                                                                  | Spécificités                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `(admin)/admin/facturation/_components/facture-apercu.tsx`                               | RSC → client D-07, aperçu CGSS                      |
| `(admin)/admin/legal/breaches/_components/breach-list.client.tsx`                        | Compte à rebours CNIL dans cellule                  |
| `(admin)/admin/legal/dpa/_components/dpa-list.client.tsx`                                | Drawer pré-remplir                                  |
| `(admin)/admin/legal/dpia/_components/dpia-list.client.tsx`                              | Action Modifier dans cellule                        |
| `(admin)/admin/legal/registre/_components/registre-list.client.tsx`                      | Pré-remplir + drawer secondaire                     |
| `(admin)/admin/legal/requests/_components/requests-list.client.tsx`                      | Drawer création                                     |
| `(admin)/admin/tarifs/_components/tariff-history-table.client.tsx`                       | Statut « Active » / « Archivée »                    |
| `(app)/cockpit/_components/courses-table.client.tsx`                                     | Animation fade-in via `rowClassName`                |
| `(admin)/admin/chauffeurs/_components/drivers-list.client.tsx`                           | Multi-actions (invite/resend/deactivate/archive)    |
| `(admin)/admin/vehicules/_components/vehicles-list.client.tsx`                           | Clic ligne → Sheet édition                          |
| `(app)/courses/_components/rides-list.client.tsx`                                        | Clic ligne → Drawer, action « Assigner » dans cell |
| `(app)/patients/_components/patients-list.client.tsx`                                    | Clic patient → Drawer, action Archive/Réactiver     |
| `(app)/courses/caisse/_components/caisse-table.client.tsx`                               | Tri par URL + ligne Total via `footer`              |

## 11. Évolutions futures (hors V1)

- **Pagination** : prop `pagination` déclarée mais non implémentée V1.
  À cadrer en phase ultérieure si volume justifie.
- **Tri généralisé** : étendre `sortable: true` aux autres tables avec
  modèle URL deep-link.
- **Sélection multiple + actions groupées** : pattern Carbon — non V1.
- **Resize colonne / réorganisation** : non V1.
- **Virtualisation** : V1 ne virtualise pas. À envisager si une table
  dépasse 100 lignes côté patients/courses.
