# PLAN-1 — Préliminaires : décisions DEC-024..028 inscrites + dépendance RHF — SUMMARY

**Status:** ✅ NO-OP (toutes les conditions préalables déjà satisfaites lors des PR planning antérieures)
**Exécution:** 2026-05-13 (inline orchestrator — pas de subagent spawné)
**Wave:** 0
**Constraint:** C10

---

## Constat

Le PLAN-1 visait à inscrire DEC-024..028 dans PROJECT.md et ajouter `@hookform/resolvers`. Toutes ses conditions étaient déjà satisfaites par les PR planning précédentes mergées sur main.

### §1.1 — Vérifier STATE.md et ROADMAP.md à jour post-DEC-023

- `STATE.md` : `current_phase = 04-onboarding-chauffeur-authshell` ✅ (mergé PR #58 `0030185`)
- `ROADMAP.md` Phase 04 : « Onboarding chauffeur + AuthShell mode jour (REFACTOR DEC-023) » ✅ (mergé PR #57)

### §1.2 — Inscrire DEC-024..028 dans PROJECT.md

- `grep -c "DEC-02[4-8]" .planning/PROJECT.md` → **5** ✅ (inscrits via PR #58 commit `4dcb0ad`)
- DEC-024 (workflow invitation 2 temps), DEC-025 (table séparée), DEC-026 (schema Zod séparé), DEC-027 (CGU obligatoire), DEC-028 (RHF sans wrapper Form) — tous présents.

### §1.3 — Ajouter `@hookform/resolvers`

Constat surprise : la dépendance était **déjà installée** depuis le scaffold initial (probablement via shadcn `Form` component) :

```jsonc
// apps/web/package.json
"@hookform/resolvers": "^3.9.0",
"react-hook-form": "^7.53.0",
```

Aucune modification nécessaire. `pnpm install` non requis.

### §1.4 — Commit

Pas de commit applicatif (rien à committer). Seul ce SUMMARY trace l'exécution no-op.

## Traçabilité C10

**C10 (Wave 0 préliminaires — vérif docs + DEC-024..028 inscrits)** : traité par les PR #57 et #58 mergées avant l'exécution Phase 04. Ce PLAN-1 documente la vérification post-merge.

## Risques résolus / dette transitoire

- **Risque (DEC-018 + DEC-028)** : le wrapper `<Form>` shadcn existant (`apps/web/src/components/ui/form.tsx`) reste disponible mais NON utilisé par les nouveaux formulaires Phase 04 (LoginForm RHF + AcceptInviteForm). DEC-028 verrouille ce pattern. Le wrapper peut être conservé pour formulaires complexes futurs.

## Verification

- `pnpm typecheck` : OK (aucun changement de typage).
- `grep "DEC-024" .planning/PROJECT.md` retourne 1 ligne ✅
- `grep "@hookform/resolvers" apps/web/package.json` retourne 1 ligne ✅

## Next step

Wave 1 / PLAN-2 : migration BDD `driver_invitations` + RLS + trigger audit + [BLOCKING] schema push.

Spawn `gsd-executor` pour PLAN-2 (le travail est non-trivial : ~341L de SQL + tests pgTAP).
