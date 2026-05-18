'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PatientFormDefaults } from './patient-form-types';
import {
  BirthDateField,
  CityPostalCodeField,
  NirField,
  TelField,
} from './patient-form-fields.client';
import { PatientAddressField } from './patient-address-field.client';

export type { PatientFormDefaults };

export function IdentitySection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Identité
      </h2>
      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-8">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            name="nom"
            required
            defaultValue={dv.nom}
            autoComplete="family-name"
            className="capitalize"
            aria-describedby="nom-help"
          />
          <p id="nom-help" className="text-xs text-muted-foreground">
            Lettres, accents, tirets et apostrophes autorisés.
          </p>
        </div>
        <div className="space-y-8">
          <Label htmlFor="prenom">Prénom</Label>
          <Input
            id="prenom"
            name="prenom"
            required
            defaultValue={dv.prenom}
            autoComplete="given-name"
            className="capitalize"
          />
        </div>
        <BirthDateField name="date_naissance" defaultValue={dv.date_naissance} required />
        <div className="space-y-8">
          <Label htmlFor="genre">Sexe</Label>
          <select
            id="genre"
            name="genre"
            defaultValue={dv.genre ?? ''}
            className="h-48 w-full rounded-md border border-border bg-background px-12 text-sm"
          >
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">Non précisé</option>
          </select>
        </div>
      </div>
      <NirField defaultValue={dv.nir} />
    </section>
  );
}

export function CoordinatesSection({ dv }: { dv: PatientFormDefaults }) {
  const [postcode, setPostcode] = useState(dv.code_postal ?? '');
  const [ville, setVille] = useState(dv.ville ?? '');

  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Coordonnées
      </h2>
      <TelField defaultValue={dv.telephone} />
      <PatientAddressField
        defaultValue={dv.adresse_ligne1}
        onAddressPick={(s) => {
          if (s.postcode) setPostcode(s.postcode);
          if (s.city) setVille(s.city);
        }}
      />
      <div className="space-y-8">
        <Label htmlFor="adresse_ligne2">Complément</Label>
        <Input
          id="adresse_ligne2"
          name="adresse_ligne2"
          defaultValue={dv.adresse_ligne2}
          autoComplete="address-line2"
        />
      </div>
      <CityPostalCodeField
        key={`${postcode}|${ville}`}
        defaultCp={postcode}
        defaultVille={ville}
      />
    </section>
  );
}

export function PreferencesSection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Préférences
      </h2>
      <div className="space-y-8">
        <Label htmlFor="canal_contact_prefere">Canal préféré</Label>
        <select
          id="canal_contact_prefere"
          name="canal_contact_prefere"
          defaultValue={dv.canal_contact_prefere ?? 'appel'}
          className="h-48 w-full rounded-md border border-border bg-background px-12 text-sm"
        >
          <option value="sms">SMS</option>
          <option value="appel">Appel</option>
          <option value="aucun">Aucun</option>
        </select>
      </div>
      <div className="flex items-center gap-12">
        <input
          id="consentement_sms"
          name="consentement_sms"
          type="checkbox"
          defaultChecked={dv.consentement_sms}
          className="h-16 w-16 rounded border-border"
        />
        <Label htmlFor="consentement_sms">Consentement SMS</Label>
      </div>
    </section>
  );
}
