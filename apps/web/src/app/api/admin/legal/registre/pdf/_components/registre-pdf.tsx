import { legalBasisLabels } from '@tap/shared';
import { PdfDocument, PdfSection, PdfField } from '@/lib/pdf/pdf-template';

/**
 * Composant PDF du registre des traitements (D-17, DPA-01).
 *
 * Première instance du template PDF partagé (`@/lib/pdf/pdf-template`).
 * Rendu serveur via @react-pdf/renderer (runtime nodejs).
 */

export type Entry = {
  purpose: string;
  legal_basis: string;
  data_categories: string[];
  data_subjects: string[];
  recipients: string[];
  retention_period_days: number;
  security_measures: string;
  international_transfer: boolean;
  created_at: string;
};

function legalBasisLabel(value: string): string {
  return legalBasisLabels[value as keyof typeof legalBasisLabels] ?? value;
}

export function RegistrePdf({
  entries,
  organizationName,
  generatedAt,
}: {
  entries: Entry[];
  organizationName: string;
  generatedAt: string;
}): JSX.Element {
  return (
    <PdfDocument
      title="Registre des activités de traitement"
      subtitle="Article 30 du RGPD"
      organizationName={organizationName}
      generatedAt={generatedAt}
    >
      {entries.map((e, idx) => (
        <PdfSection key={idx} index={idx + 1} title={e.purpose}>
          <PdfField label="Base légale" value={legalBasisLabel(e.legal_basis)} />
          <PdfField label="Catégories de données" value={e.data_categories.join(', ')} />
          <PdfField label="Personnes concernées" value={e.data_subjects.join(', ')} />
          <PdfField label="Destinataires" value={e.recipients.join(', ')} />
          <PdfField label="Durée de conservation" value={`${e.retention_period_days} jours`} />
          <PdfField label="Mesures de sécurité" value={e.security_measures} />
          <PdfField
            label="Transfert international"
            value={e.international_transfer ? 'Oui' : 'Non'}
          />
        </PdfSection>
      ))}
    </PdfDocument>
  );
}
