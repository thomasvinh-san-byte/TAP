# UI Patterns TAP — Design system 2026

> Référence transverse créée 2026-05-14 (DEC-034) après audit visuel post-Phase 04.
> Source de vérité du design system pour toutes les pages admin et opérationnelles.
> Pas de refactor immédiat des pages existantes : alignement progressif Phase 04.5+
> selon priorisation UAT dirigeant.

---

## Philosophie

TAP est un SaaS de régulation operations (NEMT) utilisé 8 h/jour par une régulatrice power user. La densité d'information et la rapidité d'action priment sur le polish marketing. Inspirations directes : **Linear**, **Stripe Dashboard**, **Cal.com**, **satnaing/shadcn-admin**.

**Règles directrices** :
- **Densité > décoration** : une ligne = un item, pas une card aérée
- **Color = signal** : never use red unless something is broken (traffic light : green = good, amber = warning, red = critical)
- **Spacing scale 8 px** : 4, 8, 12, 16, 24, 32, 48, 64
- Le tableau bat les cards pour scanner > 5 items
- Le détail est dans le Sheet, pas dans la card

---

## Layout pages admin

Toutes les pages `/admin/*` suivent la même grille :

```
┌─────────────────────────────────────────────────┐
│ <h1>Titre</h1>                                  │
│ <p>Sous-titre descriptif</p>                    │  ← Header
├─────────────────────────────────────────────────┤
│ [Filtres pills]  [Recherche]  [+ Nouveau]      │  ← Toolbar
├─────────────────────────────────────────────────┤
│ ┃ Liste divide-y rounded-md border             │
│ ┃ Item 1 dense                                  │  ← Liste
│ ┃ Item 2 dense                                  │
│ ┃ Item 3 dense                                  │
│ └─                                              │
└─────────────────────────────────────────────────┘

+ Sheet latéral droit pour édition complète
```

### Header

```tsx
<header>
  <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
  <p className="text-sm text-muted-foreground">{sous-titre}</p>
</header>
```

Pas de bouton « Nouveau » dans le header lui-même. Le bouton appartient à la toolbar pour aligner avec filtres et recherche.

### Toolbar

```tsx
<div className="flex flex-wrap items-center justify-between gap-12">
  <div className="flex items-center gap-8">
    {/* Filtres pills */}
    <FilterPills />
    {/* Compteur ex. "3 chauffeurs" */}
    <span className="text-sm text-muted-foreground">{count} items</span>
  </div>
  <div className="flex items-center gap-8">
    {/* Recherche optionnelle */}
    <SearchInput />
    {/* Bouton primary à droite */}
    <Button><Plus /> Nouveau</Button>
  </div>
</div>
```

### Liste

```tsx
<ul className="divide-y divide-border rounded-md border border-border">
  {items.map((item) => (
    <li key={`${item.id}-${item.status}`}>
      <ListItem item={item} />
    </li>
  ))}
</ul>
```

Clé inclut un champ mutable (DEC-033). `divide-y` pour séparateurs discrets. Border global `rounded-md` pour cohérence.

### ListItem dense

```tsx
<button
  onClick={() => openSheet(item)}
  className="flex w-full items-center gap-12 px-16 py-12 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
>
  {/* Avatar : InitialsAvatar pour humain, icône muted pour objet */}
  <InitialsAvatar name={item.nom} size={32} role={item.role} />

  {/* Identité + meta */}
  <div className="flex-1 min-w-0">
    <div className="text-sm font-semibold truncate">{item.nom}</div>
    <div className="text-xs text-muted-foreground truncate">{item.meta}</div>
  </div>

  {/* Badges sémantiques droits (1-3 max) */}
  <div className="flex items-center gap-4">
    <Badge variant="outline">{item.type}</Badge>
    <StatusBadge status={item.status} />
  </div>

  {/* Actions inline si fréquentes, sinon DropdownMenu */}
  <RowActions item={item} />
</button>
```

Hauteur ligne : **~64-72 px**. Pas plus aéré. Patient = 32 px avatar + 2 lignes de texte + badges = optimal scan.

