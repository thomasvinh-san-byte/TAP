'use client';

import {
  Clock,
  Zap,
  Siren,
  Armchair,
  Accessibility,
  Car,
  Ambulance,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RideAttributes } from '@tap/optimizer-client';

/**
 * Badges métier sur une course du plan optimisation (Wave 2 Phase 06.11 — B3).
 *
 * Pattern strictement aligné sur `HautsBadge` :
 *   - icône `lucide-react` + composant `Badge` shadcn
 *   - texte doublé de la couleur (WCAG 2.1 AA — couleur jamais seule)
 *   - `tabIndex={0}` + `title` pour tooltip accessible clavier
 *   - palette Tailwind (border-* + bg-* + text-*) contrastée
 *
 * 3 types :
 *   - `urgency` : 3 valeurs (programmee / urgente / immediate)
 *   - `transport` : 4 valeurs (taxi_conventionne / tpmr / vsl / ambulance)
 *   - `tpmr` : shortcut quand on signale TPMR sans préciser tout le transport
 *     (réservé futurs usages, non utilisé V1)
 *
 * Règles d'affichage (côté appelant) :
 *   - `transport` toujours affiché si présent (info essentielle).
 *   - `urgency` affiché uniquement si !== 'programmee' (état nominal silencieux).
 *   - Si `transport === 'tpmr'`, ne pas ajouter de badge `tpmr` séparé.
 */

type UrgencyValue = RideAttributes['urgency'];
type TransportModeValue = RideAttributes['transport_mode'];

interface UrgencyBadgeProps {
  type: 'urgency';
  value: UrgencyValue;
}

interface TransportBadgeProps {
  type: 'transport';
  value: TransportModeValue;
}

interface TpmrBadgeProps {
  type: 'tpmr';
}

export type RideBadgeProps = UrgencyBadgeProps | TransportBadgeProps | TpmrBadgeProps;

interface BadgeConfig {
  label: string;
  icon: LucideIcon;
  className: string;
  title: string;
}

const URGENCY_CONFIG: Record<UrgencyValue, BadgeConfig> = {
  programmee: {
    label: 'Programmée',
    icon: Clock,
    className: 'border-slate-300 bg-slate-50 text-slate-700',
    title: "Course programmée à l'avance, marge horaire normale.",
  },
  urgente: {
    label: 'Urgente',
    icon: Zap,
    className: 'border-amber-300 bg-amber-50 text-amber-700',
    title: 'Course urgente, fenêtre horaire serrée.',
  },
  immediate: {
    label: 'Immédiate',
    icon: Siren,
    className: 'border-red-300 bg-red-50 text-red-700',
    title: 'Course immédiate à traiter en priorité.',
  },
};

const TRANSPORT_CONFIG: Record<TransportModeValue, BadgeConfig> = {
  taxi_conventionne: {
    label: 'Taxi',
    icon: Car,
    className: 'border-blue-300 bg-blue-50 text-blue-700',
    title: 'Taxi conventionné CGSS.',
  },
  tpmr: {
    label: 'TPMR',
    icon: Accessibility,
    className: 'border-purple-300 bg-purple-50 text-purple-700',
    title: 'Transport de personnes à mobilité réduite (fauteuil roulant).',
  },
  vsl: {
    label: 'VSL',
    icon: Armchair,
    className: 'border-cyan-300 bg-cyan-50 text-cyan-700',
    title: 'Véhicule sanitaire léger.',
  },
  ambulance: {
    label: 'Ambulance',
    icon: Ambulance,
    className: 'border-rose-300 bg-rose-50 text-rose-700',
    title: 'Ambulance avec personnel médical.',
  },
};

function renderBadge(config: BadgeConfig): JSX.Element {
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.className} title={config.title} tabIndex={0}>
      <Icon className="mr-4 h-12 w-12" aria-hidden />
      {config.label}
    </Badge>
  );
}

export function RideBadge(props: RideBadgeProps): JSX.Element {
  if (props.type === 'urgency') {
    return renderBadge(URGENCY_CONFIG[props.value]);
  }
  if (props.type === 'transport') {
    return renderBadge(TRANSPORT_CONFIG[props.value]);
  }
  // type === 'tpmr'
  return renderBadge({
    label: 'TPMR',
    icon: Accessibility,
    className: 'border-purple-300 bg-purple-50 text-purple-700',
    title: 'Transport de personnes à mobilité réduite.',
  });
}
