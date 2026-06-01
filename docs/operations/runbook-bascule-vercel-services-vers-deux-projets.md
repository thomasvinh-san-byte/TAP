# Runbook — bascule A → B : Vercel Services → deux projets Vercel séparés

> Runbook autonome : exécutable sans relire ADR-008 ni les PR antérieures.
> Cible technique : opérateur ayant un accès admin au compte Vercel
> propriétaire du projet TAP. Durée estimée : ~4 heures hors validation E2E.
> Réversibilité : pendant les 24 h suivant la bascule, retour à A par revert
> Git (la config Services est versionnée).

## Quand utiliser ce runbook

Référence aux **critères objectifs** documentés dans `docs/adr/ADR-008-hebergement-services-optimizer.md`
(section « Complément 2026-06-01 ») :

1. Cold start p95 > 5 s sur 10 appels consécutifs après inactivité.
2. Échec de build Vercel attribuable à la config Services (interaction
   `apps/web` ↔ `services/optimizer`).
3. Déclenchement du repli Clever Cloud (DEC-079 (c)) imposé.
4. Quota free-tier Vercel > 80 % à cause du cumul des deux services.
5. Indisponibilité, dépréciation ou changement de pricing de Vercel Services.
6. 3e incident opérationnel attribuable à Services.

**Si aucun critère n'est rempli, ne pas exécuter ce runbook.** L'option A
reste le défaut tant que l'opération est sereine.

## Durée et réversibilité

- Durée estimée : ~4 h hors validation E2E (fourchette, pas un engagement).
- Réversibilité : revert Git du commit de bascule pendant 24 h.
- Fenêtre de maintenance : le service Python est brièvement indisponible
  pendant le swap de `OPTIMIZER_SERVICE_URL` (typiquement < 5 minutes le
  temps que la propagation Vercel se fasse). Si production active, annoncer
  une fenêtre courte.

## Pré-requis à vérifier AVANT de démarrer

- [ ] Accès admin au compte Vercel propriétaire du projet TAP
      (Settings → Members → rôle Owner ou Admin).
- [ ] `main` propre, aucune PR en cours sur `services/optimizer` ou `apps/web`.
- [ ] Tests pytest (`cd services/optimizer && pytest -q`) et Vitest
      (`pnpm --filter @tap/optimizer-client test`) verts en local : sanité
      du code lui-même avant de toucher à l'infrastructure.
- [ ] Une fenêtre de maintenance annoncée si la production est active.
- [ ] `curl` et `bash` disponibles sur la machine qui exécute le runbook.

## Vue d'ensemble — 8 étapes

1. Snapshot de l'état actuel (mesures, config).
2. Créer le 2e projet Vercel pour `services/optimizer`.
3. Configurer le déploiement du 2e projet.
4. Premier déploiement et test du `/health`.
5. Mesurer le cold start sur le 2e projet (protocole DEC-079 (c)).
6. Mettre à jour `OPTIMIZER_SERVICE_URL` côté `apps/web` (preview puis prod).
7. Retirer le service Python du projet `apps/web` (config Services).
8. Vérification E2E + clôture documentaire.

---

## Étape 1 — Snapshot de l'état actuel

Capturer dans `docs/operations/snapshots/bascule-A-vers-B-<AAAA-MM-JJ>.md` :

