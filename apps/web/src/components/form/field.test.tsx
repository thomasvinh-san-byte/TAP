import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Field, RequiredFieldsLegend } from './field';

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

  // --- Obligatoire ---
  it("n'ajoute ni astérisque ni aria-required par défaut (non-régression)", () => {
    const { getByLabelText, container } = render(<Field id="x" label="X" />);
    expect(getByLabelText('X').getAttribute('aria-required')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('marque un champ obligatoire : astérisque masquée + aria-required sur le contrôle', () => {
    // Nom accessible = « Nom » (l'astérisque aria-hidden est exclue du calcul du
    // nom → le lecteur d'écran ne lit pas « étoile »).
    const { getByRole, container } = render(<Field id="nom" label="Nom" required />);
    const input = getByRole('textbox', { name: 'Nom' });
    // aria-required sur le contrôle (annonce « obligatoire »).
    expect(input.getAttribute('aria-required')).toBe('true');
    // astérisque visible mais masquée aux lecteurs d'écran.
    const star = container.querySelector('span[aria-hidden="true"]');
    expect(star).not.toBeNull();
    expect(star?.textContent).toContain('*');
  });

  // --- Contrôle enfant ---
  it('mode contrôle enfant : encadre le contrôle fourni et lui passe les liaisons a11y', () => {
    const { getByTestId, getByText, container } = render(
      <Field id="date" label="Date" hint="JJ/MM/AAAA" required>
        {(control) => <input data-testid="ctrl" {...control} />}
      </Field>,
    );
    const ctrl = getByTestId('ctrl');
    // pas de saisie simple interne en plus : le seul contrôle est l'enfant.
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(ctrl.id).toBe('date');
    expect(ctrl.getAttribute('aria-required')).toBe('true');
    const hint = getByText('JJ/MM/AAAA');
    expect(ctrl.getAttribute('aria-describedby')).toContain(hint.id);
    // étiquette liée au contrôle enfant.
    expect(container.querySelector('label')?.getAttribute('for')).toBe('date');
  });

  it("mode contrôle enfant : relaie l'état invalide et l'erreur au contrôle", () => {
    const { getByTestId, getByText } = render(
      <Field id="adr" label="Adresse" error="Adresse requise">
        {(control) => <input data-testid="ctrl" {...control} />}
      </Field>,
    );
    const ctrl = getByTestId('ctrl');
    expect(ctrl.getAttribute('aria-invalid')).toBe('true');
    expect(ctrl.getAttribute('aria-describedby')).toContain(getByText('Adresse requise').id);
  });
});

describe('<RequiredFieldsLegend>', () => {
  it('affiche la légende avec une astérisque décorative masquée aux lecteurs d’écran', () => {
    const { getByText, container } = render(<RequiredFieldsLegend />);
    expect(getByText(/champs marqués/i)).toBeInTheDocument();
    const star = container.querySelector('span[aria-hidden="true"]');
    expect(star?.textContent).toContain('*');
  });
});
