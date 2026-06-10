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

### 1.2 Email transactionnel (provider)
- **Décision** : repoussé. Principe acté 2026-06-08 : « on construit la fonctionnalité, pas le branchement d'infra ».
- **Raison** : aucun système d'email transactionnel dans TAP (email = seulement Supabase Auth pour invitations ; SMS = Twilio patients). Introduire un provider = dépendance + secrets + coût + sous-chantier. Repoussé tant que les alertes in-app suffisent.
- **Déblocage** : 💳 ACHAT/CONTRAT (provider : Resend / SMTP / autre) + 🔍 choix technique. 🗳 décider quand l'email devient nécessaire (ex. alertes conformité hors-session, récap dirigeant).
- **Bloque** : notifications email des alertes conformité (CdC §5.21/§5.22), récap quotidien dirigeant.

### 1.3 Push web (notifications PWA)
- **Décision** : repoussé (branchement infra).
- **Raison** : le CdC (§5.22) prévoit le push web pour la messagerie interne, mais c'est un branchement (service worker push, VAPID, stockage subscriptions). Hors phase « construction fonctionnalités ».
- **Déblocage** : 🔍 CHOIX TECHNIQUE (web-push natif vs service) + dev dédié. 🗳 prioriser avec la messagerie (CdC §5.22).

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
- **Décision** : différé (bucket HDS).
- **Raison** : stocker des scans (potentiellement données santé) = dépend du stockage HDS. Le champ `document_url` existe déjà (nullable), prêt à recevoir.
- **Déblocage** : dépend de 1.1 HDS (bucket conforme).

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
- Audit complet Server Actions row count check (DEC-041) : généralisé en conformité, à confirmer partout.
- Imports cross-domaine profonds vers `_lib/compliance-planning` (lot 3 conformité) : à déplacer en lib neutre si retouché.
- 4 fichiers courses > 300 lignes (address-picker, assign-modal, rides-list, ride-drawer) : hors limite CON-008, non urgents.
- Déplacement physique URLs `/admin/*` → `/` (DEC-107) : refactor volontairement non fait (coût > gain).

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
