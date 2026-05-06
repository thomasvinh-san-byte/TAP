# Constraints (intel synthétisée)

> Aucune SPEC formelle n'a été ingérée. Les contraintes listées proviennent de
> CLAUDE.md et des deux ADRs. Type assigné : `nfr` (non-functional) sauf indication.

---

## CON-001 — Hébergement HDS pour la production commerciale

- **source**: /home/user/TAP/CLAUDE.md § 1, § 6 ; /home/user/TAP/README.md
- **type**: nfr (conformité)
- **contenu** : les données traitées sont **données de santé** (RGPD niveau santé +
  HDS). L'hébergement de production commerciale doit être HDS-certifié.
  L'architecture doit rester portable : Postgres standard côté Supabase permet
  une migration future vers OVHcloud Postgres ou Scaleway HDS sans refonte
  (cf. DEC-002 / ADR-002).
- **alerte** : Supabase Cloud n'est pas (à date) certifié HDS. Une bêta privée
  sous DPA est acceptable ; tout passage à un usage commercial impose le bascule
  vers une infra HDS.

---

## CON-002 — Multi-tenant : RLS forcée + organization_id sur toute table métier

- **source**: /home/user/TAP/docs/adr/ADR-002-supabase-rls-multitenant.md
- **type**: schema (contrainte structurelle)
- **contenu** :
  - Toute table métier doit porter `organization_id uuid not null references organizations(id)`.
  - RLS activée ET forcée (`force row level security`) systématiquement.
  - Policies SELECT/UPDATE/INSERT/DELETE filtrant sur
    `organization_id = public.current_organization_id()`.
  - Tests pgTAP automatisés à chaque PR.
  - Index obligatoire sur `(organization_id, ...)` pour les tables à fort volume
    (rides, audit_logs).
  - `service_role` interdit côté client : audit CI bloquant
    `SUPABASE_SERVICE_ROLE_KEY` sous `apps/*/src/**`.

---

## CON-003 — Chiffrement applicatif AES-256-GCM des données ultra-sensibles

- **source**: /home/user/TAP/CLAUDE.md § 6
- **type**: nfr (sécurité)
- **contenu** :
  - NIR : chiffré applicatif **AES-256-GCM**, clé hors Supabase.
  - Notes médicales : chiffrées applicatif.
  - TLS 1.3 minimum sur tout transport.
  - Interdiction de logger NIR, notes médicales, tokens.

---

## CON-004 — Performance perçue (UX SLOs)

- **source**: /home/user/TAP/CLAUDE.md § 1
- **type**: nfr (performance)
- **contenu** :
  - Saisie d'une course en mode express : < 30 s.
  - Feedback visuel sur toute action : < 100 ms (optimistic UI obligatoire).
  - Confirmation d'action chauffeur : < 1 s même en 3G.
  - TTI régulateur : < 2 s.

---

## CON-005 — Accessibilité WCAG 2.1 AA

- **source**: /home/user/TAP/CLAUDE.md § 1, § 5
- **type**: nfr (accessibilité)
- **contenu** :
  - Contraste minimum 4.5:1.
  - Navigation clavier complète, focus clavier visible (anneau coloré avec offset).
  - Aucun texte < 14 px.
  - Respect strict de `prefers-reduced-motion`.
  - Mode contraste élevé et police +20 % activables côté chauffeur.

---

## CON-006 — Système de design strict (spacing, typographie, iconographie)

- **source**: /home/user/TAP/CLAUDE.md § 1
- **type**: nfr (cohérence visuelle)
- **contenu** :
  - Échelle de spacing : `4, 8, 12, 16, 24, 32, 48, 64` px ; aucune valeur
    intermédiaire.
  - Grille 12 colonnes côté régulateur ; alignements au pixel près.
  - Une seule famille de polices (Inter, Manrope ou Geist Sans), 6 niveaux de
    taille, 4 graisses, **chiffres tabulaires obligatoires**.
  - Une seule famille d'icônes : Lucide, ligne fine, jamais mixée.
  - 4 niveaux d'ombres (none, sm, md, lg) jamais utilisés au hasard.
  - Mode jour ET mode nuit traités à parité (pas une simple inversion).
  - 5 états visuels distincts par élément interactif (repos/survol/pressé/actif/désactivé).
  - Transitions 150 ms ease-out, jamais brutales.
  - Skeleton screens (jamais de spinners) pour chargements > 500 ms.

