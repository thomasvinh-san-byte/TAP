# Phase 04 — Discussion Log (Assumptions Mode + Brief Méta Dirigeant)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `04-CONTEXT.md` — this log preserves the analysis.

**Date:** 2026-05-13 (refonte E2E post-DEC-023, PR #57 mergée `2553e33`)
**Phase:** 04-onboarding-chauffeur-authshell
**Mode:** assumptions + brief méta dirigeant ultra-complet (32 contraintes + 19 réponses posées)
**Périmètre:** onboarding chauffeur + AuthShell mode jour uniquement (~4-5h)

---

## Précédent CONTEXT (god-phase, abandonné)

Le précédent `04-CONTEXT.md` (version god-phase 4 livrables PWA + tarif + caisse + login, 17-25h) a été abandonné par DEC-023 et refondu PR #57. Le nouveau périmètre Phase 04 = **onboarding chauffeur + AuthShell mode jour uniquement**.

PR #57 (`38ff4b4` puis merge `2553e33`) a inscrit DEC-017..023 + ADR-003 dans `PROJECT.md` et créé les 4 sous-phases (04.5 / 04.7 / 04.9 / 05.5). Le présent `04-CONTEXT.md` matérialise les **5 nouvelles décisions DEC-024..028** + **32 contraintes C01..C10** + **19 réponses posées Q1.1..Q7.1**.

---

## Brief méta dirigeant

Le dirigeant a fourni un brief auto-suffisant (~600 lignes de prompt) qui couvre :

1. **Contexte pré-discuss** : état du code main (audit fait 2026-05-13), recherche état de l'art 2026 (6 recherches web : Supabase Auth invitation, SMTP rate limit, ConfirmationURL gotcha, clés Supabase 2026, B2B fleet pattern industriel, RHF + Server Actions + Zod, shadcn login-page-02 block)
2. **10 contraintes formelles C01..C10** avec spécifications techniques détaillées (migration BDD avec SQL, Server Actions avec logique étape par étape, page `/accept-invite` flow complet, AuthShell props, conversion LoginForm RHF, DemoCredentials, tests Playwright, Visible Progress)
3. **19 réponses posées Q1.1..Q7.1** à 19 questions standards (workflow invitation, schéma Zod, CGU, token expiry, badge statut, RHF mode, useActionState, shadcn block, mode nuit, tests Vitest, Inbucket reset, clés Supabase, dépendances, SMTP custom, email spam, token URL, velocity)
4. **11 success criteria** explicites pour `/gsd-verify-work` future
5. **Plan probable 4 plans / 4 waves** avec mapping contraintes
6. **Instructions méta** : checkpoints visibles pendant plan-phase, traçabilité « PLAN-X §Y.Z traite CXX » obligatoire

---

## Assumptions (vide — brief auto-suffisant)

Le brief méta a couvert exhaustivement le périmètre. **Aucune assumption résiduelle nécessaire** — toutes les zones d'ombre standard de discuss-phase ont été pré-répondues.

L'agent `gsd-assumptions-analyzer` n'a pas été spawné car :
- Code main audité par le dirigeant (avec liste précise des fichiers existants + à créer)
- État de l'art 2026 déjà recherché (6 sources externes citées)
- 19 décisions techniques tranchées (uncontrolled vs controlled, async/await vs useActionState, shadcn block vs custom, mode nuit, SMTP, clés Supabase, etc.)

---

## Corrections (none)

Aucune correction apportée — toutes les décisions du brief méta intégrées telles quelles dans `04-CONTEXT.md`.

---

## 5 nouvelles décisions PROJECT.md (DEC-024..028)

- **DEC-024** : Workflow invitation 2 temps (créer fiche + bouton « Inviter » séparé). Source : Q1.1 brief méta.
- **DEC-025** : `driver_invitations` table séparée (PAS extension `drivers`). Source : Q1.2 + C01.
- **DEC-026** : `driverInvitationSchema` Zod séparé. Source : Q1.3.
- **DEC-027** : Acceptation CGU obligatoire à `/accept-invite` avec audit log. Source : Q1.4.
- **DEC-028** : Pattern RHF + Server Actions sans wrapper `<Form>` shadcn pour formulaires simples Phase 04+. Source : C06 + Q2.x.

Inscrites dans `PROJECT.md` `<decisions>` dans le même commit que ce CONTEXT.md.

---

## Recherche état de l'art 2026 (synthèse dirigeant)

| Topic | Source citée | Conclusion |
|---|---|---|
| Supabase Auth invitation API | Supabase docs 2026 | `inviteUserByEmail` V1 simple (B2B fleet) |
| SMTP rate limit | Supabase docs | 3 emails/h défaut OK V1, custom Phase 06+ |
| ConfirmationURL template | Supabase docs gotcha | Utiliser `{{ .ConfirmationURL }}` tel quel |
| Clés Supabase 2026 | Supabase release notes | `sb_publishable_*` / `sb_secret_*` remplacent legacy, until end of 2026 |
| B2B fleet onboarding | Auth0 / WorkOS / Onfleet 2026 | Admin provisioning (notre modèle) |
| RHF + Server Actions + Zod | PkgPulse 2026 + écosystème | RHF leader 12M DL/sem, pattern stable |
| shadcn login-page-02 | shadcn/ui blocks | Référence visuelle uniquement, PAS install CLI |

---

## Traçabilité contraintes → plan futur

Le plan généré par `/gsd-plan-phase 04` doit citer chaque contrainte CXX en référence explicite. Format attendu : `PLAN-X §Y.Z traite CXX`.

Exemple : `PLAN-2 §3.1 traite C02 (inviteDriverAction)`.

Le plan-checker vérifiera la couverture C01..C10 + DEC-024..028.

---

## Pas d'external_research lancé

Le brief méta a déjà cité les 7 conclusions de recherche externe. Pas de spawn `general-purpose` agent supplémentaire — économie ~10 min, contexte suffisant.

---

## Auto-resolved (pas applicable)

Mode interactif, pas `--auto`. Pas d'auto-resolution sur Unclear items (il n'y en a pas — brief complet).
