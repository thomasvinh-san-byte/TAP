#!/usr/bin/env bash
# Régénère supabase/setup-all.sql (copier-coller manuel)
# + apps/web/src/lib/setup-sql.ts (consommé par Server Action /setup)
#
# Le TS exporte 2 constantes séparées :
#   - MIGRATIONS_SQL  : schéma (10 migrations). Non-idempotent sur 2e run.
#   - SEED_SQL        : données démo (seed.sql + seed.demo.sql). Idempotent.
# Permet à /setup d'appliquer migrations + seed la 1re fois, puis seul le seed
# au retry (si une 1re tentative a planté à mi-chemin).

set -e
cd "$(dirname "$0")/.."

OUT="supabase/setup-all.sql"
TMP=$(mktemp)

MIG_TMP=$(mktemp)
SEED_TMP=$(mktemp)

# Concat migrations
for f in supabase/migrations/*.sql; do
  echo "" >> "$MIG_TMP"
  echo "-- ─── $f ─────────────────────────────────────────────────────────────" >> "$MIG_TMP"
  echo "" >> "$MIG_TMP"
  cat "$f" >> "$MIG_TMP"
done

# Concat seed
echo "" >> "$SEED_TMP"
echo "-- ─── seed.sql ────────────────────────────────────────────────────────" >> "$SEED_TMP"
echo "" >> "$SEED_TMP"
cat supabase/seed.sql >> "$SEED_TMP"
echo "" >> "$SEED_TMP"
echo "-- ─── seed.demo.sql ───────────────────────────────────────────────────" >> "$SEED_TMP"
echo "" >> "$SEED_TMP"
cat supabase/seed.demo.sql >> "$SEED_TMP"

{
  cat <<'HEAD'
-- ==============================================================================
-- TAP Régulation — Setup complet (migrations + seed démo)
-- ==============================================================================
-- Fichier généré automatiquement par scripts/build-setup-sql.sh.
-- ==============================================================================

HEAD
  cat "$MIG_TMP"
  cat "$SEED_TMP"
  echo ""
  echo "-- ─── DONE ─────────────────────────────────────────────────────────────"
  echo ""
  echo "select '✅ Setup terminé : migrations + seed appliqués' as status;"
} > "$TMP"

mv "$TMP" "$OUT"
echo "✓ $OUT régénéré ($(wc -l < "$OUT") lignes)"

# Génère apps/web/src/lib/setup-sql.ts avec 2 constantes
TS_OUT="apps/web/src/lib/setup-sql.ts"
{
  echo "/**"
  echo " * SQL de setup auto-généré par scripts/build-setup-sql.sh — NE PAS éditer manuellement."
  echo " * Source: supabase/migrations/*.sql + supabase/seed.sql + supabase/seed.demo.sql"
  echo " * Régénération : ./scripts/build-setup-sql.sh"
  echo " */"
  echo ""
  echo "export const MIGRATIONS_SQL = String.raw\`"
  cat "$MIG_TMP" | sed 's/\\/\\\\/g; s/`/\\`/g; s/\$/\\$/g'
  echo "\`;"
  echo ""
  echo "export const SEED_SQL = String.raw\`"
  cat "$SEED_TMP" | sed 's/\\/\\\\/g; s/`/\\`/g; s/\$/\\$/g'
  echo "\`;"
} > "$TS_OUT"
echo "✓ $TS_OUT régénéré"

rm -f "$MIG_TMP" "$SEED_TMP"