---

## CON-007 — TypeScript strict et validation runtime

- **source**: /home/user/TAP/CLAUDE.md § 7
- **type**: nfr (qualité code)
- **contenu** :
  - `strict: true` partout, pas de `any` sauf cas justifié.
  - Types Supabase générés (`supabase gen types typescript`).
  - Validation runtime via **zod** ; types TS via `z.infer`.
  - Pas d'interpolation SQL (parameterized queries uniquement).
  - Server Components par défaut (Next.js App Router) ; `"use client"` seulement
    si nécessaire.
  - Pas de `useEffect` pour fetch initial.

---

## CON-008 — Limites de taille de code

- **source**: /home/user/TAP/CLAUDE.md § 11
- **type**: nfr (maintenabilité)
- **contenu** :
  - Fichier ≤ 300 lignes.
  - Composant React ≤ 150 lignes.
  - Fonction ≤ 50 lignes.
  - ≤ 3 niveaux d'imbrication.
  - Pas de magic numbers / magic strings.
  - Pas de `console.log` dans un commit.

---

## CON-009 — Internationalisation : français uniquement (UI/erreurs/commits)

- **source**: /home/user/TAP/CLAUDE.md § 5, § 7
- **type**: nfr (i18n)
- **contenu** :
  - Messages utilisateur en français.
  - Aucun message d'erreur technique brut affiché (reformulation systématique).
  - Pas de jargon technique en UI ("error 500", "unauthorized").
  - Logs et commentaires en français.
  - Commits format `type(scope): description` en français.

---

## CON-010 — Cibles de test responsive et device

- **source**: /home/user/TAP/CLAUDE.md § 5
- **type**: nfr (responsive)
- **contenu** :
  - Tester sur **iPhone SE (375 px)** et **desktop 1280 px** avant push.
  - Mobile-first sur la PWA chauffeur.
  - Desktop-first sur le régulateur.
  - Pas de scroll horizontal sur mobile.

---

## CON-011 — Anti-patterns visuels strictement interdits

- **source**: /home/user/TAP/CLAUDE.md § 1
- **type**: nfr (design system — exclusions)
- **contenu** :
  - Couleurs criardes saturées, dégradés années 2010, biseaux 3D.
  - Tableaux à bordures épaisses, alternance de lignes contrastées.
  - Mélange d'icônes de plusieurs familles.
  - Polices web datées (Verdana, Tahoma, Arial brut).
  - Emojis dans l'interface.
  - Animations excessives (rebonds, paillettes, flash).
  - Wireframes Bootstrap reconnaissables.
  - Stack traces visibles, chargements bloquants pleine page.
  - Pop-ups de confirmation pour actions banales.

---

## CON-012 — Architecture monorepo : règles de dépendance

- **source**: /home/user/TAP/docs/adr/ADR-001-monorepo-turborepo.md
- **type**: schema (architecture)
- **contenu** :
  - `apps/*` peuvent dépendre des `packages/*`. **Jamais l'inverse.**
  - Surveillance via `eslint-plugin-import` + conventions de dépendances.
  - Pas de coupling implicite entre packages.

---

## CON-013 — Géolocalisation chauffeur : fenêtre & rétention

- **source**: /home/user/TAP/CLAUDE.md § 6
- **type**: nfr (RGPD)
- **contenu** :
  - Capture uniquement pendant le service.
  - Information préalable obligatoire en CGU + onboarding.
  - Stockage 90 jours max en base chaude.
  - Agrégation puis purge automatique.

---

## CON-014 — Sessions et isolation utilisateur

- **source**: /home/user/TAP/CLAUDE.md § 6
- **type**: nfr (sécurité)
- **contenu** :
  - Session chauffeur : 8 h max.
  - Session régulateur : 15 min d'inactivité.
  - Mode « régulateur de garde » : un seul régulateur actif simultané.
  - Un chauffeur ne voit QUE ses propres tournées (`driver_id = auth.uid()`).
  - Trigger anti-élévation de privilège sur `profiles` (cf. ADR-002).
