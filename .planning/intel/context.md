# Context (intel synthétisée)

> Notes contextuelles consolidées à partir des documents DOC ingérés.
> Chaque section est attribuée à sa source.

---

## Identité projet

- **source**: /home/user/TAP/CLAUDE.md § 0 ; /home/user/TAP/README.md

**Nom de travail** : SaaS TAP Réunion.

**Nature** : SaaS de régulation, optimisation, communication patient et pilotage
pour sociétés de Transport Assis Professionnalisé (TAP) et taxiteurs conventionnés
CGSS à La Réunion.

**Cible utilisateur principale** : la régulatrice — 8 h/jour dans l'outil. Sa
satisfaction conditionne 80 % du succès produit. Sur 10 ans de métier elle passera
plus de 17 000 heures à regarder ces écrans.

**Document de référence métier** : `docs/cahier_des_charges_saas_tap_v2.docx`
(non ingéré — format binaire .docx).

---

## Méthode produit : observations de terrain

- **source**: /home/user/TAP/docs/observations/README.md

Le pilier 1 (UX qui donne envie d'être utilisée 8 h/jour) impose **de voir le
métier en vrai**, pas de l'imaginer. Toute observation terrain (journée passée
avec une régulatrice, run en double avec un chauffeur, point avec un dirigeant)
est consignée sous `docs/observations/`.

**Format** : un fichier par session, nommé `AAAA-MM-JJ-societe-role.md`.
Squelette : durée, personne observée, contexte, faits bruts, ce qui marche,
ce qui ne marche pas, verbatim, implications produit.

**Confidentialité** : pas de nom de patient, pas de NIR, pas d'adresse exacte ;
anonymisation systématique ("Patient A", "Adresse X") ; détails sensibles stockés
hors dépôt.

---

## Architecture du dépôt

- **source**: /home/user/TAP/CLAUDE.md § 4

```
/
├── CLAUDE.md
├── docs/
│   ├── cahier_des_charges_saas_tap_v2.docx
│   ├── adr/                 # Architecture Decision Records
│   └── observations/        # Notes immersion design partners
├── apps/
│   ├── web/                 # Next.js régulateur (desktop)
│   ├── mobile/              # Next.js PWA chauffeur
│   ├── admin/               # Back-office super-admin
│   └── b2b/                 # Portail donneurs d'ordres (V1.5)
├── packages/
│   ├── ui/                  # shadcn/ui partagé
│   ├── domain/              # logique métier pure (TS)
│   ├── pricing/             # moteur tarification CGSS
│   ├── optimizer-client/    # client TS du service Python OR-Tools
│   ├── recurrence/          # moteur génération courses récurrentes
│   ├── sms/                 # gestion templates et envoi SMS
│   ├── database/            # types Supabase, migrations, RLS
│   └── shared/              # utils, validators (zod)
├── services/
│   ├── optimizer/           # microservice Python OR-Tools
│   └── osrm/                # config OSRM
└── supabase/
    ├── migrations/
    ├── functions/
    └── seed.sql
```

---

## ADR : conventions et index

- **source**: /home/user/TAP/docs/adr/README.md

Format inspiré de Michael Nygard. Chaque ADR contient : Statut, Date, Auteur,
Contexte, Décision, Alternatives considérées, Conséquences. Numérotation
séquentielle, jamais réutilisée. Une décision = un fichier. Un ADR ne se modifie
pas après acceptation : si la décision change, on crée un nouvel ADR qui remplace
l'ancien (statut « Remplacé par ADR-XXX »). Garder les ADR courts (< 1 page).

**Index actuel**
- ADR-001 — Monorepo Turborepo + pnpm workspaces (Accepté).
- ADR-002 — Multi-tenant via Supabase RLS et `organization_id` (Accepté).

---

## Démarrage local

- **source**: /home/user/TAP/README.md

Prérequis : Node 20+ (`nvm use`), pnpm 9+ (`corepack enable`), Docker (Supabase
local), Supabase CLI.

```bash
pnpm install
pnpm db:start          # Supabase local (Docker)
pnpm db:reset          # migrations + seed
pnpm db:test           # tests pgTAP (RLS)
pnpm dev               # apps en parallèle
```

**Comptes de démo (seed)** :
- Dirigeant : `dirigeant@demo.tap` / `demo1234!`
- Régulateur : `regulateur@demo.tap` / `demo1234!`
- Chauffeur : `chauffeur@demo.tap` / `demo1234!`

---

## Glossaire métier

- **source**: /home/user/TAP/CLAUDE.md § 12 (extrait du chapitre 4 du CDC v2)

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
| `ride_billing` | Calcul facturation d'une course |
| `sms_message` | SMS sortant ou réponse patient |
| `patient_preference` | Préférences patient |
| `patient_operational_note` | Note libre régulateur (codes, particularités) |
| `patient_incident` | Incident historique (retard, refus, conflit) |
| TPMR | Transport Personne à Mobilité Réduite |
| Mutualisation | Plusieurs patients dans le même véhicule |
| Mutualisation temporelle | Courses intercalées dans un temps d'attente |
| Course à vide | Trajet sans patient |
| ALD | Affection Longue Durée |

---

## Patterns d'implémentation systématiques

- **source**: /home/user/TAP/CLAUDE.md § 10

- **Toute mutation de données** :
  `Validation zod → Vérification autorisation → Transaction → Audit log → Réponse`
- **Tout fetch Supabase côté client** :
  `Hook React Query → Type généré Supabase → Gestion loading/error/empty → Composant`
- **Tout formulaire** :
  `Schéma zod → react-hook-form + zodResolver → shadcn → Erreurs sous champ`
- **Toute liste de + de 20 items** :
  `Recherche fuzzy + tri + filtres + pagination ou virtualisation`
- **Tout SMS sortant** :
  `Vérif consentement → Template → Personnalisation → Envoi fournisseur → Log → Statut delivery`
- **Toute course récurrente générée** :
  `Schéma récurrence → Calcul prochaines dates → Vérif exceptions (jours fériés 974)
   → Création courses → Décrément bon transport`

---

## État d'avancement (mai 2026)

- **source**: /home/user/TAP/CLAUDE.md § 14, § 15

- **LOT 0** — Fondations multi-tenant, RLS, migrations, CI/CD : **TERMINÉ**.
- **LOT 1** — Référentiels patients + saisie express : **EN COURS**.
- Dernier commit majeur : `chore(lot-0): fondations monorepo + multi-tenant Supabase`.
- Conversation initiale (mai 2026) ayant produit :
  - Décomposition des 24 modules fonctionnels et acteurs.
  - Choix stack technique (Turborepo, Supabase, OR-Tools, OSRM).
  - Stratégie GitHub Flow adapté + CI/CD.
  - Lot 0 exécuté : fondations multi-tenant, RLS, migrations.
- Champs à remplir : dette identifiée, design partners actifs, immersions réalisées.

---

## Communication avec le propriétaire projet (Guillaume)

- **source**: /home/user/TAP/CLAUDE.md § 13

- Réponses en français, claires et précises, sans chichi.
- Pas de blabla d'introduction, aller au fait.
- Choix d'architecture : proposer 2-3 options avec trade-offs.
- Trade-off touchant aux 3 piliers (UX, design, sécurité) : **demander avant d'agir**.
- Signaler proactivement les risques.
- RGPD/HDS : Guillaume n'est pas juriste, expliquer simplement.
- Décisions structurantes consignées dans `docs/adr/`.
- Retours d'observation terrain dans `docs/observations/`.
