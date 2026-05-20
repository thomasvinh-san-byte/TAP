# Phase 06 — Discussion Log

**Date :** 2026-05-20
**Mode :** discuss — découpage E2E Passe 4 (Pipeline GSD 1/5)
**Pour référence humaine uniquement** — non consommé par les agents downstream (researcher, planner, executor).

## Questions posées au dirigeant

### 1. Clients CGSS — statut réel de l'échéance B2/CNDA
- Options : aucun client payant / design partner en test sans facturation / clients facturant déjà.
- **Réponse : design partner en test, sans facturation.**
- Conséquence : l'échéance du 31 mai 2026 ne pèse pas sur TAP (elle concerne le taxi qui télétransmet). Télétransmission B2/CNDA différée.

### 2. Périmètre Phase 06 — découpage des 6 blocs
- Options : Phase 06 resserrée + sous-phases / Phase 06 = facturation + sécurité + HDS / méga-phase complète.
- **Réponse : Phase 06 resserrée + sous-phases dédiées.**
- Conséquence : Phase 06 = A (facturation PDF) + E (audit sécurité) + F (dettes CI). HDS, OR-Tools en sous-phases.

### 3. Portail B2B — timing
- Options : différer après le 1er client réel / sous-phase 06.x dédiée / dans Phase 06.
- **Réponse : différer après le 1er client réel.**
- Conséquence : B2B différé via ADR (anti-construction avant product-market fit).

### 4. Stratégie HDS
- Options : sous-phase dédiée avec choix fournisseur différé / trancher Supabase EU+DPA / trancher migration Scaleway/OVH.
- **Réponse : sous-phase dédiée, choix fournisseur différé.**
- Conséquence : HDS = Phase 06.5 dédiée, choix fournisseur tranché dans son propre discuss + ADR.

## Décisions issues du discuss

- 13 décisions d'implémentation (D-01 à D-13) — voir 06-CONTEXT.md.
- 5 DEC candidates : DEC-063 (Phase 06 resserrée), DEC-064 (facturation PDF / B2-CNDA différé), DEC-065 (HDS 06.5), DEC-066 (OR-Tools 06.7), DEC-067 (B2B différé).
- DEC-040 (déjà candidate CONCERNS) à promouvoir LOCKED pendant le Bloc E.

## Idées différées

- Sous-phases : 06.5 HDS, 06.7 OR-Tools.
- Différés via ADR : portail B2B, télétransmission B2/CNDA.
- Reséquencer : table `prescriptions` + RECU-04, tableau de bord KPIs dirigeant.

## Discrétion de Claude

- Découpage en waves de Phase 06 (au-delà de F en Wave 1) — à arbitrer au plan-phase.
- Forme de l'UI de déclenchement du PDF — à arbitrer au ui-spec / plan.
