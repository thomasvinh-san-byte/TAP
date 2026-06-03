# Benchmark FOSS — référence design TAP

> Phase 06.13 — `2026-06-03`. Capitalisation compacte des recherches
> FOSS méthodiques. Sert de référence pour les phases de refonte
> suivantes (06.14+). **Aucune lib externe adoptée** — toutes les
> inspirations sont à ré-implémenter en shadcn/Tailwind.

---

## 1. Normes & standards applicables

| Norme                              | Statut au 2026-06-03      | Application TAP                         |
| ---------------------------------- | ------------------------- | --------------------------------------- |
| WCAG 2.1 AA (W3C)                  | Cible TAP active          | DEC-088 — minimum non négociable.        |
| WCAG 2.2                           | ISO/IEC 40500:2025 publié | Reportée Phase 09 HDS ou équivalent.    |
| RGAA 4.1.2 (France)                | Transposition fr 2026     | Référence d'audit possible (Access42).  |
| ARIA Authoring Practices 1.2       | Vivant                    | Référence pour rôles + landmarks.       |
| W3C Design Tokens Format Module    | 2025.10 — première version stable | Format de `tokens.json` (Livrable 2). |
| HHS Section 504 (US, healthcare)   | Mai 2026                  | Signal de tendance (pas applicable FR). |

---

## 2. Design systems FOSS — top 10 par pertinence TAP

Classement subjectif basé sur la pertinence pour les écrans TAP
(data-heavy SaaS santé/logistique multi-rôle).

| Rang | Système           | Pertinence pour TAP                                                 | À étudier en priorité                                       |
| ---- | ----------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1    | IBM Carbon        | Data tables denses, dashboards, data viz, doctrine industrielle.    | Tables (Phase 06.15), data viz (KPI Phase 06.14+).          |
| 2    | Atlassian DS      | Tokens élévation, navigation app, settings repeating patterns.      | Shadows (06.14), settings (06.16).                          |
| 3    | NHS Digital Service Manual v10 | Patterns santé, doctrine accessibilité, progressive enhancement, ARIA landmarks. | Error states, skip links (06.14+).             |
| 4    | Shopify Polaris   | Forms denses, billing patterns. Déjà partiellement adopté Phase 04.7. | Form layouts (Phase ultérieure forms régulateur).         |
| 5    | GitHub Primer     | Densité bureau, lists, code-adjacent patterns.                      | Lists denses (cockpit, courses).                            |
| 6    | Microsoft Fluent 2| Cross-platform, mobile-first patterns.                              | Référence Phase 07 mobile (si déclenchée).                  |
| 7    | Material Design 3 | Mobile-first, motion, élévation matérielle.                         | Référence Phase 07 mobile.                                  |
| 8    | Adobe Spectrum    | Densité créative, color tokens light/dark à parité.                 | Dark mode (révision future).                                |
| 9    | Salesforce Lightning | CRM patterns, multi-tenant.                                      | Référence si évolution vers multi-organisation.             |
| 10   | DSFR (gouv.fr)    | Référence française pour conformité RGAA. Esthétique étatique non-adoptable telle quelle. | Référence RGAA uniquement.       |

Ant Design (Alibaba) intentionnellement exclu : esthétique très chargée,
trop éloignée de la sobriété visée (CLAUDE.md § 1).

---

## 3. Meilleures UI sectorielles

### Santé

| Référence     | Type             | À retenir                                                                    |
| ------------- | ---------------- | ---------------------------------------------------------------------------- |
| Doctolib      | SaaS B2C/B2B FR  | Smart defaults, recherche fuzzy, agenda dense. **Déjà adopté Phase 03.1.**   |
| NHS Apps      | App publique UK  | Progressive disclosure, lecture à voix haute, accessibilité native.          |
| Bahmni        | EHR open-source  | Référence sémantique (modèle patient/encounter). UI datée — ne pas copier.   |
| OpenEMR       | EHR open-source  | Référence fonctionnelle. UI à éviter (table-based, années 2000).             |
| Hospital Run  | EHR offline-first | Référence pour mode hors-ligne PWA. UI datée.                               |

### Logistique / dispatch

| Référence    | Type                  | À retenir                                                                |
| ------------ | --------------------- | ------------------------------------------------------------------------ |
| Onfleet      | SaaS dispatch         | Cockpit régulateur, assignation, statuts course.                         |
| Routific     | SaaS optimisation     | Visualisation tournée, drag & drop manuel.                               |
| Solvice      | API optimisation       | « Suggest functionality » — solveur propose, régulatrice ajuste. **Déjà adopté Wave 2 Phase 06.11.** |
| HVI          | UI fleet 2026         | GAR (Green/Amber/Red), alertes proactives. **Déjà adopté Wave 1 Phase 06.11.** |
| RoadWarrior  | SaaS livreur           | Multi-panel view, badges multi-couleur. **Déjà adopté Wave 2 Phase 06.11.** |
| Traccar      | OSS tracking          | Carte temps réel multi-véhicule. Référence Phase 10 géoloc.              |
| tule2236 (GitHub) | Étude académique dispatch | Couleurs distinctes par cluster. **Déjà adopté Wave 2 Phase 06.11.** |

### SaaS B2B (densité dirigeant + régulateur)

