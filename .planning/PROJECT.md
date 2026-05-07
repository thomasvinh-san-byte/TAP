# SaaS TAP Réunion

## What This Is

SaaS de régulation, optimisation, communication patient et pilotage pour
sociétés de Transport Assis Professionnalisé (TAP) et taxiteurs conventionnés
CGSS à La Réunion (974). L'outil sert au quotidien la régulatrice (utilisatrice
principale, 8 h/jour dans l'écran), les chauffeurs en tournée (PWA mobile), les
dirigeants (pilotage) et — en V1.5 — les donneurs d'ordres B2B (hôpitaux,
cliniques, EHPAD).

## Core Value

**La régulatrice doit avoir envie d'utiliser l'outil 8 heures par jour, 220 jours
par an, sans jamais le subir.** Tout le reste — moteur tarifaire, optimisation
de tournées, communication patient — sert cet objectif. Si la régulatrice
préfère son cahier papier, le produit a échoué.

## Requirements

### Validated

<!-- Shipped et validés. -->

- ✓ **FOND-01** : Monorepo Turborepo + pnpm workspaces opérationnel — Lot 0
- ✓ **FOND-02** : Multi-tenant Supabase via RLS forcée + `organization_id` — Lot 0
- ✓ **FOND-03** : Migrations Supabase 001 (foundations) et 002 (RLS) appliquées — Lot 0
- ✓ **FOND-04** : Tests pgTAP RLS automatisés en CI — Lot 0
- ✓ **FOND-05** : Packages `database` et `shared` initialisés — Lot 0
- ✓ **FOND-06** : ADR-001 (monorepo) et ADR-002 (RLS multi-tenant) actés — Lot 0
- ✓ **FOND-07** : CI/CD GitHub Actions (lint, types, tests, migrations) — Lot 0
- ✓ **FOND-08** : Comptes de démo seedés (dirigeant, régulateur, chauffeur) — Lot 0

### Active

<!-- Scope en cours. Référentiel détaillé dans REQUIREMENTS.md. -->

- [x] **REQ-patient-referentiel** : fiche patient complète avec NIR chiffré et préférences (Phase 1 livrée — 2026-05-06)
- [ ] **REQ-rgpd-compliance** : registre traitements + DPA + DPIA + portail droits patient *(Phase 1.5 — bloque first design partner)*
- [ ] **REQ-visible-progress** : Vercel preview + Supabase staging + seed démo 974 + comptes démo + showcase/ *(Phase 0.7 — Visible Progress Mandate CLAUDE.md § 13.5, débloque toute phase ≥ 2)*
- [ ] **REQ-saisie-express-course** : saisie d'une course en mode express < 30 s
- [ ] **REQ-moteur-tarification-cgss** : moteur tarifaire CGSS dans `packages/pricing`
- [ ] **REQ-courses-recurrentes** : génération de récurrences avec exceptions jours fériés 974
- [ ] **REQ-osrm-bootstrap** : `services/osrm` Docker + tuiles 974 + RPC distance/eta *(Phase 4.5 — débloque downstream)*
- [ ] **REQ-cockpit-regulateur** : cockpit temps réel par défaut, TTI < 2 s
- [ ] **REQ-planning-gantt** : planning drag-and-drop par chauffeur et par jour
- [ ] **REQ-gestion-imprevus** : workflows panne, patient absent, réaffectation
- [ ] **REQ-communication-sms-patient** : SMS sortants avec consentement actif
- [ ] **REQ-pwa-chauffeur** : PWA chauffeur terrain (hors-ligne, vocal, mode soleil)
- [ ] **REQ-geolocalisation-temps-reel** : capture position service uniquement + streaming cockpit + rétention 90j *(Phase 9.5)*
- [ ] **REQ-optimisation-tournees** : microservice Python OR-Tools + client TS
- [ ] **REQ-routing-gps-advanced** : geocoding inverse, alternatives, isochrones (Phase 11 — bootstrap déjà en Phase 4.5)
- [ ] **REQ-caisse-paiements-directs** : encaissements cash / CB / chèque rapprochés
- [ ] **REQ-mode-degrade** : continuité de service en panne réseau / Supabase / tiers
- [ ] **REQ-kpis-dirigeant** : CA, marge, mutualisation, productivité chauffeur *(Phase 14)*
- [ ] **REQ-conformite-reglementaire** : alertes 90/60/30j carte pro, CT, visite médicale, agrément ARS/CPAM *(Phase 15 — bloque mise en production commerciale)*
- [ ] **REQ-exports-comptables** : FEC annuel DGFiP, Lomaco CSV mensuel, PDF récap mensuel *(Phase 16)*
- [ ] **REQ-beta-terrain-chauffeur** : validation Hauts Réunion 35°C/3G dégradé/2-3 design partners *(Phase 17 — V1.5)*

