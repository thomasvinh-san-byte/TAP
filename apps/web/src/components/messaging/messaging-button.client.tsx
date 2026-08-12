'use client';

import Link from 'next/link';
import { MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Point d'accès messagerie du header (Phase 06.62, DEC-141 — CdC §5.22).
 *
 * ÉCHAFAUDAGE derrière le release toggle `MESSAGING_ENABLED` (évalué côté
 * serveur dans `(app)/layout.tsx` : ce composant n'est MONTÉ que si le flag est
 * ON ; OFF par défaut en prod = rien dans le header). Coquille « en attente
 * d'infra », PAS un mock : on n'invente ni conversations ni compteur.
 *
 * - (a) Conversations de course : le chat vit dans chaque course (germe lot 1,
 *   `internal_message`/`ride-chat`). On y donne un accès navigationnel — on ne
 *   fabrique pas de liste de conversations (pas de logique data nouvelle).
 * - (b) Fil général (hors course, §5.22 lot A) : fil commun de l'organisation,
 *   temps réel, org-scoped, archivé 1 an → lien vers `/messagerie`.
 *
 * Push PWA : non câblé (registre §1.3).
 */
export function MessagingButton(): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Messagerie"
          className="relative"
        >
          <MessageSquare className="h-16 w-16" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>Messagerie</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-8 py-8">
          <p className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
            Conversations de course
          </p>
          <DropdownMenuItem asChild>
            <Link href="/courses">Ouvrir une course pour discuter</Link>
          </DropdownMenuItem>
          <p className="text-muted-foreground mt-4 px-8 text-xs leading-[1.4]">
            Le chat se déroule dans chaque course (régulateur ↔ chauffeur).
          </p>
        </div>

        <DropdownMenuSeparator />

        <div className="px-8 py-8">
          <p className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
            Fil général
          </p>
          <DropdownMenuItem asChild>
            <Link href="/messagerie">
              <Users className="mr-8 h-16 w-16" aria-hidden />
              Ouvrir le fil général
            </Link>
          </DropdownMenuItem>
          <p className="text-muted-foreground mt-4 px-8 text-xs leading-[1.4]">
            Discussion commune de l&apos;organisation, hors course.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
