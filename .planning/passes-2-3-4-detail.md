# Brief détaillé — Passes 2, 3, 4

**Date** : 2026-05-11
**Statut** : Complément au brief `pivot-e2e-v2-2026-05-11.md` qui ne donnait que des esquisses (§6) pour les passes ultérieures. Ce document détaille chacune. À relire et patcher en fin de Passe 1 avec les retours d'expérience.

---

## 0. Rappel — Principe du pivot E2E

Chaque passe traverse les 6 maillons métier (patient → saisie → assignation → exécution → tarification → trace) en améliorant le minimum partout. Aucun module n'est raffiné avant que tous aient été touchés.

Chaque passe a deux goals parallèles : fonctionnel et UX. Aucun goal ne peut être validé sans l'autre.

À la fin de chaque passe : walkthrough de validation joué seul, ratio captures publiables 5/5 minimum à 1:1, règle de la nuit avant validation.

---

## 1. Passe 2 (Phase 4) — PWA + tarif CGSS auto + récap caisse

### Goal fonctionnel

Le chauffeur peut installer l'application sur son téléphone comme une vraie app native, travailler hors-ligne pendant 1 heure et synchroniser au retour réseau. Le tarif CGSS court trajet est calculé automatiquement à la clôture, avec override manuel possible. Le régulateur voit un récap caisse de la journée par chauffeur. Le dirigeant a un CRUD basique chauffeurs + véhicules (repoussé de la Passe 1, cf. décision Q1).

### Goal UX

PWA installable proprement : manifest.json complet, icônes 192/512 sans bavure, splash screen identité, theme color cohérent avec mode courant. Transitions natives entre `/conduite` et `/conduite/[rideId]` style iOS push (slide latéral). Indicateurs hors-ligne discrets mais visibles (point dans le header, badge synchro). Récap caisse en table dense type Stripe Balance avec totaux tabulaires en pied. CRUD chauffeurs/véhicules dans le style des listes /patients existantes (drawer + form simple).

### Périmètre — dans

- Manifest PWA + service worker minimal pour `/conduite` et `/conduite/[rideId]`
- Cache des courses du jour à l'ouverture, mise en file d'attente des mutations offline (start, end) avec sync au retour réseau
- Indicateurs visuels offline/synching/synced
- Calcul tarif CGSS court trajet automatique : forfait base + distance estimée. Pas d'OR-Tools. Override manuel toujours possible.
- Page `/courses/caisse?date=YYYY-MM-DD` : récap encaissements de la journée par chauffeur, totaux, export CSV
- Écrans `/admin/chauffeurs` et `/admin/vehicules` : liste + drawer création/édition (Server Actions déjà livrées en 03-B sauf le CRUD chauffeur/véhicule qui reste à ajouter)
- Refonte pages `/login`, `/welcome`, `/setup` : layout split avec zone identité (logo, baseline produit) + form, comptes démo cliquables si DEMO_MODE, identité visuelle forte, mode nuit
- Page `/dev` pour switcher de session démo (utilitaire dev solo, visible si NODE_ENV !== 'production' ou DEMO_MODE=true)

### Périmètre — hors

- Hors-ligne > 1 heure (V3)
- Calcul CGSS long trajet, suppléments TPMR, attente, etc. (V3)
- Push notifications (V3)
- Géolocalisation chauffeur en temps réel (V3)
- Récurrences (Passe 3)

### Écrans-cibles + références visuelles

**Splash screen + icônes PWA.** Référence : applications natives propres (Things, Cron, Linear PWA). Icône TAP en aplats, fond uni primary, ratio 1:1 sans découpe.

**Indicateur offline header.** Référence : GitHub Codespaces (badge état de connexion), Notion (offline mode discret). Point coloré 8px à gauche de l'avatar : vert online, gris orange synching, rouge offline avec compteur d'opérations en file.

**Page caisse régulateur.** Référence : Stripe Balance / Payouts. Tableau dense colonnes : chauffeur (initiales + nom), nombre courses, total encaissé tabular-nums, méthodes (3 badges compact cash/CB/chèque), différé CGSS, actions. Pied de tableau : total global tabular-nums grand.

