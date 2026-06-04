import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('<PageHeader>', () => {
  it('rend un h1 unique avec le titre', () => {
    const { getAllByRole } = render(<PageHeader title="Chauffeurs" />);
    const h1s = getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]?.textContent).toBe('Chauffeurs');
  });

  it('rend la description quand fournie', () => {
    const { getByText } = render(
      <PageHeader title="Tarifs" description="Grille tarifaire CGSS 2026." />,
    );
    expect(getByText('Grille tarifaire CGSS 2026.')).toBeInTheDocument();
  });

  it("n'émet pas de <p> quand la description est absente", () => {
    const { container } = render(<PageHeader title="Maintenance" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('expose le slot actions sans le rendre quand absent', () => {
    const { container } = render(<PageHeader title="DPA" description="…" />);
    // pas de second bloc `<div>` (pas d'actions)
    const headerDirectDivs = container.querySelectorAll('header > div');
    expect(headerDirectDivs).toHaveLength(1);
  });

  it('rend les actions à droite quand fournies', () => {
    const { getByText } = render(
      <PageHeader title="Registre" actions={<button type="button">Exporter</button>} />,
    );
    expect(getByText('Exporter')).toBeInTheDocument();
  });

  it('applique flex justify-between au <header> uniquement avec actions', () => {
    const { container, rerender } = render(<PageHeader title="A" />);
    expect(container.querySelector('header')?.className).not.toContain('justify-between');
    rerender(<PageHeader title="A" actions={<span>x</span>} />);
    expect(container.querySelector('header')?.className).toContain('justify-between');
  });
});
