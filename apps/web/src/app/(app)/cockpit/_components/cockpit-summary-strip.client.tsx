'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  AlertTriangle,
  MapPinOff,
  FilePen,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { listDraftsAction } from '../../courses/actions';

/**
 * COCKPIT-05 (§5.13) — bande d'indicateurs de tête.
 *
 * Synthèse « résumé d'abord, détail à la demande » : réunit en tête d'écran les
 * quelques nombres qui appellent une action immédiate. AUCUN recalcul — chaque
 * valeur est réutilisée telle que déjà produite par le cockpit (courses non
 * affectées à H-1, alertes critiques, positions périmées, brouillons, échéances
 * réglementaires). Les brouillons partagent le cache `['ride-drafts']` de
 * `DraftsIndicator` (même source, pas de nouvelle requête logique).
 *
 * Registre visuel réutilisé (cf. `UnassignedH1Indicator`, `AlertsPanel`,
 * `ComplianceAlertsPanel`) : rouge `destructive` pour l'urgence de régulation,
 * ambre `warning` pour la conformité, neutre `muted` sinon. La couleur n'est
 * jamais le seul signal — libellé et nombre restent lisibles en toute teinte.
 *
 * Chaque indicateur est un point d'entrée cliquable/clavier vers le panneau
 * détaillé correspondant (défilement + focus). Le détail n'est pas dupliqué :
 * il reste dans son panneau.
 */

type Tone = 'alert' | 'warning' | 'neutral';

interface StripItem {
  key: string;
  icon: LucideIcon;
  label: string;
  count: number;
  /**
   * Teinte quand le nombre appelle une action (count > 0). `neutral` = jamais
   * mis en alerte (registre du panneau, ex. brouillons), toujours en sourdine.
   */
  activeTone: Tone;
  /** id du panneau détaillé visé (ancre dans le cockpit). */
  targetId: string;
  /** Contexte annoncé aux technologies d'assistance. */
  describe: (count: number) => string;
}

const TONE_CLASS: Record<Tone, string> = {
  alert: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  neutral: 'border-border bg-muted/30 text-muted-foreground',
};

/**
 * Défile jusqu'au panneau cible et lui donne le focus (tabindex=-1). Exporté pour
 * que le cockpit puisse l'appeler APRÈS avoir ouvert l'onglet contenant la cible
 * (panneaux tertiaires en onglets — R1).
 */
export function scrollToPanel(targetId: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(targetId);
  if (!el) return;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  // Focus (tabindex=-1 sur le panneau cible) : met en évidence et fait annoncer
  // l'en-tête du panneau par le lecteur d'écran.
  el.focus({ preventScroll: true });
}

export function CockpitSummaryStrip({
  unassignedH1Count,
  criticalAlertsCount,
  stalePositionsCount,
  complianceCount,
  onNavigate,
}: {
  unassignedH1Count: number;
  criticalAlertsCount: number;
  stalePositionsCount: number;
  complianceCount: number;
  /**
   * Ouverture d'un indicateur : si fourni, le cockpit gère la destination (ouvrir
   * l'onglet tertiaire concerné puis défiler). Sinon, défilement direct par ancre.
   */
  onNavigate?: (targetId: string) => void;
}): JSX.Element {
  // Même cache que `DraftsIndicator` : lecture partagée, pas de logique dupliquée.
  const { data: drafts } = useQuery({
    queryKey: ['ride-drafts'],
    queryFn: () => listDraftsAction(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const draftsCount = Array.isArray(drafts) ? drafts.length : 0;

  const items: StripItem[] = [
    {
      key: 'unassigned-h1',
      icon: CalendarClock,
      label: 'Non affectées',
      count: unassignedH1Count,
      activeTone: 'alert',
      targetId: 'cockpit-panel-unassigned-h1',
      describe: (c) =>
        `${c} course${c > 1 ? 's' : ''} non affectée${c > 1 ? 's' : ''} à moins d'une heure du créneau`,
    },
    {
      key: 'critical-alerts',
      icon: AlertTriangle,
      label: 'Alertes critiques',
      count: criticalAlertsCount,
      activeTone: 'alert',
      targetId: 'cockpit-panel-alerts',
      describe: (c) => `${c} alerte${c > 1 ? 's' : ''} critique${c > 1 ? 's' : ''}`,
    },
    {
      key: 'stale-positions',
      icon: MapPinOff,
      label: 'Positions périmées',
      count: stalePositionsCount,
      activeTone: 'alert',
      targetId: 'cockpit-panel-positions',
      describe: (c) =>
        `${c} chauffeur${c > 1 ? 's' : ''} en service dont la position n'est plus fraîche`,
    },
    {
      key: 'drafts',
      icon: FilePen,
      // Les brouillons ne sont pas une alerte (registre neutre du panneau) :
      // teinte neutre même à count > 0.
      label: 'Brouillons',
      count: draftsCount,
      activeTone: 'neutral',
      targetId: 'cockpit-panel-drafts',
      describe: (c) => `${c} brouillon${c > 1 ? 's' : ''} non finalisé${c > 1 ? 's' : ''}`,
    },
    {
      key: 'compliance',
      icon: ShieldAlert,
      label: 'Conformité',
      count: complianceCount,
      activeTone: 'warning',
      targetId: 'cockpit-panel-compliance',
      describe: (c) =>
        `${c} échéance${c > 1 ? 's' : ''} réglementaire${c > 1 ? 's' : ''} à surveiller`,
    },
  ];

  return (
    <section aria-label="Indicateurs de synthèse" className="min-w-0">
      <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          // Teinte d'alerte dès qu'un nombre appelle une action ; sinon neutre.
          // Les indicateurs à `activeTone: 'neutral'` (brouillons) restent en
          // sourdine même à count > 0 — registre visuel de leur panneau.
          const tone: Tone = item.count > 0 ? item.activeTone : 'neutral';
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() =>
                  onNavigate ? onNavigate(item.targetId) : scrollToPanel(item.targetId)
                }
                aria-label={`${item.describe(item.count)}. Voir le détail.`}
                className={cn(
                  'focus-visible:ring-ring flex w-full items-center gap-12 rounded-md border px-12 py-12 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  TONE_CLASS[tone],
                  tone === 'neutral' ? 'hover:bg-muted/50' : 'hover:brightness-105',
                )}
              >
                <Icon className="h-16 w-16 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-lg font-semibold tabular-nums leading-none">
                    {item.count}
                  </span>
                  <span className="mt-4 block truncate text-xs font-medium">{item.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
