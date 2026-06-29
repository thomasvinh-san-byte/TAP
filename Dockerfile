# =============================================================================
# OVH-01 — Image du front @tap/web (Next.js 15 standalone, monorepo Turborepo).
# =============================================================================
# NB : pas de directive `# syntax=docker/dockerfile:1` — on n'utilise que des
# fonctionnalités standard (multi-stage, COPY --from, --chown), donc le frontend
# BuildKit intégré suffit, sans dépendre d'une image frontend externe à tirer.
# Réintroduire la directive si un jour on veut `RUN --mount` (cache BuildKit).
# But : produire une image Docker du front pour l'hébergement HDS futur (OVH).
# AUCUN impact sur Vercel (qui ignore `output: 'standalone'`). Pattern officiel
# Turborepo `turbo prune --docker` (sous-ensemble minimal + cache des deps).
#
# Pièges standalone monorepo traités (RETEX) :
#   1. symlinks pnpm : install PROPRE dans le builder (jamais `pnpm install`
#      dans .next/standalone) → les node_modules tracés restent valides.
#   2. .next/static : copié au chemin attendu par server.js
#      (<standalone>/apps/web/.next/static, car outputFileTracingRoot = racine).
#   3. public/ : copié explicitement.
#   4. tokens:build : lancé AVANT next build via le script `build` (turbo).
#
# Versions alignées sur le repo : Node 20, pnpm 9.12.0, turbo 2.9.9.
# server.js vérifié à `apps/web/server.js` dans le standalone (tracing root = racine).
# =============================================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@9.12.0 turbo@2.9.9
WORKDIR /app

# --- Stage 1 : prune — sous-ensemble minimal pour @tap/web -------------------
FROM base AS pruner
COPY . .
RUN turbo prune @tap/web --docker

# --- Stage 2 : install + build ----------------------------------------------
FROM base AS builder
# Lockfile + package.json élagués d'abord (couche cache des dépendances).
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
# Sources élaguées.
COPY --from=pruner /app/out/full/ .
# Build via turbo : déclenche `^build` (packages workspace) puis, pour @tap/web,
# `pnpm tokens:build && next build` (piège 4). NE PAS faire `pnpm install` dans
# .next/standalone ensuite (piège 1 : casserait les node_modules tracés).
RUN turbo run build --filter=@tap/web

# --- Stage 3 : runner minimal -----------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# Utilisateur non root.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
# Serveur standalone (inclut les node_modules tracés des packages @tap/*).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Assets statiques au BON chemin (piège 2).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Fichiers publics (piège 3).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# server.js généré sous apps/web/ dans le standalone (vérifié, tracing root = racine).
CMD ["node", "apps/web/server.js"]
