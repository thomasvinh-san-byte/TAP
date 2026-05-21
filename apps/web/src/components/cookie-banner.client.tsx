'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { readConsent, writeConsent, type CookieChoices } from '@/lib/cookie-consent';

/**
 * Bandeau cookies CNIL-conforme (D-14, DPA-08).
 *
 * Trois boutons strictement équivalents (taille, padding, variant) :
 * « Tout refuser », « Personnaliser », « Tout accepter ». Anti
 * dark-pattern : la CNIL sanctionne l'asymétrie depuis 2024.
 * Persistance localStorage 6 mois + audit log via /api/legal/cookie-consent.
 */

const ALL_REFUSED: CookieChoices = {
  technique: true,
  analytics: false,
  marketing: false,
};
const ALL_ACCEPTED: CookieChoices = {
  technique: true,
  analytics: true,
  marketing: false, // marketing non utilisé V1
};

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choices, setChoices] = useState<CookieChoices>(ALL_REFUSED);

  useEffect(() => {
    setOpen(!readConsent());
    const handler = () => {
      setCustomizing(false);
      setChoices(ALL_REFUSED);
      setOpen(true);
    };
    window.addEventListener('cookie-consent-reset', handler);
    return () => window.removeEventListener('cookie-consent-reset', handler);
  }, []);

  if (!open) return null;

  const submit = async (final: CookieChoices) => {
    writeConsent(final);
    try {
      await fetch('/api/legal/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices: final }),
      });
    } catch {
      // Best-effort serveur : le consentement local fait foi pour l'UX.
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Préférences cookies"
      aria-describedby="cookie-banner-desc"
      className="bg-background fixed inset-x-0 bottom-0 z-50 border-t shadow-lg"
    >
      <div className="mx-auto max-w-[1200px] px-24 py-24">
        <p id="cookie-banner-desc" className="mb-16 text-sm">
          Nous utilisons des cookies pour assurer le fonctionnement de l'application et mesurer son
          usage de manière agrégée. Vous pouvez accepter, refuser ou personnaliser votre choix. Vos
          préférences sont conservées 6 mois.
        </p>
        {customizing ? (
          <CustomizePanel
            choices={choices}
            onChange={setChoices}
            onValidate={() => submit(choices)}
          />
        ) : (
          <div className="flex gap-12">
            <Button
              variant="outline"
              className="h-44 flex-1"
              onClick={() => submit(ALL_REFUSED)}
              data-testid="cookie-refuse"
            >
              Tout refuser
            </Button>
            <Button
              variant="outline"
              className="h-44 flex-1"
              onClick={() => setCustomizing(true)}
              data-testid="cookie-customize"
            >
              Personnaliser
            </Button>
            <Button
              variant="outline"
              className="h-44 flex-1"
              onClick={() => submit(ALL_ACCEPTED)}
              data-testid="cookie-accept"
            >
              Tout accepter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type PanelProps = {
  choices: CookieChoices;
  onChange: (c: CookieChoices) => void;
  onValidate: () => void;
};

function CustomizePanel({ choices, onChange, onValidate }: PanelProps) {
  return (
    <div className="space-y-12">
      <label className="flex items-start gap-12 text-sm">
        <input type="checkbox" checked disabled aria-label="Cookies techniques (obligatoires)" />
        <span>
          <strong>Techniques</strong> : session, authentification (obligatoires).
        </span>
      </label>
      <label className="flex items-start gap-12 text-sm">
        <input
          type="checkbox"
          checked={choices.analytics}
          onChange={(e) => onChange({ ...choices, analytics: e.target.checked })}
        />
        <span>
          <strong>Mesure d'audience</strong> : Sentry (anonymisé).
        </span>
      </label>
      <label className="text-muted-foreground flex items-start gap-12 text-sm">
        <input
          type="checkbox"
          checked={false}
          disabled
          aria-label="Marketing : non utilisé en V1"
        />
        <span>
          <strong>Marketing</strong> : non utilisé dans cette version.
        </span>
      </label>
      <Button variant="outline" className="h-44" onClick={onValidate}>
        Valider mes choix
      </Button>
    </div>
  );
}
