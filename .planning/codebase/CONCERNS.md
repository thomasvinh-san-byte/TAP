# Codebase Concerns

**Analysis Date:** 2026-05-12

> Inventaire factuel de la dette technique, items reportés, blocages
> sandbox et zones fragiles identifiés à la clôture Phase 03 (E2E Passe
> 1). Sources croisées : code, `.planning/STATE.md`,
> `.planning/PROJECT.md`, `03-SUMMARY.md`, ADRs.

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

---

*Concerns audit : 2026-05-12*
