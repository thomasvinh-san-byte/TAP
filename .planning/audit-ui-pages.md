# Audit UI — patron de liste unifié (toolbar + pagination + actions)

> Doctrine durable issue de la Phase 06.53 (DEC-132). À relire avant toute
> nouvelle liste ou migration d'une liste existante.

## Problème observé (avant 06.53)

Les écrans de liste sur `data-table` étaient cohérents sur le **tableau**
(tri, EmptyState, lignes cliquables) mais **divergents au-dessus et en
dessous** :

- **Toolbars bricolées à la main**, alignements incohérents (`items-center`
  vs `items-end`), espacements ad hoc, actions tantôt à gauche tantôt à
  droite.
- **Paginations hétérogènes** : `/courses` utilisait un « Voir plus »
  cumulatif (offset additif côté serveur, la recherche ne portait que sur la
  fenêtre déjà chargée) ; drivers / vehicles / patients n'avaient **aucune**
  pagination (toutes les lignes rendues).
- Compteur d'éléments placé de façon variable (dans la toolbar, sous, ou
  absent).

## Patron retenu

Trois composants partagés dans `apps/web/src/components/data-table/`, logés
**autour** du `<DataTable>` existant (le data-table lui-même est inchangé) :

### 1. `ListToolbar` + `ListMeta` (`list-toolbar.tsx`, server-safe)

Contenant à slots : `search` (flex-1, min 260px) · `filters` · `clear` ·
`actions` (poussés à droite via `ml-auto`). Hauteur et espacement uniques
(`gap-12`). La toolbar ne porte que **la structure** ; les **valeurs métier**
(filtres, libellés, défauts) restent définies par chaque écran.

`ListMeta` = compteur discret (`text-muted-foreground text-sm tabular-nums`)
placé **sous** la toolbar, jamais dedans.

### 2. `Pagination` (`pagination.tsx`, client)

Par **plage** (« 1–50 sur 128 ») + Précédent/Suivant (grisés en bord, jamais
cachés) + sélecteur lignes par page **optionnel**.

**Règle clé — seuil :** `if (total <= pageSize) return null;`. Aucune barre
sous une liste courte. C'est le cœur de la cohérence : une liste de 3
véhicules n'affiche rien, une liste de 128 courses affiche la plage.

Pagination par **page** (offset = `page * pageSize`), pas « voir plus »
cumulatif. Indifférente au mode : l'appelant pilote `page` / `onPageChange`
et fournit `total` (client-side `slice` ou server-driven).

## Valeurs métier à PRÉSERVER lors de chaque migration (DEC-132 D-06)

La migration est **présentation seule**. Ne JAMAIS toucher :

- **Statuts CGSS** et leurs libellés (Validée / Affectée / En cours /
  Terminée / Annulée).
- **Filtre date par défaut = aujourd'hui** sur `/courses` (focus régulatrice).
- **Colonnes contextuelles** propres à chaque entité.
- **Formats FR / 974** (téléphones 0262/0263/0692/0693, CP 974, dates FR,
  `tabular-nums`).
- **pageSize par contexte** : rides = 50, patients = 25, véhicules = 50.
- Données, validation zod, Server Actions, RLS, chiffrement NIR : **inchangés**.
- **Pas de sélection multiple / bulk** (lot fonctionnel séparé).

## État de migration

| Liste | Fichier | État | Note |
|---|---|---|---|
| Courses | `(app)/courses/_components/rides-list.client.tsx` | ✅ migré | « Voir plus » → pagination par plage sur `FETCH_CAP=500` borné par date du jour ; ListToolbar + ListMeta ; pageSize 50 |
| Patients | `(app)/patients/_components/patients-list.client.tsx` | ✅ migré | ListToolbar (SegmentedControl + PatientSearch) + ListMeta + Pagination ; pageSize 25 |
| Véhicules | `(admin)/admin/vehicules/_components/vehicles-list.client.tsx` | ✅ migré | Pagination seule (pas de recherche/filtre existant) ; pageSize 50 ; démontre le seuil (flotte courte → aucune barre) |
| Chauffeurs | `(admin)/admin/chauffeurs/_components/*` | ⏳ à enchaîner | 645 LOC, actions `DropdownMenu` riches (4 actions DEC-029) — mécanique mais volumineux |
| Caisse | `(app)/courses/caisse/_components/*` | ⏳ à enchaîner | mêmes composants |
| Tarifs | `(admin)/admin/tarifs/_components/*` | ⏳ à enchaîner | mêmes composants |
| Legal (registre, demandes, …) | `(admin)/admin/legal/*` | ⏳ à enchaîner | gel Phase 1.5 — migrer sans mise en avant |

La partie restante est **mécanique** (mêmes 3 composants, même patron) et
sans risque métier tant que D-06 est respecté. À enchaîner en lot de suivi.

## Dette tracée

- `rides-list.client.tsx` reste à **356 LOC** (> 300 lignes, guideline
  CLAUDE.md §11). Pré-existant (était 360), légèrement réduit par la
  migration mais non scindé (hors périmètre 06.53). Découpe à prévoir avec
  l'extraction des colonnes / orchestrateur.
