'use server';

/**
 * Server Action export CSV des statistiques courses (Phase 06.37 §5.23,
 * DEC-116).
 *
 * Réutilise les agrégats déjà calculés par `queries-dashboard` pour ne
 * pas dupliquer la logique métier. Renvoie 3 sections dans un seul CSV
 * (volume, incidents, chauffeurs) — pattern lisible Excel/LibreOffice
 * (sections séparées par lignes vides).
 *
 * Période = mois courant (cohérent avec le tableau de bord, DEC-073).
 */

import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { toCsv, formatEurFr } from '@/lib/csv';
import { getDashboardData } from './queries-dashboard';

export interface ExportStatsResult {
  csv?: string;
  filename?: string;
  error?: string;
}

export async function exportStatsCsvAction(): Promise<ExportStatsResult> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const data = await getDashboardData();

  // Format : 1 fichier CSV avec sections (séparées par ligne vide).
  // Lisible en Excel et en LibreOffice. Pas de tableau croisé V1
  // (overengineering pour V1 — un dashboard suffit pour la viz).
  const periode = data.moisCourant;
  const periodePrec = previousMonth(periode);

  const sections: string[] = [];

  sections.push(
    toCsv(
      ['Indicateur', 'Période', 'Valeur'],
      [
        ['Mois courant', periode, ''],
        ['Mois précédent', periodePrec, ''],
        ['', '', ''],
        ['Volume — aujourd’hui', periode, String(data.volume.aujourdhui)],
        ['Volume — semaine', periode, String(data.volume.semaine)],
        ['Volume — mois', periode, String(data.volume.mois)],
        ['Volume — mois précédent', periodePrec, String(data.volMoisPrec)],
        ['', '', ''],
        ['Incidents — taux (%)', periode, String(data.incidents.taux)],
        ['Incidents — patient absent', periode, String(data.incidents.noShow)],
        ['Incidents — annulations', periode, String(data.incidents.annulations)],
        ['Incidents — total', periode, String(data.incidents.total)],
        ['Incidents — taux mois précédent', periodePrec, String(data.incidentsPrec.taux)],
        ['', '', ''],
        ['Chauffeurs actifs avec course', periode, String(data.chauffeurs.actifsAvecCourse)],
        ['Chauffeurs actifs (total)', periode, String(data.chauffeurs.totalActifs)],
        ['Moyenne courses / chauffeur', periode, String(data.chauffeurs.moyenneParChauffeur)],
        ['', '', ''],
        ['CA — mois (€)', periode, formatEurFr(Number(data.caMois.total_eur ?? 0))],
        [
          'CA — mois précédent (€)',
          periodePrec,
          formatEurFr(Number(data.caMoisPrec.total_eur ?? 0)),
        ],
        ['Courses à facturer', periode, String(data.coursesAFacturer)],
        ['Factures incomplètes', periode, String(data.facturesIncompletes)],
      ],
    ),
  );

  const csv = sections.join('\r\n\r\n');
  const filename = `stats_${periode}.csv`;
  return { csv, filename };
}

function previousMonth(ym: string): string {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}
