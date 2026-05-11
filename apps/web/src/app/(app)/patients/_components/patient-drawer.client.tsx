'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getPatientByIdAction } from '../actions';
import {
  ConstraintsSection,
  CoordinatesSection,
  IdentitySection,
  NoteSection,
  PreferencesSection,
  type DrawerPatientShape,
} from './patient-drawer-sections.client';
import { NewRideForPatientButton } from './new-ride-for-patient-button.client';

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer fiche patient (D-12, D-14). Largeur exacte 400 px (acceptance E2E
 * `boundingBox.width === 400`). 6 blocs ordonnés : header → identité →
 * coordonnées → préférences → contraintes → note. Sections extraites en
 * sous-composants pour respecter la limite CLAUDE.md § 11 (≤ 150 lignes).
 */
export function PatientDrawer({ patientId, open, onOpenChange }: Props) {
  const { data, isPending } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatientByIdAction(patientId!),
    enabled: open && patientId !== null,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto"
      >
        {isPending || !data ? (
          <DrawerSkeleton />
        ) : (
          <DrawerBody data={data as unknown as DrawerPatientShape} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-16 pt-32" aria-label="Chargement de la fiche">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function DrawerBody({ data }: { data: DrawerPatientShape }) {
  return (
    <>
      <SheetHeader className="space-y-8">
        <div className="flex items-center gap-12">
          <div className="flex h-48 w-48 items-center justify-center rounded-full bg-primary/10 font-semibold text-base text-primary">
            {data.prenom.charAt(0)}
            {data.nom.charAt(0)}
          </div>
          <div>
            <SheetTitle className="text-2xl">
              {data.nom} {data.prenom}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-8">
              <Badge>{data.canal_contact_prefere}</Badge>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <IdentitySection d={data} />
      <CoordinatesSection d={data} />
      <PreferencesSection d={data} />
      <ConstraintsSection d={data} />
      <NoteSection d={data} />

      <div className="mt-32 flex flex-col gap-12 border-t border-border pt-16">
        <NewRideForPatientButton patientId={data.id} />
        <Link
          href={`/patients/${data.id}`}
          className="text-sm text-primary hover:underline"
        >
          Voir la fiche complète →
        </Link>
      </div>
    </>
  );
}
