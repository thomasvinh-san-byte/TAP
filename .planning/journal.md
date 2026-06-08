# Journal — phases livrées

## 2026-06-08 — Phase 06.38 livrée localement (header — regroupement nav dirigeant Flotte/Gestion)

Désencombrement du header dirigeant. Recherche secteur : top-bar 5-7 max ; TAP dirigeant était à **11 entrées plates**. Décision : regroupement en menus déroulants (pas sidebar — repoussée si besoin persiste). Faible risque, sur existant.

### D-01 — Regroupement nav dirigeant

| Avant (11 liens à plat) | Après (5 primaires + 3 menus) |
|---|---|
| Tableau de bord, Cockpit, Patients, Courses, Caisse, Chauffeurs, Véhicules, Tarifs, Facturation, Conformité, Maintenance, + Légal ▾ | **Primaires** : Tableau de bord, Cockpit, Patients, Courses, Caisse |
| | **Flotte ▾** : Chauffeurs, Véhicules, Conformité, Maintenance |
| | **Gestion ▾** : Tarifs, Facturation |
| | **Légal ▾** : 6 entrées RGPD inchangées |

Hiérarchie métier : flux quotidien (primaires) / moyens (Flotte) / financier (Gestion) / RGPD (Légal).

### D-02 — Régulateur préservé

Régulateur conservé à **5 entrées plates** (Cockpit, Patients, Courses, Caisse, Chauffeurs) — sous le seuil, son flux quotidien reste 1 clic. Pas de menu Flotte/Gestion pour lui.

### D-03 — `<NavGroupMenu>` générique

`components/nav-group-menu.client.tsx` — pattern `LegalNavMenu` généralisé. Prend une prop `group: NavGroup` et rend un `DropdownMenu` shadcn stylé comme un onglet de la top-bar. **Signature bleue active DEC-115 préservée même dans un menu** :
- Déclencheur `text-primary font-medium` + soulignement `bg-primary` **3px pleine opacité** quand un item du groupe est actif.
- Items du menu marqués `aria-current="page"` + `text-primary font-medium` quand actifs.

`LegalNavMenu` réécrit pour suivre exactement le même style (2px→3px, `text-foreground`→`text-primary` actif), tout en conservant son entrée additionnelle « Vue d'ensemble » + séparateur. Items lus depuis `LEGAL_NAV_GROUP` (nav-config source unique).

### D-04 — `nav-config` source unique

Restructuration :

```ts
export interface NavGroup {
  label: string;
  activePrefixes: string[];
  items: NavTab[];
}

export interface RoleNav {
  primary: NavTab[];
  groups: NavGroup[];
}

export function navForRole(role: string): RoleNav;
```

`tabsForRole(role)` conservé en rétro-compat (renvoie `primary` seul). `AppHeader` consomme `navForRole(role)` et boucle sur `groups` → `<NavGroupMenu group={...} />`.

### D-05 — Périmètre

- **Pas de sidebar** (repoussée si besoin persiste après usage).
- **Pas de changement d'URL** : les 11 routes restent inchangées.
- **Pas le header chauffeur PWA** (grammaire dédiée DEC-014).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean
- WCAG/RGAA : `DropdownMenu` shadcn (clavier OK : Espace, Entrée, flèches, Échap) ; `aria-current` posé sur trigger ET item actif
- 0 migration BDD, 0 nouvelle dépendance, 0 régression

**Pas d'ADR** : généralisation de pattern existant (`LegalNavMenu` → `NavGroupMenu`). DEC-117 LOCKED.

## 2026-06-08 — Phase 06.37 livrée localement (exports §5.23 partiel : courses CSV + stats CSV + PDF récap chauffeur)

Comble une partie du creux CdC §5.23 avec les **briques déjà en place** : zéro dépendance, zéro achat. Lot d'ajout sur existant, faible risque.

**NB renumérotation** : le prompt cadrait Phase 06.36 / DEC-115, mais ces numéros avaient été utilisés par l'incarnation header (livrée 06.36 #262). Renumérotation Phase 06.37 / DEC-116 pour éviter la collision.

### Pourquoi

CdC §5.23 demande : export comptable CSV, export statistique CSV, export PDF par chauffeur/période. Tout est faisable AVEC L'EXISTANT :
- `lib/csv.ts` + pattern `exportCaisseCsvAction`.
- `lib/pdf/pdf-template.tsx` + pattern route `/api/admin/facturation/pdf`.

**HORS périmètre, repoussés (registre)** : Lomaco (format externe inconnu) ; FEC normé (à délibérer).

### D-01 — Export CSV des courses

`actions/export-rides.ts` :
- Zod `{ from, to, driverId?, status?, transportMode? }` + refine `from ≤ to`.
- Guard `requireAdminOrRegulateur`.
- Query RLS scoppée + hydratation labels patient/chauffeur (pas de FK polymorphe).
- Colonnes : Date RDV, Patient, Départ, Destination, Mode transport, Statut, Chauffeur, Tarif (€).
- Filename : `courses_AAAA-MM-JJ_AAAA-MM-JJ.csv`.

UI : `<ExportCsvButton>` (variant outline, pas terracotta — exporter ≠ moment-clé) dans la toolbar `RidesList`. Période par défaut : 30 derniers jours si pas de filtre date, sinon jour entier.

### D-02 — Export statistique CSV

`tableau-de-bord/_lib/export-stats.ts` :
- Guard `requireDirigeant`.
- **Réutilise `getDashboardData()`** — 0 duplication d'agrégat.
- Sections : Volume, Incidents, Chauffeurs, CA + comparatif N-1 (mois précédent).
- Filename : `stats_AAAA-MM.csv`.

UI : `<ExportStatsButton>` dans le slot `actions` du PageHeader tableau de bord.

### D-03 — Export PDF récap chauffeur / période

