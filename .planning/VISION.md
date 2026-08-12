# Vision projet TAP Réunion

> Document consolidé créé 2026-05-14 après livraison Phase 04 + 5 hotfixes.
> Référence transverse pour le séquencement long terme et les arbitrages
> à venir. Ne remplace pas PROJECT.md (décisions verrouillées) ni
> ROADMAP.md (séquencement actif). Lecture obligatoire avant de planifier
> une phase au-delà de V1.

---

## Mission

Outil de régulation et pilotage pour sociétés de taxi conventionné 974
(transport sanitaire CGSS). La régulatrice doit avoir envie d'utiliser
l'outil 8 h/jour, 220 j/an, sans jamais le subir.

## Hiérarchie des phases

**V1 (livré)** — Phases 0 à 04
  Saisie + onboarding + workflow chauffeur fonctionnel
  Démonstrable design partner sur preview Vercel
  Mode jour uniquement

**V1.5 (en cours via Phase 04.5 / 04.7 / 04.9)** — Robustesse + PWA
  Phase 04.5 : robustesse interne
  Phase 04.7 : pricing public + caisse
  Phase 04.9 : PWA pour usage offline chauffeur

**V2 (Phase 05 / 05.5)** — Récurrences + tarif CGSS réel
  Métier de fond : récurrences dialyse, cockpit, SMS, patient absent
  Tarif CGSS calculé automatiquement

**V3 (Phase 06)** — HDS + B2B + facturation + audit RLS systémique
  Production-grade : conformité HDS, multi-tenant payant,
  facturation CGSS PDF + audit RLS systémique de toutes les tables
  + audit Server Actions row count check (DEC-041)
  + tests E2E permissions cross-org / cross-driver

**V4 (Phase 07, optionnel)** — Mobile native
  Si business case validé sur retour Phase 04.9 PWA

## Méthode de phasage

ADR-003 : E2E par passes successives. Chaque phase livre une tranche
verticale complète plutôt qu'une couche horizontale. Préférer la
robustesse métier à la complétude technique.

Pipeline GSD discipliné (discuss → ui → plan → execute → ship) pour les
phases lourdes (Phase 04 livrée en 135 min vs 330 estimés, -59%, grâce
à la méthode).

Hotfixes hors GSD acceptables si pattern incremental et documentation
rigoureuse. Mais à minimiser : Phase 03.2 (8 hotfixes) et Phase 04
post-merge (5 hotfixes) ont révélé que c'est plus coûteux que cadrer
en amont.

## Politique d'abonnement PR et flux d'événements (2026-05-15)

L'agent Claude Code ne s'abonne PAS automatiquement aux événements CI/Vercel/comments des PR ouvertes. Justification :

- Le dirigeant reçoit déjà notifications GitHub par mail
- Le pipeline GSD a un flux de checkpoints explicites (1/5 discuss → 2/5 UI → 3/5 plan → 4/5 execute → 5/5 verify)
- Surveillance background consomme context sans valeur ajoutée
- Risque de bruit sur dettes CI pré-existantes V1.5 documentées (Lint ESLint v10 / SIRET Carrefour / pgTAP env)

**Comportement attendu de l'agent :**

À NE PAS faire :
- Abonnement automatique aux PR créées
- Surveillance background des PR mergées
- Signalement événements CI rouge sur dettes pré-existantes V1.5
- Status updates non sollicités entre checkpoints GSD

À faire :
- Émettre checkpoint GSD explicite à chaque étape livrée
- Signaler UNE FOIS quand l'agent ouvre une PR (numéro + URL)
- Signaler UNE FOIS si CI échoue sur point NOUVEAU (pas V1.5 baseline)
- Silence radio entre checkpoints

Surveillance active possible sur demande explicite du dirigeant (genre migration BDD critique post-réparation CD).

## Pipeline GSD étendu — UAT informel obligatoire (2026-05-15)

Entre `/gsd-execute-phase` et `/gsd-verify-work`, le dirigeant doit faire un **UAT informel preview (~15-30 min)** pour identifier les frictions invisibles à la spec.

**Étape ajoutée au pipeline GSD :**

```
1/5 discuss → 2/5 UI → 3/5 plan → 4/5 execute → [UAT informel preview] → [hotfix-bis si frictions] → 5/5 verify
```

**Si frictions trouvées :**

- Inscrire en `CONCERNS.md` (sévérité démo + usage)
- Évaluer **hotfix-bis** (si fix court < 1 h estimé) vs report Phase suivante
- Le `verify-work` formel intervient APRÈS hotfix-bis le cas échéant, couvrant phase + hotfix-bis ensemble

**Pattern observé Phase 04.7 (2026-05-15)** :

UAT informel post-execute Phase 04.7 a révélé **3 frictions non spec'd** :

