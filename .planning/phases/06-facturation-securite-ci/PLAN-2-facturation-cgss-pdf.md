# PLAN-2 — Bloc A : facturation CGSS PDF

**Phase** : 06 Facturation CGSS + audit sécurité + dettes CI
**Wave** : 2/3 (parallélisable avec PLAN-3 audit RLS)
**Dépendances** : PLAN-1 mergé (CI verte). Indépendant de PLAN-3.
**Estimation** : 4-6 h
**Refs** : 06-CONTEXT.md (D-02/D-07/D-08/D-09, DEC-064), 06-UI-SPEC.md §3-§10 (S-01/S-02, S-03 **corrigé** ci-dessous), DEC-061 disclaimer estimatif, DEC-058 monopatient, DEC-003 stack figée, DEC-032 CD push, CLAUDE.md § 11 (≤ 300 LOC) / § 13.5

---

## Goal

Livrer la facturation CGSS V1.5 : une page `/admin/facturation` (dirigeant) où l'on choisit un mois, on voit l'aperçu des courses facturables, et on télécharge un PDF récapitulatif mensuel. Le PDF **agrège** les `tarif_amount_eur` déjà calculés par le moteur 05.5 — il ne recalcule rien (D-09). Zéro nouvelle dépendance : réutilise `@react-pdf/renderer` (déjà présent Phase 1.5) et le pattern du PDF registre.

---

## ⚠️ Définition « course facturable CGSS » — ACTÉE (corrige S-03 de l'UI-SPEC)

L'UI-SPEC S-03 proposait `payment_method = 'cgss_differe'`. **Vérification BDD prod : ce critère est FAUX.** `payment_method` est NULL sur 100 % des courses : la contrainte `rides_payment_encaisse_complet` n'exige `payment_method` que si `payment_status = 'encaisse'` ; or une course CGSS en tiers payant n'est jamais encaissée par le chauffeur (`payment_status = 'non_concerne'`) → elle n'a jamais de `payment_method`.

**Définition corrigée à implémenter dans `queries-facturation.ts`** — une course est *facturable CGSS* si :

1. `status = 'terminee'` — course clôturée (exclut `validee`, `assignee`, `en_cours`, `annulee_regulateur`, `annulee_patient`, `annulee_chauffeur`, `brouillon`).
2. `tarif_amount_eur IS NOT NULL` — course tarifée.
3. `ended_at` dans le mois sélectionné (`ended_at >= <début mois>` ET `ended_at < <début mois+1>`). `status = 'terminee'` garantit `ended_at` non-null.
4. **Exclure le paiement direct patient** : `NOT (payment_status = 'encaisse' AND payment_method IN ('cash','cb','cheque'))`. Une course payée comptant/CB/chèque par le patient n'est pas en tiers payant CGSS. `payment_status IN ('non_concerne','a_encaisser')` = tiers payant CGSS = DANS la facture.
5. Scope organisation : RLS (`organization_id = current_organization_id()`) — implicite côté Server Component et Route Handler.
6. Filtre chauffeur optionnel : `driver_id = <id>` si la période est restreinte à un chauffeur.

**`transport_mode`** : les 4 valeurs de l'enum `ride_transport_mode` (`taxi_conventionne`, `tpmr`, `vsl`, `ambulance`) sont **toutes** du transport conventionné CGSS. En V1.5, aucun filtre `transport_mode` n'est nécessaire — le discriminant réel est le critère 4 (exclusion du paiement direct).

**Hypothèse documentée** : V1.5 ne distingue pas un transport conventionné d'un transport privé non-CGSS au niveau course. Si le dirigeant veut un jour cette distinction fine, il faudra un champ dédié (`rides.is_conventionne` ou `prise_en_charge`). À inscrire en CONCERNS. En V1.5, `status terminee` + `tarif non null` + exclusion paiement direct suffisent.

---

## Fichiers à créer / modifier

