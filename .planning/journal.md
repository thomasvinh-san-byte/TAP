# Journal — phases livrées

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
