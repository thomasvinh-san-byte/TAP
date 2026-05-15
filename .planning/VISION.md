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

**Stack** : Next.js 14 App Router + Supabase + shadcn/ui + Tailwind
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
| D1 — ESLint v10 flat config absent | Lint (`@tap/database`, `@tap/shared`) | ESLint 10 a retiré `.eslintrc.*`, packages pas migrés vers `eslint.config.js` | Phase 06 (~30 min) |
| D2 — SIRET Carrefour Luhn-invalide | Tests unitaires (`@tap/shared`) | `40483304800010` rejeté par contrôle Luhn dans `siretSchema` | Phase 06 (~15 min) |
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
