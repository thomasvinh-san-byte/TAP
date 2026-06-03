# Enquête open-source — dettes techniques Phase 06.7 (2026-06-01)

## Méthode et périmètre

Enquête menée le 2026-06-01 par recherche web ciblée sur la communauté open-source pour vérifier comment d'autres projets de transport sanitaire / NEMT / VRP traitent les 4 dettes identifiées à la clôture de Phase 06.7. Sources : dépôts GitHub (étoiles + commits 2024-2026), templates Vercel officiels, issues Vercel, documentation Géoplateforme IGN. Pas d'invention — chaque verdict s'appuie sur au moins une référence vérifiable.

## D1 — Hébergement Python solveur OR-Tools

**Comment d'autres résolvent :** aucun projet VRP open-source significatif ne déploie en serverless. Trois références observées :

- **VROOM** (~1700 étoiles, OPTITransLab) : container long-running, exposé via REST. Déploiement Docker classique recommandé.
- **KaRRi** (Karlsruhe Institute of Technology) : service en JVM long-running. Déploiement bare-metal ou conteneur.
- **pgRouting + VROOM** : combinaison PostgreSQL + container Python. Aucun déploiement serverless documenté.

**Pattern observé :** binaires natifs lourds (OR-Tools ~75 MB unzipped, VROOM ~50 MB), cold start incompatible avec UX régulatrice (1-3 s par requête déjà), pattern d'usage en burst (régulation matinale : 20-50 requêtes en 30 min, puis silence) sans bénéfice de scale horizontal.

