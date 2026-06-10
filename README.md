# SaaS TAP Réunion

> SaaS de régulation, optimisation, communication patient et pilotage pour sociétés de Transport Assis Professionnalisé (TAP) et taxiteurs conventionnés CGSS à La Réunion.

**Document central pour Claude Code et l'équipe : [`CLAUDE.md`](./CLAUDE.md).**
**Cahier des charges V2 (référence métier) : `docs/cahier_des_charges_saas_tap_v2.docx`.**

---

## Stack

- **Front** : Next.js 14 (App Router), TypeScript strict, Tailwind, shadcn/ui, Lucide
- **Back** : Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- **Optimisation tournées** : heuristique TypeScript native (`packages/optimizer-client`)
- **Distance** : estimation Haversine (facteur de correction) ; routing réel (OSRM) prévu avec la géoloc certifiée
- **SMS** : Twilio ou OVH SMS Pro
- **Hébergement** : Vercel + Supabase (HDS pour la prod commerciale)
- **Monorepo** : Turborepo + pnpm workspaces

## Architecture

Voir [`CLAUDE.md` § 4](./CLAUDE.md#4-architecture-du-repo).

```
apps/web/    # Next.js — régulateur, admin, chauffeur (PWA), tous segments
packages/    # database, optimizer-client, pricing, recurrence, shared, sms
supabase/    # migrations, functions, seed, tests pgTAP
docs/        # cahier des charges, ADR, observations terrain
```

## Démarrage local

Prérequis :
- Node 20+ (`nvm use`)
- pnpm 9+ (`corepack enable`)
- Docker (pour Supabase local)
- Supabase CLI (`brew install supabase/tap/supabase`)

```bash
pnpm install
pnpm db:start          # démarre Supabase en local (Docker)
pnpm db:reset          # applique les migrations + seed
pnpm db:test           # exécute les tests pgTAP (RLS)
pnpm dev               # lance les apps en parallèle
```

## Comptes de démo (seed)

Comptes de démonstration créés par le seed (`pnpm db:reset`) — voir `supabase/seed`.

## Workflow Git

GitHub Flow adapté :
- `main` = toujours déployable, protégée
- `staging` = branche permanente de pré-production
- Toute feature passe par une branche `feat/*`, `fix/*` ou `chore/*` puis PR → `main`
- Migrations Supabase versionnées, validées par CI avant merge

Voir [`docs/adr/ADR-001-monorepo-turborepo.md`](./docs/adr/ADR-001-monorepo-turborepo.md).

## Sécurité

Données traitées = données de santé (RGPD niveau santé + HDS en prod). Voir [`CLAUDE.md` § 6](./CLAUDE.md#6-règles-de-sécurité-non-négociables).

## Licence

Propriétaire — tous droits réservés.
