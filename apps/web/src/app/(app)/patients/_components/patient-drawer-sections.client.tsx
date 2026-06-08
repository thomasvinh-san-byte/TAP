'use client';

import { Phone, MapPin, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { maskNir } from '@/lib/utils';
import { PatientNirDisplay } from './patient-nir-display.client';

export interface DrawerPatientShape {
  id: string;
  prenom: string;
  nom: string;
  date_naissance: string | null;
  genre: string | null;
  telephone: string | null;
  adresse_ligne1: string;
  adresse_ligne2: string | null;
  code_postal: string;
  ville: string;
  contact_urgence_nom: string | null;
  contact_urgence_telephone: string | null;
  nir_last4: string | null;
  has_nir: boolean | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
  consentement_sms: boolean;
  consentement_sms_at: string | null;
  patient_constraint?: { id: string; type: string; note: string | null }[];
  patient_operational_note?: { id: string; content: string }[];
}

export function IdentitySection({ d }: { d: DrawerPatientShape }) {
  return (
    <section className="mt-24 space-y-12">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Identité administrative
      </h3>
      {d.has_nir && <PatientNirDisplay patientId={d.id} maskedNir={maskNir(d.nir_last4)} />}
      <p className="text-sm">
        Né(e) le {d.date_naissance}
        {d.genre ? `, ${d.genre}` : ''}
      </p>
    </section>
  );
}

export function CoordinatesSection({ d }: { d: DrawerPatientShape }) {
  return (
    <section className="mt-24 space-y-12">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Coordonnées
      </h3>
      {d.telephone && (
        <p className="flex items-center gap-8 text-sm tabular-nums">
          <Phone className="h-16 w-16" aria-hidden />
          <a href={`tel:${d.telephone}`}>{d.telephone}</a>
        </p>
      )}
      <p className="flex items-start gap-8 text-sm">
        <MapPin className="mt-4 h-16 w-16" aria-hidden />
        <span>
          {d.adresse_ligne1}
          {d.adresse_ligne2 ? `, ${d.adresse_ligne2}` : ''}
          <br />
          {d.code_postal} {d.ville}
        </span>
      </p>
      {d.contact_urgence_nom && (
        <p className="text-sm">
          Urgence : {d.contact_urgence_nom}, {d.contact_urgence_telephone}
        </p>
      )}
    </section>
  );
}

export function PreferencesSection({ d }: { d: DrawerPatientShape }) {
  return (
    <section className="mt-24 space-y-8">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Préférences
      </h3>
      <p className="flex items-center gap-8 text-sm">
        <MessageCircle className="h-16 w-16" aria-hidden />
        Canal préféré : <Badge variant="secondary">{d.canal_contact_prefere}</Badge>
      </p>
      <p className="text-sm">
        Consentement SMS :{' '}
        {d.consentement_sms
          ? `oui (${new Date(d.consentement_sms_at!).toLocaleDateString('fr-FR')})`
          : 'non'}
      </p>
    </section>
  );
}

export function ConstraintsSection({ d }: { d: DrawerPatientShape }) {
  const items = d.patient_constraint ?? [];
  return (
    <section className="mt-24 space-y-8">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Contraintes
      </h3>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-8">
          {items.map((c) => (
            <li key={c.id}>
              <Badge variant="outline">
                {c.type}
                {c.note ? ` : ${c.note}` : ''}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Aucune contrainte.</p>
      )}
    </section>
  );
}

export function NoteSection({ d }: { d: DrawerPatientShape }) {
  const note = d.patient_operational_note?.[0];
  return (
    <section className="mt-24 space-y-8">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Note opérationnelle
      </h3>
      {note ? (
        <p className="whitespace-pre-line text-sm">{note.content}</p>
      ) : (
        <p className="text-muted-foreground text-sm">Aucune note.</p>
      )}
    </section>
  );
}
