# ADR-006 — Portail B2B multi-tenant différé

- **Statut** : Accepté
- **Date** : 2026-05-21
- **Remplace** : aucun ADR antérieur
- **Affecte** : Phase 06 (périmètre), DEC-067, roadmap commerciale

## Contexte

La roadmap E2E (Passe 4) prévoyait un **portail B2B multi-tenant** pour les
donneurs d'ordres (hôpitaux, cliniques, EHPAD) : `apps/b2b`, authentification
séparée, signup Stripe, isolation tenant, onboarding d'organisation, dépôt de
prescriptions, factures consolidées.

C'est du **produit commercial**, pas du cœur opérationnel de la régulatrice.
Le discuss Phase 06 a relevé un risque : **bâtir du multi-tenant commercial
avant d'avoir validé le produit avec un premier client réel** revient à
investir lourdement avant le product-market fit. TAP est en bêta, avec un
design partner en test et aucun client payant.

Le portail B2B ne déverrouille rien pour la régulatrice ni pour le chauffeur
— les six maillons du parcours métier fonctionnent sans lui.

## Décision

1. **Différer le portail B2B multi-tenant.** Aucun `apps/b2b`, aucun signup
   Stripe, aucune isolation tenant commerciale en V1.5.
2. **Pas de numéro de phase** tant que le portail B2B n'est pas déclenché :
   il dépend d'une **décision business**, pas d'une dépendance technique.
3. Le socle multi-tenant existant (RLS + `organization_id` sur toute table
   métier, DEC-002) **reste en place** — il suffit à un éventuel second
   tenant interne ; le portail B2B *commercial* est ce qui est différé.

## Conséquences

**Positives :**
- Aucun investissement multi-tenant commercial avant la validation produit.
- Phase 06 reste resserrée et livrable (DEC-063).

**Négatives :**
- Pas d'offre B2B en V1.5. Acceptable : la cible immédiate est la
  régulatrice d'une société de transport, pas les donneurs d'ordres.

## Réactivation

Sur **décision business explicite**, après qu'un premier client payant a
validé le produit. Le portail B2B fera alors l'objet d'une phase dédiée
(`apps/b2b`, auth séparée, Stripe, onboarding, factures consolidées).
