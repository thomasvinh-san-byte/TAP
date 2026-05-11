# Phase 3 — Passe 1 (squelette E2E) — Research

**Status** : Squelette à instruire (RESEARCH non encore conduit)

> Ce fichier reste un squelette tant qu'un cycle d'instruction RESEARCH n'a pas été lancé. Il a vocation à être rempli en parallèle de PATTERNS, avant le premier 03-01-PLAN.

---

## Questions ouvertes à trancher

1. **Drawer ou page dédiée pour `/courses/[id]` ?**
   - Phase 2 utilise un modal pour la saisie. Le détail course est différent (lecture + actions contextuelles, lien partageable).
   - Trade-off : page dédiée = URL stable, deep link → ouvre la voie au design partner qui partage. Drawer = retour rapide au cockpit, plus dense.
   - À trancher avant 03-04-PLAN.

2. **`profile_id` nullable sur `drivers` : comment matcher un compte Auth a posteriori ?**
   - CONTEXT précise « nullable pour permettre d'enregistrer un chauffeur en référentiel avant qu'il n'ait un compte Auth ». Pas de procédure de matching auto définie.
   - Option A : matching manuel par le dirigeant (UI `/admin/chauffeurs` propose un sélecteur de profil).
   - Option B : matching auto par email (à l'invitation, le trigger met à jour `drivers.profile_id`).
   - Décision attendue avant 03-01-PLAN (impacte le schéma ou non).

3. **Quelles transitions de statut couvre l'audit trigger étendu ?**
   - CONTEXT §4.4 : « extension du trigger d'audit pour journaliser les transitions de statut ». L'enum `ride_status` actuel a 8 valeurs. Faut-il journaliser chaque transition individuelle (`ride.assigned`, `ride.started`, `ride.ended`) ou une action générique `ride.status_changed` ?
   - À trancher avant 03-01-PLAN (impacte la migration trigger).

4. **Comment le régulateur bascule-t-il côté chauffeur sans logout ?**
   - CONTEXT §4.6 : « le régulateur peut basculer côté chauffeur ».
   - Option : un bouton « Vue chauffeur » dans le header dirigeant/régulateur, sans changement de session, juste un changement de route. L'authorisation RLS sur `rides` doit cependant matcher `driver_id` à un `auth.uid()` qui n'est pas le sien.
   - Question : la démo accepte-t-elle que le régulateur voie toutes les courses du jour côté `/conduite`, ou seulement celles d'un chauffeur impersonné ? À clarifier avec Guillaume.

5. **Concept de « tournée du jour » côté chauffeur sans table `tournee` ?**
   - CONTEXT §4.2 : « Concept de tournée comme objet métier persistant (Passe 3) ».
   - En Passe 1, la « tournée » est juste un filtre sur `rides where driver_id = ? and scheduled_at between today_start and today_end`. Pas de table.
   - Question : est-ce que la « clôture de tournée » (fin de journée chauffeur) existe en Passe 1 ou pas ? Réponse implicite du CONTEXT : non, juste « Clôturer » chaque course individuellement.

6. **Comportement attendu sur la course `terminee` côté `/conduite` ?**
   - Reste-t-elle visible jusqu'à minuit ? Disparaît-elle ? À expliciter pour le rendu.

7. **Tarif manuel : champ libre ou bornes minimales ?**
   - CONTEXT : « Saisie manuelle du tarif à la clôture (numeric, champ libre) ».
   - Question : valeur >= 0 ? Limite haute pour éviter erreur de saisie (ex. 1000 €) ? Décimales (centimes) ? À fixer dans le validator zod.

---

## Threats / risques identifiés à la lecture du brief

- **R1 — Mobile + 6 maillons E2E en 5-8 jours.** Le périmètre est tendu si le design system mobile chauffeur n'est pas mappé en amont. Mitigation : sortir 03-PATTERNS.md complet avant 03-01-PLAN.
- **R2 — Pas de design partner identifié.** Le critère humain ne peut être validé sans contact terrain initié. Mitigation : Guillaume initie 3 prises de contact en parallèle de 03-01-PLAN (cf. brief §10).
- **R3 — Churn de schéma assumé.** `tarif_amount_eur` (Passe 1) → `tarif_source` (Passe 2) → `tarif_breakdown` jsonb (Passe 3). Mitigation : nommer les colonnes Passe 1 pour qu'elles survivent (`tarif_amount_eur`, `tarif_source`, `payment_*` sont déjà compatibles Passe 2).
- **R4 — Audit log volume.** Étendre l'audit trigger aux transitions de statut peut tripler le volume sur `audit_logs`. Mitigation : vérifier que la rétention `audit_logs` existante tient (à voir dans RESEARCH).
- **R5 — Régulateur impersonné chauffeur cassera RLS si mal géré.** Cf. question 4. Mitigation : décider tôt si on relaxe la RLS ou si on filtre seulement le rendu.

---

## Lectures recommandées avant d'écrire les plans

- CLAUDE.md §1 (Pilier 1 UX) — pour la rigueur mobile chauffeur
- CLAUDE.md §5 « Règles renforcées côté chauffeur » — contraintes 56px / 18px / 3 infos max
- CDC v2 module 5.16 (PWA chauffeur) — pour comprendre ce qui est différé en Passe 2
- CDC v2 module 5.19 (Caisse et paiements directs) — pour aligner `payment_method` sur le vocabulaire métier
- `docs/showcase/02-saisie-express-course/` — pour calibrer la qualité visuelle attendue
- ADR-002 — pour la mécanique RLS `current_organization_id()` à dupliquer
