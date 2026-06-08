# Cadrage GSD — Module Exports & intégrations (CdC §5.23, complété par §5.18)

Phase DISCUSS du module, AVANT execute (méthode GSD pour module fonctionnel neuf).
Objectif : trancher avec le dirigeant, car ce module a un OBSTACLE de spec externe
(formats Lomaco/FEC inconnus) qu'il ne faut pas improviser. Vérifié code 2026-06-08.

## Pourquoi ce module
CdC §2.3 (hypothèse forte) : « le client utilise déjà un logiciel de facturation
tiers (Lomaco) avec lequel le SaaS s'interface par EXPORT. La V1 ne remplace pas ce
logiciel. » → l'export est le PONT entre TAP (régulation) et l'outil de facturation.
C'est stratégique : sans export exploitable, le dirigeant ressaisit à la main.

## CdC §5.23 + §5.18 — exports demandés (V1)
1. Export comptable mensuel **FEC ou CSV** (compte 70610000 prestations).
2. **Export Lomaco (CSV pré-formaté).**
3. Export caisse (journalier/périodique) — **DÉJÀ FAIT** (exportCaisseCsvAction).
4. Export statistique (CSV) analyses externes.
5. Export **PDF** par chauffeur / période / patient / donneur d'ordres.
6. Export récapitulatif mensuel par donneur d'ordres B2B (lié module B2B, repoussé).

## État vérifié
- Helper CSV générique existe : `lib/csv.ts` (toCsv, escapeCsv, formatEurFr, formatDateFr).
- Export caisse CSV livré (modèle à suivre).
- PDF : `@react-pdf/renderer` déjà utilisé (facture-cgss-pdf) → réutilisable pour les PDF récap.
- Montant course : pas une colonne directe de `rides` ; le pricing est calculé/agrégé
  (caisse, dashboard). À clarifier pour l'export comptable (source du montant).

## OBSTACLE central (à trancher AVANT de coder)
**Les formats Lomaco et FEC ne sont PAS spécifiés** (ni dans le CdC, ni dans le repo).
- **Lomaco** : « CSV pré-formaté » mais aucune définition de colonnes/ordre/encodage/
  séparateur/codes. Un export au mauvais format est INUTILISABLE par Lomaco. On ne peut
  PAS l'inventer.
- **FEC** : c'est une norme RÉGLEMENTAIRE précise (format imposé par l'administration
  fiscale française : 18 champs, séparateur, nommage de fichier). Spécifiable SANS le
  client (la norme est publique), mais c'est un vrai travail de conformité.

## Stratégie proposée : découpage qui ne bloque pas sur la spec externe

**Lot 1 — Exports AUTONOMES (aucune spec externe requise) :**
- Export CSV générique des courses sur période paramétrable (colonnes claires :
  date, patient, trajet, mode, statut, montant si dispo, chauffeur).
- Export statistique CSV (agrégats : nb courses, CA, par période/chauffeur).
- Réutilise lib/csv.ts + le modèle exportCaisse. Hors HDS, livrable vite, valeur
  immédiate (le dirigeant peut sortir ses données et les retravailler).

**Lot 2 — Export PDF récap** (par chauffeur / période), via @react-pdf/renderer
(déjà en place). Autonome aussi.

**Lot 3 — Export Lomaco : REPOUSSÉ (2026-06-08)** — inscrit au registre des travaux
repoussés (déblocage : obtenir le format Lomaco du design partner). SEULEMENT une fois le format obtenu
(échantillon d'un export Lomaco existant, ou doc d'import Lomaco). SINON on ne le fait
pas (risque = livrer un format faux). Quick win conditionné à l'info.

**Lot 4 — Export FEC** : spécifiable (norme publique) mais lourd (conformité fiscale).
À faire si le besoin comptable est confirmé ; sinon le CSV générique (lot 1) couvre
le besoin d'export comptable « ou CSV » du CdC.

## Décisions à TRANCHER (dirigeant)
1. **Q-A — Format Lomaco** : as-tu un EXEMPLE d'export Lomaco (fichier réel) ou la
   doc d'import du logiciel ? Sans ça, le lot Lomaco est bloqué (on ne devine pas un
   format de facturation). → Si oui : on cadre le lot 3. Si non : on fait les exports
   autonomes (lots 1-2) d'abord, Lomaco quand l'info arrive.
2. **Q-B — FEC** : besoin réel d'un export FEC normé (comptable du design partner le
   demande), ou le CSV comptable générique suffit en V1 ? (le CdC dit « FEC OU CSV »).
3. **Q-C — Montant des courses** : pour l'export comptable, le montant vient d'où ?
   (pricing recalculé à l'export, ou montant encaissé en caisse, ou les deux colonnes ?)
   → détermine la source de vérité de l'export comptable.
4. **Q-D — Périmètre lot 1** : on démarre par l'export CSV courses + stats (autonome,
   hors HDS) pendant que tu récupères le format Lomaco ?

## Reco
Démarrer **lot 1 (exports CSV autonomes)** tout de suite — valeur immédiate, zéro
dépendance externe, zéro infra. En PARALLÈLE, récupérer un échantillon Lomaco auprès
du design partner pour débloquer le lot 3 (le vrai pivot §2.3). FEC selon Q-B.

## Refs
CdC §2.3 (hypothèse Lomaco), §5.23, §5.18 ; lib/csv.ts ; exportCaisseCsvAction ;
@react-pdf/renderer (facture-cgss-pdf). RETEX/FOSS à faire au cadrage du lot Lomaco
(formats d'export compta). Hors HDS.