- Commit `main` au moment de la bascule (`git rev-parse HEAD`).
- Métriques cold start actuelles sous A (p50 / p95 sur 10 appels — utiliser
  le script d'annexe A).
- Liste des envvars Vercel actuelles sur le projet `apps/web` (capture
  d'écran ou export du dashboard).
- Critère qui a déclenché la bascule (citation de la liste ADR-008).

Pas d'automatisation imposée — l'objectif est d'avoir une trace si on
doit faire un post-mortem.

## Étape 2 — Créer le 2e projet Vercel

Via le dashboard Vercel (chemins exacts à confirmer au moment de
l'exécution, la UI Vercel peut évoluer) :

- **New Project** → import du même repo GitHub TAP.
- **Project name** : `tap-optimizer` (ou équivalent reconnaissable).
- **Framework preset** : Python (auto-détecté via `services/optimizer/requirements.txt`).
- **Root Directory** : `services/optimizer`.
- **Build & Output Settings** : laisser par défaut, Vercel détecte FastAPI
  via `main.py` + `requirements.txt`.
- **Région** : `cdg1` (Paris, idem `apps/web` — minimise la latence du
  Route Handler vers le service Python).
- Ne PAS déployer encore (cliquer « Skip » sur le premier deploy si proposé).

## Étape 3 — Configurer le 2e projet

Dans `tap-optimizer` → **Settings** :

- **Environment Variables** :
  - `OPTIMIZER_TIME_LIMIT_SECONDS=3` (Production)
  - `OPTIMIZER_TIME_LIMIT_SECONDS=5` (Preview / Development)
- **Git → Production Branch** : `main`.
- **Git → Ignored Build Step** (à confirmer dans la UI Vercel, libellé
  exact peut varier) : n'exécuter le build que si `services/optimizer/**`
  a changé, via la commande :
  ```bash
  bash -c "git diff --quiet HEAD^ HEAD ./services/optimizer || exit 1"
  ```
  Vercel interprète un exit code non-zéro comme « il y a quelque chose à
  builder » — économise les builds inutiles quand le commit ne touche
  que `apps/web`.

## Étape 4 — Premier déploiement et test du `/health`

- **Promote → Deploy** dans le dashboard `tap-optimizer`.
- Attendre la fin du build (suivre les logs ; un timeout > 5 min est un
  signal à investiguer — voir section Dépannage).
- Récupérer l'URL générée (forme attendue : `tap-optimizer-<hash>.vercel.app`).
- Tester :
  ```bash
  curl -sf https://tap-optimizer-<hash>.vercel.app/health
  ```
  Sortie attendue : `{"status":"ok"}`.

Si le `/health` ne répond pas en 200 : ouvrir les Runtime Logs Vercel du
projet `tap-optimizer` et identifier la cause avant de continuer. Causes
fréquentes : `requirements.txt` non détecté (mauvais Root Directory),
entrypoint `main.py` mal nommé, dépendance manquante.

## Étape 5 — Mesurer le cold start sur le 2e projet

Reproduire le protocole DEC-079 (c) sur `tap-optimizer` :

- Attendre 10 min d'inactivité du service (pas d'appel).
- 10 appels consécutifs au `/health`, séparés par 60 s.
- Mesurer p50 / p95 (script bash en annexe A).

**Critère d'acceptation** : p95 < 5 s sur ces 10 mesures.

- Si p95 < 5 s : continuer à l'étape 6.
- Si p95 ≥ 5 s : **ne pas continuer la bascule vers B**. Le critère
  DEC-079 (c) est rempli, la cible n'est plus B mais Clever Cloud
  (repli HDS-compatible). Documenter la mesure dans le snapshot étape 1
  et déclencher la procédure de bascule vers Clever Cloud (hors scope
  de ce runbook — créer un runbook dédié si nécessaire).

## Étape 6 — Mettre à jour `OPTIMIZER_SERVICE_URL` côté `apps/web`

Dans le projet `apps/web` (dashboard Vercel) → **Settings → Environment
Variables** :

- **Preview** : remplacer `OPTIMIZER_SERVICE_URL` par
  `https://tap-optimizer-<hash>-preview.vercel.app` (l'URL preview du
  2e projet — Vercel expose une URL par branche).
- **Production** : remplacer par `https://tap-optimizer-<hash>.vercel.app`
  (l'URL production du 2e projet).

Puis :

- Redéployer `apps/web` sur preview + production (forcer un nouveau
  déploiement pour que la nouvelle envvar soit prise en compte).
- Tester un appel `/api/optimizer` depuis la preview (via `curl` ou
  test E2E ciblé) : le Route Handler `apps/web` doit relayer vers le
  2e projet et recevoir une réponse valide.

## Étape 7 — Retirer le service Python du projet `apps/web`

- Localement, **retirer la config Services** dans le fichier qui
  l'avait introduite en Task 0 de Wave 3 (typiquement `vercel.json`
  racine ou `services/optimizer/vercel.json` exposant le sous-chemin
  `/optimizer/*` depuis `apps/web`).
- Commit :
  ```bash
  git checkout -b chore/bascule-vercel-services-vers-deux-projets
  # retirer la config Services (vercel.json racine ou services/optimizer/vercel.json)
  git add -p
  git commit -m "chore(infra): bascule A→B — retire services/optimizer du projet apps/web"
  git push -u origin chore/bascule-vercel-services-vers-deux-projets
  ```
- Ouvrir la PR, merger, attendre le redéploiement de `apps/web`.
- Vérifier qu'aucune route `/optimizer/*` n'est servie par `apps/web` :
  ```bash
  curl -o /dev/null -w "%{http_code}\n" https://<apps-web-prod>/optimizer/health
  ```
  Code attendu : `404`.

## Étape 8 — Vérification E2E + clôture documentaire

- Lancer l'E2E golden path sur la preview de `apps/web` :
  ```bash
  pnpm exec playwright test apps/web/tests/e2e/optimizer-golden-path.spec.ts
  ```
- Vérifier que la mesure cold start sous B est documentée dans le
  snapshot d'étape 1 (avant / après).
- Mettre à jour `docs/adr/ADR-008-hebergement-services-optimizer.md` :
  ajouter une section « ## Bascule AAAA-MM-JJ — option A → B »
  documentant :
  - le critère ADR-008 qui a déclenché la bascule ;
  - les mesures cold start avant (A) et après (B) ;
  - le commit de bascule (hash + URL PR).
- Mettre à jour `.planning/REQUIREMENTS.md` si une référence à
  l'architecture Option A y figure (chercher « Option A », « Vercel
  Services », « DEC-079 »).
- Mettre à jour `.planning/STATE.md` `Last activity:` avec la bascule.

## Rollback — retour à option A dans les 24 h

Si la bascule pose problème dans les premières 24 h :

- Revert du commit de bascule sur `main` :
  ```bash
  git revert <hash-du-commit-de-bascule>
  git push origin main
  ```
- Restaurer `OPTIMIZER_SERVICE_URL` à l'ancienne valeur dans `apps/web`
  (preview + production) — l'ancienne URL pointait vers le sous-chemin
  `/optimizer` de `apps/web` lui-même.
- Supprimer le projet `tap-optimizer` (Vercel dashboard → `tap-optimizer`
  → Settings → Delete Project).
- Documenter dans ADR-008 pourquoi le rollback a eu lieu (entrée dédiée
  sous le titre « ## Rollback AAAA-MM-JJ — option B abandonnée »).

## Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| Build `tap-optimizer` échoue sur `requirements.txt` introuvable | Root Directory mal configuré (étape 2) | Vérifier que Root Directory pointe bien vers `services/optimizer` |
| `/health` répond 502 après build vert | Entrypoint Python non détecté | Confirmer que `services/optimizer/main.py` expose `app = FastAPI(...)` |
| Cold start p95 monte à > 10 s | Service trop lourd pour Vercel serverless | Critère DEC-079 (c) → repli Clever Cloud, pas B |
| Route Handler `apps/web` reçoit `403 Forbidden` du 2e projet | Le 2e projet a une « Deployment Protection » activée par défaut | Settings → Deployment Protection → désactiver pour les routes publiques `/health` et `/solve` |
| Appels OK depuis preview mais 500 en production | `OPTIMIZER_SERVICE_URL` non mis à jour côté Production (étape 6) | Re-vérifier dashboard `apps/web` → Settings → Environment Variables → onglet Production |

## Annexe A — script de mesure cold start

```bash
#!/usr/bin/env bash
# Mesure p50 / p95 sur 10 appels avec 60 s d'attente entre chaque.
# Usage : ./measure-cold-start.sh https://tap-optimizer-xxx.vercel.app/health
set -euo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Usage : $0 <URL du /health>" >&2
  exit 1
fi

echo "Attente 10 min d'inactivité avant la mesure (DEC-079 (c))..."
sleep 600

declare -a TIMES
for i in 1 2 3 4 5 6 7 8 9 10; do
  T=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
  echo "Appel $i : ${T}s"
  TIMES+=("$T")
  if [ "$i" -lt 10 ]; then
    sleep 60
  fi
done

printf "%s\n" "${TIMES[@]}" | sort -n | awk '
  { a[NR] = $1 }
  END {
    print "p50 (médiane) :", a[5]
    print "p95           :", a[10]
  }
'
```

## Annexe B — checklist de validation post-bascule

À cocher avant de considérer la bascule terminée :

- [ ] Le 2e projet répond `200 OK` sur `/health` (étape 4).
- [ ] Cold start p95 < 5 s sur le 2e projet (étape 5).
- [ ] `OPTIMIZER_SERVICE_URL` pointe vers le 2e projet en preview ET
      production (étape 6).
- [ ] `apps/web` ne route plus `/optimizer/*` — code HTTP 404 attendu
      (étape 7).
- [ ] E2E golden path optimizer passe sur la preview de `apps/web`
      (étape 8).
- [ ] ADR-008 mis à jour avec section bascule + cause (étape 8).
- [ ] STATE.md `Last activity` à jour (étape 8).
- [ ] Snapshot avant-bascule sauvegardé dans
      `docs/operations/snapshots/` (étape 1).

---

*Runbook créé 2026-06-01 — à mettre à jour si la UI Vercel évolue ou
si les critères ADR-008 sont révisés.*