Route `app/api/admin/chauffeurs/recap/pdf/route.tsx` :
- `runtime nodejs` + `renderToStream` (pattern facturation).
- Params `?driver=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Guard rôle dirigeant + **audit log AVANT** le rendu (`chauffeur.recap.exported_pdf`).
- Réutilise `PdfDocument` + `PdfSection` + `pdfStyles` (charte commune facturation).
- Sections : Résumé (count + count terminées + total €) + Détail tableau (date/patient/trajet/statut/tarif).

UI : `<RecapPdfButton>` dans `DriverRowActions` (visible **dirigeant uniquement**) — dialog mini-form from/to → ouvre la route dans un nouvel onglet.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean
- 0 migration BDD, 0 nouvelle dépendance, 0 régression
- Guards rôle + RLS Postgres préservés ✓
- RGPD minimisation : pas de données médicales (notes opérationnelles, NIR) dans les exports ✓
- Pas de terracotta sur les exports (boutons outline normaux) ✓

**DEC-116 LOCKED**. Pas d'ADR (réutilisation de patterns existants).

## 2026-06-08 — Phase 06.36 livrée localement (incarnation header / navigation principale)

Incarnation du header global (app + admin). **Angle mort des lots 06.24 → 06.32** comblé : la direction §3 prévoit explicitement que la navigation porte l'identité, mais le header restait générique. « Moderne » ≠ « coloré » — on ajoute hiérarchie + présence + signature, pas de la couleur.

### Pourquoi (cité)

Direction §3 : « Bleu profond = la structure de confiance : navigation active, liens, en-têtes de section, identité. Présent mais sobre. »

État avant : onglet actif `text-foreground` (gris) + soulignement `bg-primary` 2px opacité → invisible au coup d'œil. Logo `text-foreground` neutre. Séparation header/contenu via `border-b` seul, imperceptible.

### D-01 — Onglet actif = signature bleue sobre

| Aspect | Avant | Après |
|---|---|---|
| Texte actif | `text-foreground font-medium` | **`text-primary font-medium`** |
| Soulignement | `h-[2px]` + opacity-0/100 | **`h-[3px] rounded-t-sm`** + opacity-0/100 |

Double signal (couleur + poids + soulignement, WCAG 1.4.1).

### D-02 — Logo « TAP » présence de marque

- « **TAP** » : `text-foreground` → **`text-primary text-base font-semibold tracking-tight`**.
- « Régulation » : `text-muted-foreground` (inchangé).

Sobre — la marque porte l'identité, l'étiquette reste discrète.

### D-03 — Séparation header / contenu

`shadow-sm` ajouté au header (en plus du `border-b`). Sticky + backdrop-blur conservés.

### D-04 — Cohérence app + admin via factorisation

`components/app-header.tsx` (Server Component) — slot `extras` pour `DraftQueue` côté `(app)` :

- `(app)/layout.tsx` : `<AppHeader role={ctx.role} extras={<DraftQueue />} />`
- `(admin)/layout.tsx` : `<AppHeader role={role} />`

Les deux layouts passent de ~30 lignes de header dupliqué à 1 ligne. Toute évolution future d'incarnation header se fait à 1 endroit.

### Contraste WCAG vérifié

- `text-primary` (hsl 217 92% 32%) sur blanc : **9.42:1 (AAA)**.
- `text-primary` nuit (hsl 217 91% 60%) sur fond sombre (hsl 222 47% 8%) : **5.21:1 (AA)**.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean
- Header chauffeur PWA hors périmètre (grammaire dédiée DEC-014) ✓
- 0 migration BDD, 0 dépendance, 0 régression ✓

**Pas d'ADR** : activation de pattern (text-primary, shadow-sm) + factorisation rétro-compatible. DEC-115 LOCKED.

## 2026-06-08 — Phase 06.35 livrée localement (Conformité lot 3 : contrôle planification — module COMPLET)

Troisième et **dernier** lot du module Conformité (CdC §5.21). Construit le contrôle conformité à la planification : avertissement souple par défaut, blocage dur paramétrable, appliqué à l'assignation manuelle ET à l'optimiseur.

### Cadrage validé

- **Q4 SOUPLE par défaut, paramétrable vers DUR** : Souple = avertissement (régulatrice garde la main, sa responsabilité). Dur = assignation empêchée. RETEX secteur/FOSS : visibilité prime sur verrou. Défaut = souple.
- **Q5 OPTIMISEUR INCLUS** : contrôle manuel ET auto (sinon contournement).
- **Q6 Granularité GLOBALE** : réglage org unique. Pas de raffinement par type d'échéance V1.

### D-01 — Migration légère

`20260608000002_compliance_blocking_mode.sql` : ajout colonne `compliance_blocking_mode text not null default 'warn' check (in 'warn','block')` sur `organizations`. Pas de table settings (Q6 global = 1 colonne suffit).

### D-02 — Helper niveau entité

`packages/shared/src/utils/entity-compliance-state.ts` :
- `entityComplianceState(items, today?)` → `{ hasExpired, hasSoon, worstStatus }`.
- `isPlanningBlocking(state)` → `boolean` (critère = au moins une échéance expirée).
- **8 tests Vitest verts**.

### D-03 — Assign-modal

- `getAssignmentComplianceContextAction` (round-trip unique : mode + lookup) via useQuery.
- Badge **« Non conforme »** (icône `AlertCircle` + texte, WCAG 1.4.1) sur chauffeurs avec ≥1 échéance expirée.
- **Mode `warn`** : ligne sélectionnable + panneau d'avertissement « Entité non conforme — assignation sous votre responsabilité » + toast `warning` au succès.
- **Mode `block`** : ligne **désactivée** (`disabled`, `aria-disabled`, opacité 60) + submit refusé client + **revérif serveur dans `assignRideAction`** (defense in depth).

### D-04 — Optimiseur

`POST /api/optimizer` :
- Lit `compliance_blocking_mode` + lookup véhicules.
- Mode `warn` : tous au solveur + signalement via `proposal.complianceWarnings`.
- Mode `block` : véhicules non conformes filtrés du pool envoyé au solveur + `complianceWarnings.blocked=true`.
- UI `optimization-shell` affiche `<ComplianceOptimizerWarnings>` (panneau dédié, icône + texte + lien `/admin/conformite`).
- Extension `OptimizationProposal.complianceWarnings?` (`@tap/optimizer-client`) — rétro-compatible.

### D-06 — Réglage UI dirigeant

`<BlockingModeControl>` SegmentedControl Avertir/Bloquer dans `/admin/conformite` (réservé dirigeant) + `updateComplianceBlockingModeAction` (DEC-041 row-count check). Texte explicatif sobre.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 web + 114/114 shared verts** (8 nouveaux tests entity-compliance-state)
- `pnpm build` vert
- `pnpm lint` clean
- 1 migration BDD (colonne org), 0 cron, 0 dépendance
- Defense in depth : mode block revérifié serveur ✓
- WCAG 1.4.1 : non-conformité = icône + texte ✓

### Module Conformité §5.21 COMPLET

| Lot | Phase | Statut |
|---|---|---|
| 1 — Fondation (modèle + saisie + statut + badges) | 06.33 | ✅ #259 |
| 2 — Alertes in-app (cockpit + dashboard) | 06.34 | ✅ #260 |
| 3 — Contrôle planification souple/paramétrable | 06.35 | ✅ cette PR |

**DEC-114 LOCKED**. Pas d'ADR séparé (colonne simple, cohérent ADR-013).

## 2026-06-08 — Phase 06.34 livrée localement (Conformité lot 2 : alertes in-app cockpit + dashboard)

Deuxième lot du module Conformité (CdC §5.21). Construit les alertes d'échéance **IN-APP** dérivées. Suit le cadrage GSD validé (discuss clos avec le dirigeant).

### Cadrage validé

- **Q1 IN-APP uniquement** : cockpit (régulateur) + dashboard (dirigeant). Email/push = branchement d'infra REPOUSSÉ (principe : on construit la fonctionnalité, pas l'infra).
- **Q2 DÉRIVÉ** : statut/alerte calculés à la volée depuis `compliance_items` vs date du jour. PAS de table d'alertes stockées, pas d'accusé de lecture.
- **Cron pg_cron : NON** au lot 2 (affichage dérivé suffit ; le cron servira au futur canal externe).

### D-01 — Helper pur sélection/tri (`@tap/shared`)

`packages/shared/src/utils/compliance-alerts.ts` :
- `selectComplianceAlerts(items, today?)` : filtre `soon` (≤ 90 j) + `expired`, tri par urgence (expired plus passé en haut, puis soon ascendant).
- `countComplianceAlerts(alerts)` : buckets `{ expired, soon, total }`.
- Module pur sans dépendance React/Supabase. Partagé cockpit + dashboard + futur canal externe sans refonte.
- **9 tests Vitest verts** (filtre, tri, borne 90 j, buckets).

### D-04 — Query serveur partagée

`apps/web/src/app/(admin)/admin/conformite/_lib/get-compliance-alerts.ts` :
- `getComplianceAlerts()` (`'server-only'`) : lit `compliance_items` (RLS `same_org`), applique `selectComplianceAlerts`, hydrate labels entité (driver/vehicle/organization) en 2 lookups applicatifs (pas de FK polymorphe SQL, cf. ADR-013).

### D-02 / D-03 — Affichage

`<ComplianceAlertsPanel>` (client component) :
- Variant `panel` (cockpit, dense, sous `<AlertsPanel>` courses, limit 4).
- Variant `card` (dashboard, bordée, dans grid `lg:grid-cols-2` à côté du `<ComplianceCard>` RGPD, limit 5).
- Compteur + liste compacte (entité, type, `<ComplianceBadge>` compact).
- Lien « Gérer les échéances » → `/admin/conformite`.
- Si zéro alerte : message court « Aucune échéance à surveiller. »
- Pas de terracotta (vigilance, pas moment-clé).
- WCAG 1.4.1 : icône + texte + jours (pas couleur seule).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 web + 106/106 shared verts** (9 nouveaux tests compliance-alerts)
- `pnpm build` vert
- `pnpm lint` clean
- 0 migration BDD, 0 cron, 0 dépendance ajoutée
- Source d'alerte partagée cockpit/dashboard : `getComplianceAlerts` + `selectComplianceAlerts` réutilisés (0 duplication)

**DEC-113 LOCKED**. Lot 3 (blocage paramétrable planification) à venir. Pas d'ADR (pas de nouveau modèle, cohérent ADR-013).

## 2026-06-08 — Phase 06.33 livrée localement (Conformité réglementaire CdC §5.21 lot 1)

Premier lot du module **Conformité réglementaire métier** (CdC §5.21, V1 §2.1 « Suivi des échéances réglementaires »). Pose le socle ; les alertes et le blocage planification sont les lots 2 et 3.

### Pourquoi

Aucun suivi d'échéance n'existait — risque légal réel (exploitation de chauffeurs/véhicules dont les pièces sont périmées). **Distinct du `ComplianceCard` RGPD documentaire** (registre/DPA/DPIA, sous-domaine /admin/legal).

### D-01 — Table dédiée `compliance_items` (ADR-013)

Modèle polymorphe driver/vehicle/organization (8 types CHECK) — choix justifié vs colonnes éparses dans ADR-013 (flexibilité + multi-versions convention CGSS + cron lot 2 simple + RLS uniforme).

- Migration `20260608000001_compliance_items.sql` : table, indexes (alerte + lecture), RLS forcée (SELECT same_org / INSERT/UPDATE dirigeant ; pas de DELETE), trigger audit pattern vehicles.
- pgTAP `supabase/tests/compliance_items_rls.sql` : **10 cas** (RLS activée/forcée, INSERT org+driver, count visibilité, INSERT régulateur refusé, cross-tenant, anon refusé, CHECK entity_id).

### D-02 — Validators + libellés centralisés (NFR-001)

`packages/shared/src/validators/compliance.ts` :
- `COMPLIANCE_KINDS` (8 valeurs `as const`).
- `COMPLIANCE_LABELS` (libellés FR, 1 mapping unique).
- `COMPLIANCE_KINDS_BY_ENTITY` (sections pré-définies UI).
- `complianceItemUpsertSchema` zod avec `refine` cohérence entity_type ↔ entity_id.

### D-04 — Helper `complianceStatus` pur

`packages/shared/src/utils/compliance-status.ts` :
- `complianceStatus(expiresAt, today?)` → `{ status, daysUntilExpiry }` (90/60/30/7 j seuil unique `soon`).
- `complianceAlertStep` pour le franchissement exact (cron lot 2).
- **14 tests Vitest verts**.

### D-03 — Saisie dans les écrans existants

- **`<ComplianceFieldset>`** : section « Conformité réglementaire » embarquée dans `driver-form` + `vehicle-form` (mode édition uniquement). Slots pré-définis selon l'entité, save inline par slot (référence + délivrance + échéance + badge).
- **Server Actions** `actions.ts` : `upsertComplianceItemAction` (DEC-041 row-count check sur UPDATE), `archiveComplianceItemAction`, `listComplianceItemsForEntityAction`.
- **Page `/admin/conformite`** : vue consolidée 3 sections (Convention CGSS organisation + Chauffeurs + Véhicules) + 3 cards résumé (expirées / proches / total) + tableau filtré par entité.
- **Entrée nav « Conformité »** ajoutée dans `DIRIGEANT_TABS`.

### D-05 — Badge dans les listes (WCAG 1.4.1)

- **`<ComplianceBadge>`** : icône + texte + jours (« À jour », « Échéance proche (15 j) », « Expirée (il y a 3 j) »), tokens sémantiques `text-success`/`text-warning`/`text-destructive`. **Pas couleur seule** (WCAG 1.4.1).
- Colonne « Conformité » dans **drivers-list** et **vehicles-list** : prochaine échéance par entité fetchée dans le RSC, passée via prop.

### Lot 1 fini, à venir

✅ Inclus : migration + RLS/pgTAP + helpers + saisie + badges + page conformité.

🟦 **Lot 2** : cron quotidien → alertes cockpit + email (90/60/30/7).
🟦 **Lot 3** : blocage paramétrable planification (échéance critique expirée).
🟦 Upload de scan `document_url` : différé (bucket HDS).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 web + 97/97 shared verts** (14 nouveaux tests compliance-status)
- `pnpm build` vert
- `pnpm lint` clean
- pgTAP : 10 cas couverts
- 0 hex en dur, 0 hardcode types (NFR-001), 0 régression existante

**ADR-013 + DEC-112 LOCKED**.

## 2026-06-05 — Phase 06.32 livrée localement (incarnation Auth + Public — léger)

Incarnation de DEC-101 sur **Auth + Public**. Lot **TRÈS léger** : ces familles ont déjà des grammaires dédiées appropriées (`<AuthShell>` pour auth, prose MDX pour pages légales, parcours patient RGPD). Pas de refonte.

### Constat d'audit

- Auth (login, accept-invite) : `<AuthShell>` avec layout 2 colonnes plein écran + theming — grammaire DÉDIÉE appropriée. Déjà traité en 06.18. PageHeader n'a PAS de sens ici.
- Public/légal MDX (cgu, cgv, confidentialite, cookies, dpo) : documents `prose prose-sm`, titre via frontmatter. Mise en page document appropriée.
- Parcours RGPD patient (request/[token], /access, /erasure) : écrans publics où un patient exerce ses droits.

### D-01 — Terracotta sur 3 moments-clés (peu nombreux)

| Fichier | CTA | Variante |
|---|---|---|
| `(auth)/login/login-form.client.tsx` | « Se connecter » | `variant="accent"` |
| `(auth)/accept-invite/_components/accept-invite-form.client.tsx` | « Activer mon compte » | `variant="accent"` |
| `(public)/legal/request/[token]/erasure/_components/erasure-client.client.tsx` | « Confirmer l'anonymisation » | `variant="accent"` (était `destructive`) |

**Justification erasure** : action irréversible MAIS c'est l'**acte attendu** que le patient vient accomplir (exercer son droit RGPD), pas une action de vigilance subie côté admin. Le contexte d'avertissement reste fort (panneau `border-destructive/40 bg-destructive/5`, message explicite d'irréversibilité, conservation 5 ans CGSS expliquée).

**NE PAS toucher** : « Demander l'effacement de mes données » (opener, reste destructive) ; « Vérifier mon identité » (étape préalable) ; « Télécharger JSON » (Exporter neutre) ; Annuler/liens/navigation.

### D-02 — Lisibilité prose RGPD patient (public non-technique)

Promotion ciblée `text-sm` → **`text-base`** sur les paragraphes pédagogiques des parcours patient (esprit direction §6 « grande/lisible » étendu au public non-technique) :

- `request/[token]/page.tsx` : description « Pour exercer votre droit… » + message « Lien invalide ou expiré »
- `erasure/page.tsx` : description « Conformément à l'article 17… » + section « Conservation légale »
- `erasure/_components/erasure-client.client.tsx` : « Effacement effectué » + « Confirmer l'anonymisation »
- `access/page.tsx` : description « Conformément aux articles 15 et 20… » + « En cas de désaccord… »

**Ton inchangé** : zod errors français déjà clairs ; InvitationErrorPanel déjà orienté solution ; page « Lien invalide » oriente vers le service client.

### D-03 — Ne PAS faire

Pas de PageHeader sur auth/légal. Pas de refonte MDX. Pas de skeleton sur pages statiques légales.

### Annexe — Audit animation (système DÉJÀ conforme)

L'audit conclut que le système d'animation est complet et conforme à la direction §5 — pas de lot transversal nécessaire :

- Tokens motion existent (`tokens.json`) + câblés dans `tailwind.config.ts` (DEFAULT 150ms + ease-out de référence).
- `prefers-reduced-motion` géré GLOBALEMENT (`globals.css:30-37` : `*` → 0.01ms).
- Durées cohérentes (27× duration-150 ; 200/300/500 sur entrées modales/sheets = légitimes).

**Micro-finition appliquée** : `components/ui/skeleton.tsx` ajout local `motion-reduce:animate-none` à la classe (en complément du global, auto-doc/robustesse hors contexte global). C'est tout.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean
- `grep 'variant="accent"' (auth) (public)` → **3** (conforme cible « peu nombreux »)
- WCAG AA (terracotta 4.61:1) ✓
- 0 hex en dur, 0 nouvelle dépendance, 0 migration BDD

**Pas d'ADR** : activation de pattern (variant accent), promotion de prose, durcissement local rétro-compatible. DEC-111 LOCKED.

## 2026-06-05 — Phase 06.31 livrée localement (composant SegmentedControl sobre)

Création d'un composant `<SegmentedControl>` propre et factorisation des 3 duplications du toggle « Actifs / Archivés » daté.

### Constat (pourquoi c'est pas acceptable)

Toggle fait main, **dupliqué dans 3 écrans** (patients-list, drivers-list, assign-modal), classes identiques. Défauts précis :
- Conteneur `p-2` (2px) trop serré → pastille active colle aux bords.
- Différenciation portée par une **OMBRE seule** (`bg-background shadow-sm` sur `bg-muted/40`) → aspect « bouton enfoncé » daté.
- Actif sans poids typo (juste `text-foreground`).
- Pas de transition de la pastille, pas de focus ring soigné.

### D-01 — `<SegmentedControl>` + `<SegmentedNav>` créés

`components/ui/segmented-control.tsx` (**126 LOC** < limite 150) :
- **`<SegmentedControl>`** : segments = `<button>`, usage state local.
- **`<SegmentedNav>`** : segments = `<Link>`, usage navigation URL.

Choix de séparation : 2 composants plutôt qu'un seul avec prop optionnelle `href`. Avantage : types stricts, API plus claire, même 126 LOC restent < 150.

API générique `<T extends string>` :

```ts
interface SegmentOption<T extends string> { value: T; label: ReactNode; }
interface SegmentedControlProps<T> { options, value, onValueChange, ariaLabel, className? }
interface SegmentedNavOption<T extends string> extends SegmentOption<T> { href: LinkProps['href']; }
```

Cible visuelle (sobre Linear/iOS) :
- Conteneur `bg-muted rounded-lg p-4 gap-4` (pas de bordure).
- Actif `bg-background + text-foreground + font-medium + shadow-sm`.
- Inactif `text-muted-foreground` + hover `bg-background/50`.
- Transition `transition-all duration-150` (grammaire animation §5).
- Focus ring `ring-2 ring-ring ring-offset-2 ring-offset-muted`.
- 0 hex en dur, tokens uniquement (jour+nuit OK).

### D-02 — 3 duplications remplacées

| Fichier | Avant (LOC inline) | Après |
|---|---|---|
| `(app)/patients/_components/patients-list.client.tsx` | 30 lignes div + 2 buttons | `<SegmentedControl value={scope} onValueChange={setScope} ... />` |
| `(admin)/admin/chauffeurs/_components/drivers-list.client.tsx` | `ViewToggle` 36 lignes (Links) | `<SegmentedNav<Vue> ... />` |
| `(app)/courses/_components/assign-modal.client.tsx` | 35 lignes boolean toggle | `<SegmentedControl<'compat'\|'all'>` avec mapping boolean ↔ string |

**Comportement strictement INCHANGÉ** : mêmes valeurs, même filtrage, même navigation, mêmes aria-labels. Conséquences : `import { cn }` et `import Link` retirés là où non utilisés.

### D-04 — Doc design-system

`docs/design-system/09-segmented-control.md` (5 sections : pourquoi, API, cible visuelle, a11y, quand l'utiliser, usages).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts SANS modification des tests** (comportement préservé)
- `pnpm build` vert
- `pnpm lint` clean
- `grep 'bg-muted/40 inline-flex rounded-md border p-2'` → **0** (toutes duplications éliminées)
- `grep 'SegmentedControl|SegmentedNav'` dans `(app)` → **3 usages**
- 0 hex en dur, 0 nouvelle dépendance, 0 migration BDD

**Pas d'ADR** : lot de finition design system (composant utilitaire). DEC-110bis LOCKED.

## 2026-06-05 — Phase 06.30 livrée localement (incarnation Admin — terracotta + skeletons + typo)

Incarnation de DEC-101 sur la famille Admin (16 écrans, DÉJÀ la plus cohérente avec PageHeader partout). Lot ciblé : terracotta moments-clés + skeletons + hiérarchie typo.

### Constat d'audit

**Déjà bon — ne pas casser** : 16 écrans tous en `PageHeader`, sous-domaine légal (8 pages) homogène (même pattern descriptions pédagogiques + actions), 6 écrans avec titres de section.

**Écarts à combler** :
1. Terracotta : 0 usage dans `(admin)` (comme régulation avant lot 2).
2. `loading.tsx` : 0 sur 6 écrans qui chargent.
3. Hiérarchie typo écrasée : 77 `text-sm` / 25 `text-xs` / **4 `text-base`**.

### D-01 — Terracotta sur 13 moments-clés admin

**8 page-level CTAs** :
- chauffeurs : « Nouveau chauffeur » + EmptyState « Inviter un chauffeur »
- vehicules : « Nouveau véhicule » + EmptyState « Ajouter un véhicule »
- legal/dpa : « Nouveau DPA »
- legal/registre : « Nouvelle entrée » (PageHeader actions)
- legal/requests : « Nouvelle demande »
- legal/dpia : « Créer une trame DPIA » (asChild Link)

**5 sheet/drawer submits** :
- tarifs : « Créer la version » (submit)
- legal/registre : « Enregistrer » (submit)
- legal/requests : « Créer » (submit)
- legal/dpa : « Enregistrer » (submit)
- chauffeurs : « Envoyer l'invitation » (submit)

**NE PAS** : ARCHIVER reste `destructive`, Modifier/Pré-remplir/Exporter/Annuler restent neutres.

**Extension légère `EmptyState`** : ajout prop optionnelle `variant?: 'default' | 'accent'` sur action (rétro-compatible — `default` conservé partout ailleurs).

### D-02 — 6 `loading.tsx` épousant le layout réel

| Écran | Structure skeleton |
|---|---|
| `chauffeurs` | En-tête + CTA, table 8 lignes |
| `vehicules` | En-tête + CTA, table 6 lignes |
| `tarifs` | En-tête, card grille active (titre + 5 lignes clé/valeur), historique 3 lignes |
| `facturation` | En-tête + description, sélecteur mois, section aperçu (totaux 3 cards + lignes + CTA PDF) |
| `legal/registre` | En-tête + 2 CTA, table 6 lignes |
| `legal/requests` | En-tête + CTA, table 5 lignes |

`prefers-reduced-motion` couvert par règle globale `globals.css`.

### D-03 — Hiérarchie typo travaillée

Promotion ciblée des **corps de lecture réels** (paragraphes explicatifs, pas légendes) :

- Prose légale (DPA prefill review, registre prefill review, DPIA prefill confirm) `text-sm` → **`text-base`** (paragraphes pédagogiques de plusieurs lignes).
- Cards titre `legal/page.tsx` `text-sm font-semibold` → `text-base font-semibold` (cohérent panel-title pattern).
- Maintenance : titres section `text-sm` → `text-base` ; descriptions `text-xs` → `text-sm`.
- DPA prefill card help text `text-xs` → `text-sm`.
- Archive driver modal help text `text-xs` → `text-sm`.

**Résultats** :

| Classe | Avant | Après | Δ |
|---|---|---|---|
| `text-base` | 4 | **10** | **+150 %** |
| `text-sm` | 77 | 75 | -2 |
| `text-xs` | 25 | **21** | **-16 %** |

Tables/listes denses préservées (`text-sm`) — densité admin assumée.

### D-04 — Cohérence légale vérifiée

8 pages légales déjà homogènes (PageHeader unifié, descriptions cohérentes depuis 06.6 + 06.29). Vérifié que terracotta est appliqué de façon cohérente (pattern page-button + drawer-submit) sur les 4 sous-domaines (DPA, DPIA, registre, requests). Pas de refonte.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- `grep -rn 'variant="accent"' "apps/web/src/app/(admin)" | wc -l` → 11 (lignes), 13 occurrences logiques (2 dans EmptyState via variant prop)
- 6/6 `loading.tsx` présents sur les écrans à fetch admin
- 0 hex ajouté, 0 nouvelle dépendance, 0 migration BDD

**Pas d'ADR** : activation et déclinaison de patterns existants (variant accent, loading.tsx, Skeleton). Extension légère et rétro-compatible de `EmptyState`. DEC-110 LOCKED.

## 2026-06-05 — Phase 06.29 livrée localement (typo française : chasse aux cadratins UI)

Lot transversal de finition typographique. Le tiret cadratin (—) était utilisé comme incise en prose d'UI (~280 occurrences brutes, ~50 réellement visibles après filtre) — pas la ponctuation française idiomatique. Corrigé en typo française correcte selon le **sens** de chaque phrase.

### Pourquoi

Tic d'écriture généralisé. En français, l'incise « X — précision » se rend par deux-points, parenthèses, virgule ou point, pas par le cadratin anglo-saxon. Cohérence avec direction §4 (ton français humain).

### Périmètre — TROIS cas distingués

- **A. CORRIGÉ** : incises en prose d'UI visible (descriptions, labels, titres, messages, toasts, placeholders).
- **B. PRÉSERVÉ** : `'—'` cadratin seul = séparateur « valeur absente » (`return '—'`, `{value || '—'}`). 20 occurrences vérifiées intactes.
- **C. IGNORÉ** : commentaires (`//`, `/* */`, JSDoc, JSX `{/* */}`) + descriptions de tests. Hors périmètre, diff propre.

