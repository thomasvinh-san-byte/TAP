/**
 * SLA factuels datés — Wave 1 Phase 06.11 (A3 reformulé Option 3 2026-06-03).
 *
 * Doctrine : couleurs uniquement sur dépassements légaux datés objectifs
 * (délais légaux RGPD précis avec dates), JAMAIS sur un score de conformité
 * globale (cf. ComplianceCard 06.8 — RGPD impose de démontrer la conformité,
 * pas de la revendiquer).
 *
 * Pure functions : les evaluateurs prennent des données déjà chargées et la
 * date courante, retournent `SlaRule | null`. Testables sans Supabase mock.
 * Le wrapper `getSlaRules(supabase)` compose : fetch des 4 sources en
 * parallèle + appel des evaluateurs purs + tri par criticité.
 */

import type { createClient } from '@/lib/supabase/server';

export type SlaStatus = 'vert' | 'orange' | 'rouge';

export type SlaRuleId = 'breach-cnil-72h' | 'request-deadline' | 'dpia-review' | 'register-review';

export interface SlaRule {
  id: SlaRuleId;
  status: SlaStatus;
  label: string;
  href?: string;
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_30D = 30 * MS_PER_DAY;
const MS_PER_12M = 365 * MS_PER_DAY;

// ---- Types des données chargées depuis Supabase (forme minimale utile) ----

export interface BreachRow {
  detected_at: string;
}

export interface RequestRow {
  deadline_at: string;
}

export interface DpiaRow {
  title: string;
  next_review_at: string;
}

// ---- Évaluateurs purs (testables sans mock Supabase) -----------------------

/**
 * Règle 1 — Breach CNIL 72h (art. 33 RGPD).
 * Sur les breaches `cnil_notification_required=true` ET sans notification
 * ni clôture, on prend la plus critique (la plus ancienne).
 */
export function evaluateBreachCnil72h(rows: BreachRow[], now: Date): SlaRule | null {
  if (rows.length === 0) return null;
  // Sortie : plus ancienne en premier (plus critique). `rows.length > 0`
  // garanti par la garde ci-dessus → `oldest` est défini.
  const sorted = rows.map((r) => new Date(r.detected_at).getTime()).sort((a, b) => a - b);
  const oldest = sorted[0] ?? now.getTime();
  const elapsedHours = (now.getTime() - oldest) / MS_PER_HOUR;
  if (elapsedHours > 72) {
    const over = Math.round(elapsedHours - 72);
    return {
      id: 'breach-cnil-72h',
      status: 'rouge',
      label: `Notification CNIL en retard (${over} h dépassées)`,
      href: '/admin/legal/breaches',
    };
  }
  if (elapsedHours > 60) {
    const remaining = Math.round(72 - elapsedHours);
    return {
      id: 'breach-cnil-72h',
      status: 'orange',
      label: `Notification CNIL approche échéance (${remaining} h restantes)`,
      href: '/admin/legal/breaches',
    };
  }
  return null;
}

/**
 * Règle 2 — Demande patient RGPD (art. 12 — `deadline_at`).
 * Compte les demandes en délai dépassé ou à échéance proche (< 5 jours).
 */
export function evaluateRequestDeadline(rows: RequestRow[], now: Date): SlaRule | null {
  if (rows.length === 0) return null;
  const nowMs = now.getTime();
  const fiveDaysMs = 5 * MS_PER_DAY;
  let countDepassees = 0;
  let countProches = 0;
  for (const r of rows) {
    const deadlineMs = new Date(r.deadline_at).getTime();
    if (deadlineMs < nowMs) {
      countDepassees += 1;
    } else if (deadlineMs - nowMs < fiveDaysMs) {
      countProches += 1;
    }
  }
  if (countDepassees > 0) {
    return {
      id: 'request-deadline',
      status: 'rouge',
      label: `${countDepassees} demande${countDepassees > 1 ? 's' : ''} en délai dépassé`,
      href: '/admin/legal/requests',
    };
  }
  if (countProches > 0) {
    return {
      id: 'request-deadline',
      status: 'orange',
      label: `${countProches} demande${countProches > 1 ? 's' : ''} à échéance proche`,
      href: '/admin/legal/requests',
    };
  }
  return null;
}

/**
 * Règle 3 — DPIA `next_review_at` dépassée (révision périodique).
 * Compte les DPIA non archivées avec `next_review_at` < now (rouge) ou
 * < 30 jours (orange).
 */
export function evaluateDpiaReview(rows: DpiaRow[], now: Date): SlaRule | null {
  if (rows.length === 0) return null;
  const nowMs = now.getTime();
  let countDepassees = 0;
  let countProches = 0;
  for (const r of rows) {
    const reviewMs = new Date(r.next_review_at).getTime();
    if (reviewMs < nowMs) {
      countDepassees += 1;
    } else if (reviewMs - nowMs < MS_PER_30D) {
      countProches += 1;
    }
  }
  if (countDepassees > 0) {
    return {
      id: 'dpia-review',
      status: 'rouge',
      label: `${countDepassees} DPIA en révision dépassée`,
      href: '/admin/legal/dpia',
    };
  }
  if (countProches > 0) {
    return {
      id: 'dpia-review',
      status: 'orange',
      label: `${countProches} DPIA à réviser ce mois`,
      href: '/admin/legal/dpia',
    };
  }
  return null;
}

/**
 * Règle 4 — Registre des traitements (révision > 12 mois).
 * Pas de rouge possible : aucun délai légal absolu, juste recommandation
 * périodique. Orange si dernière mise à jour > 12 mois, sinon null.
 */
export function evaluateRegisterReview(latestUpdate: string | null, now: Date): SlaRule | null {
  if (latestUpdate === null) return null;
  const elapsed = now.getTime() - new Date(latestUpdate).getTime();
  if (elapsed > MS_PER_12M) {
    const months = Math.round(elapsed / (30 * MS_PER_DAY));
    return {
      id: 'register-review',
      status: 'orange',
      label: `Registre non révisé depuis ${months} mois`,
      href: '/admin/legal/registre',
    };
  }
  return null;
}

/**
 * Tri par criticité : rouge avant orange (vert n'arrive jamais ici car
 * les evaluateurs renvoient null pour vert).
 */
const STATUS_ORDER: Record<SlaStatus, number> = { rouge: 0, orange: 1, vert: 2 };

export function sortRulesByCriticity(rules: SlaRule[]): SlaRule[] {
  return [...rules].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

// ---- Wrapper Supabase (server-only via appelant) ---------------------------

type Supabase = ReturnType<typeof createClient>;

async function fetchBreachData(supabase: Supabase): Promise<BreachRow[]> {
  const { data, error } = await supabase
    .from('data_breach_incident')
    .select('detected_at')
    .eq('cnil_notification_required', true)
    .is('cnil_notification_at', null)
    .is('closed_at', null)
    .order('detected_at', { ascending: true });
  if (error) {
    console.error('[dashboard/sla/breach] Erreur Supabase:', error);
  }
  return (data as BreachRow[] | null) ?? [];
}

async function fetchRequestData(supabase: Supabase): Promise<RequestRow[]> {
  const { data, error } = await supabase
    .from('patient_data_request')
    .select('deadline_at')
    .in('status', ['recue', 'en_cours'])
    .order('deadline_at', { ascending: true });
  if (error) {
    console.error('[dashboard/sla/request] Erreur Supabase:', error);
  }
  return (data as RequestRow[] | null) ?? [];
}

async function fetchDpiaData(supabase: Supabase): Promise<DpiaRow[]> {
  const { data, error } = await supabase
    .from('dpia_record')
    .select('title, next_review_at')
    .neq('status', 'archivee')
    .not('next_review_at', 'is', null)
    .order('next_review_at', { ascending: true });
  if (error) {
    console.error('[dashboard/sla/dpia] Erreur Supabase:', error);
  }
  return (data as DpiaRow[] | null) ?? [];
}

async function fetchRegisterLatestUpdate(supabase: Supabase): Promise<string | null> {
  const { data, error } = await supabase
    .from('data_processing_register')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[dashboard/sla/register] Erreur Supabase:', error);
  }
  return (data as { updated_at: string }[] | null)?.[0]?.updated_at ?? null;
}

/**
 * Composition : fetch + évaluation + tri. Le résultat ne contient QUE les
 * règles non-vertes (les vertes sont silencieuses, l'UI rend un état neutre
 * « Délais légaux respectés » si le tableau est vide).
 */
export async function getSlaRules(supabase: Supabase): Promise<SlaRule[]> {
  const now = new Date();
  const [breach, request, dpia, register] = await Promise.all([
    fetchBreachData(supabase),
    fetchRequestData(supabase),
    fetchDpiaData(supabase),
    fetchRegisterLatestUpdate(supabase),
  ]);
  const rules = [
    evaluateBreachCnil72h(breach, now),
    evaluateRequestDeadline(request, now),
    evaluateDpiaReview(dpia, now),
    evaluateRegisterReview(register, now),
  ].filter((r): r is SlaRule => r !== null);
  return sortRulesByCriticity(rules);
}
