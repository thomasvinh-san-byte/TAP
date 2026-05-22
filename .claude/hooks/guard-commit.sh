#!/usr/bin/env bash
# PreToolUse(Bash) — TAP. Bloque un `git commit` tant que typecheck + prettier ne sont pas verts.
# Principe : « ce qui doit être vrai à 100 % est un hook, pas une instruction ».
# Tu re-vérifiais ces deux points manuellement à chaque livraison — désormais c'est automatique.
set -uo pipefail
input="$(cat)"

# Extraire la commande proposée (jq si dispo, sinon le JSON brut comme filet).
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  cmd="$input"
fi

# Ne réagir qu'aux commits.
case "$cmd" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Fail-open si l'outillage n'est pas là : ne JAMAIS verrouiller les commits par accident.
command -v pnpm >/dev/null 2>&1 || { echo "[guard-commit] pnpm introuvable — contrôle ignoré." >&2; exit 0; }

if ! pnpm -s typecheck >/tmp/tap-typecheck.log 2>&1; then
  echo "BLOQUÉ (guard-commit) : pnpm typecheck échoue. Corrige les erreurs de type avant de committer." >&2
  tail -n 20 /tmp/tap-typecheck.log >&2
  exit 2
fi

if ! pnpm -s format:check >/tmp/tap-format.log 2>&1; then
  echo "BLOQUÉ (guard-commit) : prettier format:check échoue. Lance 'pnpm format' puis recommence." >&2
  tail -n 20 /tmp/tap-format.log >&2
  exit 2
fi

exit 0
