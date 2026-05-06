# Requirements (intel synthétisée)

> Aucun PRD formel n'a été ingéré. Les besoins fonctionnels listés ici sont extraits
> de CLAUDE.md (§ 2 — modules critiques) et désignent les modules du **Cahier des
> charges V2** (`docs/cahier_des_charges_saas_tap_v2.docx`) — document non lu par
> l'ingest (binaire .docx). Ces requirements sont donc des **pointeurs vers le CDC**
> et non des spécifications complètes.
>
> Action recommandée : tagger le CDC v2 comme PRD via manifest et relancer l'ingest
> dès qu'une version texte/markdown est disponible, afin d'extraire les critères
> d'acceptation détaillés.

---

## REQ-saisie-express-course

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.8)
- **scope**: apps/web (régulatrice), packages/domain
- **description** : écran le plus utilisé par la régulatrice. Saisie d'une course en mode rapide.
- **critères d'acceptation extraits**
  - Temps de saisie complet **< 30 secondes** (cf. DEC-005).
  - Accessible par raccourci clavier global `Cmd/Ctrl+N` (cf. DEC-015).
  - Pause & reprise d'une saisie en cours (file d'attente brouillons).
  - Multi-saisies en parallèle (jamais bloquant si nouvel appel arrive).
  - Recherche patient fuzzy à partir de 2 caractères.
- **détails complets** : voir CDC v2 § 5.8 (à ingérer en PRD).

---

## REQ-courses-recurrentes

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.9)
- **scope**: packages/recurrence, apps/web
- **description** : génération et gestion de courses récurrentes (dialyse 3×/semaine,
  chimio, etc.). Représente **60 % de l'activité réelle** d'un TAP.
- **critères d'acceptation extraits**
  - Schéma de récurrence configurable.
  - Calcul des prochaines dates avec gestion des **exceptions jours fériés 974**
    (La Réunion).
  - Décrément automatique du bon de transport associé.
  - Couverture de tests **100 % branches** (cf. DEC-013).
- **détails complets** : voir CDC v2 § 5.9.

---

## REQ-cockpit-regulateur

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.13)
- **scope**: apps/web
- **description** : vue temps réel par défaut de la régulatrice à la connexion.
- **critères d'acceptation extraits**
  - Time to Interactive **< 2 secondes** (cf. DEC-005).
  - Mises à jour temps réel via Supabase Realtime, en fade-in subtil
    (jamais de flash ni reload).
  - Tests d'intégration sur composant critique.
- **détails complets** : voir CDC v2 § 5.13.

---

## REQ-gestion-imprevus

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.14)
- **scope**: apps/web, apps/mobile, packages/domain
- **description** : workflows précis de gestion des imprévus — panne, patient absent,
  réaffectation. Représente **30 % du métier réel**.
- **critères d'acceptation extraits**
  - Tests E2E (Playwright) couvrant chaque workflow imprévu (cf. DEC-013).
- **détails complets** : voir CDC v2 § 5.14.

---

## REQ-communication-sms-patient

- **source**: /home/user/TAP/CLAUDE.md § 2 + § 6 (référence CDC v2 § 5.15)
- **scope**: packages/sms, apps/web
- **description** : levier majeur de productivité — communication SMS sortante et
  réception réponses patient.
- **critères d'acceptation extraits**
  - Vérification du **consentement actif** avant tout envoi (cf. DEC-008).
  - Templates personnalisables, personnalisation par patient.
  - Envoi via Twilio ou OVH SMS Pro (cf. DEC-003).
  - Log + statut delivery archivés dans la fiche patient.
  - Préférence patient respectée (SMS / appel / aucun).
- **détails complets** : voir CDC v2 § 5.15.

---

## REQ-pwa-chauffeur

- **source**: /home/user/TAP/CLAUDE.md § 2 + § 5 (référence CDC v2 § 5.16)
- **scope**: apps/mobile
- **description** : PWA chauffeur — UX terrain (soleil, batterie, mains occupées,
  vocal).
- **critères d'acceptation extraits**
  - Boutons ≥ 56 px, texte d'action ≥ 18 px (cf. DEC-014).
  - Mode hors-ligne fonctionnel pour tournée, démarrage/clôture course, scan BT.
  - TTS du nom patient et adresse au démarrage de course.
  - Confirmation d'action **< 1 seconde même en 3G** (cf. DEC-005).
  - Mode contraste élevé + police agrandie disponibles.
- **détails complets** : voir CDC v2 § 5.16.

---

## REQ-caisse-paiements-directs

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.19)
- **scope**: apps/web, packages/domain
- **description** : tous les encaissements non CGSS (cash, CB, chèque) avec
  rattachement à une course ou un patient.
- **critères d'acceptation extraits**
  - Encaissements journalisés dans `audit_logs` (cf. DEC-010).
  - Rapprochement caisse de fin de journée.
- **détails complets** : voir CDC v2 § 5.19.

---

## REQ-mode-degrade

- **source**: /home/user/TAP/CLAUDE.md § 2 (référence CDC v2 § 5.24)
- **scope**: apps/web, apps/mobile
- **description** : continuité de service en cas de panne réseau / Supabase /
  service tiers. Outil critique au quotidien.
- **détails complets** : voir CDC v2 § 5.24.

---

## REQ-moteur-tarification-cgss

- **source**: /home/user/TAP/CLAUDE.md § 2 + § 8 (référence CDC v2 § 7)
- **scope**: packages/pricing
- **description** : cœur économique du SaaS — calcul de tarification CGSS pour
  chaque course.
- **critères d'acceptation extraits**
  - Couverture de tests **100 % branches** (cf. DEC-013).
  - Aucun calcul tarifaire ailleurs que dans ce package (cf. DEC-016).
  - Versionnement des grilles tarifaires (`tariff_grid`, `b2b_tariff_grid`).
- **détails complets** : voir CDC v2 chapitre 7.

---

## Notes — modules secondaires non détaillés ici

CDC v2 contient **24 modules fonctionnels**. Les 9 modules critiques ci-dessus sont
ceux explicitement priorisés dans CLAUDE.md § 2. Les 15 autres modules existent
mais ne sont pas extraits — leur synthèse nécessite l'ingest du CDC v2 en tant
que PRD (.docx → conversion texte préalable).

---

## État d'avancement (extrait CLAUDE.md § 14)

- **Lot 0** — Fondations multi-tenant, RLS, migrations, CI/CD : **TERMINÉ**.
- **Lot 1** — Référentiels patients + saisie express : **EN COURS**.
- Dernier commit majeur : `chore(lot-0): fondations monorepo + multi-tenant Supabase`.
