import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Field } from './field';

describe('<Field>', () => {
  it("lie le label à l'input via htmlFor/id", () => {
    const { getByLabelText } = render(<Field id="immat" label="Immatriculation" />);
    expect(getByLabelText('Immatriculation')).toBeInTheDocument();
  });

  it('rend le hint persistant et le lie via aria-describedby', () => {
    const { getByLabelText, getByText } = render(
      <Field id="immat" label="Immatriculation" hint="Format : AB-123-CD" />,
    );
    const input = getByLabelText('Immatriculation');
    const hint = getByText('Format : AB-123-CD');
    expect(hint).toBeInTheDocument();
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it("priorise l'erreur sur le hint quand les deux sont fournis", () => {
    const { queryByText, getByText, getByLabelText } = render(
      <Field
        id="immat"
        label="Immatriculation"
        hint="Format : AB-123-CD"
        error="Immatriculation invalide"
      />,
    );
    expect(queryByText('Format : AB-123-CD')).toBeNull();
    const errorEl = getByText('Immatriculation invalide');
    expect(errorEl).toBeInTheDocument();
    expect(getByLabelText('Immatriculation').getAttribute('aria-invalid')).toBe('true');
    expect(getByLabelText('Immatriculation').getAttribute('aria-describedby')).toContain(
      errorEl.id,
    );
  });

  it("passe les attributs HTML (inputMode, pattern) à l'input", () => {
    const { getByLabelText } = render(
      <Field id="places" label="Places" inputMode="numeric" pattern="[0-9]*" />,
    );
    const input = getByLabelText('Places');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
  });

  it("n'émet pas d'aria-describedby quand ni hint ni erreur", () => {
    const { getByLabelText } = render(<Field id="x" label="X" />);
    expect(getByLabelText('X').getAttribute('aria-describedby')).toBeNull();
  });
});
