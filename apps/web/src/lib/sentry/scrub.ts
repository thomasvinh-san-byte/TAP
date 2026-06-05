/**
 * Phase 06.20 (DEC-097) — Scrubbing anti-PII santé.
 *
 * CONTRAINTE CRITIQUE : TAP manipule des données de santé indirectes.
 * Sentry ne doit JAMAIS recevoir de PII patient (NIR, nom, prénom,
 * adresse, téléphone, email, dates de naissance).
 *
 * Cette fonction est appelée AVANT envoi par les 3 runtimes
 * (client / server / edge). Elle :
 *   1. Retire la query string des URLs (peut contenir `patient_id`).
 *   2. Scrub récursif des extras / contexts / breadcrumbs pour les clés
 *      sensibles (`nir`, `nir_encrypted`, `nom`, `prenom`, `adresse_*`,
 *      `telephone`, `email`, `date_naissance`).
 *   3. Tronque les valeurs string longues qui ressembleraient à un
 *      payload patient sérialisé.
 *
 * En cas de doute, on REMPLACE la valeur par '[Filtered]' — jamais on
 * ne renvoie une valeur partielle (pas de mid-mask, c'est trop fragile
 * pour les NIR / numéros INSEE).
 */

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const SENSITIVE_KEY_PATTERN =
  /^(nir|nir_encrypted|nir_last4|nir_search_hash|nom|prenom|adresse|adresse_ligne1|adresse_ligne2|telephone|telephone_normalized|email|date_naissance|contact_urgence_nom|contact_urgence_telephone|password|password_hash|access_token|refresh_token|service_role_key)$/i;

const FILTERED = '[Filtered]';

function scrubValue(value: unknown, depth: number = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = FILTERED;
      } else {
        out[k] = scrubValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Retire la query string : peut contenir patient_id, search, etc.
  return url.split('?')[0];
}

export function sentryBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // Request URL.
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    if (event.request.query_string) {
      event.request.query_string = FILTERED;
    }
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data) as typeof event.request.data;
    }
    if (event.request.headers) {
      // Headers : retirer cookies + authorization en plus.
      const safeHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.request.headers)) {
        const lk = k.toLowerCase();
        if (lk === 'cookie' || lk === 'authorization' || lk === 'x-supabase-auth') {
          safeHeaders[k] = FILTERED;
        } else {
          safeHeaders[k] = typeof v === 'string' ? v : String(v);
        }
      }
      event.request.headers = safeHeaders;
    }
  }

  // Extras + contexts.
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (event.tags) event.tags = scrubValue(event.tags) as typeof event.tags;

  // Breadcrumbs (peuvent venir d'un fetch() avec body patient).
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrubValue(b.data) as typeof b.data) : b.data,
      message: b.message ? (scrubUrl(b.message) ?? b.message) : b.message,
    }));
  }

  // User : ne JAMAIS conserver l'identité Supabase. On garde l'id auth
  // uniquement (utile pour corréler sans révéler de PII).
  if (event.user) {
    event.user = { id: event.user.id ?? undefined };
  }

  return event;
}
