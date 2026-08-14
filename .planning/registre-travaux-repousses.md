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
- **Dépend de / bloque** : bloque géoloc réelle, upload de scans (bons, documents conformité), tout stockage de données santé **en PROD commerciale**.
- **Portée (DEC-077)** : le HDS est le prérequis de la **PROD commerciale** (1er client payant), **pas de la bêta**. En bêta sous DPA, **Supabase EU reste acceptable** (DEC-077, précise DEC-065). Architecture portable (CON-001) : migrer le stockage vers une infra HDS en prod ne changera pas le code applicatif. Les items ci-dessous marqués « dépend de 1.1 HDS » sont donc des blocages de **prod**, non de bêta.
- **Note 2026-06-10 (DEC-143)** : la COQUILLE d'upload de documents conformité est posée (flag `UPLOAD_DOCS_ENABLED` OFF) — UI passive en prod, action d'upload = stub explicite. Reste à construire en Phase 09 : **bucket HDS + RLS Storage + branchement `.upload()` réel** dans `uploadComplianceDocumentAction`.

### 1.2 Email transactionnel (provider)
- **Décision** : repoussé. Principe acté 2026-06-08 : « on construit la fonctionnalité, pas le branchement d'infra ».
- **Raison** : aucun système d'email transactionnel dans TAP (email = seulement Supabase Auth pour invitations ; SMS = Twilio patients). Introduire un provider = dépendance + secrets + coût + sous-chantier. Repoussé tant que les alertes in-app suffisent.
- **Déblocage** : 💳 ACHAT/CONTRAT (provider : Resend / SMTP / autre) + 🔍 choix technique. 🗳 décider quand l'email devient nécessaire (ex. alertes conformité hors-session, récap dirigeant).
- **Bloque** : notifications email des alertes conformité (CdC §5.21/§5.22), récap quotidien dirigeant.
- **Note 2026-06-10 (DEC-144)** : la COQUILLE est posée (flag `EMAIL_ENABLED` OFF + module central `lib/email/send.ts` no-op loggé + 1 point de déclenchement de démo dans `upsertComplianceItemAction`). Reste à construire : **choix provider + branchement `send` réel** (dans `lib/email/send.ts`), **persistance des préférences** (2 toggles récap quotidien / alertes échéances — aucune page réglages ni colonne préf n'existe → à créer), **gabarits** (templating). OFF = no-op total, aucun envoi.
- **Note 2026-06-11 (DEC-149)** : la **persistance des préférences est AMORCÉE**. La page Réglages (`(app)/reglages/`) existe désormais et la table `notification_preferences` (PK `user_id`, RLS user-scoped) est en place — extensible : les **toggles email** (récap quotidien / alertes échéances) s'ajouteront comme colonnes booléennes de cette table ET comme section de la page Réglages, AU MOMENT du branchement provider (pas avant — norme « pas de commande inactive » : on n'affiche pas un toggle email tant que l'email n'envoie rien). Le canal in-app cockpit, lui, est déjà piloté par 3 toggles fonctionnels.

### 1.3 Push web (notifications PWA) — RÉSOLU (06.69, DEC-167)
- **Livré** : Web Push standard (choix technique = `web-push` natif, pas de
  service tiers). Table `push_subscriptions` (RLS user-scoped, multi-appareils) +
  clés VAPID (secrets) + handler `push`/`notificationclick` ajouté au SW Serwist
  (offline non régressé) + envoi `lib/push/send.ts` best-effort + préférence
  `notification_preferences.push_enabled`. Déclenché sur affectation
  (`assignRideAction`) et réaffectation (`reassignRidesBatchAction`).
- **Reste éventuel** : brancher le push sur la MESSAGERIE interne (CdC §5.22)
  quand le lot messagerie complet sera construit (MESSAGING_ENABLED) — l'infra
  push est désormais réutilisable (`sendPushToUser`).