### Sheet édition

Le clic sur la ligne ouvre un Sheet latéral droit avec tout le détail + formulaire d'édition. Pas de modal pleine page, pas de drawer bottom.

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent className="w-[480px] sm:w-[560px]">
    <SheetHeader>
      <SheetTitle>{item.nom}</SheetTitle>
      <SheetDescription>{item.meta}</SheetDescription>
    </SheetHeader>

    {/* Form sections */}
    <form className="space-y-24 mt-24">
      {/* Sections séparées par border-t */}
    </form>

    {/* Actions destructive en bas séparées */}
    <div className="mt-24 border-t border-border pt-16">
      <Button variant="ghost" className="text-destructive">
        Archiver
      </Button>
    </div>
  </SheetContent>
</Sheet>
```

---

## Badges sémantiques

Système Badge cohérent toute l'app :

| Famille | Variant / class | Exemples |
|---|---|---|
| Type métier (neutre) | `variant="outline"` | TAXI, TPMR, VSL, AMBULANCE |
| Statut activité (vert) | `variant="default"` + `bg-success/10` | Actif, Activée |
| Statut neutre (gris) | `variant="secondary"` | Programmée, Compte actif, Désactivé |
| Statut warning (amber) | custom class `bg-warning/10` | Invitation expirée, En attente |
| Statut critique (rouge) | `variant="destructive"` | Archivé, Annulée, Bloqué |

**Règle** : maximum 3 badges par ligne. Si > 3, regrouper en tooltip.

---

## Avatars

**Humain** (patient, chauffeur, régulateur, dirigeant) :
- `InitialsAvatar` coloré
- Tailles : 24 (compact), 32 (liste), 40 (header sheet)
- Couleur par rôle (palette définie)

**Objet** (véhicule, document, élément métier) :
- Icône Lucide dans cercle muted
- Tailles identiques
- Couleur neutre

---

## Color tokens

Variables Tailwind (déjà définies dans le repo) :

| Token | Usage |
|---|---|
| `--primary` | bleu marine TAP (CTA principal) |
| `--secondary` | gris neutre (CTA secondaire) |
| `--muted` | gris très clair (backgrounds discrets) |
| `--accent` | turquoise (highlights ponctuels) |
| `--destructive` | rouge (suppression, archivage) |
| `--warning` | ambre (alertes) |
| `--success` | vert (validation) |

**Règle d'or** : utiliser sparingly. Une page admin avec > 3 couleurs saturées est trop chargée. Privilégier neutres + 1 accent + 1 signal.

---

## Filtres pills

Pour basculer entre vues (Actifs/Archivés, Aujourd'hui/Demain, etc.) :

```tsx
<div className="inline-flex rounded-md border border-border bg-muted/40 p-2">
  <button className={cn(
    'px-12 py-6 text-sm rounded-sm transition-colors',
    active ? 'bg-background shadow-sm text-foreground'
           : 'text-muted-foreground hover:text-foreground'
  )}>
    Actifs
  </button>
  <button className={...}>
    Archivés
  </button>
</div>
```

Pattern **segmented control iOS-like**. Visible mais discret. Pas plus de 3-4 options sinon `Tabs` ou `Select`.

---

## Sidebar navigation

`shadcn/ui Sidebar` component depuis fin 2024 :
- Persistant desktop (md+), Sheet drawer mobile
- Collapsible icon-only via `SidebarTrigger`
- Persistance état via cookie
- Sections par groupe sémantique (Patients / Courses / Admin)

Pas de tabs en haut de page. La navigation principale est sidebar.

---

## Loading + empty states

**Loading** : `Skeleton` shadcn de structure identique à la liste réelle.

**Empty** : bloc centré avec icône Lucide + titre + description + CTA.

```tsx
<div className="flex flex-col items-center gap-12 rounded-md border border-dashed border-border py-48 text-center">
  <UserPlus className="h-32 w-32 text-muted-foreground" />
  <div>
    <h3 className="text-sm font-semibold">Aucun chauffeur</h3>
    <p className="text-xs text-muted-foreground">
      Ajoutez un premier chauffeur pour pouvoir affecter des courses.
    </p>
  </div>
  <Button>Nouveau chauffeur</Button>
