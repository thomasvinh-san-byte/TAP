import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './data-table';

/**
 * Tests <DataTable> (Phase 06.15 T1) — rendu colonnes, état empty, état
 * loading, a11y `<th scope>` + `aria-sort`. Tests purement structurels.
 */

interface Row {
  id: string;
  nom: string;
  age: number;
}

const ROWS: Row[] = [
  { id: '1', nom: 'Alpha', age: 32 },
  { id: '2', nom: 'Beta', age: 45 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'nom', header: 'Nom', cell: (r) => r.nom, sortable: true },
  { key: 'age', header: 'Âge', cell: (r) => r.age, align: 'right' },
];

describe('<DataTable>', () => {
  it('rend les en-têtes avec scope="col"', () => {
    const { getAllByRole } = render(
      <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} ariaLabel="Test table" />,
    );
    const headers = getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    headers.forEach((h) => expect(h.getAttribute('scope')).toBe('col'));
  });

  it('rend les cellules de chaque ligne', () => {
    const { getByText } = render(
      <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} ariaLabel="Test table" />,
    );
    expect(getByText('Alpha')).toBeInTheDocument();
    expect(getByText('Beta')).toBeInTheDocument();
    expect(getByText('32')).toBeInTheDocument();
  });

  it('expose aria-sort="none" sur colonne triable sans tri actif', () => {
    const { getAllByRole } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
        sort={{ column: 'autre', dir: 'asc', hrefFor: () => '#' }}
      />,
    );
    const headers = getAllByRole('columnheader');
    expect(headers[0]?.getAttribute('aria-sort')).toBe('none');
    expect(headers[1]?.getAttribute('aria-sort')).toBeNull();
  });

  it('expose aria-sort="ascending" sur la colonne triée croissant', () => {
    const { getAllByRole } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
        sort={{ column: 'nom', dir: 'asc', hrefFor: () => '#' }}
      />,
    );
    expect(getAllByRole('columnheader')[0]?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('rend le emptyState fourni quand rows est vide', () => {
    const { getByText } = render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
        emptyState={<div>Rien à voir</div>}
      />,
    );
    expect(getByText('Rien à voir')).toBeInTheDocument();
  });

  it('rend un fallback row quand rows est vide sans emptyState', () => {
    const { getByText } = render(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} ariaLabel="Test table" />,
    );
    expect(getByText('Aucun résultat à afficher.')).toBeInTheDocument();
  });

  it('rend des skeletons quand loading=true', () => {
    const { container } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
        loading
        loadingRows={3}
      />,
    );
    // 3 lignes de skeletons * 2 colonnes = 6 `Skeleton` (div.animate-pulse)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(6);
  });

  it('callback onSortChange appelable via header bouton', () => {
    const onSortChange = vi.fn();
    const { getByRole } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        ariaLabel="Test table"
        sort={{ column: 'nom', dir: 'asc', onSortChange }}
      />,
    );
    const button = getByRole('button', { name: /Nom/i });
    button.click();
    expect(onSortChange).toHaveBeenCalledWith('nom', 'desc');
  });
});
