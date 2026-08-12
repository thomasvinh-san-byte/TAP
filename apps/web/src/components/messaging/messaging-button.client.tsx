'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users } from 'lucide-react';
import { getUnreadMessageCountAction } from '@/lib/messaging/actions';
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
 * Badge de non-lus (§5.22 lot 2) en SUR-IMPRESSION (`absolute -top-1 -right-1`,
 * ne décale pas la largeur). Compteur rafraîchi par sondage (`refetchInterval`)
 * + au retour de focus ; alimenté par la RPC `count_unread_messages` (RLS
 * org+rôle → exact et cloisonné). Push PWA : non câblé (registre §1.3).
 * Push PWA : non câblé (registre §1.3).
 */
export function MessagingButton(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: () => getUnreadMessageCountAction(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
  const unread = data?.count ?? 0;
  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Messagerie — ${unread} message(s) non lu(s)` : 'Messagerie'}
          className="relative"
        >
          <MessageSquare className="h-16 w-16" aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full px-2 text-[10px] font-semibold tabular-nums leading-[16px]"
            >
              {badgeLabel}
            </span>
          )}
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
