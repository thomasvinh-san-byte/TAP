# Journal — phases livrées

## 2026-06-05 — Phase 06.24 reprise livrée localement (en-tête complet + hiérarchie typo travaillée)

Reprise du lot 1 d'incarnation Régulation après audit post-merge #248 : l'en-tête avait été unifié sur 6 écrans mais **3 écrans cœur métier avaient été oubliés**, et la hiérarchie typo n'avait quasi pas bougé (`text-base` 8, `text-xs` monté de 72→87). Cette PR finit le travail.

### D-01 — PageHeader sur les 3 écrans oubliés

| Écran | Migration |
|---|---|
| `patients/new/page.tsx` | `<h1>Nouveau patient</h1>` → `<PageHeader title="Nouveau patient" />` |
| `patients/[id]/edit/page.tsx` | `<h1>Modifier — {nom} {prenom}</h1>` → `<PageHeader title={…} />` |
| `cockpit/optimisation/optimization-shell.client.tsx` | `<header>` manuel (titre dynamique + boutons « ↻ Re-calculer » + « Fermer ») → `<PageHeader title=… actions={…}>` |

**0 `<h1>` manuel `text-2xl` restant dans `(app)`. 9 fichiers importent `PageHeader` (6 → 9).**

### D-02 — Hiérarchie typo : décision CONSCIENTE

Promotion ciblée des **textes de lecture courante** `text-xs` → `text-sm`/`text-base` :

- **Fiche patient `[id]/page.tsx`** : « Né(e) le », téléphone, adresse, préférences → `text-base`.
- **Help text de formulaires** (corps de lecture) : `patient-form-fields` (5×), `patient-form-sections` (1×), `override-tarif-modal` (2×), `ride-patient-picker` (2×), `address-picker-field` (2×) → `text-sm`.
- **Descriptions de panneaux** : `driver-positions-panel` (description `text-xs` → `text-sm` ; empty state `text-sm` → `text-base`).
- **Lien CTA** : `optimization-shell` lien `/admin/maintenance` `text-xs` → `text-sm`.
- **Titre de panneau** : `excluded-rides-section` `text-sm` → `text-base` (aligné autres titres).

**Tables denses NON touchées** (cockpit courses-table, caisse) — densité régulatrice assumée (DEC-101 §5bis).

### D-03 — Convention kicker harmonisée

`tableau-de-bord` (2 titres) passés de `text-sm font-semibold uppercase` → `text-xs font-semibold uppercase tracking-wide` (pattern majoritaire Linear/Stripe). La famille Régulation a maintenant **UNE seule convention** de kicker.

### Résultats mesurables (avant → après reprise)

