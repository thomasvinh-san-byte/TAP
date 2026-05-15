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

---

*Concerns audit : 2026-05-12 — re-mapping 2026-05-13 post-DEC-023 — leçons DEC-029 + DEC-030 ajoutées 2026-05-13 (hotfix-bis) — DEC-032 playbook CD schema_migrations ajouté 2026-05-13 — Vague 2 reseed_patients_fictifs ajoutée 2026-05-14 — DEC-034 audit visuel pages admin ajouté 2026-05-14 — DEC-041 amendement RLS chauffeur + audit systémique Phase 06 ajouté 2026-05-15 — Dettes CI V1.5 (D1/D2/D3) stratégie acceptée ajoutée 2026-05-15*
