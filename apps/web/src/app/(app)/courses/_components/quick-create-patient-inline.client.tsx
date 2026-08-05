'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { VILLES_974, isMinor } from '@tap/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Field, RequiredFieldsLegend, RequiredMark } from '@/components/form/field';
import { quickCreatePatientAction } from '../../patients/actions';
import type { PatientHome } from './ride-patient-picker.client';

/**
 * Création RAPIDE d'un patient AU FIL du formulaire de course (EXPRESS volet 2).
 *
 * Déroulé sous le champ patient (PAS un dialogue empilé sur la fenêtre de
 * course) — d'où l'absence de `<form>` imbriqué (le modal en est déjà un) : les
 * champs sont contrôlés et la soumission construit une `FormData` passée à la
 * MÊME action serveur validée que la création normale (`quickCreatePatientAction`
 * → `patientSchema`). À la réussite, le patient est sélectionné automatiquement
 * (`onCreated`), ce qui déclenche le pré-remplissage d'adresse du volet 1.
 *
 * Champs réutilisant le socle `<Field>` (marquage d'obligatoire accessible).
 * Cas MINEUR : dès que la date de naissance indique un mineur, le référent légal
 * devient requis ici même ; le serveur refuse de toute façon un mineur sans
 * référent (garde-fou non contournable). NIR / préférences = différables.
 */

const VILLE_ITEMS = VILLES_974.map((v) => ({ value: v, label: v }));
const REFERENT_TYPE_ITEMS = [
  { value: 'parental', label: 'Autorité parentale' },
  { value: 'tutelle', label: 'Tutelle' },
];

const EMPTY = {
  nom: '',
  prenom: '',
  date_naissance: '',
  telephone: '',
  adresse_ligne1: '',
  code_postal: '',
  ville: '',
  referent_nom: '',
  referent_type: '',
};

export function QuickCreatePatientInline({
  onCreated,
}: {
  onCreated: (id: string, label: string, home: PatientHome) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ ...EMPTY });

  const set =
    (key: keyof typeof EMPTY) =>
    (value: string): void =>
      setF((prev) => ({ ...prev, [key]: value }));

  const minor = f.date_naissance ? isMinor(f.date_naissance) : false;

  function close(): void {
    setOpen(false);
    setError(null);
    setF({ ...EMPTY });
  }

  async function submit(): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(f)) {
        if (v) fd.append(k, v);
      }
      const res = await quickCreatePatientAction(fd);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      onCreated(res.id, res.label, res.home);
      close();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-8"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <UserPlus className="h-16 w-16" aria-hidden />
        Créer rapide
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Création rapide d'un patient"
      className="border-border bg-muted/30 space-y-12 rounded-md border p-12"
      onKeyDown={(e) => {
        // Fermeture clavier du seul déroulé (sans fermer la fenêtre de course).
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <p className="text-sm font-medium">Nouveau patient</p>
      <RequiredFieldsLegend />

      <div className="grid grid-cols-2 gap-12">
        <Field
          id="qc-nom"
          name="nom"
          label="Nom"
          required
          value={f.nom}
          onChange={(e) => set('nom')(e.target.value)}
          autoFocus
        />
        <Field
          id="qc-prenom"
          name="prenom"
          label="Prénom"
          required
          value={f.prenom}
          onChange={(e) => set('prenom')(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-12">
        <Field
          id="qc-date"
          name="date_naissance"
          label="Date de naissance"
          required
          type="date"
          value={f.date_naissance}
          onChange={(e) => set('date_naissance')(e.target.value)}
        />
        <Field
          id="qc-tel"
          name="telephone"
          label="Téléphone"
          type="tel"
          value={f.telephone}
          onChange={(e) => set('telephone')(e.target.value)}
        />
      </div>

      <Field
        id="qc-adresse"
        name="adresse_ligne1"
        label="Adresse"
        required
        value={f.adresse_ligne1}
        onChange={(e) => set('adresse_ligne1')(e.target.value)}
        hint="Numéro et voie"
      />

      <div className="grid grid-cols-2 gap-12">
        <Field
          id="qc-cp"
          name="code_postal"
          label="Code postal"
          required
          inputMode="numeric"
          placeholder="97400"
          hint="974 + 2 chiffres"
          value={f.code_postal}
          onChange={(e) => set('code_postal')(e.target.value)}
        />
        <div className="space-y-8">
          <Label htmlFor="qc-ville">
            Ville
            <RequiredMark />
          </Label>
          <Select
            ariaLabel="Ville"
            value={f.ville}
            onChange={set('ville')}
            items={VILLE_ITEMS}
            placeholder="Sélectionnez une commune"
            triggerClassName="w-full"
          />
        </div>
      </div>

      {minor && (
        <div className="border-warning/40 space-y-12 rounded-md border border-dashed p-12">
          <p className="text-warning text-xs" role="alert">
            Patient mineur : un référent légal est requis (garde-fou — non différable).
          </p>
          <div className="grid grid-cols-2 gap-12">
            <Field
              id="qc-ref-nom"
              name="referent_nom"
              label="Nom du référent"
              required
              value={f.referent_nom}
              onChange={(e) => set('referent_nom')(e.target.value)}
            />
            <div className="space-y-8">
              <Label htmlFor="qc-ref-type">
                Type d&apos;autorité
                <RequiredMark />
              </Label>
              <Select
                ariaLabel="Type d'autorité"
                value={f.referent_type}
                onChange={set('referent_type')}
                items={REFERENT_TYPE_ITEMS}
                placeholder="—"
                triggerClassName="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        NIR et préférences pourront être complétés plus tard dans la fiche patient.
      </p>

      <div className="flex justify-end gap-12">
        <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>
          Annuler
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={pending}>
          {pending ? 'Création…' : 'Créer et sélectionner'}
        </Button>
      </div>
    </div>
  );
}
