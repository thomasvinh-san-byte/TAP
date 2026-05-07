'use client';

import { Button } from '@/components/ui/button';

interface Props {
  data: unknown;
}

/**
 * Bouton de téléchargement du JSON portable (art. 15 + art. 20 RGPD).
 * Le payload est embarqué dans le bundle (rendu RSC) puis sérialisé
 * au moment du clic. Pas de round-trip réseau supplémentaire.
 */
export function DownloadJsonButton({ data }: Props) {
  const handleClick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donnees-patient-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <Button type="button" onClick={handleClick} className="h-48">
      Télécharger JSON
    </Button>
  );
}