| Classe | Avant (post-#248) | Après | Δ |
|---|---|---|---|
| `text-2xl` | 7 | **4** | -3 (h1 manuels remplacés) |
| `text-base` | 8 | **15** | **+88 %** ← vrai texte de lecture promu |
| `text-sm` | 115 | 126 | +9 (ex-xs montés) |
| `text-xs` | 87 | **73** | **-16 %** ← corps de texte mal employé en xs réduit |

**Gradation de taille désormais visible** entre corps de lecture (`text-base`/`text-sm`) et légende (`text-xs`), pas seulement par graisse/casse.

### Validation

- `pnpm typecheck` propre
- `pnpm test` **129/129 verts**
- `pnpm build` vert
- 0 changement de wording, 0 migration BDD, 0 nouvelle dépendance
- DEC-101 §5bis respectée (CONTRASTE par propriété taille + graisse + uppercase + tracking)
- Tables denses préservées (densité assumée, direction §5bis)

**Pas d'ADR** : activation et complétude de pattern (DEC-101 §5bis levier 2). Aucun choix structurel nouveau. DEC-103 LOCKED.

## 2026-06-05 — Phase 06.24 livrée localement (incarnation Régulation lot 1 : PageHeader + hiérarchie typo)

Phase 06.24 « Incarnation Régulation lot 1 » cadrée + exécutée. **Premier lot d'incarnation de la direction artistique DEC-101** sur la famille Régulation. Pose la GRAMMAIRE fondatrice : hiérarchie typographique exprimée + en-tête unifié sur tous les écrans cœur métier. Sans cette grammaire, le reste se poserait sur du sable.

### D-01 — PageHeader unifié sur 6 écrans (app)

| Écran | Migration |
|---|---|
| `cockpit/_components/cockpit-content.client.tsx` | `<header>` manuel → `<PageHeader title="Ma journée" description=… actions={<><Button>Optimiser la journée</Button><RealtimeStatusBadge/></>}>` |
| `courses/page.tsx` | `<PageHeader title="Courses" description={Cmd+K} actions={<HeaderNewRideButton />}>` |
| `courses/caisse/page.tsx` | `<PageHeader title="Caisse" description="Encaissements de la journée…">` |
| `patients/page.tsx` | `<PageHeader title="Patients" actions={<><HeaderNewRideButton /><Button>Nouveau patient</Button></>}>` |
| `patients/[id]/page.tsx` | `<PageHeader title={\`${p.nom} ${p.prenom}\`} actions={<Button>Modifier</Button>}>` |
| `tableau-de-bord/page.tsx` | `<PageHeader title="Tableau de bord" description={période}>` |

**Préservation EXACTE** : titres humains, descriptions, actions (boutons + badges). Aucun changement de wording. Replacement 1:1 du `<h1 className="text-2xl font-semibold tracking-tight">` manuel — mêmes classes finales sur le h1 grâce au composant.

### D-02 — Hiérarchie typographique exprimée

Standardisation du pattern « kicker » (étiquette de section) sur `text-xs font-semibold uppercase tracking-wide` :

- **6 fichiers patients** harmonisés (était `text-sm font-semibold uppercase` sans `tracking-wide`) : `patient-form-note`, `patient-drawer-sections`, `patient-form-constraints`, `patient-form-sections`, `recurrences-section`, `patients/[id]/page.tsx`.
- **Cockpit `alerts-panel`** aligné `text-sm` → `text-xs` pour cohérence.
- **Titres de panneaux** (`text-base font-semibold` pour « Carte des chauffeurs », « Patient absent » modale) **conservés** — représentent un niveau intermédiaire légitime.

**Gradation visible obtenue** :

| Niveau | Pattern | Usage |
|---|---|---|
| Titre page | `text-2xl font-semibold tracking-tight` | PageHeader (1× / page) |
| Titre panneau | `text-base font-semibold` | « Carte des chauffeurs », « Patient absent » |
| Kicker section | `text-xs font-semibold uppercase tracking-wide` | « Alertes », « Identité administrative »… |
| Body lecture | `text-sm` ou `text-base` | descriptions, paragraphes |
| Légende / méta | `text-xs` | compteurs, dates, montants tabular-nums |

C'est le **CONTRASTE par propriété** (taille + graisse + uppercase + tracking) plutôt que par seule taille qui répare la sensation « plate ». Pattern shadcn/Linear standard, cohérent avec la direction DEC-101 §5bis levier 2.

### D-03 — Discipline de périmètre

Pas de couleur (terracotta = lot 3), pas de skeleton/empty (lot 4), pas de refactor courses (lot 5), pas de rangement (lot 6). Lot 1 = typo + en-tête UNIQUEMENT.

### Validation

- `pnpm typecheck` propre
- `pnpm build` vert (28 pages)
- `pnpm test` **129/129 verts** (aucun test cassé)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 `<h1 className="text-2xl">` manuel restant sur les 6 écrans cibles
- 6 fichiers (app) importent `PageHeader`
- 0 migration BDD, 0 changement de wording, 0 nouvelle dépendance

**Pas d'ADR** : activation d'un composant existant + pattern shadcn. DEC-102 LOCKED.

### Hors scope V1

- `patients/new/page.tsx` — formulaire création (hors liste)
- `patients/[id]/edit/page.tsx` — formulaire édition (hors liste)
- `cockpit/optimisation/optimization-shell.client.tsx` — sous-écran (hors liste)

À traiter dans un lot ultérieur si pertinent.

## 2026-06-05 — Gel de la direction artistique (DEC-101)

Direction artistique TAP gelée comme **document fondateur du design-system** : `docs/design-system/00-direction.md`. Le design-system documentait jusqu'ici le COMMENT (tokens, data-tables, page-header) sans le POURQUOI — ce manque est comblé. Le document gouverne toutes les décisions UI futures et l'incarnation famille par famille à venir.

**Validé en discuss 2026-06-05** :
- **Personnalité** : sobre / confiant / situé. Outil de métier sobre et dense, à la rigueur institutionnelle, réchauffé d'une touche réunionnaise discrète.
- **Couleur signature** : bleu institutionnel dominant (`hsl(217 92% 32%)`, gardé « dans la famille » du Département **sans calage pixel**) + terracotta accent du moment-clé (`hsl(14 78% 55%)`) + crème chaud (`hsl(45 100% 98%)`) sur PWA chauffeur + sémantiques (succès / alerte / erreur).
- **Règle d'or** : « une couleur fait le travail ». Terracotta = couleur du moment-clé, JAMAIS décoratif. Cap **near-monochrome + une couleur signature rare**, gravé **60-30-10** + échelle neutre 6-10 paliers.
- **Le near-monochrome ≠ absence de structure.** Quand la couleur ne hiérarchise plus, la STRUCTURE doit tout porter. 5 leviers, sans couleur : espacement = relation (Gestalt), **hiérarchie typographique** (taille + graisse — faiblesse n°1 de TAP), alignement et grille (8px), profondeur subtile (ombres douces), frontières avec parcimonie. S'applique à TOUT (écrans, composants, navigation, code).
- **Structure inter-écrans (architecture de l'information)** : URL reflète la hiérarchie, une famille = un domaine cohérent, nav par rôle, profondeur ≤ 2-3 niveaux pour les tâches fréquentes, nommage = vocabulaire métier. Incohérences relevées (Caisse niveau/URL, argent à 2 endroits, Chauffeurs inter-familles) à arbitrer EN CONTEXTE pendant l'incarnation de la famille concernée.
- **Grammaire d'animation** sourcée Material/NN-g : desktop 150-200 ms, ease-out référence `cubic-bezier(0.0, 0.0, 0.2, 1)` pour apparition/feedback, ease-in-out pour navigation, ≤ 2 effets distincts par écran, `prefers-reduced-motion` respecté.
- **Boussole d'inspiration** : Linear (densité) tempéré Frappe « Espresso » (anti-distraction métier).

**Faiblesses tracées à résoudre** (chantiers d'incarnation) :
1. Hiérarchie typo écrasée (305 `text-sm` / 133 `text-xs`).
2. `PageHeader` absent du cœur métier (cockpit / courses / patients / tableau-de-bord) — 16 fichiers admin uniquement.
3. `loading.tsx` (2/25), empty states (12), skeletons (11) inégaux.
4. Raccourcis clavier localisés (modales seulement).
5. Couleur signature dormante (terracotta 2 usages, tint crème invisible).
6. Grille de page hétérogène.

**Méthode d'incarnation** : famille par famille, ordre métier (Régulation d'abord, plus fort ROI), friction log déduit du code par l'audit + enrichi des retours dirigeant. Geler ensuite dans tokens et composants (terracotta = variant « action-clé » de Button, en-tête = composant imposé).

**Document complémentaire livré** : `docs/design-system/08-horizon-open-source.md` (comparatif Frappe / Twenty / Cal.com / Fleetbase / Linear + cadrage chromatique chiffré RETEX 2026 : 60-30-10, palette fonctionnelle, navy = autorité, orange = accent pas primaire, neutre chaud 2026).

**Lien ajouté** en tête de `docs/design-system/01-foundations.md` : « Lire d'abord : 00-direction.md — le pourquoi du design. »

**Pas d'ADR** (document de direction artistique, pas d'architecture technique). DEC-101 LOCKED dans `PROJECT.md`.

## 2026-06-05 — Phase 06.23 livrée localement (audit DEC-041 + tests métier — bloc pré-prod COMPLET)

Phase 06.23 « Durcissement couche données » cadrée + exécutée. **Clôt la dette DEC-041 reportée Phase 06** et ferme les angles morts mesurés des modules métier critiques. Avec cette PR, le **bloc améliorations pré-prod RETEX 2026-06-04 est COMPLET** (5/5) :

| # | Phase | Statut |
|---|---|---|
| 1 | 06.20 Sentry observabilité | ✅ #243 |
| 2 | 06.21 Tests RLS couverture 13→24 | ✅ #244 |
| 3 | 06.22 Error boundaries par segment | ✅ #245 |
| 4 | 06.23 Audit DEC-041 + tests métier | ✅ **cette PR** |

### Volet A — Audit complet DEC-041 (24 SA)

11 vrais trous comblés sur 24 Server Actions à mutations :

| Action | Avant | Après |
|---|---|---|
| `(auth)/accept-invite` UPDATE driver_invitations | ❌ | ✅ |
| `(auth)/accept-invite` UPDATE drivers | ❌ | ✅ |
| `(app)/courses/assignment::assign` | ❌ | ✅ |
| `(app)/courses/assignment::assignVehicle` | ❌ | ✅ |
| `(app)/courses/assignment::unassign` | ❌ | ✅ |
| `(app)/courses/payment` | ❌ | ✅ |
| `(admin)/admin/legal/dpia::update` | ❌ | ✅ |
| `(admin)/admin/legal/breaches::close` | ❌ | ✅ |
| `(admin)/admin/legal/dpo::save` | ❌ | ✅ |
| `(admin)/admin/legal/requests::token` | ❌ | ✅ |
| `(admin)/admin/legal/requests::updateStatus` | ❌ | ✅ |
| `(admin)/admin/legal/_actions/cgu-accept` | ❌ | ✅ |
| `(admin)/admin/sms-templates::update` | ✅ déjà | ✅ |

Plus 2 N/A documentés :
- `setup/actions` : `url.searchParams.delete` = string ops, pas de mutation BDD.
- `(public)/legal/request/[token]` : `createAdminClient` = service_role bypass RLS légitime (portail patient).

Pattern : `.select('id')` + `if (!data || data.length === 0) return { error: '… refusée — droits insuffisants ou … absente.' }`. Comportement métier inchangé (D-A2).

### Volet B — Tests ciblés angles morts métier

`pnpm exec vitest run --coverage` → identification des branches non couvertes. 3 fichiers de tests / 11 nouveaux tests CIBLÉS (pas de gonflage cosmétique) :

- **`solve-local.edge-cases.test.ts`** (4 tests) : 1 course seule (preFilterRides early return), extension n=3 quand `places_assises ≥ 3`, extension bloquée si capacity dépassée, course TPMR rejetée pendant extension sur véhicule taxi.
- **`geocode-safety-net.edge-cases.test.ts`** (2 tests) : coords sans citycode → null normalisé, BAN citycode vide string → null.
- **`scrub.edge-cases.test.ts`** (5 tests) : tableau d'objets sensibles, `request.query_string` filtré, `request.data` scrubbé récursif, récursion bornée à 6 niveaux sans crash, primitives non-string préservées.

### Couverture branches

| Module | Avant | Après | Δ |
|---|---|---|---|
| `@tap/pricing` | 100 % | 100 % | maintien |
| `@tap/recurrence` | 100 % | 100 % | maintien |
| `lib/optimizer/solve-local.ts` | 90.74 % | **92.42 %** | +1.68 pp |
| `lib/geocoding/geocode-safety-net.ts` | 84.61 % | **100 %** | +15.39 pp |
| `lib/sentry/scrub.ts` | 61.29 % | **77.14 %** | +15.85 pp |

### Validation

- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, Serwist SW vert)
- `pnpm test` **129/129 verts** (+11 nouveaux : 4 solve-local + 2 geocode-safety-net + 5 scrub)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 migration BDD, 0 policy modifiée, 1 nouvelle devDep (`@vitest/coverage-v8`)

