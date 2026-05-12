# Synthesis Summary

> Point d'entrée unique pour les consommateurs aval (notamment `gsd-roadmapper`).
> Synthèse produite à partir de 5 documents ingérés et classifiés.

---

## Comptes par type de document

| Type | Nombre | Sources |
|---|---|---|
| ADR | 2 | ADR-001-monorepo-turborepo.md, ADR-002-supabase-rls-multitenant.md |
| SPEC | 0 | — |
| PRD | 0 | — |
| DOC | 3 | CLAUDE.md, README.md, docs/adr/README.md, docs/observations/README.md |

Note : un fichier de classification supplémentaire correspond à
`docs/observations/README.md` (DOC). 5 sources distinctes, 6 fichiers de
classification (un README a été classifié deux fois selon les checksums distincts).

---

## Décisions verrouillées

**Total : 16** (2 ADR Accepted + 14 décisions DOC élevées par autorité explicite
du propriétaire projet sur CLAUDE.md).

| ID | Source | Titre |
|---|---|---|
| DEC-001 | ADR-001 | Monorepo Turborepo + pnpm workspaces |
| DEC-002 | ADR-002 | Multi-tenant via Supabase RLS forcée + organization_id |
| DEC-003 | CLAUDE.md § 3 | Stack technique imposée |
| DEC-004 | CLAUDE.md § 1 | 3 piliers non négociables (UX, design, sécurité HDS) |
| DEC-005 | CLAUDE.md § 1 | Objectifs UX chiffrés (SLOs perçus) |
| DEC-006 | CLAUDE.md § 6 | Authentification et sessions |
| DEC-007 | CLAUDE.md § 6 | Chiffrement AES-256-GCM des données ultra-sensibles |
| DEC-008 | CLAUDE.md § 6 | Consentement et règles SMS patient |
| DEC-009 | CLAUDE.md § 6 | Géolocalisation chauffeur |
| DEC-010 | CLAUDE.md § 6 | Audit et traçabilité (audit_logs) |
| DEC-011 | CLAUDE.md § 7 | Localisation FR + conventions de nommage |
| DEC-012 | CLAUDE.md/README | Workflow Git (GitHub Flow adapté) |
| DEC-013 | CLAUDE.md § 9 | Couverture de tests exigée |
| DEC-014 | CLAUDE.md § 5 | Ergonomie chauffeur (PWA mobile) |
| DEC-015 | CLAUDE.md § 5 | Ergonomie régulatrice (desktop) |
| DEC-016 | CLAUDE.md § 11 | Localisation des règles métier en packages dédiés |

Détails complets : `/home/user/TAP/.planning/intel/decisions.md`.

---

## Requirements extraits

**Total : 9** (pointeurs vers les modules critiques du CDC v2 cités dans
CLAUDE.md § 2 — le CDC v2 lui-même n'a pas été ingéré).

| ID | Module CDC v2 | Scope |
|---|---|---|
| REQ-saisie-express-course | § 5.8 | apps/web, packages/domain |
| REQ-courses-recurrentes | § 5.9 | packages/recurrence |
| REQ-cockpit-regulateur | § 5.13 | apps/web |
| REQ-gestion-imprevus | § 5.14 | apps/web, apps/mobile |
| REQ-communication-sms-patient | § 5.15 | packages/sms |
| REQ-pwa-chauffeur | § 5.16 | apps/mobile |
| REQ-caisse-paiements-directs | § 5.19 | apps/web |
| REQ-mode-degrade | § 5.24 | apps/web, apps/mobile |
| REQ-moteur-tarification-cgss | chap. 7 | packages/pricing |

Détails : `/home/user/TAP/.planning/intel/requirements.md`.

---

## Constraints

**Total : 14**, ventilation par type :

- **schema** (architecture / structure base) : 2 (CON-002 multi-tenant, CON-012 dépendances monorepo).
- **nfr** (non-fonctionnelles) : 12 (HDS, chiffrement, performance UX, accessibilité,
  design system, TypeScript strict, limites de taille code, i18n, responsive,
  anti-patterns, géolocalisation, sessions).

Détails : `/home/user/TAP/.planning/intel/constraints.md`.

---

## Topics de contexte

**Total : 8** sections de contexte synthétisées :
- Identité projet
- Méthode produit (observations terrain)
- Architecture du dépôt
- ADR (conventions et index)
- Démarrage local
- Glossaire métier
- Patterns d'implémentation systématiques
- État d'avancement (Lot 0 terminé, Lot 1 en cours)
- Communication avec le propriétaire projet

Détails : `/home/user/TAP/.planning/intel/context.md`.

---

## Conflits

| Bucket | Compte |
|---|---|
| BLOCKERS | 0 |
| WARNINGS | 0 |
| INFO | 3 |

Rapport détaillé : `/home/user/TAP/.planning/INGEST-CONFLICTS.md`.

---

## Pointeurs intel

- Décisions : `/home/user/TAP/.planning/intel/decisions.md`
- Requirements : `/home/user/TAP/.planning/intel/requirements.md`
- Contraintes : `/home/user/TAP/.planning/intel/constraints.md`
- Contexte : `/home/user/TAP/.planning/intel/context.md`
- Rapport conflits : `/home/user/TAP/.planning/INGEST-CONFLICTS.md`

---

## Action recommandée pour l'aval

**Avant routing par `gsd-roadmapper`** : ingérer `docs/cahier_des_charges_saas_tap_v2.docx`
(après conversion .docx → .md) en tant que **PRD** via manifest. Sans cela, les
critères d'acceptation des 9 modules critiques restent partiels (pointeurs vers
le CDC), et 15 modules secondaires du CDC v2 sont absents du synthèse.

**Statut** : prêt à router (READY) — aucun blocker, aucune variante en attente
d'arbitrage utilisateur. La complétude fonctionnelle restera limitée tant que
le CDC v2 n'aura pas été ingéré comme PRD.

---

## Annexe — Run 2026-05-12 (incrémental)

Second ingest via manifest manuel `.planning/intel/staged-manifest.yml`,
3 SPECs ajoutées :

| Type | Source | Précédence | Locked |
|---|---|---|---|
| SPEC | .planning/regle-neutralite-et-ton.md | 0 | non |
| SPEC | .planning/pivot-e2e-v2-2026-05-11.md | 1 | non |
| SPEC | .planning/passes-2-3-4-detail.md | 2 | non |

**Contraintes ajoutées** : CON-015 à CON-021 (7 nouvelles contraintes
appendées à `constraints.md`).

**Conflits run 2026-05-12** :

| Bucket | Compte |
|---|---|
| BLOCKERS | 0 |
| WARNINGS | 1 (désalignement ROADMAP CDC ↔ pivot E2E) |
| INFO | 3 (CON-015..016, CON-017..020, CON-021) |

Rapport détaillé : `INGEST-CONFLICTS.md` (réécrit).

**Décisions à promouvoir** :
- CON-015 / CON-016 → NFR-001 (neutralité) / NFR-002 (ton sobre) dans
  REQUIREMENTS.md.
- CON-018 → NFR-003 (spacing scale strict).
- CON-019 → renforcer DEC-004 dans PROJECT.md.
- CON-021 → seeder les phases 04/05/06 de la nouvelle ROADMAP réécrite.

**Statut** : AWAITING USER — la WARNING ROADMAP doit être tranchée
avant que le route_merge_mode ne réécrive `.planning/ROADMAP.md`.
