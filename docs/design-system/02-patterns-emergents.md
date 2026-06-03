# Patterns émergents — catalogue Phase 06.11

> Phase 06.13 — `2026-06-03`. Catalogue des 5 patterns réutilisables
> identifiés à l'issue de la Phase 06.11. **Aucun composant n'est créé
> dans ce document** : on capitalise l'existant pour servir de
> référence aux phases suivantes.

Conventions communes à tous les patterns :

- WCAG 2.1 AA (cf. `01-foundations.md` § 8).
- Tailwind/shadcn, palette `tokens.json`.
- Couleur jamais seule (NFR-003) — toujours doublée d'un texte ou
  d'une icône.
- Cible tactile ≥ 44 px côté régulateur.

---

## Pattern 1 — `KpiCard` (4 variantes)

- **Emplacement** : `apps/web/src/app/(app)/tableau-de-bord/_components/kpi-card.tsx`
- **Phase d'origine** : 06.8 (tableau de bord dirigeant), étendu Wave 1
  Phase 06.11 (variante `simple` enrichie comparatif N vs N-1 pattern
  Stripe Balance).
- **PR de référence** : `feat(06.11-01)` — tableau dirigeant enrichi.

### Description

Carte-KPI server component, présentationnelle (aucune query). Reçoit
ses valeurs en props. 4 variantes via discriminated union pour couvrir
les 4 anatomies repérées sur le tableau de bord dirigeant :

| Variante      | Anatomie                                                                |
| ------------- | ----------------------------------------------------------------------- |
| `simple`      | Valeur unique + état coloré optionnel + delta N vs N-1 + contexte.      |
| `ventilation` | Valeur principale + sous-liste de ventilation (CA par mode paiement).   |
| `multi`       | Plusieurs lignes label/valeur (volume aujourd'hui / semaine / mois).    |
| `alerte`      | Liste de liens d'alertes ou état neutre « Aucune alerte ».              |

### Interface (extrait)

```ts
export type KpiCardProps = KpiSimple | KpiVentilation | KpiMulti | KpiAlerte;

interface KpiSimple extends KpiCardBase {
  variant: 'simple';
  value: string;
  context?: string;
  state?: 'neutre' | 'succes' | 'attention' | 'alerte';
  stateLabel?: string;
  previousValue?: string;       // Wave 1 Phase 06.11
  delta?: number;               // Wave 1 Phase 06.11
  deltaUnit?: '%' | 'pts';
  deltaSign?: 'positive' | 'inverse';
  previousLabel?: string;
}
```

### Usage typique

```tsx
<KpiCard
  variant="simple"
  label="CA encaissé du mois"
  value={eur.format(data.caMois.total_eur)}
  delta={caDelta}
  deltaUnit="%"
  deltaSign="positive"
  previousLabel={moisPrecLibelle}
  previousValue={eur.format(data.caMoisPrec.total_eur)}
/>
```

### Do / Don't

- ✓ Une seule variante par carte (jamais mélanger ventilation + delta).
- ✓ Pour un KPI en pourcentage (incidents), utiliser `deltaUnit="pts"`
  et `deltaSign="inverse"`.
- ✓ Garder le `label` court (max 30 caractères).
- ✗ Ne pas dupliquer le KPI sur le tableau (un par section).
- ✗ Ne pas passer `state` sans `stateLabel` correspondant (couleur
  jamais seule).
- ✗ Ne pas mettre d'icône sur `KpiCard` — la hiérarchie visuelle se
  fait par taille et couleur.

### Accessibilité

- Toutes les valeurs critiques utilisent `tabular-nums` (chiffres
  alignés).
- L'`action` rend un `<Link>` Next.js avec `min-h-[44px]` et
  `focus-visible:ring-2 focus-visible:ring-ring`.
- État coloré (`state`) toujours doublé par `stateLabel`.

### Évolutions futures

- Drill-down au clic sur la carte (HVI 2026 — A2 reporté Phase 06.11).
- Variante `sparkline` (mini-graphique sur 30 jours) — Carbon-inspired.
- Variante `breakdown` interactive (filtre dynamique sur ventilation).

---

## Pattern 2 — `EmptyState` (action discriminée)

- **Emplacement** : `apps/web/src/components/ui/empty-state.tsx`
- **Phase d'origine** : 06.11 Wave 3 (C1 audit empty states
  transverses, 12 écrans harmonisés).
- **PR de référence** : `feat(06.11-03)` — finition démo.

### Description

État vide standardisé pour toute liste, table ou panneau. Pattern
Doctolib/Stripe : icône + titre + description + appel à l'action
principal centré. Discriminated union sur l'action : `href` → `<Link>`
(navigation interne) ou `onClick` → `<button>` (ouverture drawer/modal
sans URL dédiée).

### Interface

```ts
type EmptyStateAction =
  | { href: string; label: string; icon?: LucideIcon }
  | { onClick: () => void; label: string; icon?: LucideIcon };

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}
```

### Usage typique

