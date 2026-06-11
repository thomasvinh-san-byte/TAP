import { PageHeader } from '@/components/page-header';
import { getCockpitAlertPreferences } from '@/lib/notifications/preferences';
import { NotificationSettings } from './_components/notification-settings.client';

export const metadata = { title: 'Réglages' };
export const dynamic = 'force-dynamic';

/**
 * Page Réglages utilisateur (DEC-149).
 *
 * Section Notifications → Alertes du cockpit : 3 préférences par utilisateur
 * qui pilotent l'AFFICHAGE des alertes in-app du cockpit (effet immédiat au
 * prochain rendu de /cockpit). Portée par utilisateur (norme SaaS).
 *
 * NB : aucune section email/push tant que le canal n'est pas branché (norme
 * MVP : pas de commande inactive). La section email s'ajoutera ici AVEC
 * EMAIL_ENABLED (table notification_preferences étendue — registre §1.2).
 *
 * Le guard d'accès est assuré par `(app)/layout.tsx` (session + rôle
 * dirigeant/régulateur ; chauffeur redirigé vers /conduite).
 */
export default async function ReglagesPage() {
  const preferences = await getCockpitAlertPreferences();

  return (
    <div className="mx-auto max-w-[640px] space-y-24">
      <PageHeader
        title="Réglages"
        description="Personnalisez votre expérience. Ces préférences ne s'appliquent qu'à votre compte."
      />
      <NotificationSettings initial={preferences} />
    </div>
  );
}
