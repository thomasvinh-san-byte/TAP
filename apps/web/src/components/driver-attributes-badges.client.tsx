'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DRIVER_COMPETENCE_LABELS, DRIVER_LANGUE_LABELS } from '@tap/shared';

/**
 * Badges des attributs d'affectation du chauffeur (CHAUFFEUR-02, §5.6) :
 * langues parlées + compétences. Lecture seule, partagé entre la liste
 * chauffeurs (admin) et le modal d'assignation (courses). Libellés FR ; valeur
 * inconnue affichée telle quelle (tolérance aux valeurs futures hors enum).
 */
function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

export function DriverAttributesBadges({
  competences,
  langues,
  className,
}: {
  competences?: string[];
  langues?: string[];
  className?: string;
}): JSX.Element | null {
  const hasAny = (competences?.length ?? 0) + (langues?.length ?? 0) > 0;
  if (!hasAny) return null;
  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {(langues ?? []).map((l) => (
        <Badge key={`langue-${l}`} variant="secondary" className="text-xs">
          {labelFor(DRIVER_LANGUE_LABELS, l)}
        </Badge>
      ))}
      {(competences ?? []).map((c) => (
        <Badge key={`competence-${c}`} variant="outline" className="text-xs">
          {labelFor(DRIVER_COMPETENCE_LABELS, c)}
        </Badge>
      ))}
    </div>
  );
}
