# PLAN-3 — Bloc E.1 : audit RLS systémique + advisors sécurité

**Phase** : 06 Facturation CGSS + audit sécurité + dettes CI
**Wave** : 2/3 (parallélisable avec PLAN-2 facturation)
**Dépendances** : PLAN-1 mergé (CI verte — les nouveaux pgTAP doivent tourner). Indépendant de PLAN-2.
**Estimation** : 3-5 h
**Refs** : 06-CONTEXT.md (Bloc E, D-10/D-12), CONCERNS.md § « Audit RLS systémique reporté Phase 06 HDS », ADR-002 RLS multi-tenant, DEC-002 RLS forcée + `organization_id`, DEC-032 CD push, CLAUDE.md § 6

---

## Goal

Auditer la sécurité au niveau base de données : inventorier les policies RLS de **toutes** les tables métier, produire une matrice rôle × table × action (attendu vs actuel), corriger les trous par migration, couvrir par pgTAP (isolation cross-org, cross-driver, anti role-escalation), et traiter les ~50 advisors sécurité Supabase. Prérequis de la future sous-phase 06.5 HDS — on ne migre pas une RLS trouée. ZÉRO UI.

---

## Livrable 1 — Matrice d'audit RLS

**Fichier à créer** : `.planning/phases/06-facturation-securite-ci/RLS-AUDIT.md` (document d'audit, pas une page produit).

Inventaire des policies de toutes les tables métier (~28). Lister depuis `supabase/migrations/` + vérifier l'état réel via `supabase` (lecture seule). Tables connues à couvrir, non exhaustif :
`organizations`, `profiles`, `rides`, `ride_draft`, `ride_events`, `ride_recurrences`, `ride_recurrence_exceptions`, `holidays_974`, `patients`, `patient_operational_note` (+ tables préférences/incidents patient), `drivers`, `driver_invitations`, `vehicles`, `pois_metier`, `tariff_grids`, `audit_logs`, `idempotency_keys`, `sms_messages`, `sms_templates`, `data_processing_register`, `dpa_record`, `dpia_record`, `data_breach_incident`, `patient_data_request`, `legal_*`.

Pour chaque table : **matrice rôle × action** — `dirigeant` / `regulateur` / `chauffeur` / `anon` × `SELECT` / `INSERT` / `UPDATE` / `DELETE`, colonne **attendu** (règle métier) vs **actuel** (policy en place). Marquer chaque écart `TROU` (manque une policy) ou `EXCÈS` (policy trop permissive).

Règles métier de référence (CLAUDE.md § 6, DEC-002) : RLS activée sur toute table métier ; `organization_id` scoping systématique ; un chauffeur ne voit que ses propres tournées (`driver_id` lié à `auth.uid()` via `drivers.profile_id`) ; `anon` ne lit aucune donnée métier ; les tables `legal_*` restent dirigeant-only.

---

## Livrable 2 — Migrations correctives RLS

**Fichiers à créer** : `supabase/migrations/2026MMDD000001_rls_audit_fixes.sql` (+ découper si volumineux).

Pour chaque `TROU` / `EXCÈS` de la matrice : policy corrective (`CREATE POLICY` / `DROP POLICY` + recréation). Précédent connu (CONCERNS) : Phase 04.5 a révélé l'absence de policy `rides_update_chauffeur_*` ; le même type de trou peut exister sur d'autres tables. Vérifier en priorité les tables où un rôle agit sans policy correspondante.

> **DEC-032** : migrations appliquées au merge via `cd.yml` `supabase db push` — JAMAIS via MCP `apply_migration`. Le job `sync-types` régénère `types.gen.ts` post-merge.

---

## Livrable 3 — Tests pgTAP

**Fichiers à créer / étendre** : `supabase/tests/*.sql` (gabarit existant — 21 fichiers, voir `rides_rls.sql`, `rides_update_chauffeur_rls.sql`, `patients.sql`).

Couverture exigée :
- **Isolation cross-org** : un utilisateur de l'org A ne lit / n'écrit jamais les données de l'org B — par table métier.
- **Isolation cross-driver** : un chauffeur ne lit / ne modifie que ses propres `rides` (et tables liées).
- **Anti role-escalation** : un `regulateur` ne peut pas exécuter une action `dirigeant`-only (ex. tables `legal_*`, `tariff_grids` INSERT, archivage chauffeur) ; `anon` ne lit rien.
- Une assertion pgTAP par écart corrigé en Livrable 2 (le test prouve le correctif).

---

## Livrable 4 — Advisors sécurité Supabase (~50, inventaire vérifié)

**Fichiers à créer** : migration(s) `supabase/migrations/2026MMDD000002_security_advisors.sql`.

1. **`function_search_path_mutable` (3)** — `set_updated_at`, `unaccent_immutable`, `patient_data_request_set_deadline` : ajouter `SET search_path = ''` (ou schéma explicite) à chaque fonction. Fix simple, migration `ALTER FUNCTION ... SET search_path`.
2. **`pg_net` dans le schéma `public`** — déplacer vers le schéma `extensions` (ou `net`). `ALTER EXTENSION pg_net SET SCHEMA extensions`. Vérifier que les appels `net.http_post` des crons (Phase 05, en pause ADR-004) restent référencés correctement.
3. **`leaked_password_protection` désactivé** — **action console** (Auth settings Supabase), PAS une migration SQL. Le PLAN ne peut pas l'automatiser : **documenter** dans `RLS-AUDIT.md` et le SUMMARY (PLAN-4) une consigne explicite pour le dirigeant (« activer Leaked Password Protection dans Authentication → Settings »).
4. **~40 `SECURITY DEFINER` exécutables par `anon`/`authenticated`** — **TRIER, ne pas supprimer en masse** (verrou V6) :
   - **Légitimes** (la majorité) : fonctions RLS `has_role`, `current_organization_id`, `current_user_role` ; triggers d'audit ; helpers de policies. Un `SECURITY DEFINER` légitime n'est **pas** un bug — il est nécessaire au fonctionnement des policies. → **confirmer + documenter** dans `RLS-AUDIT.md` (pourquoi chacune est légitime).
   - **Non justifiées** : restreindre l'`EXECUTE` (`REVOKE EXECUTE ... FROM anon, authenticated` puis `GRANT` ciblé) là où la fonction n'a pas besoin d'être appelable directement par un client.
   - Produire dans `RLS-AUDIT.md` un tableau : fonction × `SECURITY DEFINER` × appelable par × verdict (`légitime documentée` / `EXECUTE restreint`).

---

## Critères GREEN

- `RLS-AUDIT.md` : matrice rôle × table × action complète (~28 tables), chaque écart classé `TROU` / `EXCÈS` / `OK`.
- Migration(s) corrective(s) RLS appliquée(s) (CD push) — tous les `TROU` / `EXCÈS` traités.
- pgTAP : isolation cross-org, cross-driver, anti role-escalation **verts** en CI (le runner pgTAP est réparé par PLAN-1).
- Advisors : 3 `function_search_path_mutable` corrigés ; `pg_net` hors `public` ; `leaked_password_protection` documenté pour action dirigeant ; les ~40 `SECURITY DEFINER` triés (légitimes documentés / `EXECUTE` restreint sinon).
- `RLS-AUDIT.md` contient le tableau de tri des `SECURITY DEFINER` avec verdict justifié.
- `pnpm typecheck` workspace PASS (régénération `types.gen.ts` post-merge).

---

## Risques + mitigations

- **Volume** : ~28 tables + ~50 advisors. Si la wave déborde, sous-découper en execute (la matrice d'abord, puis les correctifs par lot de tables) — A (PLAN-2) reste parallélisable, le découpage interne de E ne bloque pas A.
- **Faux positif `SECURITY DEFINER`** : traiter une fonction légitime comme un bug casserait les policies (récursion RLS, cf. CONCERNS régression PR #101). Mitigation : verrou V6 — trier, documenter le « pourquoi légitime », tester chaque restriction d'`EXECUTE` par pgTAP avant de la garder.
- **`pg_net` déplacement** : risque de casser les références cron. Mitigation : les crons SMS sont en pause (ADR-004) — vérifier quand même les chemins de fonctions ; tester le `db push` sur preview.
- **Migration RLS récursive** : précédent PR #101 (récursion RLS). Mitigation : toute nouvelle policy qui appelle une fonction doit passer par les helpers `SECURITY DEFINER` existants, pas par une sous-requête sur la même table.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Supprimer en masse les `SECURITY DEFINER` (verrou V6 — légitime ≠ bug).
- ❌ Désactiver RLS « pour déboguer » (CLAUDE.md § 6).
- ❌ Appliquer les migrations via MCP `apply_migration` (DEC-032 — CD push exclusif).
- ❌ Créer une policy qui interroge sa propre table sans helper `SECURITY DEFINER` (récursion RLS — précédent PR #101).
- ❌ Tenter d'automatiser `leaked_password_protection` en SQL (c'est un réglage console — documenter).
- ❌ Inventer une UI pour cet audit (Bloc E sans surface — UI-SPEC §11).
- ❌ Élargir au-delà de l'audit RLS + advisors (l'audit Server Actions = PLAN-4).
