# Phase 05 — UI-SPEC : Récurrences + Cockpit + SMS + Patient absent

**Status:** UI-SPEC complete (pipeline GSD 2/5)
**Created:** 2026-05-18 post discuss PR #121

---

## 1. Récap CONTEXT + DEC LOCKED

Pipeline GSD étape 2/5. Inputs : `05-CONTEXT.md` (PR #121, périmètre + DEC-046..055 LOCKED), `04.9-UI-SPEC.md` (PR #110, référence format wireframes ASCII + sources industry + anti-patterns).

**10 décisions DEC-046..055 LOCKED** :

| # | Décision | Statut |
|---|----------|--------|
| DEC-046 | `rrule.js` standard RFC 5545 | LOCKED |
| DEC-047 | Génération eager 3 mois + cron mensuel | LOCKED |
| DEC-048 | Modif récurrence active = modal confirm + regen futures non-démarrées | LOCKED |
| DEC-049 | Channel Realtime global `cockpit:rides` MVP | LOCKED |
| **DEC-050** | **pg_cron Supabase + pg_net → Route Handler Next.js** | **LOCKED (révisé UI-SPEC)** |
| DEC-051 | Templates SMS Mustache custom 5 variables | LOCKED |
| DEC-052 | Webhook Twilio HMAC `X-Twilio-Signature` SHA1 | LOCKED |
| DEC-053 | Endpoint `/api/driver/rides/[id]/no-show` cohérent DEC-045 | LOCKED |
| DEC-054 | Redirect login régulatrice → `/cockpit` | LOCKED |
| DEC-055 | Notification famille patient absent → Phase 06 | LOCKED |

---

## 2. Sources industry 2026 consolidées (8 sources)

### Source 1 — Supabase Realtime 2026 (PostgreSQL 17 logical replication)

- URL : https://johal.in/architecture-teardown-supabase-2026-realtime-works-using-postgresql/
- Refs : https://supabase.com/docs/guides/realtime/benchmarks, /architecture, /postgres-changes
- **Latence p90 = 12ms single-region** (vs 47ms legacy)
- Write throughput overhead <1% (vs 12% legacy)
- Support 1M concurrent WebSocket connections par projet
- RLS preserved via publication `filter_row`
- JWT auth WebSocket + subscription filters validés user claims
- Rust subscriber (vs Erlang legacy)
- Change batching : 100 changes ou 10ms
- DLQ : retry 3× puis `realtime_dlq` table

**Implication TAP** : `postgres_changes` SUFFISANT V1.5 (1 régulatrice, ~50-200 changes/jour). Pattern broadcast Phase 06+ pour multi-tenant (50 régies).

### Source 2 — rrule.js / RFC 5545 alternatives 2026

- URL primaire : https://github.com/jkbrzt/rrule
- Alternative moderne : https://github.com/ggaabe/rrule-temporal
- **rrule.js** mature standard de facto mais dernier changelog 2019
- **rrule-temporal** (2025+) basée API Temporal (timezone-safe), RFC 5545 + RFC 7529, requiert Node 22+ ou polyfill
- Pattern EXDATE pour exceptions natives (jours fériés 974)
- RRuleSet combine RRULE + RDATE + EXRULE + EXDATE

**Implication DEC-046** : confirmer `rrule.js` V1.5 (maturité). Note CONCERNS Phase 06 : réévaluer `rrule-temporal` quand Temporal API stable navigateurs.

### Source 3 — Twilio Content API + Templates 2026

- URL : https://www.twilio.com/en-us/blog/developers/tutorials/product/how-to-use-twilio-content-template-builder-messaging (2026-02-11)
- Refs : https://www.twilio.com/docs/content/content-api-resources
- **Content API + Template Builder** : `content_sid` + `content_variables` (key-value), templates côté Twilio Console
- Sécurité HMAC-SHA1 webhooks via `X-Twilio-Signature` validé avec `TWILIO_AUTH_TOKEN`
- Status callbacks : `sent` / `delivered` / `failed` / `undelivered`
- SDK Node.js `twilio` npm (utilities HMAC inclus)

**Implication DEC-051** : conserver Mustache custom V1.5 (simplicité). Note CONCERNS Phase 06 : Twilio Content API si besoin multi-channel WhatsApp/RCS.

### Source 4 — Cockpit dashboard table dense 2026

- URL : https://artofstyleframe.com/blog/dashboard-design-patterns-web-apps/ (2026-04-11)
- Refs : https://tanstack.com/table/latest/docs/guide/virtualization, https://tanstack.com/virtual/latest
- **Row height** : 48-52px confortable, **36-40px dense** (cible TAP)
- Column alignment : left texte, right nombres, center status badges
- Pagination vs infinite scroll : pagination pour data référencée
- Sidebar 240-280px (Linear/Notion/Vercel)
- **Skeleton screens** : content-shaped placeholders pulse (réduction perceived load 20-30%)
- 3 états composant : Loading skeleton / Empty illustration+CTA / Error red banner+retry

**Implication TAP cockpit** : row **40px** (dense), TanStack Table + Virtual OPTIONNEL V1.5 (~50 visibles instant suffit DOM natif), sidebar 256px, skeletons obligatoires.

### Source 5 — pg_cron + pg_net Supabase combo (DEC-050 RÉVISÉ)

- URL : https://supabase.com/docs/guides/cron, /extensions/pg_net
- pg_cron 1.6.4 **déjà activé** TAP (vérifié SQL `SELECT extname FROM pg_extension`)
- pg_net non encore activé (Wave 1, extension Supabase gratuite standard)
- Throughput pg_net : 200 req/s par défaut (largement suffisant TAP)
- Stockage Vault : `vault.create_secret('xxx', 'cron_app_token')`
- Observabilité : `cron.job_run_details` + `net._http_response` SQL-queryable

**Pattern combo TAP Phase 05** :

```sql
-- Activation Wave 1 migration BDD
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT vault.create_secret('xxx-random-32-chars', 'cron_app_token');

-- Job J-1 quotidien 18h heure Réunion
SELECT cron.schedule(
  'sms-reminder-j1', '0 18 * * *',
  $$ SELECT net.http_post(
    url := 'https://tap-web-brown.vercel.app/api/cron/sms-reminders-j1',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM
        vault.decrypted_secrets WHERE name = 'cron_app_token')),
    body := '{}'::jsonb
  ); $$
);

-- Job J-2h horaire
SELECT cron.schedule('sms-reminder-j2h', '0 * * * *', ...);
```

Route Handler Next.js TypeScript logique métier (testable Vitest, cohérent stack figée DEC-003) :

```ts
// apps/web/src/app/api/cron/sms-reminders-j1/route.ts
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_APP_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Query rides J+1 + consentement DEC-008 + Mustache render + Twilio + tracking
}
```

**Comparaison Vercel Cron vs pg_cron** :

| Critère | Vercel Cron | pg_cron Supabase |
|---|---|---|
| Coût | 20$/mois si Hobby | **0€ inclus** |
| Limite Hobby | 1 cron/jour | Illimité |
| Timezone | UTC seul | **Native `Indian/Reunion`** |
| Migration HDS Phase 06 | À reconfigurer | **Part avec Postgres self-host** |
| Observabilité | Vercel dashboard | SQL `cron.job_run_details` + `net._http_response` |
| Logique métier | Route Handler Next.js | Route Handler Next.js (préservée) |

**Implication TAP DEC-050 RÉVISÉ** : pg_cron + pg_net pour scheduling + HTTP, Route Handler Next.js pour logique métier. Coût 0€, timezone native, portable Phase 06 HDS.

### Source 6 — Healthcare patient no-show workflow 2026

- URL : https://www.certifyhealth.com/blog/how-to-reduce-patient-no-shows-15-proven-strategies-for-2026/
- Refs : https://insights.wchsb.com/2026/02/05/the-50-fee-wont-fix-a-50000-problem-why-medical-practices-must-rethink-their-no-show-strategy/
- **Multi-touchpoint reminders** : J-3 + J-1 + J-2h réduit no-shows 50%+
- **Friction reschedule > pénalité** : reschedule facile = -70% no-shows
- 2-way response codes `Y` / `C` / `R` augmentent accountability
- **SMS = 209% higher response rate vs phone calls**

**Implication TAP** : J-1 18h + J-2h confirmé (cohérent DEC-050 + SMS-04/05). 2-way confirmation reporté Passe 4. Workflow patient absent pickup : chauffeur déclare + motif → cockpit alerte → décision reschedule preferred.

### Source 7 — Realtime UI patterns fade-in sans flash

- URL : https://supabase.com/features/realtime-postgres-changes
- DEC-020 LOCKED fade-in `template.tsx` Phase 04.9
- **Pattern 2026** : fade-in subtle 200-300ms sur INSERT, **PAS de slide-in** (distractant cockpit dense)
- **PAS de flash blanc** : background transition au lieu de border highlight rouge
- Opacity 0→1 + scale 0.98→1 sur INSERT
- **PAS d'animation** sur UPDATE (juste changement valeur, optionnel pulse 1×)
- **PAS d'animation** sur DELETE (suppression directe, animation perceived as bug)

**Implication TAP cockpit** : `<CourseRow />` avec `transition-opacity duration-200`, CSS `@keyframes fadeIn` custom dans `globals.css` (NFR-004 anti-framer-motion). PAS de sounds Realtime.

### Source 8 — Templates SMS personnalisation FR/créole

- Contexte sociolinguistique 974 (INSEE 2020+) : ~85% lecteurs FR standard, ~75% pratiquants créole oral, ~15-20% lecteurs créole écrit
- **FR standard suffit V1.5**, créole = option future
- **160 chars max** par SMS (économie coûts Twilio, sinon facturé 2 SMS)
- Personnalisation lourde non recommandée : 5 vars max cf DEC-051
- Politesse : « Bonjour ... », clôture « TAP Réunion » signature

**Templates types** :

- **J-1 18h** : `« Bonjour {{patient_prenom}}, rappel course demain {{date}} à {{heure}} avec {{chauffeur_prenom}}. Pour annuler/reporter : 02 62 XX XX XX. Cordialement, TAP Réunion. »`
- **J-2h** : `« {{patient_prenom}}, votre course est dans 2h ({{heure}}). {{chauffeur_prenom}} vient vous chercher à {{pickup_address}}. TAP Réunion. »`

---

## 3. Wireframes ASCII (6 surfaces)

### Surface 1 — Cockpit régulatrice `/cockpit`

```
╔═══════════════════════════════════════════════════════════════╗
║ ┌─────────────┐  ┌──────────────────────────────────────────┐ ║
║ │ Sidebar 256 │  │ Header  Ma journée    [🟢 Realtime] [≡]  │ ║
║ │ ●Cockpit    │  ├──────────────────────────────────────────┤ ║
║ │  Patients   │  │ Courses du jour (12)                      │ ║
║ │  Courses    │  │ ─────────────────────────────────────── │ ║
║ │  Caisse     │  │ Heure │Patient    │Pickup   │Chauf │Stat │ ║
║ │  Chauffeurs │  │ 08:00 │Mme Hoarau │CHU 974  │Vergoz│●   │ ║
║ │  Récurrences│  │ 08:30 │M. Boyer   │Cliniq.  │Maill │●   │ ║
║ │             │  │ 09:00 │Mme Payet  │EHPAD ...│Vergoz│○   │ ║
║ │             │  │ ...                                       │ ║
║ │             │  ├──────────────────────────────────────────┤ ║
║ │             │  │ Alertes (2)                               │ ║
║ │             │  │ ⚠ Retard course 08:00 (15 min)            │ ║
║ │             │  │ ⚠ SMS échec patient ...                   │ ║
║ └─────────────┘  └──────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════╝
```

**Spec** :
- Sidebar 256px fixe (cohérent (app)/layout.tsx existant)
- Header sticky : titre + badge Realtime status (vert connected, amber reconnecting, rouge disconnected) + UserMenu
- Main 2 blocs verticaux :
  - **Courses du jour** : table dense row 40px, colonnes Heure/Patient/Pickup/Chauffeur/Statut (couleurs sémantiques badges)
  - **Alertes** : stack cards max-h:240px overflow-y, w-80 right-side (responsive <1280px → stacked below)
- Empty state : illustration + « Aucune course aujourd'hui » + CTA
- Loading state : 8 skeleton rows pulse shimmer
- Error state : red/amber banner top + bouton retry

### Surface 2 — Modal récurrence (création)

```
╔═════════════════════════════════════════════════════════╗
║ × Nouvelle récurrence — Mme Hoarau                       ║
╠═════════════════════════════════════════════════════════╣
║ Type   ◉ Dialyse  ○ Chimio  ○ Consultation  ○ Autre     ║
║                                                          ║
║ Fréquence : tous les                                     ║
║  [L] [Ma] ●Me [J] [V] [S] [D]   ← chips jours semaine  ║
║                                                          ║
║ Heure        ┌─────────┐                                 ║
║              │ 08:00   │                                 ║
║              └─────────┘                                 ║
║ Date début   ┌─────────┐    Date fin                     ║
║              │20/05/26 │    ◉ Bon de transport épuisé   ║
║              └─────────┘    ○ Date fixe                  ║
║                                                          ║
║ Pickup     ┌──────────────────────────────┐ [Changer]   ║
║            │ 📍 CHU Félix Guyon, 97400 ...│              ║
║            └──────────────────────────────┘              ║
║ Drop-off   ┌──────────────────────────────┐ [Changer]   ║
║            │ 📍 ...                       │              ║
║            └──────────────────────────────┘              ║
║                                                          ║
║ Mode    ◉ TAP  ○ Taxi conv.   Urgence ○ Normal ◉ Prio  ║
║                                                          ║
║ Prescription [▼ BT2025-001 — 36 courses restantes  ]    ║
║                                                          ║
║ ═══ Preview 4 prochaines occurrences ═══════════════    ║
║ ✓ Lun 20 mai 2026 08:00                                  ║
║ ✓ Mer 22 mai 2026 08:00                                  ║
║ ⊘ Ven 24 mai 2026 — JOUR FÉRIÉ (1er mai) - skippé       ║
║ ✓ Lun 27 mai 2026 08:00                                  ║
║                                                          ║
║                          [Annuler]  [Créer 36 occurrences]║
╚═════════════════════════════════════════════════════════╝
```

**Spec** :
- Trigger : bouton « + Nouvelle récurrence » fiche patient
- Champs : type / fréquence chips / heure / dates / addresses (AddressOrPOIPicker existant) / mode / urgence / prescription dropdown
- **Preview live** des 4 prochaines occurrences via `rrule.js` (jours fériés 974 grisés/skipped avec icône ⊘)
- Footer : Annuler + Créer X occurrences (count dynamique selon bon de transport restant)

### Surface 3 — Modal édition récurrence ACTIVE (DEC-048)

```
╔═════════════════════════════════════════════════════════╗
║ × Modifier récurrence dialyse Mme Hoarau                 ║
╠═════════════════════════════════════════════════════════╣
║ ┌─────────────────────────────────────────────────────┐ ║
║ │ ⚠ Cette récurrence a 18 occurrences générées.        │ ║
║ │   Modifier remplacera toutes les occurrences futures  │ ║
║ │   non-démarrées (12 impactées).                       │ ║
║ └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║ [Mêmes champs Surface 2, pré-remplis]                    ║
║                                                          ║
║ [Arrêter récurrence] (variant outline)                   ║
║                                                          ║
║                  [Annuler]  [Confirmer modification]     ║
╚═════════════════════════════════════════════════════════╝

  Modal confirmation cascade après click [Confirmer modif] :
  ╔════════════════════════════════════════════════╗
  ║ Confirmer la modification ?                     ║
  ╠════════════════════════════════════════════════╣
  ║ 12 occurrences non-démarrées seront supprimées  ║
  ║ et regénérées avec les nouveaux paramètres.     ║
  ║                                                  ║
  ║ Préservées : 6 courses en cours / terminées.    ║
  ║                                                  ║
  ║              [Annuler]  [Confirmer]              ║
  ╚════════════════════════════════════════════════╝
```

**Spec** :
- Alerte top jaune : impact occurrences non-démarrées
- Bouton secondaire « Arrêter récurrence » (mark `archived_at`, future occurrences non-démarrées → status `annulee_systeme`)
- Modal confirmation cascade obligatoire avant submit (DEC-048 LOCKED)
- `audit_logs` capture diff avant/après (RECU-06)

### Surface 4 — Templates SMS éditables `/admin/sms-templates`

```
╔═══════════════════════════════════════════════════════════════╗
║ Templates SMS                                                  ║
╠═══════════════════════════════════════════════════════════════╣
║ ┌────────────────────────┐  ┌─────────────────────────────┐  ║
║ │ Rappel J-1 (18h)        │  │ Variables disponibles :     │  ║
║ │ ┌────────────────────┐  │  │ {{patient_prenom}} ▼ insert │  ║
║ │ │Bonjour {{patient_  │  │  │ {{patient_nom}}       insert │  ║
║ │ │prenom}}, rappel    │  │  │ {{heure}}             insert │  ║
║ │ │course demain       │  │  │ {{date}}              insert │  ║
║ │ │{{date}} à {{heure}}│  │  │ {{chauffeur_prenom}}  insert │  ║
║ │ │avec {{chauffeur_   │  │  └─────────────────────────────┘  ║
║ │ │prenom}}.           │  │  ┌─ Preview (Mme Hoarau, lun) ─┐ ║
║ │ │TAP Réunion.        │  │  │ Bonjour Patrick, rappel     │ ║
║ │ │                    │  │  │ course demain lun 20 mai à   │ ║
║ │ │             148/160│  │  │ 08:00 avec Jean. TAP Réunion │ ║
║ │ └────────────────────┘  │  └────────────────────────────┘ ║
║ │ [Tester l'envoi]        │                                   ║
║ │ [Enregistrer]           │                                   ║
║ └────────────────────────┘                                    ║
║ ┌────────────────────────┐                                    ║
║ │ Rappel J-2h              │                                  ║
║ │ ...                      │                                  ║
║ │             156/160      │                                  ║
║ │ [Tester l'envoi]         │                                  ║
║ └────────────────────────┘                                    ║
╚═══════════════════════════════════════════════════════════════╝
```

**Spec** :
- Section admin dirigeant `(admin)/admin/sms-templates`
- 2 templates en cards : `j1_reminder` + `j2h_reminder`
- Textarea + counter 160 chars (rouge si >160)
- Variables sidebar cliquables → insert au caret
- Preview live side-by-side avec données seed démo
- Bouton « Tester l'envoi » → modal input numéro + envoie SMS test
- Save → `audit_logs` (SMS-07)

### Surface 5 — Modal alerte cockpit patient absent

```
        (Cockpit en arrière-plan, NON bloqué)
                                ╔══════════════════════════════════╗
                                ║ ⚠ Patient absent au pickup       ║
                                ╠══════════════════════════════════╣
                                ║ Patient : Mme Hoarau              ║
                                ║ Course  : 08:00 — CHU Félix Guyon ║
                                ║ Chauffeur : Vergoz Jean           ║
                                ║ Motif   : « Pas de réponse        ║
                                ║   sonnette ni téléphone »         ║
                                ║                                    ║
                                ║ [Reprogrammer]  [Annuler course]  ║
                                ║                                    ║
                                ║ ─────────────────────────────     ║
                                ║ ◯ Notifier la famille (Phase 06)  ║
                                ║                                    ║
                                ║ [Garder ouvert — décider plus tard]║
                                ╚══════════════════════════════════╝
```

**Spec** :
- Triggered : Realtime `postgres_changes` event sur `ride_events` type `patient_no_show`
- Modal slide-in droite 200ms (PAS de modal centré bloquant cockpit)
- 2 CTA équivalents visuellement :
  - « Reprogrammer » (variant primary) → DatePicker inline nouvelle datetime → crée nouveau ride avec `original_ride_id` link
  - « Annuler la course » (variant destructive outline) → status `annulee_patient`
- 1 secondaire « Garder ouvert » → marque alerte vue mais pas tranchée
- Checkbox « Notifier la famille » **GRISÉE V1.5** (DEC-055 reporté Phase 06)
- Tous tracés `audit_logs` action `ride.patient_no_show` + decision

### Surface 6 — UI PWA chauffeur bouton « Patient absent »

```
╔════════════════════════════════════════════╗
║ TAP Ma journée                  [≡ Menu]   ║
╠════════════════════════════════════════════╣
║                                            ║
║  Course 08:00                              ║
║  Mme Hoarau                                ║
║  📍 CHU Félix Guyon                        ║
║                                            ║
║                                            ║
║  ┌────────────────────────────────────┐    ║
║  │  Démarrer la course                │    ║ ← h-14 (56px, DEC-014)
║  │  (primary, gros)                   │    ║
║  └────────────────────────────────────┘    ║
║                                            ║
║  ┌────────────────────────────────────┐    ║
║  │  Patient absent                    │    ║ ← h-12 (48px, inverse intentionnel)
║  │  (outline, plus petit)             │    ║
║  └────────────────────────────────────┘    ║
╚════════════════════════════════════════════╝

  Click « Patient absent » → modal confirmation :
  ╔════════════════════════════════════════╗
  ║ Confirmer l'absence patient ?           ║
  ╠════════════════════════════════════════╣
  ║ Vous déclarez l'absence du patient.     ║
  ║ La régulatrice sera alertée.            ║
  ║                                          ║
  ║ Motif (optionnel) :                     ║
  ║ ┌────────────────────────────────────┐  ║
  ║ │                                    │  ║
  ║ │                                    │  ║
  ║ └────────────────────────────────────┘  ║
  ║                                          ║
  ║         [Annuler]  [Confirmer absence]   ║
  ╚════════════════════════════════════════╝
```

**Spec** :
- Page `/conduite` PWA chauffeur (Phase 04.9 stable, modif minimale)
- Ride statut `assignee` ou `en_route_pickup` : ajout bouton secondaire sous « Démarrer »
- Bouton « Patient absent » h-12 (48px) **inverse intentionnel** vs « Démarrer » h-14 (56px DEC-014) pour éviter mis-tap
- Variant `outline` couleur destructive subtle
- Click → modal confirmation + champ motif optionnel textarea (max 200 chars)
- Submit → `POST /api/driver/rides/[rideId]/no-show` (DEC-053 pattern DEC-045 PWA Phase 04.9 : auth cookies + idempotency UUID + row count check + audit_logs)
- **Offline support** : enqueue Dexie cohérent sync engine Phase 04.9 (réutilisation pattern `enqueue({ type: 'no_show_ride', resource_id, payload: { motif } })` → adapter `sync-engine.ts` ligne ~89 endpoint mapping)
- Toast confirmation : « Absence déclarée. Régulatrice alertée. »

---

## 4. Anti-patterns explicites

### Cockpit
- ❌ **PAS de auto-scroll** lors d'INSERT Realtime (frustre régulatrice qui consulte une ligne)
- ❌ **PAS de notification sonore** Realtime (pollution audio open space)
- ❌ **PAS de modal bloquant** pour nouvelles alertes (slide-in latéral)
- ❌ **PAS de table row > 48px** (perte density data-heavy view)
- ❌ **PAS de pagination** si < 100 rows (filter/sort suffit, pagination = friction)
- ❌ **PAS de framer-motion** pour transitions (NFR-004, CSS natif suffit cohérent DEC-020)

### Récurrences
- ❌ **PAS de UI fréquence custom** "tous les X jours" (`rrule.js` BYDAY suffit + lisibilité < custom)
- ❌ **PAS de génération sans preview** (régulatrice doit voir 4 prochaines occurrences avant create)
- ❌ **PAS d'edition silencieuse** d'une récurrence active (modal confirmation cascade obligatoire DEC-048)
- ❌ **PAS de regen occurrences en cours/terminees/annulees** (préservation intégrité métier)

### SMS
- ❌ **PAS de variables Mustache** non documentées (5 max DEC-051 : `patient_prenom`, `patient_nom`, `heure`, `date`, `chauffeur_prenom`)
- ❌ **PAS de templates > 160 chars** (coût Twilio 2 SMS si dépasse, counter rouge si >160)
- ❌ **PAS d'envoi sans check consentement runtime** (DEC-008 absolu, pas de cache « vu il y a 5 min »)
- ❌ **PAS de templates créole** obligatoire V1.5 (FR standard suffit, créole = option Phase 06)

### Patient absent
- ❌ **PAS d'auto-cancel** après X min sans pickup (régulatrice décide toujours)
- ❌ **PAS de notification famille auto** V1.5 (DEC-055 Phase 06, consentement tiers RGPD)
- ❌ **PAS de bouton « Patient absent » trop proéminent** côté chauffeur (h-12 outline, plus petit que h-14 primary « Démarrer »)
- ❌ **PAS de modal bloquant** ride-actions (workflow continue après déclaration)

### General
- ❌ **PAS de noms propres** dans le code (NFR-001, wireframes ASCII utilisent données seed démo)
- ❌ **PAS de couleur destructive** sur ConnectionStatus / cockpit row neutre (réservée no-show, dead letter, annulation)

---

## 5. Composants à créer (~25 nouveaux)

```
apps/web/src/app/(app)/cockpit/
  page.tsx                                       # Server Component SSR initial
  _components/
    cockpit-content.client.tsx                   # Wrapper Realtime subscription
    courses-table.client.tsx                     # Table dense rows 40px
    course-row.client.tsx                        # Row fade-in animation
    alerts-panel.client.tsx                      # Stack alertes droite/haut
    alert-card.client.tsx                        # Card individuelle alerte
    no-show-alert-modal.client.tsx               # Modal slide-in patient absent
    realtime-status-badge.client.tsx             # Indicateur Realtime
  _lib/
    use-cockpit-rides.ts                         # Hook subscription rides
    use-cockpit-alerts.ts                        # Hook subscription alerts

apps/web/src/app/(app)/patients/[id]/_components/
  recurrences-section.client.tsx                 # Liste récurrences patient
  recurrence-create-modal.client.tsx             # Modal création
  recurrence-edit-modal.client.tsx               # Modal édition active + cascade
  recurrence-preview.client.tsx                  # Preview 4 occurrences

apps/web/src/app/(admin)/admin/sms-templates/
  page.tsx                                       # Liste 2 templates
  _components/
    template-editor.client.tsx                   # Editor textarea + preview + counter
    template-test-modal.client.tsx               # Modal envoi test numéro
  actions.ts                                     # Server Actions save + test

apps/web/src/app/(driver)/conduite/_components/
  no-show-button.client.tsx                      # NEW bouton h-12 outline
  no-show-modal.client.tsx                       # NEW confirmation + motif
  (ride-actions.client.tsx)                      # MODIFIÉ : ajout bouton no-show

apps/web/src/app/api/
  cron/sms-reminders-j1/route.ts                 # NEW Bearer auth + Twilio + tracking
  cron/sms-reminders-j2h/route.ts                # NEW idem horaire
  driver/rides/[rideId]/no-show/route.ts         # NEW Route Handler PWA chauffeur
  sms/webhook/twilio/route.ts                    # NEW webhook delivery HMAC

packages/recurrence/                              # NEW package
  src/
    index.ts                                     # Public API
    rrule-helper.ts                              # rrule.js wrapper
    holidays-974.ts                              # 13 jours fériés
    generate-occurrences.ts                      # Génère X occurrences
  package.json + tsconfig.json + vitest.config.ts (100% branches DEC-013)

packages/sms/                                     # NEW package
  src/
    index.ts                                     # Public API
    twilio-adapter.ts                            # Wrapper Twilio SDK
    template-renderer.ts                         # Mustache custom 5 vars
    consent-checker.ts                           # DEC-008 check actif
  package.json + tsconfig.json + vitest.config.ts (≥80%)
```

---

## 6. Migrations BDD (7 fichiers)

```
supabase/migrations/
  20260519000001_ride_recurrences.sql            # Table + RLS + indexes
  20260519000002_ride_recurrence_exceptions.sql  # Table + RLS
  20260519000003_holidays_974.sql                # 13 jours fériés statiques
  20260519000004_sms_messages.sql                # Tracking delivery
  20260519000005_sms_templates.sql               # Templates persistés (j1+j2h)
  20260519000006_rides_no_show_columns.sql       # no_show_at + motif
  20260519000007_pg_net_pg_cron_setup.sql        # pg_net ext + Vault secret + 2 cron.schedule
```

**Application via CD push exclusif** (DEC-032 LOCKED).

---

## 7. Décisions UI/UX granulaires

### Couleurs sémantiques (cohérent ConnectionStatusBadge Phase 04.9)

| Sémantique | Couleur | Usage |
|---|---|---|
| Primary | bleu `#0944a0` (`--primary`) | Actions principales, badges actifs |
| Warning | amber | Retards, alertes non critiques, pulse offline |
| Destructive | rouge | Annulation, no-show, dead letter, **réservée** |
| Muted | gris | Statuts terminés, courses passées |
| Success | vert | Courses délivrées, SMS confirmés |

### Touch targets

| Surface | Hauteur | Justification |
|---|---|---|
| Cockpit row | **40px** | Dense data view (Source 4 industry) |
| Cockpit action button | 36px | Desktop standard |
| **PWA chauffeur primary** | **56px (h-14)** | **DEC-014 LOCKED préservé** (gants/pluie/conduite) |
| PWA chauffeur secondary (no-show) | 48px (h-12) | Inverse intentionnel anti mis-tap |
| Modal bouton primaire | 44px | Standard shadcn |
| Sidebar item | 36px | Desktop (Source 4 Linear/Notion/Vercel) |

### Animations Realtime

| Event | Animation | Durée |
|---|---|---|
| Row INSERT | fade-in opacity 0→1 + scale 0.98→1 | 200ms |
| Row UPDATE | background pulse 1× | 300ms |
| Row DELETE | suppression directe (PAS d'animation) | 0ms (animation = perceived bug) |
| Modal slide-in (no-show alert) | translate-x | 200ms |
| Skeleton loading | pulse shimmer (shadcn `Skeleton`) | infinite |

### Layout cockpit

- Sidebar : **256px** fixe
- Main padding : `px-24 py-16` (cohérent (app)/layout.tsx Phase 04.5)
- Bloc courses : `flex-1`, scroll-y own
- Bloc alertes : `w-80` (320px) right-side, responsive `<1280px → stacked below`

---

## 8. Notes CONCERNS Phase 06 (ouvertes)

- **`rrule-temporal`** (Temporal API maturity Phase 06 réévaluation, polyfill ou Node 22+ requis)
- **Twilio Content API multi-channel** (V1.5 reste Mustache custom DEC-051, Phase 06 si besoin WhatsApp/RCS)
- **2-way SMS confirmation Y/C/R** (Passe 4 réception patient → fiche)
- **Multi-tenant Realtime channel scoping** (V1.5 global, Phase 06+ par organization_id)

---

## 9. Découpage 7 waves préliminaire (à confirmer plan étape 3/5)

| Wave | Goal | Estimation |
|------|------|------------|
| W1 | Migrations BDD (7) + `packages/recurrence` MVP + pg_cron+pg_net setup | ~1.5h |
| W2 | Cockpit Realtime + courses table dense + alertes panel | ~2h |
| W3 | Modal récurrence création/édition + preview 4 occurrences | ~2h |
| W4 | `packages/sms` + Twilio adapter + templates UI admin | ~2h |
| W5 | Route Handlers cron J-1 + J-2h + webhook Twilio HMAC | ~1.5h |
| W6 | Workflow patient absent (Route Handler + modal cockpit + PWA + sync engine adapter) | ~2h |
| W7 | E2E Playwright + UAT informel + clôture SUMMARY + captures | ~1h |
| **Total** | | **~12h ROADMAP / ~3-5h réel projeté (-70 à -82% Phase 04.9)** |

---

## 10. Prochaine étape

Pipeline GSD étape 3/5 — **plan**. `/gsd-plan-phase 05` après merge PR #122.

---

## Refs

- PR #121 discuss(05) CONTEXT + DEC-046..055 LOCKED
- PR #110 Phase 04.9 UI-SPEC référence structure
- 8 sources industry 2026 inscrites avec URLs + insights
- `apps/web/src/app/(driver)/_components/connection-status-badge.client.tsx` (pattern Realtime status)
- `apps/web/src/lib/offline/sync-engine.ts` (pattern `enqueue` à étendre `no_show_ride`)
- DEC-014 PWA ergonomie chauffeur 56px préservé
- NFR-001 zéro nom propre code / NFR-003 spacing / NFR-004 anti-framer-motion
