/**
 * Tests unitaires `replacePatientNote` (B-1, D-18).
 *
 * Couvre 3 cas :
 *  1. Contenu identique → no-op (pas d'INSERT).
 *  2. Pas de note active → 1 INSERT, pas d'UPDATE.
 *  3. Note active différente → 1 INSERT + 1 UPDATE replaced_by_id.
 *
 * Mocking : un `SupabaseClient` minimal sous forme de fluent builder dont
 * on enregistre les appels et la séquence de réponses pour `.maybeSingle()`,
 * `.single()`, `.update()` etc.
 */
import { describe, it, expect, vi } from 'vitest';
import { replacePatientNote } from '../patient-note';

interface CallLog {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  filters?: Record<string, unknown>;
}

function makeMock(opts: { activeNote: { id: string; content: string } | null }) {
  const calls: CallLog[] = [];

  const builderFor = (table: string) => {
    const ctx: {
      op: 'select' | 'insert' | 'update' | null;
      payload?: unknown;
      filters: Record<string, unknown>;
    } = {
      op: null,
      filters: {},
    };

    const builder: Record<string, unknown> = {};
    builder.select = (..._cols: unknown[]) => {
      ctx.op = ctx.op ?? 'select';
      return builder;
    };
    builder.insert = (payload: unknown) => {
      ctx.op = 'insert';
      ctx.payload = payload;
      return builder;
    };
    builder.update = (payload: unknown) => {
      ctx.op = 'update';
      ctx.payload = payload;
      return builder;
    };
    builder.eq = (k: string, v: unknown) => {
      ctx.filters[k] = v;
      return builder;
    };
    builder.is = (k: string, v: unknown) => {
      ctx.filters[`${k}_is`] = v;
      return builder;
    };

    builder.maybeSingle = async () => {
      calls.push({ table, op: 'select', filters: { ...ctx.filters } });
      return {
        data: opts.activeNote ? { ...opts.activeNote, organization_id: 'org-1' } : null,
        error: null,
      };
    };
    builder.single = async () => {
      if (ctx.op === 'insert') {
        calls.push({ table, op: 'insert', payload: ctx.payload });
        return { data: { id: 'new-note-id' }, error: null };
      }
      calls.push({ table, op: 'select', filters: { ...ctx.filters } });
      return { data: null, error: null };
    };

    // `.update().eq()` n'a pas besoin d'await final dans replacePatientNote :
    // on lit la promise via le proxy. On simule en faisant que le builder
    // soit thenable une fois eq() appelé sur une UPDATE.
    const origEq = builder.eq;
    builder.eq = (k: string, v: unknown) => {
      ctx.filters[k] = v;
      if (ctx.op === 'update') {
        calls.push({ table, op: 'update', payload: ctx.payload, filters: { ...ctx.filters } });
        // Retourne un thenable pour que `await supabase.from().update().eq()` résolve.
        return Promise.resolve({ data: null, error: null }) as unknown as typeof builder;
      }
      return (origEq as (k: string, v: unknown) => typeof builder).call(builder, k, v);
    };

    return builder;
  };

  return {
    supabase: { from: (table: string) => builderFor(table) } as unknown as Parameters<
      typeof replacePatientNote
    >[0],
    calls,
  };
}

describe('replacePatientNote', () => {
  it('no-op si contenu identique', async () => {
    const { supabase, calls } = makeMock({
      activeNote: { id: 'old', content: 'same content' },
    });
    await replacePatientNote(supabase, 'pat-1', 'same content', 'usr-1');
    const inserts = calls.filter((c) => c.op === 'insert');
    const updates = calls.filter((c) => c.op === 'update');
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('insert pur si pas de note active', async () => {
    const { supabase, calls } = makeMock({ activeNote: null });
    await replacePatientNote(supabase, 'pat-1', 'first note', 'usr-1');
    const inserts = calls.filter((c) => c.op === 'insert');
    const updates = calls.filter((c) => c.op === 'update');
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(0);
    expect(inserts[0]?.payload).toMatchObject({
      patient_id: 'pat-1',
      content: 'first note',
      author_id: 'usr-1',
    });
  });

  it('insert + update replaced_by_id si note active différente', async () => {
    const { supabase, calls } = makeMock({
      activeNote: { id: 'old', content: 'old content' },
    });
    await replacePatientNote(supabase, 'pat-1', 'new content', 'usr-1');
    const inserts = calls.filter((c) => c.op === 'insert');
    const updates = calls.filter((c) => c.op === 'update');
    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toMatchObject({ replaced_by_id: 'new-note-id' });
    expect(updates[0]?.filters).toMatchObject({ id: 'old' });
  });
});

// Évite l'avertissement Vitest sur l'absence d'utilisation de `vi`.
void vi;