### D-01 — Choix de ponctuation selon le SENS

- **Deux-points** quand le second membre explicite/précise le premier (cas le plus fréquent). Ex : « Distance non disponible — forfait... » → « Distance non disponible : forfait... »
- **Point** quand deux idées autonomes. Ex : « ...nouvelle version datée — l'historique est conservé. » → « ...nouvelle version datée. L'historique est conservé. »
- **Virgule** pour apposition courte. Ex : « Né(e) le X — homme » → « Né(e) le X, homme »
- **Parenthèses** pour aparté. Ex : « Plan proposé — affiché en premier sur petit écran » → « Plan proposé (affiché en premier sur petit écran) »
- **Point médian `·`** pour titres/labels-séparateurs (non-prose). Ex : `'TAP Réunion — Régulation'` → `'TAP Réunion · Régulation'` ; tab titles, vehicle labels, ride pickers.

### Familles touchées

| Famille | Corrections |
|---|---|
| `(driver)` | 4 fichiers : toasts « sync au retour réseau » ; consentement géoloc ; `install-pwa-banner` debug ; `geoloc-consent-banner` |
| `(app)` patients | 4 fichiers : `PageHeader title="Modifier — Nom"` ; constraints `${type} — ${note}` ; recurrence preview ; recurrence-edit-modal |
| `(app)` cockpit | 3 fichiers : `aria-label="Patient absent — décision"` ; driver positions « Chauffeur — vu... » → `·` ; comparative/excluded-rides optimisation |
| `(app)` courses | 3 fichiers : duplicate-banner ; pricing-breakdown ; address-or-poi-picker |
| `(admin)` legal | 8 fichiers : PageHeader descriptions RGPD ; DPIA title ; DPA prefill ; breaches/requests/registre |
| `(admin)` facturation/tarifs | 4 fichiers : PDF entêtes (`·`) ; descriptions ; tariff sheet |
| `(admin)` sms-templates | 2 fichiers : `— vide —` → `(vide)` |
| `(auth)` | 1 fichier : `auth-shell` (« TAP — Réunion 974 » → `·`) |
| Layout racine + `(public)` | 2 fichiers : tab titles `· TAP Régulation` |
| `components/` | 2 fichiers : `demo-credentials` ; `user-menu` aria-label |
| optimizer route + content libs | 3 fichiers : `rideLabels` séparateur ; `vehiclesLabels` ; DPIA/registre prefill content |
| Server Actions errors | 15+ fichiers : batch sed sûr `« refusé(e) — droits insuffisants »` → `«  : droits insuffisants »` |

### Tests alignés

- `combobox.test.tsx` : `hint="Liste indicative — saisie libre permise."` → `:` (matche le code en parallèle).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 20 séparateurs-vide `'—'` préservés
- 0 changement de SENS, 0 nouveau wording, 0 migration BDD

**Pas d'ADR** : lot de finition typographique, aucun choix structurel. DEC-109 LOCKED.

## 2026-06-05 — Phase 06.28 livrée localement (incarnation Chauffeur — terrain)

Incarnation de la direction DEC-101 sur la famille Chauffeur (driver). Déclinaison « grande et lisible » de l'âme (DEC-014), pas la densité du cockpit. Lot ciblé : l'écran chauffeur est DÉJÀ le mieux pensé de l'app (cibles 56px, 1 action/écran, tint crème, offline) — on comble 3 écarts précis sans rien casser.

### D-01 — Terracotta sur le moment-clé chauffeur

`ride-actions.client.tsx` : bouton « Démarrer la course » (status `assignee`) passé en `variant="accent"`. C'est le moment-clé d'engagement du chauffeur (cohérence lot 2 DEC-104 : créer/démarrer/valider).

**NE PAS touché** :
- « Clôturer la course » reste en `bg-warning` orange — état de FIN distinct, sémantique d'attention/vigilance, pas un moment-clé d'avancement.
- Badges `success` / neutre inchangés.

Contraste terracotta `hsl(14 78% 46%)` + blanc = 4.61:1 ✓ AA, déjà validé lot 2.

### D-02 — En-tête harmonisé

`/conduite/page.tsx` :
- `<h1>` + `<header>` manuels → migrés vers **`<PageHeader>`** avec slot `actions` portant le compteur de courses. Cohérence grammaire avec cockpit + lot 1.
- Empty state « Aucune course planifiée » harmonisé : titre `text-lg` → **`text-2xl font-semibold tracking-tight`** ; libellé « **Pas de course pour l'instant** » + « Vos prochaines courses apparaîtront ici dès qu'elles vous seront assignées. » (description passée à `text-base` — terrain = grande lecture, DEC-101 §6).

### D-03 — Mode contraste élevé (DEC-014, le vrai manque terrain)

Implémentation socle complète :

1. **Hook `useHighContrast`** (`lib/use-high-contrast.client.ts`) — patterné sur `useTheme` : lit/persiste `localStorage['driver-contrast']`, applique `data-driver-contrast="high"` sur `<html>`, **auto-active si l'OS signale `prefers-contrast: more`** au premier mount.
2. **`<HighContrastToggle>`** — icône Contrast Lucide, posée dans le header driver entre `ConnectionStatusBadge` et `UserMenu` (cible 40px, `aria-pressed`, label parlant).
3. **CSS overrides dans `globals.css`** sous `[data-driver-contrast='high']` et `@media (prefers-contrast: more)` :
   - `--border` `214 32% 91%` → **`214 50% 45%`** (gris bleuté tranché, en clair)
   - `--input` aligné sur border
   - `--muted-foreground` `215 16% 47%` → **`215 30% 25%`** (texte secondaire plus foncé)
   - Variantes dark (border 75%, muted 85%)
4. **0 hex en dur** — uniquement overrides de CSS vars HSL.

Le `--foreground` n'est pas touché (déjà très foncé/clair selon thème).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- Cibles tactiles ≥ 56px **préservées** (le bouton Démarrer garde `h-14 w-full text-base font-semibold`)
- Offline-first non régressé (enqueue Dexie, captureCurrentPosition inchangés)
- Tint crème driver intact (`hsl(var(--driver-surface))`)
- DEC-014 respectée, DEC-101 §6 respectée
- 0 hex ajouté, 0 nouvelle dépendance, 0 migration BDD

**Pas d'ADR** : activation et déclinaison de patterns existants (variant accent, PageHeader, hook useTheme-like). DEC-108 LOCKED.

## 2026-06-05 — Lot 5 (rangement) — audit + décision DEC-107 (PAS de refactor, planning-only)

**Cinquième et dernier lot du programme d'incarnation Régulation DEC-101.** Conclusion d'audit : le rangement est déjà sain en pratique ; déplacer les URLs coûterait cher pour zéro gain utilisateur. Ce lot ACTE cette décision, il ne refactore rien.

### Constat d'audit (factuel)

Les 3 « incohérences » soupçonnées au friction log se révèlent bénignes après lecture du code :

1. **Caisse (`/courses/caisse`, onglet niveau 1)** : le surlignage de nav n'est PAS buggé — `nav-tabs.client.tsx` utilise déjà la logique « plus long préfixe gagne » (`activeHref`), avec commentaire explicite « évite que Courses reste souligné en même temps que Caisse ». Donc 1 seul onglet actif. Aucune friction réelle. Reste une légère impureté conceptuelle d'URL sans impact.
2. **Chauffeurs → `/admin/chauffeurs`** : l'accès régulateur est LÉGITIME et géré par les gardes `(admin)/layout.tsx` (dirigeant OU régulateur). Pas une fuite. Le code note déjà « déplacement physique reporté ».
3. **Nav unifiée et découplage ASSUMÉ** : `nav-config.ts` documente déjà « les routes ne sont pas déplacées ; le déplacement `/admin/*` → `/` est un refactor reporté ».

### Coût mesuré d'un déplacement d'URL

18 refs `/admin/chauffeurs` + 7 refs `/courses/caisse` + redirections + mémoire musculaire cassée → **POUR ZÉRO GAIN utilisateur**. Direction §5ter : « le rangement ne se chamboule pas par goût ; tout changement d'URL = à peser ». **Conclusion : NE PAS refactorer.**

### Action

- `.planning/PROJECT.md` registre DEC : **DEC-107 LOCKED**.
- ROADMAP : item « rangement » du programme d'incarnation Régulation marqué comme traité par décision.
- `nav-config.ts` : 1 ligne de commentaire renvoyant à DEC-107 pour tracer que le report est désormais une décision actée, pas un oubli.

