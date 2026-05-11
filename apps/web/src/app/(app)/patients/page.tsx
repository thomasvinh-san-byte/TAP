import Link from 'next/link';
import { Plus } from 'lucide-react';
import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from '@tanstack/react-query';
import { searchPatients } from './queries';
import { PatientsList } from './_components/patients-list.client';
import { Button } from '@/components/ui/button';
import { HeaderNewRideButton } from '../courses/_components/header-new-ride-button.client';

export const metadata = { title: 'Patients — TAP Régulation' };

/**
 * RSC liste patients (PAT-01, PAT-04).
 *
 * Pré-fetch côté serveur puis hydratation pour éviter le flash de chargement
 * vide au premier rendu (cf. RESEARCH.md §RSC + HydrationBoundary). La
 * recherche fuzzy est gérée côté client par `<PatientsList>` avec
 * `useDeferredValue` (debounce React natif).
 */
export default async function PatientsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['patients', { q: '' }],
    queryFn: () => searchPatients(''),
  });

  return (
    <div className="space-y-24">
      <header className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <div className="flex flex-col gap-12 md:flex-row md:items-center">
          <HeaderNewRideButton />
          <Button asChild variant="default">
            <Link href="/patients/new">
              <Plus className="mr-8 h-16 w-16" aria-hidden />
              Nouveau patient
            </Link>
          </Button>
        </div>
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PatientsList />
      </HydrationBoundary>
    </div>
  );
}
