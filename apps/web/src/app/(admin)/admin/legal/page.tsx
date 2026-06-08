import Link from 'next/link';
import {
  ClipboardCheck,
  FileSignature,
  FileText,
  Inbox,
  ShieldAlert,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Conformité RGPD' };

/**
 * Hub /admin/legal — page d'accueil explicative de l'espace conformité RGPD.
 *
 * Couche « pour humains » au-dessus de formulaires juridiquement rigoureux :
 * chaque carte vulgarise une obligation (langage clair, art. 12 RGPD) sans
 * altérer le fonctionnement des sous-pages.
 */

interface LegalCard {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  ref: string;
}

const LEGAL_CARDS: LegalCard[] = [
  {
    href: '/admin/legal/registre',
    icon: FileText,
    title: 'Registre des traitements',
    description:
      'Recensez quelles données patients vous utilisez et pourquoi. ' +
      "C'est la première chose qu'un contrôle vous demandera.",
    ref: 'RGPD art. 30',
  },
  {
    href: '/admin/legal/breaches',
    icon: ShieldAlert,
    title: 'Violations de données',
    description:
      'Une donnée patient a fuité, été perdue ou volée ? Déclarez-le ici : ' +
      'vous avez 72 h pour prévenir la CNIL, le compte à rebours vous aide.',
    ref: 'RGPD art. 33',
  },
  {
    href: '/admin/legal/dpa',
    icon: FileSignature,
    title: 'DPA sous-traitants',
    description:
      'Vos prestataires qui voient les données patients (hébergeur, ' +
      'logiciels…) doivent signer un contrat. Conservez-les ici.',
    ref: 'RGPD art. 28',
  },
  {
    href: '/admin/legal/dpia',
    icon: ClipboardCheck,
    title: "Analyses d'impact (DPIA)",
    description:
      'Vous transportez des patients, donc des données de santé sensibles. ' +
      'Cette analyse montre que vous avez identifié les risques.',
    ref: 'RGPD art. 35',
  },
  {
    href: '/admin/legal/dpo',
    icon: UserCog,
    title: 'Contact DPO',
    description:
      'La personne à contacter pour les questions de données. Ses ' +
      "coordonnées s'affichent automatiquement sur votre site public.",
    ref: 'RGPD art. 37-39',
  },
  {
    href: '/admin/legal/requests',
    icon: Inbox,
    title: 'Demandes RGPD patients',
    description:
      'Un patient veut consulter ou faire effacer ses données ? Suivez sa ' +
      'demande ici. Vous devez lui répondre sous 30 jours.',
    ref: 'RGPD art. 15-21',
  },
];

export default async function LegalHubPage(): Promise<JSX.Element> {
  await requireDirigeantPage();

  return (
    <div className="space-y-24">
      <PageHeader
        title="Conformité RGPD"
        description="Protéger les données de vos patients est une obligation légale. Chaque section ci-dessous couvre une de vos obligations : cliquez pour voir de quoi il s'agit et ce que vous devez faire."
      />

      <div className="grid gap-16 sm:grid-cols-2">
        {LEGAL_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="border-border bg-background hover:border-foreground/30 hover:bg-muted/30 focus-visible:ring-ring group flex flex-col gap-8 rounded-lg border p-16 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <div className="flex items-center gap-8">
                <Icon
                  className="text-muted-foreground group-hover:text-foreground h-16 w-16 transition-colors"
                  aria-hidden
                />
                <span className="text-foreground text-sm font-semibold">{card.title}</span>
              </div>
              <p className="text-muted-foreground text-sm">{card.description}</p>
              <span className="text-muted-foreground mt-auto text-xs">{card.ref}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
