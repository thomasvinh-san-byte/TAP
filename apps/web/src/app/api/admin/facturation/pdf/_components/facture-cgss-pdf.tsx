import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { FactureAggregate } from '@/app/(admin)/admin/facturation/_lib/aggregate-facture';

/**
 * Document PDF de la facturation CGSS mensuelle (Phase 06 PLAN-2, Bloc A).
 * Rendu serveur via `@react-pdf/renderer` (runtime nodejs) — calqué sur
 * `registre-pdf.tsx` (Phase 1.5). Le document AGRÈGE les montants stockés.
 */

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10 },
  h1: { fontSize: 18, marginBottom: 12, fontWeight: 700 },
  value: { fontSize: 10, marginBottom: 4 },
  tableHead: {
    flexDirection: 'row',
    marginTop: 16,
    paddingBottom: 4,
    borderBottom: '1pt solid #333',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '1pt solid #eee',
  },
  subtotal: {
    flexDirection: 'row',
    paddingVertical: 4,
    marginBottom: 8,
    borderBottom: '1pt solid #ccc',
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1pt solid #333',
  },
  cDate: { width: '15%' },
  cPatient: { width: '28%' },
  cTrajet: { width: '42%' },
  cMontant: { width: '15%', textAlign: 'right' },
  label: { fontSize: 9, color: '#666', fontWeight: 700 },
  bold: { fontWeight: 700 },
  disclaimer: { fontSize: 8, color: '#666', marginTop: 20 },
  meta: { fontSize: 8, color: '#999', marginTop: 8 },
  empty: { fontSize: 10, color: '#666', marginTop: 16 },
});

function fmtEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function lieu(adresse: string): string {
  return adresse.split(',')[0]?.trim() ?? adresse;
}

export function FactureCgssPdf({
  organizationName,
  periodeLabel,
  chauffeurLabel,
  generatedAt,
  aggregate,
}: {
  organizationName: string;
  periodeLabel: string;
  chauffeurLabel: string | null;
  generatedAt: string;
  aggregate: FactureAggregate;
}): JSX.Element {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Facturation CGSS — Récapitulatif mensuel</Text>
        <Text style={styles.value}>Société : {organizationName}</Text>
        <Text style={styles.value}>Période : {periodeLabel}</Text>
        <Text style={styles.value}>Chauffeur : {chauffeurLabel ?? 'tous'}</Text>
        <Text style={styles.value}>Généré le : {generatedAt}</Text>

        {aggregate.count === 0 ? (
          <Text style={styles.empty}>Aucune course facturable CGSS sur la période.</Text>
        ) : (
          <>
            <View style={styles.tableHead}>
              <Text style={[styles.cDate, styles.label]}>Date</Text>
              <Text style={[styles.cPatient, styles.label]}>Patient</Text>
              <Text style={[styles.cTrajet, styles.label]}>Trajet</Text>
              <Text style={[styles.cMontant, styles.label]}>Montant</Text>
            </View>

            {aggregate.groups.map((g) => (
              <View key={g.driverId} wrap={false}>
                {g.courses.map((c) => (
                  <View key={c.id} style={styles.row}>
                    <Text style={styles.cDate}>{fmtDate(c.ended_at)}</Text>
                    <Text style={styles.cPatient}>
                      {c.patient_nom} {c.patient_prenom}
                    </Text>
                    <Text style={styles.cTrajet}>
                      {lieu(c.pickup_address)} → {lieu(c.dropoff_address)}
                    </Text>
                    <Text style={styles.cMontant}>{fmtEur(c.tarif_amount_eur)}</Text>
                  </View>
                ))}
                <View style={styles.subtotal}>
                  <Text style={[styles.cTrajet, styles.bold]}>Sous-total — {g.driverNom}</Text>
                  <Text style={styles.cPatient}>
                    {g.count} course{g.count > 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.cMontant, styles.bold]}>{fmtEur(g.subtotalEur)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={[styles.cTrajet, styles.bold]}>
                Total — {aggregate.count} course
                {aggregate.count > 1 ? 's' : ''}
              </Text>
              <Text style={styles.cPatient} />
              <Text style={[styles.cMontant, styles.bold]}>{fmtEur(aggregate.totalEur)}</Text>
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>
          Tarif estimatif, non contractuel jusqu&apos;à la facturation CGSS télétransmise.
          Récapitulatif interne — ne vaut pas bordereau de télétransmission B2/SEFi.
        </Text>
        <Text style={styles.meta}>Document généré automatiquement — TAP Régulation</Text>
      </Page>
    </Document>
  );
}
