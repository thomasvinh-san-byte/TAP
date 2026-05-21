# Audit des Server Actions

**Phase 06 — PLAN-4 (Bloc E.2)** · audit : 2026-05-21 · DEC-040 (guard `require*`) + DEC-041 (row count check).

**38 fichiers `'use server'`** inventoriés. Référence croisée : `docs/security/RLS-AUDIT.md` (matrice rôle × table) — chaque guard doit matcher le rôle réellement attendu.

## Principes

- **DEC-040** — toute Server Action de mutation admin/métier commence par un guard `require*` **partagé** (`@/lib/auth/require-dirigeant`, `require-admin-or-regulateur`). Pas de `requireX` local dupliqué.
- **DEC-041** — toute `UPDATE`/`DELETE` sur table RLS fait `.select('id')` + vérifie le nombre de lignes (RLS rejette en silence un write hors droits → faux succès sinon).
- Les **lectures** (catégorie B) n'ont pas besoin de guard : la RLS scope déjà la donnée.
- Les flux **auth / publics** (catégorie C) ont un guard adapté — pas de `requireDirigeant` aveugle (le portail légal patient s'authentifie par **token**, pas par rôle).

## Catégorie A — mutations admin / métier

| Fichier | Guard | Row count | Verdict |
|---|---|---|---|
| `(admin)/admin/chauffeurs/actions.ts` | `requireAdminOrRegulateur` / `requireDirigeant` | ✅ | conforme |
| `(admin)/admin/vehicules/actions.ts` | `requireDirigeant` | ✅ | **corrigé** — `requireDirigeant` local dédupliqué → helper partagé ; `archiveVehicleAction` row count ajouté |
| `(admin)/admin/tarifs/actions.ts` | `requireDirigeant` | ✅ | conforme |
| `(admin)/admin/maintenance/actions.ts` | `requireDirigeant` | ✅ | conforme |
| `(admin)/admin/sms-templates/actions.ts` | `requireDirigeant` | ✅ | conforme |
| `(admin)/admin/legal/dpo/actions.ts` | — → `requireDirigeant` | n/a | **corrigé** — guard ajouté (T-04.5-27) |
| `(admin)/admin/legal/registre/actions.ts` | — → `requireDirigeant` | n/a (INSERT-only) | **corrigé** — guard ajouté |
| `(admin)/admin/legal/dpa/actions.ts` | — → `requireDirigeant` | n/a (INSERT-only) | **corrigé** — guard ajouté |
| `(admin)/admin/legal/dpia/actions.ts` | — → `requireDirigeant` | ⚠ voir résidu | **corrigé** — guard ajouté (2 actions) |
| `(admin)/admin/legal/breaches/actions.ts` | — → `requireDirigeant` | ⚠ voir résidu | **corrigé** — guard ajouté (2 actions) |
| `(admin)/admin/legal/requests/actions.ts` | — → `requireDirigeant` | ⚠ voir résidu | **corrigé** — guard ajouté (2 actions) |
| `(app)/patients/constraints.actions.ts` | — → `requireAdminOrRegulateur` | ✅ ajouté | **corrigé** — guard + row count sur le DELETE |
| `(app)/patients/actions/recurrences.ts` | `requireAdminOrRegulateur` | ✅ | conforme |
| `(app)/patients/actions/archive.ts` | `requireAdminOrRegulateur` / `requireDirigeant` | ✅ | conforme |
| `(app)/cockpit/actions.ts` | `requireAdminOrRegulateur` | ✅ | conforme |
| `(app)/courses/actions/create.ts` | `getAuthContext` | ✅ | conforme |
| `(app)/courses/actions/edit.ts` | `getAuthContext` | ✅ | conforme |
| `(app)/courses/actions/cancel.ts` | `getAuthContext` | ✅ | conforme |
| `(app)/courses/actions/override.ts` | `requireAdminOrRegulateur` | ✅ | conforme |
| `(app)/courses/actions/assignment.ts` | `getAuthContext` | ⚠ résidu | guard auth OK ; row count à renforcer (cf. résidu) |
| `(app)/courses/actions/payment.ts` | `getAuthContext` | ⚠ résidu | guard auth OK ; row count à renforcer (cf. résidu) |
| `(app)/courses/actions/caisse.ts` | `requireAdminOrRegulateur` | n/a (lecture/export) | conforme |
| `(driver)/conduite/actions.ts` | `getAuthContext` | ✅ (DEC-041 Phase 04.5) | conforme |
| `(app)/patients/actions/_existing.ts` | `getAuthContext` (via flux création patient) | ⚠ résidu | rattaché au flux `create` patient — row count à confirmer |
| `lib/pois/actions.ts` | — | n/a (lecture) | conforme (catégorie B) |

## Catégorie B — lectures (RLS suffit, pas de guard requis)

`courses/actions/list.ts`, `check-duplicate.ts`, `get-ride-defaults.ts`, `_shared.ts`, `courses/actions/index.ts` (ré-export), `courses/caisse/_lib/queries-caisse.ts` — aucune mutation ; la RLS Postgres scope la donnée par `organization_id`. Pas de guard `require*` nécessaire.

## Catégorie C — flux auth / publics (guard adapté)

| Fichier | Guard adapté |
|---|---|
| `(auth)/login/actions.ts`, `(auth)/actions.ts` | flux d'authentification — pas de mutation métier |
| `(auth)/accept-invite/actions.ts` | invitation par magic link — l'utilisateur invité active son compte (token Supabase) |
| `(public)/legal/request/[token]/actions.ts` | **portail légal patient — authentification par TOKEN JWT signé**, surtout PAS `requireDirigeant` |
| `(admin)/admin/legal/_actions/cgu-accept.ts` | tout utilisateur authentifié accepte sa propre CGU |
| `setup/actions.ts` | flux d'initialisation |
| `dev/actions.ts` | utilitaire dev-only |

## Résidu documenté

Le row count `DEC-041` n'est pas encore systématique sur quelques `UPDATE` : `assignment.ts`, `payment.ts`, les `UPDATE` des actions legal `dpia`/`breaches`/`requests`, `_existing.ts`. Ces actions sont **authentifiées** (guard présent) et la RLS les protège ; le renforcement row count (passer de `if (error)` à `.select('id')` + vérification de longueur) reste recommandé — à appliquer dans un environnement où le flux runtime peut être vérifié. Aucun de ces points n'est une faille d'autorisation : c'est un durcissement de l'UX d'erreur (éviter un faux succès quand la RLS rejette en silence).
