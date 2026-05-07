---
title: Politique de confidentialité
version: 2026-05-08
effective_at: 2026-05-15
---

# Politique de confidentialité

<LastUpdated date="2026-05-08" />

## 1. Préambule

Le Service TAP Régulation traite des données à caractère personnel, dont des données de santé, dans le strict respect du Règlement Général sur la Protection des Données (RGPD), de la Loi Informatique et Libertés modifiée et du Référentiel CNIL relatif aux traitements de données mis en œuvre dans le cadre de la prise en charge de patients (juillet 2024).

## 2. Responsable de traitement et sous-traitants

- **Responsable de traitement** : la Société cliente utilisatrice du Service.
- **Sous-traitants** : l'éditeur du Service au titre de l'article 28 du RGPD, ainsi que l'hébergeur Supabase (Data Processing Agreement signé). La liste complète des sous-traitants est tenue à jour dans le registre des traitements.

## 3. Finalités du traitement

Les finalités sont : la régulation des transports sanitaires, la facturation auprès de la CGSS et des donneurs d'ordres, la communication avec les patients et les professionnels de santé, le pilotage de l'activité, la conformité réglementaire.

## 4. Bases légales

- **Exécution d'un contrat** (art. 6.1.b RGPD) pour la régulation des courses.
- **Obligation légale** (art. 6.1.c) pour la facturation CGSS et la conservation des pièces comptables.
- **Consentement explicite** (art. 9.2.a) pour l'envoi de SMS aux patients.
- **Sauvegarde des intérêts vitaux** (art. 6.1.d) en cas d'urgence médicale.

## 5. Catégories de données

- Identité (nom, prénom, date de naissance, NIR chiffré).
- Coordonnées (adresse, téléphone, email).
- Données de santé strictement nécessaires à la prise en charge (prescriptions, codes pathologie ALD, contraintes mobilité).
- Données opérationnelles (préférences, incidents, notes régulateur).
- Données financières (encaissements directs, références CGSS).

## 6. Destinataires

Les données sont accessibles aux personnels habilités de la Société cliente, à la CGSS et aux organismes complémentaires pour la facturation, et aux donneurs d'ordres pour les courses qui leur sont rattachées.

## 7. Durées de conservation

- **Pièces comptables** : 5 ans (CSS L114-19, Code de commerce L123-22).
- **Dossier patient** : conformément aux durées de conservation médicales applicables.
- **Géolocalisation chauffeur en service** : 90 jours en base chaude, agrégation puis purge automatique.
- **Audit logs** : 5 ans.

## 8. Sécurité

- Chiffrement applicatif AES-256-GCM des données sensibles (NIR, notes médicales).
- TLS 1.3 minimum pour les communications.
- Row Level Security PostgreSQL forcée sur l'ensemble des tables métier.
- Authentification multi-facteurs disponible pour les rôles dirigeant et régulateur.
- Journalisation complète des accès et mutations sensibles.

## 9. Vos droits

Conformément aux articles 15 à 21 du RGPD, vous disposez de droits d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition. Vous pouvez les exercer auprès du délégué à la protection des données ([Contact DPO](/legal/dpo)) ou par le portail dédié.

Le droit d'effacement (art. 17) est réalisé par anonymisation lorsque la conservation des courses est imposée par la CGSS pour des durées légales.

## 10. Recours

Vous disposez du droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (cnil.fr).

## 11. Mise à jour

La présente politique peut évoluer. Toute modification substantielle est notifiée aux utilisateurs et aux personnes concernées.
