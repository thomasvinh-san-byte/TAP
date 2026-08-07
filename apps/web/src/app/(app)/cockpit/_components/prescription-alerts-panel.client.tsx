'use client';

import Link from 'next/link';
import { FileText, ArrowUpRight } from 'lucide-react';
import type { PrescriptionAlertEnriched } from '../_lib/get-prescription-alerts';

const KIND_LABELS: Record<PrescriptionAlertEnriched['kind'], string> = {
  expiree: 'Bon expiré',
  epuisee: 'Bon épuisé',
  renouvellement: 'À renouveler',
  seuil_80: 'Bientôt épuisé',
};

function tone(kind: PrescriptionAlertEnriched['kind']): string {
  if (kind === 'expiree' || kind === 'epuisee') return 'border-destructive/30 bg-destructive/5';
  return 'border-amber-200 bg-amber-50';
}

/**
 * Panneau d'alertes prescriptions (CdG §5.3, DEC-163) — affiché dans l'aside du
 * cockpit, à côté des alertes conformité. Lecture seule, dérivé serveur.
 */
export function PrescriptionAlertsPanel({
  alerts,
}: {
  alerts: PrescriptionAlertEnriched[];
}): JSX.Element | null {
  if (alerts.length === 0) return null;

  return (
    <section className="space-y-8">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Bons de transport
      </h2>
      <ul className="space-y-8">
        {alerts.slice(0, 6).map((a) => (
          <li key={a.prescription_id}>
            {/* Renvoi (navigation) vers la fiche patient, section prescriptions,
                où le bon se renouvelle. Toute l'alerte est un lien réel, focusable
                et clavier-activable ; le renouvellement N'EST PAS dupliqué ici — on
                ne fait qu'y mener. Repère « naviguer » = flèche sortante, cohérent
                avec les autres renvois du cockpit. */}
            <Link
              href={`/patients/${a.patient_id}#prescriptions`}
              aria-label={`Voir la fiche de ${a.patient_label}, section prescriptions, pour renouveler le bon ${a.numero}`}
              className={`focus-visible:ring-ring group flex items-start gap-12 rounded-md border p-12 transition-[filter,color] hover:brightness-[.98] focus:outline-none focus-visible:ring-2 ${tone(a.kind)}`}
            >
              <FileText className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">{KIND_LABELS[a.kind]}</p>
                <p className="text-muted-foreground mt-2 truncate text-xs">
                  {a.patient_label} · bon {a.numero} · {a.trajets_restants} trajet
                  {a.trajets_restants > 1 ? 's' : ''} restant{a.trajets_restants > 1 ? 's' : ''}
                </p>
                <span className="text-muted-foreground group-hover:text-foreground mt-4 inline-flex items-center gap-4 text-xs font-medium">
                  Voir le patient
                  <ArrowUpRight className="h-12 w-12" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
