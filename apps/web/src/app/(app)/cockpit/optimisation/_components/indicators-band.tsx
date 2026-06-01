/**
 * Bande d'indicateurs estimés (D-19, D-20).
 *
 * Exactement 2 indicateurs : taux de mutualisation + km à vide estimés.
 * Libellés incluant explicitement le mot « estimé » (D-20).
 * Aucune couleur sémantique — affichage neutre (D-20).
 */

type Props = {
  tauxMutualisation: number;
  kmAVideEstimes: number;
};

export function IndicatorsBand({ tauxMutualisation, kmAVideEstimes }: Props): JSX.Element {
  return (
    <div className="bg-muted/60 border-border rounded-lg border p-16">
      <div className="grid grid-cols-2 gap-32">
        <div>
          <p className="text-muted-foreground text-xs font-normal">Taux de mutualisation estimé</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">
            {tauxMutualisation}&nbsp;%
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-normal">Km à vide estimés</p>
          <p className="text-foreground text-2xl font-semibold tabular-nums">
            {Math.round(kmAVideEstimes)}&nbsp;km
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-8 text-xs italic">
        Valeurs estimées sur la base de distances à vol d&apos;oiseau (Haversine). Non
        contractuelles.
      </p>
    </div>
  );
}
