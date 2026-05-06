## Conflict Detection Report

**Mode** : new
**Précédence appliquée** : ADR > SPEC > PRD > DOC
**Sources analysées** : 5 documents (2 ADR, 3 DOC)
**Cycle detection** : aucun cycle détecté dans le graphe `cross_refs`

---

### BLOCKERS (0)

Aucun.

Aucune contradiction LOCKED-vs-LOCKED entre les ADR ingérés (ADR-001 portée
monorepo, ADR-002 portée multi-tenant — scopes disjoints). Aucun document
classifié `UNKNOWN` à confiance basse. Aucun cycle dans le graphe de
références croisées. Pas de contexte existant à confronter (`MODE=new`).

---

### WARNINGS (0)

Aucun.

Aucun PRD ingéré, donc pas de variantes d'acceptance criteria concurrentes à
arbitrer. Les requirements synthétisés (REQ-*) sont des pointeurs vers le
Cahier des charges V2 (`docs/cahier_des_charges_saas_tap_v2.docx`) qui n'a pas
été ingéré (format binaire .docx). Voir la note d'action ci-dessous.

---

### INFO (3)

[INFO] Élévation DOC → décisions verrouillées (CLAUDE.md)
  Source : /home/user/TAP/CLAUDE.md (classifié DOC, manifest_override=true)
  Note : Le propriétaire projet traite explicitement CLAUDE.md comme document
    autoritatif (« à lire intégralement avant toute session de développement »).
    Sur instruction d'ingest, les décisions de CLAUDE.md qui ne contredisent
    pas ADR-001 / ADR-002 sont élevées au rang de décisions verrouillées dans
    /home/user/TAP/.planning/intel/decisions.md (DEC-003 à DEC-016).
  Rationale : précédence ADR > DOC respectée — aucune décision DOC élevée ne
    contredit un ADR. CLAUDE.md étend le scope (stack technique, sécurité
    applicative, ergonomie, conventions) là où les ADR ne se prononcent pas.
  Action recommandée : à terme, formaliser certaines de ces décisions en ADR
    autonomes (ex. ADR-003 « Stack front Next.js + shadcn/ui », ADR-004
    « Chiffrement applicatif AES-256-GCM des données ultra-sensibles »).

[INFO] Auto-résolu : cohérence ADR ↔ DOC sur multi-tenant
  Source ADR : /home/user/TAP/docs/adr/ADR-002-supabase-rls-multitenant.md
  Source DOC : /home/user/TAP/CLAUDE.md § 6
  Note : ADR-002 et CLAUDE.md § 6 énoncent la même politique RLS (RLS forcée,
    `organization_id` sur toute table métier, tests pgTAP, interdiction
    `service_role` côté client). Aucune divergence détectée — fusionnés dans
    DEC-002 / CON-002 sous l'autorité de l'ADR.

[INFO] Auto-résolu : cohérence ADR ↔ DOC ↔ README sur l'architecture monorepo
  Sources :
    - /home/user/TAP/docs/adr/ADR-001-monorepo-turborepo.md
    - /home/user/TAP/CLAUDE.md § 4
    - /home/user/TAP/README.md
  Note : Les trois sources convergent (Turborepo + pnpm workspaces, structure
    `apps/` + `packages/` + `services/` + `supabase/`). Synthétisé dans DEC-001
    et CON-012 sous l'autorité de l'ADR-001.

---

## Notes d'action (non-conflits — informatif)

1. **Cahier des charges V2** (`docs/cahier_des_charges_saas_tap_v2.docx`) est
   référencé comme document métier de référence dans CLAUDE.md, README.md et
   l'ensemble des requirements REQ-*. Il n'a **pas été ingéré** car au format
   binaire .docx. Tant qu'il n'est pas converti en texte/markdown et tagué
   comme PRD via manifest, les requirements synthétisés restent des pointeurs
   vers ce CDC et non des spécifications complètes (notamment les critères
   d'acceptation détaillés des modules CDC v2 § 5.8 à § 5.24 et chapitre 7).

2. **15 modules secondaires** mentionnés dans CLAUDE.md § 2 (CDC v2 contient
   24 modules ; seuls 9 critiques sont listés dans CLAUDE.md). Leur synthèse
   nécessite l'ingest du CDC v2.

3. Aucune SPEC formelle n'a été ingérée. Les contraintes (CON-*) viennent
   exclusivement des ADR et de CLAUDE.md.
