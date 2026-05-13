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
      className="flex flex-col items-start gap-16 p-24 bg-muted/40 rounded-md border border-border"
    >
      <AlertCircle
        className="h-8 w-8 text-destructive"
        aria-hidden="true"
      />
      <p className="text-base text-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Aucune action à effectuer ici. Contactez votre régulateur pour obtenir
        un nouveau lien d&apos;invitation.
      </p>
    </div>
  );
}
