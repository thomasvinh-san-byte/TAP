---
phase: 04.5
plan: 5
plan_number: 5
slug: dette-technique
type: execute
status: draft
estimated_hours: 1.5
wave: 3
depends_on: ["1"]
files_modified:
  - packages/database/src/types.gen.ts
  - apps/web/src/app/(admin)/admin/audit-logs/page.tsx
  - apps/web/src/app/(admin)/admin/audit-logs/_lib/queries.ts
  - supabase/tests/audit_logs_actor.test.sql
  - .planning/codebase/CONCERNS.md
autonomous: true
requirements:
  - NFR-006
  - CONCERNS-AUDIT-ACTOR
  - CONCERNS-TODO-TYPES
decisions_implemented:
  - D-12
  - D-13
  - D-14
decisions_proposed:
  - DEC-040  # Conditionnelle — promue PROJECT.md uniquement si pattern récurrent identifié en Task 5.3
tags:
  - debt
  - types
  - audit
  - permissions
must_haves:
  truths:
    - "Le fichier packages/database/src/types.gen.ts reflète le schéma Supabase actuel (incluant pois_metier après PLAN-3)"
    - "Les 5 TODO(types) confirmés dans apps/web/src sont supprimés (grep retourne 0)"
    - "La page audit-logs affiche le nom de l'acteur (« Mme Payet (Régulateur) ») au lieu d'un UUID tronqué"
    - "Le grep `requireDirigeant|requireAdminOrRegulateur` des modules (admin)/ est documenté dans CONCERNS.md section nouvelle"
    - "Si pattern récurrent, DEC-040 est rédigée et inscriptible PROJECT.md"
  artifacts:
    - path: "packages/database/src/types.gen.ts"
      provides: "Types Supabase régénérés à jour (pois_metier inclus)"
    - path: "apps/web/src/app/(admin)/admin/audit-logs/page.tsx"
      provides: "UI audit logs avec nom acteur affiché"
    - path: "apps/web/src/app/(admin)/admin/audit-logs/_lib/queries.ts"
      provides: "Query LEFT JOIN profiles enrichie"
    - path: ".planning/codebase/CONCERNS.md"
      provides: "Section audit permissions modules admin documentée"
  key_links:
    - from: "audit-logs query"
      to: "profiles.prenom + nom + role"
      via: "LEFT JOIN ON profiles.id = audit_logs.actor_id"
      pattern: "actor:profiles\\(prenom,nom"
---

<objective>
T5 — Dette technique : 3 nettoyages parallèles (régen types Supabase + audit logs nom acteur + audit permissions autres modules admin) issus de `CONCERNS.md`. Aucun écran nouveau, juste de l'hygiène.

