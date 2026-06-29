# Migration des secrets et de la configuration vers OVH HDS

> Document opérationnel interne (équipe dev). Recense chaque variable
> d'environnement et secret de TAP, son origine actuelle (secrets Vercel /
> Supabase Cloud) et sa cible lors de la bascule vers OVH HDS. Sert de
> check-list le jour de la migration : rien oublié, rien laissé chez un acteur
> non souverain. État du code : `origin/main` après les lots OVH-01 à OVH-05.
> Clôt la série « portes de sortie » (OVH-06).
>
> Ce document ne déclenche aucune migration : il prépare le terrain. La bascule
> réelle se fera au premier client HDS.

---

## 1. Principe

À la migration, les secrets ne se « déplacent » pas par copier-coller : ils se
**régénèrent** dans le nouveau coffre (rotation à l'occasion de la bascule, bonne
pratique de sécurité), sauf ceux dont la rotation casse une cohérence métier
(signalés ci-dessous). Trois coffres cibles :

- **Secret store de l'hébergeur OVH** (variables d'environnement du conteneur front
  et des services) — remplace les « secrets Vercel ».
- **Supabase Vault** (dans la stack self-hosted) — pour les secrets lus côté base
  (`cron_app_token`).
- **Secret store des Edge Functions** (runtime Deno de la stack self-hosted) — pour
  les clés NIR lues par `Deno.env.get`.

Règle d'or déjà respectée par le projet : les secrets serveur ne sont JAMAIS
préfixés `NEXT_PUBLIC_`, jamais commités. Ce document ne fait que tracer leur
cible.

---

## 2. Classification : public vs secret

**Variables publiques** (préfixe `NEXT_PUBLIC_`, inlinées dans le bundle client —
ce ne sont PAS des secrets, mais elles doivent être posées au build/déploiement) :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`NEXT_PUBLIC_NIR_CHECKSUM_STRICT`, `NEXT_PUBLIC_CGU_VERSION`,
`NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS`.

Note : `NEXT_PUBLIC_VERCEL_ENV` n'est plus à poser — remplacé par
`NEXT_PUBLIC_APP_ENV` (OVH-02), avec repli automatique.

**Secrets serveur** (jamais exposés au client) : voir tableau §3.

---

## 3. Tableau de migration des secrets serveur

| Secret | Rôle | Origine actuelle | Cible OVH | Rotation à la bascule ? |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Accès admin DB (server actions) | Secrets Vercel | Secret store OVH | Oui (régénéré par la stack self-hosted) |
| `DATABASE_URL` | Connexion Postgres directe (setup) | (neutre, OVH-05) | Secret store OVH | N/A (URL de la base OVH) |
| `APP_NIR_ENCRYPTION_KEY` | Chiffrement NIR (AES-256) | Secret store Supabase | Secret store Edge Functions | **NON — voir §5** |
| `APP_NIR_SEARCH_KEY` | Hash recherche NIR (HMAC) | Secret store Supabase | Secret store Edge Functions | **NON — voir §5** |
| `APP_LEGAL_TOKEN_SECRET` | Signature JWT portail patient (HS256) | Secrets Vercel | Secret store OVH | Possible (invalide les tokens en cours, validité 30 j) |
| `APP_ANONYMIZATION_SALT` | Hash NIR anonymisation (art. 17 RGPD) | Secrets Vercel | Secret store OVH | **NON — voir §5** |
| `CRON_APP_TOKEN` | Auth des Route Handlers cron | Secrets Vercel | Secret store OVH **+ Supabase Vault** | Oui (régénérer aux deux endroits, cohérents) |
| `VAPID_PRIVATE_KEY` | Web Push PWA chauffeur | Secrets Vercel | Secret store OVH | **NON — voir §5** |
| `VAPID_SUBJECT` | Contact Web Push | Secrets Vercel | Secret store OVH | Oui (non sensible) |
| `SENTRY_DSN` | Monitoring serveur | Secrets Vercel | Secret store OVH (cf. §6) | Selon décision Sentry |
| `SENTRY_AUTH_TOKEN` | Upload source maps (CI) | Secrets Vercel / CI | Secret CI | Oui |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS (provider actuel) | Secrets Vercel | **À remplacer** par le provider souverain (cf. §7) | Sans objet |
| `APP_ENCRYPTION_KEY` | Chiffrement applicatif (déclaré `.env.example`) | Secrets Vercel | Secret store OVH | À vérifier : non consommé dans le code TS actuel — confirmer son usage réel (Edge/SQL) avant migration |

