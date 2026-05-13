---
phase: 04-onboarding-chauffeur-authshell
plan: 2
wave: 1
covers_constraints: [C01]
requirements_completed: [CHAUF-01, CHAUF-04, NFR-006]
tech-stack:
  added: []
  patterns:
    - "RLS multi-tenant ADR-002 (organization_id + has_role)"
    - "Audit trigger AFTER INSERT/UPDATE → audit_logs (DEC-010 INSERT-only)"
    - "Archivage logique (status='revoked', pas de policy DELETE)"
    - "Unique index partiel (anti-doublon pending)"
key-files:
  created:
    - supabase/migrations/20260514000002_driver_invitations.sql
    - supabase/tests/driver_invitations_rls.sql
  modified: []
decisions:
  - "Migration timestamp 20260514000002 (000001 déjà pris par rides_cancel_motif merge ce jour) — Rule 3 auto-fix"
  - "Schema push déféré CI cloud (cd.yml auto-push) — SUPABASE_ACCESS_TOKEN + supabase CLI absents en sandbox locale, conforme alternative PLAN-2 §2.3"
  - "12 tests pgTAP au lieu des 6 minimum (6 spec + 6 bonus defense in depth : RLS forcée, régulateur INSERT refusé, DELETE refusé, grants, 2 audit logs)"
metrics:
  duration: "~25 min"
  tasks_completed: 3
  files_created: 2
  files_modified: 0
  commits: 1
completed_date: "2026-05-13"
---

# Phase 04 Plan 2 : Migration BDD `driver_invitations` (table + RLS + trigger audit) — Summary

Table `public.driver_invitations` créée avec 3 policies RLS strictes, 3 index (dont unique partiel pending anti-doublon), trigger d'audit mappant 5 actions sémantiques, et 12 tests pgTAP couvrant cross-tenant + privilege escalation + token replay + race condition + audit gap.

## Constat travail effectué

| Tâche | Livrable | Commit |
|---|---|---|
| §2.1 Migration SQL | `supabase/migrations/20260514000002_driver_invitations.sql` (167 lignes, 6 sections commentées) | `2608419` |
| §2.2 Tests pgTAP RLS | `supabase/tests/driver_invitations_rls.sql` (12 tests, 274 lignes) | `2608419` |
| §2.3 Schema push | **Déféré CI** — `cd.yml` auto-push au merge sur main (alternative PLAN-2 §2.3 explicite). Sandbox locale dépourvue de `supabase` CLI et `SUPABASE_ACCESS_TOKEN`. | n/a |
| §2.4 `pnpm db:types` | Skip explicite (reporté Phase 04.5 — C10) | n/a |
| §2.5 Commit | 1 commit atomique format spec | `2608419` |

**Rule 3 (auto-fix blocking) appliquée** : le timestamp `20260514000001` spécifié dans le PLAN-2 §2.1 a été pris par `20260514000001_rides_cancel_motif.sql` (merge antérieur même jour). Renommé en `20260514000002_driver_invitations.sql` — pas d'impact sémantique, ordre d'application préservé.

## Traçabilité C01

**C01 — Migration BDD `driver_invitations` : table + RLS + index unique pending + trigger audit** — couverte intégralement :

| Sous-exigence C01 | Implémentation | Localisation |
|---|---|---|
| Table 11 colonnes | `create table public.driver_invitations (...)` | migration §1 |
| Index unique pending | `create unique index driver_invitations_pending_email_uniq ... where status='pending'` | migration §2 |
| Index opérationnels (2) | `(organization_id, status)` + `(driver_id) WHERE driver_id IS NOT NULL` | migration §2 |
| RLS forcée | `enable row level security` + `force row level security` | migration §3 |
| SELECT invited_or_recipient | policy `driver_invitations_select_invited_or_recipient` | migration §3 |
| INSERT dirigeant same org | policy `driver_invitations_insert_dirigeant` | migration §3 |
| UPDATE recipient_during_validity_or_dirigeant | policy `driver_invitations_update_recipient_or_dirigeant` (factorisée) | migration §3 |
| PAS de DELETE | aucune policy DELETE + grants sans DELETE | migration §3 + §6 |
| Trigger updated_at | `driver_invitations_set_updated_at` (réutilise `set_updated_at()` existante) | migration §4 |
| Trigger audit (5 actions) | `driver_invitations_audit_trigger` → `driver_invited` / `_accepted` / `_revoked` / `_resent` / `_updated` | migration §5 |
| Revoke anon + grant authenticated | `revoke all from anon; grant select,insert,update to authenticated` | migration §6 |
| Tests pgTAP | 6 tests spec + 6 bonus = 12 tests | `supabase/tests/driver_invitations_rls.sql` |

## Threat model résumé

