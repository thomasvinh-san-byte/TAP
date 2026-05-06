# Architecture Decision Records (ADR)

Toute décision structurante du projet est consignée ici. Format inspiré de Michael Nygard.

## Format

Chaque ADR suit le squelette suivant :

```markdown
# ADR-NNN — Titre court

- **Statut** : Proposé / Accepté / Remplacé par ADR-XXX / Déprécié
- **Date** : AAAA-MM-JJ
- **Auteur** : Prénom Nom

## Contexte
Le problème métier ou technique qui motive la décision.

## Décision
Ce qui a été décidé, en une ou deux phrases claires.

## Alternatives considérées
Les options évaluées, avec leurs trade-offs.

## Conséquences
Les implications positives ET négatives, à court et long terme.
```

## Conventions

- Numérotation séquentielle, jamais réutilisée
- Une décision = un fichier
- Un ADR ne se modifie pas une fois accepté : si la décision change, créer un nouvel ADR qui remplace l'ancien
- Garder les ADR courts (< 1 page si possible)

## Index

| N° | Titre | Statut |
|---|---|---|
| [001](./ADR-001-monorepo-turborepo.md) | Monorepo Turborepo + pnpm workspaces | Accepté |
| [002](./ADR-002-supabase-rls-multitenant.md) | Multi-tenant via Supabase RLS et `organization_id` | Accepté |
