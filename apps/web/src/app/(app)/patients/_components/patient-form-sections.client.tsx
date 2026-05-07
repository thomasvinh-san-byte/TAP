'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PatientFormDefaults } from './patient-form-types';

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
          <Input id="nom" name="nom" required defaultValue={dv.nom} />
        </div>
        <div className="space-y-8">
          <Label htmlFor="prenom">Prénom</Label>
          <Input id="prenom" name="prenom" required defaultValue={dv.prenom} />
        </div>
        <div className="space-y-8">
          <Label htmlFor="date_naissance">Date de naissance</Label>
          <Input
            id="date_naissance"
            name="date_naissance"
            type="date"
            required
            defaultValue={dv.date_naissance}
          />
        </div>
        <div className="space-y-8">
          <Label htmlFor="genre">Genre</Label>
          <select
            id="genre"
            name="genre"
            defaultValue={dv.genre ?? ''}
            className="h-48 w-full rounded-md border border-border bg-background px-12 text-sm"
          >
            <option value="">—</option>
            <option value="M">M</option>
            <option value="F">F</option>
            <option value="X">X</option>
          </select>
        </div>
      </div>
      <div className="space-y-8">
        <Label htmlFor="nir">NIR</Label>
        <Input
          id="nir"
          name="nir"
          placeholder="13 chiffres + clé"
          defaultValue={dv.nir}
          aria-describedby="nir-help"
        />
        <p id="nir-help" className="text-xs text-muted-foreground">
          Stocké chiffré, jamais en clair en base.
        </p>
      </div>
    </section>
  );
}

export function CoordinatesSection({ dv }: { dv: PatientFormDefaults }) {
  return (
    <section className="space-y-12">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Coordonnées
      </h2>
      <div className="space-y-8">
        <Label htmlFor="telephone">Téléphone</Label>
        <Input
          id="telephone"
          name="telephone"
          type="tel"
          defaultValue={dv.telephone}
        />
      </div>
      <div className="space-y-8">
        <Label htmlFor="adresse_ligne1">Adresse</Label>
        <Input
          id="adresse_ligne1"
          name="adresse_ligne1"
          required
          defaultValue={dv.adresse_ligne1}
        />
      </div>
      <div className="space-y-8">
        <Label htmlFor="adresse_ligne2">Complément</Label>
        <Input
          id="adresse_ligne2"
          name="adresse_ligne2"
          defaultValue={dv.adresse_ligne2}
        />
      </div>
      <div className="grid grid-cols-2 gap-12">
        <div className="space-y-8">
          <Label htmlFor="code_postal">Code postal</Label>
          <Input
            id="code_postal"
            name="code_postal"
            required
            defaultValue={dv.code_postal}
          />
        </div>
        <div className="space-y-8">
          <Label htmlFor="ville">Ville</Label>
          <Input id="ville" name="ville" required defaultValue={dv.ville} />
        </div>
      </div>
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
