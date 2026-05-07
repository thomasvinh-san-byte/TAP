import { ErasureClient } from './_components/erasure-client.client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Portail patient — exercice du droit d'effacement (art. 17 RGPD).
 *
 * Avertissement explicite « irréversible » affiché AVANT toute action.
 * Confirmation modale (CLAUDE.md § 5 — action destructive). L'action
 * server invoque `anonymizePatient` (RPC UPDATE only, jamais DELETE) :
 * mitigation T-1.5-21.
 *
 * Les courses passées sont conservées 5 ans (CSS L114-19) — l'utilisateur
 * en est explicitement informé avant et après confirmation.
 */
export default function ErasurePage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight mb-12">
          Effacement de vos données
        </h1>
        <p className="text-sm text-muted-foreground">
          Conformément à l&apos;article 17 du Règlement Général sur la
          Protection des Données, vous pouvez demander l&apos;effacement
          de vos données identifiantes. Cette opération est irréversible.
        </p>
      </header>

      <section className="rounded-md border bg-muted/40 p-16 space-y-8">
        <h2 className="text-base font-semibold tracking-tight">
          Conservation légale
        </h2>
        <p className="text-sm text-muted-foreground">
          Les courses passées sont conservées 5 ans pour les obligations
          de la CGSS (Code de la sécurité sociale L114-19). Elles seront
          maintenues sous forme anonymisée — sans lien identitaire — afin
          de répondre à cette obligation comptable. Vos notes médicales
          opérationnelles, en revanche, sont effacées.
        </p>
      </section>

      <ErasureClient token={params.token} />
    </div>
  );
}
