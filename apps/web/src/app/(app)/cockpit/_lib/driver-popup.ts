import { POSITION_STALE_MIN, formatPositionAge } from './use-driver-positions';

/**
 * Contenu de l'aperçu (popup) au clic sur un marqueur de chauffeur.
 *
 * Logique PURE (testable) : dérive le contenu à partir d'une position (avec
 * horodatage), de la charge du jour et d'une éventuelle course en cours. Le
 * temps est TOUJOURS « dernière position connue · il y a X » — jamais présenté
 * comme du direct. Le repère de fraîcheur porte un MOT (pas la couleur seule).
 */

/** Seuil « périmée » : au-delà, la position est trop ancienne pour décider. */
export const POSITION_EXPIRED_MIN = 30;

export type FreshnessLevel = 'recente' | 'ancienne' | 'perimee';

export interface Freshness {
  level: FreshnessLevel;
  /** Mot lisible — l'information ne dépend jamais de la couleur seule. */
  label: string;
  /** Jeton de couleur sémantique (success / warning / danger). */
  tone: 'success' | 'warning' | 'danger';
}

/**
 * Repère de fraîcheur selon l'ancienneté (minutes) : récente (< seuil géoloc),
 * ancienne (< seuil périmé), périmée (au-delà). Réutilise `POSITION_STALE_MIN`.
 */
export function driverFreshness(ageMinutes: number): Freshness {
  if (ageMinutes < POSITION_STALE_MIN) {
    return { level: 'recente', label: 'Position récente', tone: 'success' };
  }
  if (ageMinutes < POSITION_EXPIRED_MIN) {
    return { level: 'ancienne', label: 'Position ancienne', tone: 'warning' };
  }
  return { level: 'perimee', label: 'Position périmée', tone: 'danger' };
}

export interface DriverPopupCurrentRide {
  /** Heure prévue lisible (HH:mm, fuseau Réunion). */
  scheduledLabel: string;
  dropoff: string | null;
}

export interface DriverPopupData {
  name: string;
  freshness: Freshness;
  /** « vu il y a X min » — dernière position connue, jamais du direct. */
  ageLabel: string;
  ageMinutes: number;
  /** Charge du jour : nombre de courses affectées. */
  loadCount: number;
  currentRide: DriverPopupCurrentRide | null;
}

export interface BuildDriverPopupInput {
  name: string;
  capturedAt: string;
  now: Date;
  loadCount: number;
  currentRide: DriverPopupCurrentRide | null;
}

export function buildDriverPopupData(input: BuildDriverPopupInput): DriverPopupData {
  const ageMs = input.now.getTime() - new Date(input.capturedAt).getTime();
  const ageMinutes = Math.max(0, ageMs / 60_000);
  return {
    name: input.name,
    freshness: driverFreshness(ageMinutes),
    ageLabel: formatPositionAge(input.capturedAt, input.now),
    ageMinutes,
    loadCount: input.loadCount,
    currentRide: input.currentRide,
  };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * Rend le contenu HTML de l'aperçu (injecté dans la popup native MapLibre).
 * Valeurs dynamiques échappées. Classes Tailwind globales (le contenu vit dans
 * le DOM). Couleur du statut + MOT (jamais la couleur seule).
 */
export function renderDriverPopupHtml(data: DriverPopupData): string {
  const toneClass =
    data.freshness.tone === 'success'
      ? 'text-success'
      : data.freshness.tone === 'warning'
        ? 'text-warning'
        : 'text-destructive';
  const plural = data.loadCount > 1 ? 's' : '';
  const current = data.currentRide
    ? `<p class="text-foreground text-xs">En course · ${esc(data.currentRide.scheduledLabel)}${
        data.currentRide.dropoff ? ` → ${esc(data.currentRide.dropoff)}` : ''
      }</p>`
    : '';
  return [
    '<div class="space-y-4 text-sm">',
    `<p class="text-foreground font-semibold">${esc(data.name)}</p>`,
    `<p class="${toneClass} text-xs font-medium">${esc(data.freshness.label)}</p>`,
    `<p class="text-muted-foreground text-xs">Dernière position connue · ${esc(data.ageLabel)}</p>`,
    `<p class="text-foreground text-xs">${data.loadCount} course${plural} affectée${plural} aujourd'hui</p>`,
    current,
    '</div>',
  ].join('');
}