**Verdict :** notre tentative initiale (Vercel Python serverless, 5 PR de fix infructueuses #195..#199) allait à contre-courant de la communauté. Une piste reste à essayer : déplacer Python hors `/api/` (template officiel `vercel/examples/nextjs-flask-starter`, issue Vercel #6598). Si cette tentative échoue → bascule Render Starter Docker (~7 $/mois, warm container, pas de cold start), alignée avec le pattern communautaire.

## D2 — Pipeline geocoding au moment création course

**Comment d'autres résolvent :** géocodage côté UI au moment de la saisie d'adresse, jamais au persist. Sources :

- **Médecin direct** (open-source FR, NEMT) : `nestjs/passport` côté backend + `react-autocomplete-input` côté UI avec BAN gouv.fr autocomplete. Lat/lng remontent dans l'`onChange` du picker.
- **Templates Mapbox / Google Maps** : pattern systématique `Place Autocomplete` qui retourne `{address, lat, lng, place_id}` dans le selectionne.
- **Géoplateforme IGN** (post-janvier 2026, successeur de `api-adresse.data.gouv.fr`) : endpoint `https://data.geopf.fr/geocodage/search` retourne `features[].geometry.coordinates = [lng, lat]` + `properties.citycode`. Rate-limit 50 req/s/IP — très loin de notre usage bêta.

**Pattern observé :** quand l'UI affiche l'autocomplete BAN/Géoplateforme, l'utilisateur sélectionne une suggestion (pas une saisie libre), donc on a déjà les coordonnées sans appel supplémentaire au persist. Coût marginal nul.

**Verdict :** notre composant `AddressPickerField` doit déjà avoir cette info disponible dans son `onChange` si l'autocomplete BAN/Géoplateforme est branché. À auditer :

- **Cas A** (le plus probable) : `onChange` retourne déjà `{address, lat, lng, citycode}`, il manque juste 4 lignes dans `createRide` Server Action pour extraire et persister. Effort estimé : 15 min.
- **Cas B** : `onChange` retourne `{address}` seul mais le composant tient les coords en state interne. Effort : 15-30 min pour étendre l'événement.
- **Cas C** : `AddressPickerField` n'utilise pas l'autocomplete (saisie libre), il faut le refactor pour brancher Géoplateforme. Effort : 2-4 h.

L'audit doit précéder l'engagement d'effort.

## D3 — Passe UX complète écran optimisation

**Comment d'autres résolvent :** le pattern « comparative view plan actuel / plan proposé » est rare dans l'open-source VRP (la plupart sont des outils techniques, pas des SaaS régulatrice). Sources les plus proches :

- **Onfleet** (commercial, fermé) : design comparative view à 3 colonnes, micro-interactions sur l'acceptation grain-fin. Pas open-source.
- **OptimoRoute** (commercial, fermé) : pattern « avant/après » avec animations de transition.
- Aucun pattern open-source directement réutilisable. La référence reste les heuristiques Linear, Stripe, Notion citées dans CLAUDE.md.

**Pattern observé :** la lecture A (labels lisibles) qu'on a livrée en Wave 4 est le minimum vital. La lecture B (structure visuelle « Plan actuel », polish, micro-interactions) nécessite retour terrain régulatrice + données réelles (post-D2) pour être priorisée correctement.

**Verdict :** différer. Le retour terrain n'a pas encore eu lieu avec des données réelles. Engager 8 h de polish sans retour utilisateur risque de produire du faux travail. La dette reste tracée dans `2026-06-01-phase-06.7-cloture.md`.

## D4 — Audit casts `as TYPE[]` sur retours Supabase

**Comment d'autres résolvent :** la communauté Supabase recommande le pattern `database.types.ts` généré + types inférés. Sources :

- **Documentation Supabase officielle 2026** : `supabase gen types typescript` + `createClient<Database>()` + destructuring `{ data, error }` propagé.
- **Pattern observé en projets de production** : audit progressif au fil des PR, jamais en lot massif (risque de régressions silencieuses).

**Verdict :** non urgent depuis le lot 2 audit D+A (PR #202) qui a propagé le destructuring `{ data, error }` + log sur 16 fichiers. La classe de bug `drivers(prenom, nom)` (lot 1, PR #201) ne peut plus s'installer silencieusement. L'audit casts reste tracé dans `2026-06-01-phase-06.7-cloture.md` pour traitement au fil des phases UI qui touchent ces composants.

## Trois patterns transversaux à graver

### Pattern 1 — Pas de serverless pour algorithmes coûteux

Critères concrets observés dans la communauté :

- binaires natifs > 30 MB (OR-Tools, VROOM, ML frameworks)
- cold start mesuré > 2 s
- pattern d'usage en burst sans bénéfice de scale horizontal (régulation matinale, créneaux exhaustifs)
- calcul > 1 s par requête

Si un ou plusieurs critères sont remplis, **préférer un container long-running** (Render, Fly.io, VPS auto-hébergé) au déploiement serverless. Le critère prime sur le coût : économiser 7 $/mois ne justifie pas un cold start de 30 s. À acter en ADR-009.

### Pattern 2 — Geocoding au moment de la saisie UI, pas du persist

L'autocomplete BAN/Géoplateforme/Mapbox/Google retourne déjà les coordonnées dans le `onChange`. Persister à partir des données du formulaire est gratuit en effort. Faire un appel HTTP au persist est un sur-coût inutile + un risque de rate-limit + un risque de désynchronisation adresse ↔ coords.

### Pattern 3 — BFF / Route Handler enrichit la réponse du microservice avant UI

Le microservice métier (solveur, ML, geocoding) doit rester focalisé sur sa logique pure et ne pas connaître l'UI. Le Route Handler côté serveur authentifié re-enrichit la réponse avec les labels lisibles avant de la passer au front. TAP applique déjà ce pattern en Wave 4 (`enrichProposal()` dans `apps/web/src/app/api/optimizer/route.ts`).

---

*Enquête synthétisée le 2026-06-01. Sources principales : VROOM (github.com/VROOM-Project), KaRRi (KIT), template `vercel/examples/nextjs-flask-starter`, issue Vercel #6598, Géoplateforme IGN documentation 2026, Supabase TypeScript docs 2026.*
