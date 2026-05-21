# Audit RLS systémique + advisors sécurité

**Phase 06 — PLAN-3 (Bloc E.1)** · audit : 2026-05-21 · prérequis de la migration HDS (06.5).

État de départ vérifié en production : **28 tables `public`, 28 avec RLS activée (100 %), 68 policies — aucune table sans policy.** L'audit porte sur la *qualité* des policies (trous fins, excès) et sur les advisors sécurité Supabase.

---

## 1. Matrice RLS — rôle × table × action

Règles métier de référence : CLAUDE.md § 6, DEC-002 (RLS forcée + `organization_id`), DEC-010 (`audit_logs` append-only).
Rôles : `dirigeant` (D), `regulateur` (R), `chauffeur` (C), `anon` (—, ne lit rien).
Verdict : **OK** = policy conforme · **par conception** = absence de policy volontaire (append-only / versionné / archivage au lieu de suppression / donnée de référence / écrit côté service) · **TROU** / **EXCÈS** = écart à corriger.

| Table | SELECT | INSERT | UPDATE | DELETE | Verdict |
|---|---|---|---|---|---|
| organizations | membres org | — | D | — | par conception (org provisionnée) |
| profiles | membres org | — (trigger Auth) | soi-même / D | — | par conception |
| audit_logs | D | acteur (self) | — | — | par conception (append-only DEC-010) |
| patients | membres org | R | R | — | par conception (anonymisation RGPD, pas de delete) |
| patient_constraint | membres org | R | — | R | par conception (suppr.+recréation) |
| patient_operational_note | membres org | R | R | — | OK |
| rides | membres org | R/D | R/D + chauffeur (ses courses) | — | OK (trou chauffeur comblé Phase 04.5) |
| ride_draft | propriétaire (FOR ALL) | propriétaire | propriétaire | propriétaire | OK |
| ride_events | membres org | R / chauffeur | — | — | par conception (append-only) |
| ride_recurrences | membres org | R | R | D | OK |
| ride_recurrence_exceptions | membres org | R | R | D | OK |
| drivers | membres org | R/D | R/D | — | par conception (archivage DEC-029) |
| driver_invitations | invité/destinataire | R/D | destinataire/R/D | — | par conception |
| vehicles | membres org | D | D | — | par conception (archivage) |
| pois_metier | membres org | R/D (FOR ALL) | R/D | R/D | OK |
| tariff_grids | membres org | D | — | — | par conception (versionné INSERT-only DEC-057) |
| holidays_974 | tous authentifiés | — | — | — | par conception (référentiel, migration/seed) |
| sms_messages | membres org | — | — | — | par conception (écrit par le service / cron) |
| sms_templates | tous authentifiés | — | D | — | par conception (jeu fixe seedé) |
| idempotency_keys | propriétaire | propriétaire | — | — | OK (clés PWA, expiration par cron) |
| cgu_acceptance | soi-même | soi-même | — | — | par conception |
| cookie_consent_log | service | service | — | — | par conception |
| legal_request_attempts | service | service | service | — | par conception |
| data_processing_register | membres org | D | — | — | par conception (INSERT-only — `actions.ts` : « Aucun updateAction volontairement ») |
| dpa_record | membres org | D | D | — | OK |
| dpia_record | membres org | D | D | — | OK |
| data_breach_incident | membres org | D | D | — | OK |
| patient_data_request | membres org | D | D | — | par conception (clôture par anonymisation) |

**Conclusion matrice** : aucun **TROU** ni **EXCÈS**. Toutes les absences de policy sont volontaires et cohérentes avec les règles métier (append-only, versionnement, archivage au lieu de suppression, référentiels, tables écrites côté service). Le seul trou historique connu — un chauffeur ne pouvait pas mettre à jour ses propres courses — a déjà été corrigé en Phase 04.5 (`rides_update_chauffeur_own_rides`). **Aucune migration corrective RLS n'est requise par cette wave.**

---

## 2. Tri des fonctions `SECURITY DEFINER`

L'advisor Supabase signale les `SECURITY DEFINER` exécutables par `anon`/`authenticated`. Un `SECURITY DEFINER` n'est pas un bug — l'exposer en RPC à `anon` quand ce n'est pas nécessaire en est un. Tri :

| Fonction | Nature | Appelée par | Verdict |
|---|---|---|---|
| `rides_audit_trigger` … `dpia_record_audit_trigger` (13) | trigger d'audit | moteur de triggers | **EXECUTE révoqué de `public`** — un trigger se déclenche sans EXECUTE direct |
| `profiles_prevent_self_escalation`, `drivers_archive_columns_dirigeant_only` | trigger de garde | moteur de triggers | **EXECUTE révoqué de `public`** |
| `set_updated_at`, `patient_data_request_set_deadline` | trigger utilitaire | moteur de triggers | **EXECUTE révoqué de `public`** |
| `check_breach_deadlines`, `purge_legal_request_attempts` | cron | `pg_cron` (rôle `postgres`) | **EXECUTE révoqué de `public`** |
| `has_role`, `current_organization_id`, `current_user_role` | helper RLS | expressions de policy RLS | **conservé exécutable par `authenticated`** — légitime par conception |
| `search_patients` | RPC | `.rpc()` app (authenticated) | **conservé** — déjà `revoke from public` + `grant to authenticated` |
| `rgpd_anonymize_patient` | RPC | `.rpc()` effacement RGPD (authenticated) | **conservé** — déjà `revoke from public, anon` + `grant to authenticated` |
| `nir_match_patient_for_legal_request` | RPC | `.rpc()` portail légal (authenticated) | **conservé** — déjà `revoke from public` + `grant to authenticated, service_role` |
| `unaccent_immutable` | helper d'index (recherche fuzzy) | expressions d'index | **conservé** — requis pour l'évaluation des index |