### 1.4 Messagerie interne §5.22 — RÉSOLU (fil général + non-lu + photo livrés)
- **Décision (historique)** : échafaudage posé (2026-06-10, DEC-141). Le point d'accès header (`MessagingButton`) + la coquille « Fil général » (EmptyState) posés derrière le flag `MESSAGING_ENABLED`. Le chat à la course (germe lot 1, `internal_message`/`ride-chat`) était déjà fonctionnel.
- **Livré** (le « reste à construire » d'époque est construit ; preuve code) :
  - **Fil général temps réel** ✅ — page `/messagerie` (`apps/web/src/app/(app)/messagerie/page.tsx`), table dédiée `internal_general_message` (migration `20260613000029`, hors course, RLS).
  - **Notion de « non-lu »** ✅ — read-state `internal_message_read` (migration `20260613000027`) → compteur/badge.
  - **Photo** ✅ — `internal_message_image` (migration `20260613000028`), Supabase Storage bucket privé + URL signée (acceptable en bêta sous DPA, DEC-077 ; migration bucket HDS = prod, cf. §4.3).
  - **Flag** : `MESSAGING_ENABLED` = **ON par défaut** (kill-switch `=false`, `lib/release-flags.ts` `isMessagingEnabled`) — périmètre construit.
- **Reste (non bloquant)** : 🔍 brancher le **push PWA** sur les événements de messagerie — l'infra push est livrée et réutilisable (§1.3 RÉSOLU, `sendPushToUser`) ; le realtime fonctionne sans, donc la messagerie est utilisable en l'état.

---

## 2. Intégrations & exports externes

### 2.1 Export Lomaco (CSV pré-formaté) — CdC §5.23
- **Note 2026-06-08** : les exports AUTONOMES du §5.23 (CSV courses, CSV stats, PDF
  récap chauffeur) sont LIVRÉS (phase 06.37, DEC-115). Reste UNIQUEMENT Lomaco (ci-dessous) + FEC (2.2).
- **Décision** : repoussé (2026-06-08).
- **Raison** : le format d'import Lomaco n'est PAS spécifié (ni CdC, ni repo). Produire un export sans le format cible = livrable inutilisable. On ne devine pas un format de facturation.
- **Déblocage** : 📄 INFO EXTERNE — obtenir du design partner un EXEMPLE réel d'export/import Lomaco OU la doc d'import du logiciel. Sans ça, bloqué. (Les exports CSV autonomes — courses, stats — restent faisables en attendant, voir backlog.)
- **Note** : c'est le PIVOT de l'hypothèse CdC §2.3 (TAP s'interface avec Lomaco par export). Important à terme.

### 2.2 Export FEC (norme comptable) — LIVRÉ (préférence FEC/CSV à confirmer)
- **Décision (historique)** : différé (à confirmer besoin).
- **Raison (historique)** : norme fiscale précise (18 champs, nommage imposé). Spécifiable sans tiers (norme publique) mais chantier de conformité. Le CdC dit « FEC OU CSV » → le CSV générique peut suffire en V1.
- **Livré** (n'est plus « différé » — preuve code) : générateur FEC normé **18 champs** + séparateur imposé (`packages/shared/src/utils/fec.ts` `generateFec`, testé `fec.test.ts`), requête `admin/facturation/_lib/queries-fec.ts`, action `exportFecAction` (`admin/facturation/actions.ts`), UI `fec-export-section.client.tsx`. Le **CSV générique** est également livré (exports autonomes §5.23, DEC-115, cf. §2.1). Les deux formats existent.
- **Reste (préférence, plus un blocage de construction)** : 🗳 confirmer avec le comptable du design partner lequel utiliser (FEC normé ou CSV) — les deux sont disponibles, il ne reste qu'à trancher l'usage.

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
- **Déblocage** : dépend de 1.1 HDS **pour la PROD commerciale** — le stockage sous DPA est acceptable en bêta (DEC-077) ; le blocage relève de la prod, pas de la bêta. 🔍 architecture capture événementielle déjà préparée. 🗳 activation quand HDS en place (prod).
- **Bloque/lié** : module 5.17 CdC.

### 3.6.1 Surfaces cockpit « position périmée » (alerte + indicateur) débranchées
- **Décision** : alerte + indicateur « position périmée » (COCKPIT-02 / COCKPIT-05) débranchés tant qu'il n'existe pas de géoloc réelle (gating livré #499). Code conservé (`use-stale-positions`, `use-driver-positions`, table `driver_positions` + RLS + rétention 90j) ; réaffichage conditionné au flag `GEOLOC_ENABLED` (OFF pré-HDS ; helper `isGeolocEnabled`, `lib/release-flags.ts`). À réactiver Phase 10 (géoloc opérationnelle post-HDS, DEC-075).
- **Raison** : après retrait des positions fictives (#498, seed `source='demo'` purgé), la table est vide → l'alerte ne se déclenchait jamais et l'indicateur restait figé à 0 (voyant mort = faux signal). On n'affiche que ce qui mesure du réel ; ce qui attend l'HDS est différé derrière le flag, pas laissé à afficher du vide. La carte du cockpit, elle, montre les courses du jour (réel opérationnel).
- **Déblocage** : activer `GEOLOC_ENABLED=true` post-HDS → les deux surfaces réapparaissent sans réécriture (même gating que la capture serveur `record-position.ts`).
- **Bloque/lié** : 3.6 (géoloc temps réel réelle), module 5.17 CdC.

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
- **Cadrage bloc 2 rédigé (2026-07-02)** : le barème d'abattement et le patron de
  persistance sont figés dans `modules/facturation/cadrage-gsd-facturation-transport-partage.md`
  (abattement 23 % à 2 patients / 35 % à 3 / 37 % à 4+ plafond 8 ; dérogation
  longue distance 5 % pour un patient seul ≥ seuil local min. 30 km ; assiette hors
  péage et hors supplément mobilité réduite ; péages divisés par nb de patients ;
  barème = grille versionnée paramétrable ; ordre : tarif plein → abattement partage
  → régime prise en charge du bloc 1). C'est un abattement réglementaire par facture,
  PAS un partage de coût façon théorie des jeux.
- **Déblocage résiduel** : 🗳 À DÉLIBÉRER — **comment naît un transport partagé** :
  proposé par le solveur puis accepté UNIQUEMENT, ou aussi composé manuellement par
  la régulation ? La réponse (à prendre au contact d'un transporteur réel) fixe le
  POINT DE CAPTURE du « groupe de partage » à persister (entité distincte de
  `ride_groups` B2B) et l'ergonomie. Tant qu'elle n'est pas tranchée, on ne fige pas
  le schéma d'écriture. Voir cadrage ci-dessus (section « Décision métier à
  TRANCHER »). N'empêche pas les autres blocs facturation (le bloc 1 est livré ;
  télétransmission §3.1 et facturation native §3.2 restent sur leurs propres verrous).
- **Conformité détour (T5) — RÉSOLU (11.01, DEC-169)** : le décret n°2025-202
  du 28/02/2025 (détour ≤10 km/pers dès la 2ᵉ, ≤30 km total, sinon non
  remboursable CGSS) est désormais appliqué par le solveur — un groupement non
  conforme n'est pas proposé (`checkRegulatoryDetour`). **Précision** : la V1
  utilise Haversine × correction (borne PRUDENTE) ; la précision EXACTE du détour
  dépendra du **routing réel** (OSRM/distance routière, §4.1, post-HDS) — à
  rebrancher sur le routing quand il sera disponible. Le pricing partagé
  (abattements) reste à construire séparément.

### 4.3 Upload de scans (document_url conformité, bons de transport) — PARTIELLEMENT LEVÉ
- **Statut (DEC-077, CON-001)** : **bêta ✅** — l'upload des documents de CONFORMITÉ est **opérationnel** sur Supabase Storage sous DPA (bucket **privé** `compliance-documents`, RLS org-scoped, validation MIME/taille serveur, URL signées à la lecture ; `uploadComplianceDocumentAction` fait un vrai `.upload()`, `document_url` stocke le chemin de l'objet). Activation via `UPLOAD_DOCS_ENABLED=true`. **prod HDS ⏳** — la migration du bucket vers une infra HDS certifiée en prod commerciale reste à faire (sans changement de code, accès Storage encapsulé dans `lib/storage/compliance-documents.ts`).
- **Reste reporté** : upload des **bons de transport** (même mécanique, lot séparé) ; option dissociation D-04 ; migration bucket → HDS en prod (Phase 09, cf. §1.1).
- **Historique** : coquille UI posée 2026-06-10 (DEC-143, stub `.upload()`) ; branchement réel Supabase Storage livré ensuite (déblocage bêta, DEC-077).

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
- ~~**`as never` sur `.from()` (typage Supabase contourné)**~~ → **ENTIÈREMENT RÉSOLU (2026-06-11, Phases 09.01 DEC-154 + 09.02 DEC-155)**. 09.01 a retiré 70/78 casts ; 09.02 a retiré les 8 derniers (`ordering_parties`/`notification_preferences`, typées après le resync #323) + corrigé un bug d'inférence réel (select concaténé → `GenericStringError[]`). **0 `.from(… as never)` dans `apps/web/src`** ; les mauvais noms de colonnes/tables échouent désormais au build. **Réintroduit ponctuellement (07.02, DEC-157)** : 3 `.from('ordering_parties' as never)` sur les SELECT lisant la nouvelle colonne `tariff_mode` (absente de types.gen.ts jusqu'au prochain resync) — `donneurs-ordres/_lib/cached-queries.ts`, `lib/pricing/get-active-tariff-grid.ts`, `maintenance/actions.ts` ; à retirer au resync. La table `ordering_party_tariff_grids` (entièrement nouvelle) reste en `as never` pour la même raison.
- **`as never` sur PAYLOADS `.insert()/.update()/.upsert()`** → **CONSTAT STABLE (09.02, DEC-155), cast REQUIS et SÛR, pas du masquage ; à LAISSER EN PLACE** _(chiffre et cause rectifiés 2026-07-03 — voir DEC-155 amendée dans `PROJECT.md`)_. **Compte réel aujourd'hui : seize `as never` au total dans `apps/web/src`, dont TREIZE sur des charges utiles d'écriture** (les trois autres sont des `.from(… as never)` de lecture sur `ordering_parties`/`ordering_party_tariff_grids`, cf. §5 DEC-157, et `ctx.role as never`). L'ancienne mention « ~100/~127 » était **périmée** : elle datait d'avant les deux lots de résorption 09.01 (épinglage du client + retrait des `.from()`) et 09.02 (finition), qui ont retiré la grande majorité des conversions. Dans ce montage `@supabase/ssr` (`createServerClient<Database>`), les méthodes d'écriture résolvent leur PARAMÈTRE à **`never`** pour TOUTES les tables (vérifié sur rides, ride_draft, notification_preferences) — la LECTURE `.select()` reste correctement typée, seule l'ÉCRITURE dégrade en `never`. **Cause exacte (rectifiée)** : `@supabase/postgrest-js` n'est PAS une dépendance de `@supabase/ssr` (couche de rendu) ; il est **embarqué par le client principal `@supabase/supabase-js`** — celui qui a été ÉPINGLÉ précisément pour stabiliser le typage de LECTURE (et l'auth). Cette version épinglée est un **POINT D'ÉQUILIBRE** : d'après les rapports de bugs amont officiels, **monter naïvement les versions du client AGGRAVE** la situation — l'inférence casse alors EN LECTURE **et** en écriture, alors qu'aujourd'hui seule l'écriture est dégradée (et la lecture/l'auth, fermées par l'épinglage, se rouvriraient). **Déblocage réel (rectifié — PAS « aligner les deux bibliothèques »)** : soit **monter `@supabase/ssr`** (couche de rendu serveur) vers une version compatible avec les types récents — ce qui touche la couche cookies et l'authentification, délibérément préservées, donc **à risque** ; soit un **correctif de type LOCAL** (adaptateur maison / shim du client). L'outillage est prêt (`Tables`/`TablesInsert`/`TablesUpdate` ré-exportés de `@tap/database`, 09.02). **Qualification** : les treize conversions d'écriture restantes sont **légitimes et sûres à l'exécution** — un payload erroné est rattrapé par les contraintes de la base et l'isolation org au runtime (à la différence d'un mauvais nom de colonne en `.from()`/select, qui échouait silencieusement — déjà corrigé). **À traiter comme un constat STABLE**, à revisiter SEULEMENT lors d'un futur chantier touchant la couche de rendu ou l'auth, quand l'écosystème amont aura mûri — **pas une dette à rembourser en urgence, ni un lot d'alignement de versions à lancer**.
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
- **Transaction atomique pour la demande groupée** (noté 2026-06-12, suite DEC-168) :
  `courses/actions/groups.ts` `createRideGroupAction` reconnaît « pas de transaction
  multi-table » — il insère le groupe puis les N courses, et en cas d'échec des
  courses COMPENSE manuellement (marque le groupe `refusee`). Best-effort correct
  mais non atomique (une panne entre les 2 inserts laisse un état partiel rare).
  **Candidat** : RPC Postgres transactionnelle (`create_ride_group(...)` en
  plpgsql, BEGIN/COMMIT implicite) qui crée groupe + courses en une transaction.
  Lot suivant si jugé utile — non bloquant (la compensation couvre le cas courant).
  NB : l'anti-TOCTOU DEC-168 (optimistic locking sur les TRANSITIONS de statut)
  est un sujet distinct, déjà traité.
- **Codes INSEE des Hauts à confirmer en UAT (D-10)** — `cockpit/optimisation/_lib/hauts-citycodes.ts` : les communes des Hauts (relief où Haversine sous-estime le trajet) sont identifiées, mais quatre codes INSEE restent marqués `TODO UAT D-10` (Entre-Deux `97421`, La Plaine-des-Palmistes `97431`/`97417`, Sainte-Rose `97439`). **NE PAS deviner/patcher** — c'est une **validation terrain** avec la régulatrice en UAT (risque d'erreur géographique si on invente). Cilaos `97413` et Salazie `97433` sont confirmés. **Action** : point UAT à cocher (aucun code à changer avant confirmation terrain).

---

## 6. Module donneurs d'ordres B2B — extensions (cœur livré 07.01, DEC-148)

Le CŒUR du module (CdC §5.5, Inclus V1) est livré en 07.01 : référentiel
`ordering_parties` (fiche + liste CRUD) + rattachement OPTIONNEL d'une course à
un donneur d'ordres (`rides.ordering_party_id` nullable). Restent à construire,
par lots dédiés (aucun bloquant — le cœur tourne seul) :

### 6.1 Demande groupée de transport — CdC §5.5 — RÉSOLU (07.03, DEC-158)
- **Livré** : table parent `ride_groups` (enum `ride_group_status`
  en_attente|acceptee|refusee, RLS org : select same_org / insert+update
  régulateur+dirigeant / pas de delete, pgTAP 11) + colonne nullable
  `rides.ride_group_id` (NULL = course individuelle, cas nominal). Workflow porté
  par le GROUPE (pas par `ride_status`) : création → groupe `en_attente` + N
  courses enfants `brouillon` ; acceptation → groupe `acceptee` + courses
  brouillon→`validee` (fermes) ; refus → groupe `refusee` + `motif_refus` +
  courses→`annulee_regulateur`. Les courses `brouillon` sont EXCLUES du cockpit,
  de l'optimisation et de la caisse (qui ciblent validee/terminee) — exclusion
  ajoutée au cockpit + liste courses (optimizer/caisse filtraient déjà).
  Les courses portent `ordering_party_id` → tarifées via la grille B2B (07.02)
  sans recode pricing. UI `/courses/demandes-groupees` : formulaire multi-lignes
  (réutilise les champs de la saisie express par ligne) + file d'acceptation/refus
  (motif obligatoire). Nav : entrée régulateur + menu Gestion dirigeant.
- **Schéma zod** : `groupedRideLineSchema` (= express sans `ordering_party_id`),
  `rideGroupRequestSchema` (donneur + 1..50 lignes), `rideGroupRefusalSchema`.
- **Reste éventuel (V1.5)** : édition d'une ligne avant acceptation depuis la
  file (aujourd'hui on accepte/refuse en bloc) ; acceptation partielle
  (sous-ensemble de lignes). Non bloquant — la régulation peut refuser puis
  re-saisir.

### 6.2 Grille tarifaire B2B propre — CdC §5.5 — RÉSOLU (07.02, DEC-157)
- **Livré** : enum `ordering_party_tariff_mode` (cgss_standard|grille_propre) +
  colonne `ordering_parties.tariff_mode` + table versionnée
  `ordering_party_tariff_grids` (RLS org, pgTAP 9). Injection via
  `getActiveTariffGridForOrderingParty` + recompute DEC-060 (b2b_auto → grille
  donneur ; cgss_auto → grille org) ; moteur `computeCgssFromDistance` inchangé
  (grille injectée, DEC-057). UI fiche donneur (Select + Sheet éditeur).
  `tarif_source = 'b2b_auto'` distinct (le recompute CGSS n'écrase pas B2B).
  Le modèle gère les 2 cas (CGSS standard OU grille propre) — pas de cadrage
  conventionné/non-conventionné requis a priori.
- **Reste éventuel (V1.5)** : aujourd'hui aucun flux applicatif ne POSE
  `tarif_source='b2b_auto'` à la création/clôture (le tarif est `manuel` via
  l'app chauffeur) → le recompute B2B est « prêt mais dormant » jusqu'à ce qu'un
  flux de calcul automatique à la création soit câblé (même statut que
  `cgss_auto`). À traiter avec la facturation B2B.

### 6.3 Récapitulatif PDF périodique par donneur d'ordres — CdC §5.5 — RÉSOLU (07.04, DEC-159)
- **Livré (à la demande)** : route `api/admin/donneurs-ordres/recap/pdf`
  (params ordering_party/from/to, guard dirigeant+régulateur, isolation org,
  courses 1 requête `.eq('ordering_party_id')` + patients `.in()` sur
  `patients_safe`, audit log) + composant `RecapDonneurPdf` (charte PDF commune
  `PdfDocument`/`pdfStyles`, en-tête raison sociale+SIRET, résumé, tableau,
  total € = `tarif_amount_eur` stocké, reflète la grille B2B 07.02 sans
  recalcul). Bouton « Récap PDF » dans la fiche donneur, période pré-remplie
  selon `modalite_facturation` (hebdomadaire → semaine en cours ; mensuelle /
  a_la_course → mois en cours).
- **Reste (lot futur, dépend de EMAIL_ENABLED)** : la génération PLANIFIÉE
  AUTOMATIQUE (CdC l.195 « automatique » : cron hebdo/mensuel selon
  `modalite_facturation` + envoi par email au contact du donneur). Bloquée par
  l'absence d'infra email active (échafaudage `EMAIL_ENABLED` OFF, registre §1.2).
  À construire au branchement du provider email. Le récap à la demande couvre le
  besoin de facturation immédiat entre-temps.

> **Chaîne d'extensions B2B COMPLÈTE** (2026-06-12) : cœur référentiel 07.01
> (DEC-148) + grille tarifaire propre 07.02 (DEC-157) + demande groupée 07.03
> (DEC-158) + récap PDF 07.04 (DEC-159). Restent uniquement, par lots distincts :
> contacts multiples par service (§6.4), portail self-service V1.5 (§6.5),
> récap automatique planifié (ci-dessus, dépend de l'email).

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

### 7.3 N+1 des crons SMS — RÉSOLU (09.03, DEC-156)
- Les crons `sms-reminders-j1` / `-j2h` faisaient 1 requête consentement (et j2h
  1 requête idempotency) PAR course + envois/inserts séquentiels, sans
  `maxDuration` → risque réel de timeout Vercel = rappels patients non envoyés
  silencieusement. **Corrigé** : consentement + idempotency en 1 requête `.in()`
  (Map/Set), envois parallélisés par lots de 10, inserts `sms_messages` groupés
  (fallback ligne par ligne), `maxDuration = 60`. RGPD (DEC-008) + traçabilité
  préservés. **Risque de timeout cron levé.**
- **Autres crons** : seuls ces 2 existent (`apps/web/src/app/api/cron/`). Pas
  d'autre motif N+1 cron à traiter. Si un nouveau cron à boucle est ajouté,
  réutiliser le patron (helper batch `getActiveSmsConsentMap` + lots + insert
  groupé + `maxDuration`).

## 8. Replanification dynamique — lots suivants (cœur livré 10.01, DEC-160)

Le CŒUR (CdG §5.14 l.363-374, V1.5 §11.3) est livré en 10.01 : table
`driver_incidents` (panne signalée PWA chauffeur / indisponibilité déclarée
régulation) + proposition de réaffectation scorée (Haversine + charge, SANS
géoloc HDS) validable manuellement/en lot sur `/replanification`, alerte cockpit.
Restent à construire, par lots dédiés (aucun bloquant — le cœur tourne seul) :

### 8.1 SMS automatiques aux patients impactés — CdG l.368 — RÉSOLU (10.02, DEC-161)
- **Livré** : template `reaffectation` (seed additif idempotent) + helper
  best-effort `notifyReassignedPatients` branché dans `reassignRidesBatchAction`
  APRÈS commit, pour les courses dont le chauffeur a effectivement changé.
  Réutilise le socle SMS 09.03 (consentement RGPD `getActiveSmsConsentMap` +
  `isConsentValid`, `sendSms`, trace `sms_messages` queued/skipped/failed, envois
  par lots). Client service-role (sms_messages sans policy INSERT authenticated),
  requêtes filtrées org. Ne rollback jamais la réaffectation. ETA non promis sans
  géoloc HDS (horaire programmé maintenu).
- **Reste éventuel** : SMS lors d'une ANNULATION pour débordement (course « non
  réaffectable ») — aujourd'hui non envoyé (pas d'auto-annulation, cf. D-05 de
  10.01). À traiter si un flux d'annulation explicite est ajouté.

### 8.2 Réaffectation 100 % automatique (sans validation)
- **Raison** : le cœur PROPOSE et la régulation VALIDE (garde-fou métier). Une
  bascule « auto-réaffecter sans intervention » est un sur-ensemble optionnel
  (mode confiance), à n'activer qu'après usage terrain du mode proposé.
- **Déblocage** : décision dirigeant après retour design partner.

### 8.3 Suivi atelier / résolution de panne détaillée — CdG l.369
- **Raison** : `driver_incidents` trace ouverture/résolution (resolved_at). Le
  suivi détaillé (garage, devis, retour prévu, coût) est un lot maintenance
  distinct (s'appuierait sur le module maintenance véhicule existant).

### 8.4 Recalcul ETA / embouteillage — CdG l.375+
- **Raison** : recalcul d'horaires d'arrivée en cas d'aléa trafic. Dépend d'un
  service de routing temps réel (OSRM, registre §4.1) — hors périmètre actuel.

### 8.5 Poussée temps réel des incidents au cockpit
- **Raison** : les incidents ouverts sont aujourd'hui remontés au cockpit **au
  chargement / refresh** (alerte `driver_incident`). La poussée Realtime
  (subscription `driver_incidents` comme `ride_events`) est un raffinement.
- **Déblocage** : étendre `use-cockpit-alerts` à une 2ᵉ subscription.

### 8.6 Affecter au plus proche pour une demande immédiate — CdG l.358-362
- **Raison** : cas voisin de la réaffectation — pour une course URGENTE/immédiate
  saisie en direct, proposer le chauffeur disponible le plus proche (même moteur
  de score Haversine + charge que 10.01). Le module pur `lib/replanning/reassign.ts`
  (`proposeReassignments`) est **directement réutilisable** : il suffit de
  l'appeler depuis la saisie express (urgence immediate) avec la course en cours
  de création comme entrée unique.
- **Déblocage** : dev dédié (brancher le scoring sur la saisie express urgente).
  Montera aussi en précision avec la géoloc HDS.

> **Note précision** : le score « chauffeur le plus proche » utilise en V1 des
> points connus (pickups des courses, dépôt). Il **montera en précision avec la
> géoloc HDS** (position live du chauffeur) une fois la Phase 09 HDS livrée
> (GEOLOC_ENABLED ON). Aucune refonte du module pur attendue — seul le point de
> référence candidat sera enrichi.

## 9. Module prescriptions (CdG §5.3) — préalable prescripteurs livré (07.05, DEC-162)

Le référentiel PRESCRIPTEURS (§5.4) est livré en 07.05 : table `prescribers`
(médecin/établissement, RPPS/ADELI/FINESS, RLS org dirigeant+régulateur, CRUD +
data-cache). C'est le **préalable** de la gestion des prescriptions. Restent :

### 9.1 Gestion des prescriptions — CdG §5.3 — RÉSOLU (07.06, DEC-163)
- **Livré (logique, SANS scan)** : table `prescriptions` (patient + prescriber
  07.05, numero, date, trajets_autorises/consommes, date_expiration, statut
  active/epuisee/expiree) + `rides.prescription_id` nullable + **compteur de
  trajets idempotent** (trigger Postgres `rides_prescription_counter`, delta sur
  transition de l'état consommateur) + **alertes** (80 %/épuisé/expiré/
  renouvellement, pur `derivePrescriptionAlerts` + Vitest, cockpit + fiche
  patient) + saisie structurée (fiche patient) + picker express avec
  avertissement non bloquant. RLS org dirigeant+régulateur, pgTAP 14.
- **Reste (dépend HDS — Phase 09)** : scan/upload du bon (PDF/image → bucket HDS)
  + archivage horodaté avec checksum (préparation SCOR V3). `document_url` est
  PRÉVU (colonne posée, NULL) mais aucun Storage câblé — comme l'échafaudage
  upload conformité (§4.3). À débloquer au HDS.

### 9.2 Top prescripteurs + bons par statut — CdG §5.4/§5.20 — RÉSOLU (07.07, DEC-164)
- **Livré** : bloc `DashboardPrescriptions` (tableau de bord dirigeant) — bons
  actifs / proches seuil 80 % / épuisés / expirés + Top 5 prescripteurs (par
  nombre de prescriptions), card dédiée. Agrégation pure lecture, parallélisée
  dans le `Promise.all` du dashboard, anti-N+1 (1 select + libellés en `.in()`).
- **Reste éventuel** : « patients suivis par prescripteur » (l.184) — agrégation
  fiche-prescripteur, non construite (lot mineur si demandé) ; volumétrie par
  période (mois N vs N-1) si besoin.

### 9.3 KPIs conformité bons — CdG §5.20 — RÉSOLU (07.07, DEC-164)
- **Livré** : comptes bons par statut (en attente=actifs / expirés / épuisés) +
  proches seuil, dans la card prescriptions du dashboard. Mêmes chiffres/source
  que les alertes prescriptions du cockpit (07.06).

### 9.4 KPIs 5.20 restants — LARGEMENT RÉSOLUS (reste : opérationnels)
- **Tops commerciaux — RÉSOLU (07.08, DEC-165)** : Top 10 patients CA + Top 5
  donneurs B2B (CA encaissé du mois, même définition que `getCaMois` → partition
  exacte du CA mensuel), card dédiée du dashboard, RGPD `patients_safe`, anti-N+1.
- **Panier moyen / course — RÉSOLU (07.09, DEC-166)** : CA encaissé ÷ courses
  encaissées (`caMois.total_eur / caMois.count`), dérivé sans requête, périmètre
  cohérent. KpiCard rangée Activité du mois.
- **Écart prévisionnel/réalisé — RÉSOLU** (preuve code) : CA **prévisionnel**
  (« À venir aujourd'hui / 7 jours / mois / année ») + **« Réalisation du mois »**
  (taux + CA réalisé/planifié) — `tableau-de-bord/_components/tier-activite.tsx`,
  agrégats `previsionnel.*` de `_lib/queries-dashboard.ts`. Le préalable « CA
  prévisionnel » est donc construit.
- **Répartition récurrentes/ponctuelles — RÉSOLU** (preuve code) :
  `rides.ride_recurrence_id` **activé** (migration `20260520000001_rides_ride_recurrence_id.sql`,
  n'est plus commenté) ; KPI « Récurrentes vs ponctuelles » (`groupe-operationnel.tsx`,
  `_lib/operational-kpis.ts`, testé `operational-kpis.test.ts`).
- **Économiques — RÉSOLU** (preuve code) : marge brute, **coût au km PARAMÉTRABLE**,
  rentabilité mutualisées/non, **encours impayé** (KPI-02, `getEncoursImpaye`) —
  `groupe-economie.tsx`, `_lib/economic-kpis.ts`. Le paramétrage des coûts existe :
  table `cost_parameters` (migration `20260613000030`) + écran de saisie dirigeant
  `/admin/parametres-couts` (`cost-parameters-form.client.tsx`). État **« non
  configuré » honnête** si aucun coût saisi (jamais un zéro trompeur ;
  `economic-kpis.ts` porte le drapeau `configured`).
- **Reste — Opérationnels (vrai reste, non fait, vérifié dans le code)** : taux
  d'occupation véhicule, productivité chauffeur, litiges CGSS (`ride_dispute` —
  aucune table/migration ni KPI aujourd'hui).
- **Déblocage** : dev dédié pour les KPIs opérationnels restants (occupation /
  productivité / litiges). Les trois blocs ci-dessus (écart, récurrentes,
  économiques) n'attendent plus rien — livrés.

---

## 10. Mode alerte météo / cyclone — extensions (cœur livré 12.01, DEC-170)

Trou V1 critique (CdG l.380-385, US-REG-09). **T1 (cœur) — RÉSOLU (12.01,
DEC-170)** : table dédiée `weather_alerts` (un seul épisode actif/org, index
unique partiel, RLS forcée), statut `ride_status = annulee_meteo`,
`setWeatherAlertAction` + bandeau cockpit, `cancelRidesBatchWeatherAction`
(annulation masse jour/zone, compare-and-set `validee`/`assignee`), SMS
`annulation_meteo` best-effort (socle 09.03/10.02) + push chauffeurs groupé
(06.69). Route `/meteo` (régulateur). pgTAP 12.

### 10.1 Replanification météo J+1/J+2 (report automatique)
- **Raison** : après une journée annulée pour cyclone, reporter automatiquement
  les courses récurrentes (dialyse) sur les jours suivants au lieu de les
  ressaisir. Réutilisera le socle replanification (10.01, `proposeReassignments`)
  et la génération de récurrences (`packages/recurrence`).
- **Déblocage** : lot dédié ; dépend d'une règle métier de report (J+1 ? créneaux
  disponibles ? priorités dialyse) à cadrer avec un design partner.

### 10.2 Autres trous V1 issus des user stories — statut
- **T2 — accompagnant** : RÉSOLU (12.03, DEC-172). Cf. §11.
- **T3 — mineur / sous tutelle + référent légal** : RÉSOLU (12.03, DEC-172,
  logique sans scan). Cf. §11.
- **T4 — 2FA dirigeant/régulateur** : authentification à deux facteurs optionnelle
  (CLAUDE.md §6, CdG l.128, déjà prévue désactivée pour le chauffeur). Supabase
  Auth supporte le TOTP nativement (`config.toml [auth.mfa.totp]`). MIS DE CÔTÉ
  par décision (prompt 12.02 interrompu) — lot sécurité dédié à reprendre :
  enrôlement QR dans les réglages, challenge AAL2 au login, guard serveur
  defense-in-depth ; 0 dépendance externe.

---

## 11. Accompagnant + mineur/référent légal — suites (logique livrée 12.03, DEC-172)

Deux trous V1 connexes (US-REG-10). **T2 accompagnant — RÉSOLU** : colonnes
`rides.accompagnant/accompagnant_payant/accompagnant_identite`, bloc de saisie,
coût appliqué via la grille CGSS (`tariff_grids.supplement_accompagnant_eur`,
moteur inchangé). **T3 mineur/tutelle — RÉSOLU (sans scan)** : référent légal
patient + statut mineur dérivé de date_naissance + avertissement non bloquant à
la saisie course.

### 11.1 Règle de tarif accompagnant — validation métier
- **À valider** : CPAM rembourse l'accompagnant « au même taux que le patient ».
  La V1 implémente un SUPPLÉMENT paramétrable (terme additif soumis à la
  majoration), **pas** un doublement du forfait. Confirmer avec un design partner
  / la CGSS si la règle exacte est un forfait, un doublement, ou un %.
- **Déblocage** : retour métier ; le moteur est déjà paramétrable (changer la
  formule = lot court si doublement requis).

### 11.2 Supplément accompagnant sur grille B2B
- **Raison** : `ordering_party_tariff_grids` n'a pas la colonne
  `supplement_accompagnant_eur` → le moteur retombe sur 0 pour les courses B2B
  (dégradation gracieuse). Ajouter la colonne + le champ aux formulaires/validators
  B2B si un donneur d'ordres facture l'accompagnant.
- **Déblocage** : lot court symétrique à la grille CGSS, sur demande.

### 11.3 Place accompagnant dans la capacité véhicule / mutualisation
- **Raison** : un accompagnant occupe une place assise. Le solveur
  (`solve-local.ts`, contrat `@tap/optimizer-client`) ne décrémente pas encore la
  capacité pour l'accompagnant. À brancher quand la mutualisation serrera les
  capacités (post-HDS routing réel).
- **Déblocage** : étendre le contrat optimizer (nb passagers par course) ; lot
  dédié.

### 11.4 Scans autorisation parentale / jugement de tutelle (dépend HDS)
- **Raison** : la colonne `patients.referent_document_url` est prévue mais reste
  NULL — aucun Storage câblé. Le scan dépend du HDS, comme les bons de transport
  (§4.3). À activer en Phase 09 (HDS).
- **Déblocage** : Phase 09 HDS (Storage compatible santé).

### 11.5 Affichage du référent dans le drawer patient
- **Raison** : le drawer patient lit `patients_safe` (vue sans les colonnes
  référent, non modifiée pour ne pas casser la fonction `search_patients`). Le
  référent est saisissable et pré-rempli en édition, mais pas affiché en lecture
  seule dans le drawer. Exposer le référent sur `patients_safe` (CREATE OR REPLACE,
  colonnes en fin) au prochain resync de types.
- **Déblocage** : lot court (vue + resync types.gen.ts).

> **Tous les trous V1 issus des user stories sont désormais traités** sauf T4
> (2FA, §10.2), mis de côté par décision.

---

## 12. Leçon — cohérence des valeurs d'enum `ride_status` (fix 12.04, DEC-173)

**Effet de bord observé (12.01 → corrigé 12.04)** : l'ajout de la valeur
`annulee_meteo` à l'enum `ride_status` n'avait pas été propagé aux endroits qui
ré-énuméraient « en dur » les statuts d'annulation → le taux d'annulation du
tableau de bord excluait les annulations météo (faux pendant un cyclone).

**Remède de fond** : constante partagée `RIDE_CANCELLED_STATUSES`
(`@tap/shared`, `validators/ride.ts`). RÈGLE : **tout filtre/affichage des
courses annulées DOIT importer cette constante** ; ne jamais ré-énumérer à 3
valeurs.

**Pour tout futur ajout de valeur à `ride_status`** (checklist) :
- mettre à jour la constante partagée concernée (`RIDE_CANCELLED_STATUSES` ou
  une nouvelle si autre famille) ;
- vérifier les maps de labels/couleurs : `ride-badges.tsx` (régulateur),
  `conduite/ride-card` + `ride-detail` (chauffeur), `export-rides.ts`, les deux
  PDF recap (`chauffeurs`, `donneurs-ordres`) ;
- vérifier les filtres z.enum (export) et les unions de type (`DriverRideStatus`) ;
- NE PAS toucher les sites d'ÉCRITURE d'un statut précis (`groups`, `cockpit`,
  `cancel`) — ils sont volontairement explicites.

**`apps/web/src/lib/setup-sql.ts`** = snapshot Phase 0/1 FROZEN (ne contient ni
`weather_alerts`, ni `ride_groups`, ni les colonnes accompagnant/référent). Il
n'est PAS tenu à jour avec les migrations récentes ; la source canonique reste
`supabase/migrations/*` (CLAUDE.md §13.5). À retirer ou régénérer un jour si le
`/setup` local doit refléter l'état réel.

> **`brouillon`** vérifié au passage : géré là où il importe (maps PDF donneurs,
> `ride-badges`, exclusion cockpit `neq('status','brouillon')`).

### Couplage app ↔ trigger SQL sur les statuts annulés (fix 12.05, DEC-174)

**Effet de bord le plus grave de la série** : le trigger SQL de comptage des
trajets de prescription (`rides_prescription_counter`) listait les statuts
annulés EN DUR, sans `annulee_meteo` → une course annulée pour météo restait
consommatrice → **trajet non rendu au patient = donnée de remboursement CGSS
faussée** (pas un simple affichage comme 12.04). Corrigé par migration
`20260613000004` (array aligné + recompute rétroactif).

**Point de vigilance permanent** : le SQL **ne peut pas** importer la constante
TS `RIDE_CANCELLED_STATUSES` (@tap/shared). L'array `cancelled` du trigger est
donc un **duplicata manuel** à garder synchronisé. **Tout nouveau statut
d'annulation `ride_status` doit être ajouté AUX DEUX endroits** :
1. `RIDE_CANCELLED_STATUSES` (`packages/shared/src/validators/ride.ts`) ;
2. l'array `cancelled` de `rides_prescription_counter` (via une nouvelle
   migration `create or replace function`).

**Leçon générale** : les listes de statuts « négatives » (à exclure / annuler)
en dur sont la source des effets de bord d'ajout d'enum. Audit fait — le trigger
prescription était le SEUL array de statuts annulés en SQL (l'index partiel de
`rides_execution` est une liste POSITIVE de statuts actifs, correcte). À
re-vérifier à chaque nouvelle fonction/trigger SQL touchant `ride_status`.

### Cohérence `ride_group` lors d'une annulation météo (fix 12.06, DEC-175) — B3

**Effet de bord 12.01 (gravité faible)** : l'annulation en lot météo ignorait
`ride_group_id` → une demande groupée B2B `acceptee` dont toutes les courses
passent `annulee_meteo` restait `acceptee` (groupe fantôme : actif sans aucune
course active). Corrigé : statut `annulee` ajouté à `ride_group_status` (migration
`20260613000005`) + `reconcileWeatherGroups` (anti-N+1, best-effort) qui passe
`annulee` les groupes sans course survivante (survie partielle → reste
`acceptee`). Aucune map UI de statut groupe à étendre (seule la file `en_attente`
est listée aujourd'hui).

> **Audit transversal des effets de bord météo CLOS** : B1 (affichage, 12.04,
> DEC-173), B2 (compteur de remboursement prescriptions — CRITIQUE, 12.05,
> DEC-174), B3 (cohérence ride_group, 12.06, DEC-175).

### Couplage app ↔ trigger SQL — PROTÉGÉ PAR TEST CI (09.05, DEC-176)

Le couplage manuel `RIDE_CANCELLED_STATUSES` (@tap/shared) ↔ array `cancelled`
du trigger `rides_prescription_counter` n'est **plus un point de vigilance
manuel** : le test `packages/shared/src/validators/__tests__/cancelled-statuses-sync.test.ts`
lit la migration la plus récente, extrait l'array et **casse la CI** (`pnpm test`)
si elle diverge de `RIDE_CANCELLED_STATUSES ∪ {'brouillon'}`. Toute désynchro est
attrapée avant le merge.

**Workflow lors d'un futur ajout de statut d'annulation** : ajouter la valeur (1)
à `RIDE_CANCELLED_STATUSES` ET (2) à l'array `cancelled` du trigger via une
nouvelle migration `create or replace function` — le test devient vert quand les
deux sont faits, rouge sinon. Le « workflow checklist » de §12 reste valable pour
les maps de labels/couleurs **positives** (badges, PDF, unions de type) qui, elles,
ne sont pas couvertes par ce test.

**Pattern réutilisable** : si un autre couplage SQL↔TS émerge (autre constante
dupliquée dans une fonction/trigger SQL), reproduire ce test (lecture du SQL le
plus récent + assertion d'ensemble + échec explicite si introuvable).

---

## 13. Mode dégradé 5.24 — COMPLET (chauffeur + régulateur livré 13.01, DEC-177)

CdG §5.24. **Chauffeur** : écriture hors-ligne (démarrage/clôture course) + file
de mutations + sync différée (`lib/offline/`, Phase 04.9). **Régulateur — RÉSOLU
(13.01)** : consultation hors-ligne du planning J/J+1 en LECTURE SEULE (store
Dexie dédié `tap-regulateur-offline` avec contacts, péremption 4h stricte, SW
NetworkFirst `/cockpit`, RGPD cache vidé à la déconnexion). Distinction assumée :
le régulateur n'écrit PAS hors-ligne (pas de `PendingMutation`).

> **Trous V1 fonctionnels majeurs : aucun restant sans préalable.** Restent des
> chantiers à PRÉALABLE (KPIs économiques marge/coût km — nécessite un modèle de
> coûts ; écart prévu/réalisé — nécessite le CA prévisionnel ; récurrentes/
> ponctuelles — activer `rides.ride_recurrence_id` ; occupation/productivité/
> litiges — cf. §9.4) et des blocages BUSINESS/INFRA (HDS §1.1 → scans bons +
> géoloc réelle ; email §1.2 ; Lomaco §2.1 ; FEC §2.2 ; CTI §2.4) + extensions
> tracées (§10/§11 météo & accompagnant, T4 2FA §10.2).

---

## 14. Cycle de vie des courses — centralisé + testé (09.06, DEC-178)

Les transitions de statut (`brouillon → validee → assignee → en_cours → terminee`
+ branches d'annulation) sont désormais une **machine à états unique testée**
(`packages/shared/src/validators/ride-state-machine.ts` : `RIDE_TRANSITIONS`,
`canTransition`, `RIDE_MODIFIABLE_STATUSES`, `ACTIVE_RIDE_STATUSES`). Toutes les
actions (assign/unassign, conduite + api driver start/end, cancel, edit, météo,
reassign, assignVehicle) en dérivent leur règle. **Pour tout futur statut ou
transition** : éditer la table + les tests ; les actions suivent automatiquement.

**Points TRACÉS pour validation / durcissement ultérieur** (comportement V1
inchangé — non corrigés dans ce lot) :
- **`annulee_chauffeur`** : valeur d'enum `ride_status` SANS aucun producteur
  (aucune action ne l'écrit). Terminal sans arête entrante dans la machine. À
  câbler si une annulation côté chauffeur devient un besoin métier, sinon
  candidat à retrait d'enum.
- **`cancelRideForNoShowAction` (cockpit) → `annulee_patient`** : ne vérifie PAS
  le statut source (pas de compare-and-set sur `status`). Fonctionne sur n'importe
  quel statut. Candidat durcissement : guarder via `canTransition(current,
  'annulee_patient')`. Laissé tel quel (ne pas changer le comportement dans un
  lot de centralisation).
- **6 filtres `['validee','assignee']` de LECTURE** (crons reminders J1/J2h,
  `recurrences.ts`, `patients/[id]/page.tsx`, `replanification/_lib/queries.ts`,
  backfill géoloc `maintenance/actions.ts`) : ce sont des filtres de SÉLECTION
  (pas des transitions). Ils pourraient adopter `RIDE_MODIFIABLE_STATUSES` pour
  une cohérence totale, mais hors scope « transitions » — lot court optionnel.

**Note** : le statut de GROUPE (`ride_group_status` : en_attente/acceptee/refusee/
annulee) reste géré dans `groups.ts` + `meteo` uniquement (faible dispersion) —
non couvert par cette machine (centrée sur `ride_status`).

---

## 15. Module planning / Gantt §5.12 — LIVRÉ (nuance : carte temps réel post-HDS)

Ajouté au registre a posteriori : le module planning/Gantt a été entièrement
construit mais n'était tracé nulle part. Consigné ici comme **livré** (preuve
code : `apps/web/src/app/(app)/planning/`).

- **Lot A — grille** ✅ : tableau sémantique lignes = chauffeurs (+ « Non
  affectées »), colonnes = tranches horaires (fuseau Réunion) ; placement par
  `reunionHour` (`_lib/planning-layout.ts`).
- **Lot B — réaffectation** ✅ : glisser-déposer entre lignes + repli clavier
  (boîte de réaffectation) ; conflit horaire → confirmation. `reassignRidesBatchAction`
  / `unassignRideAction`.
- **Lot C — indicateurs de tournée** ✅ : `_lib/tournee-indicators.ts`
  (`TourneeIndicators`), testé.
- **Lot D — validation J+1 ATOMIQUE** ✅ : RPC `validate_planning_day`
  (SECURITY INVOKER, migration `20260614000004`) — INSERT validation + figeage de
  l'instantané dans une seule transaction ; idempotent. Tables `planning_validations`
  / `planning_validation_rides` (migration `20260614000001`).
- **Lot E — historique prévu/réalisé** ✅ : diff sur l'instantané figé
  (`_lib/historique-diff.ts`, testé), page `planning/historique`.
- **Fix fuseau** ✅ (#497) : bornage de la requête sur la vraie journée
  réunionnaise (`reunionDayBoundsUtc`, `@tap/shared`) — grille jadis vide corrigée.
- **Raffinement Gantt** ✅ (#501) : repère « maintenant » live, grille de fond,
  blocs enrichis, états vides travaillés.
- **Carte des courses du jour** ✅ (cockpit, #498) : points de prise en charge /
  dépose + trajets (adresses opérationnelles), clic → RideDrawer.
- **Nuance (reste = post-HDS)** : la carte **temps réel des positions chauffeur**
  (module 5.17) n'est PAS faite avant HDS (DEC-075 ; cf. §3.6 / §3.6.1). La carte
  livrée n'affiche que des courses (réel opérationnel), aucune position GPS.

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
