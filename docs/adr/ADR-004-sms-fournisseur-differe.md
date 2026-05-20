# ADR-004 — Fournisseur SMS différé + adaptateur pluggable

- **Statut** : Accepté
- **Date** : 2026-05-20
- **Auteur** : Guillaume
- **Remplace** : aucun ADR antérieur
- **Affecte** : DEC-003 (précision stack SMS), Phase 05 (cron SMS j1/j2h), `packages/sms`

## Contexte

La Phase 05 a livré les rappels SMS patients (J-1 et J-2h) : `packages/sms`
(adaptateur Twilio + moteur de templates Mustache + vérification du
consentement), 3 Route Handlers (`/api/cron/sms-reminders-j1`, `-j2h`,
`/api/sms/webhook/twilio`), une UI admin `/admin/sms-templates`, les tables
`sms_messages` / `sms_templates`, et 2 jobs `pg_cron` déclencheurs.

Le SMS est un **canal pertinent** pour la population cible (patients
dialysés 974, souvent âgés, peu connectés) : taux d'ouverture ~95 %, pas
de compte ni d'application à installer côté patient.

**Mais le fournisseur retenu en Phase 05 — Twilio — pose un problème de
conformité.** Twilio est une société américaine soumise au CLOUD Act :
les données transitant par ses serveurs (numéro de téléphone du patient,
contenu du SMS révélant un transport médical récurrent) sont des
**données de santé indirectes**. Ce couplage est inadapté à un SaaS de
transport sanitaire visant un hébergement HDS (CON-001, trajectoire
HDS Phase 06).

Les canaux alternatifs ont été écartés :
- **Email** : mauvais canal pour cette population (faible adoption,
  nécessite aussi une adresse + un compte), taux d'ouverture bien
  inférieur au SMS.
- **Push PWA** : les patients n'installent pas l'application TAP (réservée
  régulatrice/chauffeur).

Tout canal sortant patient exige donc soit un **compte fournisseur**
(coût, contrat, conformité), soit du **matériel** (RaspiSMS = serveur +
téléphone Android dédié 24/7). Aucune option « gratuite et immédiate »
n'existe.

Point important : **le SMS ne bloque rien dans TAP.** C'est une couche
d'amélioration optionnelle — la régulatrice peut rappeler les patients
manuellement comme aujourd'hui.

## Décision

1. **Différer le choix du fournisseur SMS.** Aucun fournisseur n'est
   intégré en V1.5.
2. **Mettre les cron SMS en pause.** Les 2 jobs `pg_cron` sont supprimés
   du scheduler (`cron.unschedule`) et la mise en pause est actée dans le
   repo par une migration idempotente (`20260524000001_unschedule_sms_cron`).
3. **Conserver `packages/sms`, les Route Handlers et l'UI dormants.** Zéro
   coût, zéro trafic, intégralement réutilisables au rebranchement.
4. **Cible privilégiée : une API SMS française HDS** — smsmode
   (ISO 27001, hébergement HDS), Octopush, ou OVH SMS — cohérente avec la
   trajectoire HDS Phase 06. **Plan B :** RaspiSMS auto-hébergé si un coût
   nul par SMS devient prioritaire (au prix d'un serveur + téléphone
   dédiés).
5. **Adaptateur pluggable.** Le seul point de couplage fournisseur est
   `packages/sms/src/twilio-adapter.ts`. Changer de fournisseur = réécrire
   ce seul fichier (à terme renommé `sms-adapter.ts`). Le moteur de
   templates, la vérification du consentement (DEC-008), le tracking
   `sms_messages` et l'UI restent inchangés.

## Conséquences

**Positives :**
- Aucun compte ni coût fournisseur tiers engagé prématurément.
- Aucune dépendance à un fournisseur soumis au CLOUD Act pour des données
  de santé.
- Décision reportée **sans dette technique** : le code livré Phase 05
  reste compilable, déployable, dormant.

**Négatives :**
- Pas de rappel SMS automatique en production V1.5. Acceptable : la
  régulatrice assure le rappel manuellement, comme avant TAP.

**Neutres :**
- DEC-003 (stack figée) mentionnait déjà « Twilio **ou** OVH SMS Pro » —
  Twilio n'a jamais été une dépendance dure exclusive. DEC-062 **précise**
  cette ligne, ce n'est **pas une révision** de DEC-003.

## Réactivation

Au choix d'un fournisseur : réécrire `twilio-adapter.ts`, recréer les
`cron.schedule` (migration neuve, modèle `20260519000007`), brancher le
webhook de delivery du fournisseur, reconfigurer les pré-requis runtime
(token cron, env vars). Le secret Vault `cron_app_token` n'a jamais été
créé — inutile tant que le SMS est différé, à générer au rebranchement.
