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

## Complément 2026-06-01 — choix architecture déploiement : Option A (Vercel Services)

Décision dirigeant : **Option A — Vercel Services**. Un seul projet Vercel
contient à la fois `apps/web` (Next.js) et `services/optimizer` (Python
FastAPI), routage par sous-chemin URL (`/optimizer/*` vers le service Python,
le reste vers Next.js).

**Raison du choix** : lisibilité opérationnelle — un projet, un domaine, un
`git push`. L'option B (deux projets Vercel séparés), bien que plus éprouvée
par la communauté 2026, ajoute deux pipelines, deux dashboards, deux quotas
free-tier séparés à gérer. En bêta, la simplicité opérationnelle prime.

**Risques assumés** : Vercel Services est une feature récente (sortie 2026),
moins de retours communautaires que la voie « deux projets séparés ». Le
repli vers Clever Cloud (DEC-079 (c)) demandera de retirer le service Python
du projet Vercel puis redéployer le projet entier — plus lourd qu'avec deux
projets séparés.

**Mitigation** : ce choix est monitoré et réversible. Voir
`docs/operations/runbook-bascule-vercel-services-vers-deux-projets.md` pour
le runbook de bascule A → B prêt à l'emploi.

### Critères objectifs déclenchant l'évaluation d'une bascule A → B

Au moins UN critère rempli suffit à ouvrir la discussion :

1. **Performance** : la mesure cold start exigée par DEC-079 (c) revient à
   un p95 > 5 s sur 10 appels consécutifs après inactivité, OU le `/health`
   du service Python retourne une erreur de routage (404, 502) attribuable
   à la config Services.
2. **Build** : un build Vercel échoue sans cause claire dans `apps/web`
   mais en passant par `services/optimizer`, ou inversement — symptôme
   typique d'un mélange de runtimes mal cloisonnés.
3. **Repli** : le critère de DEC-079 (c) se déclenche (cold start > 5 s)
   et impose Clever Cloud — l'option B simplifie franchement la transition.
4. **Quotas** : le projet unique Vercel dépasse 80 % de son quota
   free-tier mensuel (bandwidth, invocations) à cause du cumul des deux
   services — deux projets séparés isoleraient les quotas.
5. **Indisponibilité Vercel Services** : Vercel annonce une dépréciation,
   un changement de pricing significatif, ou un incident répété sur la
   feature Services.
6. **Opérationnel** : la 3e fois qu'un déploiement « routine » casse en
   raison d'une interaction Services qui n'aurait pas eu lieu avec deux
   projets séparés.

Si l'un de ces critères se déclenche, lancer la procédure du runbook
(durée estimée à une demi-journée, cf. en-tête du runbook).

## Révision 2026-06-01 — passage à Option B avant déploiement réel

L'Option A n'a jamais été activée (le `vercel.json` racine est resté
`framework: nextjs` après Wave 3 ; le `services/optimizer/vercel.json` était
présent mais non référencé). Avant le premier déploiement réel, décision
dirigeant : passer directement à l'**Option B (deux projets Vercel séparés)**,
plus simple à isoler pour la phase de test de fonctionnalités Wave 3.

**Raison** : on est en phase de vérification du code livré, pas en phase
d'arbitrage d'architecture cible. Deux projets séparés permettent de déployer
le service Python indépendamment et de mesurer son comportement (cold start,
latence) sans toucher au projet `apps/web` qui fonctionne déjà. Les questions
de production (cible HDS Phase 09, choix d'hébergeur final) restent à
trancher séparément le moment venu — pas ici.

**Critères de monitoring** : les 6 critères de bascule A → B précédemment
posés restent valides comme **signaux à surveiller sur l'Option B**, sans
présager d'une cible de bascule. Si l'un se déclenche (p95 cold start > 5 s,
erreurs runtime persistantes, échecs de build, dépassement de quota,
indisponibilité Vercel Python, récurrence d'incidents opérationnels), une
nouvelle décision sera prise par le dirigeant — sans préempter l'alternative
à choisir.

**Conséquence pratique** : pas de démantèlement à faire puisque A n'avait
pas été activée. Le runbook A → B existant reste pertinent comme référence
opérationnelle (sous-ensemble des étapes 2, 3, 4, 5, 6 et 8 — les étapes 1
« snapshot avant bascule » et 7 « retrait config Services » sont sans objet).

## Sources

- Documentation Vercel — runtime Python : `vercel.com/docs/functions/runtimes/python`
- Documentation Vercel — limites fonctions serverless : `vercel.com/docs/functions/limitations`
- Documentation Vercel — durée maximale d'exécution par plan : `vercel.com/docs/functions/runtimes` (plan Hobby vs Pro)
- Supabase Edge Functions — runtime Deno : `supabase.com/docs/guides/functions`
- Supabase issue tracker — demandes de support Python : `github.com/supabase/supabase/issues/22944`, `github.com/supabase/supabase/issues/41990`
- OR-Tools — taille du paquet PyPI : `pypi.org/project/ortools/`
- DEC-077 (renumérotation HDS Phase 09) et CONTEXT.md Phase 06.7 (D-08 payload dé-identifié).
