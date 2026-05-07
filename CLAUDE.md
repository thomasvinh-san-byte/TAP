# CLAUDE.md

> Fichier d'instructions permanent pour Claude Code.
> **À lire intégralement avant toute session de développement sur ce projet.**

---

## 0. Identité du projet

**Nom de travail** : SaaS TAP Réunion
**Nature** : SaaS de régulation, optimisation, communication patient et pilotage pour sociétés de Transport Assis Professionnalisé et taxiteurs conventionnés CGSS à La Réunion.
**Cible utilisateur principale** : la régulatrice (8 h/jour dans l'outil). Sa satisfaction conditionne 80 % du succès produit.
**Document de référence** : `docs/cahier_des_charges_saas_tap_v2.docx` — **lecture obligatoire avant tout développement fonctionnel**.

---

## 1. Les 3 piliers non négociables

Toute décision technique se mesure à ces 3 piliers, dans cet ordre de priorité :

### 🎯 Pilier 1 — UX qui donne envie d'être utilisée (objectif premier)

**La régulatrice passera 8 heures par jour, 220 jours par an, dans cet outil. Sur 10 ans de métier, c'est plus de 17 000 heures à regarder ces écrans.** Le visuel n'est pas un détail. Un outil que l'on subit fait perdre l'utilisateur. Un outil que l'on aime utiliser fait gagner l'éditeur.

**Trois principes directeurs :**

1. **Faire envie au premier regard, tenir au millième jour.** L'outil doit séduire en démo et ne pas lasser à l'usage long. Soin du détail, pas tape-à-l'œil.
2. **Le respect de l'utilisateur.** La régulatrice est une professionnelle. Pas d'infantilisation, pas de pop-ups inutiles, pas de gamification puérile. Densité adaptée à son expertise.
3. **Le plaisir d'usage.** Chaque interaction produit un retour sensoriel agréable. Le plaisir d'usage est ce qui transforme un outil supporté en outil aimé.

**Niveau de qualité visé : Linear, Notion, Stripe Dashboard, Pitch, Arc Browser, Things 3, Cron, Posthog.** Aucun écran ne part en production s'il ne pourrait pas figurer comme screenshot d'exemple sur une page d'accueil produit.

**Objectifs UX chiffrés à respecter :**
- Saisie d'une course en mode express : **< 30 secondes**
- Feedback visuel sur toute action : **< 100 ms** (optimistic UI)
- Confirmation d'action chauffeur : **< 1 seconde même en 3G**
- Time to Interactive régulateur : **< 2 secondes**

### 🪑 Pilier 2 — Design system rigoureux et plaisir d'usage

**Identité visuelle**
- Palette : bleu primaire profond (confiant, ni corporate triste ni tech criard) + accent chaleureux (terracotta, ambre ou corail subtil — clin d'œil 974)
- 8 niveaux de gris finement nuancés
- Couleurs sémantiques : vert succès, orange attention, rouge alerte, bleu info
- **Mode jour ET mode nuit** traités avec un soin égal (pas une simple inversion)
- Une seule famille de polices (Inter, Manrope, Geist Sans), 6 niveaux de taille, 4 graisses, chiffres tabulaires obligatoires
- Une seule famille d'icônes (Lucide), style ligne fine, jamais mixée
- Pas d'emoji dans l'UI professionnelle, pas de stock photos

**Système de spacing strict**
- Échelle : 4, 8, 12, 16, 24, 32, 48, 64 px (aucune valeur intermédiaire)
- Grille 12 colonnes côté régulateur, alignements respectés au pixel près
- Marges respiratoires généreuses sur les éléments importants

**Ombres et profondeur**
- 4 niveaux d'ombres (none, sm, md, lg) jamais utilisés au hasard
- Ombres modernes douces et colorées, pas de bordures dures Bootstrap 2010

**États interactifs**
- 5 états visuels distincts par élément interactif : repos, survol, pressé, actif, désactivé
- Transitions 150 ms ease-out, jamais brutales
- Focus clavier visible mais élégant (anneau coloré avec offset)

**Animations et micro-interactions**
- Apparition chorégraphiée des éléments (stagger animation < 600 ms)
- Mises à jour temps réel en fade-in subtil, jamais de flash ni reload
- Hover de carte : remontée légère + ombre douce
- Validation : animation de succès subtile < 200 ms
- Skeleton screens (jamais de spinners) pour chargements > 500 ms
- Respect strict de `prefers-reduced-motion`

**Sons subtils en option**
- Clic mécanique léger à la validation, son court de réussite
- Désactivés par défaut, activables si la régulatrice le souhaite
- Sons d'alerte distincts par criticité

**Règles communes UX/UI**
- 1 écran = 1 action principale claire
- Hiérarchie visuelle forte
- Boutons gros (≥ 56 px côté chauffeur), libellés explicites
- Pas de jargon technique dans l'UI
- Aucun message d'erreur technique brut affiché (reformulation systématique)
- Mobile-first sur la PWA chauffeur, desktop-first sur le régulateur
- Mode hors-ligne fonctionnel sur les actions chauffeur critiques
- Régulateur : **raccourcis clavier** sur toutes les actions fréquentes
- WCAG 2.1 AA minimum (contraste 4.5:1, navigation clavier complète)

**Anti-patterns visuels strictement interdits**
- ❌ Couleurs criardes saturées
- ❌ Boutons en dégradé années 2010, biseaux 3D
- ❌ Tableaux à bordures épaisses, alternance de lignes contrastées
- ❌ Mélange d'icônes de plusieurs familles
- ❌ Polices web datées (Verdana, Tahoma, Arial brut)
- ❌ Emojis dans l'interface
- ❌ Animations excessives (rebonds, paillettes, flash)
- ❌ Wireframes Bootstrap reconnaissables
- ❌ Stack traces visibles
- ❌ Chargements bloquants pleine page
- ❌ Pop-ups de confirmation pour actions banales

### 🔒 Pilier 3 — Sécurité (données de santé)
- Données traitées = **données de santé** + données salarié + données financières
- RGPD niveau santé applicable
- Hébergement HDS exigé en production commerciale
- Tout développement doit anticiper cette contrainte (architecture portable)

---

## 2. Modules critiques et complexité métier

Le cahier des charges V2 contient **24 modules fonctionnels**. Avant tout développement, identifier le module concerné :

| Module clé | Réf. CDC | Pourquoi c'est critique |
|---|---|---|
| **Saisie express course** | 5.8 | Écran le plus utilisé par la régulatrice |
| **Courses récurrentes** | 5.9 | 60 % de l'activité réelle (dialyse, chimio) |
| **Cockpit régulateur** | 5.13 | Vue par défaut de la régulatrice, temps réel |
| **Gestion des imprévus** | 5.14 | 30 % du métier réel |
| **Communication patient SMS** | 5.15 | Levier majeur de productivité |
| **PWA chauffeur (UX terrain)** | 5.16 | Soleil, batterie, mains occupées, vocal |
| **Caisse et paiements directs** | 5.19 | Tous les encaissements non CGSS |
| **Mode dégradé** | 5.24 | Outil critique au quotidien |
| **Moteur tarification CGSS** | 7 | Cœur économique, 100 % tests |

**Aucun de ces modules ne doit être traité en surface.** En cas de doute, demander la confrontation avec un design partner avant de développer.

---

## 3. Stack technique imposée

| Couche | Technologie |
|---|---|
| Front | Next.js 14+ (App Router), TypeScript strict, React |
| UI | Tailwind CSS + shadcn/ui |
| Icônes | Lucide React |
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

**Ne pas introduire de nouvelle dépendance majeure sans justification documentée.**

---

## 4. Architecture du repo

```
/
├── CLAUDE.md                          # ← CE FICHIER
├── docs/
│   ├── cahier_des_charges_saas_tap_v2.docx
│   ├── adr/                           # Architecture Decision Records
│   └── observations/                  # Notes d'immersion design partners
├── apps/
│   ├── web/                           # Next.js régulateur (desktop)
│   ├── mobile/                        # Next.js PWA chauffeur
│   ├── admin/                         # Back-office super-admin
│   └── b2b/                           # Portail donneurs d'ordres (V1.5)
├── packages/
│   ├── ui/                            # shadcn/ui partagé
│   ├── domain/                        # logique métier pure (TS)
│   ├── pricing/                       # moteur de tarification CGSS
│   ├── optimizer-client/              # client TS du service Python OR-Tools
│   ├── recurrence/                    # moteur de génération courses récurrentes
│   ├── sms/                           # gestion templates et envoi SMS
│   ├── database/                      # types Supabase, migrations, RLS
│   └── shared/                        # utils, validators (zod)
├── services/
│   ├── optimizer/                     # microservice Python OR-Tools
│   └── osrm/                          # config OSRM
└── supabase/
    ├── migrations/
    ├── functions/
    └── seed.sql
```

---

## 5. Règles de développement UI/UX

### Règles communes
- Tester sur **iPhone SE (375 px)** et **desktop 1280 px** avant push
- Composants shadcn/ui sans modification ; wrappers si besoin
- Action destructive → confirmation modale obligatoire
- Action longue (> 500 ms) → spinner ou skeleton
- Messages d'erreur **en français**, sans code technique
- États vides illustrés et explicatifs
- Validation formulaires : zod côté client + côté serveur
- Couleurs sémantiques : vert succès, orange attention, rouge danger, bleu info
- Contraste WCAG AA minimum (4.5:1)
- Aucun texte < 14 px

### Règles renforcées côté régulateur
- **Cockpit temps réel** = écran d'accueil par défaut
- **Saisie express** accessible par raccourci clavier global (Cmd/Ctrl+N)
- **Recherche patient** instantanée à 2 caractères, fuzzy
- Tableaux > 20 lignes : tri, filtres, pagination obligatoires
- Possibilité de mettre une saisie en pause et y revenir (file d'attente brouillons)
- Multi-saisies en parallèle (ne pas bloquer la régulatrice si nouvel appel)
- Raccourcis clavier sur toutes actions fréquentes

### Règles renforcées côté chauffeur (PWA mobile)
- Boutons d'action principale **≥ 56 px de hauteur**
- Texte d'action **≥ 18 px**
- Une action principale unique par écran (en bas, accessible au pouce)
- **Maximum 3 informations** simultanées sur l'écran de course en cours
- Confirmation des actions par **swipe** (évite clics accidentels)
- **Mode contraste élevé** activable
- **Police agrandie** option (+20 %)
- **Lecture vocale** (TTS) du nom patient et adresse au démarrage de course
- Indicateur batterie + connexion réseau visibles en permanence
- **Mode hors-ligne** : tournée, démarrage/clôture course, scan BT (sync différée)
- Indicateur explicite « hors-ligne » + nb d'éléments en attente de sync

### À ne jamais faire
- ❌ Jargon technique en UI ("error 500", "unauthorized")
- ❌ Icônes seules sans label (sauf icônes universelles)
- ❌ Action critique à côté d'une action banale
- ❌ Scroll horizontal sur mobile
- ❌ Plus de 3 informations sur l'écran « course en cours » du chauffeur
- ❌ Bloquer la régulatrice pendant la saisie d'une course

---

## 6. Règles de sécurité (non négociables)

### Authentification
- Authentification **uniquement** via Supabase Auth (PKCE flow)
- 2FA optionnel pour `dirigeant` et `regulateur`, désactivé pour `chauffeur`
- Session chauffeur : 8 h max
- Session régulateur : 15 min d'inactivité
- Mode « régulateur de garde » : un seul régulateur actif simultané

### Row Level Security (RLS)
- **TOUTE table métier doit avoir RLS activée**
- Toute table métier doit avoir une colonne `organization_id`
- Politique RLS systématique
- Un chauffeur ne voit QUE ses propres tournées (`driver_id = auth.uid()`)
- **Tests RLS automatisés** avant chaque release

### Chiffrement des données sensibles
- NIR : **chiffré applicatif AES-256-GCM**, clé hors Supabase
- Notes médicales : **chiffrées applicatif**
- TLS 1.3 minimum

### SMS et communication patient
- **Consentement explicite et horodaté** du patient avant tout SMS
- Numéro expéditeur = numéro pro de la société
- Archivage de toute communication dans la fiche patient
- Préférence patient (SMS / appel / aucun) respectée systématiquement

### Géolocalisation chauffeur
- Capture **uniquement pendant le service**
- Information préalable obligatoire en CGU + onboarding
- Stockage 90 jours max en base chaude, agrégation puis purge automatique

### Audit et traçabilité
- Toute action sensible journalisée dans `audit_logs` :
  - Création / modification / archivage de patient, prescription, course, récurrence
  - Connexions, échecs de connexion
  - Modifications de paramètres tarifaires
  - Encaissements (caisse)
  - Exports de données
  - Modifications de notes médicales
  - Envois SMS

### À ne jamais faire
- ❌ Stocker secrets dans le code ou le front
- ❌ Logger NIR, notes médicales, tokens
- ❌ `service_role` Supabase côté client
- ❌ Désactiver RLS pour "déboguer"
- ❌ SQL avec interpolation
- ❌ Stack traces ou erreurs Postgres brutes au client
- ❌ Bons de transport ou photos sur service non HDS-compatible (V2 commerciale)
- ❌ Envoyer un SMS sans consentement actif

---

## 7. Conventions de code

### TypeScript
- `strict: true` partout, pas de `any` sauf cas justifié
- Types Supabase générés (`supabase gen types typescript`)
- Validation runtime via zod ; types TS via `z.infer`

### Style et nommage
- Fichiers : `kebab-case.ts` ; composants : `PascalCase.tsx`
- Hooks : `useXxx`
- Variables et fonctions : `camelCase`
- Constantes : `SCREAMING_SNAKE_CASE`
- Tables et colonnes Postgres : `snake_case`

### React et Next.js
- App Router uniquement
- Server Components par défaut, `"use client"` seulement si nécessaire
- Pas de `useEffect` pour fetch initial
- État global minimal

### Supabase
- Migrations versionnées
- Pas de modification de schéma via UI Supabase en prod
- RLS écrite **dans la migration**
- Tests RLS dans `supabase/tests/`

### Langue
- Messages utilisateur en **français**
- Logs et commentaires en français
- Commits : `type(scope): description` en français

---

## 8. Workflow obligatoire avant de coder

1. **Identifier le module** dans le chapitre 5 du cahier des charges V2
2. **Lire le module complet** y compris cas particuliers
3. **Vérifier les règles de gestion** (cycle de vie, contraintes métier)
4. **Vérifier le modèle de données** (chapitre 6)
5. **Pour la tarification** : chapitre 7 + `packages/pricing`
6. **Pour les courses récurrentes** : module 5.9 + `packages/recurrence`
7. **Pour les SMS** : module 5.15 + `packages/sms`
8. **Pour les imprévus** : module 5.14 (workflows précis)
9. **Proposer un plan court** avant de coder
10. **Écrire les tests** en parallèle
11. **Vérifier RLS** si la tâche touche à une table

---

## 9. Tests

### Couverture exigée
- `packages/pricing` : **100 % branches**
- `packages/recurrence` : **100 % branches**
- `packages/domain` : ≥ 80 %
- Composants UI critiques (saisie express, cockpit, course en cours) : tests d'intégration
- Workflow imprévus (panne, patient absent, réaffectation) : tests E2E
- RLS : tests systématiques

### Outils
- Vitest pour TS / packages
- Playwright pour les tests E2E
- pgTAP pour RLS
- pytest pour le service Python OR-Tools

---

## 10. Patterns à utiliser systématiquement

### Toute mutation de données
```
Validation zod → Vérification autorisation → Transaction → Audit log → Réponse
```

### Tout fetch Supabase côté client
```
Hook React Query → Type généré Supabase → Gestion loading/error/empty → Composant
```

### Tout formulaire
```
Schéma zod → react-hook-form + zodResolver → shadcn → Erreurs sous champ
```

### Toute liste de + de 20 items
```
Recherche fuzzy + tri + filtres + pagination ou virtualisation
```

### Tout SMS sortant
```
Vérif consentement → Template → Personnalisation → Envoi fournisseur → Log → Statut delivery
```

### Toute course récurrente générée
```
Schéma récurrence → Calcul prochaines dates → Vérif exceptions (jours fériés 974) → Création courses → Décrément bon transport
```

---

## 11. Anti-patterns interdits

- ❌ Logique métier dans les composants React (déléguer à `packages/domain`)
- ❌ Calcul de tarification ailleurs que dans `packages/pricing`
- ❌ Génération de récurrence ailleurs que dans `packages/recurrence`
- ❌ Envoi de SMS ailleurs que via `packages/sms`
- ❌ Requêtes Supabase sans typage
- ❌ `useEffect` pour des données que Server Components peuvent fournir
- ❌ Fichiers de plus de 300 lignes
- ❌ Composant React de plus de 150 lignes
- ❌ Fonction de plus de 50 lignes
- ❌ Plus de 3 niveaux d'imbrication
- ❌ Magic numbers et magic strings
- ❌ `console.log` laissé dans un commit

---

## 12. Glossaire métier

| Terme | Sens dans le code |
|---|---|
| `ride` | Course planifiée |
| `ride_recurrence` | Modèle de récurrence (dialyse 3×/semaine) |
| `ride_recurrence_exception` | Exception sur une occurrence |
| `ride_execution` | Exécution réelle d'une course |
| `ride_payment` | Encaissement direct (cash, CB, chèque) |
| `ride_dispute` | Litige facturation CGSS |
| `tournee` | Planning journalier d'un chauffeur |
| `ride_group` | Groupe de courses mutualisées |
| `prescription` | Bon de transport médical |
| `prescriber` | Médecin émetteur du BT |
| `b2b_client` | Donneur d'ordres B2B (hôpital, clinique, EHPAD) |
| `tariff_grid` | Grille tarifaire CGSS versionnée |
| `b2b_tariff_grid` | Grille tarifaire propre à un donneur d'ordres |
| `ride_billing` | Calcul de facturation d'une course |
| `sms_message` | SMS sortant ou réponse patient |
| `patient_preference` | Préférences patient |
| `patient_operational_note` | Note libre régulateur (codes, particularités) |
| `patient_incident` | Incident historique (retard, refus, conflit) |
| TPMR | Transport Personne à Mobilité Réduite |
| Mutualisation | Plusieurs patients dans le même véhicule |
| Mutualisation temporelle | Courses intercalées dans un temps d'attente |
| Course à vide | Trajet sans patient |
| ALD | Affection Longue Durée |

> Glossaire complet : chapitre 4 du cahier des charges V2.

---

## 13. Communication avec Guillaume

- Réponses **en français**, claires et précises, sans chichi
- Pas de blabla d'introduction, aller au fait
- Choix d'architecture : **proposer 2-3 options** avec trade-offs
- Trade-off touchant aux 3 piliers : **demander avant d'agir**
- Signaler proactivement les risques
- RGPD/HDS : Guillaume n'est pas juriste, expliquer simplement
- Décisions structurantes dans `docs/adr/`
- Retours d'observation terrain dans `docs/observations/`

---

## 14. État d'avancement

```
LOT EN COURS : Phase 2 — Saisie express course (à démarrer)
PHASES LIVRÉES :
  - Phase 0 (Lot 0) — Fondations monorepo + multi-tenant Supabase + RLS + CI/CD
  - Phase 1 — Référentiel patients + recherche fuzzy + NIR chiffré (Edge Function)
  - Phase 1.5 — DPA + RGPD compliance (livrée 2026-05-07)

LOT 1.5 LIVRÉ (2026-05-07) :
  - 5 migrations RGPD (legal_compliance + additional + breach_72h_alert + dpo_fields + anonymize_rpc)
  - 8 tables : data_processing_register, dpa_record, dpia_record, data_breach_incident,
    patient_data_request, cgu_acceptance, cookie_consent_log, legal_request_attempts
  - RPC SECURITY DEFINER : rgpd_anonymize_patient (art. 17), nir_match_patient_for_legal_request
  - Watchdog pg_cron breach 72h + purge legal_request_attempts
  - 7 fichiers pgTAP (5 RLS + watchdog + anonymize)
  - Helpers TS @tap/shared : legal-token (HS256), patient-data-export, patient-anonymize, validators/legal
  - 5 pages SSG /legal/* (cgu, cgv, confidentialite, cookies, dpo) sans auth requise
  - Portail patient JWT-gated /legal/request/[token] + /access + /erasure (rate-limit 5/h)
  - Bandeau cookies CNIL-conforme (3 boutons symétriques, pas de pré-coché)
  - 6 routes admin RGPD : registre (PDF), dpa, dpia, breaches (compteur 72h temps réel), requests, dpo
  - Banner CGU acceptance non-bloquant
  - Vitest 31/32 GREEN (1 fail Phase 0 hors-scope SIRET Luhn — dette tracée)
  - Playwright 14 specs compilent et sont listés (sandbox-bloqué Docker — exécution CI cloud)

DERNIER COMMIT MAJEUR : feat(1.5): phase 1.5 verifiée — RGPD compliance complète

DETTE IDENTIFIÉE :
  - SIRET Luhn check `40483304800010` (test Phase 0 commun) — fix dédié à planifier
  - Schema push local non testé sandbox (Docker registry public.ecr.aws bloqué) — CI cloud à valider
  - 2 imports @supabase/supabase-js exceptions documentées :
    apps/web/src/lib/supabase/admin.ts (service_role admin client, légitime)
    apps/web/src/app/(public)/legal/request/[token]/actions.ts (import type SupabaseClient seul)

DESIGN PARTNERS ACTIFS : (à remplir)
IMMERSIONS RÉALISÉES : (à remplir)
```

---

## 15. Contexte de démarrage

Conversation initiale de conception (mai 2026) couvrant :
- Décomposition des 24 modules fonctionnels et acteurs
- Choix stack technique (Turborepo, Supabase, OR-Tools, OSRM)
- Stratégie GitHub Flow adapté + CI/CD
- Lot 0 exécuté : fondations multi-tenant, RLS, migrations

Lot en cours : **Lot 1** — Référentiels patients + saisie express

---

**Fin du fichier. À relire à chaque nouvelle session.**
