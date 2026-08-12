import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { monthBounds } from './queries-facturation';
import {
  CGSS_DEFAULT_STATUS,
  type CgssStatus,
  type CgssEventType,
  type CgssMotifFamille,
} from './cgss-invoice-status';

/**
 * Suivi du cycle de vie des factures CGSS (G3 Lot 2) — grain = course.
 *
 * Liste les courses en tiers payant CGSS pur (`payment_status = 'non_concerne'`,
 * `terminee`) d'un mois, avec leur statut courant et leur dernier événement.
 * L'historique complet (append-only) est renvoyé à part pour la timeline. RLS
 * Postgres borne à l'organisation. Aucun montant (D-09) — états / dates / motifs.
 */

export interface CgssSuiviRow {
  id: string;
  ended_at: string;
  patient_nom: string;
  patient_prenom: string;
  driver_nom: string;
  status: CgssStatus;
  last_event_type: CgssEventType | null;
  last_event_date: string | null;
  motif: string | null;
  motif_famille: CgssMotifFamille | null;
}

export interface CgssEventRow {
  id: string;
  ride_id: string;
  event_type: CgssEventType;
  event_date: string;
  motif: string | null;
  motif_famille: CgssMotifFamille | null;
  complementaire_en_attente: boolean;
  created_at: string;
}

export interface CgssSuiviResult {
  rows: CgssSuiviRow[];
  /** Événements par course, triés chronologiquement (timeline). */
  eventsByRide: Record<string, CgssEventRow[]>;
}

interface RawRideRow {
  id: string;
  ended_at: string;
  cgss_invoice_status: string | null;
  patient: { nom: string; prenom: string } | null;
  driver: { nom_affichage: string } | null;
}

export async function getCgssSuivi(mois: string, chauffeurId?: string): Promise<CgssSuiviResult> {
  const supabase = await createClient();
  const { start, end } = monthBounds(mois);

  const base = supabase
    .from('rides')
    .select(
      `id, ended_at, cgss_invoice_status,
       patient:patients!inner(nom, prenom),
       driver:drivers(nom_affichage)`,
    )
    .eq('status', 'terminee')
    .eq('payment_status', 'non_concerne')
    .gte('ended_at', start)
    .lt('ended_at', end);
  const scoped = chauffeurId ? base.eq('driver_id', chauffeurId) : base;
  const res = (await scoped.order('ended_at', { ascending: true })) as unknown as {
    data: RawRideRow[] | null;
    error: unknown;
  };
  if (res.error || !res.data || res.data.length === 0) {
    return { rows: [], eventsByRide: {} };
  }

  const ids = res.data.map((r) => r.id);
  const evRes = (await supabase
    .from('ride_cgss_invoice_events')
    .select(
      'id, ride_id, event_type, event_date, motif, motif_famille, complementaire_en_attente, created_at',
    )
    .in('ride_id', ids)
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: true })) as unknown as {
    data: CgssEventRow[] | null;
    error: unknown;
  };
  const events = evRes.error || !evRes.data ? [] : evRes.data;

  const eventsByRide: Record<string, CgssEventRow[]> = {};
  for (const e of events) {
    (eventsByRide[e.ride_id] ??= []).push(e);
  }

  const rows: CgssSuiviRow[] = res.data.map((r) => {
    const evs = eventsByRide[r.id] ?? [];
    const last = evs.length > 0 ? evs[evs.length - 1] : null;
    return {
      id: r.id,
      ended_at: r.ended_at,
      patient_nom: r.patient?.nom ?? '',
      patient_prenom: r.patient?.prenom ?? '',
      driver_nom: r.driver?.nom_affichage ?? '',
      // Statut courant : colonne dénormalisée, ou défaut normé si pas encore entrée.
      status: (r.cgss_invoice_status as CgssStatus | null) ?? CGSS_DEFAULT_STATUS,
      last_event_type: last?.event_type ?? null,
      last_event_date: last?.event_date ?? null,
      motif: last?.motif ?? null,
      motif_famille: last?.motif_famille ?? null,
    };
  });

  return { rows, eventsByRide };
}
