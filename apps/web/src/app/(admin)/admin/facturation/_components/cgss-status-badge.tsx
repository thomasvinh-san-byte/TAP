import { cn } from '@/lib/utils';
import { CGSS_STATUS_LABEL, cgssStatusTone, type CgssStatus } from '../_lib/cgss-invoice-status';

const BASE =
  'inline-flex items-center gap-4 rounded-md border px-8 py-4 text-xs font-medium whitespace-nowrap';

/**
 * Badge de statut de facture CGSS — libellé FR normé + teinte (accent réservé
 * aux rejets / paiement). État perceptible au-delà de la couleur : le texte
 * porte l'information.
 */
export function CgssStatusBadge({ status }: { status: CgssStatus }): JSX.Element {
  return <span className={cn(BASE, cgssStatusTone(status))}>{CGSS_STATUS_LABEL[status]}</span>;
}
