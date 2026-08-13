/**
 * Source unique de vérité de la navigation principale.
 *
 * La barre d'onglets dépend du RÔLE, jamais de la page. Les deux layouts —
 * `(app)/layout.tsx` et `(admin)/layout.tsx` — importent ces structures pour
 * que la nav soit identique partout (plus de « danse d'onglets » en naviguant
 * entre une page (app) et une page (admin)).
 *
 * Les routes ne sont pas déplacées : seule la liste d'onglets est unifiée.
 * Le déplacement physique `/admin/*` → `/` est un refactor reporté — décision
 * actée DEC-107 (lot 5 incarnation Régulation, 2026-06-05) : coût > bénéfice.
 *
 * Phase 06.38 (DEC-117) : la nav dirigeant passait à 11 entrées plates (>
 * seuil secteur 5-7) → regroupement en menus déroulants (Flotte ▾, Gestion ▾)
 * sans changement d'URL. Le régulateur (5 entrées, sous le seuil) garde ses
 * accès directs. Le pattern `LegalNavMenu` est généralisé en `NavGroupMenu`.
 */

export interface NavTab {
  href: string;
  label: string;
}

export interface NavGroup {
  /** Libellé du déclencheur (ex. « Flotte »). */
  label: string;
  /** Préfixes de pathname qui marquent ce groupe comme actif (ex. `/admin/vehicules`). */
  activePrefixes: string[];
  /** Items du menu déroulant. */
  items: NavTab[];
}

export interface RoleNav {
  /** Liens directs (toujours visibles). */
  primary: NavTab[];
  /** Menus déroulants. */
  groups: NavGroup[];
}

// Nav régulateur : 5 liens directs (sous le seuil 5-7) — pas de regroupement.
const REGULATEUR_PRIMARY: NavTab[] = [
  { href: '/cockpit', label: 'Cockpit' },
  { href: '/planning', label: 'Planning' },
  { href: '/patients', label: 'Patients' },
  { href: '/courses', label: 'Courses' },
  { href: '/courses/demandes-groupees', label: 'Demandes groupées' },
  { href: '/replanification', label: 'Replanification' },
  { href: '/meteo', label: 'Météo' },
  { href: '/courses/caisse', label: 'Caisse' },
  { href: '/admin/chauffeurs', label: 'Chauffeurs' },
];

export const REGULATEUR_NAV: RoleNav = {
  primary: REGULATEUR_PRIMARY,
  groups: [],
};

// Nav dirigeant : 5 liens primaires (flux quotidien) + 3 menus.
//   Flotte ▾  = moyens humains/matériels + leur suivi
//   Gestion ▾ = financier
//   Légal ▾   = RGPD (rendu via <LegalNavMenu /> pour compat — voir
//               LEGAL_NAV_GROUP ci-dessous).
const DIRIGEANT_PRIMARY: NavTab[] = [
  { href: '/tableau-de-bord', label: 'Tableau de bord' },
  { href: '/cockpit', label: 'Cockpit' },
  { href: '/planning', label: 'Planning' },
  { href: '/patients', label: 'Patients' },
  { href: '/courses', label: 'Courses' },
  { href: '/courses/caisse', label: 'Caisse' },
];

const FLOTTE_GROUP: NavGroup = {
  label: 'Flotte',
  activePrefixes: [
    '/admin/chauffeurs',
    '/admin/vehicules',
    '/admin/conformite',
    '/admin/maintenance',
  ],
  items: [
    { href: '/admin/chauffeurs', label: 'Chauffeurs' },
    { href: '/admin/vehicules', label: 'Véhicules' },
    { href: '/admin/conformite', label: 'Conformité' },
    { href: '/admin/maintenance', label: 'Maintenance' },
  ],
};

const GESTION_GROUP: NavGroup = {
  label: 'Gestion',
  activePrefixes: [
    '/admin/tarifs',
    '/admin/parametres-couts',
    '/admin/facturation',
    '/admin/donneurs-ordres',
    '/admin/prescripteurs',
    '/courses/demandes-groupees',
  ],
  items: [
    { href: '/admin/tarifs', label: 'Tarifs' },
    { href: '/admin/parametres-couts', label: 'Paramètres de coût' },
    { href: '/admin/facturation', label: 'Facturation' },
    { href: '/admin/donneurs-ordres', label: "Donneurs d'ordres" },
    { href: '/admin/prescripteurs', label: 'Prescripteurs' },
    { href: '/courses/demandes-groupees', label: 'Demandes groupées' },
  ],
};

/**
 * Groupe « Légal » exporté pour usage par `<LegalNavMenu />` (qui reste
 * rendu séparément pour préserver son entrée « Vue d'ensemble » +
 * séparateur). Si tu veux le rendre via `<NavGroupMenu />` plus tard,
 * inscris-le dans `DIRIGEANT_NAV.groups`.
 */
export const LEGAL_NAV_GROUP: NavGroup = {
  label: 'Légal',
  activePrefixes: ['/admin/legal'],
  items: [
    { href: '/admin/legal/registre', label: 'Registre des traitements' },
    { href: '/admin/legal/breaches', label: 'Violations de données' },
    { href: '/admin/legal/dpa', label: 'DPA sous-traitants' },
    { href: '/admin/legal/dpia', label: "Analyses d'impact (DPIA)" },
    { href: '/admin/legal/dpo', label: 'Contact DPO' },
    { href: '/admin/legal/requests', label: 'Demandes RGPD patients' },
  ],
};

export const DIRIGEANT_NAV: RoleNav = {
  primary: DIRIGEANT_PRIMARY,
  groups: [FLOTTE_GROUP, GESTION_GROUP],
};

/** Helper : structure de nav selon le rôle (chauffeur n'arrive jamais ici). */
export function navForRole(role: string): RoleNav {
  return role === 'dirigeant' ? DIRIGEANT_NAV : REGULATEUR_NAV;
}

/**
 * Rétro-compat : `tabsForRole` renvoie UNIQUEMENT les `primary` tabs.
 * Conservé pour les éventuels appels existants qui ne consomment qu'une
 * liste plate. Le nouvel API canonique est `navForRole(role)`.
 */
export function tabsForRole(role: string): NavTab[] {
  return navForRole(role).primary;
}
