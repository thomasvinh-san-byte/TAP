import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { BackfillGeocoding } from './_components/backfill-geocoding.client';
import { RecomputeTarifs } from './_components/recompute-tarifs.client';

export const metadata = { title: 'Maintenance — TAP Admin' };

/**
 * Page maintenance opérations ponctuelles dirigeant.
 *
 * Phase 04.7 : bouton « Re-géocoder courses sans coordonnées » qui
 * appelle backfillRideGeocodingAction (Phase 04.7 PLAN-3 T3.3, DEC-044).
 *
 * Phase 06 future : autres opérations admin (audit RLS, anonymisation
 * RGPD ponctuelle, etc.).
 */
export default async function MaintenancePage() {
  await requireDirigeantPage();
  return (
    <div className="max-w-[720px] space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <p className="text-muted-foreground text-sm">
          Opérations ponctuelles sur les données. Réservé au dirigeant.
        </p>
      </header>

      <section className="border-border space-y-12 rounded-md border p-16">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Géocoding rides</h2>
          <p className="text-muted-foreground text-xs">
            Re-géocode les courses créées avant la migration géocoding (Phase 04.7). Idempotent : ne
            touche que les rides sans coordonnées. Rate-limit 1 req/s sur l'API BAN gouv.fr.
          </p>
        </div>
        <BackfillGeocoding />
      </section>

      <section className="border-border space-y-12 rounded-md border p-16">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Recalcul des tarifs</h2>
          <p className="text-muted-foreground text-xs">
            Recalcule le tarif des courses calculées automatiquement, selon la grille tarifaire
            active. Les tarifs saisis manuellement et les courses déjà encaissées sont préservés.
          </p>
        </div>
        <RecomputeTarifs />
      </section>
    </div>
  );
}