**Pas d'ADR** : complétude de patterns/qualité actés (DEC-041 + DEC-013). DEC-100 LOCKED.

## 2026-06-05 — Phase 06.22 livrée localement (error boundaries par segment)

Phase 06.22 « Error boundaries par segment » cadrée + exécutée. **Troisième et dernière amélioration technique pré-prod priorité haute (RETEX 2026-06-04)**. Le bloc priorité haute pré-prod est désormais complet (Sentry + tests RLS + error boundaries).

Avant cette phase : 1 seul `error.tsx` segmenté (tableau-de-bord) + `global-error.tsx` root (06.20). Crash sur cockpit/conduite/admin/public/auth → boundary root (UI brutale) ou écran blanc. Avec Sentry installé (06.20), les boundaries existantes ne remontaient PAS l'erreur — corrigé.

**Composants livrés** :

- `apps/web/src/components/error/segment-error.client.tsx` — gabarit commun. Capture `Sentry.captureException(error, { tags: { segment } })` au mount. UI dégradée `role="alert"` + `aria-live="assertive"` + `autoFocus` sur le bouton Réessayer. Stack visible UNIQUEMENT en dev via `<details>` (jamais en prod). Tokens 06.14 (0 hex). 0 dépendance lourde (pas d'icône Lucide — robustesse si chunk manquant). 5 tests Vitest.

- 5 nouveaux fichiers `error.tsx` aux 5 segments majeurs :
  - `(app)/error.tsx` — régulation
  - `(admin)/error.tsx` — administration
  - `(auth)/error.tsx` — connexion (ne bloque pas la reconnexion)
  - `(public)/error.tsx` — pages légales / publiques
  - `(driver)/error.tsx` — PWA chauffeur générique

- 2 boundaries sous-segments critiques :
  - **`(driver)/conduite/error.tsx`** — terrain offline. Message rassure : « Vos pointages sont sauvegardés sur l'appareil et seront synchronisés au retour du réseau. Aucun pointage n'est perdu. » Bouton Réessayer = `reset()` Next 15 (re-render local, **0 dépendance réseau**), fonctionne offline.
  - **`(app)/cockpit/error.tsx`** — régulatrice 8h/j. Message : « Vos courses et alertes ne sont pas perdues. Réessayez pour rouvrir le cockpit ; la régulation reprendra le contexte courant. »

- Upgrade `(app)/tableau-de-bord/error.tsx` vers le gabarit commun (capture Sentry **ajoutée** — manquait avant 06.22).

**Couverture finale** : 8 fichiers boundary (root + 5 segments + 2 sous-segments + 1 conservé upgraded).

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, Serwist SW vert)
- `pnpm test` **118/118 verts** (+5 nouveaux : segment-error.test.tsx)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- 0 migration BDD

**Pas d'ADR** : activation pattern Next 15 standard. DEC-099 LOCKED.

## 2026-06-05 — Phase 06.21 livrée localement (tests RLS — couverture 13→24 tables)

Phase 06.21 « Tests RLS — couverture complète » cadrée + exécutée. **Deuxième amélioration technique pré-prod RETEX 2026-06-04**. Infra pgTAP déjà en place (CI `supabase test db`, version épinglée 2.98.2 dans `.github/workflows/ci.yml`) — seule la couverture manquait. 24 tables avec RLS, 13 couvertes avant, **11 trous comblés ici**.

**Tables couvertes (11) par sensibilité** :

*Critique — santé / traçabilité patient (3)* :
- `ride_events_rls.sql` — événements/traçabilité des courses (10 vérifs)
- `ride_recurrences_rls.sql` — séries de transport patient (10 vérifs)
- `ride_recurrence_exceptions_rls.sql` — exceptions de séries (8 vérifs)

*Important — RGPD / légal / métier (6)* :
- `cgu_acceptance_rls.sql` — isolation par `profile_id` (PAS par org) (7 vérifs)
- `cookie_consent_log_rls.sql` — `service_role` ONLY (4 vérifs)
- `legal_request_attempts_rls.sql` — `service_role` ONLY (3 vérifs)
- `tariff_grids_rls.sql` — versionnement strict DEC-057 (8 vérifs)
- `sms_messages_rls.sql` — SELECT same_org, écriture service_role (5 vérifs)
- `sms_templates_rls.sql` — référentiel partagé, UPDATE dirigeant (6 vérifs)

*Mineur — référentiels (2)* :
- `pois_metier_rls.sql` — CRUD régulateur/dirigeant (7 vérifs)
- `holidays_974_rls.sql` — référentiel public 974 (4 vérifs)

**Méthode** :
- Gabarit `rides_rls.sql` (Phase 2 Plan 02-02) réutilisé : fixtures Org Alpha `1111…` / Bravo `2222…`, rôles fixés (alpha-dirigeant `aaaa…`, alpha-régulateur `cccc…`, bravo-régulateur `dddd…`, alpha-chauffeur `ffff…`).
- Lecture des policies de CHAQUE table AVANT écriture du test (D-02 : comportement réel, pas générique copié).
- Vérifs standard couvrant les rôles attendus : RLS activée (+ forcée si posée), isolation cross-tenant, WITH CHECK, isolation par rôle, anon refusé.

**Aucune policy modifiée (D-04 strict)** :
- 3 observations `force row level security` non posé tracées en commentaire dans les tests (`ride_events`, `tariff_grids`, `sms_messages`). Pas des trous : rôle `authenticated` ne contourne pas RLS. Choix conservé.
- Aucun trou de sécurité réel détecté — toutes les policies font ce qu'elles disent.

**Validation** :
- `supabase test db` validé en CI (CLI Supabase non dispo localement, mais infra CI épinglée 2.98.2 existe déjà).
- 11 nouveaux fichiers de test (rangés en critique → important → mineur).
- 0 policy modifiée, 0 migration BDD.
- Couverture RLS : **13 → 24 tables** sur 24 tables avec RLS.

**Pas d'ADR** : activation d'un choix de qualité acté (DEC-002 / DEC-013 renforcés). DEC-098 LOCKED.

## 2026-06-05 — Phase 06.20 livrée localement (observabilité Sentry, zéro PII santé)

Phase 06.20 « Observabilité Sentry » cadrée + exécutée. **Première amélioration technique pré-prod RETEX 2026-06-04**. Sentry est dans la stack figée DEC-003 mais n'avait jamais été installé : 33 `console.error` partaient dans le vide en prod, debug à l'aveugle. Activation sans nouvel ADR (choix déjà acté).

**CONTRAINTE CRITIQUE — données de santé** : Sentry ne reçoit JAMAIS de PII patient.

**Composants livrés** :

