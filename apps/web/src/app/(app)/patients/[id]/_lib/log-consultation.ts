import 'server-only';
import { getAuthContext } from '@/lib/auth/get-auth-context';

/**
 * Traçabilité de la CONSULTATION d'une fiche patient (corollaire HDS : tracer
 * « qui a accédé à quel dossier, quand », pour détecter des accès illégitimes).
 *
 * Périmètre volontairement étroit : uniquement l'ouverture de la fiche patient
 * détaillée (page serveur `patients/[id]`). Les listes et la recherche ne sont
 * PAS tracées (vues d'ensemble, pas un accès à un dossier identifiant précis).
 *
 * Réutilise le journal `audit_logs` existant (aucun schéma nouveau, toujours
 * append-only). N'enregistre QUE l'identifiant du patient et l'action — jamais
 * le contenu de la fiche (le journal ne doit pas devenir une fuite de données
 * de santé).
 *
 * Best-effort : un échec d'écriture n'interrompt jamais l'affichage de la fiche
 * (il est journalisé côté technique, mais ne casse pas la page). Un échec
 * systématique reste visible (log + nouvelle tentative au rendu suivant), il
 * n'est pas masqué par la déduplication.
 */

/** Action sémantique explicite portée dans `audit_logs.action`. */
export const PATIENT_CONSULT_ACTION = 'patient.consulted';

/** Fenêtre anti-doublons : consultations identiques rapprochées non re-tracées. */
const DEDUP_WINDOW_MS = 5 * 60_000;

/**
 * Anti-sur-journalisation simple, en mémoire (par instance serveur) : évite de
 * tracer deux fois la MÊME consultation (même acteur, même patient) à quelques
 * minutes d'intervalle — rafraîchissements, navigations aller-retour. Mesure
 * volontairement légère : en environnement multi-instances (serverless), un
 * doublon rare peut passer entre deux instances, ce qui reste acceptable et
 * sans risque (journal append-only, proportionné).
 */
const recentByKey = new Map<string, number>();

function markIfNotRecent(key: string, now: number): boolean {
  const last = recentByKey.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return false;
  recentByKey.set(key, now);
  // Purge opportuniste des entrées expirées pour borner la taille de la map.
  if (recentByKey.size > 500) {
    for (const [k, t] of recentByKey) {
      if (now - t >= DEDUP_WINDOW_MS) recentByKey.delete(k);
    }
  }
  return true;
}

export async function logPatientConsultation(patientId: string): Promise<void> {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return; // Pas de session : l'auth du rendu s'en charge, rien à tracer.

    const now = Date.now();
    const key = `${ctx.userId}:${patientId}`;
    if (!markIfNotRecent(key, now)) return; // Doublon récent : on ne re-trace pas.

    const { error } = await ctx.supabase.from('audit_logs').insert({
      organization_id: ctx.organizationId,
      actor_id: ctx.userId,
      actor_role: ctx.role,
      action: PATIENT_CONSULT_ACTION,
      entity_type: 'patient',
      entity_id: patientId,
      // Aucune donnée de santé recopiée : identifiant + action suffisent.
      metadata: {},
    });

    if (error) {
      // Échec visible côté technique, mais non bloquant pour la fiche. On libère
      // la clé pour retenter au prochain rendu (un échec systématique reste
      // visible, il n'est pas avalé par le dédup).
      recentByKey.delete(key);
      console.error('[audit/patient-consultation] échec écriture', error);
    }
  } catch (err) {
    // Best-effort strict : aucune exception ne remonte au rendu de la fiche.
    console.error('[audit/patient-consultation] exception', err);
  }
}