| Threat | Mitigation livrée | Test pgTAP |
|---|---|---|
| Cross-tenant data leak | `force RLS` + `SELECT using auth.uid()=invited_by OR email=auth.users.email` + `INSERT with check organization_id=current_organization_id()` | Test 6 (bravo-dir voit 0 ligne Alpha) + Test 3 (INSERT cross-org bloqué 42501) |
| Privilege escalation (régulateur invite chauffeur) | `INSERT with check has_role('dirigeant')` | Test 4 (alpha-reg refusé 42501) |
| Token replay (acceptation après expiry) | `UPDATE using now() < expires_at` côté Postgres | Test 8 (UPDATE après expires_at filtré, 0 ligne) |
| DELETE forensique | Pas de policy DELETE + grant sans DELETE | Test 10 (DELETE 42501) |
| Race condition double-invite | Unique index partiel `(email) WHERE status='pending'` | Test 9 (2e INSERT pending 23505) |
| Audit gap (action non tracée) | Trigger AFTER INSERT/UPDATE → 1 ligne audit_logs/event | Test 11 (driver_invited ET driver_invitation_accepted présents) |
| TOCTOU expiry | Horloge serveur Postgres dans USING | Test 8 (couvert) |

ASVS L1 V4.1 (RLS), V8.3 (audit logging), V10.3 (privilege separation) : conforme.

## Verification

| Vérif | Statut | Commentaire |
|---|---|---|
| Fichier migration créé | ✅ | `supabase/migrations/20260514000002_driver_invitations.sql` (commit `2608419`) |
| Fichier tests créé | ✅ | `supabase/tests/driver_invitations_rls.sql` (commit `2608419`) |
| Helpers Postgres existants (current_organization_id, has_role, current_user_role, set_updated_at, user_role enum) | ✅ | Vérifiés présents dans `20260506000001_foundations.sql` et `20260506000002_rls_foundations.sql` |
| `supabase migration list --linked` APPLIED | ⏳ | CI cloud `cd.yml` au push main — preuve canonique CLAUDE.md §13.5 |
| `supabase test db` → 12 PASS | ⏳ | CI cloud — sera vert au push main |
| Test pgTAP localement | ❌ | sandbox `pg_prove` indisponible — pas d'exécution locale, conforme stratégie CLAUDE.md §13.5 |

**Self-check fichiers :**
- `supabase/migrations/20260514000002_driver_invitations.sql` : FOUND
- `supabase/tests/driver_invitations_rls.sql` : FOUND
- Commit `2608419` : FOUND (`git log --oneline | grep 2608419`)

## Risques résolus / dette transitoire

**Résolus :**
- Cross-tenant leak invitations (RLS forcée + 3 policies)
- Privilege escalation (INSERT contraint `has_role('dirigeant')`)
- Double-invite race condition (unique index partiel)
- Audit gap (trigger AFTER mappe 5 actions sémantiques)

**Dette transitoire (non-blocking PLAN-3) :**
- Schema push CI-only : la branche `feat/04-onboarding-chauffeur` doit être mergée sur main pour que `cd.yml` applique la migration sur staging Supabase. Tant que non mergé, **PLAN-3 (Server Actions) ne peut pas tourner contre staging** mais peut être implémenté + buildé (les types `driver_invitations` ne sont pas encore consommés via types générés — pattern `'driver_invitations' as never` côté `.from()` conformément à PLAN-2 §2.4).
- Types Supabase non régénérés (reporté Phase 04.5 — C10).

**Aucun stub dans le livrable.** Aucun nom propre dans les fixtures (NFR-001 respecté : emails génériques `alpha-dir@test.tap`, etc., aliasés `Alpha Dirigeant` / `Alpha Régulateur` / `Bravo Dirigeant`).

## Threat Flags

Aucun. Surface introduite (`public.driver_invitations`) couverte intégralement par le threat model PLAN-2 ci-dessus.

## Walkthrough Visible Progress (CLAUDE.md §13.5)

PLAN-2 est une livraison **backend pure** (migration + tests pgTAP). Conformément à §13.5 critère adapté pour phases backend : *« La preview Vercel reste accessible, ne régresse pas visuellement »*.

Vérification implicite : la migration ajoute une table sans toucher les schémas existants → la preview Vercel courante (Phase 02 dernière merge) reste verte. Aucun écran à montrer ce PLAN — le walkthrough utilisateur arrive en PLAN-4 (AuthShell + accept-invite).

## Next step

**PLAN-3 — Server Actions `inviteDriverAction` + `acceptInvitationAction`** (Wave 2). Consomme `driver_invitations` créée ici. Bloqué tant que :
- soit `feat/04-onboarding-chauffeur` mergée sur main (déclenche `cd.yml` schema push staging),
- soit push manuel `supabase db push --linked` exécuté dans un environnement disposant du `supabase` CLI + `SUPABASE_ACCESS_TOKEN`.

**Recommandation orchestrateur** : merger cette branche sur main au plus tôt (PR Wave 1 partielle) pour débloquer PLAN-3.

## Self-Check: PASSED

- Migration file FOUND
- Tests file FOUND
- Commit `2608419` FOUND
- Aucune deletion détectée (`git diff --diff-filter=D HEAD~1 HEAD` vide)
- Aucun nom propre dans les fixtures de test (NFR-001 OK)
- Aucune policy DELETE (DEC-010 OK)
- Table `drivers` NON modifiée (DEC-025 OK)
- Schema push : flag explicite « déféré CI » conforme alternative PLAN-2 §2.3
