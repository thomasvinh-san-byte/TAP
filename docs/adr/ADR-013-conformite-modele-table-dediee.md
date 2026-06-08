# ADR-013 — Conformité réglementaire : table dédiée plutôt que colonnes éparses

**Date** : 2026-06-08 (Phase 06.33 lot 1)
**Statut** : Acceptée
**Décideurs** : dirigeant + équipe technique

---

## Contexte

Le cahier des charges §5.21 « Suivi des échéances réglementaires »
(inclus V1 §2.1) exige le suivi de 8 types d'échéances réparties sur
3 entités :

- **Chauffeur** : carte professionnelle, visite médicale d'aptitude,
  formation continue.
- **Véhicule** : contrôle technique, visite annuelle taxi (préfecture),
  assurance, licence taxi.
- **Organisation** : convention CGSS (date de signature + avenants
  multiples).

Risque légal réel : exploiter un chauffeur dont la carte pro est
expirée, un véhicule sans CT/assurance, ou en convention CGSS périmée =
exploitation illégale. Le CdC demande aussi : alertes 90/60/30/7 j
+ blocage paramétrable (lots 2 et 3).

Aucun suivi n'existait : `drivers` a `numero_licence`/`type_permis`
mais 0 date d'échéance ; `vehicles` n'a aucune échéance ; aucune
représentation de la convention CGSS.

## Options envisagées

### Option A — Colonnes éparses sur drivers/vehicles/organizations

Ajouter `carte_pro_expires_at`, `visite_medicale_expires_at`,
`formation_continue_expires_at` sur `drivers` ; idem 4 colonnes sur
`vehicles` ; table dédiée pour `convention_cgss` (multi-avenants).

- ✅ Simple à requêter pour un seul chauffeur.
- ❌ **8 colonnes éparses** sur 3 entités = schéma rigide, ajout d'un
  9e type d'échéance = migration sur 1+ tables.
- ❌ **Multi-échéances impossibles** sur la convention CGSS sans table
  séparée → modèle hétérogène (colonnes + table dédiée).
- ❌ Requête d'alerte (lot 2) = `UNION ALL` sur 8 colonnes hétérogènes.
- ❌ Audit log : trigger par colonne ou perte de granularité.

### Option B — Table dédiée `compliance_items` polymorphe

Une table unique qui suit toutes les échéances :

```sql
compliance_items (
  id, organization_id,
  entity_type ('driver'|'vehicle'|'organization'),
  entity_id    (uuid nullable — null si organization),
  kind         (8 valeurs CHECK),
  label, reference, issued_at, expires_at, document_url,
  archive, created_at, updated_at, created_by
)
```

- ✅ **Flexible** : ajouter un 9e type d'échéance = ajout d'une valeur
  dans le CHECK + libellé FR dans `@tap/shared` (zéro migration sur
  drivers/vehicles).
- ✅ **Multi-échéances natives** (convention CGSS + avenants).
- ✅ **Requête d'alerte unique** (lot 2) : `where expires_at between
  current_date and current_date + interval '90 days'` sur 1 table.
- ✅ **Audit log uniforme** via trigger `compliance_items_audit_trigger`
  (pattern vehicles/drivers).
- ✅ **RLS simple** : 1 jeu de policies same_org + dirigeant pour
  INSERT/UPDATE.
- ❌ Pas de FK forte vers `drivers`/`vehicles` (polymorphic FK non
  supportée SQL standard) → cohérence applicative via CHECK + l'app
  qui passe systématiquement par les Server Actions.
- ❌ Lecture par entité = `where entity_type='driver' and entity_id=X`
  (1 index dédié).

## Décision

**Option B retenue**. La flexibilité (ajout futur de types d'échéance,
multi-versions convention CGSS) et l'uniformité (1 trigger d'audit,
1 jeu de RLS, 1 requête d'alerte) priment sur le coût d'une lecture
légèrement plus indirecte.

L'absence de FK forte est mitigée par :

- CHECK contraint `kind` aux 8 valeurs (cohérent avec
  `@tap/shared` validators).
- CHECK contraint `(entity_type, entity_id)` :
  `'organization' → entity_id null` ; `'driver'|'vehicle' → entity_id
  required`.
- Toutes les écritures passent par `upsertComplianceItemAction`
  (rôle dirigeant + zod).
- RLS Postgres + tests pgTAP (10 cas, cohérent DEC-098).

## Conséquences

### Positives

- Schéma stable face à l'évolution réglementaire (nouvelle exigence
  préfecture/CGSS = pas de migration sur drivers/vehicles).
- Cron lot 2 simple : 1 requête `compliance_items` avec window 90 j.
- Helper `complianceStatus` pur dans `@tap/shared` (testable Vitest),
  partagé serveur (cron) et client (badge).
- Distinct du sous-domaine `/admin/legal/*` (conformité RGPD
  documentaire) — pas de confusion conceptuelle.

### Négatives

- Lecture « toutes les échéances d'un chauffeur X » = jointure
  applicative (1 query supplémentaire pour drivers-list — acceptable
  vu les volumes V1 ≤ quelques dizaines).
- Pas de garde-fou FK strict — l'orphelin (entity_id pointant un
  driver supprimé) reste possible si la suppression contourne
  l'archivage logique. Mitigation : le pattern repo est archive
  systématique (CLAUDE.md anti-pattern hard DELETE).

### Lots à venir (référence)

- **Lot 2** (Phase 06.34, prévu) : cron quotidien qui scanne
  `compliance_items` → notifie cockpit + email aux paliers 90/60/30/7 j
  ; helper `complianceAlertStep` déjà disponible.
- **Lot 3** (Phase 06.35, prévu) : blocage paramétrable de la
  planification quand une échéance critique (carte pro, CT, assurance)
  est expirée — `compliance_items` consulté à l'affectation.

## Refs

- CdC §5.21 (Suivi échéances réglementaires) + §2.1 (V1 inclus).
- DEC-112 (lot 1 lock).
- DEC-098 (couverture RLS pgTAP systématique).
- Migration `20260608000001_compliance_items.sql`.
- Tests `supabase/tests/compliance_items_rls.sql` (10 cas).
- Validators `packages/shared/src/validators/compliance.ts`.
- Helper `packages/shared/src/utils/compliance-status.ts`.
