/**
 * Helpers purs — messagerie interne (Phase 06.41, DEC-120).
 *
 * Lot 1 : chat texte à la course. Logique de présentation pure (regroupement
 * par jour calendaire, libellé d'auteur), sans dépendance React/Supabase —
 * testable Vitest, partagée régulateur (ride-drawer) + chauffeur (ride-detail).
 *
 * Le regroupement par jour utilise le fuseau de La Réunion (Indian/Reunion,
 * UTC+4 sans heure d'été) : un message à 23 h UTC appartient au lendemain
 * côté utilisateur. On ne se fie pas au fuseau du serveur.
 */

export type SenderRole = 'dirigeant' | 'regulateur' | 'chauffeur';

/** Libellés FR centralisés (NFR-001 — pas de chaîne en dur dans l'UI). */
export const SENDER_ROLE_LABEL: Record<SenderRole, string> = {
  dirigeant: 'Direction',
  regulateur: 'Régulation',
  chauffeur: 'Chauffeur',
};

/** Forme minimale d'un message consommée par l'UI (calque BDD). */
export interface RideMessage {
  id: string;
  ride_id: string;
  sender_profile_id: string;
  sender_role: SenderRole;
  /** Corps texte. `null` pour un message photo-seule (§5.22 lot 3). */
  body: string | null;
  /** Chemin de l'objet Storage d'une photo jointe (bucket privé). `null` = texte. */
  image_path: string | null;
  /** Horodatage ISO 8601 (timestamptz). */
  created_at: string;
}

/**
 * Message du fil général (hors course, §5.22 lot A). Table dédiée
 * `internal_general_message` — pas de `ride_id`, texte uniquement au lot A.
 */
export interface GeneralMessage {
  id: string;
  sender_profile_id: string;
  sender_role: SenderRole;
  body: string;
  /** Horodatage ISO 8601 (timestamptz). */
  created_at: string;
}

/** Groupe de messages d'un même jour calendaire (La Réunion). */
export interface RideMessageDayGroup {
  /** Clé jour `YYYY-MM-DD` (fuseau Indian/Reunion). */
  day: string;
  messages: RideMessage[];
}

const REUNION_TZ = 'Indian/Reunion';
const dayFormatter = new Intl.DateTimeFormat('fr-CA', {
  timeZone: REUNION_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Jour calendaire (La Réunion) d'un horodatage ISO, au format `YYYY-MM-DD`.
 * Renvoie une chaîne vide si la date est invalide (défensif, jamais de throw).
 */
export function reunionDayKey(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return '';
  // fr-CA produit déjà `YYYY-MM-DD`.
  return dayFormatter.format(d);
}

/** La Réunion : décalage UTC FIXE (+04:00), aucune heure d'été — bornes stables. */
export const REUNION_UTC_OFFSET = '+04:00';

/**
 * Bornes d'un jour calendaire réunionnais `date` (`YYYY-MM-DD`), en intervalle
 * SEMI-OUVERT `[gte, lt)`, exprimées avec l'offset Réunion. Cohérent avec
 * `reunionDayKey` : pour tout horodatage `t`, `gte <= t < lt` ⇔
 * `reunionDayKey(t) === date`. À utiliser pour borner une requête serveur sur la
 * vraie journée réunionnaise plutôt que sur un UTC naïf (`${date}T00:00:00`),
 * qui décale la fenêtre de 4 h et fait manquer les courses proches de minuit.
 */
export function reunionDayBoundsUtc(date: string): { gte: string; lt: string } {
  const gte = `${date}T00:00:00${REUNION_UTC_OFFSET}`;
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const lt = `${next.toISOString().slice(0, 10)}T00:00:00${REUNION_UTC_OFFSET}`;
  return { gte, lt };
}

/**
 * Regroupe une liste de messages par jour calendaire (La Réunion), en
 * conservant l'ordre chronologique ascendant (tri défensif sur `created_at`).
 * Les groupes sont retournés dans l'ordre des jours (du plus ancien au plus
 * récent). Entrée vide → tableau vide.
 *
 * Générique sur toute forme portant `created_at` : partagé par le chat à la
 * course (`RideMessage`) et le fil général (`GeneralMessage`).
 */
export function groupMessagesByDay<T extends { created_at: string }>(
  messages: T[],
): { day: string; messages: T[] }[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const groups: { day: string; messages: T[] }[] = [];
  let current: { day: string; messages: T[] } | null = null;

  for (const message of sorted) {
    const day = reunionDayKey(message.created_at);
    if (!current || current.day !== day) {
      current = { day, messages: [] };
      groups.push(current);
    }
    current.messages.push(message);
  }

  return groups;
}
