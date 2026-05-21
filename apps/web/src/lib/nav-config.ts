/**
 * Source unique de vérité de la navigation principale.
 *
 * La barre d'onglets dépend du RÔLE, jamais de la page. Les deux layouts —
 * `(app)/layout.tsx` et `(admin)/layout.tsx` — importent ces listes pour que
 * la nav soit identique partout (plus de « danse d'onglets » en naviguant
 * entre une page (app) et une page (admin)).
 *
 * Les routes ne sont pas déplacées : seule la liste d'onglets est unifiée.
 * Le déplacement physique `/admin/*` → `/` est un refactor reporté.
 */

export interface NavTab {
  href: string;
  label: string;
}

// Nav régulateur : identique sur (app) ET (admin).
export const REGULATEUR_TABS: NavTab[] = [
  { href: '/cockpit', label: 'Cockpit' },
  { href: '/patients', label: 'Patients' },
  { href: '/courses', label: 'Courses' },
  { href: '/courses/caisse', label: 'Caisse' },
  { href: '/admin/chauffeurs', label: 'Chauffeurs' },
];

// Nav dirigeant : identique sur (app) ET (admin). Reprend la nav régulateur
// + les outils admin. « Légal ▾ » est rendu séparément via <LegalNavMenu />.
export const DIRIGEANT_TABS: NavTab[] = [
  ...REGULATEUR_TABS,
  { href: '/admin/vehicules', label: 'Véhicules' },
  { href: '/admin/tarifs', label: 'Tarifs' },
  { href: '/admin/facturation', label: 'Facturation' },
  { href: '/admin/maintenance', label: 'Maintenance' },
];

// Helper : la liste d'onglets selon le rôle (chauffeur n'arrive jamais ici —
// il est redirigé vers /conduite par les guards de layout).
export function tabsForRole(role: string): NavTab[] {
  return role === 'dirigeant' ? DIRIGEANT_TABS : REGULATEUR_TABS;
}
