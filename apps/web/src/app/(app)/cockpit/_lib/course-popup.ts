/**
 * Contenu de l'aperçu (popup) au clic sur un point de course (départ ou arrivée).
 *
 * Logique PURE (testable) : identifie un point sans le surcharger. Un départ dit
 * QUI part et D'OÙ (patient + adresse de prise en charge) ; une arrivée dit OÙ va
 * la course (lieu de soins / adresse de destination) et pour qui. L'heure prévue
 * est affichée si disponible. Cohérent avec le popup chauffeur (même style,
 * fermeture native, un seul popup à la fois). Le mot « Départ »/« Arrivée » porte
 * l'information — jamais la couleur seule.
 */

export type CoursePointKind = 'start' | 'end';

export interface CoursePointPopupData {
  kind: CoursePointKind;
  /** Mot lisible : « Départ » ou « Arrivée ». */
  kindLabel: string;
  /** Patient concerné (toujours renseigné, `Patient` par défaut). */
  patient: string;
  /** Adresse du point : prise en charge (départ) ou destination (arrivée). */
  address: string | null;
  /** Heure prévue lisible (HH:mm, fuseau Réunion) si disponible. */
  scheduledLabel: string | null;
}

export interface BuildCoursePointPopupInput {
  kind: CoursePointKind;
  patient: string;
  address: string | null;
  scheduledLabel?: string | null;
}

export function buildCoursePointPopupData(input: BuildCoursePointPopupInput): CoursePointPopupData {
  return {
    kind: input.kind,
    kindLabel: input.kind === 'start' ? 'Départ' : 'Arrivée',
    patient: input.patient,
    address: input.address ?? null,
    scheduledLabel: input.scheduledLabel ?? null,
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
 * Valeurs dynamiques échappées. Classes Tailwind globales (le contenu vit dans le
 * DOM). Même gabarit que le popup chauffeur (`renderDriverPopupHtml`).
 */
export function renderCoursePointPopupHtml(data: CoursePointPopupData): string {
  const address = data.address
    ? `<p class="text-muted-foreground text-xs">${esc(data.address)}</p>`
    : '';
  const scheduled = data.scheduledLabel
    ? `<p class="text-foreground text-xs">Prévue · ${esc(data.scheduledLabel)}</p>`
    : '';
  return [
    '<div class="space-y-4 text-sm">',
    `<p class="text-muted-foreground text-xs font-medium">${esc(data.kindLabel)}</p>`,
    `<p class="text-foreground font-semibold">${esc(data.patient)}</p>`,
    address,
    scheduled,
    '</div>',
  ].join('');
}