```tsx
import { Users, Plus } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

<EmptyState
  icon={Users}
  title="Aucun patient enregistré"
  description="Créez votre première fiche patient pour commencer."
  action={{ href: '/patients/new', label: 'Nouveau patient', icon: Plus }}
/>
```

### Do / Don't

- ✓ Action principale = une seule. Si secondaire pertinente
  (pré-remplir vs créer manuellement), utiliser `secondaryAction`.
- ✓ Description courte (1-2 phrases, ≤ 120 caractères).
- ✓ Pour les écrans neutres (pas de CTA pertinent — `/admin/legal/
  breaches`, `/admin/legal/requests`), omettre `action`.
- ✗ Ne pas embarquer de logique métier (le composant est purement
  présentationnel).
- ✗ Ne pas remplacer un message d'erreur par un EmptyState — gérer les
  erreurs avec un pattern dédié.
- ✗ Ne pas créer des variantes locales (anciens `EmptyState()`
  internes ont été supprimés en Phase 06.11 Wave 3).

### Accessibilité

- Bouton `min-h-[44px]`.
- `<h2>` pour le titre.
- Icône `aria-hidden` (décoration uniquement).

### Évolutions futures

- Variante `illustration` (image SVG dédiée, NHS-inspired) pour les
  premiers écrans onboarding.
- Variante `error` (vs `empty`) pour distinguer « rien à montrer » de
  « erreur de chargement ».

---

## Pattern 3 — `RideBadge` (3 types)

- **Emplacement** : `apps/web/src/app/(app)/cockpit/optimisation/_components/ride-badge.tsx`
- **Phase d'origine** : 06.11 Wave 2 (B3 badges enrichis sur l'écran
  d'optimisation).
- **PR de référence** : `feat(06.11-02)` — passe UX optimisation.

### Description

Badge métier sur une course (urgence, mode de transport, ou shortcut
TPMR). Pattern strictement aligné sur `HautsBadge` (cf. Pattern 5
ci-dessous). 3 types couverts par discriminated union pour éviter les
combinaisons invalides au typecheck.

### Interface

```ts
type UrgencyValue = 'programmee' | 'urgente' | 'immediate';
type TransportModeValue = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';

export type RideBadgeProps =
  | { type: 'urgency'; value: UrgencyValue }
  | { type: 'transport'; value: TransportModeValue }
  | { type: 'tpmr' };
```

### Usage typique

```tsx
{attrs && (
  <span className="ml-4 inline-flex flex-wrap gap-4">
    <RideBadge type="transport" value={attrs.transport_mode} />
    {attrs.urgency !== 'programmee' && (
      <RideBadge type="urgency" value={attrs.urgency} />
    )}
  </span>
)}
```

### Do / Don't

- ✓ Omettre `urgency='programmee'` à l'affichage (état nominal
  silencieux). Le badge transport reste toujours visible.
- ✓ Pour signaler un patient TPMR sur une course `taxi_conventionne`,
  utiliser le shortcut `type='tpmr'` (réservé futur usage).
- ✓ Aligner toute nouvelle variante sur le pattern interne (icône
  lucide + Badge shadcn + couleur Tailwind + `tabIndex={0}` + `title`).
- ✗ Ne pas dupliquer un badge `transport='tpmr'` et un badge
  `type='tpmr'` sur la même course (info redondante).
- ✗ Ne pas créer de variante hors énum (zod enforce côté contrat
  optimizer).
- ✗ Ne pas afficher uniquement l'icône sans le label (NFR-003).

### Accessibilité

- `tabIndex={0}` rend la badge focusable pour l'infobulle
  (`title="…"`).
- Texte toujours visible à côté de l'icône.
- Palette Tailwind contrastée (border + bg + text — 3 couches de la
  même teinte pour lisibilité).

### Évolutions futures

- Badge `payment` (paiement direct vs CGSS) sur les courses passées.
- Badge `pmr_count` pour les groupements avec plusieurs patients PMR.

---

## Pattern 4 — `SlaBadgesCard` (règles SLA factuelles datées)

- **Emplacement** : `apps/web/src/app/(app)/tableau-de-bord/_components/sla-badges-card.tsx`
- **Phase d'origine** : 06.11 Wave 1 (A3 SLA factuels datés, Option 3
  reformulée 2026-06-03).
- **PR de référence** : `feat(06.11-01)` — tableau dirigeant enrichi.

### Description

Carte distincte du tableau de bord listant les dépassements légaux
datés objectifs (breach CNIL 72 h, deadline patient art. 12, DPIA
review, registre > 12 mois). **Distinct par construction de la
`ComplianceCard`** : doctrine 06.6 LOCKED — RGPD impose de démontrer
la conformité, pas de la revendiquer.

- Rouge = délai dépassé (action immédiate requise).
- Orange = délai approchant (action préventive).
- État vide neutre = « Délais légaux respectés » (icône check, aucun
  jugement « conforme »).

### Interface

