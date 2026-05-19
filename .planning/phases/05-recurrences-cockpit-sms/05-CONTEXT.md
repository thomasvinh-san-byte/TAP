# Phase 05 — E2E Passe 3 : Récurrences + Cockpit Realtime + SMS + Patient absent

**Status:** Discuss in progress (pipeline GSD 1/5)
**Inserted:** 2026-05-18 post Phase 04.9 clôture + 4 mini-PR (#117-#120)
**Discuss completed:** 2026-05-18

---

## Goal fonctionnel

La régulatrice configure une récurrence dialyse (3×/semaine, lundi/mercredi/vendredi 08h00) → toutes les occurrences se génèrent automatiquement avec exceptions jours fériés 974 (1er janvier, Pâques, 1er mai, 8 mai, Ascension, Pentecôte, 14 juillet, Assomption, Toussaint, Armistice, Noël, **20 décembre commémo abolition esclavage**).

Cockpit Realtime Supabase : courses en cours, retards, alertes. SMS rappel J-1 18h00 + J-2h via Twilio (selon consentement DEC-008 strict). Workflow patient absent au pickup chauffeur PWA → alerte cockpit régulatrice < 5s → décision Reprogrammer/Annuler → `audit_logs`.

## Goal UX

- Cockpit table dense Linear-style avec cellules colorées par statut
- Mise à jour fluide sans flash (Realtime + fade-in subtil DEC-020 cohérent)
- Modal récurrence avec preview 4 prochaines occurrences
- Templates SMS éditables avec preview FR/créole
- Modal alerte cockpit patient absent avec actions « Reprogrammer » / « Annuler course »

## Dependencies

- Phase 04.9 PWA chauffeur enveloppe **LIVRÉE COMPLÈTE** (12 PR #109-#120 mergées)
  - 5/8 items revue CONCERNS résolus (#1 sync 4xx/5xx + #3 prevent re-clic via PR #117, #5 dismiss reset + #6 in_flight cleanup via PR #119, #7 useIsStandalone consommé via PR #118)
  - 3 items reportés Phase 06 (#2 Promise singleton mutex, #4 INSERT ON CONFLICT atomic, #8 start_url role-aware)
  - Migration BAN → Géoplateforme IGN livrée (PR #120, helper `lib/geocoding/ban.ts` centralisé)
- Custom domain Vercel `tap-web-brown.vercel.app` + Supabase Auth URLs configurés
- État codebase 2026-05-18 : 213 fichiers / 24 246 LOC `apps/web` + 40 fichiers / 3 671 LOC `packages/*` (shared, database, pricing) + ~10% test coverage

## Périmètre — DANS

- **`packages/recurrence`** : moteur génération occurrences via `rrule.js` (DEC-046), 100% branches Vitest (DEC-013 LOCKED)
- **Exceptions jours fériés 974** : table de référence `holidays_974` (12 jours nationaux + 1 spécifique 974) + override manuel régulatrice
- **Décrément bon de transport `prescription`** à chaque occurrence générée
- **Cockpit régulatrice `/cockpit`** : Realtime Supabase `postgres_changes` (DEC-049), courses en cours, alertes retard
- **`packages/sms`** : Twilio adapter, templates Mustache custom (DEC-051), consentement strict DEC-008
- **SMS rappel J-1 18h00 + J-2h** via Vercel Cron jobs (DEC-050)
- **Tracking delivery status** (`sent` / `delivered` / `failed`) dans `sms_message`, webhook Twilio HMAC (DEC-052)
- **Workflow patient absent** : chauffeur PWA déclare via Route Handler `POST /api/driver/rides/[id]/no-show` (DEC-053 cohérent DEC-045 pattern), régulatrice reçoit alerte cockpit, modal décision (reprog / annulation), `audit_logs`
- **Landing page régulatrice** : redirect login → `/cockpit` (DEC-054)

## Périmètre — HORS (reporté Passe 4 ou Phase 06)

- Réception SMS patient (réponse SMS → fiche patient) — Phase 06
- KPIs dirigeant tableau de bord pilotage — Phase 06
- Imprévus complexes (panne véhicule, multi-patient absent automatique, réaffectation drag-drop cockpit) — Passe 4
- Notification famille patient absent (DEC-055) — Phase 06
- Planning Gantt drag-and-drop (PLAN-01..04 REQUIREMENTS) — Passe 4 ou Phase 06

---

## Défis principaux

### A — Moteur récurrences (RECU-01..06)

- **A1.** Algorithme : `rrule.js` standard RFC 5545 iCalendar retenu (DEC-046). Justification : RFC standard, bien maintenu, exceptions natives via `EXDATE`, pas de réinvention. Dépendance mineure ~30 KB.
- **A2.** Modèle BDD : table `ride_recurrences` (`id`, `patient_id`, `rrule_str`, `start_date`, `end_date`, `pickup_address`, `dropoff_address`, `transport_mode`, `urgency`, `organization_id`, `prescription_id`, `created_by`, `created_at`) + table `ride_recurrence_exceptions` (`id`, `ride_recurrence_id`, `date`, `reason`, `created_by`) + colonne `ride_recurrence_id uuid NULL REFERENCES ride_recurrences(id)` sur `rides` (commentaire déjà présent `supabase/migrations/20260509000001_rides.sql:59`).
- **A3.** Stratégie génération : **eager batch 3 mois** à la création + extension cron mensuel (DEC-047). Équilibre planning visibility + complexité acceptable.
- **A4.** Jours fériés 974 : table statique `holidays_974` migrée Wave 1 avec les 13 dates. Override manuel régulatrice via UI dédiée (modal exception sur occurrence).
- **A5.** Décrément `prescription` : trigger BDD Postgres `AFTER INSERT ON rides` quand `ride_recurrence_id IS NOT NULL` → `UPDATE prescriptions SET courses_restantes = courses_restantes - 1`. Trigger silencieux si `courses_restantes` à 0 (alerte régulatrice via cockpit séparée).
- **A6.** Modification récurrence active : **DEC-048** modal confirmation + regen toutes occurrences futures non-démarrées. Préserve `en_cours` / `terminee` / `annulee`. `audit_logs` capture le diff.
- **A7.** Couverture 100% branches Vitest `packages/recurrence` (DEC-013) — setup Vitest workspace package (déjà OK pour `pricing`).

### B — Cockpit Realtime (COCK-01..06)

- **B1.** Supabase Realtime : `postgres_changes` listen sur table `rides` UPDATE → push UI = pattern standard 2026 (vs broadcast manuel).
- **B2.** Channel scoping : **DEC-049** channel global `cockpit:rides` MVP. Scoping multi-tenant Phase 06+ (ADR HDS migration).
- **B3.** UI table dense Linear-style : virtualisation `react-virtual` si > 100 lignes. < 100 = render direct.
- **B4.** Fade-in transitions : DEC-020 cohérent fade-in `template.tsx` Phase 04.9 (pas slide bidirectionnel reporté Phase UI dédiée).
- **B5.** TTI < 2s mesuré Playwright (COCK-02) : SSR initial RSC + CSR Realtime stream après hydration.
- **B6.** Landing page régulatrice : **DEC-054** redirect login → `/cockpit` (cohérent COCK-01 écran d'accueil par défaut). `/courses` reste accessible via menu nav.
- **B7.** Bloc alertes (retards, SMS échoués, patient absent) : sourcing cross-table (`rides` + `sms_messages` + `ride_events`) via vue Postgres `cockpit_alerts_view` (Wave 1).
- **B8.** Cache PWA régulateur `/courses` reporté Phase 05 (CONCERNS) — **inclure `/cockpit` aussi** si Serwist scope étendu. Décision exécution étape 3/5 plan.

### C — SMS Twilio (SMS-01..07 + DEC-008)

- **C1.** Twilio vs OVH SMS Pro : Twilio confirmé en stack figée DEC-003. OVH SMS Pro reporté V2+ si décision business.
- **C2.** `packages/sms` design : adapter interface `SmsAdapter { send(to, body, idempotencyKey): Promise<SmsResult> }` + impl Twilio.
- **C3.** Templates : **DEC-051** Mustache-like custom léger 5 variables (`{{patient_prenom}}`, `{{patient_nom}}`, `{{heure}}`, `{{date}}`, `{{chauffeur_prenom}}`). Implémentation ~20 lignes, pas de dépendance Handlebars.
- **C4.** Préférence patient `preferred_contact_method` (SMS-06) : déjà en BDD `patients.preferred_contact_method enum('sms', 'appel', 'aucun')` (à vérifier Wave 1 migration).
- **C5.** Cron J-1 18h + J-2h : **DEC-050** Vercel Cron jobs. Limite Pro 100 invocations/jour : suffisant TAP (~50-200 courses/jour ≈ 100-400 SMS si J-1+J-2h × patients consentants).
- **C6.** Numéro expéditeur (SMS-03) : 1 numéro Twilio dédié au tenant régie via env var `TWILIO_PHONE_FROM`. Multi-tenant futur Phase 06 (1 numéro par org).
- **C7.** Webhook delivery status : **DEC-052** Route Handler `/api/sms/webhook/twilio` + vérification `X-Twilio-Signature` HMAC avec `TWILIO_AUTH_TOKEN` env var. Sécurité standard Twilio.
- **C8.** Consentement DEC-008 strict : check actif horodaté **avant chaque envoi** (PAS de cache « vu il y a 5 min »). Si patient révoque consentement entre génération récurrence et envoi SMS J-1 → SKIP silencieux + log `sms_message.status = 'skipped_consent_revoked'`.

### D — Workflow patient absent (IMPV-01)

- **D1.** UI PWA chauffeur : bouton « Patient absent » à côté de « Démarrer la course » sur écran ride détail (statut `assignee` uniquement, masqué après start).
- **D2.** Endpoint : **DEC-053** Route Handler `POST /api/driver/rides/[id]/no-show` cohérent DEC-045 pattern (auth cookies Supabase + idempotency UUID + status guards + audit_logs).
- **D3.** Trigger alerte cockpit : INSERT dans `ride_events` table → Realtime `postgres_changes` propage à cockpit.
- **D4.** Modal régulatrice : actions Reprogrammer (datetime picker → génère nouveau ride futur) ou Annuler course (`status = 'annulee_patient'`).
- **D5.** Notification famille : **DEC-055** reporté Phase 06 (consentement tiers complexe RGPD).
- **D6.** Audit : `audit_logs` `action_type = 'ride.patient_no_show'` + payload `{ ride_id, motif?, declared_by_driver_id, decided_by_regulator_id?, decision: 'reprog' | 'cancel' }`.
- **D7.** Délai grâce : pas de timer auto. Bouton actif dès `scheduled_at` (chauffeur juge sur place 5-10 min).

### E — Verrous transverses

- DEC-008 SMS consentement LOCKED (check runtime avant chaque envoi)
- DEC-013 couverture 100% branches `packages/recurrence` + ≥ 80% `packages/domain` (si extrait)
- DEC-003 stack figée (Twilio confirmé, `rrule.js` ajout mineur justifié RFC 5545)
- NFR-001 zéro nom propre dans le code (cf `.planning/regle-neutralite-et-ton.md`)
- NFR-003 spacing strict 4/8/12/16/24/32/48/64
- CLAUDE.md § 11 limite 300 LOC par fichier (cohérent CONCERNS architecture PR #119)
- DEC-032 CD push exclusif migration BDD (pas d'apply MCP direct)
- DEC-041 row count check obligatoire Server Actions / Route Handlers UPDATE/DELETE

---

## Décisions LOCKED (DEC-046..055)

10 décisions structurantes inscrites dans `.planning/PROJECT.md` :

| # | Décision | Recommandation |
|---|----------|----------------|
| DEC-046 | Moteur récurrences | `rrule.js` standard RFC 5545 |
| DEC-047 | Génération occurrences | Eager batch 3 mois + cron mensuel extension |
| DEC-048 | Modification récurrence active | Modal confirm + regen futures non-démarrées |
| DEC-049 | Channel Realtime cockpit | Global `cockpit:rides` MVP (scoping multi-tenant Phase 06+) |
| DEC-050 | Cron jobs SMS | Vercel Cron (vs Supabase pg_cron) |
| DEC-051 | Templates SMS personnalisation | Mustache-like custom 5 variables |
| DEC-052 | Webhook Twilio delivery | Route Handler HMAC `X-Twilio-Signature` |
| DEC-053 | Endpoint patient absent | Route Handler `/api/driver/rides/[id]/no-show` cohérent DEC-045 |
| DEC-054 | Landing page régulatrice | Redirect login → `/cockpit` |
| DEC-055 | Notification famille patient absent | Phase 06 (hors V1.5) |

---

## Success Criteria (7)

1. **Récurrence dialyse 3×/sem** → occurrences planning OK (RECU-01..03)
2. **Jours fériés 974** = pas d'occurrence sauf override explicite (RECU-02)
3. **`packages/recurrence` 100% branches CI** (RECU-05, échec si < 100%)
4. **Cockpit Realtime sans reload** (COCK-03, fade-in subtil)
5. **SMS J-1 cron 18h** auto pour patients consentants (SMS-01..04)
6. **SMS sortants respectent consentement DEC-008** (check runtime + log skip)
7. **Chauffeur PWA déclare absent → alerte cockpit < 5s** + audit_logs (IMPV-01)

---

## Recherches industry 2026 à effectuer UI-SPEC (étape 2/5)

- **Supabase Realtime postgres_changes vs broadcast** (latence, scalabilité, multi-tenant scoping)
- **rrule.js patterns RFC 5545** (exceptions EXDATE, timezone DST 974)
- **Twilio Programmable SMS templates personnalisation 2026** (content templates approval ?)
- **Vercel Cron vs Supabase pg_cron tradeoffs** (observabilité, timezone, retry)
- **Cockpit table dense patterns 2026** (Linear, Notion, Mixpanel, Vercel Observability)
- **Realtime fade-in transitions sans flash** (React 18 useTransition, optimistic UI)
- **Workflow patient absent UX patterns** (call center, healthcare no-show management)

---

## Estimation

- ROADMAP initial : **10-15 h estimé**
- Vélocité cumulée Phase 04.9 + post-clôture : **-70 à -82%** (12 PR mergées en ~3-4 jours réel)
- Projection Phase 05 : **~3-5h réel agent** (cohérent historique)

---

## Prochaine étape

Pipeline GSD étape 2/5 — **UI-SPEC**.

`/gsd-ui-spec-phase 05` après merge PR #121.

---

## Refs

- ROADMAP.md Phase 05 lignes 282-309
- REQUIREMENTS.md RECU-01..06 / COCK-01..06 / SMS-01..07 / IMPV-01 / NFR-001..006
- PROJECT.md DEC-001..055 LOCKED (DEC-046..055 ajoutés cette PR)
- PR #109-#120 Phase 04.9 PWA chauffeur enveloppe + post-clôture (12 PR cumulées)
- `supabase/migrations/20260509000001_rides.sql:59` (commentaire `ride_recurrence_id` à activer Wave 1)
- `.planning/regle-neutralite-et-ton.md` (NFR-001 zéro nom propre)
- CLAUDE.md § 11 (limite 300 LOC) + § 13.5 (Visible Progress Mandate)
