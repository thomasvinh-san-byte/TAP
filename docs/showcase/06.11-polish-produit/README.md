# Phase 06.11 — Polish produit

Captures attendues pour démontrer la valeur livrée par les 3 Waves
(Wave 1 tableau dirigeant, Wave 2 écran optimisation, Wave 3 finition).

## Captures attendues

Convention : PNG ≤ 500 Ko, viewport `1280×720` ou `1920×1080`, navigateur
mode régulateur (Chromium recommandé, zoom 100 %), session
`dirigeant@demo.tap` (cf. seed `supabase/seed.demo.sql`).

Nommage strict : `XX-slug.png` où XX est l'ordre de présentation.

| Fichier                                       | URL à visiter           | État attendu visible                                                                                                                                                | Wave   |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `01-tableau-dirigeant-sla-badges.png`         | `/tableau-de-bord`      | Tableau dirigeant complet. Carte « Délais légaux » visible entre « À traiter » et « Activité ». Cas seed propre : état neutre « Délais légaux respectés » (Check).  | Wave 1 |
| `02-tableau-dirigeant-comparatif-mois.png`    | `/tableau-de-bord`      | Sous-grille « CA encaissé du mois » + « Volume du mois » avec delta `↗ +X %` ou `↘ -X %` et valeur du mois précédent en clair. Cadrer la section « Activité ».      | Wave 1 |
| `03-optimisation-badges-cluster.png`          | `/cockpit/optimisation` | État `result` après clic « Lancer le calcul ». ≥ 2 groupements affichés à droite avec bordure gauche colorée distincte + pastille à côté du titre. Badges B3 sur chaque course (transport en bleu/violet/cyan/rose, urgence en ambre/rouge si !== programmée). Pastilles colorées dans la liste « Plan actuel » alignées sur les couleurs de groupement. | Wave 2 |
| `04-optimisation-recalculer.png`              | `/cockpit/optimisation` | État `result` cadrant uniquement le header : bouton « ↻ Re-calculer » visible à droite, à côté de « Fermer ». Tooltip si possible (hover).                          | Wave 2 |
| `05-empty-state-patients.png`                 | `/patients`             | Page patients avec liste vide (scope `Actifs`, pas de recherche en cours). Composant `<EmptyState>` rendu : icône `Users`, titre « Aucun patient enregistré », description, bouton « + Nouveau patient ». | Wave 3 |

## Comment capturer

### Prérequis

1. **Cloud preview** (recommandé) — accéder à la dernière preview Vercel de la branche merge sur main :
   ```
   https://tap-<hash>-thomasvinh-san-byte.vercel.app
   ```
   Le seed démo est appliqué automatiquement par `.github/workflows/cd.yml` à chaque push main.

2. **Local** (alternative) — démarrer la stack :
   ```bash
   pnpm --filter @tap/web dev
   # Dans un autre shell, appliquer le seed démo si non déjà fait :
   psql "$DATABASE_URL" -f supabase/seed.demo.sql
   ```

### Session démo

- Se connecter avec `dirigeant@demo.tap` / `demo1234!`.
- Pour la capture `05-empty-state-patients.png` : utiliser un compte
  démo SANS patients en seed (ou créer une organisation neuve), sinon
  l'état empty n'apparaît pas.

### Capture

- Chrome DevTools → Device Toolbar → viewport `1280×720` ou `1920×1080`.
- Cmd+Shift+P → « Capture screenshot » (zone visible suffit pour les 5 captures).
- Compression : `pngquant --quality=80-95 fichier.png` pour rester sous 500 Ko.
- Déposer dans `docs/showcase/06.11-polish-produit/` avec le nom exact du
  tableau ci-dessus.

## Aucune donnée patient réelle

Les captures ne doivent JAMAIS contenir :

- de NIR réel (le seed démo génère des NIR fictifs avec clé Luhn correcte) ;
- de nom propre identifiable hors seed (cf. `.planning/regle-neutralite-et-ton.md`) ;
- de numéro de téléphone non fictif.

Si une capture montre par erreur des données réelles : la supprimer,
recapturer avec le seed démo. Pas de blur en post-prod (artefact visible
en démo).