### Route Handler PDF (2)
- `apps/web/src/app/api/admin/facturation/pdf/route.tsx` (NEW) — `GET`, `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`. Calqué sur `apps/web/src/app/api/admin/legal/registre/pdf/route.tsx` : `getUser` → check `profiles.role === 'dirigeant'` (401/403) → lire `organizations.nom` → requête courses facturables → `audit_logs` AVANT `renderToStream` → `Response` PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment`). Lit `?mois=YYYY-MM&chauffeur=<id>`.
- `apps/web/src/app/api/admin/facturation/pdf/_components/facture-cgss-pdf.tsx` (NEW) — composant `Document`/`Page`/`Text`/`View`/`StyleSheet`, A4 `padding 32` `Helvetica`, calqué sur `_components/registre-pdf.tsx`.

### Page admin (4)
- `apps/web/src/app/(admin)/admin/facturation/page.tsx` (NEW) — Server Component, `requireDirigeantPage()`, `dynamic = 'force-dynamic'`, lit `searchParams` (`mois`, `chauffeur`), appelle la requête partagée, rend `<PeriodeSelector>` + `<FactureApercu>`.
- `apps/web/src/app/(admin)/admin/facturation/_components/periode-selector.client.tsx` (NEW) — `'use client'`, sélecteur mois/année + sélecteur chauffeur, `router.push('?mois=…&chauffeur=…')`, `useTransition` pour l'état pending.
- `apps/web/src/app/(admin)/admin/facturation/_components/facture-apercu.tsx` (NEW) — composant de présentation (server) : compteur + total + table dense + ligne d'avertissement « courses sans tarif » + lien de téléchargement.
- `apps/web/src/app/(admin)/admin/facturation/_lib/queries-facturation.ts` (NEW) — **requête partagée** page ↔ Route Handler. Source unique de la définition « facturable CGSS » ci-dessus. Exporte : la sélection des courses facturables d'un mois (+ filtre chauffeur), le décompte des courses CGSS terminées sans tarif (avertissement), la liste des chauffeurs pour le sélecteur.

### Agrégation (1, si non trivial)
- `apps/web/src/app/(admin)/admin/facturation/_lib/aggregate-facture.ts` (NEW, optionnel) — fonction **pure** de regroupement par chauffeur + sous-totaux + total. Si la logique dépasse quelques lignes triviales → fichier pur + test Vitest (DEC-013 esprit : logique pure non triviale). Si triviale (un `reduce`) → inline dans `facture-apercu` / le composant PDF, pas de test.

### Navigation (1)
- `apps/web/src/app/(admin)/layout.tsx` (MODIFY) — ajouter `{ href: '/admin/facturation', label: 'Facturation' }` dans `ADMIN_EXTRAS`, après l'entrée `Tarifs` (onglet dirigeant-only, déjà conditionné par `isDirigeant`).

### Seed démo (1)
- `supabase/seed.demo.sql` (MODIFY) — enrichir les courses fictives pour que l'aperçu / le PDF soient testables. Aujourd'hui ~4 courses `terminee` seulement. Ajouter / ajuster ~8-12 courses `status = 'terminee'` + `tarif_amount_eur` non-null + `ended_at` réparti sur le **mois complet précédent** + `payment_status` non encaissé-direct (laisser `non_concerne`). Idempotent `ON CONFLICT DO UPDATE` (pattern DEC-039, préfixe d'ID dédié). Objectif : la page `/admin/facturation` montre un aperçu peuplé dès le premier login démo.

---

## Surface — rappel UI-SPEC

- **Page `/admin/facturation`** : header (titre + sous-titre), `<PeriodeSelector>` (mois/année défaut = mois complet précédent + chauffeur défaut « Tous »), `<FactureApercu>` (compteur + total + table `Date·Patient·Trajet·Montant` + avertissement éventuel + bouton « Télécharger le PDF (A4) »). Le bouton est une ancre vers `/api/admin/facturation/pdf?mois=…&chauffeur=…` ; désactivé (`aria-disabled`) si l'aperçu est vide.
- **PDF `facture-cgss-pdf`** : en-tête (titre, société, période en clair, périmètre chauffeur, horodatage), tableau `Date · Patient · Trajet · Montant` trié par `ended_at` croissant, sous-totaux par chauffeur si périmètre = tous, total en gras, **disclaimer** : « Tarif estimatif, non contractuel jusqu'à la facturation CGSS télétransmise. Récapitulatif interne — ne vaut pas bordereau de télétransmission B2/SEFi. »
- **Montant par course** = `rides.tarif_amount_eur` stocké (S-01). Pas de décomposition ni de distance par course (S-02 — non persistées, recalcul interdit D-09).
- **États** : repos (aperçu peuplé) / pending (`useTransition` sur le sélecteur) / vide (état illustré `FileText` + bouton désactivé) / avertissement (`⚠ N courses CGSS clôturées sans tarif — non incluses`).

---

## Critères GREEN

- `/admin/facturation` accessible dirigeant, redirige les autres rôles (`requireDirigeantPage`).
- Changer le mois met à jour l'aperçu (compteur + total + table) via `searchParams`.
- `/api/admin/facturation/pdf?mois=YYYY-MM` retourne un PDF A4 valide téléchargeable, contenu cohérent avec l'aperçu (mêmes courses, même total — requête partagée).
- Le PDF contient en-tête société, tableau des courses, sous-totaux par chauffeur, total, et le disclaimer estimatif (DEC-061/064).
- Aperçu vide → état illustré + bouton de téléchargement désactivé.
- `audit_logs` reçoit une ligne `facturation.cgss.exported_pdf` (acteur, période, nb courses, total) AVANT le rendu.
- Onglet « Facturation » visible dans la nav admin (dirigeant).
- Seed démo : l'aperçu est peuplé sur le mois précédent dès le login démo dirigeant.
- `pnpm typecheck` workspace PASS, `pnpm --filter @tap/web build` PASS. Chaque fichier ≤ 300 LOC, composant ≤ 150 LOC.

---

## Risques + mitigations

- **`payment_method` NULL partout** : déjà intégré (définition corrigée — critère 4 exclut le paiement direct, pas d'égalité `cgss_differe`).
- **Décomposition par course attendue mais non stockée** : tranché S-01/S-02 — montant total uniquement. Ne pas recalculer (D-09). Inscrire en CONCERNS la piste « persister `PricingResult` » si une décomposition par course est demandée plus tard.
- **`runtime = 'nodejs'` obligatoire** : `@react-pdf/renderer` utilise des APIs Node — sans ce flag le Route Handler échoue sur Vercel Edge. Calquer exactement le registre.
- **Cohérence aperçu ↔ PDF** : garantie par la requête partagée `queries-facturation.ts` — ne PAS dupliquer la définition « facturable » dans le Route Handler.
- **Volume de courses** : un mois peut dépasser une page A4 — `@react-pdf/renderer` pagine automatiquement (`Page` flow). Vérifier le rendu multi-page.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Reprendre `payment_method = 'cgss_differe'` (S-03 faux — voir définition corrigée).
- ❌ Recalculer les tarifs dans la facture (D-09 — agrège `tarif_amount_eur` stocké).
- ❌ Introduire une nouvelle bibliothèque PDF (D-07 — `@react-pdf/renderer` déjà présent).
- ❌ Générer le PDF sans aperçu préalable (verrou V6).
- ❌ Omettre le disclaimer estimatif (DEC-061/064).
- ❌ Dupliquer la définition « facturable » entre page et Route Handler (source unique `queries-facturation.ts`).
- ❌ `useEffect` pour charger l'aperçu (la période passe par `searchParams` + Server Component).
- ❌ Inclure les courses annulées / non clôturées / payées en propre.
- ❌ Spécifier ou amorcer la télétransmission B2/CNDA (différée — DEC-064).
- ❌ Appliquer la migration de seed via MCP (DEC-032 — CD push exclusif).
