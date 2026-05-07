'use client';

/**
 * Helpers de persistance du consentement cookies (CNIL-conforme).
 *
 * Stockage `localStorage.cookieConsent` au format
 * `{ version, choices, expires_at }`. Durée 6 mois (recommandation CNIL).
 * Le bandeau réapparaît si :
 * - le consentement n'existe pas,
 * - sa version diffère (rotation des finalités),
 * - sa date d'expiration est dépassée.
 */

export type CookieChoices = {
  technique: true; // strictement nécessaires — toujours actifs
  analytics: boolean;
  marketing: boolean;
};

type StoredConsent = {
  version: '1';
  choices: CookieChoices;
  expires_at: string; // ISO 8601
};

const STORAGE_KEY = 'cookieConsent';
const CONSENT_VERSION = '1';
const CONSENT_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 mois

export function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (new Date(parsed.expires_at).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(choices: CookieChoices): void {
  const stored: StoredConsent = {
    version: CONSENT_VERSION,
    choices,
    expires_at: new Date(Date.now() + CONSENT_TTL_MS).toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function resetCookieConsent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  // Notifie le bandeau pour réapparaître sans recharger la page.
  window.dispatchEvent(new CustomEvent('cookie-consent-reset'));
}
