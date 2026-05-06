# Phase 1 : Référentiel patients - Discussion Log

> **Audit trail uniquement.** Ne pas utiliser comme entrée des agents de planning, recherche ou exécution.
> Les décisions sont consolidées dans `01-CONTEXT.md` — ce log conserve les alternatives considérées.

**Date :** 2026-05-06
**Phase :** 01-referentiel-patients
**Areas discutées :** moteur de recherche fuzzy (initial) → délégation autonome sur les 4 zones grises identifiées

---

## Sélection des zones à discuter (multiSelect)

| Option | Description | Sélectionnée |
|--------|-------------|----------|
| Stratégie de chiffrement NIR | Où vit la clé, runtime, recherche par hash | (autonome) |
| Moteur de recherche fuzzy 2 caractères | pg_trgm vs FTS vs client-side, champs cherchés | ✓ (initiale) |
| UX consultation fiche patient | Drawer / page / modal, blocs visibles | (autonome) |
| Modèle préférences + contraintes | JSONB libre vs typé vs satellite | (autonome) |

**Réponse utilisateur :** seule la zone « Moteur de recherche fuzzy 2 caractères » sélectionnée initialement.

---

## Moteur de recherche fuzzy 2 caractères (Q1)

**Question :** Quel moteur de recherche fuzzy pour la Phase 1 ?

| Option | Description | Sélectionnée |
|--------|-------------|----------|
| pg_trgm + similarity() Postgres | Extension Postgres native, GIN index, < 50 ms < 100k patients | (délégué Claude) |
| Full-Text Search Postgres | Plus puissant pour mots entiers, moins bon sur typos | |
| Filtre côté client uniquement | OK < 1000 patients, risque XSS | |
| Service externe (Meilisearch / Algolia) | Hors stack DEC-003, écarte HDS | |

**Réponse utilisateur :** « Je n'ai pas à choisir cela »
**Notes :** Décision technique déléguée explicitement à Claude. Choix Claude : **pg_trgm + GIN** — étayé par recherche web (latence sub-50ms, support pg_trgm Supabase natif, alignement HDS).

---

## Moteur de recherche fuzzy 2 caractères (Q2)

**Question :** Quels champs cherche-t-on à 2 caractères ?

| Option | Description | Sélectionnée |
|--------|-------------|----------|
| Nom de famille | Champ principal | (autonome) |
| Prénom | Pour patients à prénom distinctif (Marie-Ange) | (autonome) |
| Téléphone | Cas appel entrant, taper derniers chiffres | (autonome) |
| Adresse (rue, ville) | Voisin, recherche par quartier — RISQUE RGPD | (rejeté) |

**Réponse utilisateur :** « No preference »
**Notes :** Choix Claude : **nom + prénom + téléphone** retenus. **Adresse exclue V1** au motif risque RGPD (exposition d'adresses santé via XSS ou bug RLS).

---

## Continuation

**Question :** Discuter une autre zone ou clore ?

| Option | Description | Sélectionnée |
|--------|-------------|----------|
| Clore et générer CONTEXT.md | Capturer en Claude's discretion sur les 3 autres zones | |
| Discuter NIR | Choix infra clé / runtime décryptage | |
| Discuter préférences + contraintes | Définition « contraintes » + structure de stockage | |

**Réponse utilisateur :** « No preference » → puis directive explicite : **« Passe en autonomous fais des recherches au lieu de me bombarder de questions techniques base-toi sur les solutions du genre »**

**Notes :** Bascule en mode autonome avec recherche externe. Trois recherches web parallèles lancées :
1. NIR chiffrement HDS / KMS / France 2026
2. Postgres pg_trgm patient fuzzy search performance
3. Healthcare patient detail UX drawer vs page

Décisions prises sur la base des résultats + contraintes existantes (DEC-001 à DEC-016, contraintes HDS, codebase scouté).

---

## Claude's Discretion (zones non discutées, décidées en autonome)

### Stratégie de chiffrement NIR
- **Algo :** AES-256-GCM (DEC-007 LOCKED)
- **Clé V1 :** env var Vercel/Supabase, migration KMS managée avant HDS prod (ADR-003 placeholder)
- **Runtime :** Edge Function Supabase (Deno) dédiée — endpoints `nir-encrypt`, `nir-decrypt`, `nir-hash`
- **Recherche :** HMAC-SHA256 déterministe en colonne `nir_search_hash` séparée (clé HMAC distincte)
- **Affichage :** masqué `1•••••••••76 23`, déchiffrement on-demand audité
- **Rationale :** ANSSI/HDS impose AES-256 + clé hors hébergeur. Edge Function isole le secret du bundle Vercel et permet l'audit centralisé.

### UX consultation fiche patient
- **Pattern :** drawer 400 px latéral par défaut + page `/patients/[id]` accessible (URL partageable)
- **Édition :** mode explicite via `/patients/[id]/edit`, pas d'inline V1
- **Blocs V1 :** en-tête / identité / coordonnées / préférences / contraintes / note opérationnelle
- **Blocs V2 :** historique courses, prescriptions, incidents, photos, documents
- **Rationale :** DEC-015 « ne pas bloquer la régulatrice » → drawer principal ; URL page = audit + partage interne ; pattern dominant SaaS healthcare moderne.

### Modèle préférences + contraintes
- **Préférences :** enum `canal_contact_prefere` + booléen consentement_sms + `consentement_sms_at`
- **Contraintes :** table satellite `patient_constraint` typée (enum 8 valeurs) + note libre, **pas de JSONB**
- **Notes opérationnelles :** table `patient_operational_note` avec historique en chaîne (`replaced_by_id`), pas d'écrasement
- **Visibilité chauffeur :** différée Phase 9 (PWA)
- **Rationale :** typage strict = audit logs propres, requêtable, validation `packages/shared` simple. Glossaire CLAUDE.md mentionne déjà `patient_operational_note`.

---

## Deferred Ideas (notées pour autres phases ou backlog)

- **ADR-003 Stratégie KMS production** — placeholder créé, à acter avant HDS production
- **Recherche par adresse** — V1.5 si design partner le demande, avec safeguards RGPD
- **Inline edit fiche patient** — V1.5 selon feedback usage
- **Historique versions notes UI** — V1.5 (modèle stocké dès V1)
- **Photos patient** — V2 (stockage HDS, consentement spécifique)
- **Visibilité chauffeur des notes** — Phase 9 (PWA chauffeur)
- **Intégration ROR / RPPS** — out of scope V1
- **Import CSV en masse** — out of scope V1
- **Dédoublonnage UI fusion** — V1.5 (contrainte unique sur `nir_search_hash` dès V1)

---

*Generated 2026-05-06 — discuss-phase Phase 1 (mode autonome après délégation utilisateur)*
