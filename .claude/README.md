# `.claude/` — couche architecte / auditeur / garde-fou

Ce dossier encode la partie du travail qui passait jusqu'ici par un aller-retour
manuel : la **recherche** en amont, l'**audit** post-merge, et l'**enforcement**
des non-négociables. Le pipeline GSD lui-même (`/gsd-discuss-phase`,
`/gsd-ui-spec-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`) reste tel quel —
ceci le complète, ne le remplace pas.

## Contenu

| Fichier | Rôle |
|---|---|
| `settings.json` | Commandes pré-approuvées (typecheck/lint/format/build, git lecture, gh) + câblage du hook commit |
| `hooks/guard-commit.sh` | **Actif.** Bloque un `git commit` tant que `pnpm typecheck` ou `pnpm format:check` ne sont pas verts. Fail-open si pnpm absent. |
| `hooks/neutrality-warn.sh` | **Optionnel, non câblé.** Avertit (sans bloquer) si un nom propre du seed apparaît dans du code applicatif (NFR-001). |
| `agents/auditor.md` | Subagent lecture seule : audit post-merge (build, cohérence des chiffres, traçabilité DEC, clôture). |
| `agents/researcher.md` | Subagent : recherche sourcée (réglementation, benchmarks NEMT, UI/UX) en amont d'un discuss. |
| `commands/gsd-audit-phase.md` | `/gsd-audit-phase <num>` → lance l'auditor sur une phase mergée. |
| `commands/gsd-research.md` | `/gsd-research <sujet>` → lance le researcher. |
| `commands/sync-state.md` | `/sync-state` → compacte STATE.md (archive l'historique dans STATE-HISTORY.md). |

## Mise en route

```bash
chmod +x .claude/hooks/*.sh
```

Au prochain démarrage de Claude Code dans le repo, les hooks et commandes sont pris
en compte. Vérifie avec `/help` (commandes) et `claude agents` (subagents).

## Boucle cible

1. `/gsd-research <sujet>` — matière sourcée pour le discuss.
2. `/gsd-discuss-phase <num>` … `/gsd-execute-phase <num>` — ton pipeline habituel.
3. Le hook commit garde typecheck + prettier verts à chaque commit (plus de
   vérification manuelle).
4. Après merge : `/gsd-audit-phase <num>` — l'auditor rend son verdict en contexte
   propre, sans re-clone manuel.
5. `/sync-state` quand STATE.md regrossit.

## Activer le hook de neutralité (optionnel)

Conservateur exprès (denylist de noms du seed) pour éviter les faux positifs.
Si tu le veux, ajoute dans `settings.json` :

```json
"PostToolUse": [
  { "matcher": "Edit|Write",
    "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/neutrality-warn.sh" }] }
]
```

## Notes

- **Hooks vs CLAUDE.md** : CLAUDE.md est *advisory* (l'agent peut l'oublier). Un
  hook est *déterministe*. On ne met en hook que ce qui doit être vrai à 100 % —
  ici, typecheck + prettier avant commit.
- **Coexistence husky** : ce hook agit côté agent (avant que Claude ne lance le
  commit) ; husky agit côté git (au commit réel). Les deux se renforcent.
- **Modèle** : les subagents sont déclarés `model: opus` (raisonnement profond pour
  l'audit et la recherche). Abaisse à `sonnet`/`haiku` si tu veux réduire le coût.
- **MCP Supabase/Vercel** : si tu connectes ces serveurs MCP à Claude Code,
  l'auditor pourra aussi comparer les advisors prod (régression sécurité).
