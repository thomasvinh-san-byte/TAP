/**
 * Composant <LastUpdated> embarqué dans les pages MDX légales.
 * Rendu via le mapping `components` de next-mdx-remote.
 */
export function LastUpdated({ date }: { date: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      Dernière mise à jour :{' '}
      {new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </span>
  );
}
