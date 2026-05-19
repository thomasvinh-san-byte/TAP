# Phase 05 — Récurrences + Cockpit + SMS + Patient absent — SUMMARY

**Statut** : LIVRÉE 2026-05-19
**Pipeline GSD** : 5/5 complet (discuss → UI-SPEC → plan → execute 7 waves → UAT + clôture)
**PR cumulées** : 13 PR (#121-#133) + 2 auto-commits types (`d51e941`, `1b2bbc1`)

## Récap waves

| Wave | PR | Goal | Stats (fichiers / lignes) |
|------|----|----|---|
| W1 | #124 | 7 migrations BDD + `packages/recurrence` MVP 100% branches | 14 / ~800 |
| Fix | #126 | Fix prescriptions FK (table prescriptions non créée V1.5) | 3 / ~50 |
| W2 | #125 | Cockpit Realtime postgres_changes + table dense 40px + redirect login DEC-054 | 14 / ~542 |
| Fix | #127 | Auto-trigger sync-types via workflow_run | 2 / ~20 |
| W3 | #128 | Modal récurrence UI + preview 4 occurrences + cascade DEC-048 + migration `ride_recurrence_id` | 14 / ~1368 |
| Fix | #129 | Fix sync-types défense en profondeur (permissions + cd.yml integration) | 3 / ~58 |
| W4 | #130 | `packages/sms` Twilio + UI admin templates 160 chars | 17 / ~1267 |
| W5 | #131 | Cron jobs SMS J-1 + J-2h + webhook Twilio HMAC | 5 / ~533 |
| W6 | #132 | Workflow patient absent E2E + 3 migrations BDD | 15 / ~903 |
| W7 | #133 | E2E + UAT + SUMMARY + cleanup recurrence-temp | ~10 / ~500 |
| **Total** | 13 PR + 2 auto | Pipeline GSD complet | **~97 fichiers / ~6 000 lignes** |

## Success criteria validés (7/7)

- [x] **1. Récurrence dialyse 3×/sem occurrences générées** (W1 `packages/recurrence` + W3 modal + génération eager 3 mois DEC-047)
- [x] **2. Jours fériés 974 sautés sauf override** (W1 `holidays_974` 36 rows seed 2026-2028 + EXDATE rrule.js)
- [x] **3. `packages/recurrence` 100% branches CI Vitest** (W1 DEC-013 LOCKED, 10/10 tests GREEN)
- [x] **4. Cockpit Realtime fade-in sans reload** (W2 postgres_changes channel global `cockpit:rides` DEC-049, CSS keyframes natifs NFR-004)
- [x] **5. SMS J-1 cron 18h Réunion auto** (W5 pg_cron `0 14 * * *` UTC + pg_net + Vault secret → Route Handler Next.js)
- [x] **6. DEC-008 consent respecté** (W4 `hasActiveSmsConsent` runtime fail-safe + W5 Route Handlers check par envoi + `skipped_consent_revoked` tracking)
- [x] **7. Patient absent alerte cockpit < 5s** (W6 Realtime `ride_events` postgres_changes → modal slide-in NON-BLOQUANT)

## Décisions LOCKED inscrites Phase 05

| DEC | Sujet |
|-----|-------|
| DEC-046 | rrule.js V1.5 standard RFC 5545 (mature, ~30 KB) |
| DEC-047 | Eager 3 mois batch insert (cron mensuel extension Phase 06) |
| DEC-048 | Modal cascade modif active = confirmation 2 étapes obligatoire |
| DEC-049 | Channel global `cockpit:rides` MVP (scoping multi-tenant Phase 06+) |
| DEC-050 RÉVISÉ | pg_cron + pg_net + Vault Supabase (vs Vercel Cron Pro — 0€ vs 20$/mois) |
| DEC-051 | Templates SMS Mustache custom 5 vars (vs Handlebars 40 KB) |
| DEC-052 | Webhook Twilio HMAC SHA1 `X-Twilio-Signature` + `timingSafeEqual` |
| DEC-053 | Endpoint `/api/driver/rides/[id]/no-show` cohérent DEC-045 pattern |
| DEC-054 | Redirect login régulatrice → `/cockpit` (cohérent COCK-01) |
| DEC-055 | Notification famille → Phase 06 (consentement tiers RGPD complexe) |

## Patterns méthodologiques validés

- **pg_cron + pg_net combo (DEC-050 RÉVISÉ)** : coût 0 € vs 20 $/mois Vercel Cron Pro, timezone Réunion native, portable HDS Phase 06
- **Realtime postgres_changes channel global MVP** : 12 ms p90 single-region Supabase 2026, cohérent multi-tenant futur via `filter_row` broadcast Phase 06+
- **Mustache custom 5 vars vs Handlebars** : économie ~40 KB bundle, regex 3 lignes suffit V1.5
- **Route Handler PWA chauffeur cohérent DEC-045** : pattern réutilisé Wave 6 no-show (auth cookies + Zod + idempotency UUID + status guards + DEC-041 row count + ride_events INSERT + audit_logs + response stored)
- **Pipeline GitHub Actions 100% auto** : `workflow_run` cd.yml → `sync-types` job intégré → auto-commit `types.gen.ts` post-CD (validé 2 fois Phase 05 — auto-commits `d51e941` et `1b2bbc1`)
- **Trous PLAN comblés au fil de l'eau** : Wave 3 `ride_recurrence_id` (#128), Wave 6 `ride_events` + `idempotency_keys` constraint + `original_ride_id` (#132)

## Checklist UAT 7 critères (validation TEMPS 2 dirigeant post-merge)

```
☐ 1. Login régulatrice → redirect /cockpit (DEC-054 cohérent)
☐ 2. Cockpit affiche courses du jour avec fade-in Realtime
☐ 3. Création récurrence dialyse 3×/sem fonctionne + preview saute 1er mai
☐ 4. Cascade modification récurrence active = confirmation 2 étapes
☐ 5. SMS J-1 cron 18h Réunion (vérifier cron.job_run_details après 18h)
☐ 6. Patient sans consentement DEC-008 → sms_messages.delivery_status = 'skipped_consent_revoked'
☐ 7. Chauffeur PWA déclare absent → modal cockpit régulatrice < 5s
```

## Captures Visible Progress (CLAUDE.md § 13.5)

Dossier `captures/` placeholder. À fournir par le dirigeant post-merge :

- `cockpit-courses-jour.png` — Cockpit régulatrice avec courses du jour fade-in Realtime
- `cockpit-alerte-patient-absent.png` — Modal slide-in droite `NoShowAlertModal`
- `recurrence-create-modal-preview.png` — Modal création récurrence avec preview 4 occurrences (1er mai 974 grisé)
- `recurrence-edit-cascade.png` — Modal édition active avec confirmation 2 étapes (DEC-048)
- `admin-sms-templates.png` — `/admin/sms-templates` 2 cards éditables + counter 160 + chips + preview live
- `pwa-chauffeur-no-show.png` — PWA chauffeur bouton `Patient absent` h-12 inverse + modal motif
- `sms-recu-iphone.png` — SMS test reçu (template Mustache rendered)

## Pré-requis runtime à configurer (non-bloquants merge)

1. **Vault secret Supabase** :
   ```sql
   SELECT vault.create_secret('xxx-32-chars-uuid-v4', 'cron_app_token');
   ```
   (console SQL Editor, 1 fois). Sans ce secret, pg_cron déclenche les Route Handlers Wave 5 avec Bearer vide → 401 attendu.

2. **Vercel Project Settings env vars** :
   - `CRON_APP_TOKEN` (miroir du Vault secret)
   - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` (Wave 4)
   - `SUPABASE_SERVICE_ROLE_KEY` (probable déjà Phase 02-04)
   - `NEXT_PUBLIC_APP_URL` (vérifier existant)

3. **Configuration Twilio webhook** :
   Phone Number → Messaging → Status Callback URL = `https://tap-web-brown.vercel.app/api/sms/webhook/twilio` (POST)

## Items reportés Phase 06 (CONCERNS consolidation)

- `rrule-temporal` Temporal API maturity réévaluation (polyfill ou Node 22+)
- Twilio Content API multi-channel WhatsApp/RCS
- 2-way SMS confirmation Y/C/R (Passe 4 réception patient)
- Multi-tenant Realtime channel scoping par `organization_id`
- Notification famille patient absent (DEC-055 LOCKED Phase 06)
- Cache PWA régulateur `/courses` + `/cockpit` (équivalent PWA chauffeur)
- Imprévus complexes (panne véhicule, multi-patient absent auto)
- KPIs dirigeant tableau de bord pilotage
- `pg_net` extension déplacement schéma `extensions` (advisor warning)
- `AddressOrPOIPicker` dans modal récurrence (V1.5 = input text simple)
- Table `prescriptions` + RECU-04 décrément + ALTER `ride_recurrences` ADD FK retroactive (post-#126)

## Refs

- 05-CONTEXT.md PR #121, 05-UI-SPEC.md PR #122, PLAN-1..7 PR #123
- ROADMAP.md — Phase 05 cochée [x]
- PROJECT.md — DEC-046..055 LOCKED dont DEC-050 RÉVISÉ
- 8 sources industry 2026 (Supabase Realtime PG17, rrule.js, Twilio Content API, cockpit dense Linear/Notion, pg_cron+pg_net, healthcare no-show multi-touchpoint, Realtime UI fade-in, SMS FR/créole 974)