</div>
```

---

## Anti-patterns à proscrire

- Cards individuelles avec ombres pour items de liste (mange whitespace, fragmente le scan)
- Avatars > 40 px hors header (gaspille hauteur ligne)
- Plus de 3 badges par ligne (illisible)
- Modal pleine page pour édition (préférer Sheet)
- Action destructive groupée avec actions positives (toujours séparée par `border-t`)
- Use de rouge pour autre chose qu'une erreur ou destruction
- Spacing custom hors scale 8 px
- Mode nuit V1 (reporté Phase UI dédiée DEC-020)

---

## Pages à auditer

Ces pages utilisent l'ancien pattern et devraient être alignées en Phase 04.5 ou ultérieure :

- `/admin/chauffeurs` : currently mix pattern, point d'entrée des questions design (PR #60 DEC-029)
- `/admin/vehicules` : pattern ancien strict (divide-y, Sheet) — ✓ référence proche du pattern cible
- `/admin/legal/*` : à auditer

---

## Références externes

- **Linear** (`linear.app`) : densité, command palette, palette neutre
- **Stripe Dashboard** : badges status, tableaux dense, exports
- **Cal.com** (`cal.com`) : OSS Next.js + shadcn, gestion calendaire
- **satnaing/shadcn-admin** : benchmark open source

---

## Performance BDD — indexes obligatoires (Phase 04.7-bis-perf 2026-05-15)

Patterns Supabase + PostgreSQL pour éviter les frictions performance UAT :

- **Toute FK doit avoir un index B-tree** : Supabase ne crée pas auto, contrairement à certains ORMs. Sans index, les jointures et `ON DELETE CASCADE` font un seq scan
- **Toute colonne dans `WHERE`/`JOIN`/`ORDER BY` fréquent doit avoir un index** : `(organization_id, status)`, `(scheduled_at desc)`, `(patient_id)` etc.
- **Toute recherche fuzzy `ILIKE '%x%'`** nécessite **`pg_trgm` extension + index GIN** `gin (col gin_trgm_ops)`. Sans index, le full table scan donne 100-1000ms typique selon volume
- **Toute RLS policy utilisant `auth.uid()` ou `current_organization_id()`** doit le wrapper en **`(SELECT auth.uid())`** ou **`(SELECT public.current_organization_id())`**. La sous-requête simple est traitée comme initPlan PostgreSQL — évaluée UNE FOIS par statement au lieu de per-row. **Speedup jusqu'à 100x sur tables denses**
- **Tester perf via Supabase Query Performance Dashboard** régulièrement (pg_stat_statements visible dans dashboard)
- **EXPLAIN ANALYZE** en cas de doute sur une query lente : confirme l'utilisation des indexes

Anti-patterns interdits :
- ❌ Créer une FK sans index sur la colonne référençante
- ❌ Recherche fuzzy `ILIKE %x%` sans index trigram
- ❌ RLS policy avec `column = auth.uid()` direct (per-row eval)
- ❌ Optimiser aveuglément sans diagnostic Phase A préalable (mesure first)

## Performance SSR — Server Components patterns (Phase 04.7-bis-perf)

Patterns Next.js 14 App Router pour pages liste avec données serveur :

- **`select()` ciblé** sur colonnes effectivement utilisées dans le rendu. `RIDE_COLUMNS` constant string réutilisé entre queries enrichies (`queries-enriched.ts`). Évite `select('*')` qui transporte des colonnes inutiles
- **Suspense streaming** sur pages avec queries lourdes : shell de page (header + toolbar) s'affiche immédiatement, la table arrive ensuite. UX perçue beaucoup plus rapide. Skeleton component minimaliste en fallback
- **`Promise.all` pour queries indépendantes** : `[patientsRes, driversRes, vehiclesRes] = await Promise.all([...])`. Gain -50% temps si queries vraiment indépendantes (pas de dépendance de données)
- **`'use client'` au plus petit composant interactif** : pas sur la page entière. La page reste Server Component, seuls les sous-composants interactifs sont Client
- **Pas de fetch dans loops (N+1)** : utiliser jointures Supabase `select('id, patient:patients!inner(nom)')` ou `in('id', ids)` avec aggregation JS

Anti-patterns interdits :
- ❌ `select('*')` sur table dense (paiement, audit_logs, etc.)
- ❌ Queries séquentielles si indépendantes (gâche temps)
- ❌ `'use client'` sur page entière (perd SSR streaming)
- ❌ Fetch dans `.map()` ou loop (N+1 latencies cumulées)

## Mesure performance — outils minimaux V1.5 (Phase 04.7-bis-perf)

Pour valider les optimisations avant/après sans Sentry/Web Vitals (Phase 06) :

- **Firefox/Chrome DevTools → Network tab** : durées HTTP per request, baseline mesurable
- **Cocher « Persist Logs » + « Disable Cache »** pour éliminer le cache navigateur
- **Supabase Query Performance dashboard** : top slow queries, fréquence, p95/p99 (déjà disponible cloud)
- **EXPLAIN ANALYZE** sur queries suspectes via Supabase SQL Editor : confirme plan d'exécution
- **Procédure baseline → fix → mesure** : documenter baseline AVANT optim dans CONCERNS.md, mesurer APRÈS sur même environnement, calculer gain %

Outils différés Phase 06 production-grade :

- Sentry performance monitoring (web vitals automatique)
- Log drain Supabase → datadog/grafana
- Index Advisor périodique automatisé
- Lighthouse audit complet pages publiques + privées

---

*Last updated : 2026-05-14 — DEC-034 inscrite, codification post-audit visuel Phase 04. 2026-05-15 — 3 sections ajoutées Phase 04.7-bis-perf (Performance BDD indexes obligatoires + Performance SSR patterns + Mesure performance outils minimaux V1.5).*
## Tables denses — gestion overflow (Phase 04.7-bis hotfix UX élargi)

Pattern Linear/Stripe/Notion pour confiner le scroll horizontal des tables denses SaaS B2B :

- **Truncation cellules longues** : `max-w-[180px] truncate` + `title={value}` attribute pour tooltip natif au hover
- **Short-form pour adresses** : afficher uniquement le préfixe « avant la virgule » (« EHPAD Les Lataniers » au lieu de « EHPAD Les Lataniers, 97419 La Possession »). Helper `shortAddress(full)` réutilisable
- **Container parent** : `min-w-0` permet le shrink, `overflow-x-auto` sur le wrapper table confine le scroll H résiduel à la table (pas à la page entière)
- **Pas de stack mobile** : SaaS desktop-first régulatrice 8h/jour. La table reste table. Mobile view dédiée différée Phase 06+ si feedback terrain
- **Pas de sticky first column V1** : truncation devrait suffire. Sticky col réservé scroll H résiduel inévitable (Phase 06+)

Anti-patterns interdits :
- ❌ Forcer `white-space: nowrap` sur cellule sans `truncate + title` (texte coupé sans tooltip = perte d'info)
- ❌ Stack mobile pour table SaaS B2B (le user déroule horizontalement comme Excel)
- ❌ Refonte responsive complexe (breakpoints multiples = maintenance lourde, hors pattern Linear/Stripe)

## Soft-delete healthcare (Phase 04.7-bis hotfix UX élargi)

Pattern HSE/HIPAA/GDPR pour archivage avec conservation obligatoire 5-10 ans (dossiers santé) :

- **Schéma BDD** : `archive boolean default false` + `archive_at timestamptz NULL`. Pas de hard-delete V1.5
- **Tabs Actifs / Archivés** dans la liste (déjà pattern Chauffeurs Phase 04). Default = Actifs
- **Permissions asymétriques** :
  - Archiver = régulateur + dirigeant (action courante)
  - Réactiver = dirigeant uniquement (action sensible, contrôle hiérarchique)
- **Confirmation modale wording RGPD/HDS explicite** :
  - Archiver : « ... masqué des listes actives mais conservé conformément aux obligations RGPD/HDS. Cette action est réversible. »
  - Réactiver : « ... redeviendra visible dans les listes actives. »
- **Server Action** :
  - `archive*Action` : `requireAdminOrRegulateur` + UPDATE + DEC-041 row count check + audit_logs `entity.archived`
  - `unarchive*Action` : `requireDirigeant` + UPDATE + DEC-041 + audit_logs `entity.unarchived`
- **Pickers / sélecteurs** : filtrer `archive=false` par défaut (le picker patient pour saisie course ne propose pas les archivés)
- **Hard-delete** : Phase 06 HDS uniquement sur demande RGPD explicite (droit à l'effacement) — pas de bouton « Supprimer » côté UI

## Layout unique config-driven (Phase 04.7-bis hotfix UX élargi)

Pattern shadcn/ui 2024+ : un seul layout shell principal, navigation config-driven avec roles[] pour RBAC.

- **Un seul header sticky** : titre « TAP Régulation » + nav tabs + UserMenu. Pas de header alternatif « TAP Administration » disjoint
- **Nav config** : `BASE_TABS` + extension conditionnelle selon rôle :
  ```ts
  const BASE_TABS = [{ href: '/patients', label: 'Patients' }, ...];
  const ADMIN_EXTRAS = [{ href: '/admin/vehicules', label: 'Véhicules' }, ...];
  const tabs = isDirigeant ? [...BASE_TABS, ...ADMIN_EXTRAS] : BASE_TABS;
  ```
- **Route groups Next.js `(admin)` acceptables** UNIQUEMENT s'ils partagent le shell visuel avec `(app)`. Pas 2 shells disjoints
- **Sous-routes `/admin/legal/*` = exception justifiée** (dirigeant only, conformité RGPD séparée). Pour le reste, viser cohérence
- **Déplacement physique des routes différé Phase 06 HDS** : nécessite audit complet + refactor tests, hors scope hotfix-bis. Refactor du `(admin)/layout.tsx` pour réutiliser le shell de `(app)/layout.tsx` = mitigation pragmatique V1.5

## Déploiement custom domain Vercel (Hotfix 2026-05-18)

Pattern obligatoire dès ajout d'un nouveau domaine custom sur Vercel :

- **Supabase Auth Site URL** = URL du domaine final où les cookies de session doivent fonctionner. Sans cet alignement, les sessions sont rejetées sur le custom domain → boucle middleware infinie.
- **Supabase Auth Redirect URLs** : ajouter wildcards pour les URLs auto-générées Vercel (`tap-*-tvss-projects-XXX.vercel.app/**`) pour ne pas casser les preview PR.
- **vercel.json en monorepo** : minimal absolu. Garder uniquement `framework` + `regions` + éventuellement `headers/rewrites`. Toute configuration Build/Output/Root/Install/Ignore appartient aux Project Settings dashboard.
- **Pas d'`ignoreCommand`** sauf besoin avéré et testé. Le pattern standard `if branch = main then build else skip` est trop agressif pour les workflows GSD qui utilisent les PR previews pour UAT.

Anti-patterns interdits :

- ❌ `vercel.json` avec `buildCommand` + `outputDirectory` quand Project Settings sont déjà configurés (conflit garanti, bannière jaune dashboard)
- ❌ `ignoreCommand` non testé (peut bloquer Production sans warning)
- ❌ Ajouter custom domain Vercel sans MAJ Supabase Site URL
- ❌ Tester UAT uniquement sur URLs auto-générées Vercel (manque les bugs domain custom comme cookie session rejeté)

Checklist nouveau domaine Vercel :

1. Ajouter le domaine dans Vercel Project Settings → Domains
2. Mettre à jour Supabase Auth Site URL → nouveau domaine
3. Garder dans Supabase Auth Redirect URLs les wildcards des URLs auto-générées Vercel (`tap-*-tvss-projects-XXX.vercel.app/**`)
4. Tester en navigation privée sur le nouveau domaine : `/login` doit servir page (200), login doit redirect `/patients`, navigation doit être fluide

## Migrations RLS récursion (Hotfix 2026-05-18)

Pattern obligatoire pour toute migration qui redéfinit une fonction appelée dans des policies RLS :

- **SECURITY DEFINER obligatoire** si la fonction `SELECT` depuis une table protégée par RLS qui invoque cette fonction dans sa policy. Sinon récursion infinie → erreur 500.
- **Conserver les commentaires explicitant** la raison du `SECURITY DEFINER` (cf `foundations.sql` ligne 125-126).
- **Wrapping interne `(SELECT auth.uid())` compatible avec `SECURITY DEFINER`** : la combinaison apporte le double bénéfice (bypass RLS + initPlan PostgreSQL).

Anti-patterns interdits :

- ❌ Migration redéfinissant une fonction `security definer` en `security invoker` sans audit récursion
- ❌ Wrapping policies sans tester CRUD basiques post-application
- ❌ Ignorer les commentaires de `foundations.sql` qui documentent pourquoi une fonction est `security definer`
- ❌ UAT post-migration limité à UI sans validation logs Supabase API

## Custom domain Vercel + Supabase Auth (Pattern validé 2026-05-18)

Checklist obligatoire dès l'ajout d'un nouveau domaine custom :

1. **Vercel Project Settings** :
   - Root Directory = `apps/web` (pour monorepo)
   - Framework Preset = Next.js
   - Build / Output / Install Command : Override **DÉSACTIVÉ** (Pattern A officiel Vercel = auto-détection)
   - Include files outside Root Directory : Enabled
   - `vercel.json` racine repo : minimal (`framework` + `regions`)

2. **Supabase Auth URL Configuration** :
   - Site URL = domaine custom final (`https://tap-web-brown.vercel.app`, pas l'URL auto-générée `tap-web-xxx-tvss-projects.vercel.app`)
   - Redirect URLs : ajouter 6+ entrées :
     - Custom domain + `/**`
     - Wildcard URLs Vercel auto-générées (`tap-*-tvss-projects.vercel.app/**`)

3. **Trigger redeploy après changements config** :
   - Force redeploy via Vercel dashboard, sans cache
   - Vérifier bannière jaune « Configuration differs » disparue
   - Tester en navigation PRIVÉE le custom domain `/login`

4. **Page racine `/` requise** :
   - Sans `page.tsx` racine, Next.js retourne 404 brut sur `/`
   - Solution : `page.tsx` Server Component qui redirige selon auth (`user` → `/patients`, sinon `/login`)
   - Pattern SaaS B2B standard (Linear / Notion / Stripe)

Anti-patterns interdits :

- ❌ `vercel.json` override Project Settings dashboard
- ❌ `ignoreCommand` non testé (peut bloquer Production)
- ❌ Site URL Supabase pointant vers URL auto-générée Vercel
- ❌ Pas de page racine (404 brut UX inacceptable)

## Terminologie médicale française (Hotfix 2026-05-18)

Pour TAP CGSS Réunion (santé/social FR), conventions terminologie :

- **« Sexe »** (pas « genre ») : donnée administrative liée au remboursement sécu sociale, conforme NIR / HAS / CNIL.
- **Options Select sexe** : F / M / Non précisé (pas « Autre » ambigu).
- **« État civil »** pour la section identité (pas « Identity »).
- **« Date de naissance »** (pas « Date naissance » ni « Naissance » seul).

Anti-patterns interdits :

- ❌ « Genre » dans formulaires médicaux/santé/sécu (anglicisme tech)
- ❌ « Autre » comme option de sexe (ambigu, préférer « Non précisé »)
- ❌ Champs identité sans label clair (« First name » au lieu de « Prénom »)

Note implémentation : le label visible change, mais le `name`/`id` HTML peut rester historique (`genre`) si la colonne BDD s'appelle ainsi — pas de refactor schéma forcé pour UX.

## Autocomplete adresse (Hotfix 2026-05-18)

Pattern obligatoire pour tous les champs adresse dans le produit :

- **Autocomplete BAN / Géoplateforme** sur la saisie ligne 1 (composant partagé `AddressPickerField`)
- **Fallback saisie libre** si l'API ne trouve pas l'adresse (ne JAMAIS bloquer la création patient/course — saisie de noms de rues exotiques 974 fréquente)
- **Auto-remplissage code postal + ville** après sélection adresse (UX bonus terrain, ✅ livré Phase 04.7-bis PR #107 — voir section « Propagation détails V2 » ci-dessous)
- **Validation côté serveur** : re-géocoder l'adresse via API au moment du save (cohérence + détection adresses fantaisistes, Phase 06)
- **Réutilisation du composant** : pour les formulaires natifs Server Action / FormData, wrapper local avec hidden `<input name="...">` qui mirror la valeur (pattern `PatientAddressField`)

Anti-patterns interdits :

- ❌ Input HTML brut sans autocomplete pour adresses françaises
- ❌ Bloquer la création si BAN ne trouve pas
- ❌ Stocker l'adresse en string libre sans normalisation BAN
- ❌ Dupliquer la logique BAN dans chaque formulaire (utiliser `AddressPickerField` partagé)

## Autocomplete adresse — Propagation détails (Hotfix 2026-05-18 V2)

Pattern étendu pour l'autocomplete BAN :

- **Remonter la suggestion complète au parent** via callback optionnel `onSelect: (BanSuggestion) => void`
- **Pré-remplir les champs liés** : code postal, ville, lat/lng quand l'utilisateur sélectionne (réduction erreurs saisie)
- **Override manuel toujours possible** : l'auto-remplissage est un point de départ, pas un blocage
- **Fallback saisie libre** : si l'utilisateur tape une adresse hors BAN (lieu-dit, exploitation agricole), pas de pré-remplissage mais la création reste possible

Architecture pour partager le state entre composants liés :

- **Lift state up** au parent de la section qui contient les champs liés (ex : `CoordinatesSection` pour adresse + CP + ville)
- **Callback `onSelect`** sur le composant adresse, qui set le state parent
- **Composants enfants contrôlés** ou **key-remount** (`key={cp + '|' + ville}`) pour forcer le re-render après set parent (workaround V1.5 si refactor composant contrôlé reporté)

Anti-patterns interdits :

- ❌ Autocomplete adresse qui ne remonte que le label (perd CP + ville → utilisateur ressaisit)
- ❌ Champs liés indépendants (utilisateur doit ressaisir)
- ❌ Bloquer la saisie si BAN ne trouve pas (perte de productivité)
- ❌ Breaking change sur composant partagé (préférer callback optionnel pour préserver les consommateurs V1)

---

*Last updated : 2026-05-14 — DEC-034 inscrite, codification post-audit visuel Phase 04. 2026-05-15 — 3 sections ajoutées Hotfix 04.7-bis élargi (tables denses overflow + soft-delete healthcare + layout unique config-driven). 2026-05-18 — section « Déploiement custom domain Vercel » ajoutée Hotfix Vercel + Supabase URLs. 2026-05-18 — section « Migrations RLS récursion » ajoutée Hotfix régression PR #101. 2026-05-18 — section « Custom domain Vercel + Supabase Auth » ajoutée Hotfix racine PR #104 + leçons marathon. 2026-05-18 — sections « Terminologie médicale française » + « Autocomplete adresse » ajoutées Hotfix patient form PR #105. 2026-05-18 — section « Autocomplete adresse — Propagation détails V2 » ajoutée Hotfix patient form V2 PR #107. 2026-05-18 — alignement doc PR #108 (REQUIREMENTS PAT-01 sexe, ligne 478 auto-remplissage livré PR #107).*