Purpose :
- T5.2 régen types : 5 `TODO(types)` confirmés dans `apps/web/src` masquent des erreurs de typage potentielles. Débloque le développement futur (PLAN-3 ajoute `pois_metier` qui doit apparaître dans `types.gen.ts`).
- T5.1 audit logs nom acteur : la régulatrice ne peut pas auditer une action si l'acteur est un UUID tronqué (UAT 2026-05-14).
- T5.3 audit permissions : leçon DEC-029 (chauffeurs) appliquée aux autres modules admin (vehicules, legal/*, pois_metier futur). Documenter, ne pas tout corriger ici (hors scope strict).

Output : 1 types.gen.ts rafraîchi + 1 query enrichie + 1 UI affichant nom + 1 audit pgTAP + 1 documentation CONCERNS.md.

Estimation 1.5 h plafond.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md
@.planning/codebase/CONCERNS.md

# Fichiers concernés
@packages/database/src/types.gen.ts
@apps/web/src/app/(admin)/admin/audit-logs/page.tsx

# Référence DEC-029 pattern audit chauffeurs (PR #60)
@apps/web/src/app/(admin)/admin/chauffeurs/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 5.1 — Régénération types Supabase (débloque W1)</name>
  <files>
    packages/database/src/types.gen.ts
  </files>
  <action>
Per D-13. Tâche prioritaire (5 min) car débloque la query Task 5.2 (LEFT JOIN profiles nécessite types à jour).

Étapes :

1. **Régénérer les types via Supabase CLI** :
   ```bash
   supabase gen types typescript --project-id vkanxnhipsitpnhkdsae > packages/database/src/types.gen.ts
   ```
   Note : si workflow `sync-types.yml` existe, utiliser plutôt `gh workflow run sync-types.yml` puis pull le résultat. Sinon manuel.

   ⚠️ Ce plan dépend de PLAN-3 Task 3.1 (migration `pois_metier`) si elles s'exécutent en parallèle dans la même wave. Si PLAN-3 n'est pas encore mergée, régénérer SANS `pois_metier`, puis refaire après PLAN-3 merge. Dans la pratique, PLAN-3 et PLAN-5 peuvent partager une seule régénération finale.

2. **Supprimer les 5 `TODO(types)` confirmés** dans `apps/web/src` :
   ```bash
   grep -rn "TODO(types)" apps/web/src
   ```
   Pour chaque occurrence :
   - Comprendre quel type manquait (souvent `// @ts-expect-error TODO(types) — column not in types.gen.ts yet`)
   - Une fois `types.gen.ts` à jour, retirer le `@ts-expect-error` et le commentaire `TODO(types)`
   - Vérifier que `pnpm typecheck` reste GREEN

3. **Vérifier l'absence de régression** :
   ```bash
   cd apps/web && pnpm typecheck
   grep -rn "TODO(types)" apps/web/src  # doit retourner 0 ligne
   ```

Hors scope explicite :
- Pas de modification du schéma BDD ici (toute modif passe par PLAN-3 migration).
- Pas d'autres `TODO(*)` patterns nettoyés (ex: `TODO(perf)`, `TODO(test)` — différables).

Threat model ASVS L1 :
- T-04.5-25 (Types stale → bug runtime) : Mitigée par régénération + typecheck.
- T-04.5-26 (Suppression accidentelle de typage défensif) : Mitigée par typecheck strict + revue manuelle de chaque suppression `@ts-expect-error`.
  </action>
  <verify>
    <automated>cd /home/user/TAP && grep -rn "TODO(types)" apps/web/src | wc -l  # attendu: 0</automated>
    <automated>cd apps/web && pnpm typecheck</automated>
  </verify>
  <done>
    - types.gen.ts à jour avec pois_metier (si PLAN-3 mergé) et autres tables récentes
    - 0 TODO(types) restant dans apps/web/src
    - pnpm typecheck GREEN
  </done>
  <rollback>
    `git revert` du commit types.gen.ts. Les `@ts-expect-error` doivent être restaurés si les colonnes n'existent pas (rollback couplé avec d'autres reverts).
  </rollback>
</task>

<task type="auto">
  <name>Task 5.2 — Audit logs : afficher nom de l'acteur</name>
  <files>
    apps/web/src/app/(admin)/admin/audit-logs/page.tsx,
    apps/web/src/app/(admin)/admin/audit-logs/_lib/queries.ts,
    supabase/tests/audit_logs_actor.test.sql
  </files>
  <action>
Per D-12. Enrichir la query `audit_logs` admin pour retourner `profiles.prenom + nom + actor_role` via LEFT JOIN, et afficher en UI « Modifié par Mme Payet (Régulateur) » au lieu de l'UUID.

Étapes :

1. **Identifier la page admin audit-logs** : `apps/web/src/app/(admin)/admin/audit-logs/page.tsx` (selon convention Phase 1.5 — adapter si nommage diffère, scanner `find apps/web/src/app/\(admin\) -name '*audit*'`).

2. **Modifier ou créer `_lib/queries.ts`** :
   ```ts
   import { createClient } from '@/lib/supabase/server';

   export async function listAuditLogs(params: { limit?: number; offset?: number }) {
     const supabase = createClient();
     const { data, error } = await supabase
       .from('audit_logs')
       .select(`
         id,
         action,
         entity_type,
         entity_id,
         delta,
         created_at,
         actor_id,
         actor_role,
         actor:profiles!audit_logs_actor_id_fkey ( prenom, nom )
       `)
       .order('created_at', { ascending: false })
       .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50) - 1);

     if (error) {
       console.error('[listAuditLogs] failed', { message: error.message, code: error.code });
       return { rows: [], error };
     }
     return { rows: data ?? [], error: null };
   }
   ```

   Note : adapter le nom de la FK exact (`audit_logs_actor_id_fkey`) en lisant `types.gen.ts` ou la migration.

3. **Afficher en UI le nom + rôle** dans `page.tsx` :
   ```tsx
   const actorLabel = (row) => {
     if (!row.actor) return 'Système';
     const civilite = row.actor_role === 'dirigeant' ? 'M./Mme' : row.actor_role === 'regulateur' ? 'Mme' : '';
     const roleLabel = row.actor_role === 'dirigeant' ? 'Dirigeant'
       : row.actor_role === 'regulateur' ? 'Régulateur'
       : row.actor_role === 'chauffeur' ? 'Chauffeur'
       : row.actor_role;
     return `${row.actor.prenom} ${row.actor.nom} (${roleLabel})`;
   };
   ```
   Note civilité : si la BDD n'expose pas civilité, simplifier en « Prénom Nom (Rôle) » sans préfixe.

4. **Vérifier que RLS permet l'accès à `profiles` pour le rôle régulateur+** :
   - Politique `profiles_select_same_org` (existante Phase 1) doit autoriser la lecture des `prenom + nom` des collègues de la même organisation. Confirmer en preview avant de finaliser.

5. **Créer un test pgTAP `supabase/tests/audit_logs_actor.test.sql`** :
   - 2+ assertions :
     - Test 1 : query LEFT JOIN profiles retourne nom acteur ≥ 1 ligne pour le seed démo (action seedée doit avoir un actor_id valide).
     - Test 2 : isolation cross-org — un régulateur d'org A ne voit pas les actions d'org B (déjà couvert par RLS existant, re-vérifier).

Hors scope explicite :
- Pas de pagination améliorée ni filtres dans la page admin (différables).
- Pas d'export PDF audit logs (V2).
- Pas de modification du schéma audit_logs lui-même (FK existante suffit).

Threat model ASVS L1 :
- T-04.5-27 (Leak prenom+nom collègues hors org) : Mitigée par RLS existant `profiles_select_same_org`.
- T-04.5-28 (Renvoi acteur supprimé / null) : Mitigée par LEFT JOIN + fallback `Système` en UI.
- T-04.5-29 (Impersonation actor_role faux) : Mitigée par RLS sur audit_logs : insertion par trigger automatique, pas modifiable directement par utilisateur.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(admin\\)/admin/audit-logs</automated>
    <automated>pg_prove -d "$DATABASE_URL" supabase/tests/audit_logs_actor.test.sql</automated>
    Manual preview : login dirigeant, naviguer `/admin/audit-logs`, vérifier affichage « Mme Payet (Régulateur) » sur les lignes seedées.
  </verify>
  <done>
    - Query LEFT JOIN profiles GREEN
    - UI affiche prenom + nom + rôle FR
    - Fallback « Système » si actor null
    - pgTAP 2 assertions GREEN
  </done>
  <rollback>
    `git revert` du commit. Query revient à l'UUID tronqué pré-fix.
  </rollback>
</task>

<task type="auto">
  <name>Task 5.3 — Audit permissions autres modules admin + documentation CONCERNS.md</name>
  <files>
    .planning/codebase/CONCERNS.md
  </files>
  <action>
Per D-14, DEC-040 (optionnelle). Grep + documentation. **Pas de correctif applicatif ici** — si trous métier identifiés, ouvrir issues séparées (hors scope strict 04.5).

Étapes :

1. **Grep des guards de permission** dans `apps/web/src/app/(admin)/` :
   ```bash
   grep -rn "requireDirigeant\|requireAdminOrRegulateur\|requireRole" apps/web/src/app/\(admin\)/
   ```
   Lister tous les modules admin et leur guard actuel.

2. **Analyser chaque module contre le métier réel taxi 974** :
   Construire une table de résultat :

   | Module | Guard actuel | Métier réel | Statut |
   |---|---|---|---|
   | /admin/chauffeurs | requireAdminOrRegulateur | Dirigeant + régulateur OK (DEC-029) | OK |
   | /admin/vehicules | requireDirigeant ou autre | Régulateur devrait pouvoir affecter véhicule jour J | À VÉRIFIER |
   | /admin/legal/* | requireDirigeant | Dirigeant uniquement (RGPD/DPO) | OK |
   | /admin/audit-logs | requireDirigeant | Dirigeant uniquement (trace sensible) | OK |
   | ... | ... | ... | ... |

3. **Documenter dans `.planning/codebase/CONCERNS.md`** :
   - Créer une nouvelle section `## Audit permissions modules admin (Phase 04.5 T5.3 — 2026-05-15)`
   - Inclure la table ci-dessus
   - Pour chaque ligne `À VÉRIFIER`, indiquer : « Issue à ouvrir pour validation métier dirigeant — pas dans scope Phase 04.5 »
   - Si pattern récurrent identifié (ex: tous les modules CRUD admin gèrent mal régulateur), proposer DEC-040 :
     - **DEC-040 (PROPOSAL)** : « Tous les modules admin CRUD métier opérationnel (chauffeurs, véhicules, pois_metier futur) autorisent régulateur en lecture+modification. Modules admin compliance (legal, audit-logs, dpa) restent dirigeant uniquement. »
     - Si pas de pattern récurrent : DEC-040 NON nécessaire, statut « optional → not applicable ».

4. **Lister les issues à ouvrir** (pas créer dans GitHub — juste lister dans le SUMMARY) :
   - Issue X : `/admin/vehicules` permissions régulateur ?
   - Issue Y : ...
   - Le dirigeant tranche après lecture du SUMMARY si elles deviennent Phase 04.6 ou Phase 05.

Hors scope explicite :
- **Pas de correction de permissions ici** (verrou). Toute correction = issue séparée + plan ultérieur.
- Pas de modification de code applicatif.
- Pas de nouvelle migration.

Threat model ASVS L1 :
- T-04.5-30 (Permission escalation chauffeur via module mal protégé) : Identifiée dans CONCERNS.md, correction reportée hors scope strict 04.5 (issue à ouvrir).
- T-04.5-31 (Régulateur bloqué sur module nécessaire métier) : Identifiée dans CONCERNS.md, correction reportée hors scope strict 04.5 (issue à ouvrir).
  </action>
  <verify>
    <automated>cd /home/user/TAP && grep -rn "requireDirigeant\|requireAdminOrRegulateur" apps/web/src/app/\\(admin\\)/ | wc -l  # liste les guards à auditer</automated>
    Manual : lecture de CONCERNS.md nouvelle section, validation par dirigeant que la table est exhaustive et le statut juste.
  </verify>
  <done>
    - CONCERNS.md contient nouvelle section avec table audit permissions
    - Chaque module admin a un statut OK / À VÉRIFIER
    - DEC-040 rédigée en PROPOSAL ou marquée not-applicable
    - Liste des issues à ouvrir documentée (pas créées dans GitHub)
  </done>
  <rollback>
    `git revert` du commit CONCERNS.md. Aucun impact code applicatif (documentation only).
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Types Supabase → typecheck CI | Stale types masquent bugs runtime |
| audit_logs.actor_id → profiles.id | LEFT JOIN cross-table, RLS strict |
| Module admin → guard role | Variance entre modules révèle leçons DEC-029 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-25 | Tampering | Types stale | mitigate | Régénération types + typecheck CI |
| T-04.5-26 | Tampering | Suppression typage défensif | mitigate | Revue manuelle + typecheck strict |
| T-04.5-27 | Information Disclosure | Leak nom collègues hors org | mitigate | RLS profiles_select_same_org existant |
| T-04.5-28 | Repudiation | Acteur null / supprimé | mitigate | LEFT JOIN + fallback « Système » |
| T-04.5-29 | Spoofing | actor_role faux | mitigate | Trigger insertion audit_logs + RLS |
| T-04.5-30 | Elevation of Privilege | Module mal protégé | accept (V1) | Issue ouverte, correction post-04.5 |
| T-04.5-31 | DoS | Régulateur bloqué métier | accept (V1) | Issue ouverte, correction post-04.5 |
</threat_model>

<verification>
- 0 TODO(types) restant dans apps/web/src
- pnpm typecheck GREEN
- /admin/audit-logs affiche nom + rôle FR
- pgTAP audit_logs_actor 2 assertions GREEN
- CONCERNS.md section audit permissions complète et signée par dirigeant
</verification>

<success_criteria>
- 3 dettes CONCERNS.md absorbées (types, audit-logs, audit-permissions doc)
- DEC-040 inscriptible OU explicitement non applicable
- Roadmap claire pour les issues hors scope (post-04.5)
</success_criteria>

<output>
À la fin du plan, créer `.planning/phases/04.5-robustesse-regulateur/04.5-05-SUMMARY.md` synthétisant :
- D-12, D-13, D-14 implémentés
- Décision DEC-040 (inscriptible ou non applicable)
- Liste issues à ouvrir post-04.5
- Capture /admin/audit-logs avec nom acteur visible dans `docs/showcase/04.5-robustesse-regulateur/`
</output>
