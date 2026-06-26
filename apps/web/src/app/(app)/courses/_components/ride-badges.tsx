import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Badges sémantiques rides — statut / urgence / paiement (03-D).
 *
 * Couleurs alignées sur les tokens HSL du design system (CLAUDE.md § 1
 * pilier 2). Toutes les variantes utilisent des opacités x/10 pour le fond,
 * x/30 pour la bordure et la couleur pleine sur le texte → contraste AA
 * vérifié mode jour ET mode nuit.
 */

const BASE_BADGE =
  'inline-flex items-center gap-4 rounded-md border px-8 py-4 text-xs font-medium whitespace-nowrap';

export const STATUS_LABEL: Record<string, string> = {
  validee: 'Validée',
  assignee: 'Affectée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee_regulateur: 'Annulée',
  annulee_patient: 'Annulée (patient)',
  annulee_chauffeur: 'Annulée (chauffeur)',
  annulee_meteo: 'Annulée (météo)',
  brouillon: 'Brouillon',
};

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const label = STATUS_LABEL[status] ?? status;
  let cls = 'border-border bg-muted text-foreground';
  if (status === 'assignee') {
    cls = 'border-info/30 bg-info/10 text-info';
  } else if (status === 'en_cours') {
    cls = 'border-warning/30 bg-warning/10 text-warning';
  } else if (status === 'terminee') {
    cls = 'border-success/30 bg-success/10 text-success';
  } else if (status.startsWith('annulee')) {
    cls = 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return <span className={cn(BASE_BADGE, cls)}>{label}</span>;
}

export const URGENCY_LABEL: Record<string, string> = {
  programmee: 'Programmée',
  urgente: 'Urgente',
  immediate: 'Immédiate',
};

export function UrgencyBadge({ urgency }: { urgency: string }): JSX.Element {
  const label = URGENCY_LABEL[urgency] ?? urgency;
  let cls = 'border-border bg-muted text-foreground';
  if (urgency === 'urgente') {
    cls = 'border-warning/30 bg-warning/10 text-warning';
  } else if (urgency === 'immediate') {
    cls = 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return <span className={cn(BASE_BADGE, cls)}>{label}</span>;
}

export const MODE_LABEL: Record<string, string> = {
  taxi_conventionne: 'Taxi conv.',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

export function ModeBadge({ mode }: { mode: string }): JSX.Element {
  return (
    <span className={cn(BASE_BADGE, 'border-border bg-muted text-foreground')}>
      {MODE_LABEL[mode] ?? mode}
    </span>
  );
}

interface PaymentBadgeProps {
  status: string | null | undefined;
  amountEur?: number | null | undefined;
}

export function PaymentBadge({ status, amountEur }: PaymentBadgeProps): JSX.Element | null {
  if (!status || status === 'non_concerne') {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (status === 'a_encaisser') {
    return (
      <span className={cn(BASE_BADGE, 'border-warning/30 bg-warning/10 text-warning')}>
        À encaisser
      </span>
    );
  }
  if (status === 'encaisse') {
    return (
      <span
        className={cn(BASE_BADGE, 'border-success/30 bg-success/10 text-success', 'tabular-nums')}
      >
        Encaissé
        {typeof amountEur === 'number' && (
          <span className="opacity-70">({amountEur.toFixed(2)} €)</span>
        )}
      </span>
    );
  }
  return <span className={cn(BASE_BADGE, 'border-border bg-muted')}>{status}</span>;
}
