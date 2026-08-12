import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Carte-KPI du tableau de bord dirigeant (Phase 06.8) — composant
 * présentationnel, server component. Reçoit ses valeurs en props, aucune
 * query.
 *
 * Anatomie FIXE (Phase 06.49, DEC-128, doctrine d'alignement) :
 * `[label muted] → [corps] → [action mt-auto]`, `h-full` pour des hauteurs
 * égales par rangée (`items-stretch`), valeur `text-2xl tabular-nums`,
 * espacement resserré. Les 4 variantes (simple/ventilation/multi/alerte) sont
 * des SLOTS du corps, pas des compositions divergentes. Couleurs sémantiques
 * en tokens (success/warning/destructive), jour+nuit.
 *
 * WCAG : tout état couleur est doublé d'un texte ; liens focusables, cible
 * ≥ 44 px.
 */

export type KpiState = 'neutre' | 'succes' | 'attention' | 'alerte';

// Couleur RÉSERVÉE aux exceptions (norme dashboard exécutif : « si tout est
// coloré, rien n'est urgent »). Un état « succès » (sous le seuil) = pas
// d'exception → neutre, comme `neutre`. Seuls `attention` (ambre) et `alerte`
// (rouge) portent une couleur, pour que les vrais dépassements ressortent.
const STATE_CLASS: Record<KpiState, string> = {
  neutre: 'text-foreground',
  succes: 'text-foreground',
  attention: 'text-warning',
  alerte: 'text-destructive',
};

/**
 * Hiérarchie de taille (normes dashboard exécutif) : la taille communique la
 * priorité avant qu'on lise un libellé. `hero` = grand (santé financière),
 * `normal` = primaire, `compact` = secondaire. La largeur (col-span) est portée
 * par l'appelant via `className` ; ici on module padding, écart et taille du chiffre.
 */
export type KpiSize = 'hero' | 'normal' | 'compact';

// Densité resserrée (norme dashboard exécutif : dense mais organisé, scannable
// en une vue). Paddings et écarts réduits d'un cran ; la hiérarchie tient par la
// taille relative du chiffre (VALUE_SIZE_CLASS) et le padding stepped, pas par de
// l'air. Héros > primaires > secondaires reste net.
const CARD_SIZE_CLASS: Record<KpiSize, string> = {
  hero: 'gap-8 p-24',
  normal: 'gap-4 p-16',
  compact: 'gap-4 p-12',
};

const VALUE_SIZE_CLASS: Record<KpiSize, string> = {
  hero: 'text-4xl',
  normal: 'text-2xl',
  compact: 'text-xl',
};

// Libellé discret en « eyebrow » uniforme (uppercase, tracking, muted) : c'est
// le CHIFFRE qui porte la taille et l'emphase, pas le libellé.
const LABEL_CLASS = 'text-muted-foreground text-xs font-medium uppercase tracking-wide';

// Élévation hiérarchisée : la profondeur renforce la pyramide. Le vital (hero)
// « avance » (ombre plus présente), le détail (compact) « recule » (plat, sans
// ombre). En nuit la séparation vient surtout de la surface --card plus claire.
const SHADOW_SIZE_CLASS: Record<KpiSize, string> = {
  hero: 'shadow-elev-md',
  normal: 'shadow-elev-sm',
  compact: 'shadow-none',
};

/**
 * Accent de statut = liseré gauche (4 px), SIGNATURE visuelle disciplinée.
 * Couleur = sens uniquement, toujours doublée du `stateLabel` texte (a11y) :
 *   - alerte (dépassement)      → destructive
 *   - attention (proche seuil)  → warning
 * À défaut d'exception, les cartes `hero` portent un accent d'IDENTITÉ (primary)
 * pour ancrer le scorecard ; les autres restent neutres (pas de liseré).
 * `neutre`/`succes` ne colorent jamais (doctrine : couleur = exception).
 */
function accentClass(size: KpiSize, state: KpiState | undefined): string {
  if (state === 'alerte') return 'border-l-4 border-l-destructive';
  if (state === 'attention') return 'border-l-4 border-l-warning';
  if (size === 'hero') return 'border-l-4 border-l-primary';
  return '';
}

const ACTION_CLASS =
  'text-primary focus-visible:ring-ring mt-auto inline-flex min-h-[44px] items-center ' +
  'text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2';

/**
 * Couleur du delta — réservée aux exceptions (couleur parcimonieuse). Une
 * tendance favorable ou stable reste NEUTRE (la flèche ↗/↘ porte déjà le sens) ;
 * seule une tendance défavorable est signalée : ambre, ou rouge si forte
 * (|delta| ≥ 10). Ainsi la couleur ne marque que ce qui appelle l'attention.
 */
function deltaClass(delta: number, sign: 'positive' | 'inverse' = 'positive'): string {
  const defavorable = sign === 'positive' ? delta < 0 : delta > 0;
  if (defavorable) return Math.abs(delta) >= 10 ? 'text-destructive' : 'text-warning';
  return 'text-muted-foreground';
}

function deltaArrow(delta: number): string {
  if (delta > 0) return '↗';
  if (delta < 0) return '↘';
  return '→';
}

function deltaFormat(delta: number, unit: '%' | 'pts'): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}${unit === '%' ? ' %' : ' pts'}`;
}

interface KpiAction {
  href: string;
  label: string;
}

interface KpiCardBase {
  label: string;
  action?: KpiAction;
  /** Rang de taille (hiérarchie exécutive). Défaut `normal` — comportement inchangé. */
  size?: KpiSize;
  /** Classe additionnelle sur la carte (largeur bento : col-span, min-h). */
  className?: string;
}

interface KpiSimple extends KpiCardBase {
  variant: 'simple';
  value: string;
  context?: string;
  state?: KpiState;
  stateLabel?: string;
  // Wave 1 Phase 06.11 — A4 comparatif N vs N-1 (pattern Stripe Balance).
  // Tous optionnels : si absents, le comportement est strictement inchangé.
  /** Valeur du mois précédent déjà formatée (ex : "1 234 €", "8 %"). */
  previousValue?: string;
  /**
   * Delta numérique : en % pour les valeurs absolues, en points pour les
   * valeurs qui sont déjà des pourcentages (incidents, mutualisation).
   */
  delta?: number;
  /**
   * Unité du delta affichée à l'utilisateur : `%` (défaut) ou `pts` pour
   * les KPI déjà en %.
   */
  deltaUnit?: '%' | 'pts';
  /**
   * Sens de la métrique : `positive` (↗ favorable, ↘ défavorable) ou
   * `inverse` (↗ défavorable comme taux d'incidents — ↘ est favorable).
   */
  deltaSign?: 'positive' | 'inverse';
  /** Libellé du mois précédent en clair (ex : "mai 2026"). */
  previousLabel?: string;
}

interface KpiVentilation extends KpiCardBase {
  variant: 'ventilation';
  value: string;
  lines: { label: string; value: string }[];
}

interface KpiMulti extends KpiCardBase {
  variant: 'multi';
  rows: { label: string; value: string }[];
}

interface KpiAlerte extends KpiCardBase {
  variant: 'alerte';
  items: { label: string; href?: string }[];
}

export type KpiCardProps = KpiSimple | KpiVentilation | KpiMulti | KpiAlerte;

function KpiBody(props: KpiCardProps): JSX.Element {
  const size = props.size ?? 'normal';
  switch (props.variant) {
    case 'simple':
      return (
        <div className="flex flex-col gap-4">
          <p
            className={cn(
              VALUE_SIZE_CLASS[size],
              'font-semibold tabular-nums',
              props.state && STATE_CLASS[props.state],
            )}
          >
            {props.value}
          </p>
          {props.stateLabel ? (
            <p className={cn('text-sm', props.state && STATE_CLASS[props.state])}>
              {props.stateLabel}
            </p>
          ) : null}
          {props.delta !== undefined && props.previousLabel ? (
            <p
              className={cn(
                size === 'hero' ? 'text-sm' : 'text-xs',
                'tabular-nums',
                deltaClass(props.delta, props.deltaSign),
              )}
            >
              {deltaArrow(props.delta)} {deltaFormat(props.delta, props.deltaUnit ?? '%')} vs{' '}
              {props.previousLabel}
              {props.previousValue ? ` (${props.previousValue})` : ''}
            </p>
          ) : null}
          {props.context ? <p className="text-muted-foreground text-xs">{props.context}</p> : null}
        </div>
      );
    case 'ventilation':
      return (
        <div className="flex flex-col gap-4">
          <p className="text-2xl font-semibold tabular-nums">{props.value}</p>
          <dl className="flex flex-col gap-4">
            {props.lines.map((l) => (
              <div key={l.label} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{l.label}</dt>
                <dd className="tabular-nums">{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case 'multi':
      return (
        <dl className="flex flex-col gap-8">
          {props.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-sm">{r.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
      );
    case 'alerte':
      if (props.items.length === 0) {
        return <p className="text-success text-sm font-medium">Aucune alerte</p>;
      }
      return (
        <ul className="flex flex-col gap-4">
          {props.items.map((it) =>
            it.href ? (
              <li key={it.label}>
                <Link
                  href={it.href}
                  className="text-destructive focus-visible:ring-ring flex min-h-[44px] items-center justify-between gap-8 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                >
                  <span>{it.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            ) : (
              <li
                key={it.label}
                className="text-destructive flex min-h-[44px] items-center text-sm font-medium"
              >
                {it.label}
              </li>
            ),
          )}
        </ul>
      );
  }
}

export function KpiCard(props: KpiCardProps): JSX.Element {
  const size = props.size ?? 'normal';
  // Cartes actionnables : légère montée d'ombre au survol (micro-interaction,
  // 150 ms ; `prefers-reduced-motion` neutralise la transition globalement).
  const actionable = props.action !== undefined;
  // L'état (liseré d'accent) n'existe que sur la variante `simple`.
  const state = props.variant === 'simple' ? props.state : undefined;
  return (
    <div
      className={cn(
        'border-border bg-card text-card-foreground flex h-full flex-col rounded-lg border',
        CARD_SIZE_CLASS[size],
        SHADOW_SIZE_CLASS[size],
        accentClass(size, state),
        actionable && 'hover:shadow-elev-md transition-shadow',
        props.className,
      )}
    >
      <h3 className={LABEL_CLASS}>{props.label}</h3>
      <KpiBody {...props} />
      {props.action ? (
        <Link href={props.action.href} className={ACTION_CLASS}>
          {props.action.label} →
        </Link>
      ) : null}
    </div>
  );
}
