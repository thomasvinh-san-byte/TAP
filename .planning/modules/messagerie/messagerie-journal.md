# Journal — Module Messagerie interne (CdC §5.22)

Trace des décisions, lots et audits du module. Tenu pour éviter les dérives et
permettre une reprise (méthode GSD pour module fonctionnel neuf).

## Décisions de méthode
- 2026-06-08 : module fonctionnel neuf (table/RLS/Realtime/logique) → cadrage GSD
  validé AVANT execute. Lots dérivés du cadrage.
- Principe (cohérent conformité) : on construit la fonctionnalité avec l'existant
  (Supabase Realtime, pg_cron gratuit), pas de branchement d'infra payante. Les
  canaux hors-app (push, email) sont repoussés.

## Cadrage validé (décisions tranchées)
- **Q1 à la course** : conversation rattachée à `ride_id`. Pas de fil général au lot 1.
- **Q2 photo REPOUSSÉE** : une photo d'incident peut être une donnée santé → stockage
  HDS non en place. Lot 1 = texte uniquement.
- **Q3 push REPOUSSÉ** : le chat in-app fonctionne sans push. Push web (VAPID) = lot
  ultérieur.
- **Q4 RLS stricte** : chauffeur = ses courses ; régulateur + dirigeant = leur org.
- **Q5 conserver sans purge** au lot 1 (volume faible ; purge 1 an via pg_cron plus tard).
- **Q6 pattern conformité** : helper pur testé + query server-only + Realtime cockpit.

## DEC du module
| DEC | Objet | Lot |
|-----|-------|-----|
| DEC-120 | chat texte temps réel à la course (table unique, RLS, Realtime, RideChat) | Lot 1 (06.41) ✅ |

## État des lots
| Lot | Phase | Statut | Contenu |
|-----|-------|--------|---------|
| 1 Chat texte | 06.41 | ✅ livré localement | Table `internal_message` (ride_id) + RLS forcée indexée + publication Realtime + 14 pgTAP ; query server-only + 2 Server Actions + helper `groupMessagesByDay` (8 Vitest) ; hook `useRideMessages` (Postgres Changes par course + reconnexion/refetch) ; composant `<RideChat>` greffé ride-drawer (régulateur) + ride-detail (chauffeur). |
| 2 Photo jointe | ? | ⏸ repoussé | Donnée potentiellement santé → dépend du stockage HDS (bucket conforme). |
| 3 Push web | ? | ⏸ repoussé | VAPID + stockage subscriptions + endpoint (dev, pas un achat). Après le chat. |
| (Fil général) | ? | ⏸ repoussé | Fil régulateur↔chauffeur hors course, si le besoin émerge. |
| (Purge 1 an) | ? | ⏸ repoussé | Tâche pg_cron quand le volume le justifie. |
| (Email) | — | hors module | Branchement infra repoussé (cf. registre des travaux repoussés). |

## Anti-patterns évités (recherche)
- **Table unique `internal_message(ride_id)`** — pas de table conversation séparée :
  évite le bug Supabase #1721 (payloads Realtime mélangés si 2 tables partagent un
  channel). La course EST la conversation.
- **Postgres Changes** (persistance, cohérent cockpit `use-cockpit-rides`), PAS de
  Broadcast (sur-ingénierie à notre échelle).
- **RLS indexée** : la RLS filtre aussi la réception Realtime ; index sur les colonnes
  de policy (`ride_id`, `organization_id`) pour éviter la latence du 1er message.
- **Un channel par course** (`internal_message:{rideId}`, filtre `ride_id=eq.`) +
  refetch au resubscribe (reconnexion).
- **Messages immuables** : pas d'UPDATE/DELETE (ni policy, ni grant) ; édition/suppression
  hors périmètre.
- **Anti-usurpation** : `sender_profile_id = auth.uid()` + `sender_role =
  current_user_role()` en WITH CHECK.

## Observations / dette
- Pas de trigger audit sur `internal_message` au lot 1 : la table est elle-même
  append-only et horodatée (trace native). À réévaluer si une exigence d'audit
  explicite émerge.
- Conservation : tout est gardé en base au lot 1. La purge 1 an (CdC §5.22) viendra
  avec un cron dédié quand le volume le justifiera.

## Refs
CdC §5.22 ; cadrage GSD messagerie ; code : `use-cockpit-rides` (Realtime),
`sms_messages` (modèle table), `rides_update_chauffeur_own_rides` (pattern RLS
chauffeur), `current_user_role`/`has_role`/`current_organization_id`. Registre des
travaux repoussés (photo HDS, push, email, fil général, purge).
