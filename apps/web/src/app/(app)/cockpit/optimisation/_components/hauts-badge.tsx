import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Badge « À vérifier » pour les groupements traversant des zones de Hauts (D-10).
 *
 * Couleur ambre doublée du texte — WCAG 2.1 AA.
 * tabIndex={0} pour accessibilité clavier sur l'infobulle.
 */
export function HautsBadge(): JSX.Element {
  return (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-amber-700"
      title="Ce groupement inclut un trajet en zone de relief. La distance estimée peut sous-estimer le temps réel."
      tabIndex={0}
    >
      <AlertTriangle className="mr-4 h-12 w-12" aria-hidden />À vérifier
    </Badge>
  );
}
