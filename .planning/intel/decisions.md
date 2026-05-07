# Decisions (intel synthétisée)

> Synthèse des décisions architecturales et produit issues des ADRs et de CLAUDE.md.
> Précédence appliquée : ADR > SPEC > PRD > DOC. Les décisions issues de CLAUDE.md
> sont élevées au rang de décisions verrouillées car le propriétaire projet traite
> CLAUDE.md comme document autoritatif (« à lire intégralement avant toute session »).
>
> Format par décision : titre, source, statut, scope, énoncé, notes.

---

## DEC-001 — Architecture monorepo : Turborepo + pnpm workspaces

- **source**: /home/user/TAP/docs/adr/ADR-001-monorepo-turborepo.md
- **statut**: locked (ADR-001, Accepté, 2026-05-06)
- **scope**: monorepo, build pipeline, package management, structure du dépôt

**Énoncé** : Le dépôt est organisé en monorepo Turborepo + pnpm workspaces. pnpm est
le package manager (vitesse, isolation stricte, taille `node_modules`). Turborepo
fournit le pipeline de build (cache local + distant, parallélisation, build
incrémental). Structure définie dans `CLAUDE.md` § 4.

**Conséquences-clés**
- Les `apps/*` peuvent dépendre des `packages/*` ; jamais l'inverse.
- Une seule source de vérité pour les types Supabase générés.
- Tests RLS, pricing, recurrence isolés dans des packages purement TypeScript.
- Si extraction future d'une app : faisable mais coûteux.

**Alternatives écartées** : multi-repos (friction solo founder), Nx (config plus lourde),
Yarn workspaces (plus lent, hoisting peu prédictible).

---

## DEC-002 — Multi-tenant via Supabase RLS forcée et `organization_id`

- **source**: /home/user/TAP/docs/adr/ADR-002-supabase-rls-multitenant.md
- **statut**: locked (ADR-002, Accepté, 2026-05-06)
- **scope**: multi-tenant, isolation tenant, Postgres, Row Level Security, organization_id

**Énoncé** : Pattern de tables partagées avec colonne `organization_id uuid not null
references organizations(id)` sur toute table métier, avec RLS activée ET forcée
(`force row level security`) systématiquement. Les policies SELECT/UPDATE/INSERT/DELETE
filtrent sur `organization_id = public.current_organization_id()`. Helpers SECURITY
DEFINER (`current_organization_id`, `current_user_role`, `has_role`) évitent la
récursion RLS. Trigger anti-élévation de privilège sur `profiles`. Tests pgTAP
automatisés à chaque PR.

**Conséquences-clés**
- Isolation tenant garantie au niveau Postgres, indépendamment du code applicatif.
- Index obligatoire sur `(organization_id, ...)` pour toute table à fort volume
  (rides, audit_logs).
- `service_role` JAMAIS exposé côté client : audit CI interdisant
  `SUPABASE_SERVICE_ROLE_KEY` sous `apps/*/src/**`.
- Toute fonction SECURITY DEFINER est revue en code review et testée.
- Migration future vers HDS (OVHcloud / Scaleway Postgres) faisable sans refonte.

**Alternatives écartées** : base par tenant (incompatible Supabase Cloud), schéma par
tenant (incompatible Supabase Auth + types TS), RLS sans `force` (fuite possible via
`service_role` accidentel).

---

## DEC-003 — Stack technique imposée

- **source**: /home/user/TAP/CLAUDE.md § 3, corroborée par /home/user/TAP/README.md
- **statut**: locked (DOC élevé — autorité explicite du propriétaire projet)
- **scope**: ensemble de la stack applicative

**Énoncé** : La stack est figée comme suit.

| Couche | Technologie |
|---|---|
| Front | Next.js 14+ (App Router), TypeScript strict, React |
| UI | Tailwind CSS + shadcn/ui |
| Icônes | Lucide React (jamais mixée avec une autre famille) |
| Cartes | MapLibre + tuiles OSM |
| Planning | FullCalendar ou react-big-calendar |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Edge functions | Supabase Edge Functions (Deno) |
| Optimisation tournées | Microservice Python + Google OR-Tools |
| Routing GPS | OSRM auto-hébergé |
| Notifications push | Web Push API (VAPID) |
| Notifications SMS | Twilio ou OVH SMS Pro |
| Hébergement front | Vercel |
| Monitoring | Sentry |

