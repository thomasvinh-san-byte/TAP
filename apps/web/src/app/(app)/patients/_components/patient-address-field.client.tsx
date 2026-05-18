'use client';

import { useState } from 'react';
import { AddressPickerField } from '../../courses/_components/address-picker-field.client';

interface Props {
  defaultValue?: string;
}

/**
 * Wrapper du AddressPickerField BAN pour le formulaire patient.
 * Maintient un input caché `name="adresse_ligne1"` pour que la valeur
 * soit postée à la Server Action via FormData.
 *
 * Le composant courses est un controlled component (value/onChange) ;
 * le formulaire patient utilise des FormData natifs (form action).
 * Ce wrapper réconcilie les deux modèles sans modifier le composant
 * partagé.
 */
export function PatientAddressField({ defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <AddressPickerField
        id="adresse_ligne1"
        label="Adresse"
        ariaLabel="Rechercher une adresse"
        value={value}
        onChange={setValue}
      />
      <input type="hidden" name="adresse_ligne1" value={value} />
    </>
  );
}
