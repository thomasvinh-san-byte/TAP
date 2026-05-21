# Phase 06 — Facturation CGSS PDF + audit sécurité + dettes CI — SUMMARY

**Statut** : LIVRÉE 2026-05-21
**Pipeline GSD** : 5/5 (discuss → ui-spec → plan → execute 4 waves → clôture)
**PR cumulées** : #145 (discuss), #146 (ui-spec), #147 (plan), #148/#149 (Wave 1), #150 (Wave 2), #151/#152 (Wave 3), Wave 4 (clôture).

## Périmètre — resserré (DEC-063)

Le discuss a redécoupé la « Passe 4 » brute (HDS + OR-Tools + B2B + facturation + audit, 19-32 h) en une **Phase 06 resserrée** + sous-phases. Phase 06 = Bloc A (facturation CGSS PDF) + Bloc E (audit RLS / Server Actions + advisors) + Bloc F (dettes CI). HDS → Phase 06.5 ; OR-Tools → Phase 06.7 ; B2B et télétransmission B2/CNDA → différés (ADR-005/006).

## Récap waves

| Wave | PR | Livré |
|------|----|----|
| 1 — Bloc F | #148, #149 | Dettes CI : ESLint 9 flat config racine (`@tap/database`/`@tap/shared`/`apps/web` migré `next lint`→`eslint`), SIRET de test Luhn-valide, `supabase/setup-cli` épinglé, reformatage prettier du repo, `.prettierignore` complété. CI lint + format verts. |
| 2 — Bloc A | #150 | Facturation CGSS PDF : page `/admin/facturation` (sélection période/chauffeur, aperçu, téléchargement), Route Handler `@react-pdf/renderer`, document `facture-cgss-pdf`, `queries-facturation` (source unique), seed démo enrichi, onglet nav. |
| 3 — Bloc E.1 | #151, #152 | Audit RLS systémique (`RLS-AUDIT.md`, 28 tables — posture saine), migration advisors (search_path ×3 + REVOKE EXECUTE triggers/crons sur anon/authenticated/public), pgTAP `security_advisors`. |
| 4 — Bloc E.2 | (clôture) | Audit des 38 Server Actions (`SERVER-ACTIONS-AUDIT.md`), guard `require*` (DEC-040) sur les 6 actions legal + dédup `vehicules` + guard `constraints` + row count DEC-041. Clôture : ROADMAP, DEC, ADR, SUMMARY, STATE, CONCERNS. |

## Success criteria (4/4)

- [x] **1.** Un PDF récapitulatif mensuel CGSS est généré et téléchargeable depuis `/admin/facturation`.
- [x] **2.** La matrice RLS des 28 tables est documentée ; advisors `search_path` (3/3) et `SECURITY DEFINER` triggers/crons traités.
- [x] **3.** Les 38 Server Actions sont auditées ; guard `require*` (DEC-040) + row count (DEC-041) appliqués aux mutations admin/métier.
- [x] **4.** Dettes CI D1/D2/D3 résolues — `pnpm lint` + `format:check` verts.

## Décisions LOCKED

| DEC | Sujet |
|-----|-------|
| DEC-040 | Guard `require*` partagé obligatoire sur les Server Actions de mutation admin/métier |
| DEC-063 | Phase 06 resserrée (E2E Passe 4 redécoupée) |
| DEC-064 | Facturation V1.5 = PDF mensuel ; télétransmission B2/CNDA différée (ADR-005) |
| DEC-065 | Migration HDS = Phase 06.5 dédiée |
| DEC-066 | OR-Tools = Phase 06.7 dédiée |
| DEC-067 | Portail B2B multi-tenant différé (ADR-006) |

## Définition « course facturable CGSS » (actée)

`status = 'terminee'` + `tarif_amount_eur` non null + `ended_at` dans le mois + exclusion du paiement direct patient (`payment_status = 'encaisse'` AND `payment_method` cash/cb/cheque). **Pas** de filtre `payment_method = 'cgss_differe'` : `payment_method` est NULL sur ~100 % des courses (le S-03 de l'UI-SPEC, faux, a été corrigé au plan).

## Corrections critiques de parcours

- **Wave 1** : le job lint avait 3 sous-tâches rouges (pas 2) — `apps/web` n'avait aucune config ESLint. Fix complet du monorepo en flat config ESLint 9. Dette prettier de 266 fichiers, masquée, résorbée en commit isolé.
- **Wave 3** : la stratégie « REVOKE EXECUTE sur les helpers RLS » aurait cassé la production (les expressions de policy requièrent l'EXECUTE du rôle requêtant). Périmètre REVOKE restreint aux triggers/crons. Correctif `#152` : le REVOKE doit cibler `anon, authenticated` explicitement (Supabase accorde des grants explicites — `REVOKE FROM public` seul est insuffisant).

## Sécurité — bilan

- RLS : 28 tables, 28 RLS active, 68 policies — posture saine, aucune migration corrective nécessaire.
- Advisors : `function_search_path_mutable` 3/3 corrigés ; `SECURITY DEFINER` réduits aux 5 légitimes (helpers RLS + RPC, gardés par conception et documentés) ; `pg_net` schema + `leaked_password_protection` documentés (résidus — voir CONCERNS).
- Server Actions : 6 actions legal sécurisées (guard `requireDirigeant`), `vehicules` dédupliqué, `constraints` durci.

## Captures Visible Progress (CLAUDE.md § 13.5)

À fournir par le dirigeant post-merge dans `captures/` : `admin-facturation-apercu.png`, `admin-facturation-pdf.png`.

## Checklist UAT dirigeant

```
☐ 1. /admin/facturation s'ouvre (dirigeant) — sélecteur mois + chauffeur
☐ 2. Le mois précédent affiche un aperçu peuplé (seed démo)
☐ 3. « Télécharger le PDF » produit un PDF A4 lisible, totaux cohérents
☐ 4. Onglet « Facturation » visible dans la nav admin
☐ 5. Console Supabase : activer « Leaked password protection » (Auth → Settings)
☐ 6. Relancer get_advisors : chute des SECURITY DEFINER triggers/crons
```

## Items reportés Phase 06.5+ (voir CONCERNS)

- `pg_net` SET SCHEMA — au rebranchement SMS.
- `leaked_password_protection` — action console dirigeant.
- Extension de la couverture pgTAP RLS sur ~11 tables.
- Row count DEC-041 sur `assignment`/`payment`/UPDATE legal — durcissement résiduel.
- E2E error-path Playwright cross-rôle — à ajouter où Playwright est exécutable.

## Refs

- `docs/security/RLS-AUDIT.md`, `docs/security/SERVER-ACTIONS-AUDIT.md`
- `docs/adr/ADR-005-teletransmission-b2-cnda-differee.md`, `ADR-006-portail-b2b-differe.md`
- DEC-040, DEC-063..067 LOCKED (PROJECT.md)

## Prochaine étape

`/gsd-discuss-phase 06.5` (Migration HDS) — prérequis du premier client payant commercial.
