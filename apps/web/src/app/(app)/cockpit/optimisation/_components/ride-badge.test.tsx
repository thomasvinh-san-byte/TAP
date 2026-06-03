import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RideBadge } from './ride-badge';

/**
 * Tests rendu RideBadge (Phase 06.11 Wave 3 — rattrapage Wave 2).
 *
 * Env jsdom (matché par environmentMatchGlobs sur `.test.tsx`). On vérifie :
 *   - le label visible (texte = preuve WCAG « couleur jamais seule »)
 *   - les attributs d'accessibilité (`title` tooltip, `tabIndex`)
 */
describe('<RideBadge type="urgency">', () => {
  it.each([
    ['programmee', 'Programmée'],
    ['urgente', 'Urgente'],
    ['immediate', 'Immédiate'],
  ] as const)('rend le label pour la valeur %s', (value, expected) => {
    const { getByText } = render(<RideBadge type="urgency" value={value} />);
    expect(getByText(expected)).toBeInTheDocument();
  });
});

describe('<RideBadge type="transport">', () => {
  it.each([
    ['taxi_conventionne', 'Taxi'],
    ['tpmr', 'TPMR'],
    ['vsl', 'VSL'],
    ['ambulance', 'Ambulance'],
  ] as const)('rend le label pour la valeur %s', (value, expected) => {
    const { getByText } = render(<RideBadge type="transport" value={value} />);
    expect(getByText(expected)).toBeInTheDocument();
  });
});

describe('<RideBadge type="tpmr">', () => {
  it('rend le shortcut TPMR', () => {
    const { getByText } = render(<RideBadge type="tpmr" />);
    expect(getByText('TPMR')).toBeInTheDocument();
  });
});

describe('<RideBadge> a11y', () => {
  it('expose un title (tooltip) pour les lecteurs et le focus', () => {
    const { container } = render(<RideBadge type="urgency" value="urgente" />);
    const badge = container.querySelector('[tabindex="0"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('title')).toBeTruthy();
  });
});
