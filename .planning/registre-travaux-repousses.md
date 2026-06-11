# Registre des travaux repoussés — TAP

But : qu'aucun report ne devienne un oubli. Chaque entrée porte sa DÉCISION, sa
RAISON, et sa CONDITION DE DÉBLOCAGE (ce qu'il faut délibérer, acheter ou choisir
avant de pouvoir lancer). Tenu à jour à chaque report. Établi 2026-06-08.

Légende déblocage : 🗳 À DÉLIBÉRER (décision dirigeant) · 💳 ACHAT/CONTRAT (dépense,
abonnement, prestataire) · 🔍 CHOIX TECHNIQUE (sélection à instruire) · 📄 INFO
EXTERNE (donnée/spec à obtenir d'un tiers).

---

## 1. Infrastructure & hébergement

### 1.1 Hébergement HDS (Hébergeur de Données de Santé)
- **Décision** : repoussé jusqu'à la mise en production commerciale (verrou 1er client payant). Réf DEC-065 (migration HDS = phase dédiée).
- **Raison** : obligation légale dès l'exploitation commerciale de données de santé réelles, mais coût récurrent significatif + migration lourde. Tant qu'on est en design partner / preview, non requis.
- **Déblocage** : 💳 ACHAT (hébergeur certifié HDS) + 🗳 décision business (engagement 1er client). Candidats à instruire : OVHcloud HDS, Scaleway, autres. 🔍 choix à arbitrer sur coût/réversibilité.
- **Dépend de / bloque** : bloque géoloc réelle, upload de scans (bons, documents conformité), tout stockage de données santé en prod.
- **Note 2026-06-10 (DEC-143)** : la COQUILLE d'upload de documents conformité est posée (flag `UPLOAD_DOCS_ENABLED` OFF) — UI passive en prod, action d'upload = stub explicite. Reste à construire en Phase 09 : **bucket HDS + RLS Storage + branchement `.upload()` réel** dans `uploadComplianceDocumentAction`.

### 1.2 Email transactionnel (provider)
- **Décision** : repoussé. Principe acté 2026-06-08 : « on construit la fonctionnalité, pas le branchement d'infra ».
- **Raison** : aucun système d'email transactionnel dans TAP (email = seulement Supabase Auth pour invitations ; SMS = Twilio patients). Introduire un provider = dépendance + secrets + coût + sous-chantier. Repoussé tant que les alertes in-app suffisent.
- **Déblocage** : 💳 ACHAT/CONTRAT (provider : Resend / SMTP / autre) + 🔍 choix technique. 🗳 décider quand l'email devient nécessaire (ex. alertes conformité hors-session, récap dirigeant).
- **Bloque** : notifications email des alertes conformité (CdC §5.21/§5.22), récap quotidien dirigeant.
- **Note 2026-06-10 (DEC-144)** : la COQUILLE est posée (flag `EMAIL_ENABLED` OFF + module central `lib/email/send.ts` no-op loggé + 1 point de déclenchement de démo dans `upsertComplianceItemAction`). Reste à construire : **choix provider + branchement `send` réel** (dans `lib/email/send.ts`), **persistance des préférences** (2 toggles récap quotidien / alertes échéances — aucune page réglages ni colonne préf n'existe → à créer), **gabarits** (templating). OFF = no-op total, aucun envoi.
- **Note 2026-06-11 (DEC-149)** : la **persistance des préférences est AMORCÉE**. La page Réglages (`(app)/reglages/`) existe désormais et la table `notification_preferences` (PK `user_id`, RLS user-scoped) est en place — extensible : les **toggles email** (récap quotidien / alertes échéances) s'ajouteront comme colonnes booléennes de cette table ET comme section de la page Réglages, AU MOMENT du branchement provider (pas avant — norme « pas de commande inactive » : on n'affiche pas un toggle email tant que l'email n'envoie rien). Le canal in-app cockpit, lui, est déjà piloté par 3 toggles fonctionnels.

### 1.3 Push web (notifications PWA)
- **Décision** : repoussé (branchement infra). Non câblé en 06.62 (échafaudage messagerie = point d'accès header uniquement, push explicitement hors périmètre, cf. DEC-141 D-03).
- **Raison** : le CdC (§5.22) prévoit le push web pour la messagerie interne, mais c'est un branchement (service worker push, VAPID, stockage subscriptions). Hors phase « construction fonctionnalités ».
- **Déblocage** : 🔍 CHOIX TECHNIQUE (web-push natif vs service) + dev dédié. 🗳 prioriser avec la messagerie (CdC §5.22).

### 1.4 Messagerie interne §5.22 — reste à construire (coquille posée 06.62)
- **Décision** : échafaudage posé (2026-06-10, DEC-141). Le point d'accès header (`MessagingButton`) + la coquille « Fil général » (EmptyState) sont en place derrière le flag `MESSAGING_ENABLED` (OFF par défaut prod). Le chat à la course (germe lot 1, `internal_message`/`ride-chat`) est fonctionnel et exposé via cet accès.
- **Reste à construire** (chemin actif non câblé tant que le flag est OFF) : 🔍 **fil général temps réel** (hors course — nécessitera sa table + migration + RLS le jour J), 🔍 **photo** (dépend du stockage HDS, cf. §4.3 upload de scans), 🔍 **push PWA** (cf. §1.3), 🔍 **notion de « non-lu »** (compteur badge — pas de colonne read-state en base aujourd'hui).
- **Déblocage** : 🗳 prioriser le lot messagerie complet (post-échafaudage) ; dépend de 1.3 (push) et indirectement de 1.1 HDS (photo). Activer en mettant `MESSAGING_ENABLED=true` une fois le périmètre construit.

---

## 2. Intégrations & exports externes

### 2.1 Export Lomaco (CSV pré-formaté) — CdC §5.23
- **Note 2026-06-08** : les exports AUTONOMES du §5.23 (CSV courses, CSV stats, PDF
  récap chauffeur) sont LIVRÉS (phase 06.37, DEC-115). Reste UNIQUEMENT Lomaco (ci-dessous) + FEC (2.2).
- **Décision** : repoussé (2026-06-08).
- **Raison** : le format d'import Lomaco n'est PAS spécifié (ni CdC, ni repo). Produire un export sans le format cible = livrable inutilisable. On ne devine pas un format de facturation.
- **Déblocage** : 📄 INFO EXTERNE — obtenir du design partner un EXEMPLE réel d'export/import Lomaco OU la doc d'import du logiciel. Sans ça, bloqué. (Les exports CSV autonomes — courses, stats — restent faisables en attendant, voir backlog.)
- **Note** : c'est le PIVOT de l'hypothèse CdC §2.3 (TAP s'interface avec Lomaco par export). Important à terme.

### 2.2 Export FEC (norme comptable)
- **Décision** : différé (à confirmer besoin).
- **Raison** : norme fiscale précise (18 champs, nommage imposé). Spécifiable sans tiers (norme publique) mais chantier de conformité. Le CdC dit « FEC OU CSV » → le CSV générique peut suffire en V1.
- **Déblocage** : 🗳 DÉLIBÉRER — le comptable du design partner exige-t-il le FEC normé, ou le CSV suffit ? Si FEC requis : 🔍 instruire la norme.

### 2.3 Connecteurs natifs / API REST publique / Webhooks — CdC §5.23
- **Décision** : V2 (CdC).
- **Raison** : intégrations avancées, hors V1. L'export fichier couvre le besoin V1.
- **Déblocage** : 🗳 planification V2.

### 2.4 Intégration téléphonie (CTI) — CdC §5.23 / §5.8
- **Décision** : V1.5 (CdC : identification appelant).
- **Raison** : nécessite matériel/service téléphonie + intégration. La saisie express fonctionne sans (recherche manuelle).
- **Déblocage** : 💳 ACHAT (service CTI) + 🔍 choix. 🗳 prioriser V1.5.

### 2.5 Intégrations plateformes externes (type Ambuliz)
- **Décision** : V2 (CdC §2.2).
- **Raison** : hors périmètre V1.
- **Déblocage** : 🗳 planification V2.

---

## 3. Fonctionnalités métier reportées (CdC §2.2 ou décisions projet)

### 3.1 Télétransmission CGSS (norme B2, SCOR, SESAM-Vitale)
- **Décision** : V3, après agrément CNDA (CdC §2.2, DEC-064).
- **Raison** : nécessite agrément CNDA (long, réglementaire). TAP s'interface avec l'outil de facturation tiers en attendant (§2.3).
- **Déblocage** : 📄 agrément CNDA + 🔍 chantier technique majeur. 🗳 décision stratégique V3.

### 3.2 Facturation native conventionnée
- **Décision** : V2 (CdC §2.2). V1.5 = PDF récapitulatif mensuel seulement (DEC-064).
- **Raison** : la facturation réelle dépend de la télétransmission (V3) ; le tiers (Lomaco) la couvre. V1 = estimatif + export.
- **Déblocage** : 🗳 planification V2.

### 3.3 Module ambulance et VSL
- **Décision** : V2 (CdC §2.2).
- **Raison** : V1 cible taxi conventionné / TAP. Ambulance/VSL = autres conventions/contraintes.
- **Déblocage** : 🗳 planification V2.

### 3.4 Métropole et autres DOM
- **Décision** : V2 (CdC §2.2 ; architecture multi-conventions prévue dès V1).
- **Raison** : V1 cible La Réunion (974). Autres territoires = autres grilles/conventions.
- **Déblocage** : 🗳 décision business (expansion) + adaptation conventions.

### 3.5 Module paie / heures travaillées chauffeur
- **Décision** : V3 (CdC §2.2).
- **Raison** : domaine RH/paie distinct, complexe, hors cœur régulation.
- **Déblocage** : 🗳 planification V3.

### 3.6 Géolocalisation temps réel (réelle)
- **Décision** : reportée (Phase 10). Câblée OFF par défaut (flag GEOLOC_ENABLED) pré-HDS.
- **Raison** : capture GPS continue + historique = données sensibles → dépend de HDS. Barrière technique PWA (capture continue) déjà étudiée.
- **Déblocage** : dépend de 1.1 HDS. 🔍 architecture capture événementielle déjà préparée. 🗳 activation quand HDS en place.
- **Bloque/lié** : module 5.17 CdC.

### 3.7 Portail B2B (donneurs d'ordres) commercial multi-tenant
- **Décision** : différé V1.5 (DEC-067) — alors que le CdC §2.1 le met en V1. Conflit assumé par le projet.
- **Raison** : le CdC le liste V1, mais le projet a priorisé le cœur régulation d'abord ; B2B = après validation par 2-3 design partners.
- **Déblocage** : 🗳 DÉLIBÉRER — confirmer le report V1.5 (vs CdC V1) ou le remonter. Lié module 5.5 CdC.

### 3.8 OCR automatique des bons de transport
- **Décision** : V2 (CdC §2.2). V1 = saisie manuelle structurée + scan archivé.
- **Raison** : OCR fiable = chantier ; la saisie manuelle couvre V1.
- **Déblocage** : 💳/🔍 service OCR + dev. 🗳 planification V2.

### 3.9 Reconnaissance vocale en saisie de course
- **Décision** : V2 (CdC §2.2).
- **Raison** : confort, non essentiel V1.
- **Déblocage** : 🔍 + 🗳 V2.

### 3.10 Application native iOS/Android
- **Décision** : reportée (la PWA couvre V1 ; CdC §2.2 ; VISION V4 optionnel).
- **Raison** : la PWA suffit ; natif seulement si limites techniques bloquantes constatées.
- **Déblocage** : 🗳 business case validé sur retour terrain PWA. 💳 comptes développeurs stores si lancé.

### 3.11 Notification famille patient absent
- **Décision** : Phase 06 / différé (DEC-055).
- **Raison** : complexité légale RGPD (consentement tiers). Pas de demande design partner.
- **Déblocage** : 🗳 demande validée + ADR consentement tiers.

---

## 4. Précisions techniques / tarification reportées

### 4.1 OSRM (distance routière réelle)
- **Décision** : reportée Phase 06 (DEC-056). V1.5 = Haversine × facteur correction 1,4.
- **Raison** : OSRM auto-hébergé = infra lourde ; arrive avec la géoloc certifiée (obligatoire 1er janv 2027). V1.5 = tarif estimatif, précision absolue moins critique.
- **Déblocage** : dépend de 1.1 HDS/infra. 🔍 OSRM self-host. Lié géoloc 3.6.

### 4.2 Mutualisation multi-patients (pricing partagé)
- **Décision** : Phase 06 (DEC-058). V1.5 = monopatient.
- **Raison** : transport partagé = feature à part entière (UI courses groupées + abattements -23/-35/-37 %).
- **Déblocage** : 🗳 prioriser ; chantier dédié.

### 4.3 Upload de scans (document_url conformité, bons de transport)
- **Décision** : coquille UI posée (2026-06-10, DEC-143, flag `UPLOAD_DOCS_ENABLED` OFF) ; branchement Storage différé (bucket HDS).
- **Raison** : stocker des scans (potentiellement données santé) = dépend du stockage HDS. Le champ `document_url` existe déjà (nullable), prêt à recevoir. La coquille (champ « Document justificatif » par slot de conformité + action stub) est en place, mais aucun Storage n'est câblé tant que OFF.
- **Déblocage** : dépend de 1.1 HDS (bucket conforme) — créer le bucket + RLS Storage, puis brancher le vrai `.upload()` dans `uploadComplianceDocumentAction` et persister l'URL via l'action conformité (+ option dissociation D-04 reportée). Phase 09.

### 4.4 Caisse — toolbar NON migrée sur le patron de liste (06.59)
- **Décision** : non migré (2026-06-10, lot listes 2/2). La caisse (`(app)/courses/caisse/_components/caisse-toolbar.client.tsx` + `caisse-table` + `caisse-summary`) garde sa toolbar dédiée.
- **Raison** : 🔍 choix technique. La caisse a déjà une toolbar conforme (filtre date + export, propre à l'encaissement), distincte de `ListToolbar` (recherche/filtres/actions génériques). La forcer dans le patron partagé = **abstraction prématurée** : `ListToolbar` devrait absorber un cas spécial (date + export caisse) pour un seul consommateur. Toutes les autres listes (courses, patients, véhicules, chauffeurs, legal, tarifs) sont migrées ; la caisse est le seul écart, assumé.
- **Déblocage** : **rule-of-three** — au 2ᵉ besoin réel d'une toolbar « date + export » (un autre écran que la caisse), généraliser le motif dans `ListToolbar` (ou un `ListToolbarDateExport`) et migrer la caisse à ce moment-là.

---

## 5. Dette technique notée (pas un report fonctionnel, à surveiller)
- ~~**ESLint flat config**~~ → **RÉSOLU** (constaté 2026-06-10). `eslint.config.mjs` racine
  en place (flat config ESLint 9.39.4 ; plugins `@eslint/js` / `typescript-eslint` /
  `@next/eslint-plugin-next` / `eslint-plugin-react-hooks` ; aucun `.eslintrc.*` legacy ;
  scripts `eslint src`). `pnpm lint` vert (0 erreur, quelques `warn` volontaires). L'ancienne
  note parlait d'« ESLint 10.1.0 » — jamais le cas, le repo est en 9.x ; elle décrivait un
  état pré-résolution. Dette CI V1.5 « D1 » close (cf. en-tête de `eslint.config.mjs`).
- ~~**Test SIRET Luhn (fixture Carrefour)**~~ → **RÉSOLU** (2026-06-10, `fix/shared-siret-luhn-fixture`).
  Diagnostic tranché et SOURCÉ : l'algorithme `verifyLuhn` (`packages/shared/src/validators/common.ts`)
  est CORRECT (doubler les index 0-based impairs depuis la droite = spec INSEE ; vérifié contre
  le nombre Luhn canonique `79927398713` et le SIRET valide `20003452800014` d'InseeFrLab/validinsee).
  C'était le **fixture** qui était faux : `40483304800010` (SIREN 404833048 + NIC 0001 + clé 0)
  n'est pas Luhn-valide ; la clé correcte est **4** (`40483304800014`). Le fixture Carrefour avait
  déjà été retiré du test ; on a ajouté un cas valide Carrefour `40483304800014` + un cas négatif
  de régression `40483304800010` (doit être rejeté). Algo INCHANGÉ. Suite `@tap/shared` verte
  (124 tests). Piège connexe documenté (NON introduit) : les SIRET La Poste (SIREN 356000000) ne
  respectent pas Luhn — hors périmètre, aucun établissement La Poste dans TAP.
- ~~**Migration des `<input type="checkbox">` bruts restants vers `ui/Checkbox`**~~ → **RÉSOLU (2026-06-10, Phase 06.65, DEC-145)**. Les 14 fichiers (16 occurrences : cookie-banner ×3, accept-invite, patient-form-sections, no-show-alert-modal, adjust-sheet, deactivate/unarchive-confirm-dialog, dpia-form, breach-form-fields, dpa-prefill-card, dpo-form, registre-fields, registre-prefill-card, tariff-simulator) migrés 1:1 sur la primitive, iso-comportement, valeurs RGPD/CGU préservées. `grep type="checkbox"` ne retourne plus que `components/ui/checkbox.tsx`. Aucune exception.
- ~~**`as never` sur `.from()` (typage Supabase contourné)**~~ → **RÉSOLU À 90 % (2026-06-11, Phase 09.01, DEC-154)**. 70 des 78 `.from('<table>' as never)` retirés (27 fichiers) — le client est déjà typé `<Database>`, les casts étaient superflus et masquaient les bugs de colonnes (origine du bug cockpit `drivers(prenom,nom)`). Typage restauré : les mauvais noms de colonnes échouent désormais au build. **Restent 8 casts** sur `ordering_parties` (6) + `notification_preferences` (2) : tables récentes ABSENTES de `types.gen.ts` (regen impossible en sandbox — `supabase` CLI + Docker absents). **À retirer après resync de `types.gen.ts`** (le workflow `sync-types.yml` régénère depuis la prod ; relancer un micro-lot ensuite). Sites : `courses/_lib/queries-enriched.ts` ×2, `reglages/actions.ts`, `donneurs-ordres/_lib/cached-queries.ts`, `donneurs-ordres/actions.ts` ×3, `lib/notifications/preferences.ts`.
- **`as never` sur PAYLOADS `.insert()/.update()`** (~127 occurrences) : hors périmètre 09.01 (D-04 limitait au `.from()`). Masquent encore le typage des objets insérés/mis à jour. Follow-up possible (même méthode : retirer par lots, typecheck, corriger les vrais écarts de payload révélés). Priorité moindre que `.from()` (un payload faux est souvent attrapé par la contrainte BDD/RLS à l'exécution ; un mauvais nom de colonne en select/filter, lui, échouait silencieusement).
- Audit complet Server Actions row count check (DEC-041) : généralisé en conformité, à confirmer partout.
- Imports cross-domaine profonds vers `_lib/compliance-planning` (lot 3 conformité) : à déplacer en lib neutre si retouché.
- 4 fichiers courses > 300 lignes (address-picker, assign-modal, rides-list, ride-drawer) : hors limite CON-008, non urgents.
- Déplacement physique URLs `/admin/*` → `/` (DEC-107) : refactor volontairement non fait (coût > gain).
- **Doctrine CI sync `types.gen.ts`** (posée 2026-06-10, Phase 06.67, DEC-147) : un seul
  chemin de sync pour un fichier généré versionné = **PR via `sync-types.yml`**, JAMAIS de
  push direct sur `main`. L'ancien job `sync-types` de `cd.yml` faisait un `git push origin
  HEAD:main` après chaque CD → `main` avançait sans cesse → branches en vol « behind » →
  re-merges en boucle (06.64/06.65/06.66 re-mergées plusieurs fois ; contenu final sain car
  Git déduplique, mais historique pollué). Job retiré (Chemin B : `types.gen.ts` reste
  versionné, build Vercel autonome). **Chemin A envisageable plus tard** : dé-committer
  `types.gen.ts` (gitignore) + génération au build CI/Vercel — uniquement si accès Supabase
  (project ref + secrets) garanti en CI au moment du build ; sinon le build casse. Tant que
  ce n'est pas garanti, on garde le fichier versionné + PR de sync.

---

## 6. Module donneurs d'ordres B2B — extensions (cœur livré 07.01, DEC-148)

Le CŒUR du module (CdC §5.5, Inclus V1) est livré en 07.01 : référentiel
`ordering_parties` (fiche + liste CRUD) + rattachement OPTIONNEL d'une course à
un donneur d'ordres (`rides.ordering_party_id` nullable). Restent à construire,
par lots dédiés (aucun bloquant — le cœur tourne seul) :

### 6.1 Demande groupée de transport — CdC §5.5
- **Raison** : un donneur d'ordres B2B passe souvent plusieurs courses en une
  seule demande (sorties d'hospitalisation groupées). Le cœur ne gère que la
  course unitaire rattachée. La saisie groupée (1 formulaire → N courses) est un
  lot UI + Server Action dédié.
- **Déblocage** : dev dédié, s'appuie sur la saisie express existante (boucle).

### 6.2 Grille tarifaire B2B propre — CdC §5.5 (`b2b_tariff_grid`)
- **Raison** : chaque donneur d'ordres a une convention tarifaire propre
  (distincte de la grille CGSS). Le moteur `packages/pricing` a été conçu avec
  une **grille injectable** (DEC-057) — la grille B2B s'y branche sans réécrire
  le moteur. Reste : table `b2b_tariff_grid` versionnée + sélection de grille
  selon `ordering_party_id` au calcul de tarif.
- **Déblocage** : dev dédié (table + RLS + intégration pricing). 🔍 modèle de
  grille B2B (forfait, % CGSS, grille km propre ?) à cadrer avec un design partner.

### 6.3 Récapitulatif PDF périodique par donneur d'ordres — CdC §5.5
- **Raison** : facturation centralisée = récap hebdomadaire/mensuel (selon
  `modalite_facturation`) des courses d'un donneur d'ordres → PDF. S'appuie sur
  l'index `(organization_id, ordering_party_id)` posé en 07.01 et le pattern PDF
  existant (`api/admin/chauffeurs/recap/pdf`).
- **Déblocage** : dev dédié (agrégation par période + génération PDF).

### 6.4 Contacts opérationnels multiples par service — CdC §5.5 l.188
- **Raison** : le cœur se limite au **contact principal** (un nom/téléphone/email
  sur `ordering_parties`). Un hôpital a plusieurs services (urgences, dialyse,
  consultations) avec des contacts distincts. Lot = table `ordering_party_contacts`
  (FK `ordering_party_id`, libellé service, coordonnées). TODO tracé en migration.
- **Déblocage** : dev dédié (table + RLS + UI fiche).

### 6.5 Portail self-service donneur d'ordres — V1.5
- **Raison** : déjà tracé §3.7 (portail B2B multi-tenant commercial, ADR-006,
  DEC-067). Le cœur 07.01 ne donne PAS d'accès self-service au donneur d'ordres ;
  c'est la régulatrice qui saisit. Le portail reste différé V1.5.
- **Déblocage** : 🗳 confirmer le report V1.5 (cf. Synthèse 3.7).

---

## 7. Performance — lots suivants (Lot 1 livré 08.01, DEC-150)

Le **Lot 1** (parallélisation des fetchs Server Components via `Promise.all`) est
livré (08.01). Symptôme dirigeant = « navigation entre pages lente ». Le Lot 1
réduit le temps de RENDU serveur des pages à plusieurs requêtes indépendantes,
mais le levier DÉCISIF sur la lenteur de navigation est le Lot 2.

### 7.1 Lot 2 — cache (DEC-151 constat + DEC-152 pilote chauffeurs livré 08.03)
- **Constat (DEC-151)** : le cache de PAGE (ISR via `revalidate`) envisagé en
  08.02 est INAPPLICABLE ici. (a) Toutes les pages app sont authentifiées : elles
  lisent `cookies()` (session → org) → Next les rend dynamiquement par
  construction, le `revalidate` page-level est ignoré ; et un ISR statique
  servirait le rendu d'une org à une autre (FUITE inter-tenant). (b) Les pages
  légales cassent le build en statique (`next-mdx-remote@6` compile le MDX en
  `ReactElement` → « React Element from an older version » au prerender ;
  documenté `load-legal.ts`). → Le cache de page est écarté.
- **Pivot livré (DEC-152, 08.03)** : cache de la DONNÉE par organisation
  (`unstable_cache` clé+tag par `organizationId` + `revalidateTag` à l'écriture).
  La page reste dynamique (cookies), seule la requête Supabase est cachée.
  **Livré en PILOTE sur `chauffeurs`** (`_lib/cached-queries.ts`).
- **⚠️ Dette/risque sécurité** : `unstable_cache` interdit `cookies()` →
  la fonction cachée utilise le **service-role (bypass RLS)** avec filtre
  `.eq('organization_id', orgId)` explicite. La RLS ne protège plus DANS le
  cache ; le filtre org est l'unique barrière. Service-role confiné à
  `cached-queries.ts`.
- **GATE (toujours en vigueur)** : test d'isolation 2-orgs sur la **preview** par
  référentiel (org A ne voit jamais les données d'org B malgré le cache). Si
  échec sur un référentiel → revert celui-ci en `force-dynamic`.
- **Extension livrée (08.04, DEC-153)** : pattern répliqué sur **vehicules**,
  **donneurs-ordres**, **tarifs** (les 3 tables ont `organization_id`, filtre
  explicite vérifié). → **Chantier data-cache référentiels : 4/5 cachés.**
- **sms-templates EXCLU** : la table `sms_templates` est **GLOBALE** (PK `key`,
  PAS de `organization_id` — templates partagés entre toutes les orgs). Le patron
  par-org est inapplicable. Laissée `force-dynamic`. Option future (faible
  priorité) : cache GLOBAL (une entrée pour tous) — gain négligeable sur une
  poignée de templates ; à ne faire que si la page devient un point chaud.
- **Pages légales** : restent dynamiques (gain négligeable, blocage MDX
  `next-mdx-remote@6`/prerender). À rouvrir seulement si on migre le rendu MDX
  (compilation au build).

### 7.2 Lot 3 — Suspense granulaire (streaming) — DIFFÉRÉ
- **Raison** : envelopper les sous-arbres lents (panneaux cockpit, listes) dans
  `<Suspense>` permet d'envoyer le squelette immédiatement et de streamer le
  contenu — perception de vitesse améliorée même à temps total constant.
- **Statut (2026-06-11, après 08.01+08.03+08.04)** : **DIFFÉRÉ**. Gain marginal en
  V1 — les pages lourdes sont déjà parallélisées (Lot 1) et disposent de
  `loading.tsx` (squelettes au niveau route). Pas de surface sécurité, mais ROI
  faible au stade actuel.
- **Déclencheur de réévaluation** : montée des volumes de données. En
  particulier les `count exact` du tableau de bord (KPIs) ralentiront quand les
  tables grossiront → ce sera le moment de streamer ces panneaux.

---

## Synthèse — ce qui attend une DÉCISION ou un ACHAT de ta part
| Item | Type | Action attendue |
|------|------|-----------------|
| Export Lomaco (2.1) | 📄 INFO | Obtenir un exemple de format Lomaco du design partner |
| Export FEC (2.2) | 🗳 | Le comptable exige-t-il le FEC, ou CSV suffit ? |
| Portail B2B (3.7) | 🗳 | Confirmer report V1.5 ou remonter (conflit CdC V1) |
| Hébergeur HDS (1.1) | 💳🔍 | Choisir/contractualiser (OVHcloud, Scaleway…) au 1er client |
| Email transactionnel (1.2) | 💳🔍 | Choisir provider quand l'email devient nécessaire |
| Téléphonie CTI (2.4) | 💳 | Service téléphonie pour identification appelant (V1.5) |
| Natif mobile (3.10) | 🗳 | Business case sur retour PWA |
