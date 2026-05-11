# Phase 6+ — Passe 4 (conformité production + optimisation + B2B) — Context (esquisse)

**Pivot ADR** : ADR-003 (2026-05-11)
**Status** : Esquisse — détails à compléter à l'approche de la phase

---

## Goal

Le SaaS est prêt à signer son premier client commercial. RGPD niveau production. HDS opérationnel. Optimisation tournées proposée. Donneurs d'ordres B2B intégrés.

## Périmètre

**Dans :**

- Rebranchement complet Phase 1.5 RGPD : consentements production, registre des traitements activé, DPO nommé, DPIA validée
- Migration HDS : décision tranchée par ADR-004 (à écrire en début de Passe 4). 3 options pré-identifiées : Supabase pro + chiffrement applicatif étendu / OVHcloud Managed Postgres HDS / Scaleway Database HDS + Supabase non-PII
- Service Python OR-Tools déployé, microservice optimisation tournées avec proposition d'assignation
- OSRM auto-hébergé pour le routing GPS sans dépendance Google
- Portail B2B `/b2b/[client]/` pour donneurs d'ordres : visibilité courses de leurs patients, factures consolidées
- 2FA dirigeant + régulateur, sessions différenciées
- Mode dégradé complet (offline régulateur), mode `de garde` un régulateur actif simultané

**Hors :**

- Modules secondaires CDC v2 non priorisés (chiffres d'affaires fins, analytics business, exports comptables) — V2 commerciale post-premier client

## Critère de fin

1er client commercial payant en production HDS sans incident sécurité ni facturation sur 30 jours.

## Estimation grossière

6 à 10 semaines.