- `apps/web/package.json` : `@sentry/nextjs` `^8.42.0` (résolu 8.55.2).
- `apps/web/next.config.mjs` : `export default withSentryConfig(withSerwist(nextConfig), { … })`. `errorHandler` non bloquant si upload source maps bute. `tunnelRoute: '/monitoring'` (anti-adblock). `hideSourceMaps: true`.
- `apps/web/instrumentation-client.ts` : `Sentry.init` client. **`sendDefaultPii: false`**. `enabled` que en prod. `tracesSampleRate` 1.0 preview / 0.1 prod. Replay OFF (laissé en commentaire avec `maskAllText: true` + `blockAllMedia: true` si réactivé). `onRouterTransitionStart = Sentry.captureRouterTransitionStart`. `beforeBreadcrumb` retire les query strings URL fetch/xhr.
- `apps/web/sentry.server.config.ts` : init Node runtime, scrubbing.
- `apps/web/sentry.edge.config.ts` : init Edge runtime, scrubbing.
- `apps/web/instrumentation.ts` : `register()` qui import server/edge selon `NEXT_RUNTIME`. **`export const onRequestError = Sentry.captureRequestError`** (capte RSC + Server Actions Next 15 — sans ça, warning build + erreurs serveur perdues).
- `apps/web/src/lib/sentry/scrub.ts` : helper partagé `sentryBeforeSend`. Retire les clés sensibles (NIR / nom / prénom / adresses / téléphone / email / date_naissance / tokens / password) récursivement (depth 6) dans extras / contexts / tags / breadcrumbs. Headers `Cookie` / `Authorization` / `X-Supabase-Auth` masqués. Query strings URL retirées. User → `id` auth seul. **6 tests Vitest**.
- `apps/web/src/app/global-error.tsx` : Client Component obligatoire Next 15. Définit son propre `<html>/<body>`. `Sentry.captureException(error)` dans `useEffect`. UI dégradée (texte + lien retour accueil), pas d'écran blanc.
- `api/optimizer/route.ts` + `lib/geoloc/record-position.ts` : `Sentry.captureException` ajouté dans les catch existants AVANT le retour d'erreur (ne change pas le comportement métier).
- `turbo.json` `globalEnv` étendu : `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `CI`, `GEOLOC_ENABLED` (oubli Phase 10.0).
- `.env.example` : section Sentry documentée (dev sans DSN fonctionne) + `GEOLOC_ENABLED`.
- `package.json` racine : `pnpm.overrides` étendu de `next: 15.5.19` pour dédup les types entre la variante `+@opentelemetry/api` (pulled par Sentry) et la variante de base. Résout l'erreur TS de double Next 15.

**Correctif lint hérité 10.0** : `use-driver-positions.ts` avait des NBSP littéraux U+00A0 dans les template literals (typographie française devant unités). Remplacés par une constante `const NBSP = ' '` + `${NBSP}` dans les templates pour passer `no-irregular-whitespace`.

**Validation** :
- `pnpm typecheck` propre (après ajout `next: 15.5.19` dans overrides pour dédup)
- `pnpm build` vert (28 pages, middleware 93.8 kB, Serwist SW vert, Sentry tunnel `/monitoring`)
- `pnpm lint` clean (10 warnings préexistants hors périmètre)
- `pnpm test` **113/113 verts** (+6 nouveaux : scrub.test.ts)
- 0 migration BDD
- 1 nouvelle dépendance (`@sentry/nextjs`) — déjà dans stack figée DEC-003, **pas de nouvel ADR**

**Note dirigeant (hors repo)** : configurer côté Vercel Project Settings → Environment Variables : `NEXT_PUBLIC_SENTRY_DSN` (public), `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (CI / source maps). Aucune intervention en local : dev sans DSN no-op.

## 2026-06-05 — Phase 10.0 livrée localement (prototype géoloc terrain + UI/UX, données fictives)

Phase 10.0 « Prototype géoloc » cadrée + exécutée dans une seule PR. Prépare le socle géoloc (fonctionnel + UI/UX cockpit + flow chauffeur) sur données FICTIVES, pré-HDS. Aucune vraie position persistée tant que `GEOLOC_ENABLED ≠ 'true'`.

**Principe directeur (RETEX devs)** : capture **événementielle** aux pointages, **pas de suivi temps réel continu**. Raison vérifiée : le continu est techniquement impossible à garantir en PWA (la capture s'arrête dès que le chauffeur ouvre Waze/Maps ou éteint l'écran). Le cockpit affiche la dernière position connue + son âge (« vu il y a X min »), **jamais un faux « live »**. Mode démo = positions STATIQUES (aucune animation, aucun simulateur de déplacement).

**Composants livrés** :

- Migration `supabase/migrations/20260605000001_driver_positions.sql` : table `driver_positions` (`id`/`organization_id`/`driver_id`/`ride_id`/`lat`/`lng`/`accuracy`/`captured_at`/`source check('event','foreground','demo')`), index `(driver_id, captured_at desc)`, RLS (régulateur/dirigeant lisent leur org, chauffeur lit + INSERT sa propre position), fonction `purge_driver_positions()` rétention 90j câblée (schedule pg_cron NON activé tant que pré-HDS).
- `packages/shared/src/validators/driver-position.ts` : `driverPositionInputSchema` zod partagé (`lat`/`lng`/`accuracy` tous optionnels, bornes ±90/±180/0-100k) + constante `POSITION_MAX_ACCURACY_M = 100`.
- `apps/web/src/lib/geoloc/record-position.ts` : helper serveur `recordDriverPosition` gardé par flag `GEOLOC_ENABLED='true'` (pré-HDS = OFF). Non bloquant : toute erreur INSERT loggée, ne fait jamais échouer le pointage.
- `apps/web/src/lib/geoloc/capture-current-position.client.ts` : helper client navigateur, `enableHighAccuracy: true`, `timeout: 8s`, `maximumAge: 5s`, filtre `accuracy ≤ 100m`, refus permission = `{}` (pointage non bloqué).
- Routes `api/driver/rides/[rideId]/{start,end,no-show}` : `.merge(driverPositionInputSchema)` sur les 3 schémas + appel `recordDriverPosition(source='event')` après mutation métier.
- `ride-actions.client.tsx` : `captureCurrentPosition()` AVANT le POST, body et payload enqueue offline-first étendus avec lat/lng/accuracy.
- `apps/web/src/components/map/map.client.tsx` : composant Map MapLibre + protocole PMTiles. Détection `HEAD` du fichier `/tiles/reunion.pmtiles` ; fallback OSM raster + attribution si absent (preview sans extract bundlé). `role="region"` + `aria-label` (a11y).
- `apps/web/src/app/(app)/cockpit/_lib/use-driver-positions.ts` : hook Realtime calqué sur `use-cockpit-rides`, canal `cockpit:driver_positions`. Garde `Map<driverId, position>` = dernière connue. Helpers `formatPositionAge()` (« vu il y a X min », typographie française NBSP devant unités) + `positionTone()` (primary < 5 min, muted ≥ 5 min). 6 tests Vitest.
- `apps/web/src/app/(app)/cockpit/_components/driver-positions-panel.client.tsx` : panneau cockpit, carte + marqueurs (tone selon fraîcheur) + liste textuelle accompagnante (a11y) + badge « DÉMO » si au moins une position est `source='demo'`. Auto-refresh âge toutes les 30s.
- `apps/web/src/app/(driver)/conduite/_components/geoloc-consent-banner.client.tsx` : banner consentement chauffeur dismissable (localStorage `geoloc:consent-ack`), information capture aux pointages + service only + 90j max.
- `supabase/seed.demo.sql` étendu : 3 positions fictives sur les 3 chauffeurs démo (Saint-Denis 2 min, Saint-Pierre 15 min, Saint-Benoît 80 min). Statiques. Source `'demo'`.

