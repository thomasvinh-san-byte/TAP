---
phase: 04-onboarding-chauffeur-authshell
plan: 1
wave: 0
order_in_wave: 1
depends_on: []
files_modified:
  - .planning/PROJECT.md
  - .planning/STATE.md
  - apps/web/package.json
  - pnpm-lock.yaml
autonomous: true
requirements:
  - CHAUF-01
  - CHAUF-02
  - CHAUF-03
  - CHAUF-04
  - NFR-001
  - NFR-002
  - NFR-003
  - NFR-004
  - NFR-005
  - NFR-006
estimated_minutes: 20
covers_constraints:
  - C10
---

# PLAN-1 — Préliminaires : décisions DEC-024..028 inscrites + dépendance RHF

## Objectif

Verrouiller les bases documentaires de la phase 04 (inscription des
décisions DEC-024..028 dans `PROJECT.md`, vérification `STATE.md` et
`ROADMAP.md` déjà à jour post-PR #57) et ajouter la seule dépendance
runtime nouvelle de la phase : `@hookform/resolvers` (~5 KB gzip).

Aucun code applicatif touché ici — c'est le wave 0 de cadrage.

## Files modified

- `.planning/PROJECT.md` — section `<decisions>` : ajout bloc DEC-024..028
- `.planning/STATE.md` — vérification (current_phase = `04-onboarding-chauffeur-authshell`, pas de modification si déjà à jour)
- `apps/web/package.json` — ajout `"@hookform/resolvers": "^3.x"` dans `dependencies`
- `pnpm-lock.yaml` — régénéré par `pnpm install`

## Tasks

### 1.1 Vérifier STATE.md et ROADMAP.md à jour post-DEC-023

- Lire `.planning/STATE.md` : confirmer `current_phase: 04-onboarding-chauffeur-authshell`.
  Si la valeur diffère, corriger uniquement cette ligne (sinon ne pas
  toucher au fichier).
- Lire `.planning/ROADMAP.md` section Phase 04 : confirmer que le
  périmètre reflète la refonte DEC-023 (onboarding chauffeur +
  AuthShell mode jour, **PAS** la god-phase d'origine).
- Pas de modification si conforme — c'est juste un contrôle de cohérence
  avant la suite.

### 1.2 Inscrire les décisions DEC-024..028 dans PROJECT.md

Localiser dans `.planning/PROJECT.md` le bloc `<decisions>`. Ajouter à
la suite des décisions existantes (DEC-001..023) les 5 nouvelles
entrées, dans l'ordre canonique, avec le même style que les décisions
précédentes (one-liner factuel, référence à la question source quand
pertinent) :

```
- **DEC-024** : Workflow invitation 2 temps. Bouton « Inviter » séparé
  de `createDriverAction`. Le dirigeant crée d'abord la fiche métier
  `drivers` (peut rester sans email/compte connexion — `profile_id`
  nullable hérité Phase 1), puis click « Inviter » quand prêt à
  rattacher un compte. (Q1.1)
- **DEC-025** : Table `driver_invitations` séparée (PAS extension de
  `drivers`). Évite duplication email (auth.users source de vérité
  après rattachement) et désynchronisation. (Q1.2)
- **DEC-026** : `driverInvitationSchema` Zod séparé (PAS extension
  `driverInputSchema`). Séparation des concerns fiche métier vs compte
  connexion. (Q1.3)
- **DEC-027** : Acceptation CGU obligatoire à `/accept-invite`. Case
  à cocher avec lien `/legal/cgu`. Trace `audit_logs` type
  `cgu_accepted_via_invitation`. Conforme Phase 1.5 RGPD. (Q1.4)
- **DEC-028** : Pattern RHF + Server Actions sans wrapper `<Form>`
  shadcn pour formulaires simples Phase 04+. `<Input>` `<Label>`
  `<Button>` shadcn directs (≤ 5 champs). Le wrapper `<Form>` reste
  disponible pour formulaires complexes futurs. (Q2.x)
```

### 1.3 Ajouter la dépendance `@hookform/resolvers`

- Éditer `apps/web/package.json` : ajouter
  `"@hookform/resolvers": "^3.10.0"` (ou dernière 3.x stable) dans
  `dependencies`, en respectant l'ordre alphabétique des clés.
  `react-hook-form` est déjà installé (Phase 04 le rend canonique).
- Vérifier que `react-hook-form` est présent dans `dependencies` ; si
  absent, l'ajouter `"react-hook-form": "^7.x"`.
- Exécuter `pnpm install` à la racine du repo pour mettre à jour le
  lockfile.
- Ne pas ajouter d'autre dépendance (D-DEPS-01 verrou : `@hookform/resolvers`
  est la seule autorisée Phase 04).

### 1.4 Commit unique

Message :

```
chore(04): cadrage phase 04 onboarding (DEC-024..028 + @hookform/resolvers)

- PROJECT.md : ajout décisions DEC-024..028 (workflow invitation 2 temps,
  table dédiée, schéma Zod séparé, CGU obligatoire, RHF sans wrapper Form)
- apps/web/package.json : ajout @hookform/resolvers ^3.x (seule dep nouvelle)
- STATE.md / ROADMAP.md : aucune modification (déjà à jour post-PR #57)

Réfs : Phase 04 § PLAN-1, DEC-023, C10.
```

## Traçabilité contraintes

| Contrainte | Traitement dans ce plan |
|---|---|
| **C10** (Wave 0 préliminaires — vérif docs + DEC-024..028 inscrits) | PLAN-1 §1.1 (vérif STATE / ROADMAP) + §1.2 (inscription DEC-024..028 dans PROJECT.md) + §1.3 (ajout `@hookform/resolvers`) |

Aucune autre contrainte C01..C09 traitée ici (cadrage pur).

## Threat model

ASVS L1 — aucun nouveau vecteur d'attaque introduit ce plan :

| Item | Évaluation |
|---|---|
| Supply chain (nouvelle dep) | `@hookform/resolvers` (Colin Hacks-style maintainer, 12M DL/sem PkgPulse 2026, audit npm sain). Pin `^3.x`, lockfile commit obligatoire. Aucune dep transitive nouvelle suspecte (ne tire que `react-hook-form` déjà présent). |
| Fuite secrets dans PROJECT.md | Aucun secret écrit. Seulement des décisions techniques factuelles. |
| Exposition publique de décisions internes | `.planning/` est dans le repo public (assumé GitHub privé / accessible équipe interne). Les décisions n'exposent ni endpoint ni credential. |

Pas de surface code touchée → pas de STRIDE applicable.

## Verification

- `pnpm install` termine sans erreur.
- `pnpm typecheck` reste vert (aucun changement de typage).
- `grep "DEC-024" .planning/PROJECT.md` retourne au moins une ligne.
- `grep "@hookform/resolvers" apps/web/package.json` retourne une ligne.

## Success criteria (extrait des 11 SC phase)

Pas de SC fonctionnel traité ce plan — pré-requis pour SC #1..#11
(toute la phase dépend de ce cadrage).

## Output

Pas de SUMMARY dédié — ce plan est trop petit. Il sera tracé dans
`04-SUMMARY.md` final § PLAN-1 (1 paragraphe).
