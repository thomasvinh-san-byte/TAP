import { AlertTriangle, Download, FileText } from 'lucide-react';
import { aggregateFacture } from '../_lib/aggregate-facture';
import type { CourseFacturable } from '../_lib/queries-facturation';

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Première composante d'une adresse (libellé de lieu, sans CP/ville). */
function lieu(adresse: string): string {
  return adresse.split(',')[0]?.trim() ?? adresse;
}

export function FactureApercu({
  courses,
  countSansTarif,
  mois,
  chauffeurId,
}: {
  courses: CourseFacturable[];
  countSansTarif: number;
  mois: string;
  chauffeurId?: string;
}): JSX.Element {
  const { totalEur, count } = aggregateFacture(courses);
  const empty = count === 0;
  const pdfHref =
    `/api/admin/facturation/pdf?mois=${encodeURIComponent(mois)}` +
    (chauffeurId ? `&chauffeur=${encodeURIComponent(chauffeurId)}` : '');

  return (
    <section className="space-y-12">
      <div className="border-border bg-background space-y-16 rounded-lg border p-16">
        <p className="text-sm font-semibold">
          {count} course{count > 1 ? 's' : ''} facturable
          {count > 1 ? 's' : ''}
          <span className="text-muted-foreground font-normal"> · Total estimé </span>
          <span className="font-mono tabular-nums">{formatEur(totalEur)}</span>
        </p>

        {empty ? (
          <div className="text-muted-foreground flex flex-col items-center gap-8 py-32 text-center text-sm">
            <FileText className="h-32 w-32" strokeWidth={1.5} aria-hidden />
            <p>Aucune course facturable CGSS pour cette période.</p>
            <p className="text-xs">
              Les courses en tiers payant CGSS clôturées sur la période apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="border-border overflow-x-auto rounded-md border">
            <table className="w-full border-collapse">
              <thead className="bg-muted/40">
                <tr className="border-border text-muted-foreground h-10 border-b text-xs uppercase tracking-wide">
                  <th className="px-12 text-left font-medium">Date</th>
                  <th className="px-12 text-left font-medium">Patient</th>
                  <th className="px-12 text-left font-medium">Trajet</th>
                  <th className="px-12 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-border h-10 border-b text-sm">
                    <td className="px-12 tabular-nums">{formatDateFr(c.ended_at)}</td>
                    <td className="px-12">
                      {c.patient_nom} {c.patient_prenom}
                    </td>
                    <td className="text-muted-foreground px-12">
                      {lieu(c.pickup_address)} → {lieu(c.dropoff_address)}
                    </td>
                    <td className="px-12 text-right font-mono tabular-nums">
                      {formatEur(c.tarif_amount_eur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {countSansTarif > 0 && (
          <p className="flex items-center gap-8 text-xs text-amber-700">
            <AlertTriangle className="h-12 w-12 shrink-0" aria-hidden />
            {countSansTarif} course{countSansTarif > 1 ? 's' : ''} CGSS clôturée
            {countSansTarif > 1 ? 's' : ''} sans tarif — non incluse
            {countSansTarif > 1 ? 's' : ''} dans la facture.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        {empty ? (
          <span
            aria-disabled="true"
            className="text-muted-foreground border-border inline-flex h-9 cursor-not-allowed items-center gap-8 rounded-md border px-16 text-sm"
          >
            <Download className="h-16 w-16" aria-hidden />
            Télécharger le PDF (A4)
          </span>
        ) : (
          <a
            href={pdfHref}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 items-center gap-8 rounded-md px-16 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            <Download className="h-16 w-16" aria-hidden />
            Télécharger le PDF (A4)
          </a>
        )}
      </div>
    </section>
  );
}