**Différé (D-04 watchPosition opportuniste)** : non livré V1. Le socle évènementiel couvre 80% du besoin cockpit. Ajout `watchPosition`/`clearWatch` à une itération ultérieure (garde-fous batterie/permission).

**RGPD câblé** : information préalable chauffeur ✓, service only ✓ (pas de watch automatique en V1), rétention 90j câblée ✓ (cron activé Phase 09). Aucune vraie capture persistée tant que pré-HDS (flag OFF).

**Dépendances** : `maplibre-gl@^4.7.0` + `pmtiles@^3.2.0` ajoutées. ADR-012 « MapLibre GL + PMTiles » justifie le choix (alternatives Mapbox/Leaflet/OpenLayers évaluées, rejetées).

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (Serwist SW vert, MapLibre bundle inclus, 28 pages)
- `pnpm test` **107/107 verts** (+6 nouveaux : use-driver-positions)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- 1 migration BDD ajoutée (cohérente avec `git diff supabase/migrations/`)
- ADR-012 + DEC-096 LOCKED

## 2026-06-05 — Phase 06.9 close (correctif mdx 5→6 + turbo env)

Correctif post-merge PR #238 sur la Phase 06.9. Le downgrade `next-mdx-remote` 6.0.0 → 5.0.0 effectué en PR #238 était **injustifié sur le diagnostic** : la version 6.x ne requiert PAS React 19 (peerDep `react: ">=16"`, devDep `react: ^18.2.0`), et la 5.0.0 est signalée vulnérable RCE par Vercel. La version 6.0.0 est saine, récente (2026-02), et c'est celle qui était en place avant 06.9.