**Écrans CRUD chauffeurs + véhicules.** Référence : Linear team members, Plain users list. Pattern hérité des écrans Passe 1 : liste + drawer slide-right + form react-hook-form + zod. Pas de réinvention.

**Transitions PWA.** Référence : iOS UIKit push, Linear mobile. Slide latéral 250ms ease-out entre route parent et route enfant. Bouton retour visible top-left.

**Pages auth `/login` / `/welcome` / `/setup`.** Référence : Linear login, Vercel login, Plain auth, Stripe Atlas. Layout split desktop : moitié gauche identité produit (logo TAP grand, baseline FR sobre, fond accent terracotta très désaturé ou gradient subtil), moitié droite form. Sur mobile, stack vertical : identité courte en haut, form dessous. Form lui-même : labels au-dessus des inputs, validation inline FR, bouton primaire h-14, lien « Mot de passe oublié » discret. Mode nuit traité à parité.

**Page `/dev`** (utilitaire dev). Référence : Posthog admin panels, Vercel dashboard internals. Cards par compte démo seedé avec InitialsAvatar + nom + rôle + email + bouton « Se connecter comme X » qui appelle une Server Action de switch (signOut + signIn pré-rempli ou magic link interne). Banner top jaune « Mode démo — outils dev » pour rappeler le contexte. Page exposée uniquement si DEMO_MODE ou env=dev.

### Critère de fin

