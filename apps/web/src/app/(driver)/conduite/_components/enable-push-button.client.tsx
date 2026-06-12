'use client';

import * as React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { savePushSubscriptionAction, deletePushSubscriptionAction } from '../push-actions';

/**
 * Activation des notifications push (PWA chauffeur, DEC-167).
 *
 * UX (sourcé) : on NE demande PAS la permission à froid au chargement — le
 * chauffeur clique explicitement « Activer les notifications ». Au clic :
 * permission → abonnement pushManager → enregistrement Server Action.
 * Désactivation : `unsubscribe()` + suppression côté serveur.
 *
 * Rendu UNIQUEMENT si le navigateur supporte le push ET si la clé VAPID
 * publique est configurée (sinon la fonctionnalité n'existe pas).
 */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function EnablePushButton(): JSX.Element | null {
  const [supported, setSupported] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      return;
    }
    setSupported(true);
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(sub !== null))
      .catch(() => {
        /* lecture impossible — état par défaut non abonné */
      });
  }, []);

  async function enable(): Promise<void> {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notifications refusées. Activez-les dans les réglages du navigateur.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
      });
      const json = sub.toJSON();
      const keys = json.keys ?? {};
      const res = await savePushSubscriptionAction({
        endpoint: sub.endpoint,
        p256dh: keys.p256dh ?? '',
        auth: keys.auth ?? '',
        userAgent: navigator.userAgent,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSubscribed(true);
      toast.success('Notifications activées.');
    } catch {
      toast.error('Activation impossible.');
    } finally {
      setPending(false);
    }
  }

  async function disable(): Promise<void> {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Notifications désactivées.');
    } catch {
      toast.error('Désactivation impossible.');
    } finally {
      setPending(false);
    }
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void (subscribed ? disable() : enable())}
      disabled={pending}
      className="min-h-[56px] w-full gap-8 text-base"
    >
      {subscribed ? (
        <>
          <BellOff className="h-20 w-20" aria-hidden />
          Désactiver les notifications
        </>
      ) : (
        <>
          <Bell className="h-20 w-20" aria-hidden />
          Activer les notifications
        </>
      )}
    </Button>
  );
}
