# ADR-003 — Pivot vers développement E2E par passes successives

- **Statut** : Accepté
- **Date** : 2026-05-11
- **Auteur** : Guillaume
- **Remplace** : aucun ADR antérieur
- **Affecte** : CLAUDE.md §14 (roadmap), §9 (tests), §13.5 (critère de phase)

## Contexte

Au 2026-05-11, le repo a livré en 5 jours calendaires et 3 jours actifs :

- Phase 0 (fondations multi-tenant)
- Phase 1 (référentiel patients + NIR chiffré)
- Phase 1.5 (RGPD complet — 8 tables, 6 routes admin, portail patient JWT)
- Phase 0.7 (déploiement Vercel auto)
- Phase 2 (saisie express course)

La roadmap prévue enchaînait Phase 3 (pricing CGSS) → Phase 4 (recurrence) → Phase 5 (cockpit) → ... → Phase 9 (PWA chauffeur). Cette séquence présente trois faiblesses convergentes.

**Faiblesse 1 — Pas de parcours utilisable bout en bout avant 4-6 mois.** Aujourd'hui une régulatrice peut saisir un patient et une course, mais elle ne peut ni l'assigner à un chauffeur, ni la voir exécutée, ni l'encaisser. La promesse produit « régulatrice 8 heures par jour dans l'outil » n'est pas testable.

**Faiblesse 2 — Pas de validation produit empirique.** Le parcours complet n'est pas jouable, donc non testable même par Guillaume seul. Le CLAUDE.md §1 pose le risque produit comme dominant : « la régulatrice conditionne 80 % du succès produit ». Sans parcours jouable de bout en bout, les modules les plus métier-sensibles (pricing, recurrence, cockpit) sont bâtis sans boucle de feedback.

**Faiblesse 3 — Inversion de séquence conformité / fonctionnel.** La Phase 1.5 a livré le registre des traitements art. 30, la DPA art. 28, la DPIA art. 35, le tracker breaches 72h art. 33 et le portail patient art. 15-21 avant le cœur métier. En l'absence de client payant, cette conformité protège du vide.

## Décision

**Pivot vers développement E2E par passes successives.** Chaque passe traverse les six maillons du parcours métier :

1. Patient (référentiel)
2. Saisie course (planification)
3. Assignation (chauffeur + véhicule)
4. Exécution (terrain mobile)
5. Tarification + encaissement
6. Trace (audit, statistiques minimales)

Les passes raffinent progressivement chaque maillon sans en perfectionner aucun avant que tous existent.

**Quatre passes prévues :**

- **Passe 1 (Phase 3)** — Squelette E2E : tous les maillons existent en mode minimal. Tarif manuel. Pas de PWA. Pas de hors-ligne. Pas de récurrences. Pas de SMS.
- **Passe 2 (Phase 4)** — PWA chauffeur installable + tarif CGSS forfait court trajet auto + récap caisse fin de journée.
- **Passe 3 (Phase 5)** — Récurrences dialyse + cockpit temps réel + SMS rappel patient.
- **Passe 4 (Phase 6+)** — Conformité production : RGPD niveau commercial + HDS + OR-Tools + portail B2B donneurs d'ordres.

**Gel temporaire de la Phase 1.5 RGPD.** Le code livré reste, accessible mais non étendu jusqu'à la Passe 4. Les routes `/admin/legal/*` ne sont pas mises en avant. Les pages `/legal/*` publiques restent (faible coût, utiles en démo). Aucune nouvelle table RGPD, aucune nouvelle Server Action conformité avant la Passe 4.

**Critère de succès de phase reformulé.** Une phase est livrée non pas quand le code compile et que les tests passent, mais quand un design partner peut compléter le parcours de la passe sans intervention du dev. Code vert + preview accessible = nécessaires, non suffisants.

## Alternatives considérées

### A. Continuer phase par phase (statu quo)

- **Pour** : sécurité technique maximale, chaque module fini avant le suivant, dette régressive minimale.
- **Contre** : 4 à 6 mois avant un parcours utilisable bout en bout, donc 4 à 6 mois avant feedback terrain réel. Les modules pricing, recurrence et cockpit sont bâtis sans confrontation au métier. Risque produit dominant.
- **Verdict** : rejeté.

### B. Terrain d'abord, gel total du dev pendant 2-3 semaines

- **Pour** : pureté méthodologique, aucun code écrit dans le vide.
- **Contre** : perte du momentum, aucun levier de démo pour ouvrir les portes des sociétés TAP. Le pitching à froid sans rien à montrer est beaucoup plus difficile que le pitching avec une preview cliquable.
- **Verdict** : rejeté.

### C. Pivot E2E par passes (retenu)

- **Pour** : démo cliquable à fin Passe 1 (2-3 semaines). Le terrain peut commencer en parallèle de la Passe 1. Chaque passe livre un produit qui marche, raffiné. Ajustements continus.
- **Contre** : churn de code à chaque passe (la tarification manuelle Passe 1 devient auto en Passe 2, etc.). La dette RGPD/HDS Phase 1.5+ est repoussée mais traçable.
- **Verdict** : retenu.

## Conséquences

### Positives

- Parcours jouable end-to-end en local et sur preview Vercel dans 2 à 3 semaines, validation Guillaume seul.
- Le pricing CGSS, la PWA chauffeur et l'encaissement sont confrontés au métier réel avant d'être perfectionnés.
- La démo Passe 2 est commercialement utilisable pour signer un design partner payant.
- Le code RGPD livré n'est pas perdu : il sera rebranché en Passe 4 quand le client paye.

### Négatives / vigilance

- Churn explicite : `rides.tarif_amount_eur` (numeric manuel) en Passe 1 sera complété par `tarif_source` (manuel/cgss_auto) en Passe 2 et par `tarif_breakdown` (jsonb détaillé) en Passe 3. À chaque passe, la migration enrichit sans rompre.
- Le code Phase 1.5 RGPD doit rester compilable et déployable même non étendu. Aucun refactor.
- Le critère « design partner sans assistance » est dur à mesurer en CI. La preuve canonique reste humaine (walkthrough live ou enregistré).

### Vigilance dette

Les promesses CLAUDE.md non tenues en Passe 1-3 sont listées explicitement dans chaque CONTEXT.md de passe, section « Hors scope ». À la livraison de la Passe 3, un audit de dette est obligatoire avant d'entrer en Passe 4.
