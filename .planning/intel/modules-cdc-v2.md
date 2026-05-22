# Catalogue des modules fonctionnels — CDC v2 (chapitre 5)

> Référentiel des **24 modules** du cahier des charges v2, extrait du CDC source
> (`cahier_des_charges_saas_tap_v2.docx`) pour servir de base d'audit de couverture
> versionnée. Chaque module porte son numéro CDC, son intitulé et un résumé.
> Statut de couverture (livré / phasé / reporté / angle mort) renseigné par l'audit,
> pas par ce catalogue. Source de vérité des intitulés : CDC v2 § 5.1 à 5.24.

| Module | Intitulé | Résumé (CDC) |
|---|---|---|
| 5.1 | Authentification et multi-tenant | Le SaaS héberge plusieurs organisations clientes étanches entre elles. Toutes les données sont strictement cloisonnées par organisation via Row Level |
| 5.2 | Gestion des patients | Référentiel des patients de l'organisation. Un patient est strictement rattaché à un seul tenant. La fiche patient capitalise la mémoire métier dans l |
| 5.3 | Gestion des prescriptions (bons de transport) | Toute course conventionnée doit être justifiée par une prescription médicale. Le bon de transport est scanné, archivé et consommé course après course. |
| 5.4 | Référentiel prescripteurs | Référentiel des médecins, établissements et praticiens à l'origine des prescriptions de transport. Permet de structurer les contacts et d'analyser la |
| 5.5 | Donneurs d'ordres B2B (hôpitaux, cliniques, EHPAD) | Distincts des prescripteurs : ce sont les entités qui passent commande d'un transport pour un de leurs patients ou résidents. Ils peuvent avoir des co |
| 5.6 | Gestion des chauffeurs | Référentiel chauffeurs avec suivi réglementaire. Le chauffeur dispose d'un accès à l'application mobile pour sa propre tournée. Identité : nom, prénom |
| 5.7 | Gestion des véhicules | Fiche véhicule : immatriculation, marque, modèle, année, date de mise en circulation. Type : taxi conventionné, TAP. Capacité : nombre de places assis |
| 5.8 | Saisie de course en mode express (appel entrant) | Si intégration téléphonie (V1.5) : remontée automatique de la fiche patient si numéro reconnu. Sinon : recherche par numéro, nom, prénom à 1 ou 2 cara |
| 5.9 | Courses récurrentes | Modèle de course récurrente associé à un patient. Schéma de récurrence : hebdomadaire (jours de la semaine cochés), bi-hebdomadaire, mensuelle, périod |
| 5.10 | Gestion des courses | Patient avec recherche instantanée. Donneur d'ordres si applicable. Adresse de départ et destination avec géocodage. Heure de RDV à destination et heu |
| 5.11 | Optimisation et mutualisation | Cœur de la valeur ajoutée du SaaS. Le moteur d'optimisation analyse le portefeuille de courses planifiées et propose des regroupements maximisant la m |
| 5.12 | Tournées et planning | Une tournée est l'agrégation des courses attribuées à un chauffeur sur une journée donnée. Le planning visuel constitue l'écran central du régulateur. |
| 5.13 | Cockpit régulateur temps réel | Vue spécifique régulateur, distincte du tableau de bord dirigeant. Affichage permanent des indicateurs critiques temps réel. Nombre de courses planifi |
| 5.14 | Gestion des imprévus temps réel | Le chauffeur appuie sur « Patient absent » via PWA. Workflow déclenché : appel automatique au patient (proposé), attente N minutes, signalement régula |
| 5.15 | Communication patient automatisée | Confirmation J-1 : « Bonjour Mme [nom patient], votre transport pour dialyse est confirmé demain à 13h30. Chauffeur : [prénom chauffeur]. Confirmez en répondant OUI. » |
| 5.16 | Application chauffeur (PWA) | Application web progressive installable sur smartphone, sans passer par les stores. Conçue pour être utilisée à une main, en environnement urbain ou r |
| 5.17 | Géolocalisation temps réel | Capture GPS via API navigateur de la PWA chauffeur. Écriture toutes les 30 secondes en service actif, toutes les 2 min en attente. Affichage temps rée |
| 5.18 | Tarification et facturation | Application de la grille active à la date de la course. Calcul du forfait, des km en charge, des km à vide majorés. Application des majorations nuit, |
| 5.19 | Caisse et paiements directs | Saisie d'un encaissement à la course par le chauffeur (PWA) ou le régulateur (web). Modes de paiement : espèces, CB, chèque, virement, mixte. Saisie d |
| 5.20 | Pilotage et KPIs (vue dirigeant) | CA prévisionnel jour, semaine, mois, année. CA réalisé sur les mêmes périodes. Écart prévisionnel vs réalisé. Nombre de courses jour, semaine, mois. P |
| 5.21 | Conformité réglementaire | Carte professionnelle chauffeur. Visite médicale d'aptitude conducteur. Formation continue chauffeur. Contrôle technique véhicule. Visite annuelle tax |
| 5.22 | Messagerie interne et notifications | Messagerie temps réel régulateur ↔ chauffeur (chat à la course ou général). Possibilité d'attacher une photo (incident, document). Notifications push |
| 5.23 | Exports et intégrations | Export comptable mensuel (FEC ou CSV). Export facturation Lomaco (CSV pré-formaté). Export caisse (rapport journalier, périodique). Export statistique |
| 5.24 | Mode dégradé et continuité d'activité | Le SaaS est outil critique au quotidien. En cas d'indisponibilité partielle ou totale, des mécanismes de continuité doivent permettre à l'activité de |

**Total : 24 modules.** Les 9 modules critiques (CLAUDE.md § 2) sont détaillés
dans `requirements.md` ; ce catalogue couvre l'intégralité des 24 pour l'audit.

> Note de neutralité (NFR-001) : l'exemple de SMS du module 5.15 contenait deux
> noms propres dans le CDC source ; ils sont remplacés ici par des placeholders
> (`[nom patient]`, `[prénom chauffeur]`) conformément à la règle transverse de
> neutralité du dépôt. Le sens de l'exemple est inchangé.