- Modal de saisie course sans `max-width` → POI long (« CHU Félix Guyon — Allée des Topazes, Bellepierre, 97400 Saint-Denis ») débordait visuellement
- Page `/courses` sans filtre date → liste mélange J-3 / J0 / J+1, perte de focus régulatrice
- Page `/courses` sans pagination → scroll infini sur démo > 30 rides

**Hotfix 04.7-bis livré en ~15 min réel.** Démo régulatrice ensuite sans friction visuelle.

**Justification de la nouvelle étape pipeline** :

- La spec UI-SPEC ne peut pas anticiper les **bugs visuels de combinaison** (POI long + modal sans `max-width`) — les composants individuellement passent la review, mais leur intégration révèle des manques
- L'UAT informel rend visibles les **manques UX révélés par usage réel** (filtre date, pagination courses) que la spec avait sous-estimés
- Le `verify-work` documentaire formel valide le périmètre spec'd ; il NE détecte PAS les frictions « invisibles à la spec » qui pourtant cassent la démo
- Coût UAT informel : 15-30 min × 1 personne (dirigeant) = négligeable face au coût de découvrir une friction démo en live design partner

**Critères de qualification d'une « friction » (≠ scope creep)** :

- Visible en moins de 5 min d'usage normal
- Bloque ou ralentit notablement le parcours principal de la phase
- Peut être fixée sans modifier UI-SPEC ni plans verrouillés (sinon = phase suivante)
- N'introduit pas de nouvelle dépendance ni nouveau pattern hors UI-PATTERNS DEC-034

Si une friction trouvée nécessite plus que 1 h ou un nouveau pattern → CONCERNS.md + report phase suivante (V5 verrou anti-scope creep maintenu).

**Audit UI consolidé pré-démo (extension 2026-05-18, marathon 04.7-bis)**

Le marathon Phase 04.7-bis (2026-05-18, 7 PR mergées en ~4h) a révélé un pattern complémentaire à l'UAT informel : quand UAT pré-démo révèle **plusieurs frictions cohérentes** (terminologie, autocomplete, propagations), il vaut mieux **regrouper en un audit UI consolidé** plutôt que multiplier les PR hotfix isolées (PR #100 truncation, PR #105 sexe+BAN, PR #107 propagation CP/ville, etc.).

**Pourquoi grouper** :
- Chaque PR isolée coûte ~30 min (branche + commit + push + PR + merge + redeploy Vercel + validation manuelle)
- 7 PR fragmentées = ~3 h overhead vs ~1 h pour 1 PR groupée
- Les frictions cohérentes (ex : terminologie médicale FR sur label + options Select + REQUIREMENTS) sont solidaires : les séparer fragmente la doc et le testing
- Vercel cumule des builds Skipped/Error sur les commits intermédiaires

**Quand grouper vs splitter** :

Grouper si :
- Les frictions partagent un même composant / une même section
- Les frictions partagent un même thème métier (UX patient, UX courses, UX terminologie médicale)
- Le fix groupé reste sous 1 h et un seul reviewer humain

