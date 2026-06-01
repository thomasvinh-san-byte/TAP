# ADR-008 — Hébergement de `services/optimizer` sur Vercel Python serverless

- **Statut** : Accepté
- **Date** : 2026-06-01
- **Remplace** : aucun (clôt DEC-079 CANDIDATE inscrite Wave 1 le 2026-05-27)
- **Affecte** : `services/optimizer`, Phase 06.7 Wave 3, DEC-079, DEC-080

## Contexte

Le microservice Python OR-Tools `services/optimizer` a été livré en Wave 1 de
la Phase 06.7 (PR #185) comme un workspace Docker portable, puis neutralisé
de toute mention de fournisseur en Wave 1bis (PR #186). La Wave 3 de la phase
va ajouter le cockpit régulateur et un test E2E Playwright sur preview Vercel
qui exige une URL publique du solveur.

Le `Dockerfile` lit `PORT` au runtime — comportement standard d'un hébergeur
de conteneurs — ce qui laisse le choix ouvert tant que la décision n'est pas
prise.

Trois faits cadrent la décision :

1. **Contrainte budgétaire.** Instruction dirigeant : pas de dépense
   supplémentaire si la stack en place sait déjà faire. Le projet paie déjà
   un plan Vercel pour `apps/web` et un plan Supabase Pro pour la base.
2. **Payload dé-identifié (D-08, CONTEXT.md Phase 06.7).** Le solveur ne
   reçoit que des IDs opaques, des coordonnées et des horaires — aucune
   donnée patient identifiante. Un hébergement non-HDS est acceptable en
   bêta, conformément à la trajectoire HDS Phase 09 (DEC-077).
3. **Profil d'exécution du solveur (CONTEXT.md §Architecture).** Le
   `time_limit` OR-Tools est calé à 2-5 s ; le calcul est pur, sans écriture
   en base (D-14, D-18), donc naturellement sans état entre appels.

## Décision

Héberger `services/optimizer` sur **Vercel Python serverless**, dans le même
projet Vercel que `apps/web`, sous la forme d'une fonction serverless
FastAPI (`/api/optimizer/solve` ou route équivalente exposant l'endpoint
existant).

Discipline technique imposée par cette décision :

- **`time_limit` solveur plafonné à 3 secondes en production** (contre 5 s
  permis localement) pour conserver une marge confortable contre la limite
  d'exécution serverless. La recherche d'origine avait calé 2-5 s ; on
  retient la borne basse en prod.
- **Mesure du cold start au premier déploiement Wave 3.** Si le démarrage
  à froid dépasse 5 s observé sur 10 appels consécutifs après inactivité,
  documenter et déclencher le repli.
- **Repli documenté : Clever Cloud** (opérateur français, offre HDS
  disponible, cohérent avec DEC-077 cible Phase 09). Le `Dockerfile` neutre
  est conservé pour permettre une bascule sans réécriture.
- **Payload dé-identifié maintenu** (D-08). Aucun champ patient/nom/NIR
  ne sort de l'application Next.js.

## Alternatives considérées

1. **Supabase Edge Functions** — éliminé. Le runtime est Deno/TypeScript
   uniquement ; le support Python est demandé de longue date sans roadmap
   acceptée (issues `supabase/supabase#22944`, `supabase/supabase#41990`).
   Pyodide/WASM existe en preview communautaire mais reste inadapté à une
   bibliothèque mathématique compilée comme OR-Tools.
2. **Vercel Python serverless** — **retenu**. Documenté comme runtime
   natif pour FastAPI/ASGI (cf. `vercel.com/docs/functions/runtimes/python`).
   Limites par fonction documentées dans `vercel.com/docs/functions/limitations`.
   Coût marginal nul : la fonction s'inscrit dans le plan Vercel déjà payé
   pour `apps/web`.
3. **Hébergeur Docker dédié (Railway / Render / Fly.io / Clever Cloud)** —
   viable, ~5-7 USD/mois pour un service Docker permanent, sans contrainte
   de durée d'exécution. Repoussé : ajoute un fournisseur, un compte, une
   ligne de facturation, et un canal de déploiement séparé de `git push`.
   Conservé en plan de repli (cf. ci-dessus).

## Conséquences

- **Zéro nouvelle dépense.** La fonction Python s'inscrit dans le plan
  Vercel courant.
- **Déploiement unifié.** Un seul `git push` met à jour `apps/web` et le
  solveur. Pas de pipeline séparé.
- **Surveillance Wave 3.** Le cold start et le temps réel d'exécution
  doivent être instrumentés dès le premier déploiement. Sentry/logs suffisent.
- **Le `Dockerfile` reste utile** comme garantie de portabilité (repli
  Clever Cloud) et pour le développement local.
- **DEC-079 promue CANDIDATE → LOCKED** avec ce wording (cf. PROJECT.md).

## Sources

- Documentation Vercel — runtime Python : `vercel.com/docs/functions/runtimes/python`
- Documentation Vercel — limites fonctions serverless : `vercel.com/docs/functions/limitations`
- Documentation Vercel — durée maximale d'exécution par plan : `vercel.com/docs/functions/runtimes` (plan Hobby vs Pro)
- Supabase Edge Functions — runtime Deno : `supabase.com/docs/guides/functions`
- Supabase issue tracker — demandes de support Python : `github.com/supabase/supabase/issues/22944`, `github.com/supabase/supabase/issues/41990`
- OR-Tools — taille du paquet PyPI : `pypi.org/project/ortools/`
- DEC-077 (renumérotation HDS Phase 09) et CONTEXT.md Phase 06.7 (D-08 payload dé-identifié).
