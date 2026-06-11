import { Text, View } from '@react-pdf/renderer';
import { PdfDocument, PdfSection, pdfStyles } from '@/lib/pdf/pdf-template';

/**
 * Récap donneur d'ordres PDF (CdC §5.5 l.195, DEC-159) — récapitulatif des
 * courses d'un donneur d'ordres sur une période, pour sa facturation
 * centralisée. Calqué sur `RecapChauffeurPdf` (DEC-116) : réutilise
 * `PdfDocument`, `PdfSection` et `pdfStyles` (charte commune).
 */

export interface RecapDonneurRow {
  scheduled_at: string;
  patient_label: string;
  trajet: string;
  status_label: string;
  tarif_eur: number | null;
}

export interface RecapDonneurSummary {
  count: number;
  countTerminees: number;
  totalEur: number;
}

interface Props {
  organizationName: string;
  generatedAt: string;
  donneurLabel: string;
  donneurSiret: string | null;
  periodeLabel: string;
  rows: RecapDonneurRow[];
  summary: RecapDonneurSummary;
}

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

export function RecapDonneurPdf({
  organizationName,
  generatedAt,
  donneurLabel,
  donneurSiret,
  periodeLabel,
  rows,
  summary,
}: Props): JSX.Element {
  return (
    <PdfDocument
      title={`Récap donneur d'ordres — ${donneurLabel}`}
      subtitle={`Période : ${periodeLabel}`}
      organizationName={organizationName}
      generatedAt={generatedAt}
    >
      <PdfSection title="Donneur d'ordres" index={1}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <View style={{ width: '50%', marginBottom: 6 }}>
            <Text style={pdfStyles.fieldLabel}>Raison sociale</Text>
            <Text style={pdfStyles.fieldValue}>{donneurLabel}</Text>
          </View>
          <View style={{ width: '50%', marginBottom: 6 }}>
            <Text style={pdfStyles.fieldLabel}>SIRET</Text>
            <Text style={pdfStyles.fieldValue}>{donneurSiret || 'Non renseigné'}</Text>
          </View>
        </View>
      </PdfSection>

      <PdfSection title="Résumé" index={2}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <View style={{ width: '33%', marginBottom: 6 }}>
            <Text style={pdfStyles.fieldLabel}>Nombre de courses</Text>
            <Text style={pdfStyles.fieldValue}>{summary.count}</Text>
          </View>
          <View style={{ width: '33%', marginBottom: 6 }}>
            <Text style={pdfStyles.fieldLabel}>Dont terminées</Text>
            <Text style={pdfStyles.fieldValue}>{summary.countTerminees}</Text>
          </View>
          <View style={{ width: '33%', marginBottom: 6 }}>
            <Text style={pdfStyles.fieldLabel}>Total (€)</Text>
            <Text style={pdfStyles.fieldValue}>{fmtEur(summary.totalEur)}</Text>
          </View>
        </View>
      </PdfSection>

      <PdfSection title="Détail des courses" index={3}>
        {/* En-tête tableau */}
        <View
          style={{
            flexDirection: 'row',
            paddingBottom: 4,
            borderBottom: '1pt solid #E2E2E2',
            marginBottom: 4,
          }}
        >
          <Text style={{ width: '20%', fontSize: 9, color: '#666666' }}>Date</Text>
          <Text style={{ width: '25%', fontSize: 9, color: '#666666' }}>Patient</Text>
          <Text style={{ width: '35%', fontSize: 9, color: '#666666' }}>Trajet</Text>
          <Text style={{ width: '12%', fontSize: 9, color: '#666666' }}>Statut</Text>
          <Text style={{ width: '8%', fontSize: 9, color: '#666666', textAlign: 'right' }}>
            Tarif
          </Text>
        </View>
        {rows.length === 0 ? (
          <Text style={{ fontSize: 10, color: '#999999' }}>Aucune course sur la période.</Text>
        ) : (
          rows.map((r, i) => (
            <View
              key={`${r.scheduled_at}-${i}`}
              style={{
                flexDirection: 'row',
                paddingVertical: 3,
                borderBottom: '1pt solid #F5F5F5',
              }}
              wrap={false}
            >
              <Text style={{ width: '20%', fontSize: 9 }}>{fmtDate(r.scheduled_at)}</Text>
              <Text style={{ width: '25%', fontSize: 9 }}>{r.patient_label}</Text>
              <Text style={{ width: '35%', fontSize: 9 }}>{r.trajet}</Text>
              <Text style={{ width: '12%', fontSize: 9 }}>{r.status_label}</Text>
              <Text style={{ width: '8%', fontSize: 9, textAlign: 'right' }}>
                {r.tarif_eur !== null ? fmtEur(r.tarif_eur) : '—'}
              </Text>
            </View>
          ))
        )}
      </PdfSection>

      <Text style={{ fontSize: 8, color: '#999999', marginTop: 8 }}>
        Document récapitulatif pour la facturation centralisée du donneur d'ordres.
      </Text>
    </PdfDocument>
  );
}