Splitter si :
- Les frictions touchent des couches très différentes (auth + BDD + UI)
- Une friction nécessite un audit profond séparé (ex : régression PR #101 RLS récursion, marathon Vercel custom domain)
- Le scope risque de déborder en hotfix-bis (> 1 h)

**Pattern observé qui aurait été mieux groupé Phase 04.7-bis** :

Friction terminologie médicale + autocomplete adresse patient + propagation CP/ville auraient pu être 1 seule PR (PR #105 groupée) au lieu de 3 PR séparées (PR #105 sexe + adresse, PR #107 propagation). Coût économisé : ~30-45 min overhead PR.

**Inscription pour V2+ phases** :

Lors de l'UAT informel pré-démo phase, faire un balayage UI complet (5-10 min) avec liste écrite des frictions observées AVANT de lancer le premier hotfix. Puis regrouper les frictions cohérentes en 1-3 PR maximum (au lieu de 1 PR par friction).

## Métrique de succès business

**À court terme** :
- 1 société taxi 974 partenaire pilote utilisateur en autonomie
  (8 semaines après début Phase 04.5)

**À moyen terme** :
- 3-5 sociétés taxi 974 en utilisateurs payants
  (12 semaines après Phase 06 HDS)

**À long terme** :
- 15-20 sociétés taxi 974 + extension à 2-3 DROM
  (12 mois après V3)

## Architecture technique

**Stack** : Next.js 15.5 App Router + Supabase + shadcn/ui + Tailwind
**Hosting** : Vercel + Supabase EU
**Monorepo** : pnpm workspaces
**CI/CD** : GitHub Actions
**Auth** : Supabase Auth (email/password + magic link Phase 04)
**RLS** : Postgres policies (4 rôles : dirigeant, regulateur, chauffeur,
patient)

**Décisions structurantes (ADR + DEC)** :
- ADR-001 : monorepo Turborepo abandonné, pnpm workspaces
- ADR-002 : Tailwind + shadcn au lieu de design system custom
- ADR-003 : E2E par passes successives
- DEC-001..030 : décisions ponctuelles documentées PROJECT.md

**Sécurité** :
- RLS Postgres ASVS L1 (Phase 1) → L2 (Phase 06 HDS)
- Chiffrement NIR via Edge Function nir (Phase 1.5)
- Anonymisation patients RGPD via RPC `rgpd_anonymize_patient`
- Audit logs sur toutes mutations (depuis Phase 2)

## Stratégie CI/qualité V1.5 → V3

**Position acceptée 2026-05-15 (Phase 04.5 Wave B).**

La CI GitHub Actions sur main porte 3 dettes pré-existantes qui restent
ROUGES jusqu'à Phase 06 HDS. Précédent : PR #75 (docs-only) et PR #76
(RLS Wave B.1) mergées dans cet état.

| Dette | Job CI affecté | Diagnostic | Phase de résolution |
|---|---|---|---|
| D1 — ESLint flat config absent | Lint (`@tap/database`, `@tap/shared`) | ESLint 9+ ne lit plus `.eslintrc.*` ; le monorepo n'avait aucune config | ✅ RÉSOLU (2026-06-10) — `eslint.config.mjs` racine (ESLint 9.39.4, flat config), `pnpm lint` vert |
| D2 — SIRET Carrefour Luhn-invalide | Tests unitaires (`@tap/shared`) | `40483304800010` (clé 0) rejeté par Luhn — c'était le FIXTURE qui était faux, pas l'algo | ✅ RÉSOLU (2026-06-10) — fixture corrigé (`...014`, clé 4) + cas négatif ajouté ; algo confirmé correct (sourcé INSEE/validinsee) |
| D3 — pgTAP runner cassé | Tests RLS pgTAP | Drift `supabase/setup-cli@latest` — affecte aussi PR sans SQL | Phase 06 (~1-2 h diagnostic) |

**Pourquoi accepter une CI rouge V1.5** :

- Aucun des 3 jobs rouges ne reflète une régression du code applicatif livré dans les phases V1.5
- Le job `Vérification des types` (TypeScript) reste vert sur chaque PR — c'est le filet réel de qualité applicative à ce stade
- Préview Vercel + validation manuelle dirigeant = preuve fonctionnelle (Visible Progress Mandate CLAUDE.md § 13.5)
- Fixer les 3 dettes consommerait 2-3h de scope qui ne livre aucune valeur métier visible aux design partners
- Phase 06 est le créneau naturel : audit RLS systémique + Server Actions + sécurité production-grade rassemblés au même endroit, l'environnement CI sera durci en même temps

**Ce que cette stratégie N'autorise PAS** :

- Ignorer un échec CI causé par les changements d'une PR (typecheck rouge = blocage strict, idem nouveau test métier rouge)
- Étendre la liste des dettes acceptées au-delà de D1/D2/D3 (toute nouvelle dette → PR séparée immédiate)
- Merger une PR dont la migration BDD échoue au `cd.yml` post-merge (DEC-032 reste strict)
- Reporter D1/D2/D3 au-delà de Phase 06 (verrou commercial — premier client payant exige CI verte)

**Re-évaluation** : à V1.0 commerciale. Si la CI verte devient prérequis design partner (ex : audit externe), accélérer le fix D1/D2/D3 hors Phase 06.

## Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Conformité HDS lourde (Phase 06) | Élevé | Audit early, contact Supabase Pro HDS |
| Marché taxi 974 saturé (concurrents) | Moyen | Différenciation par UX + CGSS auto |
| Token Supabase expiration | Faible | Rotation programmée |
| Dérive Phase 04.9 PWA (iOS quirks) | Moyen | Phase dédiée enveloppe seule |
| Drift schema_migrations CD bloqué | Faible | Playbook DEC-032 + dette future script pré-flight (CONCERNS.md) |

## Ce qui n'est PAS dans la roadmap (out of scope)

- App native iOS / Android (Phase 07 hypothétique seulement)
- Mode nuit interface (Phase UI dédiée future)
- Intégration cartes graphiques avancée (Mapbox / Google Maps)
- IA prédiction demande
- Marketplace chauffeurs indépendants
- International (DROM uniquement, pas métropole)

---

*Vision consolidée 2026-05-14 après livraison Phase 04 + 5 hotfixes (DEC-029..033).*
*Mise à jour 2026-05-15 : section « Stratégie CI/qualité V1.5 → V3 » ajoutée (Phase 04.5 Wave B, dettes D1/D2/D3 reportées Phase 06).*
*Mise à jour : à chaque inflexion stratégique (changement séquencement V1.5/V2/V3, pivot business case mobile, etc.).*
