import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Patron de layout de formulaire PARTAGÉ (Phase 06.51, DEC-130).
 *
 * Encode la doctrine formulaire (`.planning/doctrine-formulaires.md`) :
 * formulaires de back-office (saisie pro répétée) en 2 colonnes « tout
 * visible » pour relire/contrôler d'un coup ; lecture LIGNE PAR LIGNE
 * gauche→droite (anti-saut de champ Baymard) ; échelle d'espacement unique ;
 * barre d'action en bas. Réutilisable patient / véhicule / chauffeur.
 *
 * Composants présentationnels (server-safe, aucune logique).
 */

/** Conteneur 2 colonnes responsive (1 colonne < lg). Souple : si une seule
 *  `FormColumn` est passée, le formulaire reste sur une colonne. */
export function FormColumns({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <div className={cn('grid gap-24 lg:grid-cols-2', className)}>{children}</div>;
}

/** Une colonne = pile verticale de `FormSection` (section-gap unique). */
export function FormColumn({ children }: { children: ReactNode }): JSX.Element {
  return <div className="space-y-24">{children}</div>;
}

/** Section thématique : titre (xs uppercase muted) + champs (field-gap unique). */
export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {title}
      </h2>
      <div className="space-y-12">{children}</div>
    </section>
  );
}

/** Ligne de champs liés, lus gauche→droite (ex. Nom/Prénom, Date/Sexe). */
export function FormRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <div className={cn('grid grid-cols-2 gap-12', className)}>{children}</div>;
}

/** Barre d'action en bas : filet séparateur, boutons alignés à droite. */
export function FormActions({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="border-border flex items-center justify-end gap-12 border-t pt-16">
      {children}
    </div>
  );
}
