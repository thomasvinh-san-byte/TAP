'use client';

import { Plus, UserCircle2, UserPlus } from 'lucide-react';
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state';

type Vue = 'actifs' | 'archives';

/**
 * État vide de la liste chauffeurs, contextualisé par la vue (actifs /
 * archivés). Extrait de drivers-list (Phase 06.58, DEC-137) — renommé
 * pour éviter la collision avec le `EmptyState` partagé.
 */
export function DriversEmptyState({
  vue,
  onCreate,
}: {
  vue: Vue;
  onCreate: () => void;
}): JSX.Element {
  if (vue === 'archives') {
    return (
      <SharedEmptyState
        icon={UserCircle2}
        title="Aucun chauffeur archivé"
        description="Les chauffeurs sortis du système apparaîtront ici."
      />
    );
  }
  return (
    <SharedEmptyState
      icon={UserPlus}
      title="Aucun chauffeur enregistré"
      description="Invitez votre premier chauffeur pour commencer à assigner des courses."
      action={{ onClick: onCreate, label: 'Inviter un chauffeur', icon: Plus, variant: 'accent' }}
    />
  );
}
