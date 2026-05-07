#!/usr/bin/env bash
# =============================================================================
# Setup environnement Vercel — TAP SaaS Réunion
# =============================================================================
# Configure toutes les env vars nécessaires sur le projet Vercel `tap-web` :
# - Supabase URL + anon key + service_role (récupérés depuis Supabase API)
# - Secrets applicatifs générés (NIR encryption, HMAC, JWT legal, anonymize salt)
# - NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS (Preview only)
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN="sbp_..."   # https://supabase.com/dashboard/account/tokens
#   export VERCEL_TOKEN="..."                # https://vercel.com/account/tokens
#   export SUPABASE_PROJECT_REF="<ref>"      # ex: kqotrrjaohdvcxsclhqi (depuis URL Supabase)
#   ./scripts/setup-vercel-env.sh
#
# Idempotent : peut être relancé. Vercel met à jour les env vars existantes.
# Aucune donnée sensible n'est écrite sur disque (les secrets vivent dans Vercel).
# =============================================================================

set -euo pipefail

readonly VERCEL_PROJECT="tap-web"

# -----------------------------------------------------------------------------
# Vérifications préalables
# -----------------------------------------------------------------------------

require_var() {
  if [ -z "${!1:-}" ]; then
    echo "❌ Variable d'environnement manquante : $1" >&2
    echo "   Voir l'en-tête de ce script pour les instructions." >&2
    exit 1
  fi
}

require_var SUPABASE_ACCESS_TOKEN
require_var VERCEL_TOKEN
require_var SUPABASE_PROJECT_REF

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq requis. Installer : brew install jq | apt install jq" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Récupération des credentials Supabase via l'API
# -----------------------------------------------------------------------------

echo "→ Récupération des clés API Supabase pour projet $SUPABASE_PROJECT_REF…"

SUPABASE_API_RESPONSE=$(curl -fsSL \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys")

NEXT_PUBLIC_SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$SUPABASE_API_RESPONSE" | jq -r '.[] | select(.name=="anon") | .api_key')
SUPABASE_SERVICE_ROLE_KEY=$(echo "$SUPABASE_API_RESPONSE" | jq -r '.[] | select(.name=="service_role") | .api_key')

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ "$NEXT_PUBLIC_SUPABASE_ANON_KEY" = "null" ]; then
  echo "❌ anon key Supabase introuvable. Vérifier SUPABASE_PROJECT_REF." >&2
  exit 1
fi

echo "  ✓ anon key + service_role + URL récupérés"

# -----------------------------------------------------------------------------
# Génération des secrets applicatifs
# -----------------------------------------------------------------------------

echo "→ Génération des secrets applicatifs (4 × 32 bytes random)…"

APP_NIR_ENCRYPTION_KEY=$(openssl rand -base64 32)
APP_NIR_SEARCH_KEY=$(openssl rand -base64 32)
APP_LEGAL_TOKEN_SECRET=$(openssl rand -base64 32)
APP_ANONYMIZATION_SALT=$(openssl rand -base64 32)

echo "  ✓ 4 secrets générés"

# -----------------------------------------------------------------------------
# Push vers Vercel via API
# -----------------------------------------------------------------------------

VERCEL_API="https://api.vercel.com"

upsert_env() {
  local key="$1"
  local value="$2"
  local target="$3"  # production | preview | development (séparé par virgules)

  # Convertir target string → JSON array
  local target_json
  target_json=$(echo "$target" | jq -R 'split(",")')

  # Vérifier si la variable existe déjà
  local existing_id
  existing_id=$(curl -fsSL \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "$VERCEL_API/v10/projects/$VERCEL_PROJECT/env" \
    | jq -r --arg k "$key" --argjson t "$target_json" \
      '.envs[]? | select(.key == $k and (.target | sort) == ($t | sort)) | .id' \
    | head -1)

  if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
    # PATCH (mise à jour)
    curl -fsSL -X PATCH \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      "$VERCEL_API/v9/projects/$VERCEL_PROJECT/env/$existing_id" \
      -d "$(jq -n --arg v "$value" --argjson t "$target_json" \
        '{value: $v, target: $t, type: "encrypted"}')" >/dev/null
    echo "  ↻ $key (mis à jour, scope: $target)"
  else
    # POST (création)
    curl -fsSL -X POST \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      "$VERCEL_API/v10/projects/$VERCEL_PROJECT/env" \
      -d "$(jq -n --arg k "$key" --arg v "$value" --argjson t "$target_json" \
        '{key: $k, value: $v, target: $t, type: "encrypted"}')" >/dev/null
    echo "  + $key (créé, scope: $target)"
  fi
}

# Variables Supabase (Production + Preview)
echo "→ Push variables Supabase (Production + Preview)…"
upsert_env "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL" "production,preview"
upsert_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "production,preview"
upsert_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "production,preview"

# Secrets applicatifs (Production + Preview)
echo "→ Push secrets applicatifs (Production + Preview)…"
upsert_env "APP_NIR_ENCRYPTION_KEY" "$APP_NIR_ENCRYPTION_KEY" "production,preview"
upsert_env "APP_NIR_SEARCH_KEY" "$APP_NIR_SEARCH_KEY" "production,preview"
upsert_env "APP_LEGAL_TOKEN_SECRET" "$APP_LEGAL_TOKEN_SECRET" "production,preview"
upsert_env "APP_ANONYMIZATION_SALT" "$APP_ANONYMIZATION_SALT" "production,preview"

# Comptes démo visibles UNIQUEMENT en Preview
echo "→ Push NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS (Preview only)…"
upsert_env "NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS" "true" "preview"

echo ""
echo "✅ Setup terminé. Toutes les env vars sont en place sur le projet $VERCEL_PROJECT."
echo ""
echo "Prochain step :"
echo "  1. Déclencher un redeploy depuis Vercel UI (Deployments → ... → Redeploy)"
echo "     OU  pousser un commit pour forcer un rebuild :"
echo "     git commit --allow-empty -m 'chore: redeploy après setup env' && git push"
echo "  2. Une fois la preview verte, ouvrir l'URL et tester le login démo"
echo ""
echo "⚠️  Action sécurité : SAUVEGARDER les secrets ailleurs (1Password, Bitwarden) :"
echo "    - Perdre APP_NIR_ENCRYPTION_KEY = perdre l'accès aux NIRs chiffrés en DB"
echo "    - Perdre APP_LEGAL_TOKEN_SECRET = invalider tous les tokens portail patient en circulation"
echo ""
echo "    Récupérer les valeurs courantes depuis Vercel UI :"
echo "    https://vercel.com/<team>/${VERCEL_PROJECT}/settings/environment-variables"