**Correctif appliqué** :
- `apps/web/package.json` : `next-mdx-remote: "5.0.0"` → `"^6.0.0"`.
- `package.json` racine : ajout `pnpm.overrides` épinglant `react: 18.3.1`, `react-dom: 18.3.1`, `@types/react: 18.3.5`, `@types/react-dom: 18.3.0` (dédup hoisting pnpm).
- `apps/web/src/app/(public)/legal/_lib/load-legal.tsx` → renommé `.ts`, `<MDXRemote>` retiré du helper (cross-bundle React Element entre frontière de module = source du bug SSG). Helper renvoie `{ frontmatter, source }`.
- 5 pages `/legal/{cgu,cgv,confidentialite,cookies,dpo}/page.tsx` : `<MDXRemote source={source} components={legalMdxComponents} />` rendu directement dans le Server Component de la page (pattern recommandé Next 15 + next-mdx-remote@6).
- `turbo.json` `globalEnv` complété : `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CGU_VERSION`, `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `APP_NIR_SEARCH_KEY`, `CRON_APP_TOKEN`, `TWILIO_AUTH_TOKEN` (vérifiés via `grep -rohE 'process\.env\.[A-Z_]+' apps/web/src`). Fiabilise le cache turbo + supprime un warning build.

**Bug SSG résiduel** : même avec mdx@6 + overrides React, le SSG `force-static` sur `/legal/*` crash sur `ReactCurrentOwner` (API React 17 supprimée en 18+ — bug Next 15 + SSG + next-mdx-remote). Non lié à la version mdx. Compromis documenté : `force-dynamic` conservé sur les 5 pages legal (latence négligeable pour pages rarement consultées). SSG laissé pour V2.

**Note dirigeant (hors repo)** : supprimer `OPTIMIZER_USE_MOCK` dans Vercel → Project Settings → Environment Variables (résidu post-06.12, plus aucun caller depuis ADR-010).

**Validation** :
- `node -e "console.log(require('./apps/web/package.json').dependencies['next-mdx-remote'])"` → `^6.0.0`
- `pnpm audit --audit-level high | grep -i mdx` → 0
- `grep 'OPTIMIZER_USE_MOCK' apps/web/src turbo.json` → 0
- typecheck propre, build vert (28 pages, Serwist SW vert)
- `pnpm test` 101/101 verts (aucune régression)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- 0 migration BDD, 0 nouvelle dépendance npm

## 2026-06-05 — Phase 06.9 livrée localement (Next.js 14.2 → 15.5, migration async complète)

Phase 06.9 « Modernisation Next.js 15.5 » cadrée + exécutée dans une seule PR. Phase technique autonome, migration codemod-first, reprise manuelle ciblée.

**Versions** :
- `next` : `^14.2.35` → `^15.5.0` (résolution 15.5.19).
- `next-mdx-remote` : `6.0.0` → `5.0.0` (6.x bundle React 19, incompatible avec React 18 + Next 15 SSG).
- React 18 conservé (`^18.3.1`), `@types/react` 18 inchangés.
- `packages/database` peerDep `next` : `^14.2.35` → `^15.5.0`.

**Migration async** (codemod + manuel) :
- `@next/codemod@canary next-async-request-api .` → 17 fichiers transformés, 0 erreur, 0 `@next-codemod-error` marker.
- Pages serveur dynamiques (`params`/`searchParams`) : 10 fichiers → `Promise<...>` + `await`. Inclut `generateMetadata` de `/conduite/[rideId]`.
- Routes API `[rideId]` : 4 fichiers (`end`, `start`, `no-show`, twilio webhook) → `await params`.
- `cookies()` : `lib/supabase/server.ts:createClient` rendue **async**. Pas de cast `UnsafeUnwrappedCookies` (D-02 interdit).
- **84 sites consommateurs** `const supabase = createClient()` → `await createClient()` (sed automatisé sur 54 fichiers).
- 8 sites `ReturnType<typeof createClient>` rebrandés `Awaited<ReturnType<typeof createClient>>`.
- `headers()` : `admin/chauffeurs/actions.ts:resolveOrigin` rendue `async function`, 2 callers `await resolveOrigin()`.

**Modifs ciblées** :
- `lib/geocoding/ban.ts` : `fetch(url, { cache: 'no-store' })` explicite + commentaire « géocodage = pas de cache, fraîcheur voulue » (D-04). Le `fetch` BAN n'était caché par défaut qu'en Next 14, on rend l'intention explicite vs la rupture du cache `fetch()` Next 15.
- `next.config.mjs` : `typedRoutes: true` au TOP-LEVEL (stable 15.5, a quitté `experimental`).
- `next.config.mjs` : suppression du `async rewrites()` `/api/solver/*` → FastAPI port 8000 (orphelin Phase 06.12, ADR-010 — plus aucun caller).
- `next.config.mjs` : `eslint.ignoreDuringBuilds: true` conservé (D-08, nettoyage CI séparé).

**Incident MDX résolu** :
- Symptôme : prerender `/legal/cgu`, `/legal/cgv` cassait sur « A React Element from an older version of React was rendered ». Cause : `next-mdx-remote@6.0.0` bundle React 19 vs runtime React 18.
- Fix : downgrade 6 → 5 + bascule `compileMDX` (double-sérialisation problématique sous SSG) → `<MDXRemote>` (rendu direct RSC). Rename `_lib/load-legal.ts` → `.tsx` pour le JSX.
- Compromis : `export const dynamic = 'force-dynamic'` sur les 5 pages `/legal/*`. Pages servies à la demande, latence négligeable. SSG laissé pour V2 quand React 19 + ADR-007 sera tranché.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (28 pages, middleware 88.7 kB, Serwist SW vert)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- `pnpm test` 101/101 verts (aucune régression sur les tests Vitest existants)
- `grep -rn next-codemod-error apps/web/src` = 0 (validation D-03)
- `grep 'UnsafeUnwrapped' apps/web/src` = 2 occurrences uniquement dans des commentaires expliquant qu'on N'utilise PAS ces casts (D-02)
- `node -e "console.log(require('./apps/web/node_modules/next/package.json').version)"` → `15.5.19`
- 0 migration BDD

**Documentation** :
- ADR-011 « Next.js 15.5 + Request APIs async » créé, complète ADR-007 (stratégie versions stack).
- DEC-095 LOCKED dans STATE.md.
- CONTEXT.md Phase 06.9 dans `.planning/phases/06.9-nextjs-15/`.

## 2026-06-04 (suite) — Phase 06.19 livrée localement (branchement géocodage récurrences + filet serveur)

Phase 06.19 « Branchement géocodage (récurrences + filet serveur) » cadrée + exécutée dans une seule PR. Comble le trou applicatif qui privait `solveLocal` (06.12, livré le même jour) des courses récurrentes — segment **dialyse** = transport le plus mutualisable, donc le plus coûteux à rater.

**État vérifié AVANT** : la table `ride_recurrences` avait déjà les 6 colonnes `pickup_lat/lng/citycode` + `dropoff_*` depuis la migration `20260519000001_ride_recurrences.sql` (Phase 05). Le trou était purement applicatif (`patients/actions/recurrences.ts` schéma Zod + INSERT ignoraient ces colonnes). **0 migration BDD ajoutée**.

**Composants nouveaux** :
- `apps/web/src/lib/geocoding/geocode-safety-net.ts` — helper partagé `geocodeIfMissing(address, lat, lng, citycode)`. Idempotent (court-circuit si coords présentes), non bloquant (BAN down → null), pure pour le test. 6 tests Vitest.
- `apps/web/src/lib/recurrence/build-rides-payload.ts` — pure helper de transformation occurrences → INSERT rides[]. Propage les coords du template à chaque ride générée. Extrait pour testabilité. 5 tests Vitest.

**Modifs schémas / Server Actions** :
- `patients/actions/recurrences.ts` : Zod `baseSchema` étendu de 6 champs coords (`numericFromString` + bornes lat ±90 / lng ±180 / citycode max 10), `BASE_KEYS` factorisée, `createRecurrenceAction` + `updateRecurrenceAction` appellent `geocodeIfMissing` avant INSERT/UPDATE et persistent les coords sur `ride_recurrences`. `regenerateOccurrencesFor` reçoit les coords pour propagation. Helper local supprimé au profit du module partagé.
- `courses/actions/create.ts` : `createRideAction` appelle `geocodeIfMissing` avant INSERT (filet pour saisies sans picker — seed, API tierce, brouillons texte libre). Helper local supprimé au profit du module partagé.

**UI** :
- `recurrence-create-modal.client.tsx` : 2 `<Input>` remplacés par 2 `<AddressOrPOIPicker>` (pickup + dropoff). State coords pour threading. Submit pose les 6 champs coords dans FormData. Reset complet au close. Bouton submit désactivé si adresse vide.
- `recurrence-edit-modal.client.tsx` : idem + initialisation des coords state depuis `recurrence.pickup_lat/lng/citycode` (déjà chargées via `RideRecurrence` row).
- `optimization-shell.client.tsx` (cockpit) : empty state coords-vides reformulé « X course(s) exclue(s) faute de coordonnées géographiques » + lien `/admin/maintenance`.

**Backfill `/admin/maintenance/actions.ts`** : `backfillRideGeocodingAction` étendu de 3 passes :
1. Pass 1 (existant) : `rides` avec `pickup_lat IS NULL` (MAX_PER_RUN = 200, rate-limit 1 req/s).
2. Pass 2 (nouveau) : `ride_recurrences` actives avec `pickup_lat IS NULL` → géocode + UPDATE template.
3. Pass 3 (nouveau) : propagation aux occurrences futures non démarrées (`validee` + `assignee`, `scheduled_at > now`, `pickup_lat IS NULL`) — cohérent avec la cascade DEC-048 qui préserve courses `en_cours` / `terminee` / `annulee`.

Audit log enrichi du compteur `recurrences_processed`. Idempotent, dirigeant only.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- `pnpm test` 101/101 verts (+11 nouveaux : 6 geocode-safety-net + 5 build-rides-payload). Tous les tests Vitest existants restent verts.
- `git diff main --name-only | grep '^supabase/migrations/'` = 0 ligne (aucune migration ajoutée).
- 0 nouvelle dépendance npm.

**Pont vers 06.12** : le bénéfice est immédiat. Les récurrences dialyse étaient le scénario où `solveLocal` (heuristique cluster-first/route-second) trouvait théoriquement le plus de gain — fenêtres temporelles serrées, horaires quasi-fixes, mêmes destinations partagées par plusieurs patients. Avec coords remplies, `transform.ts` (`ridesToSolveRequest`) ne les exclut plus pour `no_coordinates`, et `solveLocal` peut grouper. Le ROI de la phase est entièrement porté par 06.12 (livré juste avant).

## 2026-06-04 (suite) — Phase 06.12 livrée localement (solveur heuristique TS natif, OR-Tools/Python/mock supprimés)

Phase 06.12 « Solveur d'optimisation = heuristique TypeScript native » cadrée + exécutée dans une seule PR. Décision tranchée (dirigeant + recherche OR) : abandonner OR-Tools / Python / mock / hébergement séparé. Réécriture en heuristique TS native dans `apps/web/src/lib/optimizer/`. Autoporteur, zéro coût marginal, zéro hébergement externe.

**Motivation (faits)** :
- Volume réel ≤ 500 courses absolu, en pratique quelques dizaines/jour. Le contrat zod plafonne déjà à `rides.max(200)`.
- OR-Tools est calibré pour 1000+ waypoints — disproportionné ; sa lourdeur (binaires C++ ~75 MB) a bloqué l'hébergement Vercel (5 PR de fix Phase 06.7 + 5 PR Phase 06.10), d'où le mock actuel.
- Pour fenêtres temporelles petites + horaires quasi-fixes (dialyse programmée = cas TAP majoritaire), une heuristique greedy cluster-first/route-second est quasi-optimale.
- Indicateurs « estimés » DEC-081 → exactitude non contractuelle.
- Supprime la SEULE vraie barrière (hébergement). Plus de Python, plus de cold start, plus de mock, plus d'hébergeur tiers, plus de plan Vercel Pro à arbitrer.

**Composants nouveaux** :
- `apps/web/src/lib/optimizer/haversine.ts` — port direct des 44 lignes de `solver.py:haversine.py`. `haversineKm()` + `distanceMatrix(coords, correctionFactor)`. 4 tests Vitest.
- `apps/web/src/lib/optimizer/solve-local.ts` (~280 LOC) — heuristique cluster-first/route-second. Pré-filtre fenêtres temporelles (port `_pre_filter_rides`), appariement greedy 2-par-2 sur compat fenêtre + transport_mode→vehicle.type + capacité, ordre nearest-neighbor sur Haversine corrigée, calcul km_a_vide. Export `timeWindow()` testable. 9 tests Vitest portés des 6 scénarios pytest.

**Branchement Route Handler** (D-03) : `apps/web/src/app/api/optimizer/route.ts` point 7 — remplace le bloc `useMock ? mockSolve(payload) : solve(payload, {HTTP})` par un `solveLocal(payload)` synchrone. Conservé : auth Supabase, vérif rôle, dé-identification D-08, `ridesToSolveRequest`, `solveResponseToProposal`, `enrichProposal`, try/catch défensif. Retiré : imports `solve`/`OptimizerError`, `process.env.OPTIMIZER_USE_MOCK`, `VERCEL_URL`/`serviceUrl`, `timeoutMs: 30000`.

**Suppressions** (D-04) :
- `apps/web/py/solver/` (13 fichiers Python : solver.py, _extract.py, haversine.py, models.py, index.py, requirements*.txt, tests/, README.md, pytest.ini) → supprimé intégralement.
- `apps/web/src/app/api/optimizer/_mock-solver.ts` → supprimé.
- `apps/web/vercel.json` : `builds` Python + `routes` `/api/solver/*` retirés (reste un fichier `$schema` minimal).
- `packages/optimizer-client/src/client.ts` (`solve()` HTTP + `OptimizerError`) → vidé. `index.ts` ne re-exporte plus `./client`.
- `packages/optimizer-client/src/__tests__/client.test.ts` (4 tests du client HTTP) → supprimé.
- `apps/web/src/middleware.ts` : commentaire ADR-009 référant à `apps/web/py/solver/` → retiré.

**Contrat préservé** : `packages/optimizer-client/contract.ts` (zod `SolveRequestSchema` / `SolveResponseSchema`) + `transform.ts` (`ridesToSolveRequest`, `solveResponseToProposal`) inchangés. `solveLocal()` produit exactement le même `SolveResponse` qu'OR-Tools. Le frontend `/cockpit/optimisation` ne voit aucun changement.

**Documentation** :
- ADR-010 « Solveur heuristique TS native » créée, supersede ADR-008 (hébergement Vercel Python) + ADR-009 (pattern container long-running).
- DEC-093 LOCKED inscrite dans STATE.md (Decisions).
- Runbook `runbook-bascule-vercel-services-vers-deux-projets.md` rendu sans objet pour le solveur (conservé pour traçabilité ou usage futur).

**Variables d'env devenues obsolètes** (à retirer Vercel post-merge) : `OPTIMIZER_USE_MOCK`, `OPTIMIZER_SERVICE_URL`.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm test` 90/90 verts (+13 nouveaux : haversine 4 + solveur 9 ; -4 retirés client HTTP). 17/17 verts `@tap/optimizer-client` (contract 7 + transform 10).
- `grep -rn 'ortools' apps/web` = 0 référence active.
- `apps/web/py/solver/` = supprimé. `_mock-solver.ts` = supprimé.
- 0 migration BDD, 0 nouvelle dépendance npm.

## 2026-06-04 (suite) — Sync planning post-audit (06.11 + 06.18 + total_phases + DEC-092 abandon 07)

Audit planning passé. Trois corrections + une décision dirigeant en une PR planning-only.

1. **06.11 (Polish produit) cochée** : phase livrée (PR #214-#217, statut détaillé « Complete (2026-06-03) ») mais sa checkbox ROADMAP était restée `[ ]`. Corrigée.
2. **06.18 (Page de connexion) clôturée** : livrée via PR #233 (mergée). Checkbox passée `[x]` avec préfixe livraison.
3. **`total_phases` réaligné 29 → 31** : la ROADMAP comptait 31 lignes de phases mais STATE en déclarait 29 — l'ajout de 06.17 puis 06.18 n'avait jamais été propagé au compteur. Compteurs : 26/31 livrées, 4 ouvertes actives, 1 abandonnée. Percent 84.
4. **DEC-092 — Phase 07 (Mobile natif) ABANDONNÉE** (décision dirigeant 2026-06-04). Motif : la PWA Phase 04.9 couvre le périmètre terrain retenu, le coût natif (10×, 25-40 h) n'est pas justifié au stade actuel. Réversible si business case mobile validé ultérieurement. Conservée en ROADMAP pour traçabilité (marquée `[~]` avec préfixe ABANDONNÉE). Phase 10 (géoloc) reformulée : la référence orpheline à 07 a été retirée, le discuss 10 devra concevoir une solution PWA premier-plan dégradé, pas de fallback natif.

Candidates ouvertes restantes (4) : 06.9 (Next.js 15), 06.12 (réactivation solveur OR-Tools), 09 (HDS), 10 (géoloc temps réel). Pas de suite design « naturelle » — choix dirigeant requis pour la prochaine phase.

## 2026-06-04 (suite) — Phase 06.18 livrée localement (Page de connexion + AuthShell aux normes)

Phase 06.18 « Page de connexion — champs + UI aux normes » cadrée + exécutée dans une seule PR (périmètre léger ~4-6 h). Application directe des normes auth/UI 2025-2026 (NN/G, muz.li 4 problèmes login, web.dev, UX Patterns, anti-autofocus a11y) à `/login` et `/accept-invite`. **Reset MDP exclu** (décision dirigeant).

**Composants nouveaux** :
- `<PasswordInput>` (`apps/web/src/components/form/password-input.client.tsx`) — wrapper `<Input>` avec toggle œil/œil-barré (`Eye`/`EyeOff` lucide), `type={visible ? 'text' : 'password'}`, `aria-label` parlant (« Afficher / Masquer le mot de passe »), `aria-pressed` reflète l'état, `pr-40` pour éviter le chevauchement texte/bouton, `forwardRef` pour compat RHF `register`. W3C ARIA APG. 5 tests Vitest.
- `<ThemeToggle>` (`apps/web/src/components/theme-toggle.client.tsx`) — bouton standalone Sun/Moon, `aria-label` parlant, `aria-pressed` reflète l'état, cible tactile 40 px, focus visible via `--ring`. Posable hors session auth (header form AuthShell). 4 tests Vitest.
- `useTheme()` hook partagé (`apps/web/src/lib/use-theme.client.ts`) — lecture `data-theme` du document + persistance localStorage `theme` (clé compat anti-FOUC `app/layout.tsx`). Consommé par `<ThemeToggle>` ET `UserMenu` → DRY (~20 LOC supprimées de UserMenu).

**Refactor AuthShell en Server Component (D-06)** : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` supprimé → `auth-shell.tsx` (RSC). Le seul îlot client est `<ThemeToggle>` posé dans le header form (bascule jour/nuit avant connexion). Imports redirigés dans 4 pages (`login`, `accept-invite`, `welcome`, `setup`). Commentaires « mode jour uniquement » périmés retirés.

**login-form** : email gagne `inputMode="email"` (D-02 — clavier email mobile). Mot de passe utilise `<PasswordInput>` (D-01). Aucun autofocus (anti-pattern a11y respecté).

**accept-invite-form** : 2 champs password convertis en `<PasswordInput>` avec recomposition manuelle du pattern Field (label + PasswordInput + p#hint OR p#error + aria-describedby) — PasswordInput n'est pas un Input simple, ne s'intègre pas directement à `<Field>`. Import `Field` retiré (lint propre).

**Validation** : `pnpm typecheck` propre, `pnpm lint` clean (9 warnings préexistants hors périmètre), `pnpm test` 77/77 verts (11 fichiers ; +9 nouveaux : PasswordInput 5 + ThemeToggle 4). 0 migration BDD. 0 nouvelle dépendance npm (toutes icônes lucide déjà disponibles). Tokens 06.14 uniquement, 0 hex.

## 2026-06-04 (suite) — Phase 06.17 close (3 PR mergées)

Phase 06.17 « Conformité des champs de saisie » **close** après 3 PR séquentielles mergées : PR #230 (composants communs + véhicule/chauffeur), PR #231 (légal + tarifs + rattrapage défauts places), PR #232 (reste + clôture). **132 champs aux normes UX/a11y** (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG). Composants communs : `<Field>` (hint persistant lié `aria-describedby`, `name` explicite respecté), `<NumberField>` (`type=text` + `inputMode=numeric|decimal`, règle de défaut cohérent counter/optional), `<Combobox>` 100 % maison W3C APG (DEC-003 préservée, sans Radix Popover ni cmdk). Catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case). PR3 : migration `dpia-form`, `dpa-prefill-card`, `dpo-form`, `accept-invite-form` sur `<Field>` + hints d'exemple ; `maxLength` posée sur tous les champs à format (immat=9, NIR=19, tél=14, email=120, version=50, titre=200, mot de passe=128) ; normalisation submit DPA. **0 `type="number"` restant** dans `apps/web/src` (vérifié `grep -rE 'type=\"number\"'`). **23 tests Vitest** verts (Field 5 + NumberField 8 + Combobox 8 + catalog 7) sur 68 tests total. Documenté `docs/design-system/07-form-completion.md`. 0 migration BDD, 0 dépendance npm. Bloc design system 06.13 → 06.17 complet sur 5 phases.

## 2026-06-04 (suite) — Phase 06.17 cadrée + PR1/3 exécutée

Phase 06.17 « Conformité des champs de saisie » cadrée. Périmètre élargi en cours de session : tous les champs du projet (132 sur 50 fichiers) à mettre aux normes UX/a11y (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG), pas un pilote. Découpé en 3 PR séquentielles SOUS la même phase. **PR1 (#230) livrée localement** : composants communs `<Field>` (hint persistant lié `aria-describedby`) + `<Combobox>` éditable 100 % maison W3C APG (DEC-003 préservée, 0 nouvelle dépendance) ; catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case) ; refactor `vehicle-form` (Marque/Modèle comboboxes dépendantes, immatriculation hint format, places en `inputMode=numeric` sans spinner) ; `driver-form` migré sur `<Field>` commun ; normalisation Title Case au submit Server Action véhicule. 60 tests Vitest verts (15 nouveaux : Field 5 + Combobox 8 + catalog 7). Documenté `docs/design-system/07-form-completion.md`. **PR2 prévue** : légal + tarifs (breach-drawer affected_subjects_count défaut 0, registre-fields durée conservation, tariff-edit/simulator/override-tarif montants/distance avec inputMode décimal sans spinner). **PR3 prévue** : dpia/dpa-prefill/accept-invite/dpo (hints d'exemple), audit `patient-form-fields` (gabarit déjà conforme), driver-form téléphone + maxLength, NIR maxLength=15, sync ROADMAP cocher 06.17. 0 migration BDD, 0 dépendance npm.

## 2026-06-04 (suite) — Phase 06.16 cadrée + exécutée

Phase 06.16 « PageHeader admin commun » cadrée + livrée dans une seule PR (périmètre Strict dirigeant). Composant `<PageHeader>` créé (~50 LOC, props title + description + actions + className, 6 tests Vitest verts). 16 pages admin migrées (chauffeurs, facturation, legal, legal/breaches, legal/dpa, legal/dpa/pre-remplir, legal/dpia, legal/dpia/pre-remplir, legal/dpo, legal/registre, legal/registre/pre-remplir, legal/requests, maintenance, sms-templates, tarifs, vehicules). `legal/registre` conserve ses actions `ExportPdfButton` + bouton « Nouvelle entrée » via le slot `actions`. Chrome globale (`(admin)/layout.tsx`, `NavTabs`, `LegalNavMenu`) inchangée. Toolbar recherche/filtres différée (recoupe le tri généralisé du `<DataTable>` laissé en V2). Tokens 06.14 uniquement, 0 hex, 0 dépendance, 0 migration BDD. Documenté en `docs/design-system/06-page-header.md`.

## 2026-06-04 (suite) — Phase 06.15 cadrée

Phase 06.15 « Refonte data tables » cadrée. Décision dirigeant Option 3 (uniformiser les 13 tables sur un composant `<DataTable>` sémantique commun, API extensible tri/pagination prévus mais V1 implémente seulement le tri existant de `caisse-table`). 13 tables incluses (8 `<table>` + 4 `divide-y` + 1 mixte) ; 3 dropdowns de saisie exclus (pas des data tables). Décisions D-01..D-06 LOCKED : composant sémantique, compose primitives existantes (EmptyState/Badge/Skeleton + tokens 06.14), API extensible, logique métier préservée par table, RGAA 4.1.2 + densité DEC-034 + jour+nuit, ROADMAP entrée [ ] = premier acte. Estimation 12-16 h. 0 migration BDD, 0 dépendance npm. PLAN 06.15-01 à écrire ensuite.

## 2026-06-04 — Phase 06.14 cadrée

Phase 06.14 « Migration tokens.json → Tailwind config » cadrée. Entrée ROADMAP posée `[ ]` après 06.13. RESEARCH sourcé (versé en PR #220, mergée) rangé dans le dossier de phase `.planning/phases/06.14-migration-tokens-tailwind/06.14-RESEARCH.md` pour cohérence de structure GSD. STATE + journal mis à jour (06.14 en cadrage). Décisions dirigeant déjà actées : dark généré depuis les tokens (anti-dérive), rester Tailwind v3 (v4 = décision séparée couplée à 06.9). Architecture DTCG du dark à trancher au discuss (Token Sets vs `$value` structuré). Estimation indicative 5-8 h. Périmètre dark chiffré : 12 couleurs sur 57 tokens.

## 2026-06-03 (suite) — Phase 06.13 lancée et livrée

Phase 06.13 « Foundations design system » lancée et livrée en 1 PR documentaire pure. 4 livrables : 01-foundations.md (doctrine WCAG 2.1 AA + RGAA 4.1.2 + conventions visuelles), tokens.json (W3C Design Tokens 2025.10), 02-patterns-emergents.md (5 patterns réutilisables documentés : KpiCard, EmptyState, RideBadge, SlaBadgesCard, HautsBadge), 03-benchmark-foss.md (recherche FOSS méthodique capitalisée en version compacte). DEC-088 doctrine accessibilité, DEC-089 étoile polaire hybride Carbon+Atlassian+NHS, DEC-090 phase 100% documentaire, DEC-091 chantier PDF reporté. Base établie pour phases 06.14+ (migration tokens, refonte tables, refonte settings).

## 2026-06-03 (suite) — Phase 06.11 cadrée

Phase 06.11 « Polish produit » créée et cadrée : CONTEXT + DISCUSSION-LOG + 3 PLAN par wave. Périmètre : Wave 1 tableau dirigeant (A3+A5+A4, HVI 2026 pattern), Wave 2 passe UX optimisation (B2+B3+B9+B7+B6, Solvice + RoadWarrior + tule2236), Wave 3 finition démo (C1+C7). Items A2/B8/C3/C5 explicitement reportés. D4-a side-quest opportuniste inscrit dans CONCERNS.md. Renumérotation : ancienne 06.11 candidate solveur → 06.12 candidate. DEC-084..087 LOCKED. 4 décisions traçables dans le DISCUSSION-LOG. PR cadrage = documentation pure, 0 ligne de code applicatif touchée.

## 2026-06-03 — Phase 06.10 clôturée

5 PR Vercel Python (#208, #209, #210, #212) + 1 PR Wave 2 (#211). Chaîne Python techniquement fonctionnelle, mais walkthrough OR-Tools réel bloqué sur Vercel Hobby (maxDuration 10s). Pipeline geocoding déjà câblé depuis 04.7, scellé par tests. Décision dirigeant : mock activé partout, Phase 06.11 candidate pour réactivation. Enquête open-source `2026-06-03-enquete-patterns-solveur-cout.md` capitalise les 4 patterns d'hébergement viables.

Dettes ouvertes à l'issue : D1 reportée (Phase 06.11 candidate), D2 résolue, D3 et D4 différées.

---

*Journal créé 2026-06-03 lors de la clôture de Phase 06.10. Toute clôture de phase à venir s'inscrit ici en tête.*
