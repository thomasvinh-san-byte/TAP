# ADR-002 — Multi-tenant via Supabase RLS et `organization_id`

- **Statut** : Accepté
- **Date** : 2026-05-06
- **Auteur** : Guillaume

## Contexte

Le SaaS est multi-tenant : chaque société TAP est un tenant isolé. Une régulatrice de la société A ne doit jamais voir une donnée de la société B, **y compris en cas de bug applicatif**. Les données traitées sont sensibles (santé, salariés) et sont soumises au RGPD niveau santé + HDS en production commerciale.

Trois patterns de multi-tenancy sont possibles avec Postgres :

1. **Une base par tenant** : isolation physique forte
2. **Un schéma par tenant** : isolation logique via `search_path`
3. **Tables partagées avec colonne `organization_id`** + Row Level Security : isolation par policies

## Décision

**Pattern 3 : tables partagées + colonne `organization_id` + RLS forcée systématique.**

- Toute table métier porte une colonne `organization_id uuid not null references organizations(id)`
- RLS activée ET forcée (`force row level security`) sur toutes les tables métier
- Policies de SELECT/UPDATE/INSERT/DELETE filtrent sur `organization_id = public.current_organization_id()`
- Helpers SECURITY DEFINER (`current_organization_id`, `current_user_role`, `has_role`) évitent la récursion RLS et les requêtes redondantes
- Trigger anti-élévation de privilège sur `profiles` : un utilisateur non-dirigeant ne peut modifier ni `organization_id`, ni `role`, ni `actif` sur son propre profil
- Tests pgTAP automatisés à chaque PR pour vérifier l'isolation tenant

## Alternatives considérées

### Une base par tenant
- **Pour** : isolation maximale, suppression d'un tenant = drop de la base
- **Contre** : Supabase ne supporte pas nativement plusieurs bases par projet, cela imposerait un projet Supabase par client → coût explosif et impraticable en early stage. Migration des schémas = N fois plus de travail.
- **Verdict** : non viable avec Supabase Cloud

### Un schéma par tenant
- **Pour** : isolation logique forte, requêtes plus simples
- **Contre** : `search_path` doit être positionné à chaque connexion, peu compatible avec Supabase Auth, génération de types TypeScript ingérable (N schémas différents)
- **Verdict** : trop de friction avec l'écosystème Supabase

### RLS sans `force`
- **Pour** : par défaut Supabase
- **Contre** : un bug futur où on utilise `service_role` côté client, ou un `bypass_rls` accidentel, et toute l'isolation tombe
- **Verdict** : on `force` systématiquement et on documente l'usage de `service_role` (réservé aux Edge Functions et workflows administratifs)

## Conséquences

**Positives**
- Isolation tenant garantie au niveau Postgres : indépendant du code applicatif
- Compatible avec Supabase Realtime, Storage, Edge Functions sans config additionnelle
- Tests pgTAP rapides et reproductibles
- Migration vers HDS (OVHcloud Postgres ou Scaleway) future possible sans refonte : c'est du Postgres standard

**Négatives / vigilance**
- Toute nouvelle table doit être créée avec la checklist : `organization_id`, RLS, policies, tests pgTAP. Documenté dans `CLAUDE.md` § 6 et § 8.
- Performances : index obligatoire sur `(organization_id, ...)` pour toute table à fort volume (rides, audit_logs)
- `service_role` ne doit JAMAIS être exposé côté client. À auditer en CI (interdire `SUPABASE_SERVICE_ROLE_KEY` dans tout fichier sous `apps/*/src/**`).
- Une fuite RLS reste possible via une fonction SECURITY DEFINER mal écrite : tout helper SD est revu en code review et testé.
