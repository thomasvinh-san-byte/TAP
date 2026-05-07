#!/usr/bin/env bash
# Régénère supabase/setup-all.sql en concaténant migrations + seeds.
# À lancer manuellement après ajout d'une migration ou modification du seed.
# Le fichier généré est commit dans le repo (consommé par /welcome).

set -e
cd "$(dirname "$0")/.."

OUT="supabase/setup-all.sql"
TMP=$(mktemp)

{
  cat <<'HEAD'
-- ==============================================================================
-- TAP Régulation — Setup complet en une seule fois (migrations + seed démo)
-- ==============================================================================
-- À copier-coller intégralement dans Supabase Studio → SQL Editor → Run.
-- Fichier généré automatiquement par scripts/build-setup-sql.sh.
--
-- Contenu :
--   - 10 migrations (001 → 010)
--   - seed.sql       : 1 organization + 4 comptes auth (dirigeant/régulateur/chauffeur)
--   - seed.demo.sql  : 10 patients fictifs réunionnais + notes + contraintes
--
-- Idempotent : peut être ré-exécuté sans casser les données existantes.
-- ==============================================================================

HEAD

  for f in supabase/migrations/*.sql; do
    echo ""
    echo "-- ─── $f ─────────────────────────────────────────────────────────────"
    echo ""
    cat "$f"
  done

  echo ""
  echo "-- ─── seed.sql ────────────────────────────────────────────────────────"
  echo ""
  cat supabase/seed.sql

  echo ""
  echo "-- ─── seed.demo.sql ───────────────────────────────────────────────────"
  echo ""
  cat supabase/seed.demo.sql

  echo ""
  echo "-- ─── DONE ─────────────────────────────────────────────────────────────"
  echo ""
  echo "select '✅ Setup terminé : migrations + seed appliqués' as status;"
} > "$TMP"

mv "$TMP" "$OUT"
echo "✓ $OUT régénéré ($(wc -l < "$OUT") lignes)"
