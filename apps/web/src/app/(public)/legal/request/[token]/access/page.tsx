import { fulfillAccessAction } from '../actions';
import { DownloadJsonButton } from './_components/download-json.client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Portail patient — exercice du droit d'accès (art. 15 RGPD) et de
 * portabilité (art. 20 RGPD). Le JSON est généré côté serveur via
 * `fulfillAccessAction` (helper `generatePatientDataExport`) puis
 * sérialisé côté client à la demande pour téléchargement.
 *
 * En cas d'erreur (token invalide, demande introuvable, demande déjà
 * traitée), un message générique en français est rendu — jamais de
 * stack trace ni de détail technique (CLAUDE.md § 1, T-1.5-19).
 */
export default async function AccessPage({
  params,
}: {
  params: { token: string };
}) {
  const result = await fulfillAccessAction(params.token);
  if (result.error) {
    return (
      <div className="space-y-16">
        <h1 className="text-2xl font-semibold tracking-tight mb-12">
          Demande indisponible
        </h1>
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight mb-12">
          Vos données
        </h1>
        <p className="text-sm text-muted-foreground">
          Conformément aux articles 15 et 20 du Règlement Général sur la
          Protection des Données, vous trouverez ci-dessous l&apos;ensemble
          des données vous concernant. Vous pouvez les télécharger au
          format JSON portable.
        </p>
      </header>
      <DownloadJsonButton data={result.data} />
      <p className="text-sm text-muted-foreground">
        En cas de désaccord sur le contenu de cet export, vous pouvez
        saisir la Commission Nationale de l&apos;Informatique et des
        Libertés (cnil.fr).
      </p>
    </div>
  );
}
