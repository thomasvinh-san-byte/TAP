'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { CgssStatusBadge } from './cgss-status-badge';
import { CgssRecordEvent } from './cgss-record-event.client';
import type { CgssSuiviRow, CgssEventRow } from '../_lib/queries-cgss-suivi';
import {
  CGSS_EVENT_LABEL,
  CGSS_MOTIF_FAMILLE_LABEL,
  CGSS_STATUS_LABEL,
  CGSS_STATUSES,
  type CgssStatus,
} from '../_lib/cgss-invoice-status';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

// Regroupement des statuts pour les sous-totaux (pied de table).
const GROUPS: { label: string; statuses: CgssStatus[] }[] = [
  { label: 'À télétransmettre', statuses: ['a_teletransmettre'] },
  {
    label: 'En attente',
    statuses: [
      'teletransmise',
      'reception_confirmee',
      'en_traitement_caisse',
      'partiellement_payee',
    ],
  },
  { label: 'Payées', statuses: ['payee'] },
  { label: 'Rejetées', statuses: ['rejet_technique', 'rejetee'] },
];

function buildColumns(
  eventsByRide: Record<string, CgssEventRow[]>,
): DataTableColumn<CgssSuiviRow>[] {
  return [
    {
      key: 'date',
      header: 'Réalisée le',
      width: '110px',
      cell: (r) => <span className="tabular-nums">{formatDate(r.ended_at)}</span>,
    },
    {
      key: 'patient',
      header: 'Patient',
      cell: (r) => `${r.patient_nom} ${r.patient_prenom}`.trim(),
    },
    { key: 'driver', header: 'Chauffeur', cell: (r) => r.driver_nom || '—' },
    { key: 'statut', header: 'Statut', cell: (r) => <CgssStatusBadge status={r.status} /> },
    {
      key: 'event',
      header: 'Dernier événement',
      cell: (r) =>
        r.last_event_type ? (
          <span className="text-muted-foreground text-sm">
            {CGSS_EVENT_LABEL[r.last_event_type]} · {formatDate(r.last_event_date)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'rejet',
      header: 'Motif de rejet',
      cell: (r) =>
        r.motif_famille ? (
          <span className="text-destructive text-sm">
            {CGSS_MOTIF_FAMILLE_LABEL[r.motif_famille]}
            {r.motif ? ` — ${r.motif}` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (r) => (
        <CgssRecordEvent
          rideId={r.id}
          patientLabel={`${r.patient_nom} ${r.patient_prenom}`.trim()}
          status={r.status}
          events={eventsByRide[r.id] ?? []}
        />
      ),
    },
  ];
}

export function CgssSuiviSection({
  rows,
  eventsByRide,
}: {
  rows: CgssSuiviRow[];
  eventsByRide: Record<string, CgssEventRow[]>;
}): JSX.Element {
  const [filter, setFilter] = React.useState<CgssStatus | 'all'>('all');

  const countByStatus = React.useMemo(() => {
    const m = {} as Record<CgssStatus, number>;
    for (const s of CGSS_STATUSES) m[s] = 0;
    for (const r of rows) m[r.status] += 1;
    return m;
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const columns = React.useMemo(() => buildColumns(eventsByRide), [eventsByRide]);
  const presentStatuses = CGSS_STATUSES.filter((s) => countByStatus[s] > 0);

  return (
    <section aria-labelledby="cgss-suivi-title" className="space-y-12">
      <div>
        <h2 id="cgss-suivi-title" className="text-lg font-semibold">
          Suivi des factures CGSS
        </h2>
        <p className="text-muted-foreground text-sm">
          Cycle de vie par transport (tiers payant). Suivi déclaratif : saisie manuelle des retours
          (télétransmission, ARL, NOEMIE). Aucun montant.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune facture CGSS sur la période"
          description="Aucune course terminée en tiers payant CGSS pur pour ce mois."
        />
      ) : (
        <>
          <div
            className="flex flex-wrap items-center gap-8"
            role="group"
            aria-label="Filtrer par statut"
          >
            <FilterChip selected={filter === 'all'} onClick={() => setFilter('all')}>
              Toutes ({rows.length})
            </FilterChip>
            {presentStatuses.map((s) => (
              <FilterChip key={s} selected={filter === s} onClick={() => setFilter(s)}>
                {CGSS_STATUS_LABEL[s]} ({countByStatus[s]})
              </FilterChip>
            ))}
          </div>

          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.id}
            ariaLabel="Factures CGSS par statut"
            footer={
              <tr>
                <td colSpan={7} className="px-12 py-12">
                  <div className="text-muted-foreground flex flex-wrap gap-x-24 gap-y-4 text-sm">
                    {GROUPS.map((g) => {
                      const n = g.statuses.reduce((acc, s) => acc + countByStatus[s], 0);
                      return (
                        <span key={g.label}>
                          {g.label} :{' '}
                          <span className="text-foreground font-semibold tabular-nums">{n}</span>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            }
          />
        </>
      )}
    </section>
  );
}
