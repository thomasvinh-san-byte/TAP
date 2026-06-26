'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FormSection, FormRow } from '@/components/form/form-layout';
import type { PatientFormDefaults } from './patient-form-types';
import {
  BirthDateField,
  CityPostalCodeField,
  NirField,
  TelField,
} from './patient-form-fields.client';
import { PatientAddressField } from './patient-address-field.client';

export type { PatientFormDefaults };

/**
 * Sections du formulaire patient — refondues sur le patron de form partagé
 * (Phase 06.51, DEC-130) : `FormSection`/`FormRow`, champs homogènes (gabarit
 * Input h-10), lecture ligne par ligne. Selects natifs (soumission via `name`)
 * stylés au gabarit Input. Données/validation inchangées.
 */

// Select natif aligné sur le gabarit `<Input>` (h-10) — il soumet via `name`,
// contrairement au `ui/Select` contrôlé (Radix) qui n'a pas de `name`.
const NATIVE_SELECT_CLASS =
  'border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export function IdentitySection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <FormSection title="Identité">
      <FormRow>
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
          <p id="nom-help" className="text-muted-foreground text-sm">
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
      </FormRow>
      <FormRow>
        <BirthDateField name="date_naissance" defaultValue={dv.date_naissance} required />
        <div className="space-y-8">
          <Label htmlFor="genre">Sexe</Label>
          <select
            id="genre"
            name="genre"
            defaultValue={dv.genre ?? ''}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">Non précisé</option>
          </select>
        </div>
      </FormRow>
      <NirField defaultValue={dv.nir} />
    </FormSection>
  );
}

export function CoordinatesSection({ dv }: { dv: PatientFormDefaults }) {
  const [postcode, setPostcode] = useState(dv.code_postal ?? '');
  const [ville, setVille] = useState(dv.ville ?? '');

  return (
    <FormSection title="Coordonnées">
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
      <CityPostalCodeField key={`${postcode}|${ville}`} defaultCp={postcode} defaultVille={ville} />
    </FormSection>
  );
}

export function ReferentLegalSection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <FormSection title="Référent légal (mineur / sous tutelle)">
      <FormRow>
        <div className="space-y-8">
          <Label htmlFor="referent_nom">Nom du référent</Label>
          <Input id="referent_nom" name="referent_nom" defaultValue={dv.referent_nom} />
        </div>
        <div className="space-y-8">
          <Label htmlFor="referent_lien">Lien (parent, tuteur…)</Label>
          <Input id="referent_lien" name="referent_lien" defaultValue={dv.referent_lien} />
        </div>
      </FormRow>
      <FormRow>
        <div className="space-y-8">
          <Label htmlFor="referent_telephone">Téléphone du référent</Label>
          <Input
            id="referent_telephone"
            name="referent_telephone"
            defaultValue={dv.referent_telephone}
            autoComplete="tel"
          />
        </div>
        <div className="space-y-8">
          <Label htmlFor="referent_type">Type d&apos;autorité</Label>
          <select
            id="referent_type"
            name="referent_type"
            defaultValue={dv.referent_type ?? ''}
            className={NATIVE_SELECT_CLASS}
          >
            <option value="">—</option>
            <option value="parental">Autorité parentale</option>
            <option value="tutelle">Tutelle</option>
          </select>
        </div>
      </FormRow>
      <p className="text-muted-foreground text-sm">
        Obligatoire pour un patient mineur ou sous tutelle. Le scan de l&apos;autorisation /
        jugement sera ajouté ultérieurement.
      </p>
    </FormSection>
  );
}

export function PreferencesSection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <FormSection title="Préférences">
      <div className="max-w-[240px] space-y-8">
        <Label htmlFor="canal_contact_prefere">Canal préféré</Label>
        <select
          id="canal_contact_prefere"
          name="canal_contact_prefere"
          defaultValue={dv.canal_contact_prefere ?? 'appel'}
          className={NATIVE_SELECT_CLASS}
        >
          <option value="sms">SMS</option>
          <option value="appel">Appel</option>
          <option value="aucun">Aucun</option>
        </select>
      </div>
      <div className="flex items-center gap-12">
        <Checkbox
          id="consentement_sms"
          name="consentement_sms"
          defaultChecked={dv.consentement_sms}
        />
        <Label htmlFor="consentement_sms">Consentement SMS</Label>
      </div>
    </FormSection>
  );
}