```ts
import type { SlaRule, SlaStatus } from '../_lib/sla-status';

interface Props {
  rules: SlaRule[];
}

export interface SlaRule {
  id: 'breach-cnil-72h' | 'request-deadline' | 'dpia-review' | 'register-review';
  status: 'vert' | 'orange' | 'rouge';
  label: string;
  href?: string;
}
```

### Usage typique

```tsx
// page.tsx — server component
const rules = await getSlaRules(supabase);
<SlaBadgesCard rules={rules} />
```

### Do / Don't

- ✓ Toujours rendre la carte même quand `rules` est vide (l'état
  neutre est lui-même un signal positif).
- ✓ Ajouter une règle = ajouter un évaluateur pur dans
  `_lib/sla-status.ts` + son test Vitest.
- ✓ Critère « dépassement objectif daté » : si la règle ne peut pas
  être exprimée comme une date dans le futur ou passée, ne pas la
  créer (sortir du périmètre).
- ✗ Ne jamais introduire de score de conformité globale (doctrine
  06.6 LOCKED).
- ✗ Ne jamais introduire de jugement « conforme RGPD » sur la
  `ComplianceCard` qui doit rester strictement neutre / factuelle.
- ✗ Ne pas dupliquer les règles dans plusieurs composants — la source
  de vérité est `_lib/sla-status.ts`.

### Accessibilité

- `aria-labelledby="sla-title"` sur la section.
- Pastille colorée + texte (jamais couleur seule).
- Liens `min-h-[44px]` avec `focus-visible:ring-2`.

### Évolutions futures

- Compteur urgence visible (« 3 j 12 h restants ») sur les règles
  oranges.
- Notification proactive (push, email) au franchissement du seuil
  orange.
- Historique des dépassements (page dédiée) pour audit CNIL.

---

## Pattern 5 — `HautsBadge` (modèle de référence)

- **Emplacement** : `apps/web/src/app/(app)/cockpit/optimisation/_components/hauts-badge.tsx`
- **Phase d'origine** : 06.7 Wave 3 (D-10 — détection citycodes Hauts
  de La Réunion).
- **PR de référence** : Phase 06.7 Wave 3.

### Description

Badge « À vérifier » pour les groupements traversant des zones de
relief (Hauts de La Réunion). C'est **le modèle canonique du pattern
badge** suivi par `RideBadge` : icône `lucide-react` + composant
`Badge` shadcn + classes Tailwind (border + bg + text) +
`tabIndex={0}` pour tooltip clavier-accessible.

### Interface

```ts
export function HautsBadge(): JSX.Element;
```

Pas de prop : le badge est binaire (présent ou absent, contrôlé par
l'appelant via `groupTraverseHauts(rideCitycodes)`).

### Usage typique

```tsx
import { groupTraverseHauts } from '../_lib/hauts-citycodes';
import { HautsBadge } from './hauts-badge';

const isHauts = groupTraverseHauts(rideCitycodes);
// ...
{isHauts && <HautsBadge />}
```

### Do / Don't

- ✓ Utiliser ce pattern exact pour tout nouveau badge métier — icône
  lucide + `Badge` shadcn + 3 classes Tailwind (border-X-300 +
  bg-X-50 + text-X-700) + `tabIndex={0}` + `title` descriptif.
- ✓ Choisir une couleur qui n'entre pas en collision avec les
  feedback colors sémantiques (rouge=danger, ambre=warning,
  vert=success). Ici `amber` car « à vérifier ».
- ✓ Tester le rendu en mode sombre avant de figer.
- ✗ Ne pas créer de variantes locales avec d'autres classes (cf.
  ancien `EmptyState()` interne supprimé Wave 3).
- ✗ Ne pas afficher l'icône sans le texte.
- ✗ Ne pas multiplier les badges sur un même élément (max 3 visibles
  simultanés pour ne pas surcharger).

### Accessibilité

- `tabIndex={0}` → focusable au clavier, tooltip lisible.
- `title` longue explication (« Ce groupement inclut un trajet en
  zone de relief. La distance estimée peut sous-estimer le temps
  réel. »).
- Icône `aria-hidden` (décoration).

### Évolutions futures

- Variante `interactive` (popover au clic au lieu de title) pour
  expliquer le mécanisme de détection.
- Badges « À vérifier » génériques avec icône configurable (pour
  d'autres règles métier — DPIA en revue, RGPD à compléter…).

---

## Récapitulatif

| Pattern         | Type              | Action  | Discriminated union | Variante      |
| --------------- | ----------------- | ------- | ------------------- | ------------- |
| `KpiCard`       | Affichage         | Lien    | Oui (variant)       | 4             |
| `EmptyState`    | État vide         | Lien ou onClick | Oui (action)        | 1 + secondaryAction |
| `RideBadge`     | Badge métier      | —       | Oui (type)          | 3             |
| `SlaBadgesCard` | Carte de section  | Liens dans liste | Non                 | 1 + état vide |
| `HautsBadge`    | Badge contextuel  | —       | Non                 | 1             |

Tous les composants ci-dessus respectent la doctrine `01-foundations.md`
et la convention NFR-001 (aucun nom propre dans le code).
