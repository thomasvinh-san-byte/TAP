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

*Last updated : 2026-05-14 — DEC-034 inscrite, codification post-audit visuel Phase 04.*