**Règle** : ne pas introduire de nouvelle dépendance majeure sans justification
documentée (ADR requis).

---

## DEC-004 — Trois piliers non négociables (UX, design system, sécurité HDS)

- **source**: /home/user/TAP/CLAUDE.md § 1
- **statut**: locked (DOC élevé)
- **scope**: critères d'évaluation produit, priorisation transverse

**Énoncé** : Toute décision technique se mesure à 3 piliers, dans cet ordre :
1. **UX qui donne envie d'être utilisée** (objectif premier — la régulatrice
   passera 8 h/jour, 220 j/an dans l'outil).
2. **Design system rigoureux et plaisir d'usage** (palette bleu profond + accent
   chaleureux 974, mode jour ET nuit traités à parité, spacing strict 4-8-12-16-24-32-48-64,
   icônes Lucide uniquement, polices Inter/Manrope/Geist Sans).
3. **Sécurité données de santé** (RGPD niveau santé, HDS en production commerciale).

**Niveau de qualité visé** : Linear, Notion, Stripe Dashboard, Pitch, Arc Browser,
Things 3, Cron, Posthog. Aucun écran ne part en production s'il ne pourrait pas
figurer comme screenshot d'exemple sur une page d'accueil produit.

---

## DEC-005 — Objectifs UX chiffrés (SLOs perçus)

- **source**: /home/user/TAP/CLAUDE.md § 1
- **statut**: locked (DOC élevé)
- **scope**: performance perçue, contraintes UI

**Énoncé** :
- Saisie d'une course en mode express : **< 30 secondes**.
- Feedback visuel sur toute action : **< 100 ms** (optimistic UI obligatoire).
- Confirmation d'action chauffeur : **< 1 seconde même en 3G**.
- Time to Interactive régulateur : **< 2 secondes**.

---

## DEC-006 — Authentification et sessions

- **source**: /home/user/TAP/CLAUDE.md § 6
- **statut**: locked (DOC élevé) — cohérent avec ADR-002
- **scope**: authentification, sessions, 2FA

**Énoncé** :
- Authentification **uniquement** via Supabase Auth (PKCE flow).
- 2FA optionnel pour `dirigeant` et `regulateur`, désactivé pour `chauffeur`.
- Session chauffeur : 8 h max.
- Session régulateur : 15 min d'inactivité.
- Mode « régulateur de garde » : un seul régulateur actif simultané.

---

## DEC-007 — Chiffrement applicatif des données ultra-sensibles

- **source**: /home/user/TAP/CLAUDE.md § 6
- **statut**: locked (DOC élevé)
- **scope**: chiffrement, secret management, NIR, notes médicales

**Énoncé** :
- NIR : chiffré applicatif **AES-256-GCM**, clé hors Supabase.
- Notes médicales : chiffrées applicatif.
- TLS 1.3 minimum sur tout transport.

---

## DEC-008 — Consentement et règles SMS patient

- **source**: /home/user/TAP/CLAUDE.md § 6 (corroboré § 5)
- **statut**: locked (DOC élevé)
- **scope**: communication patient, RGPD, packages/sms

**Énoncé** :
- Consentement explicite et horodaté du patient avant tout SMS.
- Numéro expéditeur = numéro pro de la société.
- Archivage de toute communication dans la fiche patient.
- Préférence patient (SMS / appel / aucun) respectée systématiquement.

---

## DEC-009 — Géolocalisation chauffeur

- **source**: /home/user/TAP/CLAUDE.md § 6
- **statut**: locked (DOC élevé)
- **scope**: géolocalisation, RGPD, privacy by design

**Énoncé** :
- Capture **uniquement pendant le service**.
- Information préalable obligatoire en CGU + onboarding.
- Stockage 90 jours max en base chaude, agrégation puis purge automatique.

---

## DEC-010 — Audit et traçabilité

- **source**: /home/user/TAP/CLAUDE.md § 6
- **statut**: locked (DOC élevé)
- **scope**: audit_logs, conformité, traçabilité

**Énoncé** : Toute action sensible journalisée dans `audit_logs` :
- création / modification / archivage de patient, prescription, course, récurrence ;
- connexions, échecs de connexion ;
- modifications de paramètres tarifaires ;
- encaissements (caisse) ;
- exports de données ;
- modifications de notes médicales ;
- envois SMS.

`audit_logs` est append-only ; index sur `(organization_id, ...)` (cf. DEC-002).

---