Le dev solo joue seul :
1. Installe l'app via Chrome/Safari (Add to Home Screen) sur smartphone réel
2. Ouvre `/conduite` en chauffeur, voit les courses, met le téléphone en mode avion
3. Démarre une course → bouton vert succès apparaît, indicateur synching
4. Clôture une course offline avec tarif + cash + encaissé maintenant
5. Remet le téléphone en réseau → toast « 2 opérations synchronisées »
6. Vérifie en régulateur que les transitions sont bien en DB avec les `started_at`/`ended_at` corrects (timestamps d'origine, pas de sync)
7. Crée 5 courses sur 3 chauffeurs différents, joue 5 clôtures avec montants variés, ouvre `/courses/caisse?date=today`, vérifie le récap
8. Ajoute un nouveau chauffeur via `/admin/chauffeurs`, vérifie qu'il est sélectionnable dans modal assignation
9. Test mode nuit sur PWA installée

Durée totale ≤ 25 min, zéro friction visuelle, zéro perte de donnée offline.

### Playbook prompts

- **04-A** : manifest PWA + icônes + theme color + service worker minimal cache statique
- **04-B** : refonte pages `/login` + `/welcome` + `/setup` + page `/dev` utilitaire switch session démo
- **04-C** : queue de mutations offline (IndexedDB) + sync au retour réseau + indicateur header
- **04-D** : calcul tarif CGSS court trajet (zod + util pur testé Vitest)
- **04-E** : page `/courses/caisse` + export CSV
- **04-F** : CRUD `/admin/chauffeurs` + `/admin/vehicules` (drawers + forms)
- **04-G** : E2E Playwright PWA + SUMMARY

7 prompts. Cadence : 1 par jour ouvré, validation visuelle entre chaque. 12 jours calendaires avec règle de la nuit.

### Risques techniques

- Service Worker sur Next.js 14 App Router : ne pas s'enliser dans Workbox, garder minimal (cache + queue mutations). Si trop complexe, isoler dans une PR exploration avant 04-A.
- IndexedDB côté client : utiliser une lib simple (idb-keyval) plutôt que IndexedDB nu.
- Tests PWA sur Vercel preview : limité, valider sur smartphone réel obligatoirement.

---

## 2. Passe 3 (Phase 5) — Récurrences + cockpit + SMS rappel

### Goal fonctionnel

Le régulateur crée une récurrence dialyse (mardi/jeudi/samedi 7h pendant 3 mois) qui génère automatiquement les courses correspondantes. Le cockpit affiche en temps réel l'état des courses du jour avec mise à jour Realtime (chauffeur démarre une course, le cockpit met à jour la ligne sans reload). Les SMS de rappel sont envoyés 24h et 2h avant la course aux patients consentants, avec template éditable par le dirigeant.

### Goal UX

Récurrences avec vue calendrier mensuelle + édition d'une occurrence individuelle (style Google Calendar / Cron). Cockpit dense type Linear cycles ou Posthog dashboard, avec mise à jour Realtime en fade-in (jamais un reload pleine page). Templates SMS dans une vue éditable avec preview rendu (variables `{patient.prenom}`, `{course.heure}`, `{course.pickup}`). Status SMS visible dans le drawer course (envoyé, livré, échec).

### Périmètre — dans

- Table `ride_recurrences` avec règle iCalendar (RFC 5545 simplifiée : freq, byday, dtstart, until)
- Job de génération courses récurrentes (Edge Function CRON quotidien ou Postgres pg_cron)
- Édition d'une récurrence : modifier toute la série OU juste cette occurrence (pattern Google Calendar)
- Cockpit `/cockpit` : vue temps réel par chauffeur, courses du jour, statut, progression
- Realtime Supabase sur les changements de statut rides
- Templates SMS dans `sms_templates` (table par organization, créés par dirigeant)
- Envoi SMS via service externe (Twilio ou OVH SMS Pro selon coût 974) en Edge Function
- Status delivery dans `sms_messages` lié à ride
- Vue calendrier mensuelle des courses récurrentes

### Périmètre — hors

- Optimisation tournée (Passe 4)
- Communication entrante SMS (V3)
- WhatsApp/RCS (V3)
- Récurrences avec exceptions complexes (V3, garder simple)
- Confirmation patient via lien (V3)

### Écrans-cibles + références visuelles

**Création récurrence.** Référence : Google Calendar event repetition picker, Cron event. Modal/drawer avec : freq (quotidienne/hebdo), byday (checkboxes lundi-dimanche pour hebdo), date début, date fin, heure scheduled, patient. Preview en bas listant les 5 prochaines occurrences générées.

**Vue calendrier récurrences.** Référence : Cron mois view, FullCalendar style sobre. Grille 7 colonnes (lundi-dimanche), occurrences sous forme de cellules colorées avec heure + initiales patient. Click sur occurrence ouvre options : modifier celle-ci / modifier la série / supprimer.

**Cockpit régulateur.** Référence : Linear cycles, Posthog cohorts dashboard, Onfleet dispatcher (mais plus dense). Layout :
- Header timeline du jour (08h → 20h) en bandeau horizontal scrollable
- Lignes chauffeurs (3-5 en démo, plus en prod) avec courses positionnées sur la timeline
- Couleur par statut + animation pulse sur en_cours
- Click course → drawer existant
- Indicateur live (badge vert pulsant) en haut à droite

**Éditeur SMS templates.** Référence : Linear comments / Plain customer messages. Textarea avec variables surlignées en `{var}`, preview rendu en dessous avec données d'exemple. Save en revalidation.

**Drawer course — section SMS.** Sous la section paiement, ajouter section « Communications » qui liste les SMS envoyés à ce patient pour cette course (status, timestamp, contenu envoyé). Référence : Stripe events log par customer.

### Critère de fin

Le dev solo joue seul :
1. Crée une récurrence dialyse mardi/jeudi/samedi 7h pendant 1 mois sur un patient
2. Vérifie que 12 courses ont été créées en DB avec scheduled_at corrects
3. Modifie l'occurrence du 3e jeudi pour 8h au lieu de 7h, vérifie que seule celle-là est modifiée
4. Ouvre `/cockpit`, voit les 5 chauffeurs en timeline horizontale
5. Sur un autre device, login chauffeur, démarre une course → le cockpit met à jour la ligne en moins de 2 secondes sans reload
6. Crée un template SMS de rappel J-1 avec variables `{patient.prenom}` et `{course.heure}`
7. Lance le cron de rappel manuellement (route admin), vérifie que les SMS sont envoyés aux 3 patients consentants du lendemain
8. Vérifie le status delivery dans le drawer course
9. Mode nuit testé sur le cockpit (critique pour usage soir/nuit régulateur)

Durée totale ≤ 35 min, mise à jour Realtime ≤ 2s perçus, taux delivery SMS ≥ 95%.

### Playbook prompts

- **05-A** : migrations `ride_recurrences` + `sms_templates` + `sms_messages` + RLS + pgTAP
- **05-B** : Server Actions récurrences (create, update, delete, regenerate) + job génération
- **05-C** : écrans création + vue calendrier récurrences
- **05-D** : cockpit régulateur + Realtime Supabase
- **05-E** : Server Actions SMS templates + Edge Function envoi SMS + status callback
- **05-F** : écrans templates + section SMS dans drawer + E2E + SUMMARY

6 prompts. Plus complexe que Passe 2, allouer 8-10 jours ouvrés.

### Risques techniques

- Génération courses récurrentes : gérer les changements de série (rétroactif ou pas ?). Décision : modification d'une série n'affecte que les occurrences futures non encore commencées.
- Realtime Supabase : tester en charge dès 05-D. Si latence > 2s, fallback polling 5s.
- SMS prix unitaire 974 : OVH SMS Pro ~0,06 € HT. Budget mensuel estimé : 50 patients × 2 SMS × 20 jours = 2000 SMS = 120 €. Acceptable.

---

## 3. Passe 4 (Phase 6+) — RGPD prod + HDS + OR-Tools + B2B

### Goal fonctionnel

Le SaaS est commercialisable. Conformité RGPD complète (registre, dossiers patient export, droit oubli automatisé). Hébergement HDS validé (Supabase Frankfurt + accord HDS). Optimisation tournée chauffeur via OR-Tools en Edge Function (suggestion de réordonnancement). Portail B2B pour le dirigeant d'une société de TAP : invitation chauffeurs, vue mensuelle, facturation, paramétrage.

### Goal UX

Portail dirigeant avec identité visuelle dérivée mais distincte (accent color secondaire, type Stripe Atlas pour partenaires). Dashboard business avec stats temps réel (revenu jour/semaine/mois, top patients, top chauffeurs). Suggestion OR-Tools présentée en diff visuel avant/après (référence : git diff ou Linear PR review). Onboarding dirigeant fluide style Stripe Atlas.

### Périmètre — dans

- Réactivation du périmètre Phase 1.5 RGPD gelé : ROPA UI, DPIA UI, exports patients, droit oubli automatisé via Edge Function
- Documentation HDS + signature avenant Supabase
- Edge Function OR-Tools : prend en entrée la journée d'un chauffeur, retourne suggestion de réordonnancement avec gain estimé
- UI suggestion OR-Tools : modal présentant tournée actuelle vs suggérée, bouton « Appliquer » qui réordonne
- Portail dirigeant `/dashboard` : KPIs mois, revenu, courses, chauffeurs actifs
- Invitations équipe (chauffeurs + régulateurs) par email + magic link
- Facturation interne : génération PDF facture B2B mensuelle agrégée pour CGSS
- Paramétrage organization : nom, SIRET, adresse, tarifs custom CGSS

### Périmètre — hors

- Multi-organization avec switch (V5 si besoin)
- Marketplace de chauffeurs indépendants (hors scope produit)
- Application native iOS/Android (PWA suffit jusqu'à scale)
- IA prédictive demande (V5)

### Écrans-cibles + références visuelles

**Dashboard dirigeant `/dashboard`.** Référence : Posthog insights, Plausible stats, Vercel analytics. Grille de cards :
- Card revenu mois (chiffre tabular-nums grand + delta vs mois précédent en muted)
- Card courses du mois (nombre + barres sparkline)
- Card chauffeurs actifs (nombre + liste compact)
- Card top patients (top 5 + nombre courses)
- Graphique principal : revenu par jour, courbe lissée

**Modal suggestion OR-Tools.** Référence : Linear PR review (avant/après en diff), git split view. Deux colonnes côte à côte :
- Gauche : tournée actuelle (cartes empilées avec heure scheduled, durée trajet estimée)
- Droite : tournée suggérée (mêmes cartes réordonnées avec gain estimé en muted vert)
- Bouton « Appliquer la suggestion » bas + bouton « Garder l'actuelle »

**Onboarding dirigeant.** Référence : Stripe Atlas, Linear setup. Stepper 4-5 étapes : organisation, équipe, premier chauffeur, premier patient test, première course test. Chaque étape est un drawer ou modal, peut être skippée et reprise plus tard.

**Portail RGPD UI.** Référence : ROPA UI existante Phase 1.5 à reprendre. Tables denses + drawers édition. Pas de réinvention, juste rebrancher sur le shell 03-C.

**Exports patient.** Référence : Stripe data export, Notion export. Modal lance la génération asynchrone, email avec lien quand prêt, expiration 24h.

### Critère de fin

- Conformité RGPD : audit interne checklist CNIL passé sans red flag
- HDS : accord signé Supabase, mention dans CGU
- OR-Tools : suggestion sur 20 journées chauffeur réelles avec gain moyen ≥ 10% temps trajet
- Dashboard dirigeant : 5 KPIs calculés et stables, temps de chargement < 1.5s
- Onboarding dirigeant : un nouvel utilisateur (sans aide externe) configure son organisation et crée sa première course en moins de 15 min
- Prêt à signer un premier contrat commercial

### Playbook prompts

Plus long, allouer 15-20 jours ouvrés.

- **06-A** : audit RGPD + checklist CNIL + réactivation des migrations Phase 1.5 gelées
- **06-B** : portail RGPD UI (ROPA + DPIA + exports + droit oubli)
- **06-C** : Edge Function OR-Tools + tests sur dataset démo
- **06-D** : UI suggestion OR-Tools avec diff visuel
- **06-E** : dashboard dirigeant (KPIs + graphiques)
- **06-F** : invitations équipe + paramétrage organization
- **06-G** : génération PDF facturation B2B CGSS + envoi email
- **06-H** : onboarding dirigeant stepper
- **06-I** : E2E commercial complet + SUMMARY + go/no-go signature

9 prompts.

### Risques

- OR-Tools en Edge Function : limites de mémoire Supabase Edge (Deno runtime, 256 Mo). Si trop juste, sortir en service Node externe (Railway, Fly.io).
- HDS Supabase : vérifier que l'avenant est bien signable côté plan Supabase actuel ou s'il faut un upgrade.
- Coût total run mensuel à scale : à estimer dès cette passe (Supabase + Vercel + SMS + email + OR-Tools compute).

---

## 4. Après la Passe 4

Le SaaS est commercialisable. Trois directions possibles selon les premiers retours marché :

**Direction A — Verticalisation 974.** Devenir LA référence transport patient à La Réunion (Mayotte, Maurice en V+). Partenariats CGSS, marketing local, conformité documentation 974 spécifique.

**Direction B — Élargissement métropole.** Adaptation aux régimes CPAM métropole, marketing national, scaling Supabase + équipe support.

**Direction C — Adjacences.** TPMR scolaire, transport sanitaire enfants handicapés, transport personnes âgées non-conventionné. Mêmes mécaniques métier, public différent.

Pas de décision avant Passe 4 livrée + 3-6 mois d'usage réel sur les premiers clients.

---

## 5. Calendrier indicatif

Hypothèse : 1 prompt par jour ouvré, validation entre chaque, règle de la nuit appliquée.

- **Passe 1** : 6 prompts → 8 jours calendaires (mai 2026, en cours)
- **Passe 2** : 7 prompts → 12 jours calendaires (juin 2026)
- **Passe 3** : 6 prompts → 12 jours calendaires (juillet 2026)
- **Passe 4** : 9 prompts → 20 jours calendaires (août-septembre 2026)

Total estimatif : **fin septembre 2026** pour un SaaS commercialisable. Marges pour aléas + tests utilisateur + corrections : ajouter 30% → **fin octobre 2026**.

Premiers contrats commerciaux envisageables : **novembre-décembre 2026**.

---

## 6. À actualiser en fin de Passe 1

Ce document est une planification au démarrage. À relire après livraison Passe 1 pour :
- Ajuster les périmètres selon ce qui aura été appris
- Réviser les estimations temps (Passe 1 = baseline)
- Vérifier que les références visuelles restent pertinentes
- Identifier les patterns réutilisables livrés en Passe 1 (composants UI, helpers, etc.)

Une révision similaire à chaque fin de passe.

---

**Fin du brief passes 2-4.**
