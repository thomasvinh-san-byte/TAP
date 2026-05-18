# Codebase Concerns

**Analysis Date:** 2026-05-12
**Re-mapping update:** 2026-05-13 (refonte planning DEC-023 — god-phase 04 split)

> Inventaire factuel de la dette technique, items reportés, blocages
> sandbox et zones fragiles identifiés à la clôture Phase 03 (E2E Passe
> 1). Sources croisées : code, `.planning/STATE.md`,
> `.planning/PROJECT.md`, `03-SUMMARY.md`, ADRs.

---

## Re-mapping post-DEC-023 (refonte E2E god-phase 04 split)

Les items « Phase de résolution : Passe 2 (Phase 04) » référencés ci-dessous sont **re-mappés** vers la sous-phase appropriée du découpage DEC-023 :

| Item | Phase de résolution avant (Phase 04 god-phase) | Phase de résolution après (DEC-023) |
|------|------------------------------------------------|-------------------------------------|
| Manifest PWA + offline chauffeur | Phase 04 | **Phase 04.9** (PWA enveloppe) |
| Workflow invitation chauffeur | Phase 04 | **Phase 04** (onboarding chauffeur — scope core) |
| Filtrage `type_permis` ↔ `vehicle.type` modal assignation | Phase 04 | **Phase 04.5** (robustesse régulateur) |
| Audit logs nom acteur | Phase 04 | **Phase 04.5** |
| `react-hook-form` non utilisé | Phase 04 ou 05 | **Phase 04** (premier usage `/accept-invite` — DEC-018) |
| Types Supabase non régénérés (5 `TODO(types)`) | Phase 04 | **Phase 04.5** |
| `ride-express-modal.client.tsx` 384L > 300 | Phase 04 | **Phase 04.5** (découpe orchestrateur) |
| `ride-drawer.client.tsx` 337L > 300 | Phase 04 | **Phase 04.5** |
| Showcase Phase 03 — 10 captures à produire | avant Passe 2 | **Phase 04.5** (livraison en retard) |
| UI/UX modal saisie course (polish proportions, espacement) | phase UI/UX dédiée post-Passe 2 | **Phase UI dédiée post-Passe 2** (verrou maintenu) |
| Refonte `/login` + `/welcome` + `/setup` | Phase 04 (livrable 04-B) | **Phase 04** (mode jour) + **Phase UI dédiée** (mode nuit + identité complète) |

## Tech Debt

### Fichiers dépassant la limite CLAUDE.md § 11 (≤ 300 lignes)

**`ride-express-modal.client.tsx` (384 lignes) :**
- Issue : Modal de saisie express dépasse de 84 lignes la limite imposée par CLAUDE.md § 11. Composant condense Dialog Radix + auto-save + parsing date freeform + PatientPicker + 8 champs + tab order.
- Files : `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx`
- Sévérité : **minor** (dette préexistante Phase 2, hors scope clôture Phase 3, non bloquante)
- Phase de résolution : Passe 2 (Phase 04) — découpage sous-composants (DateField, PatientField, ActionsBar)
- Workaround : aucun. Tracée dans `.planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md:187`.

**`ride-drawer.client.tsx` (337 lignes) :**
- Issue : Drawer course dépasse de 37 lignes la limite. Marge devenue fine après ajout du bouton Annuler en clôture-bis Phase 3.
- Files : `apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx`
- Sévérité : **minor** (dette additive Phase 3, ~330 L documentés)
- Phase de résolution : Passe 2 (Phase 04) — extraire `RideDrawerHeader`, `RideDrawerSections`
- Workaround : sections déjà identifiées (header / trajet / mode / assignation / exécution / paiement / historique) — refactor mécanique.

### Dépendance npm installée mais non utilisée

**`react-hook-form` ^7.53.0 :**
- Issue : Package installé dans `apps/web/package.json` mais seul `apps/web/src/components/ui/form.tsx` (wrapper shadcn générique) l'importe. Aucun formulaire applicatif ne l'utilise — Phase 1 (login) et Phase 2 (saisie express) ont choisi `useTransition` + Server Actions sans RHF (cf. commentaire explicite `login-form.client.tsx:Pas de react-hook-form ici`).
- Files : `apps/web/package.json:react-hook-form`, `apps/web/src/components/ui/form.tsx`, `apps/web/src/app/(auth)/login/login-form.client.tsx`
- Sévérité : **minor** (poids bundle ~26 ko gzip pour rien)
- Phase de résolution : Passe 2 (Phase 04) ou Passe 3 (Phase 05) — soit retirer la dépendance + `form.tsx`, soit l'adopter pour les formulaires complexes à venir (cockpit, recurrences). Décision à trancher avant Passe 4.
- Workaround : non bloquant, mais surface "coup mort" à clarifier.

### Casts TypeScript `as never` ponctuels — version skew Supabase

**Cast `as never` dans queries / actions :**
- Issue : 4 generics Supabase `@supabase/ssr 0.5.2` mal alignés avec `@supabase/supabase-js 2.105.3`. Casts forcés documentés à 3 endroits.
- Files : `apps/web/src/app/(app)/patients/actions.ts:149`, `:223`, `apps/web/src/app/(app)/patients/_lib/queries.ts:50`
- Sévérité : **minor** (informationnel — tracé `01-VERIFICATION.md:174`)
- Phase de résolution : V1.5 ou upgrade `@supabase/ssr` compatible 4 generics
- Workaround : casts explicites avec commentaires.

### Types Supabase générés non régénérés

**TODO(types) dans 5 fichiers :**
- Issue : `packages/database/src/types.gen.ts` pas encore régénéré pour les colonnes Phase 1 patients étendues, table `drivers`, colonnes Phase 1 rides. Régénération nightly prévue mais en retard.
- Files : `apps/web/src/app/(driver)/conduite/actions.ts:20`, `apps/web/src/app/(driver)/conduite/actions.ts:48`, `apps/web/src/app/(driver)/conduite/_lib/queries.ts:14`, `apps/web/src/app/(app)/courses/_lib/queries.ts:25`, `apps/web/src/app/(app)/courses/actions/assignment.ts:12`
- Sévérité : **minor** (compile via casts, mais perd la safety nette)
- Phase de résolution : Passe 2 (Phase 04) — relancer `supabase gen types typescript` en CI et commiter
- Workaround : casts ponctuels avec TODO(types).

### Décision ADR-003 non listée dans bloc `<decisions>` PROJECT.md

- Issue : ADR-003 (pivot E2E par passes successives) acté 2026-05-11 et LOCKED dans `docs/adr/`. Pas encore ajouté au bloc `<decisions>` de `PROJECT.md` (16 DEC listés, ADR-003 absent). Risque de désynchronisation source-of-truth → un futur agent croira que la méthode est par modules profonds.
- Files : `docs/adr/ADR-003-pivot-e2e-passes-successives.md` (LOCKED), `.planning/PROJECT.md:114-133` (bloc decisions sans DEC-017)
- Sévérité : **major** (incohérence documentaire structurante — bloque la lisibilité méthode)
- Phase de résolution : Phase 06 lors du nettoyage HDS (planifié dans `STATE.md:81`)
- Workaround : ADR-003 lisible dans `docs/adr/` ; `STATE.md` mentionne le gap. Tout agent doit cross-checker les deux.

## Items reportés / Deferred

### Modal assignation — pas de filtrage `type_permis` ↔ `vehicle.type`

- Issue : La modal d'assignation permet de marier un chauffeur (type permis B/D1/D) avec un véhicule (type berline/minibus/TPMR) sans cohérence. Risque opérationnel : chauffeur B affecté à un minibus 9 places.
- Files : `apps/web/src/app/(app)/courses/_components/assign-modal.client.tsx:45` (commentaire explicite "pas de couplage type_permis ↔ vehicle.type V1")
- Sévérité : **major** (impact métier régulatrice, mais V1 design partner accepte)
- Phase de résolution : Passe 2 (Phase 04)
- Workaround : aucun automatique. La régulatrice vérifie manuellement.

### Invitation chauffeur — création compte Auth + rattachement profile_id

- Issue : Aucun workflow d'invitation chauffeur n'existe. La table `drivers` garde `profile_id` nullable pour permettre l'enregistrement avant invitation Auth.
- Files : `supabase/migrations/20260512000001_drivers.sql:14-20`, `supabase/migrations/20260512000001_drivers.sql:46-50` (index partiel `where profile_id is not null`)
- Sévérité : **major** (le chauffeur ne peut pas se connecter à la PWA Passe 2 sans cette pièce)
- Phase de résolution : Passe 2 (Phase 04) — workflow `invite chauffeur` via Supabase Auth (magic link / email + lien rattachement)
- Workaround : seeds démo (`supabase/seed.demo.sql`) créent manuellement les 3 comptes `dirigeant@demo.tap` / `regulateur@demo.tap` / `chauffeur@demo.tap`.

### Audit logs — enrichissement nom acteur

- Issue : La timeline d'audit affiche `actor_role` seul (`dirigeant`, `regulateur`, `chauffeur`) sans le nom de la personne. La régulatrice voit "modifié par regulateur" au lieu de "modifié par M. Hoarau".
- Files : `apps/web/src/app/(app)/courses/_lib/queries-enriched.ts:144-154` (select sans join sur profiles), `apps/web/src/app/(app)/courses/_components/ride-audit-timeline.tsx:93` (rendu `${entry.actor_role}` brut)
- Sévérité : **minor** (lisibilité dégradée, pas bloquant audit RGPD — `actor_id` UUID est tracé)
- Phase de résolution : Passe 2 (Phase 04) — join `profiles.full_name` ou stockage redondant
- Workaround : `actor_id` reste l'identifiant légal d'audit.

### Taxonomie motifs d'annulation — V1 texte libre

