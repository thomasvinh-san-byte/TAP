/* eslint-disable @typescript-eslint/no-unused-vars */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Composant PDF du registre des traitements (D-17, DPA-01).
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

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 16, fontWeight: 700 },
  h2: { fontSize: 12, marginBottom: 8, fontWeight: 700 },
  label: { fontSize: 9, color: '#666' },
  value: { fontSize: 10, marginBottom: 6 },
  entry: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1pt solid #ccc',
  },
  meta: { fontSize: 8, color: '#999', marginTop: 24 },
});

export function RegistrePdf({
  entries,
  organizationName,
  generatedAt,
}: {
  entries: Entry[];
  organizationName: string;
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Registre des activités de traitement</Text>
        <Text style={styles.value}>Société : {organizationName}</Text>
        <Text style={styles.value}>Généré le : {generatedAt}</Text>
        <Text style={styles.value}>Article 30 RGPD</Text>
        {entries.map((e, idx) => (
          <View key={idx} style={styles.entry}>
            <Text style={styles.h2}>{e.purpose}</Text>
            <Text style={styles.label}>Base légale</Text>
            <Text style={styles.value}>{e.legal_basis}</Text>
            <Text style={styles.label}>Catégories de données</Text>
            <Text style={styles.value}>{e.data_categories.join(', ')}</Text>
            <Text style={styles.label}>Personnes concernées</Text>
            <Text style={styles.value}>{e.data_subjects.join(', ')}</Text>
            <Text style={styles.label}>Destinataires</Text>
            <Text style={styles.value}>{e.recipients.join(', ')}</Text>
            <Text style={styles.label}>Durée de conservation</Text>
            <Text style={styles.value}>{e.retention_period_days} jours</Text>
            <Text style={styles.label}>Mesures de sécurité</Text>
            <Text style={styles.value}>{e.security_measures}</Text>
            <Text style={styles.label}>Transfert international</Text>
            <Text style={styles.value}>{e.international_transfer ? 'Oui' : 'Non'}</Text>
          </View>
        ))}
        <Text style={styles.meta}>Document généré automatiquement — TAP Régulation</Text>
      </Page>
    </Document>
  );
}
