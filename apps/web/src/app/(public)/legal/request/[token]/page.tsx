import { verifyRequestToken } from '@tap/shared';
import { checkRateLimit } from './_lib/rate-limit';
import { IdentityForm } from './_components/identity-form.client';
import { verifyIdentityAction } from './actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Portail patient — page d'entrée (D-10, DPA-04).
 *
 * Étapes :
 *  1. checkRateLimit : 5 tentatives/h par token (D-20).
 *  2. verifyRequestToken : JWT HS256 strict, expiry 30 jours.
 *  3. Affichage du formulaire de vérification d'identité.
 *
 * En cas d'échec (rate-limit, token invalide ou expiré), un message
 * générique en français est affiché — jamais de stack trace ni de
 * détail technique (mitigation T-1.5-19, CLAUDE.md § 1).
 */
export default async function RequestTokenPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  try {
    await checkRateLimit(params.token);
    const claims = await verifyRequestToken(params.token);
    return (
      <div className="space-y-32">
        <header>
          <h1 className="mb-12 text-2xl font-semibold tracking-tight">
            Vérification d&apos;identité
          </h1>
          <p className="text-muted-foreground text-base">
            Pour exercer votre droit ({claims.type}) au titre du Règlement Général sur la Protection
            des Données, nous devons vérifier votre identité. Renseignez votre numéro de sécurité
            sociale (NIR), votre nom et votre date de naissance.
          </p>
        </header>
        <IdentityForm
          token={params.token}
          requestType={claims.type}
          action={verifyIdentityAction}
        />
      </div>
    );
  } catch (e) {
    // SÉCU-01 : portail public — détail au journal serveur, message générique
    // affiché (jamais le texte d'exception, ex. détail de la lib JWT).
    console.error(
      '[legal request] vérification du lien échec:',
      e instanceof Error ? e.message : e,
    );
    return (
      <div className="space-y-16">
        <h1 className="mb-12 text-2xl font-semibold tracking-tight">Lien invalide ou expiré</h1>
        <p className="text-muted-foreground text-base">Ce lien est invalide ou a expiré.</p>
        <p className="text-base">
          Pour formuler une nouvelle demande, contactez le service client de votre transporteur.
        </p>
      </div>
    );
  }
}