### Out of Scope (v1)

<!-- Frontières explicites. -->

- **Application native iOS/Android** — la PWA chauffeur couvre les besoins terrain ; native repoussée si justifié
- **15 modules secondaires du CDC v2** non listés ici — à ingérer comme PRD une fois le `.docx` converti en `.md`
- **Portail B2B (apps/b2b)** — V1.5, après validation V1 par 2-3 design partners
- **Multi-langue** — français uniquement (cible 974, pas d'export hors France à court terme)
- **Application native chauffeur** — PWA suffit ; remplacement uniquement si limites techniques bloquantes
- **Analyse vidéo / dashcam** — hors scope produit
- **Facturation B2C complète** — la caisse couvre les paiements directs, pas un module compta
- **Outils marketing intégrés** — focus 100 % opérationnel, marketing en outils tiers

## Context

### Méthode produit
Le pilier 1 (UX qui donne envie) impose l'observation terrain. Toute journée
passée auprès d'une régulatrice, run en double avec un chauffeur, ou point avec
un dirigeant est consignée dans `docs/observations/AAAA-MM-JJ-societe-role.md`.
Anonymisation systématique (pas de NIR, pas de nom patient).

### État technique
- Lot 0 (fondations multi-tenant) **terminé** — commit `f68b1d2`.
- Lot 1 **en cours** : référentiels patients + saisie express.
- Branche active : `claude/setup-project-docs-ATeRo`.
- Repo : `thomasvinh-san-byte/tap`.
- Stack : Next.js 14 App Router, Supabase, OR-Tools, OSRM, MapLibre — figée (cf. décisions verrouillées).

### Document métier de référence
`docs/cahier_des_charges_saas_tap_v2.docx` — 24 modules fonctionnels. **9 modules
critiques** identifiés et adressés en V1 ; 15 modules secondaires à ingérer
ultérieurement (conversion `.docx` → `.md` requise pour parsing).

## Constraints

- **Tech stack** : Next.js 14 App Router, TypeScript strict, Tailwind + shadcn/ui, Supabase, MapLibre, FullCalendar/react-big-calendar, Python OR-Tools, OSRM auto-hébergé, Twilio ou OVH SMS Pro, Vercel, Sentry — **figée**, toute nouvelle dépendance majeure exige un ADR (cf. DEC-003).
- **Sécurité données de santé** : RGPD niveau santé + HDS pour la production commerciale. Supabase Cloud non HDS — bêta privée acceptable sous DPA, migration OVHcloud Postgres / Scaleway HDS anticipée. Architecture portable obligatoire (cf. CON-001).
- **Multi-tenant** : `organization_id` sur toute table métier + RLS forcée + tests pgTAP systématiques. `service_role` interdit côté client (audit CI bloquant) (cf. DEC-002).
- **Chiffrement applicatif** : NIR et notes médicales en AES-256-GCM, clé hors Supabase. TLS 1.3 minimum (cf. DEC-007).
- **Performance perçue** : saisie express < 30 s, feedback < 100 ms, action chauffeur < 1 s en 3G, TTI régulateur < 2 s (cf. DEC-005).
- **Accessibilité** : WCAG 2.1 AA, contraste 4.5:1, navigation clavier complète, `prefers-reduced-motion` respecté, mode contraste élevé + police +20 % côté chauffeur (cf. CON-005).
- **Design system** : spacing 4-8-12-16-24-32-48-64 px, polices Inter/Manrope/Geist Sans uniquement, icônes Lucide uniquement, mode jour ET nuit à parité, chiffres tabulaires obligatoires (cf. CON-006).
- **Localisation FR** : UI, erreurs, logs, commentaires, commits — **français uniquement**. Pas de jargon technique en UI (cf. DEC-011).
- **Limites code** : fichier ≤ 300 lignes, composant React ≤ 150 lignes, fonction ≤ 50 lignes, ≤ 3 niveaux d'imbrication (cf. CON-008).
- **Couverture tests** : `packages/pricing` et `packages/recurrence` à **100 % branches**, `packages/domain` ≥ 80 %, RLS tests pgTAP systématiques, E2E Playwright sur workflows imprévus (cf. DEC-013).
- **Architecture monorepo** : `apps/*` peuvent dépendre de `packages/*`, **jamais l'inverse** (cf. CON-012).
- **Sessions** : chauffeur 8 h max, régulateur 15 min inactivité, mode régulateur de garde mono-actif (cf. CON-014).
- **Géolocalisation** : capture uniquement pendant le service, rétention 90 j max, agrégation puis purge (cf. DEC-009).

## Key Decisions

<!-- Toutes verrouillées. ADRs sont sources d'autorité formelle ; les décisions DOC sont
élevées par autorité explicite du propriétaire projet sur CLAUDE.md. -->

<decisions locked="true">

| Décision | Source | Statut | Note |
|----------|--------|--------|------|
| **DEC-001** Monorepo Turborepo + pnpm workspaces | ADR-001 | LOCKED | `apps/*` ne dépendent QUE de `packages/*` |
| **DEC-002** Multi-tenant via RLS forcée + `organization_id` | ADR-002 | LOCKED | Tests pgTAP à chaque PR |
| **DEC-003** Stack technique figée (Next.js / Supabase / OR-Tools / OSRM) | CLAUDE.md § 3 | LOCKED | Nouvelle dépendance majeure = ADR |
| **DEC-004** 3 piliers non négociables (UX / design / sécurité HDS) | CLAUDE.md § 1 | LOCKED | Niveau qualité visé : Linear, Stripe, Notion |
| **DEC-005** Objectifs UX chiffrés (saisie < 30 s, TTI < 2 s, etc.) | CLAUDE.md § 1 | LOCKED | SLOs perçus, mesurés en E2E Playwright |
| **DEC-006** Authentification Supabase Auth PKCE + sessions | CLAUDE.md § 6 | LOCKED | Régulateur de garde mono-actif |
| **DEC-007** Chiffrement applicatif AES-256-GCM (NIR, notes médicales) | CLAUDE.md § 6 | LOCKED | Clé hors Supabase |
| **DEC-008** Consentement et règles SMS patient | CLAUDE.md § 6 | LOCKED | Pas d'envoi sans consentement actif horodaté |
| **DEC-009** Géolocalisation chauffeur (service uniquement, 90 j) | CLAUDE.md § 6 | LOCKED | Information préalable obligatoire |
| **DEC-010** Audit et traçabilité (`audit_logs` append-only) | CLAUDE.md § 6 | LOCKED | Index `(organization_id, ...)` |
| **DEC-011** Localisation FR + conventions de nommage | CLAUDE.md § 7 | LOCKED | Commits `type(scope): description` en français |
| **DEC-012** GitHub Flow adapté (`main` + `staging` + `feat/*`) | README.md | LOCKED | Migrations validées par CI avant merge |
| **DEC-013** Couverture tests (pricing 100 %, recurrence 100 %, domain ≥ 80 %) | CLAUDE.md § 9 | LOCKED | Vitest + Playwright + pgTAP + pytest |
| **DEC-014** Ergonomie chauffeur (boutons ≥ 56 px, 1 action / écran, swipe) | CLAUDE.md § 5 | LOCKED | Mode hors-ligne fonctionnel obligatoire |
| **DEC-015** Ergonomie régulatrice (cockpit accueil, `Cmd/Ctrl+N`, fuzzy 2 car) | CLAUDE.md § 5 | LOCKED | File d'attente brouillons + multi-saisies parallèles |
| **DEC-016** Localisation des règles métier en packages dédiés | CLAUDE.md § 11 | LOCKED | Tarification → `pricing`, récurrence → `recurrence`, SMS → `sms` |

</decisions>

---
*Last updated: 2026-05-06 après ingest et roadmap initiale*
