/**
 * InvitationErrorPanel — affichage Server Component lorsque le token
 * d'invitation est expiré, invalide ou déjà consommé (C04 erreur).
 *
 * Pas de CTA self-service : le chauffeur doit demander un nouveau lien
 * à son régulateur (DEC-024, pas de signup self-service B2B).
 */

import { AlertCircle } from 'lucide-react';

export function InvitationErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="bg-muted/40 border-border flex flex-col items-start gap-16 rounded-md border p-24"
    >
      <AlertCircle className="text-destructive h-8 w-8" aria-hidden="true" />
      <p className="text-foreground text-base">{message}</p>
      <p className="text-muted-foreground text-sm">
        Aucune action à effectuer ici. Contactez votre régulateur pour obtenir un nouveau lien
        d&apos;invitation.
      </p>
    </div>
  );
}