## DEC-011 — Localisation FR et conventions de nommage

- **source**: /home/user/TAP/CLAUDE.md § 7
- **statut**: locked (DOC élevé)
- **scope**: i18n, conventions code, commits

**Énoncé** :
- Messages utilisateur en **français**.
- Logs et commentaires en français.
- Commits format `type(scope): description` en français.
- Fichiers : `kebab-case.ts` ; composants : `PascalCase.tsx` ; hooks : `useXxx` ;
  variables/fonctions : `camelCase` ; constantes : `SCREAMING_SNAKE_CASE` ;
  tables et colonnes Postgres : `snake_case`.

---

## DEC-012 — Workflow Git

- **source**: /home/user/TAP/README.md, /home/user/TAP/CLAUDE.md
- **statut**: locked (DOC élevé)
- **scope**: branches, CI/CD, déploiement

**Énoncé** : GitHub Flow adapté.
- `main` = toujours déployable, protégée.
- `staging` = branche permanente de pré-production.
- Toute feature passe par `feat/*`, `fix/*` ou `chore/*` puis PR → `main`.
- Migrations Supabase versionnées, validées par CI avant merge.
- Pas de modification de schéma via UI Supabase en prod.

---

## DEC-013 — Couverture de tests exigée

- **source**: /home/user/TAP/CLAUDE.md § 9
- **statut**: locked (DOC élevé)
- **scope**: stratégie de test, qualité

**Énoncé** :
- `packages/pricing` : **100 % branches**.
- `packages/recurrence` : **100 % branches**.
- `packages/domain` : ≥ 80 %.
- Composants UI critiques (saisie express, cockpit, course en cours) : tests d'intégration.
- Workflows imprévus (panne, patient absent, réaffectation) : tests E2E.
- RLS : tests systématiques (pgTAP).
- Outils : Vitest (TS/packages), Playwright (E2E), pgTAP (RLS), pytest (service Python OR-Tools).

---

## DEC-014 — Ergonomie chauffeur (PWA mobile)

- **source**: /home/user/TAP/CLAUDE.md § 5
- **statut**: locked (DOC élevé)
- **scope**: apps/mobile, accessibilité, mode hors-ligne

**Énoncé** :
- Boutons d'action principale **≥ 56 px** de hauteur, texte d'action **≥ 18 px**.
- Une action principale unique par écran (en bas, accessible au pouce).
- Maximum **3 informations** simultanées sur l'écran « course en cours ».
- Confirmations critiques par **swipe** (évite clics accidentels).
- Mode contraste élevé activable, police agrandie (+20 %), TTS du nom patient et
  adresse au démarrage de course.
- Indicateur batterie + connexion réseau visibles en permanence.
- Mode hors-ligne fonctionnel : tournée, démarrage/clôture course, scan BT
  (sync différée), indicateur explicite « hors-ligne » + nb d'éléments en attente.

---

## DEC-015 — Ergonomie régulatrice (desktop)

- **source**: /home/user/TAP/CLAUDE.md § 5
- **statut**: locked (DOC élevé)
- **scope**: apps/web, productivité régulateur

**Énoncé** :
- Cockpit temps réel = écran d'accueil par défaut.
- Saisie express accessible par raccourci clavier global (`Cmd/Ctrl+Shift+K`).
- Recherche patient instantanée à 2 caractères, fuzzy.
- Tableaux > 20 lignes : tri, filtres, pagination obligatoires.
- File d'attente brouillons : pause & reprise d'une saisie en cours.
- Multi-saisies en parallèle (ne jamais bloquer la régulatrice si nouvel appel).
- Raccourcis clavier sur toutes les actions fréquentes.

---

## DEC-016 — Localisation des règles métier dans des packages dédiés

- **source**: /home/user/TAP/CLAUDE.md § 11
- **statut**: locked (DOC élevé)
- **scope**: packages/pricing, packages/recurrence, packages/sms, packages/domain

**Énoncé** : interdiction de duplication métier — règles strictement localisées :
- Calcul de tarification → uniquement dans `packages/pricing`.
- Génération de récurrences → uniquement dans `packages/recurrence`.
- Envoi de SMS → uniquement via `packages/sms`.
- Logique métier hors composants React → `packages/domain`.

Limites de taille : fichier ≤ 300 lignes, composant React ≤ 150 lignes,
fonction ≤ 50 lignes, ≤ 3 niveaux d'imbrication.
