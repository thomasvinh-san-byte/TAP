import type { ReactNode } from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Template PDF partagé — socle commun des exports de l'application.
 *
 * Un seul endroit définit l'allure des PDF : marges, police, en-tête et pied
 * paginés, sections titrées, paires label/valeur, styles sur les tokens de la
 * charte. Chaque export instancie `PdfDocument` avec son seul contenu.
 *
 * Rendu serveur via `@react-pdf/renderer` (runtime nodejs).
 */

// Tokens repris de la charte (équiv. des variables CSS `--primary`, gris).
const COLOR_PRIMARY = '#1466DB';
const COLOR_LABEL = '#666666';
const COLOR_META = '#999999';
const COLOR_BORDER = '#E2E2E2';
const COLOR_TEXT = '#1A1A1A';

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 56,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLOR_TEXT,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 32,
    right: 32,
    paddingTop: 32,
    paddingBottom: 12,
    borderBottom: `1pt solid ${COLOR_BORDER}`,
  },
  headerTitle: { fontSize: 18, fontWeight: 700, color: COLOR_PRIMARY },
  headerSubtitle: { fontSize: 9, color: COLOR_LABEL, marginTop: 3 },
  headerMeta: { fontSize: 8, color: COLOR_META, marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 32,
    right: 32,
    paddingTop: 8,
    paddingBottom: 24,
    borderTop: `1pt solid ${COLOR_BORDER}`,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: COLOR_META },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1pt solid ${COLOR_BORDER}`,
  },
  sectionHeader: { flexDirection: 'row', marginBottom: 8 },
  sectionIndex: { fontSize: 11, fontWeight: 700, color: COLOR_PRIMARY, marginRight: 6 },
  sectionTitle: { fontSize: 11, fontWeight: 700, flex: 1 },
  field: { marginBottom: 6 },
  fieldLabel: { fontSize: 9, color: COLOR_LABEL },
  fieldValue: { fontSize: 10 },
});

interface PdfHeaderProps {
  title: string;
  subtitle?: string;
  organizationName: string;
  generatedAt: string;
}

/** Bandeau d'en-tête, répété en haut de chaque page (`fixed`). */
export function PdfHeader({
  title,
  subtitle,
  organizationName,
  generatedAt,
}: PdfHeaderProps): JSX.Element {
  return (
    <View fixed style={pdfStyles.header}>
      <Text style={pdfStyles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={pdfStyles.headerSubtitle}>{subtitle}</Text> : null}
      <Text style={pdfStyles.headerMeta}>
        {organizationName} · Généré le {generatedAt}
      </Text>
    </View>
  );
}

/** Pied de page paginé, répété en bas de chaque page (`fixed`). */
export function PdfFooter(): JSX.Element {
  return (
    <View fixed style={pdfStyles.footer}>
      <Text style={pdfStyles.footerText}>TAP Régulation · Document généré automatiquement</Text>
      <Text
        style={pdfStyles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

interface PdfDocumentProps {
  title: string;
  organizationName: string;
  generatedAt: string;
  subtitle?: string;
  children: ReactNode;
}

/** Document A4 complet : en-tête et pied paginés + contenu spécifique de l'export. */
export function PdfDocument({
  title,
  organizationName,
  generatedAt,
  subtitle,
  children,
}: PdfDocumentProps): JSX.Element {
  return (
    <Document title={title}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader
          title={title}
          subtitle={subtitle}
          organizationName={organizationName}
          generatedAt={generatedAt}
        />
        {children}
        <PdfFooter />
      </Page>
    </Document>
  );
}

interface PdfSectionProps {
  title: string;
  index?: number;
  children: ReactNode;
}

/** Bloc de contenu titré (et numéroté). `wrap={false}` : jamais coupé entre 2 pages. */
export function PdfSection({ title, index, children }: PdfSectionProps): JSX.Element {
  return (
    <View style={pdfStyles.section} wrap={false}>
      <View style={pdfStyles.sectionHeader}>
        {index !== undefined ? <Text style={pdfStyles.sectionIndex}>{index}.</Text> : null}
        <Text style={pdfStyles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** Paire label / valeur : label en petit gris, valeur en dessous. */
export function PdfField({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={pdfStyles.field}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      <Text style={pdfStyles.fieldValue}>{value}</Text>
    </View>
  );
}