---

## 4. Les trois coffres, en détail

### 4.1 Secret store OVH (conteneur front + services)

Reçoit tous les secrets serveur « applicatifs » (service role, token légal, salt,
VAPID, cron token, Sentry). Posés comme variables d'environnement du conteneur
(`docker run --env-file` ou secrets de l'orchestrateur). Ne JAMAIS les mettre dans
l'image ni dans le dépôt. Le `.dockerignore` (OVH-01) exclut déjà `**/.env*` sauf
`.env.example`.

### 4.2 Supabase Vault (stack self-hosted)

Un seul secret y vit aujourd'hui : `cron_app_token`, lu côté base par
`vault.decrypted_secrets` pour authentifier les appels `pg_net` vers les Route
Handlers cron. À la migration :
- Monter le service Vault dans la stack self-hosted (vérifier qu'il est présent).
- Recréer le secret : `select vault.create_secret('<token-32-chars>', 'cron_app_token');`
- La valeur doit être **identique** à `CRON_APP_TOKEN` posé côté OVH (sinon les
  Route Handlers répondent 401 — comportement attendu si incohérent).

### 4.3 Secret store des Edge Functions (runtime Deno)

L'Edge Function NIR (`supabase/functions/nir/`) lit ses clés via `Deno.env.get` :
`APP_NIR_ENCRYPTION_KEY`, `APP_NIR_SEARCH_KEY` (chiffrement/hash NIR), plus
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (auth + audit). Ces
clés vivent dans le secret store des Edge Functions de la stack self-hosted, distinct
du secret store applicatif. Vérifier que le runtime Deno self-hosted les expose bien.

---

## 5. Secrets à NE PAS faire tourner (cohérence métier)

Régénérer ces secrets casserait des données existantes. À **migrer à l'identique**
(transfert sécurisé de la valeur, pas régénération) :

- **`APP_NIR_ENCRYPTION_KEY`** : les NIR déjà chiffrés en base ne seraient plus
  déchiffrables avec une nouvelle clé. Perte de données santé irréversible.
- **`APP_NIR_SEARCH_KEY`** : les hash de recherche NIR existants deviendraient
  incohérents — la recherche patient par NIR casserait.
- **`APP_ANONYMIZATION_SALT`** : les NIR anonymisés (art. 17 RGPD) ont été hashés
  avec ce salt ; le changer rendrait les hash incohérents et briserait l'unicité
  métier (le `.env.example` le documente déjà : « JAMAIS rotation sans plan
  migration »).
- **`VAPID_PRIVATE_KEY`** : changer la paire VAPID invalide les abonnements push
  existants des chauffeurs (ils devraient se réabonner). Tolérable mais à anticiper.

Procédure pour ces secrets : transfert chiffré de la valeur actuelle vers le coffre
OVH/Edge, sans passer par le dépôt ni un canal en clair.

---

## 6. Sentry — décision préalable à la migration

`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` pointent vers Sentry SaaS (US). Le code est
prudent (PII scrubbée, `sendDefaultPii: false`), et l'environnement est déjà découplé
de l'hébergeur (OVH-02 : `APP_ENV`). Reste à trancher AVANT la prod HDS (cf. audit) :
self-hosted, alternative souveraine (ex. GlitchTip), ou maintien documenté. La cible
du DSN dépend de cette décision — d'où la colonne « selon décision » au §3.

---

## 7. SMS — bascule du provider (rappel OVH-03)

Le dispatch est en place (`sms-adapter.ts`, défaut `twilio`). À la migration :
- Choisir le provider souverain (smsmode ISO 27001/27701, OVH SMS, ou Octopush —
  cf. ADR-004 et audit).
- Intégrer l'adapter souverain (remplacer le squelette fail-fast `sovereign-adapter.ts`).
- Poser `SMS_PROVIDER=sovereign` (ou la valeur retenue) + les secrets du provider
  dans le secret store OVH.
- Retirer les secrets Twilio.

---

## 8. Crons SMS — point hérité (ce qui remplace OVH-04)

OVH-04 (paramétrer l'URL des crons) **n'a pas été réalisé comme lot de code**, car le
problème est déjà neutralisé : les deux cron jobs SMS (`sms-reminder-j1`,
`sms-reminder-j2h`) qui portaient l'URL Vercel en dur sont **unscheduled** par la
migration `20260524000001_unschedule_sms_cron.sql` (fournisseur SMS différé, ADR-004).
L'URL Vercel en dur dans `20260519000007` est donc inerte.

**Règle pour la réactivation post-HDS** (au choix du provider SMS) : écrire une
**nouvelle migration** de réactivation qui recrée les `cron.schedule` en pointant
l'URL du domaine **OVH** (jamais une URL Vercel, jamais une URL en dur héritée). La
migration `024` documente déjà ce chemin. Idéalement, paramétrer l'URL via un réglage
de base (`current_setting`) posé à l'initialisation, pour ne plus jamais coder
d'URL en dur. Les autres crons (`breach-72h-watchdog`, purges) n'ont pas d'URL : ils
exécutent du SQL pur et fonctionnent dès que `pg_cron` est présent (inclus dans le
managé OVH).

Le webhook Twilio (`api/sms/webhook/twilio/route.ts`) utilise déjà
`NEXT_PUBLIC_APP_URL` (porte propre) ; seul un commentaire de doc mentionne l'ancienne
URL Vercel — sans incidence fonctionnelle.

---

## 9. Check-list de bascule (secrets & config)

1. **Secret store OVH** : poser les secrets serveur applicatifs (§3, colonne cible
   OVH), en régénérant ceux qui le tolèrent.
2. **Secrets à migrer à l'identique** (§5) : transfert chiffré, pas de régénération
   (clés NIR, salt anonymisation ; VAPID selon tolérance).
3. **Supabase Vault** : monter le service, recréer `cron_app_token` cohérent avec
   `CRON_APP_TOKEN`.
4. **Edge Functions** : poser `APP_NIR_ENCRYPTION_KEY`, `APP_NIR_SEARCH_KEY` + les
   clés Supabase dans le secret store Deno.
5. **Variables publiques** (`NEXT_PUBLIC_*`) : poser au build/déploiement du
   conteneur, dont `NEXT_PUBLIC_APP_ENV=production` et `NEXT_PUBLIC_APP_URL` = domaine
   OVH.
6. **`APP_ENV=production`** côté serveur (OVH-02).
7. **`DATABASE_URL`** = URL de la base managée OVH (OVH-05).
8. **`DEMO_SETUP_ENABLED`** : NE PAS poser en prod (init démo désactivée — OVH-05).
9. **Sentry** : poser le DSN selon la décision §6 (ou ne pas poser si retiré).
10. **SMS** : `SMS_PROVIDER` + secrets du provider souverain (§7) ; retirer Twilio.
11. **Vérifier** qu'aucun secret n'est resté chez un acteur non souverain, et
    qu'aucune valeur n'est dans le dépôt ou l'image Docker.

---

## 10. État des portes de sortie (récapitulatif série OVH-01..06)

| Lot | Objet | État |
|---|---|---|
| OVH-01 | Conteneurisation front (`output: standalone` + Dockerfile) | Mergé, audité |
| OVH-02 | Découplage environnement Sentry (`APP_ENV`) | Mergé, audité |
| OVH-03 | Adaptateur SMS pluggable (dispatch `SMS_PROVIDER`) | Mergé, audité |
| OVH-04 | URL crons paramétrée | Sans objet (crons unscheduled — voir §8) |
| OVH-05 | Découplage setup/welcome + toggle init démo | Mergé, audité |
| OVH-06 | Doc migration secrets (ce document) | Livré |

Le code est substantiellement découplé de Vercel et de Supabase Cloud. Les portes de
sortie sont ouvertes et inertes : la bascule réelle ne sera plus qu'une opération de
configuration (poser les variables, monter la stack, migrer les données), pas de
réécriture. Déclencheur : premier client HDS.

---

## 11. Sources internes

ADR-004 (SMS différé + abstraction), `.env.example` (contrat de config, documenté
secret par secret), migrations `20260519000007` (pg_net/pg_cron) et `20260524000001`
(unschedule), Edge Function `supabase/functions/nir/`, audit de couplage
(`audit-couplage-portes-sortie-ovh.md`), doc migration (`migration-ovh-hds.md`).
