# Phase 3 — Passe 1 (squelette E2E) — Context

**Pivot ADR** : ADR-003 (2026-05-11)
**Status** : Ready for plan instruction (PATTERNS + RESEARCH à produire avant les plans)
**Mode** : E2E par passes successives — Passe 1 sur 4

---

## 4.1 Goal

Une régulatrice et un chauffeur peuvent enchaîner ensemble une course du premier appel patient à la trace finale en moins de 10 minutes, en jouant les 6 maillons. Le résultat est utilisable pour une démo design partner, pas pour une production commerciale.

## 4.2 Périmètre — dans / hors

**Dans la Passe 1 :**

- Référentiel chauffeurs (CRUD basique, dirigeant)
- Référentiel véhicules (CRUD basique, dirigeant)
- Assignation course → chauffeur via liste déroulante (pas de drag & drop, pas d'optimisation)
- Vue chauffeur « ma journée » accessible sur navigateur mobile (responsive Tailwind, pas de PWA)
- Bouton « Démarrer » + « Clôturer » sur la course côté chauffeur
- Saisie manuelle du tarif à la clôture (numeric, champ libre)
- Marquage encaissement : on / off + méthode (cash, CB, chèque, CGSS différé)
- Liste du jour côté régulateur avec colonne chauffeur + statut + paiement
- Audit triggers existants étendus aux nouveaux champs

**Hors Passe 1 (différés explicitement) :**

- PWA installable (Passe 2)
- Hors-ligne (Passe 2)
- Calcul tarif CGSS automatique (Passe 2 sur le cas standard, Passe 3 pour les cas particuliers)
- Drag & drop assignation (Passe 3 minimum)
- Concept de tournée comme objet métier persistant (Passe 3)
- Récurrences (Passe 3)
- SMS patient (Passe 3)
- Optimisation OR-Tools (Passe 4)
- Mode dégradé, mode 2FA, sessions différenciées par rôle au-delà de l'existant (Passe 4)
- B2B portail donneurs d'ordres (Passe 4)
- Imprévus structurés : un bouton « Annuler » avec champ libre suffit en Passe 1

## 4.3 Schéma de données ajouté

**Nouvelle table `drivers`** (référentiel chauffeurs propre à l'organization) :

```
drivers (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  nom_affichage text not null,
  telephone text,
  numero_licence text,
  type_permis text[] not null default '{}',  -- 'taxi', 'ambulance', 'vsl', 'tpmr'
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
)
```

Note : `profile_id` nullable pour permettre d'enregistrer un chauffeur en référentiel avant qu'il n'ait un compte Auth (cas réel : on saisit les chauffeurs en démo avant de les onboarder).

**Nouvelle table `vehicles`** (référentiel véhicules) :

```
vehicles (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  immatriculation text not null,
  marque text,
  modele text,
  type text not null check (type in ('taxi_conventionne', 'tpmr', 'vsl', 'ambulance')),
  places_assises int,
  places_tpmr int,
  actif boolean not null default true,
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Contrainte unique partielle : `(organization_id, immatriculation) where archive = false`.

**Extension de la table `rides`** (par ALTER) :

```
alter table rides add column driver_id uuid references drivers(id);
alter table rides add column vehicle_id uuid references vehicles(id);
alter table rides add column started_at timestamptz;
alter table rides add column ended_at timestamptz;
alter table rides add column tarif_amount_eur numeric(10,2);
alter table rides add column tarif_source text check (tarif_source in ('manuel', 'cgss_auto'));
alter table rides add column payment_status text check (payment_status in ('non_concerne', 'a_encaisser', 'encaisse')) default 'non_concerne';
alter table rides add column payment_method text check (payment_method in ('cash', 'cb', 'cheque', 'cgss_differe'));
alter table rides add column payment_received_at timestamptz;
```

Le `ride_status` enum existant gagne `'assignee'` (déjà prévu) et reste utilisable tel quel.

## 4.4 Migrations à écrire

1. `20260512000001_drivers.sql` — table + RLS (lecture orga, écriture dirigeant) + index + audit trigger
2. `20260512000002_vehicles.sql` — idem véhicules
3. `20260512000003_rides_execution.sql` — ALTER rides + extension du trigger d'audit pour journaliser les transitions de statut + index `(driver_id, scheduled_at)` partiel sur statuts actifs

Toutes les migrations respectent les patterns Phase 1 / Phase 2 : RLS forcée, `current_organization_id()`, audit trigger avec filtre du ciphertext NIR (sans objet ici).

## 4.5 Server Actions à écrire

Dans `apps/web/src/app/(app)/courses/actions.ts` :

- `assignRideAction({ rideId, driverId, vehicleId? })` — régulateur uniquement, transition `validee → assignee`
- `unassignRideAction(rideId)` — régulateur, transition `assignee → validee`
- `updateRidePaymentAction({ rideId, payment_status, payment_method, tarif_amount_eur })` — régulateur

Dans `apps/web/src/app/(driver)/conduite/actions.ts` (nouveau) :

- `startRideAction(rideId)` — chauffeur, transition `assignee → en_cours`, set `started_at`
- `endRideAction({ rideId, tarif_amount_eur, payment_status, payment_method })` — chauffeur, transition `en_cours → terminee`, set `ended_at`

Toutes les actions :

- Validation zod côté serveur (defense in depth)
- `auth.getUser()` puis vérif rôle
- `revalidatePath` après mutation
- Pas de `redirect` (pattern Phase 2)
- Audit log automatique via trigger Postgres (rien à faire côté Server Action)

## 4.6 Écrans à créer

**Régulateur — étendus :**

- `/courses` (existe) : ajouter colonnes « Chauffeur » et « Paiement », bouton « Assigner » par ligne `validee`, bouton « Marquer encaissé » par ligne `terminee` avec `payment_status = 'a_encaisser'`.
- `/courses/[id]` (nouveau) : drawer ou page de détail course. Statut courant, historique des transitions (lecture `audit_logs`), boutons d'action contextuels selon statut.

**Dirigeant — pas de CRUD UI Passe 1 :**

Les chauffeurs et véhicules sont seedés en dur dans `seed.demo.sql`, 3 chauffeurs + 3 véhicules fictifs 974. CRUD UI repoussé Passe 2.

**Chauffeur — nouveau groupe de routes :**

- `apps/web/src/app/(driver)/conduite/page.tsx` — « ma journée » : liste des courses du jour assignées à `auth.uid()`, triées par `scheduled_at` croissant. Pour chaque course : nom patient, heure, adresses, bouton primaire contextuel (« Démarrer », « Clôturer », ou statut « Terminée »).
- `apps/web/src/app/(driver)/conduite/[rideId]/page.tsx` — vue détail d'une course en cours d'exécution + modal de clôture (tarif + paiement).
- `apps/web/src/app/(driver)/layout.tsx` — layout dédié, header simplifié, bouton retour « Ma journée ». Auth vérifie `role = 'chauffeur' or role in ('regulateur', 'dirigeant')` (pour démo, le régulateur peut basculer côté chauffeur).

**Choix architectural assumé :** on ne crée PAS encore `apps/mobile`. La PWA n'arrive qu'en Passe 2. Pour la Passe 1, le chauffeur ouvre Chrome sur son téléphone, va sur `tap-web-brown.vercel.app/conduite`, et c'est suffisant. Design system existant + responsive Tailwind = on tient le minimum 56px boutons et 18px texte.

## 4.7 Critères E2E

**Test Playwright unique — `apps/web/tests/e2e/passe1.spec.ts` :**

E2E-P1-01 — Parcours complet 1 course :

1. Login régulateur seed
2. Créer 1 patient « Hoarau Patrick » (ou réutiliser seed)
3. Créer 1 course pour ce patient, créneau « demain 14h », adresses seedées
4. Assigner la course au chauffeur « Vergoz Jean » seed
5. Vérifier statut `assignee` en DB
6. Logout, login chauffeur seed
7. Aller sur `/conduite`, voir la course du lendemain
8. Cliquer « Démarrer », vérifier `en_cours` + `started_at`
9. Cliquer « Clôturer », saisir tarif 25.00 + payment_method=cash + payment_status=encaisse
10. Vérifier `terminee` + `ended_at` + `payment_received_at`
11. Logout, login régulateur
12. Aller sur `/courses`, vérifier la course en haut, statut terminée, paiement encaissé
13. Assertions : durée totale du parcours < 3 min, 0 erreur 500, 7 entrées dans `audit_logs` pour cette course

**Critère manuel Guillaume :**

Jouer 5 courses fictives en moins de 15 minutes total, depuis la création patient jusqu'au statut `terminee` + encaissée. 0 bug bloquant. Frictions notées dans `03-SUMMARY.md` section « Frictions identifiées ».

## 4.8 Plans à découper

La phase se découpera en 4 plans (à instruire au moment d'attaquer) :

- 03-01-PLAN — Migrations drivers + vehicles + rides ALTER + pgTAP + seed démo étendu (3 chauffeurs + 3 véhicules 974)
- 03-02-PLAN — Server Actions + queries RSC
- 03-03-PLAN — Écrans régulateur étendus `/courses` + drawer détail + assignation
- 03-04-PLAN — Écrans chauffeur `/conduite` + flow Démarrer/Clôturer + E2E Playwright

Estimation grossière : 5 à 8 jours-dev, sans terrain en parallèle.