- Issue : La modal d'annulation course accepte un motif texte libre. Aucune catégorisation (patient absent / véhicule panne / météo / refus / autre). Impossible d'agréger statistiquement.
- Files : `apps/web/src/app/(app)/courses/_components/cancel-ride-modal.client.tsx` (Textarea simple)
- Sévérité : **minor** (V1 acceptable, observation terrain nécessaire avant catégorisation)
- Phase de résolution : Passe 4 (Phase 06) — observer puis catégoriser avec design partners
- Workaround : texte libre journalisé dans `audit_logs`.

### Modal édition course — pas de différenciation visuelle Modifier vs Créer

- Issue : Le modal `ride-express-modal` réutilisé pour création ET édition n'affiche que le titre comme indicateur. Pas de mode visuel "édition" (ex. badge, couleur header).
- Files : `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx`
- Sévérité : **cosmetic**
- Phase de résolution : Passe 2 si feedback design partner négatif
- Workaround : titre dynamique suffit fonctionnellement.

### Filtrage liste avancé `/admin/chauffeurs` et `/admin/vehicules`

- Issue : Pas de filtres avancés (par actif, par type permis, par CT à jour) sur les listes administratives.
- Files : `apps/web/src/app/(admin)/admin/chauffeurs/`, `apps/web/src/app/(admin)/admin/vehicules/`
- Sévérité : **minor**
- Phase de résolution : Passe 2 (Phase 04) si volume justifie
- Workaround : recherche basique client-side.

### Page `/admin/index` dashboard global

- Issue : Pas de dashboard `/admin` agrégeant les KPIs dirigeant.
- Sévérité : **minor**
- Phase de résolution : Passe 4 (Phase 06)

## Sandbox-blockers et dette de vérification

### 5 items audit-uat pending Phase 01

- Issue : 5 items `/gsd-audit-uat` non passés sur Phase 01 (référentiel patients). Dette transverse documentée.
- Files : `.planning/STATE.md:108`
- Sévérité : **major** (bloque commercialisation, NON bloquant pour Passes 2/3/4)
- Phase de résolution : avant Phase 07 (commercialisation)
- Workaround : Phase 01 fonctionnellement validée par walkthrough manuel dirigeant, mais audit-uat formel à reprendre.

### TODO Phase 8 — email lien legal request

- Issue : Workflow droits RGPD (request) ne déclenche pas d'envoi email avec lien. TODO explicite Phase 8.
- Files : `apps/web/src/app/(admin)/admin/legal/requests/actions.ts:92`
- Sévérité : **major** (Phase 1.5 RGPD livrée incomplète, GELÉE par CLAUDE.md § 14)
- Phase de résolution : Passe 4 (Phase 06) — RGPD production
- Workaround : Phase 1.5 gelée, pas d'extension avant Passe 4 (cf. CLAUDE.md § 14).

### TODO migrations Phase 4 / 6 / 9 dans seed SQL

- Issue : 3 TODO blocs dans le SQL setup pour les tables récurrences (Passe 3), planning (Passe 4), PWA chauffeur (Passe 2).
- Files : `apps/web/src/lib/setup-sql.ts:2427,2430,2432`, `supabase/seed.demo.sql:189,192,194`, `supabase/setup-all.sql:2423,2426,2428`
- Sévérité : **minor** (TODO normaux jalonnant les passes futures)
- Phase de résolution : ouvertes au fur et à mesure des Passes 2/3/4
- Workaround : N/A — marqueurs intentionnels.

## Sécurité et conformité

### Supabase Cloud non certifié HDS

- Issue : Supabase Cloud n'est pas certifié Hébergeur de Données de Santé. Les données patient (NIR chiffré OK, mais notes médicales / prescriptions) hébergées dessus en V1 design partner sont sous DPA contractuelle seulement.
- Files : `.planning/PROJECT.md:96` (CON-001), `.planning/STATE.md:107`
- Sévérité : **blocker** (pour mise en production commerciale uniquement — bêta privée acceptable sous DPA dirigeant)
- Phase de résolution : Phase 06 (Passe 4) — migration vers OVHcloud Postgres HDS ou Scaleway HDS
- Workaround : architecture portable obligatoire (SQL standard, RLS standard, pas de spécificité Supabase Edge). NIR chiffré applicatif AES-256-GCM avec clé hors Supabase déjà en place (cf. DEC-007).

### Audit grep CI pour NFR-001 (noms propres) et NFR-003 (spacing scale)

- Issue : NFR-001 (aucun nom propre) et NFR-003 (spacing strict 4/8/12/16/24/32/48/64) sont des contraintes documentées mais pas vérifiées automatiquement en CI. Risque de drift silencieux.
- Files : `.planning/REQUIREMENTS.md:350,361-364`, `.planning/ROADMAP.md:223`, `.planning/intel/constraints.md:222-223,275`
- Sévérité : **major** (NFR-001 a impact RGPD/branding, NFR-003 a impact UX cohérence)
- Phase de résolution : Phase 06 (Passe 4) — ajouter 2 jobs `grep -rE` en CI bloquante
- Workaround : revue humaine au passage des PR (déjà appliqué par règle `.planning/regle-neutralite-et-ton.md`).

## Concerns d'ingest et documentation

### CDC v2 — 15 modules secondaires non extraits

- Issue : Le cahier des charges V2 (`docs/cahier_des_charges_saas_tap_v2.docx`) contient 24 modules. 9 modules critiques sont ingérés dans `REQUIREMENTS.md`. **15 modules secondaires** restent binaires `.docx` non convertis en markdown, donc invisibles aux agents.
- Files : `docs/cahier_des_charges_saas_tap_v2.docx` (binaire), `.planning/REQUIREMENTS.md:222-224`, `.planning/PROJECT.md:65,89-90`, `.planning/STATE.md:106,114`
- Sévérité : **major** (anticipation Phase 06 obligatoire — sans ces 15 modules, le scope HDS / OR-Tools / B2B sera mal cadré)
- Phase de résolution : avant Phase 06 — convertir `.docx` → `.md` puis `/gsd-ingest-prd`
- Workaround : 9 modules critiques V1 couvrent l'essentiel régulatrice + chauffeur + dirigeant.

### `siretSchema` Luhn checksum — SIRET test invalide

