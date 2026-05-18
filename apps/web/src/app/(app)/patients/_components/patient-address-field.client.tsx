'use client';

import { useState } from 'react';
import {
  AddressPickerField,
  type BanSuggestion,
} from '../../courses/_components/address-picker-field.client';

interface Props {
  defaultValue?: string;
  /**
   * Callback appelé quand l'utilisateur sélectionne une suggestion BAN.
   * Permet au parent (CoordinatesSection) de pré-remplir code postal +
   * ville automatiquement.
   */
  onAddressPick?: (suggestion: BanSuggestion) => void;
}

/**
 * Wrapper du AddressPickerField BAN pour le formulaire patient.
 * Maintient un input caché `name="adresse_ligne1"` pour FormData.
 *
 * Propage la sélection BAN au parent via onAddressPick (postcode +
 * city + lat + lng) pour pré-remplir les champs liés (réduction
 * erreurs saisie terrain).
 */
export function PatientAddressField({
  defaultValue = '',
  onAddressPick,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <AddressPickerField
        id="adresse_ligne1"
        label="Adresse"
        ariaLabel="Rechercher une adresse"
        value={value}
        onChange={setValue}
        onSelect={onAddressPick}
      />
      <input type="hidden" name="adresse_ligne1" value={value} />
    </>
  );
}
