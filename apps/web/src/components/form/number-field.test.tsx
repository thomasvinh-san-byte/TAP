import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NumberField } from './number-field';

describe('<NumberField>', () => {
  it('applique type=text + inputMode=numeric (entier par défaut)', () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" min={1} max={9} />);
    const input = getByLabelText('N');
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
  });

  it('applique inputMode=decimal quand step est fourni (< 1)', () => {
    const { getByLabelText } = render(<NumberField id="prix" label="Prix" step={0.01} />);
    expect(getByLabelText('Prix').getAttribute('inputmode')).toBe('decimal');
  });

  it('kind=counter sans defaultValue → utilise min comme défaut', () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" min={1} />);
    expect((getByLabelText('N') as HTMLInputElement).defaultValue).toBe('1');
  });

  it('kind=counter sans min → défaut 0', () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" />);
    expect((getByLabelText('N') as HTMLInputElement).defaultValue).toBe('0');
  });

  it('kind=optional sans defaultValue → reste vide', () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" min={1} kind="optional" />);
    expect((getByLabelText('N') as HTMLInputElement).defaultValue).toBe('');
  });

  it('defaultValue explicite a priorité sur le défaut auto', () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" min={1} defaultValue={5} />);
    expect((getByLabelText('N') as HTMLInputElement).defaultValue).toBe('5');
  });

  it("defaultValue null équivaut à 'pas de valeur' (auto-défaut s'applique)", () => {
    const { getByLabelText } = render(<NumberField id="n" label="N" min={1} defaultValue={null} />);
    expect((getByLabelText('N') as HTMLInputElement).defaultValue).toBe('1');
  });

  it('propage hint comme aria-describedby', () => {
    const { getByLabelText, getByText } = render(
      <NumberField id="n" label="N" min={1} max={9} hint="1 à 9" />,
    );
    const hint = getByText('1 à 9');
    expect(getByLabelText('N').getAttribute('aria-describedby')).toContain(hint.id);
  });
});