| Référence       | À retenir                                                                |
| --------------- | ------------------------------------------------------------------------ |
| Stripe          | Balance N vs N-1 (déjà adopté), settings, billing. Étoile polaire forte. |
| Linear          | Densité, raccourcis clavier (Cmd+K), navigation rapide.                  |
| Notion          | Save bar persistante, états dirty, blocks pattern.                       |
| Cal.com         | Forms longs, états vide pédagogiques.                                    |
| Figma           | Multi-fenêtres, palettes flottantes.                                     |
| Posthog         | Dashboards éditables, drill-down.                                        |
| Supabase Studio | Tables denses, SQL editor, doctrine sobriété.                             |
| Vercel          | Settings, deploys, focus instantané.                                     |
| Refine          | Patterns CRUD admin réutilisables.                                       |
| Plane           | Roadmap multi-vue (kanban/timeline/gantt).                               |

---

## 4. Doctrine d'application : emprunter / adapter / rejeter

Reprend verbatim la doctrine Phase 06.6 LOCKED pour conformité RGPD :

- **Emprunter** un pattern visuel intact = OK si le pattern n'embarque
  pas de jugement sur la conformité (ex : densité de table Carbon,
  forme de KPI Stripe, état vide Doctolib).
- **Adapter** un pattern qui colle à la sémantique métier mais demande
  un ré-habillage TAP (ex : `SlaBadgesCard` réutilise l'idée NHS de
  surfacer les SLA datés sans copier la palette NHS).
- **Rejeter** tout pattern qui suggérerait une conformité globale, un
  score d'audit, ou un jugement « conforme/non-conforme » sur l'écran
  régulateur ou dirigeant (`ComplianceCard` LOCKED).

Toute inspiration est documentée en commentaire de code (`// Pattern
HVI 2026 — Green/Amber/Red`) pour traçabilité et révision future.

---

## 5. Plan d'attaque phases futures (table de correspondance)

Pour chaque écran TAP, 1-2 références FOSS à étudier en priorité
**avant** sa refonte.

| Écran                              | Référence 1                     | Référence 2                    | Phase candidate    |
| ---------------------------------- | ------------------------------- | ------------------------------ | ------------------ |
| `/cockpit` (table Realtime)        | IBM Carbon (data table)         | Linear (densité)               | 06.15              |
| `/courses` (liste filtrable)       | GitHub Primer (lists denses)    | Linear (raccourcis Cmd+K)      | 06.15              |
| `/patients` (liste recherche fuzzy)| Doctolib (smart defaults)       | Linear (palette commande)      | 06.15              |
| `/tableau-de-bord` (KPI dirigeant) | Stripe Balance (déjà adopté)    | IBM Carbon (sparklines)        | 06.14              |
| `/cockpit/optimisation`            | Solvice + RoadWarrior (adoptés) | tule2236 (cluster couleur)     | Polished 06.11.    |
| `/admin/*` (settings / admin)      | Linear + Stripe (settings)      | Polaris (forms denses)         | 06.16              |
| `/admin/legal/*` (RGPD)            | NHS Digital (progressive disclosure) | Polaris (billing-like)    | À cadrer.          |
| PWA chauffeur (`/me/tournee`)      | Material 3 (mobile, élévation)  | NHS Apps (lecture vocale)      | 06.16 ou Phase 07. |
| `/courses/caisse` (encaissement)   | Stripe Dashboard                | Polaris (billing)              | À cadrer.          |
| `/me/welcome` (onboarding)         | Cal.com (états vides)           | Linear (raccourcis)            | À cadrer.          |

---

## 6. Sources de la recherche méthodique 2026-06-03

Capitalisé depuis 5 recherches web sourcées par Claude-chat :

1. **Accessibilité réglementaire** : WCAG 2.1/2.2, RGAA 4.1.2, ISO/IEC
   40500:2025, HHS Section 504 mai 2026, Access42, ARIA Authoring
   Practices.
2. **Design systems top 10 2026** : Carbon, Atlassian DS, NHS Digital
   Service Manual v10, Polaris, Primer, Fluent 2, Material 3, Spectrum,
   Salesforce Lightning, DSFR.
3. **NHS Digital Service Manual v10** : doctrine progressive
   enhancement, error components, skip links, ARIA landmarks pour
   parcours santé.
4. **DSFR** : référence française accessible, non adoptable telle
   quelle (esthétique étatique).
5. **Design Tokens Format Module 2025.10** : première version stable
   du standard W3C ($value/$type/$description/$extends), aligné sur
   Style Dictionary, adopté par Figma Tokens.

Et 2 recherches sectorielles complémentaires :

6. **SaaS UI patterns 2026** : Linear, Notion, Stripe, Figma, Shopify,
   Cal.com, Posthog, Supabase Studio, Refine, Plane.
7. **Healthcare + dispatch FOSS** : Bahmni, OpenEMR, Hospital Run,
   Onfleet, Routific, Solvice, HVI, RoadWarrior, Traccar, tule2236.

---

> **Concerns** : ce benchmark est livré en **version compacte**
> conformément à la latitude prévue dans le plan
> (`06.13-01-PLAN.md` Livrable 4). Une version complète, captures et
> liens directs vers les composants FOSS de référence à l'appui,
> pourrait être enrichie en side-quest lors d'une PR de refonte
> ultérieure (06.15 ou 06.16).