> **Pourquoi les helpers RLS et les RPC restent exécutables** : une expression de policy RLS s'évalue avec les privilèges du rôle qui requête. Révoquer l'`EXECUTE` de `has_role` / `current_organization_id` / `current_user_role` à `authenticated` ferait échouer **toute requête authentifiée** (« permission denied for function »). De même, révoquer `rgpd_anonymize_patient` / `nir_match_patient_for_legal_request` casserait l'effacement RGPD et le portail légal patient (appels `.rpc()`). Pour ces fonctions, l'advisor « exécutable par `authenticated` » est **attendu par conception** ; le durcissement réel (`revoke from anon`) est déjà en place sur les RPC. Arbitrage dirigeant 2026-05-21 — périmètre sûr : REVOKE limité aux triggers et crons.

Migration : `supabase/migrations/20260525000001_security_advisors.sql`.

---

## 3. Advisors sécurité — état

| Advisor | Nombre | Traitement |
|---|---|---|
| `function_search_path_mutable` | 3 (`set_updated_at`, `unaccent_immutable`, `patient_data_request_set_deadline`) | **Corrigé** — `ALTER FUNCTION … SET search_path = public, extensions` (migration 20260525000001) |
| `SECURITY DEFINER` exécutable anon/authenticated | ~45 lints (≈19 fonctions × anon+authenticated) | **Partiellement résolu** — EXECUTE révoqué de `public` sur les 19 fonctions triggers+crons ; les helpers RLS et RPC restent exécutables (légitime, cf. § 2) |
| `extension_in_public` (`pg_net`) | 1 | **Différé** — `pg_net` est dormant (crons SMS en pause, ADR-004). Le déplacer (`ALTER EXTENSION pg_net SET SCHEMA extensions`) maintenant risquerait le rejeu de la chaîne de migrations sans bénéfice runtime. À traiter au rebranchement du fournisseur SMS, où il pourra être testé. |
| `auth_leaked_password_protection` désactivé | 1 | **Action console dirigeant** — non automatisable en SQL. Voir § 4. |

---

## 4. Action dirigeant requise — protection mots de passe compromis

`leaked_password_protection` est désactivé. Il n'est pas configurable par migration SQL.

**À faire (dirigeant)** : console Supabase → **Authentication → Settings → Password security** → activer **« Leaked password protection »** (vérification des mots de passe contre la base HaveIBeenPwned). Action ponctuelle, sans impact sur les comptes existants.

---

## 5. Couverture pgTAP — état et résidu

Tests pgTAP existants (21 fichiers) couvrant cross-org / cross-driver / anti-escalation : `foundations.sql`, `rides_rls.sql`, `rides_update_chauffeur_rls.sql`, `patients.sql`, `drivers_rls.sql`, `vehicles_rls.sql`, `ride_draft_rls.sql`, `patient_constraint.sql`, `patient_operational_note.sql`, `data_breach_incident_rls.sql`, `dpa_record_rls.sql`, `dpia_record_rls.sql`, `patient_data_request_rls.sql`, `data_processing_register_rls.sql`, `driver_invitations_rls.sql`, etc.

Ajouté cette wave : `security_advisors.sql` — vérifie le `search_path` figé, le REVOKE des triggers/crons, et **prouve que les helpers RLS restent exécutables** (le RLS n'est pas cassé).

**Résidu documenté** — tables sans test RLS pgTAP dédié : `tariff_grids`, `sms_messages`, `sms_templates`, `ride_recurrences`, `ride_recurrence_exceptions`, `ride_events`, `holidays_974`, `idempotency_keys`, `cgu_acceptance`, `cookie_consent_log`, `legal_request_attempts`. Leur RLS est conforme (cf. matrice § 1) mais non couverte par une assertion dédiée. Extension de couverture recommandée avant la mise en production HDS (06.5) — à réaliser dans un environnement où la suite pgTAP est exécutable (la sandbox actuelle n'a pas de daemon Docker).

---

## 6. Vérification post-merge

Après merge + CD, le dirigeant peut relancer `get_advisors` (MCP Supabase ou console) pour confirmer la réduction : les 3 `function_search_path_mutable` doivent disparaître, et les lints `SECURITY DEFINER` sur les fonctions triggers/crons aussi. Les lints résiduels attendus : helpers RLS + RPC (légitimes, § 2), `pg_net` (différé, § 3), `leaked_password` (jusqu'à l'action console, § 4).
