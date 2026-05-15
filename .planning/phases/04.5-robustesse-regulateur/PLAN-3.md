---
phase: 04.5
plan: 3
plan_number: 3
slug: recherche-adresse-poi-metier
type: execute
status: draft
estimated_hours: 3
wave: 2
depends_on: ["1"]
files_modified:
  - supabase/migrations/<timestamp>_pois_metier.sql
  - supabase/seed.demo.sql
  - supabase/tests/pois_metier_rls.test.sql
  - apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx
  - apps/web/src/app/(app)/courses/actions/list-pois-metier.ts
  - apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx
  - apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
  - apps/web/tests/e2e/address-or-poi-picker.spec.ts
autonomous: true
requirements:
  - NFR-006
  - PAT-01
  - SAIS-04
  - CONCERNS-UAT-F5
  - CONCERNS-UAT-F6
decisions_implemented:
  - D-08
  - D-09
  - D-10
  - DEC-035
  - DEC-037
tags:
  - poi
  - ban
  - migration
  - rls
  - search
must_haves:
  truths:
    - "Une nouvelle table pois_metier existe avec RLS forcée same-org + audit trigger"
    - "Le seed démo contient ≥ 30 POI Réunion réels (CHU, cliniques, dialyse, EHPAD)"
    - "Le composant AddressOrPOIPicker affiche dropdown 2 sections (POI / BAN) avec icônes différenciées"
    - "Sélection d'un POI préremplit adresse + CP + ville + notes_acces"
    - "La requête BAN limite 10 résultats, debounce 200 ms, filtre code_postal_postaux=974, score min 0.5"
    - "Le composant est utilisé dans formulaire course express ET sheet patient"
  artifacts:
    - path: "supabase/migrations/<timestamp>_pois_metier.sql"
      provides: "Table pois_metier + RLS + index gin + audit trigger"
    - path: "supabase/seed.demo.sql"
      provides: "30+ POI Réunion seedés (hôpitaux/cliniques/dialyse/EHPAD)"
    - path: "supabase/tests/pois_metier_rls.test.sql"
      provides: "pgTAP 6+ assertions RLS + structure"
    - path: "apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx"
      provides: "Composant unifié POI + BAN avec sections labellées"
    - path: "apps/web/src/app/(app)/courses/actions/list-pois-metier.ts"
      provides: "Server Action fuzzy search POI métier"
  key_links:
    - from: "address-or-poi-picker.client.tsx"
      to: "Server Action listPoisMetier"
      via: "useTransition + fetch debounced"
      pattern: "listPoisMetier"
    - from: "pois_metier table"
      to: "RLS policies same-org via current_organization_id()"
      via: "ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY"
      pattern: "FORCE ROW LEVEL SECURITY"
    - from: "ride-express-modal.client.tsx + patient-form.client.tsx"
      to: "AddressOrPOIPicker"
      via: "remplace AddressPickerField"
      pattern: "AddressOrPOIPicker"
---

<objective>
T3 — Recherche adresse + POI métier : refondre `AddressPickerField` en `AddressOrPOIPicker` mixant POI métier seedés (CHU, cliniques, dialyse, EHPAD, cabinets) avec adresses BAN, dans un dropdown unique à 2 sections. Inclut nouvelle table BDD `pois_metier` RLS same-org + seed démo 30+ lieux Réunion réels + amélioration requête BAN (limite, debounce, score, filtre 974 strict).

Purpose : éliminer 2 frictions UAT 2026-05-14 (« BAN ne trouve pas CHU Saint-Denis » + « régulatrice ne peut pas chercher par nom métier »). Levier productivité régulatrice : taper « CHU » au lieu de saisir « 22 Avenue de Bellepierre » à la main → -15 s par course récurrente.

Output : 1 migration BDD (via CD `supabase db push`, jamais MCP — DEC-032) + 1 seed étendu + 1 pgTAP RLS + 1 composant refondu + 1 Server Action + 2 intégrations consommateurs (ride-express-modal + patient-form) + 1 E2E.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md
@.planning/phases/04.5-robustesse-regulateur/04.5-UI-SPEC.md
@.planning/UI-PATTERNS.md
@.planning/codebase/CONCERNS.md

# Composant existant à refondre
@apps/web/src/app/(app)/courses/_components/address-picker-field.client.tsx

# Patterns RLS / audit trigger à miroir
@supabase/migrations/  # chercher drivers_audit_trigger ou pattern équivalent

