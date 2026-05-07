/**
 * Tests unitaires `generatePatientDataExport` (Phase 1.5, DPA-04, RESEARCH §helper).
 *
 * Couvre 3 cas :
 *   1. Export contient format_version=1.0, exported_at ISO, patient sans NIR
 *      clair quand has_nir=false (pas d'appel Edge attendu).
 *   2. Export inclut operational_notes, constraintes, audit_log.
 *   3. Échec avec message FR si patient_id introuvable.
 *
 * État RED Wave 0 : `../patient-data-export` n'existe pas encore. Wave 1
 * livrera le helper qui consomme la vue patients_safe + tables liées.
 *
 * Mocking : SupabaseClient minimal fluent (pattern patient-note.test.ts).
 */
import { describe, it, expect } from 'vitest';

// Import RED — fichier sera créé en Wave 1
import { generatePatientDataExport } from '../patient-data-export';

interface MockResults {
  patient: { data: Record<string, unknown> | null; error: unknown };
  notes: { data: unknown[]; error: unknown };
  constraintes: { data: unknown[]; error: unknown };
  audits: { data: unknown[]; error: unknown };
}

function makeMock(results: MockResults) {
  const tableMap: Record<string, { data: unknown; error: unknown }> = {
    patients_safe: results.patient,
    patient_operational_note: results.notes,
    patient_constraint: results.constraintes,
    audit_logs: results.audits,
  };

  const builderFor = (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.single = async () => tableMap[table] ?? { data: null, error: null };
    builder.maybeSingle = async () =>
      tableMap[table] ?? { data: null, error: null };
    builder.then = (
      onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
    ) => Promise.resolve(tableMap[table] ?? { data: [], error: null }).then(onFulfilled);
    return builder;
  };

  return {
    from: (table: string) => builderFor(table),
  } as unknown as Parameters<typeof generatePatientDataExport>[0];
}

describe('generatePatientDataExport', () => {
  it('exporte format_version 1.0 + exported_at ISO + patient sans NIR clair sans appel Edge', async () => {
    const supabase = makeMock({
      patient: {
        data: {
          id: 'pat-1',
          prenom: 'Marie',
          nom: 'Hoarau',
          has_nir: false,
        },
        error: null,
      },
      notes: { data: [], error: null },
      constraintes: { data: [], error: null },
      audits: { data: [], error: null },
    });

    const exportData = await generatePatientDataExport(supabase, 'pat-1');
    expect(exportData.format_version).toBe('1.0');
    expect(typeof exportData.exported_at).toBe('string');
    expect(new Date(exportData.exported_at).toISOString()).toBe(
      exportData.exported_at,
    );
    expect((exportData.patient as { nir?: unknown }).nir ?? null).toBeNull();
  });

  it('inclut operational_notes, constraintes, audit_log dans la réponse', async () => {
    const supabase = makeMock({
      patient: {
        data: { id: 'pat-1', prenom: 'Marie', nom: 'Hoarau', has_nir: false },
        error: null,
      },
      notes: { data: [{ id: 'n1', content: 'Note 1' }], error: null },
      constraintes: { data: [{ id: 'c1', type: 'mobilite' }], error: null },
      audits: { data: [{ id: 'a1', action: 'patient.insert' }], error: null },
    });

    const exportData = await generatePatientDataExport(supabase, 'pat-1');
    expect(exportData.operational_notes).toHaveLength(1);
    expect(exportData.constraintes).toHaveLength(1);
    expect(exportData.audit_log).toHaveLength(1);
  });

  it('échoue avec message FR si patient_id introuvable', async () => {
    const supabase = makeMock({
      patient: { data: null, error: { message: 'No rows' } },
      notes: { data: [], error: null },
      constraintes: { data: [], error: null },
      audits: { data: [], error: null },
    });

    await expect(
      generatePatientDataExport(supabase, 'inconnu'),
    ).rejects.toThrow(/(introuvable|inconnu|trouvé)/i);
  });
});
