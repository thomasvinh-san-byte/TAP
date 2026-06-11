'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import type { CockpitAlertPreferences } from '@/lib/notifications/preferences';
import { updateNotificationPreferencesAction } from '../actions';

interface Props {
  initial: CockpitAlertPreferences;
}

type AlertKey = keyof CockpitAlertPreferences;

const ALERT_ROWS: { key: AlertKey; label: string; description: string }[] = [
  {
    key: 'patient_no_show',
    label: 'Patient absent',
    description: "Le patient ne s'est pas présenté au point de prise en charge.",
  },
  {
    key: 'sms_failed',
    label: "Échec d'envoi SMS",
    description: "Un SMS de rappel ou de notification patient n'a pas pu être envoyé.",
  },
  {
    key: 'ride_delayed',
    label: 'Course en retard',
    description: 'Une course accuse un retard sur son horaire prévu.',
  },
];

/**
 * Réglages — section Notifications → Alertes du cockpit (DEC-149).
 *
 * 3 préférences par utilisateur, sauvegarde AU CHANGEMENT (optimiste + toast) :
 * chaque bascule envoie l'état complet des 3 familles à la Server Action. En
 * cas d'échec, on restaure l'état précédent. Désactiver une famille la masque
 * du panel cockpit (effet visible au prochain rendu de /cockpit).
 *
 * Pas de section email/push : canal non branché → pas de commande inactive
 * (norme MVP). La section email s'ajoutera ici avec EMAIL_ENABLED.
 */
export function NotificationSettings({ initial }: Props): JSX.Element {
  const [prefs, setPrefs] = React.useState<CockpitAlertPreferences>(initial);
  const [isPending, startTransition] = React.useTransition();

  const toggle = (key: AlertKey) => {
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimiste
    startTransition(async () => {
      const res = await updateNotificationPreferencesAction(next);
      if (res.error) {
        setPrefs(previous); // restauration
        toast.error(res.error);
        return;
      }
      toast.success('Préférence enregistrée.');
    });
  };

  return (
    <section className="border-border bg-background space-y-4 rounded-lg border p-24">
      <header className="mb-12 space-y-4">
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-muted-foreground text-sm">
          Choisissez les alertes du cockpit que vous souhaitez voir s&apos;afficher.
        </p>
      </header>

      <h3 className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
        Alertes du cockpit
      </h3>

      <ul className="divide-border divide-y">
        {ALERT_ROWS.map((row) => {
          const inputId = `alert-${row.key}`;
          return (
            <li key={row.key}>
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-center justify-between gap-16 py-12"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{row.label}</span>
                  <span className="text-muted-foreground block text-xs">{row.description}</span>
                </span>
                <Checkbox
                  id={inputId}
                  checked={prefs[row.key]}
                  onChange={() => toggle(row.key)}
                  disabled={isPending}
                  aria-label={row.label}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