# Consommateurs
@apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx
@apps/web/src/app/(app)/patients/_components/patient-form.client.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 3.1 — Migration BDD `pois_metier` + RLS + audit trigger + seed 30 POI</name>
  <files>
    supabase/migrations/<timestamp>_pois_metier.sql,
    supabase/seed.demo.sql,
    supabase/tests/pois_metier_rls.test.sql
  </files>
  <action>
Per D-09, DEC-035, DEC-032. **Migration appliquée via CD `supabase db push`, JAMAIS via MCP** (DEC-032 playbook). Inscrit dans `schema_migrations` correctement.

Étapes :

1. **Créer la migration `<timestamp>_pois_metier.sql`** (timestamp réel de la date d'exécution, `date +%Y%m%d%H%M%S`) :

   ```sql
   -- Table POI métier (lieux fréquents seedés par organisation)
   CREATE TABLE public.pois_metier (
     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
     nom_court       text NOT NULL,
     nom_long        text NOT NULL,
     type_poi        text NOT NULL CHECK (type_poi IN (
       'chu', 'clinique', 'centre_dialyse', 'ehpad', 'cabinet_kine',
       'cabinet_ophtalmo', 'cabinet_medical', 'pharmacie', 'laboratoire',
       'centre_imagerie', 'autre'
     )),
     adresse         text NOT NULL,
     code_postal     text NOT NULL CHECK (code_postal ~ '^974[0-9]{2}$'),
     ville           text NOT NULL,
     lat             numeric(10,7),
     lng             numeric(10,7),
     telephone       text,
     notes_acces     text,
     actif           boolean NOT NULL DEFAULT true,
     created_at      timestamptz NOT NULL DEFAULT now(),
     created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL
   );

   CREATE INDEX pois_metier_organization_id_idx ON public.pois_metier (organization_id);
   CREATE INDEX pois_metier_search_idx ON public.pois_metier USING gin (
     to_tsvector('french', coalesce(nom_court,'') || ' ' || coalesce(nom_long,'') || ' ' || coalesce(adresse,''))
   );

   -- RLS forcée
   ALTER TABLE public.pois_metier ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.pois_metier FORCE ROW LEVEL SECURITY;

   -- Politiques RLS
   CREATE POLICY pois_metier_select_same_org ON public.pois_metier
     FOR SELECT USING (organization_id = current_organization_id());

   CREATE POLICY pois_metier_modify_admin_or_regulateur ON public.pois_metier
     FOR ALL USING (
       organization_id = current_organization_id()
       AND has_role(ARRAY['dirigeant', 'regulateur'])
     ) WITH CHECK (
       organization_id = current_organization_id()
       AND has_role(ARRAY['dirigeant', 'regulateur'])
     );

   -- Audit trigger (pattern miroir drivers_audit_trigger)
   CREATE TRIGGER pois_metier_audit_trigger
     AFTER INSERT OR UPDATE OR DELETE ON public.pois_metier
     FOR EACH ROW EXECUTE FUNCTION audit_log_row_change();
   ```

   Variations à adapter selon le pattern réel du repo : nom exact de `audit_log_row_change`, signature `current_organization_id()` et `has_role()`. Vérifier dans une migration existante (ex: drivers).

2. **Étendre `supabase/seed.demo.sql`** avec un bloc `INSERT INTO public.pois_metier ... ON CONFLICT (id) DO UPDATE SET ...` (pattern DEC-039 idempotent glissant) couvrant ~30 POI Réunion réels :

   - **CHU et hôpitaux** (6) : CHU Félix Guyon (Saint-Denis, Bellepierre), CHU Sud Réunion (Saint-Pierre), GHER Saint-Benoît, Centre hospitalier Gabriel-Martin (Saint-Paul).
   - **Cliniques** (5) : Clinique Saint-Vincent (Saint-Denis), Clinique des Tamarins (Saint-Pierre), Clinique Sainte-Clotilde (Sainte-Clotilde), Clinique Jeanne d'Arc (Le Port), Clinique Durieux (Le Tampon).
   - **Centres de dialyse** (4) : Centre dialyse AURAR Nord (Saint-Denis), Centre dialyse AURAR Sud (Saint-Pierre), Centre dialyse AURAR Ouest (Saint-Paul), Centre dialyse Le Tampon.
   - **EHPAD** (5) : EHPAD Les Lataniers (La Possession), EHPAD Les Mascareignes (Le Tampon), EHPAD La Pendant (Saint-Joseph), EHPAD Raphaël Babet (Saint-Pierre), EHPAD Saint-François (Saint-Denis).
   - **Cabinets kiné/ophtalmo/médicaux** (8) : 3 cabinets kiné répartis Nord/Sud/Ouest, 2 cabinets ophtalmo Saint-Denis + Saint-Pierre, 3 cabinets médicaux divers.
   - **Pharmacies / Laboratoires / Imagerie** (4) : pharmacie centrale Saint-Denis, laboratoire Bioalliance Saint-Pierre, centre imagerie radiologie Le Tampon, centre dépistage Saint-Paul.

   Pour chaque POI :
   - `id` préfixé `55555555-` pour signaler seed démo (cf. pattern rides `44444444-%`)
   - `organization_id` = id démo existant (ex: `aaaaaaaa-aaaa-...`)
   - `notes_acces` : pour les CHU/cliniques, ajouter une note utile (« Entrée Urgences au niveau -1, parking visiteurs P2 », « Accueil dialyse au RDC, sonner avant 7h », etc.)
   - `actif = true`

   Bloc final :
   ```sql
   INSERT INTO public.pois_metier (id, organization_id, nom_court, nom_long, type_poi, adresse, code_postal, ville, telephone, notes_acces) VALUES
     ('55555555-0001-0000-0000-000000000001', '<org-demo-id>', 'CHU Félix Guyon', 'Centre Hospitalier Universitaire Félix Guyon', 'chu', '22 Avenue Bellepierre', '97400', 'Saint-Denis', '0262905000', 'Entrée Urgences au niveau -1'),
     -- ... 29 autres
   ON CONFLICT (id) DO UPDATE SET
     nom_court = EXCLUDED.nom_court,
     nom_long = EXCLUDED.nom_long,
     adresse = EXCLUDED.adresse,
     notes_acces = EXCLUDED.notes_acces;
   ```

3. **Créer `supabase/tests/pois_metier_rls.test.sql`** (pgTAP, miroir d'autres tests RLS existants) avec 6+ assertions minimum :
   - `has_table('public', 'pois_metier')`
   - `col_is_pk('public', 'pois_metier', 'id')`
   - `has_index('public', 'pois_metier', 'pois_metier_search_idx')`
   - Test RLS forcée : `ok(pg_class.relrowsecurity AND pg_class.relforcerowsecurity)` pour `pois_metier`
   - Test isolation cross-org : créer 2 orgs, insérer 1 POI dans chaque, set local role/jwt, vérifier qu'org A ne voit pas POI de org B (SELECT retourne 0)
   - Test seed démo : `SELECT count(*) >= 30 FROM public.pois_metier WHERE organization_id = '<org-demo-id>'`

Hors scope explicite :
- Pas de CRUD admin UI pour POI métier (V1 = lecture seule, gestion via SQL/seed). V2 ouvrira `/admin/pois`.
- Pas de geocoding automatique des POI (V1 = lat/lng saisis dans le seed manuellement pour les CHU principaux uniquement, NULL pour le reste).

Threat model ASVS L1 :
- T-04.5-12 (Cross-org POI leak) : Mitigée par `FORCE ROW LEVEL SECURITY` + policy `organization_id = current_organization_id()`. Test pgTAP isolation cross-org obligatoire.
- T-04.5-13 (SQL Injection via nom_court libre) : Mitigée par prepared statements Supabase + ts_query escape côté Server Action `listPoisMetier`.
- T-04.5-14 (Audit bypass) : Mitigée par trigger `pois_metier_audit_trigger` pattern miroir drivers — insertion, update, delete loggués automatiquement.
- T-04.5-15 (Permission escalation regulateur → admin) : Mitigée par `has_role(ARRAY['dirigeant', 'regulateur'])` côté policy modify — chauffeur ne peut PAS modifier les POI.
  </action>
  <verify>
    <automated>cd /home/user/TAP && supabase db push --include-all  # via CD GitHub Actions, pas localement</automated>
    <automated>cd /home/user/TAP && pg_prove -d "$DATABASE_URL" supabase/tests/pois_metier_rls.test.sql</automated>
    Doit passer GREEN en CI cloud sur push (CLAUDE.md § 13.5).
  </verify>
  <done>
    - Migration pushée via CD, inscrite `schema_migrations` correctement
    - Table pois_metier visible Supabase Studio preview avec RLS forcée
    - 30+ POI seedés visibles par compte démo régulateur uniquement
    - pgTAP 6+ assertions GREEN
  </done>
  <rollback>
    Créer une migration de rollback : `DROP TABLE public.pois_metier CASCADE` puis push. Le seed correspondant tombera silencieusement (table absente). Aucune dépendance FK vers cette table V1.
  </rollback>
</task>

<task type="auto">
  <name>Task 3.2 — Composant AddressOrPOIPicker + Server Action listPoisMetier + BAN amélioré</name>
  <files>
    apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx,
    apps/web/src/app/(app)/courses/actions/list-pois-metier.ts
  </files>
  <action>
Per D-08, D-10, UI-SPEC Surface A, DEC-037. Refondre `AddressPickerField` en `AddressOrPOIPicker` (renommer + élargir). Pas de duplication, pas de `AddressPickerField2`.

Étapes :

1. **Renommer le fichier** : `git mv apps/web/src/app/(app)/courses/_components/address-picker-field.client.tsx apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx`.

2. **Créer la Server Action `list-pois-metier.ts`** :
   ```ts
   'use server';
   import { createClient } from '@/lib/supabase/server';

   export async function listPoisMetier(query: string): Promise<Array<{
     id: string;
     nom_court: string;
     nom_long: string;
     type_poi: string;
     adresse: string;
     code_postal: string;
     ville: string;
     notes_acces: string | null;
   }>> {
     if (query.trim().length < 2) return [];
     const supabase = createClient();
     const tsQuery = query.trim().split(/\s+/).map((w) => `${w}:*`).join(' & ');
     const { data, error } = await supabase
       .from('pois_metier')
       .select('id, nom_court, nom_long, type_poi, adresse, code_postal, ville, notes_acces')
       .eq('actif', true)
       .textSearch('search_idx', tsQuery, { type: 'websearch', config: 'french' })
       .limit(30);
     if (error) {
       console.error('[listPoisMetier] failed', { message: error.message, code: error.code });
       return [];
     }
     return data ?? [];
   }
   ```
   Note : adapter à la convention exacte du repo (textSearch sur `to_tsvector` géré par index gin), tester en preview que les requêtes fonctionnent.

3. **Refondre `address-or-poi-picker.client.tsx`** selon UI-SPEC Surface A § « Layout dropdown » :

   Interface props :
   ```ts
   interface AddressOrPOIPickerProps {
     id: string;
     label: string;
     ariaLabel: string;
     value: string;
     onChange: (payload: {
       label: string;
       code_postal?: string;
       ville?: string;
       notes_acces?: string;
       source: 'poi' | 'ban' | 'libre';
     }) => void;
     onBlur?: () => void;
     tabIndex?: number;
     error?: string | null;
   }
   ```

   Comportement :
   - Input `role="combobox" aria-expanded={open} aria-controls="address-listbox" aria-activedescendant={activeItemId}` (UI-SPEC L197 — pattern combobox ARIA complet, item focus clavier ↑↓ doit muter `activeItemId` pointant l'`id` HTML de l'item courant).
   - Debounce 200 ms sur la saisie.
   - Si query < 3 caractères : pas de fetch, helper text « Tapez au moins 3 caractères pour rechercher. »
   - Si query ≥ 3 : fetch parallèle POI (`listPoisMetier`) + BAN (`api-adresse.data.gouv.fr/search/?q=...&limit=10&autocomplete=1&type=housenumber&codeINSEE=974`) avec :
     - Limit BAN : 5 → 10
     - Filter strict : `code_postal_postaux=974` côté API (paramètre `q=&postcode=974` ou `code_postal` selon convention BAN)
     - Score minimum côté client : filter results `feature.properties.score >= 0.5`
   - Dropdown 2 sections avec headers `<li role="presentation" className="px-12 py-6 text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">Lieux fréquents</li>` puis items POI puis header « Adresses » puis items BAN.
   - Icônes : `Hospital` (Lucide) pour POI type_poi='chu'/'clinique'/'centre_dialyse', `Building` pour 'ehpad'/'cabinet_*', `MapPin` pour BAN.
   - Sélection POI : `onChange({ label: poi.nom_court, code_postal: poi.code_postal, ville: poi.ville, notes_acces: poi.notes_acces, source: 'poi' })`.
   - Sélection BAN : `onChange({ label: feature.properties.label, code_postal: feature.properties.postcode, ville: feature.properties.city, source: 'ban' })`.
   - Mode pill conservé (existant `AddressPickerField`) avec sous-titre POI canonique si source='poi'.
   - Empty state : « Aucun lieu ne correspond à « {query} ». La saisie libre est conservée. »
   - Navigation clavier `↓ ↑ Enter Esc` (UI-SPEC Surface A § « Comportement clavier »).

4. **A11y validée (recommandation R2 UI-SPEC)** :
   - Sections : `<ul role="group" aria-label="Lieux fréquents">` pour les POI items, `<ul role="group" aria-label="Adresses BAN">` pour BAN items. Tester sous VoiceOver macOS : les sections doivent être annoncées distinctement.
   - Empty state : `aria-live="polite"` sur le wrapper.
   - Erreur inline : `role="alert"` (déjà présent dans le composant existant, conserver).

Hors scope explicite :
- Pas de CRUD POI métier UI côté admin (V2).
- Pas de geocoding inverse (lat/lng des POI utilisés tels quels si présents, NULL accepté).
- Pas de tri pondéré par fréquence d'usage (V2 — analytics).

Threat model ASVS L1 :
- T-04.5-16 (XSS via nom_court POI malicieux) : Mitigée par React rendering. Les POI sont seedés par dev/dirigeant (pas user input), risque acceptable.
- T-04.5-17 (Server Action bypass auth) : Mitigée par `createClient()` qui hérite session Supabase + RLS forcée côté table.
- T-04.5-18 (BAN API DoS via régulatrice tape rapidement) : Mitigée par debounce 200 ms + cache React Query optionnel staleTime 5 min.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint --filter ./src/app/\\(app\\)/courses</automated>
    Manual preview : ouvrir formulaire course, taper « CHU » → dropdown affiche section « LIEUX FRÉQUENTS » avec CHU Félix Guyon en tête + section « ADRESSES » BAN. Sélectionner CHU → adresse + CP + ville + notes_acces préremplis.
  </verify>
  <done>
    - Composant renommé proprement (git mv conservé)
    - Server Action listPoisMetier retourne ≤ 30 POI par fuzzy match
    - Dropdown 2 sections avec icônes différenciées Lucide
    - Sélection POI préremplit notes_acces avec sous-label « Pré-rempli depuis le lieu, modifiable »
    - Sélection BAN préremplit adresse + CP + ville uniquement
    - BAN debounce 200 ms, limit 10, filter 974 strict, score min 0.5
    - A11y VoiceOver sections annoncées (R2 UI-SPEC validée)
  </done>
  <rollback>
    `git mv` reverse + revert commit. Le composant `AddressPickerField` original reste fonctionnel (rétrocompatibilité par alias d'export si nécessaire).
  </rollback>
</task>

<task type="auto">
  <name>Task 3.3 — Intégration consommateurs (ride-express-modal + patient-form) + E2E</name>
  <files>
    apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx,
    apps/web/src/app/(app)/patients/_components/patient-form.client.tsx,
    apps/web/tests/e2e/address-or-poi-picker.spec.ts
  </files>
  <action>
Per D-10, DEC-037. Remplacer les imports + usages `AddressPickerField` par `AddressOrPOIPicker` dans les 2 consommateurs.

Étapes :

1. **Mettre à jour `ride-express-modal.client.tsx`** :
   - Remplacer `import { AddressPickerField } from './address-picker-field.client'` par `import { AddressOrPOIPicker } from './address-or-poi-picker.client'`.
   - Remplacer les usages JSX `<AddressPickerField .../>` par `<AddressOrPOIPicker .../>` avec props mappés.
   - Sur le `onChange`, si payload contient `notes_acces` et que le formulaire course a un champ `notes_acces` (ou équivalent), prerempler. Sinon ignorer (compatibilité descendante).

2. **Mettre à jour `patient-form.client.tsx`** (Task 2.2 PLAN-2 a refondu ce fichier — synchroniser) :
   - Sur le champ `adresse` du patient, remplacer l'input texte ou l'éventuel `AddressPickerField` par `<AddressOrPOIPicker>`.
   - Sur `onChange`, prerempler `code_postal` et `ville` du patient (qui sont gérés par le Select Ville Task 2.2). Coordination : si l'utilisateur sélectionne un POI/BAN, override les valeurs `code_postal` + `ville` du formulaire.

3. **Créer le test E2E `address-or-poi-picker.spec.ts`** :
   - **Test 1 — POI fréquent** : login régulateur → ouvrir saisie course express → taper « CHU » dans adresse pickup → assert dropdown affiche section « LIEUX FRÉQUENTS » avec « CHU Félix Guyon » → cliquer → assert adresse pickup remplie avec « 22 Avenue Bellepierre » + CP 97400 + ville Saint-Denis.
   - **Test 2 — BAN fallback** : taper « 12 Rue de Paris Saint-Denis » → assert section « ADRESSES » affichée → cliquer item BAN → assert valeurs threadées.
   - **Test 3 — Empty state** : taper « zzzzzzzz » → assert empty state « Aucun lieu ne correspond à « zzzzzzzz » ».
   - **Test 4 — Mode pill** : après sélection, assert bouton « Changer » présent + label affiché en mode pill.

Hors scope explicite :
- Pas de test perf (debounce 200 ms vérifié manuellement).
- Pas de test multi-langue.

Threat model ASVS L1 :
- T-04.5-19 (Test bypass via session forgée) : Mitigée par `loginAs` helper.
- T-04.5-20 (E2E leak données BAN production) : Acceptée — BAN API est publique gouv.fr, pas de données personnelles dans les résultats.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck && pnpm lint</automated>
    <automated>cd apps/web && pnpm playwright test tests/e2e/address-or-poi-picker.spec.ts</automated>
  </verify>
  <done>
    - ride-express-modal et patient-form utilisent AddressOrPOIPicker
    - 4 tests E2E GREEN sur preview Vercel cloud
    - Aucune référence morte à `AddressPickerField` (sauf alias rétrocompatibilité explicite)
  </done>
  <rollback>
    `git revert` du commit intégration. Restaurer les imports `AddressPickerField` originaux.
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action `listPoisMetier` | Query utilisateur traverse vers BDD via ts_query |
| Client → BAN API gouv.fr | Query externe non-auth, données publiques |
| Org A → Org B (cross-tenant) | Risk leak POI métier inter-organisations |
| Régulateur → table pois_metier | Lecture autorisée, modification autorisée (policy) |
| Chauffeur → table pois_metier | Lecture seule autorisée, modification refusée |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.5-12 | Information Disclosure | Cross-org POI leak | mitigate | RLS FORCE + policy `organization_id = current_organization_id()` + pgTAP test isolation |
| T-04.5-13 | Tampering | SQL injection via ts_query | mitigate | Supabase textSearch escape automatique + websearch type |
| T-04.5-14 | Repudiation | Audit bypass POI modify | mitigate | Trigger `pois_metier_audit_trigger` miroir drivers |
| T-04.5-15 | Elevation of Privilege | Chauffeur modifie POI | mitigate | Policy `has_role(['dirigeant', 'regulateur'])` |
| T-04.5-16 | Tampering | XSS via nom_court | accept | POI seedés par dev/dirigeant, pas user input direct |
| T-04.5-17 | Spoofing | Server Action bypass | mitigate | createClient() hérite session + RLS |
| T-04.5-18 | DoS | BAN API spam | mitigate | Debounce 200 ms + cache React Query staleTime 5 min |
| T-04.5-19 | Spoofing | E2E session forgée | mitigate | loginAs helper /login + cookies |
| T-04.5-20 | Information Disclosure | BAN data leak | accept | BAN API publique, pas de PII |
</threat_model>

<verification>
- Migration appliquée GREEN via CD GitHub Actions (pas MCP — DEC-032)
- pgTAP 6+ assertions GREEN sur preview Supabase
- Composant AddressOrPOIPicker fonctionnel + 2 consommateurs migrés
- Playwright 4/4 GREEN
- Audit visuel : icônes Lucide différenciées, sections labellées, mode pill conservé
- A11y VoiceOver : sections annoncées (R2 UI-SPEC validée)
</verification>

<success_criteria>
- DEC-035 inscriptible : table pois_metier seedée 30+ POI, RLS forcée same-org
- DEC-037 inscriptible : AddressOrPOIPicker unifié POI + BAN avec sections
- 2 frictions UAT 2026-05-14 closes (recherche métier + BAN amélioré)
- Régulatrice gagne ~15 s par course récurrente patient → CHU (dialyse 3×/sem)
</success_criteria>

<output>
À la fin du plan, créer `.planning/phases/04.5-robustesse-regulateur/04.5-03-SUMMARY.md` synthétisant :
- DEC-035 + DEC-037 inscrits PROJECT.md (en pending pour le checker)
- 30 POI seedés (liste exhaustive en annexe)
- pgTAP 6+ assertions GREEN
- 4/4 Playwright GREEN
- Captures Surface A dropdown POI + BAN dans `docs/showcase/04.5-robustesse-regulateur/`
- Lien preview Vercel
</output>
