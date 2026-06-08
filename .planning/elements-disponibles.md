# Éléments disponibles — ce qui est débloquable SANS achat ni délibération

Passage du registre des travaux repoussés au crible du code réel. Objectif : séparer
ce qui est VRAIMENT bloqué (achat/info externe/HDS) de ce qui est DÉJÀ FAISABLE avec
les briques en place (gratuites). Vérifié code 2026-06-08.

## Briques déjà présentes et gratuites (réutilisables)
| Brique | État | Sert à débloquer |
|--------|------|------------------|
| **pg_cron** | utilisé (breach-72h, sms, etc.) | alertes planifiées, jobs récurrents |
| **Supabase Realtime** | utilisé (cockpit rides/alerts/positions) | messagerie interne chat, temps réel |
| **@react-pdf/renderer** + `lib/pdf/pdf-template.tsx` | utilisé (3 exports PDF + template charté) | exports PDF récap (§5.23) |
| **lib/csv.ts** (toCsv, escapeCsv, formatEurFr) | utilisé (export caisse) | exports CSV courses/stats (§5.23) |
| **Service worker PWA** (`sw-register`) | enregistré | base pour push web (VAPID à ajouter) |
| **Supabase Storage** | configuré (config.toml) | upload docs NON-santé |

## Requalification du registre

### ✅ DÉBLOCABLE MAINTENANT (aucun achat, aucune info externe)
- **Exports CSV courses + statistiques (§5.23)** : `lib/csv.ts` + modèle exportCaisse
  déjà là. Zéro dépendance. → lot fonctionnel immédiat. (Distinct de Lomaco, qui lui
  attend le format.)
- **Exports PDF récap par chauffeur/période (§5.23)** : `pdf-template.tsx` + react-pdf
  déjà là. → lot fonctionnel immédiat.
- **Messagerie interne CHAT in-app (§5.22, partie chat)** : Supabase Realtime déjà
  maîtrisé (pattern channel cockpit). Une table `internal_message` + un fil de
  discussion régul↔chauffeur en temps réel = FAISABLE sans rien acheter. Le SMS/
  WhatsApp est explicitement EXCLU par le CdC en interne (push web only) — donc le
  chat in-app couvre le cœur du besoin.

### 🟡 PARTIELLEMENT débloquable (cœur faisable, frange repoussée)
- **Messagerie — notifications PUSH hors-app (§5.22)** : le service worker existe ;
  il manque VAPID (génération de clés, pas un achat — gratuit) + stockage des
  subscriptions + endpoint push. C'est du DEV, pas une dépense. Faisable, mais c'est
  un branchement → à faire APRÈS le chat in-app (qui, lui, ne dépend de rien).
- **Pièce jointe photo dans le chat (§5.22)** : Supabase Storage existe pour des
  fichiers ; MAIS une photo d'incident peut contenir des données sensibles → prudence
  HDS. Le texte du chat d'abord, la photo quand le stockage conforme est tranché.

### 🔴 RESTE BLOQUÉ (achat / info externe / HDS — inchangé)
- **Export Lomaco** : attend le FORMAT (info externe design partner). Inchangé.
- **Export FEC** : attend la délibération (besoin réel ?). Inchangé.
- **Upload scans bons de transport / docs conformité** : données santé → HDS. Le
  champ `document_url` est prêt (nullable), le branchement attend le bucket HDS.
- **Géoloc réelle, OSRM, télétransmission CGSS, facturation native, HDS** : inchangé
  (verrou HDS / agrément / business).
- **Email transactionnel** : provider à choisir/payer. Inchangé (in-app suffit).
- **Téléphonie CTI, natif mobile, ambulance/VSL, métropole, paie, OCR, vocal** :
  inchangé (V2/V3, achat ou business case).

## Reco — prochains lots SANS rien débloquer d'externe
Trois fonctionnalités du CdC sont livrables tout de suite avec l'existant, à plus
fort ratio valeur/effort :
1. **Exports CSV courses + stats** (§5.23) — quick win, autonome.
2. **Exports PDF récap** (§5.23) — autonome, template prêt.
3. **Messagerie interne chat in-app** (§5.22) — Realtime maîtrisé ; cœur du besoin,
   push/photo en frange ultérieure.

Le header (incarnation, prompt déjà prêt) reste un quick win visuel en parallèle.

## Refs
registre-travaux-repousses.md ; code : lib/csv.ts, lib/pdf/pdf-template.tsx,
use-cockpit-rides.ts (Realtime), sw-register.client.ts, supabase/config.toml.
