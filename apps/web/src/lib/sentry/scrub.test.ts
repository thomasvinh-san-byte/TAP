import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { sentryBeforeSend } from './scrub';

function event(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

describe('sentryBeforeSend — anti-PII santé (DEC-097)', () => {
  it('scrub les clés sensibles dans extra', () => {
    const e = event({
      extra: {
        nir: '1234567890123',
        nom: 'X',
        prenom: 'Y',
        date_naissance: '1980-01-01',
        adresse_ligne1: '12 rue ...',
        request_id: 'safe',
      },
    });
    const out = sentryBeforeSend(e);
    expect(out?.extra?.nir).toBe('[Filtered]');
    expect(out?.extra?.nom).toBe('[Filtered]');
    expect(out?.extra?.prenom).toBe('[Filtered]');
    expect(out?.extra?.date_naissance).toBe('[Filtered]');
    expect(out?.extra?.adresse_ligne1).toBe('[Filtered]');
    expect(out?.extra?.request_id).toBe('safe');
  });

  it('scrub récursivement les sous-objets', () => {
    const e = event({
      extra: {
        patient: { nir: '12345', nom: 'X', age: 42 },
        meta: { version: '1.0' },
      },
    });
    const out = sentryBeforeSend(e);
    expect((out?.extra?.patient as Record<string, unknown>).nir).toBe('[Filtered]');
    expect((out?.extra?.patient as Record<string, unknown>).nom).toBe('[Filtered]');
    expect((out?.extra?.patient as Record<string, unknown>).age).toBe(42);
    expect((out?.extra?.meta as Record<string, unknown>).version).toBe('1.0');
  });

  it("retire la query string de l'URL request", () => {
    const e = event({
      request: { url: 'https://app.tap/patients?id=abc&q=hoarau' },
    });
    const out = sentryBeforeSend(e);
    expect(out?.request?.url).toBe('https://app.tap/patients');
  });

  it('filtre cookie / authorization headers', () => {
    const e = event({
      request: {
        url: 'https://x',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'sb-...=secret',
          Authorization: 'Bearer x',
          'X-Supabase-Auth': 'jwt-secret',
        },
      },
    });
    const out = sentryBeforeSend(e);
    expect(out?.request?.headers?.Cookie).toBe('[Filtered]');
    expect(out?.request?.headers?.Authorization).toBe('[Filtered]');
    expect(out?.request?.headers?.['X-Supabase-Auth']).toBe('[Filtered]');
    expect(out?.request?.headers?.['Content-Type']).toBe('application/json');
  });

  it("ne garde que l'id auth dans user, jamais email/nom", () => {
    const e = event({
      user: { id: 'user-uuid', email: 'a@b.fr', username: 'X', ip_address: '127.0.0.1' },
    });
    const out = sentryBeforeSend(e);
    expect(out?.user).toEqual({ id: 'user-uuid' });
  });

  it('scrub breadcrumbs (data + message URL)', () => {
    const e = event({
      breadcrumbs: [
        {
          category: 'fetch',
          message: 'GET https://x/patients?id=abc',
          data: { nir: '12345', method: 'GET' },
        },
      ],
    });
    const out = sentryBeforeSend(e);
    expect(out?.breadcrumbs?.[0]?.data?.nir).toBe('[Filtered]');
    expect(out?.breadcrumbs?.[0]?.message).toBe('GET https://x/patients');
  });
});