- Issue : Le test `siretSchema.parse('40483304800010')` échoue (Luhn). Cause probable : mauvais SIRET de test OU bug algo Luhn. Hors scope Phase 1.
- Files : `packages/shared/src/validators/__tests__/common.test.ts`, `.planning/phases/01-referentiel-patients/deferred-items.md`
- Sévérité : **minor** (test rouge isolé, n'affecte pas la prod)
- Phase de résolution : Phase ultérieure — valider l'algo contre 5+ SIRETs publics
- Workaround : test skip ou correction du SIRET de référence.

## Concerns architecture / UX

### Refonte login + `/welcome` + `/setup`

- Issue : Pages `/welcome` (Phase 0.7) et `/login` (Phase 1) à harmoniser visuellement avec la charte design system unifiée Passe 2.
- Files : `apps/web/src/app/welcome/page.tsx`, `apps/web/src/app/(auth)/login/`
- Sévérité : **minor**
- Phase de résolution : Passe 2 (Phase 04, livrable 04-B)
- Workaround : fonctionnellement OK.

### UI/UX modal saisie course

- Issue : frictions visuelles secondaires identifiées à la clôture Phase 03.2 lors de l'UAT dev solo — proportions Mode/Urgence trop grandes vs autres champs, espacement vertical excessif entre sections, asymétrie icônes date/heure (Calendar avec icône préfixe vs Select sans), micro-incohérences de spacing dans la grille `grid-cols-2`. Non bloquant pour la valeur livrée (saisie express + smart defaults + chips date + dédoublonnage), mais à reprendre en bloc.
- Files : `apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx`, `ride-express-form-fields.client.tsx`
- Sévérité : **minor** (cosmétique — fonctionnalité OK, modal utilisable telle quelle)
- Phase de résolution : phase UI/UX dédiée post-Passe 2 PWA, à traiter en bloc avec autres polishes accumulés (refonte login + welcome + setup, alignements généraux design system)
- Workaround : aucun. **Interdit de faire un fix cosmétique opportuniste dans Phase 04** — sortir de la passe pour polisher cassera la cadence E2E (ADR-003).

### Manifest PWA + offline chauffeur

- Issue : PWA chauffeur (Passe 1 livrée en web responsive) sans manifest installable ni service worker offline. CLAUDE.md § 5 exige mode hors-ligne fonctionnel (démarrage / clôture course, scan BT).
- Files : `apps/web/src/app/(driver)/conduite/`
- Sévérité : **major** (CLAUDE.md § 5 DEC-014 — bloque scénario terrain Hauts Réunion sans 3G)
- Phase de résolution : Passe 2 (Phase 04)
- Workaround : V1 design partner urbain Saint-Denis avec 4G stable.

## Test Coverage Gaps

### Tests Vitest absents sur Server Actions et wrappers

- Issue : Stratégie tests pragmatique CLAUDE.md § 9 — Server Actions, wrappers query, composants React NON testés en unitaire (relax volontaire V1). Couverture preuve = preview Vercel + 1 Playwright golden path par passe + pgTAP RLS systématique.
- Sévérité : **minor** (politique assumée, à re-évaluer V1.0 commerciale)
- Phase de résolution : re-évaluation à V1.0 — resserrement si incident facturation ou sécurité
- Workaround : Vitest 100 % obligatoire sur `packages/pricing` et `packages/recurrence` (logique financière + dialyse).

### Showcase Phase 03 — 10 captures à produire

- Issue : Placeholders en place dans `docs/showcase/03-e2e-passe1-squelette/`, captures réelles à produire (Visible Progress Mandate CLAUDE.md § 13.5).
- Files : `docs/showcase/03-e2e-passe1-squelette/`
- Sévérité : **minor** (livrable de phase complémentaire)
- Phase de résolution : avant ouverture Passe 2
- Workaround : preview Vercel + walkthrough script texte dans `03-SUMMARY.md`.

## Reportés Phase UI/UX dédiée post-Passe 2 (DEC-023)

### Slide-route iOS-style PWA Driver

- Issue : Transitions natives iOS-style (slide latéral) entre `/conduite` ↔ `/conduite/[rideId]` voulues à l'esquisse Phase 04 ne sont pas implémentables proprement en V1. Bug `vercel/next.js#42658` ouvert depuis 2022 : `template.tsx` ne déclenche pas d'animation à la sortie de route. View Transitions API supportée Chrome only (expérimental). `framer-motion` interdit par NFR-004 (verrou anti-lib UI nouvelle).
- Files : `apps/web/src/app/(driver)/template.tsx` (à créer Phase 04.9 avec fade-in simple), `apps/web/src/app/(driver)/conduite/[rideId]/`
- Sévérité : **minor** (UX nice-to-have, pas bloquant fonctionnel)
- Phase de résolution : **Phase UI dédiée post-Passe 2** (DEC-020 — quand Next.js corrige le bug OU que View Transitions API stabilise)
- Workaround V1 : fade-in `template.tsx` 250ms ease-out via `tailwindcss-animate` (acceptable, livré Phase 04.9 — DEC-020)

### Layout split tablette 768-1024 px

- Issue : Le split layout `<AuthShell>` activé à `lg:` (≥ 1024 px) n'est pas spécifié pour la fenêtre tablette 768-1024 px. Le single-column collapse mobile s'applique mais peut paraître sous-optimal sur tablette landscape (iPad classique). Identifié à l'audit UI-SPEC Phase 04.
- Files : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` (à créer Phase 04)
- Sévérité : **minor** (cosmétique, audience cible tablette régulateur secondaire)
- Phase de résolution : **Phase UI dédiée post-Passe 2** — breakpoint `md:` intermédiaire avec proportions adaptées
- Workaround V1 : single-column < 1024 px (Phase 04 livre cette version)

### Mode nuit toggle complet

- Issue : Spec mode nuit présente dans `04-UI-SPEC.md § 4 Color` (tokens HSL complets jour/nuit) mais le toggle utilisateur est explicitement hors scope Phase 04 (DEC-023 — refonte light login mode jour uniquement). L'infrastructure Tailwind `darkMode: ['class', '[data-theme="dark"]']` + tokens CSS vars `globals.css` est déjà en place. Manque : Server Action `toggleThemeAction` + cookie httpOnly + bouton `<Sun>`/`<Moon>` dans AuthShell header + tests visuels parité.
- Files : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` (à créer Phase 04, sans toggle), `apps/web/src/app/actions/theme.ts` (à créer Phase UI dédiée)
- Sévérité : **minor** (Pilier 1 UX impose parité jour/nuit à long terme — CLAUDE.md § 1)
- Phase de résolution : **Phase UI dédiée post-Passe 2** (toggle + QA parité visuelle + captures publiables nuit)
- Workaround V1 : utilisateurs reçoivent thème jour par défaut Phase 04, mode nuit consultable par injection manuelle `data-theme="dark"` sur `<html>` (test interne)

## Leçons méthode (audits rétroactifs)

### Permissions héritées Phase 03.1 non re-questionnées en discuss Phase 04 (hotfix DEC-029)

- **Issue** : Phase 03.1 avait verrouillé la gestion chauffeurs au rôle `dirigeant` (RLS + Server Actions + sub-guard layout (admin)). Phase 04 onboarding chauffeur a hérité silencieusement de ce verrou sans re-questionner contre le métier réel. L'UAT preview a remonté que la régulatrice ne pouvait pas onboarder les chauffeurs — workflow E2E livré Phase 04 inutilisable.
- **Conséquence** : hotfix immédiat post-Phase 04 (DEC-029) sur 5 couches (RLS, Server Actions, archivage, sidebar, sub-guards) avant que la phase soit considérée vraiment livrée.
- **Leçon** : les permissions des rôles **doivent être re-validées contre le métier réel à chaque phase qui touche au workflow**, pas seulement héritées silencieusement des phases précédentes. Particulièrement critique pour les opérations CRUD admin où le quotidien diverge du modèle initial (qui pense souvent à un dirigeant abstrait).
- **Mécanisme préventif futur** : la checklist `discuss-phase` doit explicitement inclure « permissions des rôles re-validées contre le workflow opérationnel cible ? » avant de lockear le périmètre. Phase 04.5+ : auditer les autres modules admin sur le même critère (`vehicules`, `legal/*` — quels rôles devraient pouvoir consulter / éditer dans la réalité ?).

### Sémantique action floue : un seul verbe pour deux réalités métier (hotfix-bis DEC-029)

- **Issue** : la PR #60 (premier hotfix DEC-029) a élargi l'archivage au régulateur en pensant rendre service à la régulatrice. Mais l'archivage et la désactivation sont deux opérations métier distinctes : désactiver est un filet de sécurité (« il ne peut plus prendre de courses aujourd'hui ») réversible facilement ; archiver est une sortie système (« il a quitté la société »). Mélanger les deux derrière un seul bouton « Archiver » crée des erreurs irréversibles côté régulateur sous pression et brouille l'audit RGPD.
- **Conséquence** : second hotfix sur la même phase pour séparer en 4 actions (Désactiver / Réactiver / Archiver / Désarchiver) avec guards distincts par action et trigger column-level qui enforce la règle au niveau BDD.
- **Leçon** : quand une fonctionnalité agrège deux réalités métier sous un seul libellé, le ton « simplifions l'UI » cache un risque opérationnel. Pour les opérations à blast radius variable (réversible / irréversible), la règle est **un verbe ≠ un autre verbe ≠ une action UI ≠ une action UI**, même si techniquement c'est juste `UPDATE drivers SET X = Y`.

### Conventions rédactionnelles FR user-facing (DEC-030)

- **Cadre** : audit FR du repo en méthode C hybride (grep + revue manuelle) sur les seuls textes user-facing. Toute nouvelle phase touchant à du texte user-facing doit respecter DEC-030. Audit FR ponctuel à ré-effectuer à chaque phase UI dédiée.
- **Règles appliquées (Option β)** :
  - Cadratin `—` en articulation / définition remplacé par `:` contextuel ; séparateurs de titre de page conservés (convention web FR).
  - Anglicismes verbes traduits : `assigner→affecter`, `assignation→affectation`, `désassigner→désaffecter`, `modal→fenêtre`.
  - Guillemets français `« »` privilégiés dans les messages d'erreur Zod.
- **Hors scope DEC-030 D5** : commentaires code (`//` et `/* */`), JSDoc, docs `.md`, commentaires SQL, fichiers `.test.ts`. L'enum DB `'assignee'` reste tel quel (identifiant technique non user-facing).
- **Dette future explicite** :
  - Apostrophes typographiques `’` au lieu de `'` dans les textes UI (ROI insuffisant V1).
  - Espaces fines insécables U+202F avant `: ; ? ! »` (espace normale acceptable V1).
  - Audit FR à étendre aux templates email Supabase Auth quand ils seront customisés (Phase 04.5+).

### CD Supabase schema_migrations drift (résolu 2026-05-13, DEC-032)

- **Issue** : application MCP des migrations via `mcp__supabase__apply_migration` crée des entrées `supabase_migrations.schema_migrations` avec une `version` auto-générée (timestamp à l'instant de l'appel) au lieu de la version repo correspondante. Si le fichier disque existe avec une version différente, `supabase db push` détecte le drift (« remote has versions that local doesn't ») et refuse de pousser les migrations suivantes. Le CD `cd.yml` step `Application des migrations Supabase (production)` échoue. Incident 2026-05-13 : 3 migrations (`driver_invitations`, `drivers_perm_regulateur`, `drivers_archive_dirigeant_only`) appliquées en MCP à 10:52-10:53 UTC ont créé les versions `20260513105255` / `…312` / `…324` au lieu de `20260514000002` / `20260516000001` / `20260516000002`. 5 runs CD failed avant correction.
- **Conséquence immédiate** : aucune nouvelle migration ne peut atterrir en prod tant que le drift n'est pas résolu. Effet de blocage en cascade pour toute PR portant du SQL.
- **Playbook de réconciliation** (utiliser quand l'incident se reproduit) :
  1. `mcp__supabase__execute_sql` :
     ```sql
     SELECT version, name, created_at
     FROM supabase_migrations.schema_migrations
     ORDER BY version DESC LIMIT 25;
     ```
     Identifier les versions auto-générées (timestamp YYYYMMDDhhmmss à la minute de l'appel MCP).
  2. Pour chaque entrée drift, `mcp__supabase__execute_sql` :
     ```sql
     UPDATE supabase_migrations.schema_migrations
     SET version = '<version_repo>'
     WHERE name = '<nom_migration>' AND version = '<version_mcp>';
     ```
  3. Vérifier l'ordre chronologique : la requête SELECT doit montrer les versions repo en tête, sans gap intermédiaire.
  4. Re-déclencher le CD via push d'un commit (vide ou substantiel) sur `main`.
- **Leçon** : `mcp__supabase__apply_migration` est utile en hotfix urgent quand le CD est défaillant ou la BDD est désynchronisée, mais ne doit jamais être utilisé en lieu et place du flux `git → CD → supabase db push` quand celui-ci marche. La signature de la version posée par MCP est une violation silencieuse du protocole de versioning Supabase CLI.
- **Mécanisme préventif futur** : après tout `apply_migration` sur une migration qui a aussi un fichier disque correspondant, immédiatement `UPDATE schema_migrations.version` pour aligner. Idéalement, automatiser cette réconciliation côté MCP (issue upstream à ouvrir Supabase) ; en attendant, le geste manuel est inscrit dans le playbook ci-dessus.

### Vague 2 — 2026-05-14 : reseed_patients_fictifs oubliée

Le batch initial DEC-032 (vague 1) avait identifié 3 migrations dérivées : `driver_invitations`, `drivers_perm_regulateur`, `drivers_archive_dirigeant_only`. Une 4e migration `reseed_patients_fictifs` (version Supabase `20260512060210`, version repo `20260513000003`) avait également été appliquée en MCP plus tôt dans la semaine mais n'avait pas été listée dans la première réconciliation.

Le CD du 2026-05-14 (run `40502f9`) a échoué sur :

```
Remote migration versions not found in local migrations directory. […]
try repairing the migration history table:
supabase migration repair --status reverted 20260512060210
```

**Fix appliqué** :

```sql
UPDATE supabase_migrations.schema_migrations
SET version = '20260513000003'
WHERE name = 'reseed_patients_fictifs';
```

**Leçon pour les prochaines récurrences** : la requête de diagnostic doit être **exhaustive**, comparant TOUS les noms de `schema_migrations` prod avec TOUS les noms de fichiers dans `supabase/migrations/`. Un drift orphelin invisible suffit à bloquer le CD.

```sql
-- Requête de diagnostic exhaustive (utiliser en cas de drift) :
-- Remplacer les listes par les valeurs réelles du repo au moment du diagnostic.
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE name NOT IN (
  -- Liste à actualiser depuis : ls supabase/migrations | sed 's/^[0-9]*_//; s/\.sql$//'
  'foundations', 'rls_foundations', 'patients',
  'search_patients_rpc', 'legal_compliance',
  -- …etc, à jour au moment du diagnostic
)
OR (version, name) NOT IN (
  -- Liste à actualiser depuis : ls supabase/migrations | sed -E 's/^([0-9]+)_(.+)\.sql$/(\x27\1\x27, \x27\2\x27),/'
  ('20260506000001', 'foundations'),
  -- …etc, à jour au moment du diagnostic
)
ORDER BY version DESC;
```

**Idéalement** : automatiser cette comparaison via un script de pré-flight check intégré au CD lui-même (dette future Phase 04.5+). Le script lirait `ls supabase/migrations/` côté repo, ferait `SELECT version, name FROM schema_migrations` côté prod, et flaggerait toute entrée drift ou orpheline avant que `supabase db push` ne parte.

### Audit visuel pages admin (Phase 04.5+, DEC-034)

- **Issue** : la PR #60 (hotfix DEC-029 sémantique 4 actions chauffeurs) a introduit un nouveau pattern de liste sur `/admin/chauffeurs` (cards aérées, badges multiples, toggle Actifs/Archivés, avatars colorés) sans aligner `/admin/vehicules` ni `/admin/legal/*` qui restent sur l'ancien pattern (`divide-y` dense, Sheet édition, badge unique).
- **Conséquence** : visuellement, le SaaS se présente comme deux apps différentes pour un utilisateur naviguant entre `/admin/chauffeurs` et `/admin/vehicules`.
- **Décision** : codifier le pattern dans `.planning/UI-PATTERNS.md` (Linear/Stripe-like dense `divide-y` + Sheet édition + filtres pills + spacing 8 px scale + color = signal), refactor progressif des pages admin en Phase 04.5 ou ultérieure (DEC-034).
- **Priorité** : minor (pas bloquant fonctionnellement, dette UX visible mais sans impact métier immédiat).
- **Cible refactor** :
  - `/admin/chauffeurs` : aligner vers densité Linear (conserver le toggle Actifs/Archivés mais en pill discret), conserver les actions inline DEC-029, retirer les cards aérées
  - `/admin/legal/*` : auditer cohérence avec le pattern
  - Hors scope strict Phase 04.5 selon priorisation UAT dirigeant

### Audit RLS systémique reporté Phase 06 HDS

- **Incident 2026-05-15** : post-merge PR #74 (Wave A Phase 04.5), l'UAT a révélé que le chauffeur ne peut pas démarrer/clôturer ses courses. Cause root : policy RLS `rides_update_regulateur_dirigeant` exclut le rôle `chauffeur` ; aucune policy `rides_update_chauffeur_*` n'existe. UPDATE silencieusement rejeté par RLS (0 rows affected, pas d'erreur SQL) → faux success affiché côté UI.
- **Fix appliqué Phase 04.5 T1.4 (mini scope)** : nouvelle policy `rides_update_chauffeur_own_rides` autorise un chauffeur à UPDATE ses propres rides (`driver_id IN (mes drivers)`). USING + WITH CHECK identiques pour empêcher transfert. Migration via CD `supabase db push` (DEC-032). Pattern Server Action row count check (DEC-041) appliqué à `startRideAction` + `endRideAction` uniquement.
- **Risque résiduel V1.5** : d'autres trous similaires peuvent exister sur d'autres tables (patients, vehicles, pois_metier, audit_logs, legal_*). Acceptable en pré-production démo (utilisateurs internes test seulement). **Inacceptable en production commerciale HDS**.
- **Reporté Phase 06 HDS** (conformité production-grade, sa place naturelle) :
  - Inventaire complet policies RLS de TOUTES les tables (`patients`, `rides`, `drivers`, `vehicles`, `audit_logs`, `organizations`, `legal_*`, `pois_metier`, etc.)
  - Matrice rôle × table × action `[SELECT, INSERT, UPDATE, DELETE]` attendu vs actuel
  - Migrations correctives par table
  - Tests pgTAP exhaustifs (cross-org isolation, cross-driver isolation, role escalation)
  - Tests E2E Playwright sur permissions (au-delà du smoke V1)

### Server Actions row count check (DEC-041)

- **Pattern documenté DEC-041** (PROJECT.md) appliqué Phase 04.5 UNIQUEMENT à `startRideAction` et `endRideAction` :
  ```typescript
  const { data, error } = await supabase
    .from('table')
    .update(payload)
    .eq('id', id)
    .select('id');
  if (error) return { error: '...' };
  if (!data || data.length === 0) {
    return { error: 'Modification refusée — droits insuffisants.' };
  }
  ```
- **Justification** : RLS rejette silencieusement les UPDATE qui ne match aucune ligne. Sans `.select()` + check `length`, l'application affiche un faux success.
- **Audit complet reporté Phase 06** : inventaire de TOUTES les Server Actions du repo + application systématique du pattern + tests E2E error path (RLS blocking) + migration documentaire.
- **Liste actions à auditer Phase 06** (à compléter à l'inventaire exhaustif) :
  - `apps/web/src/app/(admin)/admin/chauffeurs/actions.ts` (createDriver, updateDriver, archiveDriver, deactivateDriver, reactivateDriver, unarchiveDriver, inviteDriver, resendInvitation)
  - `apps/web/src/app/(admin)/admin/vehicules/actions.ts` (createVehicle, updateVehicle, archiveVehicle, …)
  - `apps/web/src/app/(app)/courses/actions/*.ts` (createRide, editRide, cancelRide, assignment, …)
  - `apps/web/src/app/(app)/patients/actions/*.ts` (createPatient, updatePatient, archivePatient, …)
  - `apps/web/src/app/(admin)/admin/legal/*/actions.ts` (registre, dpia, dpa, breaches, requests, dpo)
  - `apps/web/src/app/(driver)/conduite/actions.ts` (startRide ✓ Phase 04.5, endRide ✓ Phase 04.5 — reste : éventuelles actions futures)
  - Inventaire exhaustif à compiler via `grep -rn "'use server'" apps/web/src/`

### Audit permissions Server Actions modules admin — disparité d'application DEC-029

Audit conduit Phase 04.5 Wave C.4 (PR à venir) sur `apps/web/src/app/(admin)/`. Comparaison du pattern « defense in depth » (UI cachée + guard Server Action + RLS) appliqué uniformément ou non par module.

**Pattern de référence DEC-029** (`/admin/chauffeurs`) — **3 couches** :
- UI : bouton Archiver caché côté régulateur
- Server Action : `requireAdminOrRegulateur` OU `requireDirigeant` (helpers partagés `@/lib/auth/`)
- RLS : politique Postgres restreint sur rôle

**État réel des autres modules** :

| Module | UI | Server Action guard | RLS | Layers |
|---|---|---|---|---|
| `/admin/chauffeurs` | ✅ | ✅ helpers partagés | ✅ | 3 (référence) |
| `/admin/vehicules` | ✅ | ⚠️ `requireDirigeant` LOCAL (duplication, devrait réutiliser `@/lib/auth/require-dirigeant`) | ✅ | 3 (mais code dupliqué) |
| `/admin/legal/*` (registre, dpia, dpa, breaches, requests, dpo) | ✅ `requireDirigeantPage` | ❌ **AUCUN** `require*` dans les Server Actions | ✅ D-18 | **2** seulement |

**Risque T-04.5-27 (Privilege gap legal/*)** :
Les Server Actions des 6 modules legal ne valident PAS le rôle côté serveur applicatif — elles reposent ENTIÈREMENT sur RLS Postgres D-18. Si la policy RLS est mal calibrée (ex : oubli sur INSERT cross-org) OU si un utilisateur forge une requête (T-04.5-23 bypass UI), la défense applicative manque.

**Severité** : majeur en pré-production (RLS reste un filet réel). Bloquant en production HDS V3 (audit conformité exigera 2 couches minimum sur les modules données santé / juridiques).

**DEC-040 candidate** (à promouvoir LOCKED si validé) :
> Pattern obligatoire pour toute Server Action modifiant des données admin :
> ```ts
> 'use server';
> const ctx = await requireDirigeant();
> if (!ctx) return { error: 'Action réservée au dirigeant.' };
> ```
> Helpers partagés : `@/lib/auth/require-dirigeant`, `@/lib/auth/require-admin-or-regulateur`. Pas de fonction `requireX` locale (duplication interdite).

**Phase de résolution** : Phase 06 HDS (audit RLS systémique + audit Server Actions row count check DEC-041 + audit guards `require*` consolidés au même moment). Ne pas patcher en Phase 04.5 (V5 anti-scope creep).

**Items factuels à traiter Phase 06** :
1. Remplacer `requireDirigeant` local de `/admin/vehicules/actions.ts:23` par import du helper partagé
2. Ajouter `requireDirigeant()` (ou équivalent) en tête de chaque export `'use server'` de :
   - `/admin/legal/registre/actions.ts`
   - `/admin/legal/dpia/actions.ts`
   - `/admin/legal/dpa/actions.ts`
   - `/admin/legal/breaches/actions.ts`
   - `/admin/legal/requests/actions.ts`
   - `/admin/legal/dpo/actions.ts`
3. Inscrire DEC-040 LOCKED dans PROJECT.md
4. Tests E2E permissions cross-rôle Playwright (régulateur tente d'invoquer une action legal → assert refus serveur, pas seulement UI)

### Dette CI rouge constante sur main (Lint + Tests unitaires + pgTAP) — depuis ≥ PR #75

Diagnostic réalisé Phase 04.5 Wave B (PR #76, 2026-05-15). Trois jobs CI échouent systématiquement sur main et sur toutes les PRs récentes, dont PR #75 (docs-only) déjà mergée. Reproduit local sur checkout `origin/main` propre. Aucun lien avec les diffs des PR concernées — ce sont des dettes d'environnement / lockfile pré-existantes.

**D1 — Lint cassé sur `@tap/database` et `@tap/shared`**

- Symptôme : `ESLint couldn't find an eslint.config.(js|mjs|cjs) file.`
- Cause : ESLint 10.x (livré par la résolution du lockfile) a abandonné `.eslintrc.*`. Les 2 packages ont vraisemblablement encore des `.eslintrc.json` au lieu d'un `eslint.config.js` (format flat config).
- `apps/web` lint passe (Next.js a son propre wrapper).
- Fix attendu : (a) downgrade ESLint à 9.x explicite via `package.json` racine, OU (b) migrer les 2 packages vers `eslint.config.js` flat config.

**D2 — Test `siretSchema` rejette SIRET Carrefour 40483304800010**

- Fichier : `packages/shared/src/validators/__tests__/common.test.ts:34`
- Test : `expect(siretSchema.parse('40483304800010')).toBe('40483304800010')`
- Symptôme : Zod throw `SIRET invalide (échec contrôle Luhn).`
- Cause probable : (a) le contrôle Luhn dans `siretSchema` est trop strict (devrait peut-être autoriser certains SIRET historiques INSEE qui ne passent pas Luhn classique — La Poste / Carrefour SIRET siège), OU (b) le SIRET de référence du test est incorrect (Carrefour SA siège = `40483304800022` selon Sirene).
- Fix attendu : changer le SIRET de référence vers un Luhn-valide (ex : `73282932000074` Google France) OU adapter le validateur si on veut accepter les SIRET INSEE non-Luhn.

**D3 — Job `Tests RLS pgTAP` échec env**

- Affecté : toutes les PRs récentes y compris docs-only PR #75.
- Logs non lisibles sans auth GitHub Actions (sandbox).
- Cause probable : drift de `supabase/setup-cli@v1 version: latest` — la dernière CLI Supabase peut avoir cassé `supabase db start` ou `supabase test db` (image Postgres, dépendance Docker compose, etc.).
- Fix attendu : pinner la version de `supabase/setup-cli` à une version connue verte (ex : `2.31.x`), OU reproduire localement avec Docker activé et corriger la cause.

**Conséquence verrou V6 (Phase 04.5 « attendre CD vert avant merge »)** : les PRs récentes ont été mergées malgré ces 3 dettes (précédent PR #75). Décision Phase 04.5 : merge PR #76 sur ce même précédent, ces 3 dettes sont traitées en PR séparée hors scope Wave B.

**Phase de résolution** : à programmer rapidement — Phase 04.7 ou tech-debt-PR dédiée avant Wave C. Verrou bloquant pour le sérieux du pipeline.

---

*Concerns audit : 2026-05-12 — re-mapping 2026-05-13 post-DEC-023 — leçons DEC-029 + DEC-030 ajoutées 2026-05-13 (hotfix-bis) — DEC-032 playbook CD schema_migrations ajouté 2026-05-13 — Vague 2 reseed_patients_fictifs ajoutée 2026-05-14 — DEC-034 audit visuel pages admin ajouté 2026-05-14 — DEC-041 amendement RLS chauffeur + audit systémique Phase 06 ajouté 2026-05-15 — D1/D2/D3 dettes CI rouge main ajoutées 2026-05-15 (Wave B B.1)*
### Dettes CI V1.5 — stratégie acceptée 2026-05-15

Stratégie inscrite VISION.md « Stratégie CI/qualité V1.5 → V3 ».

Les 3 dettes ci-dessous restent ROUGES sur la CI jusqu'à Phase 06 HDS. Documentées comme acceptables V1.5 car n'impactent ni la démo design partner ni le périmètre métier des phases.

**Dette 1 — ESLint v10 flat config (~30 min Phase 06)**

- Configs manquantes : `packages/database`, `packages/shared`
- Fix : créer `eslint.config.js` dans chaque package

**Dette 2 — SIRET Carrefour test Luhn (~15 min Phase 06)**

- Fichier : `packages/shared/src/validators/__tests__/common.test.ts`
- Fix : remplacer `40483304800010` par SIRET fictif Luhn-valide

**Dette 3 — pgTAP env CI runner (~1-2 h Phase 06)**

- Diagnostic à faire : pourquoi pgTAP fail même sur PR sans SQL
- Suspicion : installation pgTAP côté runner GitHub Actions ou configuration Supabase CLI tests

**Précédents PR qui ont mergé avec ces 3 dettes** :

- PR #75 (docs-only amendement Phase 04.5)
- PR #76 (Wave B.1 RLS chauffeur)

Phase 04.5 Wave B.2..D continueront avec cette baseline.

### Validation NIR — strict vs format (2026-05-15)

Hotfix UX post-PR #83 : l'UAT a révélé que la validation stricte de la clé contrôle INSEE bloque la démo (impossible de saisir un NIR fictif sans calculer la vraie clé à la main). Décision dirigeant : conserver le code de validation INSEE mais le désactiver par défaut, activable via env var pour la production.

Le formulaire patient supporte 2 modes de validation NIR :

- **Format only (défaut, démo)** : 15 chiffres + structure INSEE (sexe ∈ {1,2}, mois 01-12, département 2 chiffres ou 2A/2B, commune + ordre + clé en chiffres) mais clé contrôle non vérifiée. Suffisant pour démo design partner.

- **Strict (production)** : tout ce qui précède + calcul clé contrôle INSEE (`97 − N mod 97`). Activé via env var `NEXT_PUBLIC_NIR_CHECKSUM_STRICT=true`.

L'algorithme INSEE et ses tests unitaires sont livrés en permanence (PR #80 + PR #83), seule l'activation au runtime change via env var. Côté code : `nirFormatSchema`, `nirChecksumSchema` et `nirFieldSchema` (sélection runtime) exportés depuis `@tap/shared`.

À l'arrivée en production réelle :
1. Activer `NEXT_PUBLIC_NIR_CHECKSUM_STRICT=true` sur Vercel
2. Redéployer
3. Vérifier la preview de l'environnement strict (test E2E `S6ter` skip → run en strict)

Pas de modification code requise au passage prod.

**Vercel preview courant** : `NEXT_PUBLIC_NIR_CHECKSUM_STRICT=false` (ou non défini, défaut équivalent). Demo design partner débloquée.

### NIR Edge Function chiffrement 401 — diagnostic Phase 06

**Symptôme** : l'Edge Function `nir` (chiffrement AES-256-GCM + hash recherche HMAC-SHA256, Phase 1.5) répond `401 Unauthorized` sur tous les appels POST depuis les Server Actions `createPatient` / `updatePatient`. Le NIR ne peut donc pas être chiffré lors de la création/édition patient.

**Diagnostic 2026-05-15** (lecture seule MCP, conforme DEC-032) :

- Edge Function `nir` ACTIVE — `slug=nir`, `status=ACTIVE`, `version=3`
- Logs `edge-function` : 401 systématiques sur tous les POST `/functions/v1/nir`
- Auth API sain : `POST /auth/v1/token` 200 sur login, token refresh OK
- Cause root probable côté Edge Function : `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars OU JWT chain Server Action → `supabase.functions.invoke()`

**Hypothèses à creuser Phase 06** :

- **H1** : env vars Edge Function pas configurées sur prod (`supabase secrets list nir`)
- **H2** : `invoke()` côté Server Action passe `service_role` au lieu du JWT user — `createServerClient` utilise la clé anon, mais l'Edge Function attend peut-être un JWT user pour son `auth.uid()` ou `current_setting('request.jwt.claims')`
- **H3** : Auth Edge Function header parsing buggé (regression Supabase CLI ou Functions runtime)

**Workaround V1.5 ACCEPTÉ** :

1. NIR rendu **optionnel** dans `patientSchema` (déjà le cas : `nir: nirFieldSchema.optional()`)
2. Server Actions `createPatient` / `updatePatient` retournent un message d'erreur explicite et actionnable si le chiffrement échoue : *« Chiffrement NIR temporairement indisponible. Vous pouvez créer le patient sans NIR pour la démo, ou réessayer plus tard. »*
3. La régulatrice peut créer un patient sans NIR. Le chiffrement reste **codé prêt** pour activation Phase 06
4. Label UI : « NIR (optionnel en démo) » + helper text explicite

**Action Phase 06 HDS** :

- Reproduire en local avec `supabase functions serve nir` + appel curl avec JWT user récupéré via `supabase auth login`
- Tester JWT chain `Server Action → invoke()` (logger les headers transmis depuis `supabase.functions.invoke('nir', {...})`)
- Valider env vars Edge Function via `supabase secrets list` puis comparer avec `supabase/functions/nir/index.ts` (`Deno.env.get('SUPABASE_URL')`, etc.)
- Estimation fix : **1-2 h**

**Risque résiduel V1.5 démo** : les patients seedés démo ont `nir_encrypted = null` (cf. `seed.demo.sql`) — pas d'impact démo. Les patients réels créés en preview sans NIR auront aussi `nir_encrypted = null`, à compléter post-fix Phase 06 via une UI de mise à jour ciblée (ou re-saisie manuelle si le NIR n'a pas été conservé hors système).

### Seed DEC-039 — ON CONFLICT DO UPDATE exhaustif (2026-05-15, leçon DEC-039-bis)

**Issue** : le seed glissant DEC-039 (Wave A Phase 04.5) ne resetait pas TOUTES les colonnes runtime-mutables des rides au ré-application CD. Conséquence : après UAT manuelle (démarrer/clôturer une course), la ride avait un état hybride seed+runtime — `started_at=null` (reset par seed) mais `ended_at=2026-05-15 09:50:58` (PAS reset, oublié dans la liste DO UPDATE) — qui violait la contrainte CHECK `rides_ended_after_started` lors du seed suivant.

**Symptôme observé** : CD GitHub Actions échec sur step « Application des migrations Supabase (production) » en 12-19 sec, message « new row for relation rides violates check constraint rides_ended_after_started ». 3 fails consécutifs sur 3 commits (`e3bb6d0`, `052c93c`, `fa50ae1`).

**Diagnostic via Supabase MCP** (lecture seule, conforme DEC-032) :

- Logs Postgres pointent la contrainte `rides_ended_after_started`
- Ride `44444444-0000-0000-0000-000000000010` avait été démarrée + clôturée par le dirigeant lors de l'UAT du matin
- Le seed visait `status='assignee', started_at=null, ended_at=null` mais seul `started_at` était dans la liste DO UPDATE — `ended_at` restait à la valeur de l'UAT
- Recherche web (Crunchy Data, Vela, Supabase docs) confirme : les CHECK constraints sont évalués sur INSERT ET UPDATE — `ON CONFLICT DO UPDATE` doit lister TOUTES les colonnes mutables runtime pour vraie idempotence post-UAT

**Fix** : élargir DO UPDATE des 3 blocs rides du seed (`supabase/seed.demo.sql`) pour reset exhaustivement TOUTES les colonnes runtime-mutables :

- Contexte course : `scheduled_at`, `created_at`, `pickup_address`, `dropoff_address`, `transport_mode`, `urgency`, `driver_id`, `vehicle_id`
- Workflow runtime : `status`, `started_at`, `ended_at`
- Tarif runtime : `tarif_amount_eur`, `tarif_source`
- Paiement runtime : `payment_status='non_concerne'`, `payment_method=null`, `payment_received_at=null`
- Archive : `archive=false`
- Annulation : `cancel_motif`
- Notes : `notes_regulateur=null`

Les colonnes absentes de la liste INSERT (ex : `ended_at` pour le bloc J0 qui seed des rides non démarrées) sont remises à leurs défauts table (`null` ou valeur fixe `'non_concerne'`/`false`) au lieu de `excluded.column`.

**Leçon DEC-039-bis** : un seed idempotent qui touche des entités manipulées par les utilisateurs DOIT lister TOUTES les colonnes mutables dans son `ON CONFLICT DO UPDATE`. La liste partielle crée des états hybrides invalides vis-à-vis des contraintes cross-column (ici `rides_ended_after_started` = `ended_at IS NULL OR ended_at >= started_at`).

**Mécanisme préventif** : à chaque ajout de colonne sur une table seedée, vérifier que le DO UPDATE du seed l'inclut. Test pgTAP `seed_demo_idempotent.sql` couvre désormais le cycle complet « seed initial → mutation UAT → re-seed exhaustif → état initial restauré » pour le bloc J0 (le bloc qui a déclenché le bug).

**Tables potentiellement concernées par ce pattern** (à auditer Phase 06) :

- `rides` ✅ corrigé hotfix DEC-039-bis
- `patients` : vérifier que `seed.demo.sql` reset bien `archive`, `consentement_sms`, `notes_operationnelles`, etc. si patients démos sont mutés par UAT
- `drivers` : vérifier que `actif`, `archive`, `archive_at` sont resetés
- `pois_metier` (PR #84) : nouveau seed à auditer si UAT mutait `actif`

### Hotfix Phase 04.7-bis — Modal + filtre date + pagination Courses (2026-05-15)

Hotfix UX livré 2026-05-15 post UAT informel Phase 04.7 (méthodologie pipeline GSD étendu inscrite VISION.md PR #97 « UAT informel obligatoire »). 3 frictions identifiées par dirigeant sur preview, confirmées par code analysis :

**Fix 1 — Modal « Nouvelle course » largeur cassée avec POI long**

- Cause : `DialogContent` `max-w-[600px]` sans `w-[calc(100vw-32px)]` ni `overflow-x-hidden` → débordement sur viewport tight
- Fix : `w-[calc(100vw-32px)] max-w-[640px] max-h-[90vh] overflow-y-auto overflow-x-hidden`
- `AddressOrPOIPicker` pill mode : ajout `flex-1` sur container `min-w-0` (renforce contrainte truncate) + `title={value}` (tooltip valeur complète au hover)

**Fix 2 — Page /courses sans filtre date**

- Cause : `rides-list.client.tsx` n'avait que statusFilter + modeFilter, pas de dateFilter
- Fix : Input `type="date"` avec valeur défaut aujourd'hui (`todayIso()`) + bouton « Effacer » conditionnel
- Backend : `listRidesEnriched` étendu avec param `date?: 'YYYY-MM-DD'` → filtre `scheduled_at >= dateStart && <= dateEnd`

**Fix 3 — Page /courses sans pagination**

- Cause : `listRidesEnriched` retournait `.limit(100)` sans offset ni feedback UI
- Fix : pagination simple V1.5 — `PAGE_SIZE=50`, query `.range(offset, offset + limit - 1)`, state `pageOffset` cumulatif, bouton « Voir plus (50 de plus) » si `rides.length === pageOffset + PAGE_SIZE`. Compteur « X courses affichées » en haut de table.
- Pagination cursor/offset complète (avec total count, pages navigables, deep-link) **reportée Phase 06**

**Pattern méta confirmé** : UAT informel post-execute révèle les frictions invisibles à la spec. Premier cas concret de validation de la méthodologie VISION.md inscrite PR #97. Coût total hotfix : ~25 min (vs estimation 15 min — légère sur-estimation mais reste sous time-cap 1h).

**Test E2E** : `courses-pagination-filter-modal.spec.ts` — 4 scénarios (F1 width, F2 date présent, F2bis Effacer, F3 compteur).

### Hotfix Phase 04.7-bis-perf — BDD indexes + RLS wrapping initPlan (2026-05-15)

Hotfix performance livré 2026-05-15. **Baseline mesurée Firefox Network tab preview Vercel** par dirigeant :

| Action | Avant | Cible |
|---|---|---|
| Recherche patient autocomplete | 828, 850, 1214ms par keystroke | <100ms (idéal 30-50ms) |
| Navigation `/patients` | 721ms | <300ms |
| Navigation `/courses` (GET + POST) | 865ms + 794-1021ms | <300ms combinés |

Contrôles déjà rapides (préservés) : création course modal, fetch détail patient par ID → asymétrie diagnostique = cause BDD (pas global cold start/network/bundle).

**Phase A diagnostic Supabase MCP (lecture seule, DEC-032)** :

- ❌ **25 FKs sans index** — dont **5 hot path** (`rides.vehicle_id`, `ride_draft.organization_id`, `ride_draft.patient_id`, `patient_constraint.organization_id`, `patient_operational_note.organization_id`). Les 20 autres = `created_by`/`updated_by` audit, rarement requêtés
- ✅ **pg_trgm extension active** + **index trigram patients déjà en place** (Phase 1 — `patients_search_trgm_idx ON patients USING gin (search_text gin_trgm_ops)`). Pas la cause Friction 1.
- ❌ **Cause root découverte** : **44 policies sur 18 tables** utilisent `current_organization_id()` SANS wrapping `(SELECT ...)`. La fonction est STABLE mais re-évaluée per-row par RLS sans initPlan. Combinée à un appel `auth.uid()` interne, chaque row examine entraîne :
  1. Lookup `profiles WHERE id = auth.uid()` (cascade RLS)
  2. Re-évaluation par row de l'organization_id

  Pattern standard Supabase recommande `(SELECT current_organization_id())` pour bénéficier de l'initPlan PostgreSQL (sous-requête évaluée UNE FOIS par statement). Speedup jusqu'à 100x sur tables denses.

**Fixes appliqués** (migration `20260516000006_perf_rls_wrapping_and_fk_indexes.sql`) :

1. **Section A** — 5 indexes FK hot path additifs (rides.vehicle_id, ride_draft.*, patient_constraint.organization_id, patient_operational_note.organization_id)
2. **Section B** — `current_organization_id()` modifie pour wrapper `(SELECT auth.uid())` interne
3. **Section C** — 21 policies hot path wrappées avec `(SELECT current_organization_id())` (DROP + CREATE sémantique préservée, tables patients/rides/drivers/vehicles/pois_metier/patient_constraint/patient_operational_note)
4. **Section D** — RPC `search_patients` wrappée + opérateur trigram `%` ajouté en complément ILIKE (utilise les 2 index gin_trgm)

**Sémantique préservée** : aucune politique modifiée dans son comportement, uniquement le wrapping fonctions stables pour initPlan. Les rows visibles avant/après sont identiques pour un utilisateur donné (V3 verrou).

**Hors scope hotfix-perf** (différé Phase 06 HDS) :

- 23 policies autres tables (legal/*, dpia/dpa, audit_logs) — wrapping systémique avec audit RLS complet
- 20 FKs audit (created_by/updated_by) sans index — gain marginal sur listes hot path
- Connection pooling Vercel — à vérifier mais probablement déjà OK (DATABASE_URL pooler:6543)
- Sentry observability + Web Vitals + Lighthouse audit complet
- VACUUM + ANALYZE planning + partial indexes additionnels

**SSR optimizations non requises V1.5** : audit a confirmé que `select()` est déjà ciblé dans toutes les pages liste (`RIDE_COLUMNS` constant, `patients_safe` colonnes explicites). `Promise.all` déjà utilisé dans `listRidesEnriched`. Le gain principal vient des indexes BDD + RLS wrapping, pas du code Server Component.

**Résultats attendus post-merge** (validation Firefox Network tab par dirigeant) :

- Recherche patient : 828-1214ms → 30-50ms (gain ~95%)
- Navigation `/patients` : 721ms → 200-300ms (gain ~60%)
- Navigation `/courses` : 865ms + 794-1021ms → 200-300ms combinés (gain ~70%)
- Contrôles rapides préservés (création course, fetch détail patient)

**Pattern méta** : Linus measure-first respecté — Phase A diagnostic MCP a sourcé la cause root (RLS wrapping) AVANT l'optimisation. La friction « recherche patient lente » n'était PAS due à un index trigram manquant (déjà en place) mais à `current_organization_id()` per-row. Sans diagnostic, l'optimisation aveugle aurait recréé un index existant et raté la vraie cause.

---

*Concerns audit : 2026-05-12 — re-mapping 2026-05-13 post-DEC-023 — leçons DEC-029 + DEC-030 ajoutées 2026-05-13 (hotfix-bis) — DEC-032 playbook CD schema_migrations ajouté 2026-05-13 — Vague 2 reseed_patients_fictifs ajoutée 2026-05-14 — DEC-034 audit visuel pages admin ajouté 2026-05-14 — DEC-041 amendement RLS chauffeur + audit systémique Phase 06 ajouté 2026-05-15 — Dettes CI V1.5 (D1/D2/D3) stratégie acceptée ajoutée 2026-05-15 — Hotfix UX NIR (strict/format env toggle) ajouté 2026-05-15 — NIR Edge Function 401 reporté Phase 06 ajouté 2026-05-15 — DEC-039-bis seed ON CONFLICT exhaustif ajouté 2026-05-15 — Hotfix 04.7-bis Modal+filtre+pagination Courses ajouté 2026-05-15 — Hotfix 04.7-bis-perf RLS wrapping + FK indexes ajouté 2026-05-15*
### Hotfix Phase 04.7-bis élargi — 3 problèmes UX (patterns industrie 2026-05-15)

Hotfix UX livré 2026-05-15 post UAT informel Phase 04.7 élargi (3 problèmes UX critiques au-delà des 3 frictions initiales). Recherches patterns industrie effectuées avant fix.

**Fix 1 — Courses scroll horizontal inévitable**

- Cause : colonne TRAJET affichait 2 adresses complètes (« EHPAD Les Lataniers, 97419 La Possession » + « Centre de dialyse Nord, 97400 Saint-Denis »), table 8 colonnes débordait 1280px viewport
- Patterns appliqués : truncation + tooltip (Linear/Stripe/Notion). Pas de stack mobile (SaaS desktop-first régulatrice). Pas de sticky first column V1 (truncation suffit)
- Solution : helper `shortAddress(full)` = préfixe avant la virgule + `max-w-[180px] truncate` + `title={fullAddress}` tooltip + `min-w-0` sur td/wrapper. Container `overflow-x-auto` déjà en place
- Inscrit UI-PATTERNS.md section « Tables denses — gestion overflow »

**Fix 2 — /admin/chauffeurs « pas raccroché » au layout app**

- Cause : `(admin)/layout.tsx` avait son propre header « TAP Administration » disjoint du shell `(app)` (« TAP Régulation »). Nav admin minimale (Chauffeurs / Véhicules / Registre / Violations) sans accès Patients/Courses/Caisse
- Pattern appliqué : sidebar layout unique config-driven (shadcn/ui 2024+ recommandation). Layout admin refactor pour réutiliser le shell `(app)` (header sticky + NavTabs + UserMenu) avec ajout extensions admin pour dirigeant (`ADMIN_EXTRAS`)
- **Décision pragmatique** : refactor `(admin)/layout.tsx` au lieu de déplacement physique des routes `/admin/*` → `/`. Le move physique nécessite audit complet + refactor 5+ fichiers + tests, hors scope hotfix-bis time-cap 2h. Reporté Phase 06 HDS (audit RLS systémique + restructuration routes au même moment)
- Inscrit UI-PATTERNS.md section « Layout unique config-driven »

**Fix 3 — Archivage Patients (soft-delete healthcare)**

- Cause : pas de mécanisme d'archivage côté UI. Régulatrice ne peut pas masquer un patient (déménagement, fin de prise en charge, etc.) sans hard-delete. RGPD/HDS exigent conservation 5-10 ans des dossiers santé
- Découverte audit : colonne `archive boolean` + `archive_at timestamptz` **déjà en place** sur table `patients` (migration Phase 1 `20260507000001_patients.sql:59`). Pas de nouvelle migration nécessaire — juste Server Actions + UI
- Pattern appliqué : soft-delete healthcare (HSE/HIPAA/GDPR). archived_at timestamp. Réactivation possible. Hard-delete réservé Phase 06 HDS sur demande RGPD explicite
- Solution :
  - `actions/archive.ts` : `archivePatientAction` (régulateur+) + `unarchivePatientAction` (dirigeant only — DEC-029 sémantique 4 actions) avec pattern DEC-041 row count check + audit_logs explicite
  - UI tabs Actifs/Archivés réutilisable pattern Chauffeurs Phase 04
  - Boutons « Archiver » (icône `Archive`) / « Réactiver » (icône `ArchiveRestore`) avec confirmation native `window.confirm` (ConfirmDialog shadcn différé V2)
  - Wording RGPD/HDS explicite dans confirmation
  - `searchPatients(q, scope)` étendu pour filtrer `archive=true|false` selon tab
  - Picker patient saisie course : `searchPatientsAction(q)` défaut scope='active' → patients archivés exclus automatiquement
- Inscrit UI-PATTERNS.md section « Soft-delete healthcare »

**Pattern méta** : recherches patterns industrie (Linear, Stripe, Notion, shadcn/ui, HSE/HIPAA/GDPR) faites AVANT fix code. Évite l'invention de patterns ad-hoc qui dévieraient du design system documenté DEC-034. 3 sections nouvelles inscrites UI-PATTERNS.md = patrimoine méthodologique hérité phases futures.

**Coût hotfix élargi** : ~50 min réel (vs ~2h estimé prompt), vélocité maintenue.

### Hotfix Vercel + Supabase URLs custom domain (2026-05-18)

Hotfix URGENT post-Phase 04.7 complète. UAT dirigeant a constaté que `tap-web-brown.vercel.app/login` provoque :
- « Application error: client-side exception »
- « Too many calls to Location or History APIs within a short timeframe »
- `DOMException: The operation is insecure`

Alors que `tap-h7wqj3vl8-tvss-projects-07aa3591.vercel.app/login` répond 200 OK normalement (même `deploymentId`).

**Cause root double** :

1. **Supabase Site URL désaligné** : pointait vers `tap-web-tvss-projects-07aa3591.vercel.app` au lieu du custom domain `tap-web-brown.vercel.app`. Les cookies de session Supabase étaient rejetés sur le domaine custom (mismatch SameSite/origin) → middleware Next.js redirige en boucle → `router.push()` en boucle côté client → exception navigateur.

2. **vercel.json override Project Settings dashboard** : `outputDirectory: ".next"` incompatible avec Root Directory `apps/web` (devrait être `apps/web/.next`). Conflit visible bannière jaune Vercel dashboard (« Configuration Settings differ from Project Settings »). Empêche les Project Settings correctement configurés de prendre effet.

**Fixes appliqués** :

1. Supabase Auth Site URL → `https://tap-web-brown.vercel.app` (manuel dirigeant via dashboard Supabase)
2. Supabase Auth Redirect URLs : ajout 4 wildcards `tap-*-tvss-projects-07aa3591.vercel.app/**` pour preview PR futurs (manuel dirigeant — réajout après suppression accidentelle)
3. `vercel.json` simplifié : `framework` + `regions` uniquement. Project Settings dashboard deviennent source de vérité.
4. `ignoreCommand` supprimé : permet PR previews de se déployer pour UAT futur (coût Vercel marginal).

**Pattern méta inscrit** :

- **Custom domain Vercel** → MAJ Supabase Auth Site URL + Redirect URLs **systématique** dès l'ajout du domaine. Sinon cookies session rejetés → boucle middleware infinie.
- **Monorepo + vercel.json** : garder vercel.json minimal (`framework` + `regions`). Project Settings dashboard pour Build/Output/Root/Install/Ignore. Surcharger vercel.json = source de conflits sans bénéfice.
- **UAT informel obligatoire (PR #97)** doit tester sur le **domaine final** de la démo (custom), pas URLs auto-générées Vercel. La méthodologie inscrite VISION.md a manqué cette friction parce que les tests précédents passaient sur les URLs alternatives où le Supabase Site URL était aligné.

**Items différés Phase 06 production-grade** :

- `NEXT_PUBLIC_APP_URL` env var Vercel manquante (utile pour magic links chauffeur si `headers().origin` indisponible). Ajout post Phase 04.9 PWA.
- `ignoreCommand` intelligent monorepo si volume builds Vercel devient critique : `git diff --quiet HEAD^ HEAD -- apps/web/ packages/` (skip si rien n'a changé dans le code applicatif).
- Documentation interne « checklist nouveau domaine Vercel » inscrite UI-PATTERNS.md section déploiement.

### Régression RLS récursive PR #101 (2026-05-18)

Hotfix CRITIQUE post-merge PR #101 (commit `d45ec0a`, migration `20260516000006_perf_rls_wrapping_and_fk_indexes.sql`). Symptôme apparent : boucle infinie redirect côté client Firefox avec « Too many calls to Location or History APIs ». Cause réelle : erreurs 500 systématiques côté BDD masquées par le middleware Next.js qui interprète l'absence de profil comme un échec auth.

**Cause root mécanique** :

Migration 20260516000006 a remplacé `SECURITY DEFINER` par `SECURITY INVOKER` sur `current_organization_id()` (et `current_user_role()`) lors du wrapping perf. La fonction SELECT depuis `profiles` table qui est elle-même protégée par RLS policy invoquant `current_organization_id()`. Récursion infinie → Postgres 500 stack overflow.

Commentaire dans `foundations.sql` ligne 125-126 (préventif mais ignoré lors de la PR #101) :
> « SECURITY DEFINER permet de lire profiles sans déclencher les policies récursivement. »

Logs Supabase API confirmation (06:30 UTC 2026-05-18) :
- `GET /rest/v1/profiles` → status 500 (répété)
- `GET /rest/v1/patients_safe` → status 500 (répété)
- `GET /auth/v1/user` → status 200 (auth marche)
- `POST /auth/v1/token` → status 200 (login marche)

**Fix appliqué** :

Migration `20260518000001_hotfix_rls_recursion_security_definer.sql` restaure `SECURITY DEFINER` en gardant le wrapping interne `(SELECT auth.uid())` pour préserver le bénéfice initPlan PostgreSQL. Les 21 policies wrappées et 5 FK indexes de PR #101 sont préservés. Bénéfice perf attendu intact.

**Pattern méta inscrit** :

1. **SECURITY DEFINER pour fonctions appelées dans policies RLS** : toute fonction qui lit une table protégée par RLS et qui est elle-même appelée dans une policy de cette table DOIT être `SECURITY DEFINER`. Sinon récursion garantie.

2. **Lecture pré-merge obligatoire des commentaires de `foundations.sql`** : les fonctions de fondation contiennent souvent des commentaires explicitant les contraintes d'architecture. Les ignorer = régression.

3. **UAT informel doit inclure tests CRUD basiques post-migration** pas juste tests UI. Une migration RLS qui casse `SELECT profiles` ne se voit pas si on ne fait pas un login + tentative d'accès données après. La méthodologie inscrite VISION.md PR #97 doit être étendue : *test login + 1 navigation page liste après chaque migration RLS*.

4. **Audit migration RLS** : avant tout merge de migration qui redéfinit `current_organization_id()` ou fonctions similaires, vérifier que toutes les policies qui les appellent restent sémantiquement correctes ET ne créent pas de récursion.

**Items différés Phase 06 production-grade** :

- Test automatisé pgTAP : assertion « SELECT count(*) FROM profiles WHERE id = auth.uid() returns 1 » après login regulateur@demo.tap. Détecte régression similaire en CI.
- Schema d'analyse statique : détecter automatiquement les fonctions `security invoker` qui SELECT depuis tables RLS qu'elles policy-protègent.
- Sentry alert : monitoring 500 BDD côté Vercel function logs + alert Slack/email.

**Items différés Vercel deployment cleanup** :

- Vercel Project Settings Override toggles : valider qu'ils sont bien désactivés après ce hotfix
- `vercel.json` minimal validé par PR #102
- Pattern A (Vercel auto-détection) appliqué

### Retour aux affaires + leçons marathon Vercel custom domain (2026-05-18)

Session marathon ~4h sur custom domain Vercel cassé. Résolution finale en cumul :
- PR #100 — Hotfix UX élargi (modal+filtre+pagination+chauffeurs+archivage)
- PR #101 — Hotfix perf BDD (RLS wrapping + FK indexes hot path)
- PR #102 — `vercel.json` minimal (Project Settings dashboard source de vérité)
- PR #103 — Restauration SECURITY DEFINER (théorie sur-diagnostiquée, voir items annulés ci-dessous)
- PR #104 — Page racine redirect (cette PR)

Fix Vercel custom domain réel : combinaison de
1. `vercel.json` minimal (`framework` + `regions` uniquement)
2. Vercel Project Settings Override toggles désactivés (Pattern A officiel)
3. Supabase Auth Site URL aligné `tap-web-brown.vercel.app`
4. Force redeploy sans cache (Build Cache reset)

**Leçons méta retenues** :

1. **Diagnostic Linus measure-first non respecté** : 3 hypothèses fausses bouclées (cookies `@supabase/ssr`, MetaMask extension, migration RLS récursion) avant d'auditer ce que dirigeant avait demandé dès le début : Vercel build logs + Supabase logs API en parallèle. La vérité était dans 2 captures dashboard Vercel + 1 set de logs Supabase Auth qui montraient login 200 OK.

2. **Sur-diagnostic après lecture logs partiels** : 500 sur `/profiles` vus dans logs Supabase API → théorie SECURITY DEFINER vs INVOKER inventée alors que la migration n'avait probablement pas encore été appliquée en prod (timing incertain). La vérité : pas eu besoin du hotfix migration, l'app marche sans.

3. **Pattern « bouclage IA » à interrompre** : dirigeant a dû plusieurs fois dire « arrête de boucler » pour réorienter l'analyse. Signal méta. Règle GSD à inscrire : *si une session diagnostic dépasse 3 hypothèses sans convergence, STOP, demander audit fresh par dirigeant avec captures dashboards + logs en parallèle.*

4. **Tester systématiquement le custom domain post-deploy** : la méthodologie UAT informel PR #97 doit inscrire le custom domain comme test obligatoire. Les URLs auto-générées Vercel marchent souvent quand le custom domain est cassé (différence d'attachement deployment), donc tester l'un sans l'autre est trompeur.

5. **`vercel.json` en monorepo : MINIMAL absolu**. Pattern A officiel Vercel = laisser Project Settings dashboard gérer Build/Output/Install. `vercel.json` ne contient que `framework` + `regions` (+ headers/rewrites si nécessaire). Tout autre override = source de conflit dashboard et bannière jaune « Configuration differs ».

6. **Auth Supabase custom domain checklist** (inscrite UI-PATTERNS.md) :
   - Site URL = domaine custom final (pas l'URL Vercel auto-générée)
   - Redirect URLs = liste autorisée + wildcards pour previews PR
   - Cookies SSR posés sur le domain de la requête (pas explicite)
   - Tester en navigation privée après changement Site URL

**Items différés Phase 06 production-grade** :

- Sentry monitoring + alerte 500 BDD (aurait détecté le cas des 500 sur `/profiles` si réellement causé par migration)
- Lighthouse audit automatisé sur `tap-web-brown.vercel.app` post-deploy (détecte régressions perf)
- Test E2E « racine redirect » pour valider `page.tsx`
- pgTAP test « login + SELECT profiles working » pour détecter régressions RLS récursion

**Items annulés (théories fausses du marathon)** :

- Migration `20260518000001` hotfix SECURITY DEFINER (PR #103) : **ANNULÉE conceptuellement**, la régression supposée n'existait pas (les 500 logs Supabase API étaient probablement liés au déploiement intermédiaire ou autre cause non investiguée). Migration restée mergée car restaure l'état foundations.sql original — sans effet de bord négatif. Si symptôme revient : réactiver l'investigation avec audit migration vivante en BDD via MCP avant de coder.
- Hotfix `@supabase/ssr` v0.5 → v0.6 cookie chunking : non requis pour ce bug. À considérer Phase 06 pour stabilité long terme.
- Désactivation MetaMask Firefox : CONCERN compatibilité Web3 noté mais non bloquant (l'app marche avec extension active).

**Analyse perf post-PR #101** :

Mesures Firefox Network tab observées par dirigeant après fix custom domain :
- `POST /patients` RSC : 686-977ms (médiane ~820ms)
- `GET /<id-patient>` : 777-878ms

Baseline avant PR #101 perf : Navigation `/patients` 721ms, Recherche patient 828-1214ms.

Verdict : aucun gain perf observé. Cible Phase 04.7-bis-perf (<300ms navigation, <100ms recherche) NON ATTEINTE.

Hypothèses à investiguer **en Phase 04.7-perf-v2 séparée** :
- H1 — Cold start Vercel Edge (refaire mesure après 1 min usage)
- H2 — Optimisations « select ciblé + Suspense » annoncées par commit `d45ec0a` PAS COMMITÉES (commit n'a touché que docs + 1 migration SQL, pas de code app)
- H3 — Migration appliquée mais initPlan PostgreSQL pas réutilisé à cause de planner cache stale
- H4 — Le bottleneck n'est pas RLS récursion mais autre chose (Vercel Edge → Supabase round-trip, payload size, etc.)

Action : ouvrir Phase 04.7-perf-v2 plan dédié SANS modification code cette session. Analyse à froid avec `EXPLAIN ANALYZE` Postgres + Vercel function logs + Network timing détaillé.

---

*Concerns audit : 2026-05-12 — re-mapping 2026-05-13 post-DEC-023 — leçons DEC-029 + DEC-030 ajoutées 2026-05-13 (hotfix-bis) — DEC-032 playbook CD schema_migrations ajouté 2026-05-13 — Vague 2 reseed_patients_fictifs ajoutée 2026-05-14 — DEC-034 audit visuel pages admin ajouté 2026-05-14 — DEC-041 amendement RLS chauffeur + audit systémique Phase 06 ajouté 2026-05-15 — Dettes CI V1.5 (D1/D2/D3) stratégie acceptée ajoutée 2026-05-15 — Hotfix UX NIR (strict/format env toggle) ajouté 2026-05-15 — NIR Edge Function 401 reporté Phase 06 ajouté 2026-05-15 — DEC-039-bis seed ON CONFLICT exhaustif ajouté 2026-05-15 — Hotfix 04.7-bis Modal+filtre+pagination Courses ajouté 2026-05-15 — Hotfix 04.7-bis élargi Courses truncation+Chauffeurs layout+Patients archivage ajouté 2026-05-15 — Hotfix Vercel + Supabase URLs custom domain ajouté 2026-05-18 — Régression RLS récursive PR #101 ajoutée 2026-05-18 — Leçons marathon Vercel custom domain + items annulés + analyse perf ajoutés 2026-05-18*