**Le programme d'incarnation Régulation DEC-101 est désormais COMPLET** : lot 1 (typo + en-tête), lot 2 (couleur signature), lot 3 (skeletons), lot 4 (refactor + cohérence modales), lot 5 (rangement — décision actée).

## 2026-06-05 — Phase 06.27 livrée localement (incarnation Régulation lot 4 : refactor ride-fields + cohérence modales)

Quatrième lot d'incarnation DEC-101 sur la famille Régulation (§5bis « un écran bien structuré naît d'un code bien structuré »). Refactor structurel du fichier hors-limite + revue de cohérence des modales courses.

### Pourquoi

- `ride-express-form-fields.client.tsx` = **493 lignes** (> limite CON-008 de 300), 4 responsabilités mélangées.
- Direction §5bis : structure du code = structure visuelle.
- Revue légère de cohérence des modales courses.

### D-01 — Découpage de `ride-express-form-fields.client.tsx`

Éclaté en 5 modules sous `courses/_components/ride-fields/` :

| Fichier | LOC | Responsabilité |
|---|---|---|
| `types.ts` | 15 | `TransportMode`, `Urgency`, options. |
| `datetime-helpers.ts` | 79 | Helpers purs date/heure + constantes service. Testable. |
| `masked-inputs.client.tsx` | 110 | `DateMaskedInput`, `TimeMaskedInput`. |
| `datetime-fields.client.tsx` | 175 | `DateTimeFields` (react-datepicker). |
| `field-groups.client.tsx` | 157 | `AddressField`, `ModeUrgencyFields`, `NotesField`, `SavingIndicator`. |
| `index.ts` | 25 | Barrel préservant l'API publique. |

Tous ≤ 175 LOC. Ancien fichier supprimé. 2 imports consommateurs mis à jour (`ride-express-modal`, `use-ride-submit`). **API publique préservée**, comportement strictement inchangé.

### D-02 — Cohérence modales courses

**Documentation du choix Dialog vs Sheet** en 1 ligne sur chaque modale (pas de refonte) :

| Modale | Pattern | Justification |
|---|---|---|
| `ride-express-modal` | Dialog centré | création focalisée |
| `assign-modal` | Dialog centré | action focalisée (engagement choix) |
| `override-tarif-modal` | Sheet latéral | ajustement contextuel |
| `ride-drawer` | Sheet latéral | consultation contextuelle |

**Terracotta sur action « moment-clé »** (cohérence lot 2 DEC-104) :
- `ride-express-modal` « Créer la course » / « Enregistrer les modifications » → `variant="accent"` (créer = moment-clé fondamental).
- `assign-modal` « Assigner » → `variant="accent"` (fait avancer le travail régulatrice).
- `override-tarif-modal` / `ride-payment-popover` « Confirmer » → inchangé (Confirmer-dialogue = neutre, lot 2).

**Footers — primaire à droite** : tous les `DialogFooter`/`SheetFooter` respectent déjà ce placement. Pas d'ajustement nécessaire.

Total `variant="accent"` dans `(app)` : **7** (5 du lot 2 + 2 nouveaux du lot 4) — toujours « max 1 par contexte/modale », rare = fort.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts** SANS modification des tests (refactor pur)
- `pnpm build` vert
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- `find courses/_components -name '*.tsx' -exec wc -l` : plus aucun fichier issu du découpage > 300 l.
- 0 changement de comportement, 0 migration BDD, 0 nouvelle dépendance

**Pas d'ADR** : refactor pur + activation de pattern existant (variant accent posé en lot 2). DEC-106 LOCKED.

## 2026-06-05 — Phase 06.26 livrée localement (incarnation Régulation lot 3 : skeletons + finition empty states)

Troisième lot d'incarnation DEC-101 sur la famille Régulation. Surtout des **skeletons de chargement** (le vrai gap UI) — finition mineure des empty states (déjà largement bons).

### Constat (audit recadre le besoin)

- Empty states : les 4 listes majeures (cockpit, courses, patients, caisse) ont déjà un `EmptyState` accueillant. PAS un chantier.
- **Skeletons : 5 écrans à fetch SANS `loading.tsx`** → page figée/blanche au chargement (`cockpit`, `courses`, `courses/caisse`, `patients`, `patients/[id]`). Seuls `optimisation` et `tableau-de-bord` en avaient un.

### D-01 — 5 `loading.tsx` épousant le layout réel

Chaque skeleton REFLÈTE la structure de sa page (pas un spinner générique) — c'est ce qui produit la perception de vitesse.

| Écran | Structure skeleton |
|---|---|
| `cockpit/loading.tsx` | 2 colonnes : section gauche (en-tête + actions, table 6 lignes, panneau positions) + aside droite (panneau alertes 4 entrées). |
| `courses/loading.tsx` | En-tête + CTA, 4 chips filtres, table 8 lignes. |
| `courses/caisse/loading.tsx` | En-tête, 4 contrôles toolbar, 4 cards résumé, table 6 lignes. |
| `patients/loading.tsx` | En-tête + 2 CTA, recherche, 8 lignes avatar + ligne. |
| `patients/[id]/loading.tsx` | En-tête (nom + Modifier), 4 sections (kicker + 2 lignes). |

Vérification : **7/7 écrans à fetch régulation** ont désormais un `loading.tsx`. Le shimmer du composant `Skeleton` (`animate-pulse`) est capé par la règle globale `globals.css:30-37` (`prefers-reduced-motion: reduce` → animation-duration 0.01ms) — RGAA OK.

### D-02 — Finition empty states (mineur)

Harmonisation du **TON** (français humain, oriente quand une action existe) — sans sur-ingénier.

| Fichier | Avant | Après |
|---|---|---|
| `courses/_components/rides-list.client.tsx` | « Aucune course planifiée pour cette date. » | « Rien de prévu pour cette date. Créez une course pour démarrer la journée. » |
| `courses/caisse/_components/caisse-table.client.tsx` | titre « Aucune course à encaisser » + « Toutes les courses encaissables ont été traitées. » | titre **« Caisse à jour »** + « Toutes les courses encaissables ont été traitées pour cette date. » |

