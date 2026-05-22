#!/usr/bin/env bash
# PostToolUse(Edit|Write) — TAP, OPTIONNEL et NON câblé par défaut (voir .claude/README.md).
# Avertit (sans bloquer) si un nom propre réunionnais du seed apparaît dans du code
# applicatif. NFR-001 : aucun nom propre en dur hors seed/test. Conservateur exprès
# (avertit seulement sur une denylist connue) pour éviter les faux positifs.
set -uo pipefail
input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -z "$file" ] && exit 0

# Le seed, les tests, les docs et le planning ONT le droit d'utiliser des noms fictifs.
case "$file" in
  *seed*|*test*|*spec*|*showcase*|*/.planning/*|*.md) exit 0 ;;
esac
[ -f "$file" ] || exit 0

names='Hoarau|Payet|Grondin|Boyer|Dijoux|Maillot|Lebon|Robert|Vergoz|Bègue'
if grep -nEi "$names" "$file" >/dev/null 2>&1; then
  echo "[neutralité NFR-001] Nom propre réunionnais détecté dans $file (hors seed/test)." >&2
  echo "À vérifier : le code applicatif ne doit pas contenir de noms en dur." >&2
fi
exit 0
