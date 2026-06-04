import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Combobox } from './combobox.client';

const FRUITS = ['Pomme', 'Poire', 'Pêche', 'Banane'] as const;

describe('<Combobox>', () => {
  it('expose role=combobox + aria-autocomplete=list', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={onChange} />,
    );
    const combobox = getByRole('combobox');
    expect(combobox.getAttribute('aria-autocomplete')).toBe('list');
    expect(combobox.getAttribute('aria-expanded')).toBe('false');
  });

  it('ouvre la liste au focus et expose aria-expanded=true', () => {
    const { getByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={vi.fn()} />,
    );
    const combobox = getByRole('combobox');
    fireEvent.focus(combobox);
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
    expect(getByRole('listbox')).toBeInTheDocument();
  });

  it('filtre les options selon la saisie (case + accent insensitive)', () => {
    const { getByRole, queryAllByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="pe" onChange={vi.fn()} />,
    );
    fireEvent.focus(getByRole('combobox'));
    const options = queryAllByRole('option');
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain('Pêche');
    expect(labels).not.toContain('Banane');
  });

  it("navigation flèches + Enter commit l'option active", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={onChange} />,
    );
    const combobox = getByRole('combobox');
    fireEvent.focus(combobox);
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Pomme');
  });

  it('Escape ferme la liste sans changer la valeur', () => {
    const onChange = vi.fn();
    const { getByRole, queryByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={onChange} />,
    );
    const combobox = getByRole('combobox');
    fireEvent.focus(combobox);
    expect(queryByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(combobox, { key: 'Escape' });
    expect(queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clic sur option commit la valeur (mousedown)', () => {
    const onChange = vi.fn();
    const { getByRole, getByText } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={onChange} />,
    );
    fireEvent.focus(getByRole('combobox'));
    fireEvent.mouseDown(getByText('Banane'));
    expect(onChange).toHaveBeenCalledWith('Banane');
  });

  it('saisie libre acceptée (allowFreeText=true par défaut)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Combobox id="fruit" label="Fruit" options={FRUITS} value="" onChange={onChange} />,
    );
    fireEvent.change(getByRole('combobox'), { target: { value: 'Kiwi' } });
    expect(onChange).toHaveBeenCalledWith('Kiwi');
  });

  it('hint persistant lié par aria-describedby', () => {
    const { getByRole, getByText } = render(
      <Combobox
        id="fruit"
        label="Fruit"
        options={FRUITS}
        value=""
        onChange={vi.fn()}
        hint="Liste indicative — saisie libre permise."
      />,
    );
    const combobox = getByRole('combobox');
    const hint = getByText('Liste indicative — saisie libre permise.');
    expect(combobox.getAttribute('aria-describedby')).toContain(hint.id);
  });
});
