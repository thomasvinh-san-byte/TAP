# Phase 06 — UI-SPEC : Facturation CGSS PDF

**Status:** UI-SPEC complete (pipeline GSD 2/5)
**Created:** 2026-05-20 post discuss PR #145

---

## 1. Portée de cet UI-SPEC

Pipeline GSD étape 2/5. Input : `06-CONTEXT.md` (PR #145, périmètre resserré + D-01..13 + DEC-063..067 candidates).

La Phase 06 resserrée porte 3 blocs. **Un seul a une surface UI** :

| Bloc | Nature | UI-SPEC |
|------|--------|---------|
| **A — Facturation CGSS PDF** | Surface produit réelle | **Cœur de cet UI-SPEC** (§3-§9) |
| **E — Audit RLS + Server Actions + advisors** | Migrations + tests + tri de policies | **Aucune surface UI produit.** Inventaire, matrices et correctifs relèvent du plan-phase et du code, pas d'une page utilisateur. |
| **F — Dettes CI D1/D2/D3** | Outillage CI (ESLint, test, runner pgTAP) | **Aucune UI.** Relève du plan-phase. |

Cet UI-SPEC porte donc intégralement sur le **Bloc A**. Les blocs E et F sont déclarés sans interface : ne pas leur inventer d'écran.

### Décisions du CONTEXT qui cadrent le Bloc A

| # | Décision | Impact UI |
|---|----------|-----------|
| D-02 | Facturation V1.5 = PDF récapitulatif mensuel | Surface = sélection mois/année + génération PDF |
| D-07 | `@react-pdf/renderer` (déjà présent Phase 1.5) | Réutiliser le pattern PDF du registre — zéro nouvelle dépendance |
| D-08 | Contenu PDF : en-tête société, tableau courses, sous-totaux, total, mentions | Cadre le document `facture-cgss-pdf` (§4) |
| D-09 | Le PDF **agrège**, il ne recalcule pas | Le PDF lit `rides.tarif_amount_eur` déjà calculé — pas d'appel au moteur |
| DEC-061 / DEC-064 | Disclaimer « tarif estimatif » | Mention obligatoire dans le PDF tant que pas de télétransmission B2 |
| DEC-058 | Périmètre tarif monopatient | Aucune ligne transport partagé / abattement |

---

## 2. Sources industrie (3 références)

### Source 1 — Bordereau de facturation tiers payant (modèle Assurance Maladie)

Les récapitulatifs de facturation en tiers payant (transport sanitaire conventionné) suivent une structure stable : en-tête transporteur (raison sociale), période de facturation, **une ligne par prestation** (date, bénéficiaire, trajet, montant), sous-totaux et total. Le document sert de pièce de contrôle avant transmission.
→ **Application TAP** : `facture-cgss-pdf` reprend cette structure ; le récapitulatif est un document de contrôle interne, distinct du bordereau B2/SEFi télétransmis (différé — DEC-064).

### Source 2 — Layout facture PDF (Stripe Billing, déjà appliqué Phase 05.5)

En-tête identité + métadonnées en haut, table de lignes au centre, séparateur visuel avant le total, total en gras et taille supérieure, montants en chiffres tabulaires (alignement décimal), mentions légales en pied.
→ **Application TAP** : `facture-cgss-pdf` calque ce layout, cohérent avec `registre-pdf.tsx` (Phase 1.5) et `PricingBreakdown` (Phase 05.5).

### Source 3 — Aperçu avant export (pattern « preview before generate »)

Les UIs d'export 2026 montrent un **décompte et un total avant la génération** du document, pour éviter un export vide ou erroné. L'utilisateur valide visuellement la sélection (période, périmètre) avant de produire le fichier.
→ **Application TAP** : la page `/admin/facturation` affiche le compteur de courses + le total **avant** le bouton de téléchargement (verrou V6 — pas de PDF aveugle).

Sources : ameli.fr (transport conventionné — facturation), patterns Stripe Billing / invoice PDF, conventions d'export admin SaaS 2026.

---

## 3. Surface A — Page `/admin/facturation` (NOUVELLE)

Page admin **dirigeant-only** (`requireDirigeantPage()`), cohérente avec `/admin/tarifs` et `/admin/maintenance`. Tranche le point « Claude's Discretion » du CONTEXT : **page dédiée** retenue (vs bouton sur une vue existante) — cohérence du pattern admin établi, place pour l'aperçu + les états.

3 zones : sélection de période, aperçu des courses facturables, téléchargement.

### Wireframe ASCII

```
┌────────────────────────────────────────────────────────────┐
│ Facturation CGSS                                            │
│ Récapitulatif mensuel des courses en tiers payant CGSS.     │
│                                                             │
│ Période  [ Avril 2026      ▾ ]   Chauffeur [ Tous       ▾ ] │
│                                                             │
│ ┌─ Aperçu ──────────────────────────────────────────────┐  │
│ │ 23 courses facturables · Total estimé   1 248,60 €     │  │
│ │                                                        │  │
│ │ Date        Patient          Trajet             Montant│  │
│ │ 02/04/2026  Hoarau Patrick   St-Denis → CHU      54,20 €│  │
│ │ 03/04/2026  Payet Marie      Le Tampon → Dialyse 38,10 €│  │
│ │ …                                                      │  │
│ │                                                        │  │
│ │ ⚠ 2 courses CGSS clôturées sans tarif — non incluses.  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│                          [ Télécharger le PDF (A4) ]       │
└────────────────────────────────────────────────────────────┘
```

### Sélection de période

- **Mois + année** : la facture est mensuelle (D-02). Sélecteur unique « mois Année » (ex. `Avril 2026`). Plage : depuis le premier mois ayant des courses jusqu'au mois courant.
- **Défaut = mois complet précédent** (au 20/05/2026 → `Avril 2026`) : une facture mensuelle porte sur un mois terminé.
- **Filtre chauffeur** : optionnel, défaut `Tous les chauffeurs`. Permet une facture par chauffeur (le CONTEXT prévoit « par organisation ET par chauffeur »).
- **Mécanique** : le sélecteur est un composant client minimal qui pousse les `searchParams` (`?mois=YYYY-MM&chauffeur=<id>`). La page (Server Component, `force-dynamic`) lit les `searchParams`, requête les courses, rend l'aperçu. Pas de `useEffect` de fetch (CLAUDE.md § 5 / pattern `/admin/tarifs`). Pendant la navigation, le sélecteur affiche un état `pending` via `useTransition`.

### Aperçu des courses facturables (verrou V6)

- Carte « Aperçu » : en tête, **compteur + total estimé** (`N courses facturables · Total estimé X,XX €`).
- Table dense (lignes ~40 px, cohérent cockpit / historique tarifs) : `Date · Patient · Trajet · Montant`. Montants `font-mono tabular-nums`.
- Le total et les montants reprennent les `rides.tarif_amount_eur` **déjà stockés** (D-09 — agrège, ne recalcule pas).
- Si des courses CGSS sont clôturées mais sans `tarif_amount_eur`, une ligne d'avertissement sobre les signale (`⚠ N courses CGSS clôturées sans tarif — non incluses.`) — le dirigeant sait que la facture est incomplète et peut aller les tarifer. Ce n'est pas une erreur bloquante.

### Téléchargement

- Bouton/lien « Télécharger le PDF (A4) » → ancre vers le Route Handler `/api/admin/facturation/pdf?mois=YYYY-MM&chauffeur=<id>` (mêmes paramètres que l'aperçu — cohérence aperçu ↔ document).
- Désactivé visuellement (état `aria-disabled`, pas d'ancre active) quand l'aperçu est vide.

---

## 4. Surface B — Document `facture-cgss-pdf` (NOUVEAU)

Composant `@react-pdf/renderer` (`Document` / `Page` / `Text` / `View` / `StyleSheet`), calqué **trait pour trait** sur `apps/web/src/app/api/admin/legal/registre/pdf/_components/registre-pdf.tsx` : `Page size="A4"`, `padding 32`, `fontFamily 'Helvetica'`. Zéro nouvelle dépendance (D-07 / verrou V3).

### Wireframe ASCII (page A4)

```
┌──────────────────────────── A4 ─────────────────────────────┐
│ Facturation CGSS — Récapitulatif mensuel                     │
│                                                              │
│ Société : <nom organisation>                                 │
│ Période : avril 2026                                         │
│ Chauffeur : tous   (ou : <nom chauffeur> si filtré)          │
│ Généré le : 20/05/2026 11:30                                 │
│                                                              │
│ Date        Patient           Trajet              Montant    │
│ ──────────────────────────────────────────────────────────  │
│ 02/04/2026  Hoarau Patrick    St-Denis → CHU       54,20 €   │
│ 03/04/2026  Payet Marie       Le Tampon → Dialyse  38,10 €   │
│ …                                                            │
│ ──────────────────────────────────────────────────────────  │
│ Sous-total — <chauffeur A>            12 courses    612,00 € │
│ Sous-total — <chauffeur B>            11 courses    636,60 € │
│ ════════════════════════════════════════════════════════════ │
│ Total — 23 courses                                1 248,60 € │
│                                                              │
│ Tarif estimatif, non contractuel jusqu'à la facturation      │
│ CGSS télétransmise. Récapitulatif interne — ne vaut pas      │
│ bordereau de télétransmission B2/SEFi.                       │
│                                                              │
│ Document généré automatiquement — TAP Régulation             │
└──────────────────────────────────────────────────────────────┘
```

### Contenu

- **En-tête** : titre « Facturation CGSS — Récapitulatif mensuel », nom de l'organisation (fallback `Société` comme `registre-pdf`), période en clair (`avril 2026`), périmètre chauffeur (`tous` ou nom), horodatage de génération (`toLocaleString('fr-FR')`).
- **Tableau** : une ligne par course facturable — `Date · Patient · Trajet · Montant`. Le **montant** = `rides.tarif_amount_eur` (déjà calculé par le moteur 05.5 à la clôture). Tri par date croissante.
- **Sous-totaux par chauffeur** : si le périmètre = tous les chauffeurs, un sous-total (nombre de courses + somme) par chauffeur. Si filtré sur un chauffeur, un seul groupe.
- **Total** : nombre total de courses + somme, en gras.
- **Disclaimer** (DEC-061 / DEC-064, verrou V5) : « Tarif estimatif, non contractuel jusqu'à la facturation CGSS télétransmise. Récapitulatif interne — ne vaut pas bordereau de télétransmission B2/SEFi. »

### Décision de spec — granularité du montant par course

- **S-01** — Le PDF affiche le **montant total par course** (`rides.tarif_amount_eur`). La décomposition ligne à ligne du moteur 05.5 (`PricingResult` : forfait / km / suppléments / majoration) **n'est pas persistée** sur `rides` — seul le total l'est. V1.5 : pas de décomposition par course dans le PDF. C'est le respect strict de D-09 (« agrège, ne recalcule pas ») — recalculer pour décomposer serait interdit. Si une décomposition par course devient nécessaire, elle suppose de persister `PricingResult` sur `rides` (nouvelles colonnes) → à arbitrer en sous-phase, hors Phase 06.
- **S-02** — La colonne « distance » évoquée dans le CONTEXT D-08 n'est **pas affichée par course** : la distance n'est pas stockée sur `rides` (le moteur la calcule à la volée). L'afficher exigerait soit de la recalculer (interdit par D-09), soit de la persister (hors scope). Colonnes PDF V1.5 = `Date · Patient · Trajet · Montant`.

---

## 5. Définition « course facturable CGSS » (à acter)

Le point métier central : quelles courses entrent dans la facture. Critères **actés** pour cet UI-SPEC (alimentent la requête de l'aperçu et du Route Handler) :

- **S-03** — Une course est *facturable CGSS* si :
  1. `payment_method = 'cgss_differe'` — le payeur est la CGSS en tiers payant (vs `cash` / `cb` / `cheque` = payé par le patient, hors facture CGSS).
  2. `status = 'terminee'` — course réellement exécutée et clôturée (exclut `annulee_*`, `en_cours`, `assignee`, `validee`, et les no-show).
  3. `tarif_amount_eur IS NOT NULL` — course tarifée.
  4. `ended_at` (date réelle d'exécution) dans le mois sélectionné — `status = 'terminee'` garantit `ended_at` non-null.
  5. Scope organisation via RLS (`organization_id`).
  - Filtre chauffeur optionnel : `driver_id = <id>` si la période est restreinte à un chauffeur.
- **S-04** — Les courses qui satisfont (1) + (2) mais **pas** (3) (`tarif_amount_eur IS NULL`) alimentent le compteur d'avertissement de l'aperçu (« N courses CGSS clôturées sans tarif »). Elles ne sont **pas** dans le PDF.
- **Point à vérifier au plan-phase** : confirmer que le flux de clôture (`end-ride-modal` chauffeur / régulateur) renseigne effectivement `payment_method = 'cgss_differe'` pour les courses conventionnées. Si le seed / le flux réel utilise plutôt `payment_status = 'non_concerne'` sans `payment_method`, le plan ajuste le critère (1) en conséquence — la sémantique « payeur = CGSS » reste le critère métier, son expression SQL est à caler sur les données réelles.

---

## 6. Composants à créer

| Composant | Chemin | Action |
|-----------|--------|--------|
| Page facturation | `apps/web/src/app/(admin)/admin/facturation/page.tsx` | CRÉER — Server Component, `requireDirigeantPage()`, lit `searchParams`, requête les courses facturables, rend l'aperçu |
| `PeriodeSelector` | `apps/web/src/app/(admin)/admin/facturation/_components/periode-selector.client.tsx` | CRÉER — sélecteur mois/année + chauffeur, `router.push` searchParams, `useTransition` pour l'état pending |
| `FactureApercu` | `apps/web/src/app/(admin)/admin/facturation/_components/facture-apercu.tsx` | CRÉER — composant de présentation (server) : compteur + total + table + avertissement + lien téléchargement |
| Route Handler PDF | `apps/web/src/app/api/admin/facturation/pdf/route.tsx` | CRÉER — `GET`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, auth dirigeant, `audit_logs` AVANT rendu, `renderToStream`, `Response` PDF |
| `FactureCgssPdf` | `apps/web/src/app/api/admin/facturation/pdf/_components/facture-cgss-pdf.tsx` | CRÉER — composant `Document` `@react-pdf/renderer`, calqué sur `registre-pdf.tsx` |
| Requête courses facturables | `apps/web/src/app/(admin)/admin/facturation/_lib/queries-facturation.ts` (ou réutilisation `queries-enriched`) | CRÉER / RÉUTILISER — sélection partagée page ↔ Route Handler (DRY : aperçu et PDF requêtent à l'identique) |
| Onglet nav | `apps/web/src/app/(admin)/layout.tsx` | ÉTENDRE — ajouter `{ href: '/admin/facturation', label: 'Facturation' }` à `ADMIN_EXTRAS` (dirigeant-only) |

Chaque fichier ≤ 300 LOC, composant ≤ 150 LOC (CLAUDE.md § 11). La requête de sélection des courses facturables (S-03) est **partagée** entre la page (aperçu) et le Route Handler (PDF) — une seule source de vérité, l'aperçu ne ment jamais sur le PDF.

---

## 7. États

| État | Surface | Rendu |
|------|---------|-------|
| **Repos** | Page | Aperçu peuplé : compteur, total, table, bouton actif |
| **Chargement** | Sélecteur | Changement de période → navigation `searchParams` ; `PeriodeSelector` en état `pending` (`useTransition`), `loading.tsx` skeleton optionnel pour l'aperçu |
| **Vide** | Aperçu | Aucune course facturable sur la période : état vide illustré (icône Lucide `FileText`), texte « Aucune course facturable CGSS pour <mois année>. Les courses en tiers payant CGSS clôturées sur la période apparaîtront ici. » Bouton téléchargement **désactivé** |
| **Avertissement** | Aperçu | Des courses CGSS clôturées sans tarif existent : ligne sobre `⚠ N courses CGSS clôturées sans tarif — non incluses.` (n'empêche pas la génération du PDF des courses tarifées) |
| **Erreur — organisation introuvable** | PDF | Fallback `Société` (pattern `registre-pdf`) — pas d'échec dur |
| **Erreur — auth** | Route Handler | `401` non authentifié / `403` rôle ≠ dirigeant (pattern `registre/pdf/route.tsx`) |

Le PDF n'a **pas** d'état « aucune grille tarifaire » : il agrège des montants déjà stockés (D-09), il ne dépend pas de `tariff_grids`.

---

## 8. Design tokens

Cohérent `/admin/tarifs`, `/admin/maintenance`, UI-PATTERNS.md (DEC-034).

- **Spacing NFR-003** : `space-y-24` entre zones de page, `space-y-8` header, `p-16` cartes, `gap-16` sélecteurs, table lignes `h-10` (40 px). Échelle 4/8/12/16/24/32/48/64 uniquement.
- **Typographie** : titre page `text-2xl font-semibold tracking-tight` ; montants `font-mono tabular-nums` (alignement décimal) ; total PDF `fontSize` supérieur + `fontWeight 700`.
- **Couleurs sémantiques** : montants `text-foreground` ; texte d'aide / disclaimer `text-muted-foreground` ; avertissement « sans tarif » `text-amber-700` (attention, pas erreur) ; pas de rouge (aucune action destructive sur cette page).
- **Icônes Lucide** : `FileText` (état vide / facturation), `Download` (téléchargement), `AlertTriangle` (avertissement courses sans tarif), `Calendar` (sélecteur période).
- **PDF** : `StyleSheet.create`, `Helvetica`, A4 `padding 32` — réutiliser les styles de `registre-pdf.tsx` (h1 18 / h2 12 / label 9 / value 10 / meta 8, séparateurs `1pt solid #ccc`).
- **Animations NFR-004** : aucune ; l'état `pending` du sélecteur = état natif, pas de framer-motion.

---

## 9. Anti-patterns (interdits)

- ❌ Introduire une nouvelle bibliothèque PDF — réutiliser `@react-pdf/renderer` (D-07 / V3).
- ❌ Recalculer les tarifs dans la facture — elle agrège les `tarif_amount_eur` stockés (D-09 / V4).
- ❌ Générer le PDF sans aperçu préalable (compteur + total) — verrou V6.
- ❌ Omettre le disclaimer estimatif (DEC-061 / DEC-064 / V5).
- ❌ Présenter le récapitulatif comme un bordereau de télétransmission B2/SEFi — le disclaimer le précise (DEC-064).
- ❌ UI de télétransmission B2/CNDA / formulaire 606b — différé (DEC-064), hors Phase 06.
- ❌ Inclure les courses payées `cash`/`cb`/`cheque` dans la facture CGSS (S-03 — payeur = CGSS uniquement).
- ❌ Inclure des courses non clôturées ou annulées / no-show (S-03).
- ❌ Inventer une UI pour le Bloc E (audit sécurité) ou le Bloc F (dettes CI) — sans surface (verrou V2).
- ❌ `useEffect` pour charger l'aperçu — la période passe par les `searchParams` + Server Component.
- ❌ framer-motion (NFR-004).
- ⚠ **Note NFR-001** : le PDF contient des **noms de patients réels** — c'est de la **donnée runtime**, pas du code. NFR-001 (« aucun nom propre ») s'applique au code source, pas aux données affichées. Ce n'est **pas** une violation (verrou V8).

---

## 10. Intégration navigation

Ajouter l'onglet « Facturation » à la nav admin dans `apps/web/src/app/(admin)/layout.tsx` :

```
const ADMIN_EXTRAS = [
  { href: '/admin/vehicules', label: 'Véhicules' },
  { href: '/admin/tarifs', label: 'Tarifs' },
  { href: '/admin/facturation', label: 'Facturation' },   // ← NOUVEAU
  { href: '/admin/legal/registre', label: 'Registre' },
  { href: '/admin/legal/breaches', label: 'Violations' },
];
```

Onglet **dirigeant-only** (déjà conditionné par `isDirigeant` dans le layout). Placé après « Tarifs » — cohérence du regroupement économique (tarifs → facturation).

---

## 11. Blocs E et F — confirmation : aucune surface UI

- **Bloc E (audit RLS + Server Actions + ~50 advisors)** : travail de migrations correctives, de tests pgTAP / E2E et de tri de policies. La « matrice rôle × table × action » est un livrable de **documentation** (du plan ou d'un fichier d'audit), pas une page produit. Aucun écran utilisateur. Spécification détaillée → plan-phase (étape 3/5).
- **Bloc F (dettes CI D1/D2/D3)** : `eslint.config.js`, correction d'un test, fix du runner pgTAP CI. Outillage CI pur. Aucune UI. → plan-phase.

Ne pas leur produire de wireframe ni de composant.

---

## 12. Mapping success criteria (CONTEXT) → surfaces

| Success criterion 06-CONTEXT | Couverture UI-SPEC |
|------------------------------|--------------------|
| 1. PDF récap mensuel CGSS généré et téléchargeable | Surface A (page) + Surface B (document) |
| 2. Audit RLS documenté + correctifs + pgTAP | Bloc E — sans UI (plan-phase) |
| 3. Audit Server Actions DEC-041/DEC-040 + E2E | Bloc E — sans UI (plan-phase) |
| 4. ~50 advisors sécurité traités | Bloc E — sans UI (plan-phase) |
| 5. Dettes CI D1/D2/D3 résolues | Bloc F — sans UI (plan-phase) |
| 6. Preview Vercel + smoke + walkthrough | Surface A (la page facturation est la preuve visible — CLAUDE.md § 13.5) |

---

## 13. Rappel séquençage (pour le plan-phase)

Le discuss (PR #145) a signalé une **action de séquençage non faite** (un discuss / ui-spec est en lecture seule) : la ligne Phase 06 de `ROADMAP.md` doit être resserrée et les entrées **06.5 (HDS)** et **06.7 (OR-Tools)** ajoutées. Ce n'est pas le rôle de l'UI-SPEC. Le **plan-phase (étape 3/5)** ou une mini-PR `/gsd-phase` doit le faire, pour que les sous-phases découpées ne se perdent pas. Rappel inscrit ici pour ne pas le perdre entre les étapes du pipeline.

---

## Prochaine étape

`/gsd-plan-phase 06` (pipeline GSD 3/5) — découpage en waves : Wave 1 dettes CI (Bloc F), puis Bloc A (facturation : Route Handler PDF + page + composants) ∥ Bloc E (audit RLS + Server Actions + advisors), + formalisation ROADMAP (scission 06 / ajout 06.5 / 06.7).