**Préservés** : cockpit empty (pas d'action — remplissage realtime, §4), patients empty (déjà oriente), micro-vides fiche patient (`<p>` simples — sous-sections, pas écrans vides).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert (28 pages)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 7/7 `loading.tsx` présents sur les écrans à fetch régulation
- 0 hex ajouté, 0 nouvelle dépendance, 0 migration BDD

**Pas d'ADR** : activation d'un composant existant + pattern Next.js standard. DEC-105 LOCKED.

## 2026-06-05 — Phase 06.25 livrée localement (incarnation Régulation lot 2 : terracotta moments-clés WCAG AA)

Deuxième lot d'incarnation de la direction artistique DEC-101 sur la famille Régulation. Active la **couleur signature terracotta** sur les CTA des moments-clés. Rare = fort.

### Découverte contraste (cadrage obligatoire)

Le token accent initial `hsl(14 78% 55%)` + texte blanc = **3.53:1 → ÉCHEC WCAG AA texte normal (4.5:1 requis)**. Inutilisable tel quel sur un bouton — a11y non négociable, santé/RGAA. Calcul : assombrir à L=46% pour atteindre AA en jour ET en nuit.

### D-01 — Token accent corrigé jour ET nuit

| Token | Avant | Après | Contraste vs blanc |
|---|---|---|---|
| `color.action.accent` (light) | `hsl(14 78% 55%)` | **`hsl(14 78% 46%)`** | 4.61:1 ✓ AA |
| `color.action.accent` (dark) | `hsl(14 78% 60%)` | **`hsl(14 78% 46%)`** | 6.33:1 ✓ AA |
| `color.text.onAccent` (dark) | `hsl(222 47% 8%)` | **`hsl(0 0% 100%)`** | (basculé pour suivre l'accent assombri) |

RGB final : rgb(209, 69, 26) — terracotta « terre cuite » plus profond, plus sobre qu'un orange vif. Régénération via `pnpm tokens:build`.

### D-02 — Variant Button « accent »

Dans `components/ui/button.tsx` (cva), entre `default` et `destructive` :

```ts
accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
```

Pattern identique au `default`/`destructive`. Le variant `default` (bleu) reste le variant courant.

### D-03 — 5 CTA accentués (liste fermée)

| Fichier | CTA | Acte métier |
|---|---|---|
| `courses/_components/header-new-ride-button.client.tsx` | « Nouvelle course » | **créer** |
| `patients/_components/new-ride-for-patient-button.client.tsx` | « Créer une course pour ce patient » | **créer** |
| `cockpit/optimisation/_components/optimization-shell.client.tsx` | « Lancer le calcul » | **lancer** |
| `cockpit/optimisation/_components/adjust-sheet.client.tsx` | « Valider l'ajustement » | **valider** |
| `courses/_components/ride-drawer.client.tsx` | « Marquer encaissé » | **encaisser** |

Règle de discipline DEC-101 §3 : un moment-clé = une action qui fait AVANCER le travail. Restent neutres : Annuler, Fermer, Modifier, Exporter, Assigner, Archiver, Confirmer-dialogue, liens, badges sémantiques, DialogTitle.

**Vérification** : `grep -rn 'variant="accent"' apps/web/src/app/(app)` → exactement 5 occurrences, pas de débordement. Max 1 bouton accent par écran (validé manuellement).

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- Contraste vérifié par calcul Node : 4.61:1 jour, 6.33:1 nuit, blanc sur terracotta
- 0 hex en dur, passage exclusif par token accent
- DEC-101 §3 respectée (60-30-10, signature rare = forte)

**Pas d'ADR** : correction de token + ajout de variant cva (pattern shadcn standard). Aucun choix structurel nouveau. DEC-104 LOCKED.

## 2026-06-05 — Phase 06.24 reprise livrée localement (en-tête complet + hiérarchie typo travaillée)

Reprise du lot 1 d'incarnation Régulation après audit post-merge #248 : l'en-tête avait été unifié sur 6 écrans mais **3 écrans cœur métier avaient été oubliés**, et la hiérarchie typo n'avait quasi pas bougé (`text-base` 8, `text-xs` monté de 72→87). Cette PR finit le travail.

### D-01 — PageHeader sur les 3 écrans oubliés

| Écran | Migration |
|---|---|
| `patients/new/page.tsx` | `<h1>Nouveau patient</h1>` → `<PageHeader title="Nouveau patient" />` |
| `patients/[id]/edit/page.tsx` | `<h1>Modifier — {nom} {prenom}</h1>` → `<PageHeader title={…} />` |
| `cockpit/optimisation/optimization-shell.client.tsx` | `<header>` manuel (titre dynamique + boutons « ↻ Re-calculer » + « Fermer ») → `<PageHeader title=… actions={…}>` |

**0 `<h1>` manuel `text-2xl` restant dans `(app)`. 9 fichiers importent `PageHeader` (6 → 9).**

### D-02 — Hiérarchie typo : décision CONSCIENTE

Promotion ciblée des **textes de lecture courante** `text-xs` → `text-sm`/`text-base` :

- **Fiche patient `[id]/page.tsx`** : « Né(e) le », téléphone, adresse, préférences → `text-base`.
- **Help text de formulaires** (corps de lecture) : `patient-form-fields` (5×), `patient-form-sections` (1×), `override-tarif-modal` (2×), `ride-patient-picker` (2×), `address-picker-field` (2×) → `text-sm`.
- **Descriptions de panneaux** : `driver-positions-panel` (description `text-xs` → `text-sm` ; empty state `text-sm` → `text-base`).
- **Lien CTA** : `optimization-shell` lien `/admin/maintenance` `text-xs` → `text-sm`.
- **Titre de panneau** : `excluded-rides-section` `text-sm` → `text-base` (aligné autres titres).

**Tables denses NON touchées** (cockpit courses-table, caisse) — densité régulatrice assumée (DEC-101 §5bis).

### D-03 — Convention kicker harmonisée

`tableau-de-bord` (2 titres) passés de `text-sm font-semibold uppercase` → `text-xs font-semibold uppercase tracking-wide` (pattern majoritaire Linear/Stripe). La famille Régulation a maintenant **UNE seule convention** de kicker.

### Résultats mesurables (avant → après reprise)

| Classe | Avant (post-#248) | Après | Δ |
|---|---|---|---|
| `text-2xl` | 7 | **4** | -3 (h1 manuels remplacés) |
| `text-base` | 8 | **15** | **+88 %** ← vrai texte de lecture promu |
| `text-sm` | 115 | 126 | +9 (ex-xs montés) |
| `text-xs` | 87 | **73** | **-16 %** ← corps de texte mal employé en xs réduit |

**Gradation de taille désormais visible** entre corps de lecture (`text-base`/`text-sm`) et légende (`text-xs`), pas seulement par graisse/casse.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- 0 changement de wording, 0 migration BDD, 0 nouvelle dépendance
- DEC-101 §5bis respectée (CONTRASTE par propriété taille + graisse + uppercase + tracking)
- Tables denses préservées (densité assumée, direction §5bis)

**Pas d'ADR** : activation et complétude de pattern (DEC-101 §5bis levier 2). Aucun choix structurel nouveau. DEC-103 LOCKED.

## 2026-06-05 — Phase 06.24 livrée localement (incarnation Régulation lot 1 : PageHeader + hiérarchie typo)

Phase 06.24 « Incarnation Régulation lot 1 » cadrée + exécutée. **Premier lot d'incarnation de la direction artistique DEC-101** sur la famille Régulation. Pose la GRAMMAIRE fondatrice : hiérarchie typographique exprimée + en-tête unifié sur tous les écrans cœur métier. Sans cette grammaire, le reste se poserait sur du sable.

### D-01 — PageHeader unifié sur 6 écrans (app)

| Écran | Migration |
|---|---|
| `cockpit/_components/cockpit-content.client.tsx` | `<header>` manuel → `<PageHeader title="Ma journée" description=… actions={<><Button>Optimiser la journée</Button><RealtimeStatusBadge/></>}>` |
| `courses/page.tsx` | `<PageHeader title="Courses" description={Cmd+K} actions={<HeaderNewRideButton />}>` |
| `courses/caisse/page.tsx` | `<PageHeader title="Caisse" description="Encaissements de la journée…">` |
| `patients/page.tsx` | `<PageHeader title="Patients" actions={<><HeaderNewRideButton /><Button>Nouveau patient</Button></>}>` |
| `patients/[id]/page.tsx` | `<PageHeader title={\`${p.nom} ${p.prenom}\`} actions={<Button>Modifier</Button>}>` |
| `tableau-de-bord/page.tsx` | `<PageHeader title="Tableau de bord" description={période}>` |

**Préservation EXACTE** : titres humains, descriptions, actions (boutons + badges). Aucun changement de wording. Replacement 1:1 du `<h1 className="text-2xl font-semibold tracking-tight">` manuel — mêmes classes finales sur le h1 grâce au composant.

### D-02 — Hiérarchie typographique exprimée

Standardisation du pattern « kicker » (étiquette de section) sur `text-xs font-semibold uppercase tracking-wide` :

- **6 fichiers patients** harmonisés (était `text-sm font-semibold uppercase` sans `tracking-wide`) : `patient-form-note`, `patient-drawer-sections`, `patient-form-constraints`, `patient-form-sections`, `recurrences-section`, `patients/[id]/page.tsx`.
- **Cockpit `alerts-panel`** aligné `text-sm` → `text-xs` pour cohérence.
- **Titres de panneaux** (`text-base font-semibold` pour « Carte des chauffeurs », « Patient absent » modale) **conservés** — représentent un niveau intermédiaire légitime.

**Gradation visible obtenue** :

| Niveau | Pattern | Usage |
|---|---|---|
| Titre page | `text-2xl font-semibold tracking-tight` | PageHeader (1× / page) |
| Titre panneau | `text-base font-semibold` | « Carte des chauffeurs », « Patient absent » |
| Kicker section | `text-xs font-semibold uppercase tracking-wide` | « Alertes », « Identité administrative »… |
| Body lecture | `text-sm` ou `text-base` | descriptions, paragraphes |
| Légende / méta | `text-xs` | compteurs, dates, montants tabular-nums |

C'est le **CONTRASTE par propriété** (taille + graisse + uppercase + tracking) plutôt que par seule taille qui répare la sensation « plate ». Pattern shadcn/Linear standard, cohérent avec la direction DEC-101 §5bis levier 2.

### D-03 — Discipline de périmètre

Pas de couleur (terracotta = lot 3), pas de skeleton/empty (lot 4), pas de refactor courses (lot 5), pas de rangement (lot 6). Lot 1 = typo + en-tête UNIQUEMENT.

### Validation

- `pnpm typecheck` propre
- `pnpm build` vert (28 pages)
- `pnpm test` **129/129 verts** (aucun test cassé)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 `<h1 className="text-2xl">` manuel restant sur les 6 écrans cibles
- 6 fichiers (app) importent `PageHeader`
- 0 migration BDD, 0 changement de wording, 0 nouvelle dépendance

**Pas d'ADR** : activation d'un composant existant + pattern shadcn. DEC-102 LOCKED.

### Hors scope V1

- `patients/new/page.tsx` — formulaire création (hors liste)
- `patients/[id]/edit/page.tsx` — formulaire édition (hors liste)
- `cockpit/optimisation/optimization-shell.client.tsx` — sous-écran (hors liste)

À traiter dans un lot ultérieur si pertinent.

## 2026-06-05 — Gel de la direction artistique (DEC-101)

Direction artistique TAP gelée comme **document fondateur du design-system** : `docs/design-system/00-direction.md`. Le design-system documentait jusqu'ici le COMMENT (tokens, data-tables, page-header) sans le POURQUOI — ce manque est comblé. Le document gouverne toutes les décisions UI futures et l'incarnation famille par famille à venir.

**Validé en discuss 2026-06-05** :
- **Personnalité** : sobre / confiant / situé. Outil de métier sobre et dense, à la rigueur institutionnelle, réchauffé d'une touche réunionnaise discrète.
- **Couleur signature** : bleu institutionnel dominant (`hsl(217 92% 32%)`, gardé « dans la famille » du Département **sans calage pixel**) + terracotta accent du moment-clé (`hsl(14 78% 55%)`) + crème chaud (`hsl(45 100% 98%)`) sur PWA chauffeur + sémantiques (succès / alerte / erreur).
- **Règle d'or** : « une couleur fait le travail ». Terracotta = couleur du moment-clé, JAMAIS décoratif. Cap **near-monochrome + une couleur signature rare**, gravé **60-30-10** + échelle neutre 6-10 paliers.
- **Le near-monochrome ≠ absence de structure.** Quand la couleur ne hiérarchise plus, la STRUCTURE doit tout porter. 5 leviers, sans couleur : espacement = relation (Gestalt), **hiérarchie typographique** (taille + graisse — faiblesse n°1 de TAP), alignement et grille (8px), profondeur subtile (ombres douces), frontières avec parcimonie. S'applique à TOUT (écrans, composants, navigation, code).
- **Structure inter-écrans (architecture de l'information)** : URL reflète la hiérarchie, une famille = un domaine cohérent, nav par rôle, profondeur ≤ 2-3 niveaux pour les tâches fréquentes, nommage = vocabulaire métier. Incohérences relevées (Caisse niveau/URL, argent à 2 endroits, Chauffeurs inter-familles) à arbitrer EN CONTEXTE pendant l'incarnation de la famille concernée.
- **Grammaire d'animation** sourcée Material/NN-g : desktop 150-200 ms, ease-out référence `cubic-bezier(0.0, 0.0, 0.2, 1)` pour apparition/feedback, ease-in-out pour navigation, ≤ 2 effets distincts par écran, `prefers-reduced-motion` respecté.
- **Boussole d'inspiration** : Linear (densité) tempéré Frappe « Espresso » (anti-distraction métier).

**Faiblesses tracées à résoudre** (chantiers d'incarnation) :
1. Hiérarchie typo écrasée (305 `text-sm` / 133 `text-xs`).
2. `PageHeader` absent du cœur métier (cockpit / courses / patients / tableau-de-bord) — 16 fichiers admin uniquement.
3. `loading.tsx` (2/25), empty states (12), skeletons (11) inégaux.
4. Raccourcis clavier localisés (modales seulement).
5. Couleur signature dormante (terracotta 2 usages, tint crème invisible).
6. Grille de page hétérogène.

**Méthode d'incarnation** : famille par famille, ordre métier (Régulation d'abord, plus fort ROI), friction log déduit du code par l'audit + enrichi des retours dirigeant. Geler ensuite dans tokens et composants (terracotta = variant « action-clé » de Button, en-tête = composant imposé).

**Document complémentaire livré** : `docs/design-system/08-horizon-open-source.md` (comparatif Frappe / Twenty / Cal.com / Fleetbase / Linear + cadrage chromatique chiffré RETEX 2026 : 60-30-10, palette fonctionnelle, navy = autorité, orange = accent pas primaire, neutre chaud 2026).

**Lien ajouté** en tête de `docs/design-system/01-foundations.md` : « Lire d'abord : 00-direction.md — le pourquoi du design. »

**Pas d'ADR** (document de direction artistique, pas d'architecture technique). DEC-101 LOCKED dans `PROJECT.md`.

## 2026-06-05 — Phase 06.23 livrée localement (audit DEC-041 + tests métier — bloc pré-prod COMPLET)

Phase 06.23 « Durcissement couche données » cadrée + exécutée. **Clôt la dette DEC-041 reportée Phase 06** et ferme les angles morts mesurés des modules métier critiques. Avec cette PR, le **bloc améliorations pré-prod RETEX 2026-06-04 est COMPLET** (5/5) :

| # | Phase | Statut |
|---|---|---|
| 1 | 06.20 Sentry observabilité | ✅ #243 |
| 2 | 06.21 Tests RLS couverture 13→24 | ✅ #244 |
| 3 | 06.22 Error boundaries par segment | ✅ #245 |
| 4 | 06.23 Audit DEC-041 + tests métier | ✅ **cette PR** |

### Volet A — Audit complet DEC-041 (24 SA)

11 vrais trous comblés sur 24 Server Actions à mutations :

| Action | Avant | Après |
|---|---|---|
| `(auth)/accept-invite` UPDATE driver_invitations | ❌ | ✅ |
| `(auth)/accept-invite` UPDATE drivers | ❌ | ✅ |
| `(app)/courses/assignment::assign` | ❌ | ✅ |
| `(app)/courses/assignment::assignVehicle` | ❌ | ✅ |
| `(app)/courses/assignment::unassign` | ❌ | ✅ |
| `(app)/courses/payment` | ❌ | ✅ |
| `(admin)/admin/legal/dpia::update` | ❌ | ✅ |
| `(admin)/admin/legal/breaches::close` | ❌ | ✅ |
| `(admin)/admin/legal/dpo::save` | ❌ | ✅ |
| `(admin)/admin/legal/requests::token` | ❌ | ✅ |
| `(admin)/admin/legal/requests::updateStatus` | ❌ | ✅ |
| `(admin)/admin/legal/_actions/cgu-accept` | ❌ | ✅ |
| `(admin)/admin/sms-templates::update` | ✅ déjà | ✅ |

Plus 2 N/A documentés :
- `setup/actions` : `url.searchParams.delete` = string ops, pas de mutation BDD.
- `(public)/legal/request/[token]` : `createAdminClient` = service_role bypass RLS légitime (portail patient).

Pattern : `.select('id')` + `if (!data || data.length === 0) return { error: '… refusée — droits insuffisants ou … absente.' }`. Comportement métier inchangé (D-A2).

### Volet B — Tests ciblés angles morts métier

`pnpm exec vitest run --coverage` → identification des branches non couvertes. 3 fichiers de tests / 11 nouveaux tests CIBLÉS (pas de gonflage cosmétique) :

- **`solve-local.edge-cases.test.ts`** (4 tests) : 1 course seule (preFilterRides early return), extension n=3 quand `places_assises ≥ 3`, extension bloquée si capacity dépassée, course TPMR rejetée pendant extension sur véhicule taxi.
- **`geocode-safety-net.edge-cases.test.ts`** (2 tests) : coords sans citycode → null normalisé, BAN citycode vide string → null.
- **`scrub.edge-cases.test.ts`** (5 tests) : tableau d'objets sensibles, `request.query_string` filtré, `request.data` scrubbé récursif, récursion bornée à 6 niveaux sans crash, primitives non-string préservées.

### Couverture branches

| Module | Avant | Après | Δ |
|---|---|---|---|
| `@tap/pricing` | 100 % | 100 % | maintien |
| `@tap/recurrence` | 100 % | 100 % | maintien |
| `lib/optimizer/solve-local.ts` | 90.74 % | **92.42 %** | +1.68 pp |
| `lib/geocoding/geocode-safety-net.ts` | 84.61 % | **100 %** | +15.39 pp |
| `lib/sentry/scrub.ts` | 61.29 % | **77.14 %** | +15.85 pp |

### Validation

- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, Serwist SW vert)
- `pnpm test` **129/129 verts** (+11 nouveaux : 4 solve-local + 2 geocode-safety-net + 5 scrub)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 migration BDD, 0 policy modifiée, 1 nouvelle devDep (`@vitest/coverage-v8`)

**Pas d'ADR** : complétude de patterns/qualité actés (DEC-041 + DEC-013). DEC-100 LOCKED.

## 2026-06-05 — Phase 06.22 livrée localement (error boundaries par segment)

Phase 06.22 « Error boundaries par segment » cadrée + exécutée. **Troisième et dernière amélioration technique pré-prod priorité haute (RETEX 2026-06-04)**. Le bloc priorité haute pré-prod est désormais complet (Sentry + tests RLS + error boundaries).

Avant cette phase : 1 seul `error.tsx` segmenté (tableau-de-bord) + `global-error.tsx` root (06.20). Crash sur cockpit/conduite/admin/public/auth → boundary root (UI brutale) ou écran blanc. Avec Sentry installé (06.20), les boundaries existantes ne remontaient PAS l'erreur — corrigé.

**Composants livrés** :

- `apps/web/src/components/error/segment-error.client.tsx` — gabarit commun. Capture `Sentry.captureException(error, { tags: { segment } })` au mount. UI dégradée `role="alert"` + `aria-live="assertive"` + `autoFocus` sur le bouton Réessayer. Stack visible UNIQUEMENT en dev via `<details>` (jamais en prod). Tokens 06.14 (0 hex). 0 dépendance lourde (pas d'icône Lucide — robustesse si chunk manquant). 5 tests Vitest.

- 5 nouveaux fichiers `error.tsx` aux 5 segments majeurs :
  - `(app)/error.tsx` — régulation
  - `(admin)/error.tsx` — administration
  - `(auth)/error.tsx` — connexion (ne bloque pas la reconnexion)
  - `(public)/error.tsx` — pages légales / publiques
  - `(driver)/error.tsx` — PWA chauffeur générique

- 2 boundaries sous-segments critiques :
  - **`(driver)/conduite/error.tsx`** — terrain offline. Message rassure : « Vos pointages sont sauvegardés sur l'appareil et seront synchronisés au retour du réseau. Aucun pointage n'est perdu. » Bouton Réessayer = `reset()` Next 15 (re-render local, **0 dépendance réseau**), fonctionne offline.
  - **`(app)/cockpit/error.tsx`** — régulatrice 8h/j. Message : « Vos courses et alertes ne sont pas perdues. Réessayez pour rouvrir le cockpit ; la régulation reprendra le contexte courant. »

- Upgrade `(app)/tableau-de-bord/error.tsx` vers le gabarit commun (capture Sentry **ajoutée** — manquait avant 06.22).

**Couverture finale** : 8 fichiers boundary (root + 5 segments + 2 sous-segments + 1 conservé upgraded).

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, Serwist SW vert)
- `pnpm test` **118/118 verts** (+5 nouveaux : segment-error.test.tsx)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 migration BDD

**Pas d'ADR** : activation pattern Next 15 standard. DEC-099 LOCKED.

## 2026-06-05 — Phase 06.21 livrée localement (tests RLS — couverture 13→24 tables)

Phase 06.21 « Tests RLS — couverture complète » cadrée + exécutée. **Deuxième amélioration technique pré-prod RETEX 2026-06-04**. Infra pgTAP déjà en place (CI `supabase test db`, version épinglée 2.98.2 dans `.github/workflows/ci.yml`) — seule la couverture manquait. 24 tables avec RLS, 13 couvertes avant, **11 trous comblés ici**.

**Tables couvertes (11) par sensibilité** :

*Critique — santé / traçabilité patient (3)* :
- `ride_events_rls.sql` — événements/traçabilité des courses (10 vérifs)
- `ride_recurrences_rls.sql` — séries de transport patient (10 vérifs)
- `ride_recurrence_exceptions_rls.sql` — exceptions de séries (8 vérifs)

*Important — RGPD / légal / métier (6)* :
- `cgu_acceptance_rls.sql` — isolation par `profile_id` (PAS par org) (7 vérifs)
- `cookie_consent_log_rls.sql` — `service_role` ONLY (4 vérifs)
- `legal_request_attempts_rls.sql` — `service_role` ONLY (3 vérifs)
- `tariff_grids_rls.sql` — versionnement strict DEC-057 (8 vérifs)
- `sms_messages_rls.sql` — SELECT same_org, écriture service_role (5 vérifs)
- `sms_templates_rls.sql` — référentiel partagé, UPDATE dirigeant (6 vérifs)

*Mineur — référentiels (2)* :
- `pois_metier_rls.sql` — CRUD régulateur/dirigeant (7 vérifs)
- `holidays_974_rls.sql` — référentiel public 974 (4 vérifs)

**Méthode** :
- Gabarit `rides_rls.sql` (Phase 2 Plan 02-02) réutilisé : fixtures Org Alpha `1111…` / Bravo `2222…`, rôles fixés (alpha-dirigeant `aaaa…`, alpha-régulateur `cccc…`, bravo-régulateur `dddd…`, alpha-chauffeur `ffff…`).
- Lecture des policies de CHAQUE table AVANT écriture du test (D-02 : comportement réel, pas générique copié).
- Vérifs standard couvrant les rôles attendus : RLS activée (+ forcée si posée), isolation cross-tenant, WITH CHECK, isolation par rôle, anon refusé.

**Aucune policy modifiée (D-04 strict)** :
- 3 observations `force row level security` non posé tracées en commentaire dans les tests (`ride_events`, `tariff_grids`, `sms_messages`). Pas des trous : rôle `authenticated` ne contourne pas RLS. Choix conservé.
- Aucun trou de sécurité réel détecté — toutes les policies font ce qu'elles disent.

**Validation** :
- `supabase test db` validé en CI (CLI Supabase non dispo localement, mais infra CI épinglée 2.98.2 existe déjà).
- 11 nouveaux fichiers de test (rangés en critique → important → mineur).
- 0 policy modifiée, 0 migration BDD.
- Couverture RLS : **13 → 24 tables** sur 24 tables avec RLS.

**Pas d'ADR** : activation d'un choix de qualité acté (DEC-002 / DEC-013 renforcés). DEC-098 LOCKED.

## 2026-06-05 — Phase 06.20 livrée localement (observabilité Sentry, zéro PII santé)

Phase 06.20 « Observabilité Sentry » cadrée + exécutée. **Première amélioration technique pré-prod RETEX 2026-06-04**. Sentry est dans la stack figée DEC-003 mais n'avait jamais été installé : 33 `console.error` partaient dans le vide en prod, debug à l'aveugle. Activation sans nouvel ADR (choix déjà acté).

**CONTRAINTE CRITIQUE — données de santé** : Sentry ne reçoit JAMAIS de PII patient.

**Composants livrés** :

- `apps/web/package.json` : `@sentry/nextjs` `^8.42.0` (résolu 8.55.2).
- `apps/web/next.config.mjs` : `export default withSentryConfig(withSerwist(nextConfig), { … })`. `errorHandler` non bloquant si upload source maps bute. `tunnelRoute: '/monitoring'` (anti-adblock). `hideSourceMaps: true`.
- `apps/web/instrumentation-client.ts` : `Sentry.init` client. **`sendDefaultPii: false`**. `enabled` que en prod. `tracesSampleRate` 1.0 preview / 0.1 prod. Replay OFF (laissé en commentaire avec `maskAllText: true` + `blockAllMedia: true` si réactivé). `onRouterTransitionStart = Sentry.captureRouterTransitionStart`. `beforeBreadcrumb` retire les query strings URL fetch/xhr.
- `apps/web/sentry.server.config.ts` : init Node runtime, scrubbing.
- `apps/web/sentry.edge.config.ts` : init Edge runtime, scrubbing.
- `apps/web/instrumentation.ts` : `register()` qui import server/edge selon `NEXT_RUNTIME`. **`export const onRequestError = Sentry.captureRequestError`** (capte RSC + Server Actions Next 15 — sans ça, warning build + erreurs serveur perdues).
- `apps/web/src/lib/sentry/scrub.ts` : helper partagé `sentryBeforeSend`. Retire les clés sensibles (NIR / nom / prénom / adresses / téléphone / email / date_naissance / tokens / password) récursivement (depth 6) dans extras / contexts / tags / breadcrumbs. Headers `Cookie` / `Authorization` / `X-Supabase-Auth` masqués. Query strings URL retirées. User → `id` auth seul. **6 tests Vitest**.
- `apps/web/src/app/global-error.tsx` : Client Component obligatoire Next 15. Définit son propre `<html>/<body>`. `Sentry.captureException(error)` dans `useEffect`. UI dégradée (texte + lien retour accueil), pas d'écran blanc.
- `api/optimizer/route.ts` + `lib/geoloc/record-position.ts` : `Sentry.captureException` ajouté dans les catch existants AVANT le retour d'erreur (ne change pas le comportement métier).
- `turbo.json` `globalEnv` étendu : `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `CI`, `GEOLOC_ENABLED` (oubli Phase 10.0).
- `.env.example` : section Sentry documentée (dev sans DSN fonctionne) + `GEOLOC_ENABLED`.
- `package.json` racine : `pnpm.overrides` étendu de `next: 15.5.19` pour dédup les types entre la variante `+@opentelemetry/api` (pulled par Sentry) et la variante de base. Résout l'erreur TS de double Next 15.

**Correctif lint hérité 10.0** : `use-driver-positions.ts` avait des NBSP littéraux U+00A0 dans les template literals (typographie française devant unités). Remplacés par une constante `const NBSP = ' '` + `${NBSP}` dans les templates pour passer `no-irregular-whitespace`.

**Validation** :
- `pnpm typecheck` propre (après ajout `next: 15.5.19` dans overrides pour dédup)
- `pnpm build` vert (28 pages, middleware 93.8 kB, Serwist SW vert, Sentry tunnel `/monitoring`)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- `pnpm test` **113/113 verts** (+6 nouveaux : scrub.test.ts)
- 0 migration BDD
- 1 nouvelle dépendance (`@sentry/nextjs`) — déjà dans stack figée DEC-003, **pas de nouvel ADR**

**Note dirigeant (hors repo)** : configurer côté Vercel Project Settings → Environment Variables : `NEXT_PUBLIC_SENTRY_DSN` (public), `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (CI / source maps). Aucune intervention en local : dev sans DSN no-op.

## 2026-06-05 — Phase 10.0 livrée localement (prototype géoloc terrain + UI/UX, données fictives)

Phase 10.0 « Prototype géoloc » cadrée + exécutée dans une seule PR. Prépare le socle géoloc (fonctionnel + UI/UX cockpit + flow chauffeur) sur données FICTIVES, pré-HDS. Aucune vraie position persistée tant que `GEOLOC_ENABLED ≠ 'true'`.

**Principe directeur (RETEX devs)** : capture **événementielle** aux pointages, **pas de suivi temps réel continu**. Raison vérifiée : le continu est techniquement impossible à garantir en PWA (la capture s'arrête dès que le chauffeur ouvre Waze/Maps ou éteint l'écran). Le cockpit affiche la dernière position connue + son âge (« vu il y a X min »), **jamais un faux « live »**. Mode démo = positions STATIQUES (aucune animation, aucun simulateur de déplacement).

**Composants livrés** :

- Migration `supabase/migrations/20260605000001_driver_positions.sql` : table `driver_positions` (`id`/`organization_id`/`driver_id`/`ride_id`/`lat`/`lng`/`accuracy`/`captured_at`/`source check('event','foreground','demo')`), index `(driver_id, captured_at desc)`, RLS (régulateur/dirigeant lisent leur org, chauffeur lit + INSERT sa propre position), fonction `purge_driver_positions()` rétention 90j câblée (schedule pg_cron NON activé tant que pré-HDS).
- `packages/shared/src/validators/driver-position.ts` : `driverPositionInputSchema` zod partagé (`lat`/`lng`/`accuracy` tous optionnels, bornes ±90/±180/0-100k) + constante `POSITION_MAX_ACCURACY_M = 100`.
- `apps/web/src/lib/geoloc/record-position.ts` : helper serveur `recordDriverPosition` gardé par flag `GEOLOC_ENABLED='true'` (pré-HDS = OFF). Non bloquant : toute erreur INSERT loggée, ne fait jamais échouer le pointage.
- `apps/web/src/lib/geoloc/capture-current-position.client.ts` : helper client navigateur, `enableHighAccuracy: true`, `timeout: 8s`, `maximumAge: 5s`, filtre `accuracy ≤ 100m`, refus permission = `{}` (pointage non bloqué).
- Routes `api/driver/rides/[rideId]/{start,end,no-show}` : `.merge(driverPositionInputSchema)` sur les 3 schémas + appel `recordDriverPosition(source='event')` après mutation métier.
- `ride-actions.client.tsx` : `captureCurrentPosition()` AVANT le POST, body et payload enqueue offline-first étendus avec lat/lng/accuracy.
- `apps/web/src/components/map/map.client.tsx` : composant Map MapLibre + protocole PMTiles. Détection `HEAD` du fichier `/tiles/reunion.pmtiles` ; fallback OSM raster + attribution si absent (preview sans extract bundlé). `role="region"` + `aria-label` (a11y).
- `apps/web/src/app/(app)/cockpit/_lib/use-driver-positions.ts` : hook Realtime calqué sur `use-cockpit-rides`, canal `cockpit:driver_positions`. Garde `Map<driverId, position>` = dernière connue. Helpers `formatPositionAge()` (« vu il y a X min », typographie française NBSP devant unités) + `positionTone()` (primary < 5 min, muted ≥ 5 min). 6 tests Vitest.
- `apps/web/src/app/(app)/cockpit/_components/driver-positions-panel.client.tsx` : panneau cockpit, carte + marqueurs (tone selon fraîcheur) + liste textuelle accompagnante (a11y) + badge « DÉMO » si au moins une position est `source='demo'`. Auto-refresh âge toutes les 30s.
- `apps/web/src/app/(driver)/conduite/_components/geoloc-consent-banner.client.tsx` : banner consentement chauffeur dismissable (localStorage `geoloc:consent-ack`), information capture aux pointages + service only + 90j max.
- `supabase/seed.demo.sql` étendu : 3 positions fictives sur les 3 chauffeurs démo (Saint-Denis 2 min, Saint-Pierre 15 min, Saint-Benoît 80 min). Statiques. Source `'demo'`.

**Différé (D-04 watchPosition opportuniste)** : non livré V1. Le socle évènementiel couvre 80% du besoin cockpit. Ajout `watchPosition`/`clearWatch` à une itération ultérieure (garde-fous batterie/permission).

**RGPD câblé** : information préalable chauffeur ✓, service only ✓ (pas de watch automatique en V1), rétention 90j câblée ✓ (cron activé Phase 09). Aucune vraie capture persistée tant que pré-HDS (flag OFF).

**Dépendances** : `maplibre-gl@^4.7.0` + `pmtiles@^3.2.0` ajoutées. ADR-012 « MapLibre GL + PMTiles » justifie le choix (alternatives Mapbox/Leaflet/OpenLayers évaluées, rejetées).

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (Serwist SW vert, MapLibre bundle inclus, 28 pages)
- `pnpm test` **107/107 verts** (+6 nouveaux : use-driver-positions)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- 1 migration BDD ajoutée (cohérente avec `git diff supabase/migrations/`)
- ADR-012 + DEC-096 LOCKED

## 2026-06-05 — Phase 06.9 close (correctif mdx 5→6 + turbo env)

Correctif post-merge PR #238 sur la Phase 06.9. Le downgrade `next-mdx-remote` 6.0.0 → 5.0.0 effectué en PR #238 était **injustifié sur le diagnostic** : la version 6.x ne requiert PAS React 19 (peerDep `react: ">=16"`, devDep `react: ^18.2.0`), et la 5.0.0 est signalée vulnérable RCE par Vercel. La version 6.0.0 est saine, récente (2026-02), et c'est celle qui était en place avant 06.9.

**Correctif appliqué** :
- `apps/web/package.json` : `next-mdx-remote: "5.0.0"` → `"^6.0.0"`.
- `package.json` racine : ajout `pnpm.overrides` épinglant `react: 18.3.1`, `react-dom: 18.3.1`, `@types/react: 18.3.5`, `@types/react-dom: 18.3.0` (dédup hoisting pnpm).
- `apps/web/src/app/(public)/legal/_lib/load-legal.tsx` → renommé `.ts`, `<MDXRemote>` retiré du helper (cross-bundle React Element entre frontière de module = source du bug SSG). Helper renvoie `{ frontmatter, source }`.
- 5 pages `/legal/{cgu,cgv,confidentialite,cookies,dpo}/page.tsx` : `<MDXRemote source={source} components={legalMdxComponents} />` rendu directement dans le Server Component de la page (pattern recommandé Next 15 + next-mdx-remote@6).
- `turbo.json` `globalEnv` complété : `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CGU_VERSION`, `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `APP_NIR_SEARCH_KEY`, `CRON_APP_TOKEN`, `TWILIO_AUTH_TOKEN` (vérifiés via `grep -rohE 'process\.env\.[A-Z_]+' apps/web/src`). Fiabilise le cache turbo + supprime un warning build.

**Bug SSG résiduel** : même avec mdx@6 + overrides React, le SSG `force-static` sur `/legal/*` crash sur `ReactCurrentOwner` (API React 17 supprimée en 18+ — bug Next 15 + SSG + next-mdx-remote). Non lié à la version mdx. Compromis documenté : `force-dynamic` conservé sur les 5 pages legal (latence négligeable pour pages rarement consultées). SSG laissé pour V2.

**Note dirigeant (hors repo)** : supprimer `OPTIMIZER_USE_MOCK` dans Vercel → Project Settings → Environment Variables (résidu post-06.12, plus aucun caller depuis ADR-010).

**Validation** :
- `node -e "console.log(require('./apps/web/package.json').dependencies['next-mdx-remote'])"` → `^6.0.0`
- `pnpm audit --audit-level high | grep -i mdx` → 0
- `grep 'OPTIMIZER_USE_MOCK' apps/web/src turbo.json` → 0
- typecheck propre, build vert (28 pages, Serwist SW vert)
- `pnpm test` 101/101 verts (aucune régression)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- 0 migration BDD, 0 nouvelle dépendance npm

## 2026-06-05 — Phase 06.9 livrée localement (Next.js 14.2 → 15.5, migration async complète)

Phase 06.9 « Modernisation Next.js 15.5 » cadrée + exécutée dans une seule PR. Phase technique autonome, migration codemod-first, reprise manuelle ciblée.

**Versions** :
- `next` : `^14.2.35` → `^15.5.0` (résolution 15.5.19).
- `next-mdx-remote` : `6.0.0` → `5.0.0` (6.x bundle React 19, incompatible avec React 18 + Next 15 SSG).
- React 18 conservé (`^18.3.1`), `@types/react` 18 inchangés.
- `packages/database` peerDep `next` : `^14.2.35` → `^15.5.0`.

**Migration async** (codemod + manuel) :
- `@next/codemod@canary next-async-request-api .` → 17 fichiers transformés, 0 erreur, 0 `@next-codemod-error` marker.
- Pages serveur dynamiques (`params`/`searchParams`) : 10 fichiers → `Promise<...>` + `await`. Inclut `generateMetadata` de `/conduite/[rideId]`.
- Routes API `[rideId]` : 4 fichiers (`end`, `start`, `no-show`, twilio webhook) → `await params`.
- `cookies()` : `lib/supabase/server.ts:createClient` rendue **async**. Pas de cast `UnsafeUnwrappedCookies` (D-02 interdit).
- **84 sites consommateurs** `const supabase = createClient()` → `await createClient()` (sed automatisé sur 54 fichiers).
- 8 sites `ReturnType<typeof createClient>` rebrandés `Awaited<ReturnType<typeof createClient>>`.
- `headers()` : `admin/chauffeurs/actions.ts:resolveOrigin` rendue `async function`, 2 callers `await resolveOrigin()`.

**Modifs ciblées** :
- `lib/geocoding/ban.ts` : `fetch(url, { cache: 'no-store' })` explicite + commentaire « géocodage = pas de cache, fraîcheur voulue » (D-04). Le `fetch` BAN n'était caché par défaut qu'en Next 14, on rend l'intention explicite vs la rupture du cache `fetch()` Next 15.
- `next.config.mjs` : `typedRoutes: true` au TOP-LEVEL (stable 15.5, a quitté `experimental`).
- `next.config.mjs` : suppression du `async rewrites()` `/api/solver/*` → FastAPI port 8000 (orphelin Phase 06.12, ADR-010 — plus aucun caller).
- `next.config.mjs` : `eslint.ignoreDuringBuilds: true` conservé (D-08, nettoyage CI séparé).

**Incident MDX résolu** :
- Symptôme : prerender `/legal/cgu`, `/legal/cgv` cassait sur « A React Element from an older version of React was rendered ». Cause : `next-mdx-remote@6.0.0` bundle React 19 vs runtime React 18.
- Fix : downgrade 6 → 5 + bascule `compileMDX` (double-sérialisation problématique sous SSG) → `<MDXRemote>` (rendu direct RSC). Rename `_lib/load-legal.ts` → `.tsx` pour le JSX.
- Compromis : `export const dynamic = 'force-dynamic'` sur les 5 pages `/legal/*`. Pages servies à la demande, latence négligeable. SSG laissé pour V2 quand React 19 + ADR-007 sera tranché.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, middleware 88.7 kB, Serwist SW vert)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- `pnpm test` 101/101 verts (aucune régression sur les tests Vitest existants)
- `grep -rn next-codemod-error apps/web/src` = 0 (validation D-03)
- `grep 'UnsafeUnwrapped' apps/web/src` = 2 occurrences uniquement dans des commentaires expliquant qu'on N'utilise PAS ces casts (D-02)
- `node -e "console.log(require('./apps/web/node_modules/next/package.json').version)"` → `15.5.19`
- 0 migration BDD

**Documentation** :
- ADR-011 « Next.js 15.5 + Request APIs async » créé, complète ADR-007 (stratégie versions stack).
- DEC-095 LOCKED dans STATE.md.
- CONTEXT.md Phase 06.9 dans `.planning/phases/06.9-nextjs-15/`.

## 2026-06-04 (suite) — Phase 06.19 livrée localement (branchement géocodage récurrences + filet serveur)

Phase 06.19 « Branchement géocodage (récurrences + filet serveur) » cadrée + exécutée dans une seule PR. Comble le trou applicatif qui privait `solveLocal` (06.12, livré le même jour) des courses récurrentes — segment **dialyse** = transport le plus mutualisable, donc le plus coûteux à rater.

**État vérifié AVANT** : la table `ride_recurrences` avait déjà les 6 colonnes `pickup_lat/lng/citycode` + `dropoff_*` depuis la migration `20260519000001_ride_recurrences.sql` (Phase 05). Le trou était purement applicatif (`patients/actions/recurrences.ts` schéma Zod + INSERT ignoraient ces colonnes). **0 migration BDD ajoutée**.

**Composants nouveaux** :
- `apps/web/src/lib/geocoding/geocode-safety-net.ts` — helper partagé `geocodeIfMissing(address, lat, lng, citycode)`. Idempotent (court-circuit si coords présentes), non bloquant (BAN down → null), pure pour le test. 6 tests Vitest.
- `apps/web/src/lib/recurrence/build-rides-payload.ts` — pure helper de transformation occurrences → INSERT rides[]. Propage les coords du template à chaque ride générée. Extrait pour testabilité. 5 tests Vitest.

**Modifs schémas / Server Actions** :
- `patients/actions/recurrences.ts` : Zod `baseSchema` étendu de 6 champs coords (`numericFromString` + bornes lat ±90 / lng ±180 / citycode max 10), `BASE_KEYS` factorisée, `createRecurrenceAction` + `updateRecurrenceAction` appellent `geocodeIfMissing` avant INSERT/UPDATE et persistent les coords sur `ride_recurrences`. `regenerateOccurrencesFor` reçoit les coords pour propagation. Helper local supprimé au profit du module partagé.
- `courses/actions/create.ts` : `createRideAction` appelle `geocodeIfMissing` avant INSERT (filet pour saisies sans picker — seed, API tierce, brouillons texte libre). Helper local supprimé au profit du module partagé.

**UI** :
- `recurrence-create-modal.client.tsx` : 2 `<Input>` remplacés par 2 `<AddressOrPOIPicker>` (pickup + dropoff). State coords pour threading. Submit pose les 6 champs coords dans FormData. Reset complet au close. Bouton submit désactivé si adresse vide.
- `recurrence-edit-modal.client.tsx` : idem + initialisation des coords state depuis `recurrence.pickup_lat/lng/citycode` (déjà chargées via `RideRecurrence` row).
- `optimization-shell.client.tsx` (cockpit) : empty state coords-vides reformulé « X course(s) exclue(s) faute de coordonnées géographiques » + lien `/admin/maintenance`.

**Backfill `/admin/maintenance/actions.ts`** : `backfillRideGeocodingAction` étendu de 3 passes :
1. Pass 1 (existant) : `rides` avec `pickup_lat IS NULL` (MAX_PER_RUN = 200, rate-limit 1 req/s).
2. Pass 2 (nouveau) : `ride_recurrences` actives avec `pickup_lat IS NULL` → géocode + UPDATE template.
3. Pass 3 (nouveau) : propagation aux occurrences futures non démarrées (`validee` + `assignee`, `scheduled_at > now`, `pickup_lat IS NULL`) — cohérent avec la cascade DEC-048 qui préserve courses `en_cours` / `terminee` / `annulee`.

Audit log enrichi du compteur `recurrences_processed`. Idempotent, dirigeant only.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- `pnpm test` 101/101 verts (+11 nouveaux : 6 geocode-safety-net + 5 build-rides-payload). Tous les tests Vitest existants restent verts.
- `git diff main --name-only | grep '^supabase/migrations/'` = 0 ligne (aucune migration ajoutée).
- 0 nouvelle dépendance npm.

**Pont vers 06.12** : le bénéfice est immédiat. Les récurrences dialyse étaient le scénario où `solveLocal` (heuristique cluster-first/route-second) trouvait théoriquement le plus de gain — fenêtres temporelles serrées, horaires quasi-fixes, mêmes destinations partagées par plusieurs patients. Avec coords remplies, `transform.ts` (`ridesToSolveRequest`) ne les exclut plus pour `no_coordinates`, et `solveLocal` peut grouper. Le ROI de la phase est entièrement porté par 06.12 (livré juste avant).

## 2026-06-04 (suite) — Phase 06.12 livrée localement (solveur heuristique TS natif, OR-Tools/Python/mock supprimés)

Phase 06.12 « Solveur d'optimisation = heuristique TypeScript native » cadrée + exécutée dans une seule PR. Décision tranchée (dirigeant + recherche OR) : abandonner OR-Tools / Python / mock / hébergement séparé. Réécriture en heuristique TS native dans `apps/web/src/lib/optimizer/`. Autoporteur, zéro coût marginal, zéro hébergement externe.

**Motivation (faits)** :
- Volume réel ≤ 500 courses absolu, en pratique quelques dizaines/jour. Le contrat zod plafonne déjà à `rides.max(200)`.
- OR-Tools est calibré pour 1000+ waypoints — disproportionné ; sa lourdeur (binaires C++ ~75 MB) a bloqué l'hébergement Vercel (5 PR de fix Phase 06.7 + 5 PR Phase 06.10), d'où le mock actuel.
- Pour fenêtres temporelles petites + horaires quasi-fixes (dialyse programmée = cas TAP majoritaire), une heuristique greedy cluster-first/route-second est quasi-optimale.
- Indicateurs « estimés » DEC-081 → exactitude non contractuelle.
- Supprime la SEULE vraie barrière (hébergement). Plus de Python, plus de cold start, plus de mock, plus d'hébergeur tiers, plus de plan Vercel Pro à arbitrer.

**Composants nouveaux** :
- `apps/web/src/lib/optimizer/haversine.ts` — port direct des 44 lignes de `solver.py:haversine.py`. `haversineKm()` + `distanceMatrix(coords, correctionFactor)`. 4 tests Vitest.
- `apps/web/src/lib/optimizer/solve-local.ts` (~280 LOC) — heuristique cluster-first/route-second. Pré-filtre fenêtres temporelles (port `_pre_filter_rides`), appariement greedy 2-par-2 sur compat fenêtre + transport_mode→vehicle.type + capacité, ordre nearest-neighbor sur Haversine corrigée, calcul km_a_vide. Export `timeWindow()` testable. 9 tests Vitest portés des 6 scénarios pytest.

**Branchement Route Handler** (D-03) : `apps/web/src/app/api/optimizer/route.ts` point 7 — remplace le bloc `useMock ? mockSolve(payload) : solve(payload, {HTTP})` par un `solveLocal(payload)` synchrone. Conservé : auth Supabase, vérif rôle, dé-identification D-08, `ridesToSolveRequest`, `solveResponseToProposal`, `enrichProposal`, try/catch défensif. Retiré : imports `solve`/`OptimizerError`, `process.env.OPTIMIZER_USE_MOCK`, `VERCEL_URL`/`serviceUrl`, `timeoutMs: 30000`.

**Suppressions** (D-04) :
- `apps/web/py/solver/` (13 fichiers Python : solver.py, _extract.py, haversine.py, models.py, index.py, requirements*.txt, tests/, README.md, pytest.ini) → supprimé intégralement.
- `apps/web/src/app/api/optimizer/_mock-solver.ts` → supprimé.
- `apps/web/vercel.json` : `builds` Python + `routes` `/api/solver/*` retirés (reste un fichier `$schema` minimal).
- `packages/optimizer-client/src/client.ts` (`solve()` HTTP + `OptimizerError`) → vidé. `index.ts` ne re-exporte plus `./client`.
- `packages/optimizer-client/src/__tests__/client.test.ts` (4 tests du client HTTP) → supprimé.
- `apps/web/src/middleware.ts` : commentaire ADR-009 référant à `apps/web/py/solver/` → retiré.

**Contrat préservé** : `packages/optimizer-client/contract.ts` (zod `SolveRequestSchema` / `SolveResponseSchema`) + `transform.ts` (`ridesToSolveRequest`, `solveResponseToProposal`) inchangés. `solveLocal()` produit exactement le même `SolveResponse` qu'OR-Tools. Le frontend `/cockpit/optimisation` ne voit aucun changement.

**Documentation** :
- ADR-010 « Solveur heuristique TS native » créée, supersede ADR-008 (hébergement Vercel Python) + ADR-009 (pattern container long-running).
- DEC-093 LOCKED inscrite dans STATE.md (Decisions).
- Runbook `runbook-bascule-vercel-services-vers-deux-projets.md` rendu sans objet pour le solveur (conservé pour traçabilité ou usage futur).

**Variables d'env devenues obsolètes** (à retirer Vercel post-merge) : `OPTIMIZER_USE_MOCK`, `OPTIMIZER_SERVICE_URL`.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm test` 90/90 verts (+13 nouveaux : haversine 4 + solveur 9 ; -4 retirés client HTTP). 17/17 verts `@tap/optimizer-client` (contract 7 + transform 10).
- `grep -rn 'ortools' apps/web` = 0 référence active.
- `apps/web/py/solver/` = supprimé. `_mock-solver.ts` = supprimé.
- 0 migration BDD, 0 nouvelle dépendance npm.

## 2026-06-04 (suite) — Sync planning post-audit (06.11 + 06.18 + total_phases + DEC-092 abandon 07)

Audit planning passé. Trois corrections + une décision dirigeant en une PR planning-only.

1. **06.11 (Polish produit) cochée** : phase livrée (PR #214-#217, statut détaillé « Complete (2026-06-03) ») mais sa checkbox ROADMAP était restée `[ ]`. Corrigée.
2. **06.18 (Page de connexion) clôturée** : livrée via PR #233 (mergée). Checkbox passée `[x]` avec préfixe livraison.
3. **`total_phases` réaligné 29 → 31** : la ROADMAP comptait 31 lignes de phases mais STATE en déclarait 29 — l'ajout de 06.17 puis 06.18 n'avait jamais été propagé au compteur. Compteurs : 26/31 livrées, 4 ouvertes actives, 1 abandonnée. Percent 84.
4. **DEC-092 — Phase 07 (Mobile natif) ABANDONNÉE** (décision dirigeant 2026-06-04). Motif : la PWA Phase 04.9 couvre le périmètre terrain retenu, le coût natif (10×, 25-40 h) n'est pas justifié au stade actuel. Réversible si business case mobile validé ultérieurement. Conservée en ROADMAP pour traçabilité (marquée `[~]` avec préfixe ABANDONNÉE). Phase 10 (géoloc) reformulée : la référence orpheline à 07 a été retirée, le discuss 10 devra concevoir une solution PWA premier-plan dégradé, pas de fallback natif.

Candidates ouvertes restantes (4) : 06.9 (Next.js 15), 06.12 (réactivation solveur OR-Tools), 09 (HDS), 10 (géoloc temps réel). Pas de suite design « naturelle » — choix dirigeant requis pour la prochaine phase.

## 2026-06-04 (suite) — Phase 06.18 livrée localement (Page de connexion + AuthShell aux normes)

Phase 06.18 « Page de connexion — champs + UI aux normes » cadrée + exécutée dans une seule PR (périmètre léger ~4-6 h). Application directe des normes auth/UI 2025-2026 (NN/G, muz.li 4 problèmes login, web.dev, UX Patterns, anti-autofocus a11y) à `/login` et `/accept-invite`. **Reset MDP exclu** (décision dirigeant).

**Composants nouveaux** :
- `<PasswordInput>` (`apps/web/src/components/form/password-input.client.tsx`) — wrapper `<Input>` avec toggle œil/œil-barré (`Eye`/`EyeOff` lucide), `type={visible ? 'text' : 'password'}`, `aria-label` parlant (« Afficher / Masquer le mot de passe »), `aria-pressed` reflète l'état, `pr-40` pour éviter le chevauchement texte/bouton, `forwardRef` pour compat RHF `register`. W3C ARIA APG. 5 tests Vitest.
- `<ThemeToggle>` (`apps/web/src/components/theme-toggle.client.tsx`) — bouton standalone Sun/Moon, `aria-label` parlant, `aria-pressed` reflète l'état, cible tactile 40 px, focus visible via `--ring`. Posable hors session auth (header form AuthShell). 4 tests Vitest.
- `useTheme()` hook partagé (`apps/web/src/lib/use-theme.client.ts`) — lecture `data-theme` du document + persistance localStorage `theme` (clé compat anti-FOUC `app/layout.tsx`). Consommé par `<ThemeToggle>` ET `UserMenu` → DRY (~20 LOC supprimées de UserMenu).

**Refactor AuthShell en Server Component (D-06)** : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` supprimé → `auth-shell.tsx` (RSC). Le seul îlot client est `<ThemeToggle>` posé dans le header form (bascule jour/nuit avant connexion). Imports redirigés dans 4 pages (`login`, `accept-invite`, `welcome`, `setup`). Commentaires « mode jour uniquement » périmés retirés.

**login-form** : email gagne `inputMode="email"` (D-02 — clavier email mobile). Mot de passe utilise `<PasswordInput>` (D-01). Aucun autofocus (anti-pattern a11y respecté).

**accept-invite-form** : 2 champs password convertis en `<PasswordInput>` avec recomposition manuelle du pattern Field (label + PasswordInput + p#hint OR p#error + aria-describedby) — PasswordInput n'est pas un Input simple, ne s'intègre pas directement à `<Field>`. Import `Field` retiré (lint propre).

**Validation** : `pnpm typecheck` propre, `pnpm lint` clean (9 warnings préexistants hors périmètre), `pnpm test` 77/77 verts (11 fichiers ; +9 nouveaux : PasswordInput 5 + ThemeToggle 4). 0 migration BDD. 0 nouvelle dépendance npm (toutes icônes lucide déjà disponibles). Tokens 06.14 uniquement, 0 hex.

## 2026-06-04 (suite) — Phase 06.17 close (3 PR mergées)

Phase 06.17 « Conformité des champs de saisie » **close** après 3 PR séquentielles mergées : PR #230 (composants communs + véhicule/chauffeur), PR #231 (légal + tarifs + rattrapage défauts places), PR #232 (reste + clôture). **132 champs aux normes UX/a11y** (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG). Composants communs : `<Field>` (hint persistant lié `aria-describedby`, `name` explicite respecté), `<NumberField>` (`type=text` + `inputMode=numeric|decimal`, règle de défaut cohérent counter/optional), `<Combobox>` 100 % maison W3C APG (DEC-003 préservée, sans Radix Popover ni cmdk). Catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case). PR3 : migration `dpia-form`, `dpa-prefill-card`, `dpo-form`, `accept-invite-form` sur `<Field>` + hints d'exemple ; `maxLength` posée sur tous les champs à format (immat=9, NIR=19, tél=14, email=120, version=50, titre=200, mot de passe=128) ; normalisation submit DPA. **0 `type="number"` restant** dans `apps/web/src` (vérifié `grep -rE 'type=\"number\"'`). **23 tests Vitest** verts (Field 5 + NumberField 8 + Combobox 8 + catalog 7) sur 68 tests total. Documenté `docs/design-system/07-form-completion.md`. 0 migration BDD, 0 dépendance npm. Bloc design system 06.13 → 06.17 complet sur 5 phases.

## 2026-06-04 (suite) — Phase 06.17 cadrée + PR1/3 exécutée

Phase 06.17 « Conformité des champs de saisie » cadrée. Périmètre élargi en cours de session : tous les champs du projet (132 sur 50 fichiers) à mettre aux normes UX/a11y (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG), pas un pilote. Découpé en 3 PR séquentielles SOUS la même phase. **PR1 (#230) livrée localement** : composants communs `<Field>` (hint persistant lié `aria-describedby`) + `<Combobox>` éditable 100 % maison W3C APG (DEC-003 préservée, 0 nouvelle dépendance) ; catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case) ; refactor `vehicle-form` (Marque/Modèle comboboxes dépendantes, immatriculation hint format, places en `inputMode=numeric` sans spinner) ; `driver-form` migré sur `<Field>` commun ; normalisation Title Case au submit Server Action véhicule. 60 tests Vitest verts (15 nouveaux : Field 5 + Combobox 8 + catalog 7). Documenté `docs/design-system/07-form-completion.md`. **PR2 prévue** : légal + tarifs (breach-drawer affected_subjects_count défaut 0, registre-fields durée conservation, tariff-edit/simulator/override-tarif montants/distance avec inputMode décimal sans spinner). **PR3 prévue** : dpia/dpa-prefill/accept-invite/dpo (hints d'exemple), audit `patient-form-fields` (gabarit déjà conforme), driver-form téléphone + maxLength, NIR maxLength=15, sync ROADMAP cocher 06.17. 0 migration BDD, 0 dépendance npm.

## 2026-06-04 (suite) — Phase 06.16 cadrée + exécutée

Phase 06.16 « PageHeader admin commun » cadrée + livrée dans une seule PR (périmètre Strict dirigeant). Composant `<PageHeader>` créé (~50 LOC, props title + description + actions + className, 6 tests Vitest verts). 16 pages admin migrées (chauffeurs, facturation, legal, legal/breaches, legal/dpa, legal/dpa/pre-remplir, legal/dpia, legal/dpia/pre-remplir, legal/dpo, legal/registre, legal/registre/pre-remplir, legal/requests, maintenance, sms-templates, tarifs, vehicules). `legal/registre` conserve ses actions `ExportPdfButton` + bouton « Nouvelle entrée » via le slot `actions`. Chrome globale (`(admin)/layout.tsx`, `NavTabs`, `LegalNavMenu`) inchangée. Toolbar recherche/filtres différée (recoupe le tri généralisé du `<DataTable>` laissé en V2). Tokens 06.14 uniquement, 0 hex, 0 dépendance, 0 migration BDD. Documenté en `docs/design-system/06-page-header.md`.

## 2026-06-04 (suite) — Phase 06.15 cadrée

Phase 06.15 « Refonte data tables » cadrée. Décision dirigeant Option 3 (uniformiser les 13 tables sur un composant `<DataTable>` sémantique commun, API extensible tri/pagination prévus mais V1 implémente seulement le tri existant de `caisse-table`). 13 tables incluses (8 `<table>` + 4 `divide-y` + 1 mixte) ; 3 dropdowns de saisie exclus (pas des data tables). Décisions D-01..D-06 LOCKED : composant sémantique, compose primitives existantes (EmptyState/Badge/Skeleton + tokens 06.14), API extensible, logique métier préservée par table, RGAA 4.1.2 + densité DEC-034 + jour+nuit, ROADMAP entrée [ ] = premier acte. Estimation 12-16 h. 0 migration BDD, 0 dépendance npm. PLAN 06.15-01 à écrire ensuite.

## 2026-06-04 — Phase 06.14 cadrée

Phase 06.14 « Migration tokens.json → Tailwind config » cadrée. Entrée ROADMAP posée `[ ]` après 06.13. RESEARCH sourcé (versé en PR #220, mergée) rangé dans le dossier de phase `.planning/phases/06.14-migration-tokens-tailwind/06.14-RESEARCH.md` pour cohérence de structure GSD. STATE + journal mis à jour (06.14 en cadrage). Décisions dirigeant déjà actées : dark généré depuis les tokens (anti-dérive), rester Tailwind v3 (v4 = décision séparée couplée à 06.9). Architecture DTCG du dark à trancher au discuss (Token Sets vs `$value` structuré). Estimation indicative 5-8 h. Périmètre dark chiffré : 12 couleurs sur 57 tokens.

## 2026-06-03 (suite) — Phase 06.13 lancée et livrée

Phase 06.13 « Foundations design system » lancée et livrée en 1 PR documentaire pure. 4 livrables : 01-foundations.md (doctrine WCAG 2.1 AA + RGAA 4.1.2 + conventions visuelles), tokens.json (W3C Design Tokens 2025.10), 02-patterns-emergents.md (5 patterns réutilisables documentés : KpiCard, EmptyState, RideBadge, SlaBadgesCard, HautsBadge), 03-benchmark-foss.md (recherche FOSS méthodique capitalisée en version compacte). DEC-088 doctrine accessibilité, DEC-089 étoile polaire hybride Carbon+Atlassian+NHS, DEC-090 phase 100% documentaire, DEC-091 chantier PDF reporté. Base établie pour phases 06.14+ (migration tokens, refonte tables, refonte settings).

## 2026-06-03 (suite) — Phase 06.11 cadrée

Phase 06.11 « Polish produit » créée et cadrée : CONTEXT + DISCUSSION-LOG + 3 PLAN par wave. Périmètre : Wave 1 tableau dirigeant (A3+A5+A4, HVI 2026 pattern), Wave 2 passe UX optimisation (B2+B3+B9+B7+B6, Solvice + RoadWarrior + tule2236), Wave 3 finition démo (C1+C7). Items A2/B8/C3/C5 explicitement reportés. D4-a side-quest opportuniste inscrit dans CONCERNS.md. Renumérotation : ancienne 06.11 candidate solveur → 06.12 candidate. DEC-084..087 LOCKED. 4 décisions traçables dans le DISCUSSION-LOG. PR cadrage = documentation pure, 0 ligne de code applicatif touchée.

## 2026-06-03 — Phase 06.10 clôturée

5 PR Vercel Python (#208, #209, #210, #212) + 1 PR Wave 2 (#211). Chaîne Python techniquement fonctionnelle, mais walkthrough OR-Tools réel bloqué sur Vercel Hobby (maxDuration 10s). Pipeline geocoding déjà câblé depuis 04.7, scellé par tests. Décision dirigeant : mock activé partout, Phase 06.11 candidate pour réactivation. Enquête open-source `2026-06-03-enquete-patterns-solveur-cout.md` capitalise les 4 patterns d'hébergement viables.

Dettes ouvertes à l'issue : D1 reportée (Phase 06.11 candidate), D2 résolue, D3 et D4 différées.

---

*Journal créé 2026-06-03 lors de la clôture de Phase 06.10. Toute clôture de phase à venir s'inscrit ici en tête.*
