# CONCERNS — TAP

Garde-fous transverses et side-quests opportunistes — à appliquer dans toute PR touchant aux fichiers concernés.

## D4-a — Audit casts `as TYPE[]` (side-quest opportuniste, Phase 06.11+)

**Origine** : Dette D4 identifiée en clôture Phase 06.7, reclassifiée Phase 06.10 comme différée. Décision dirigeant 2026-06-03 (DEC-086) : traitement en side-quest opportuniste plutôt qu'en phase dédiée.

**Règle pour Claude Code** : lors de toute modification d'un fichier qui contient un cast `as TYPE[]` (typiquement sur résultat Supabase), vérifier si :

1. Les types générés depuis Supabase (`packages/database/types.ts` après `pnpm --filter @tap/database generate`) couvrent maintenant ce cas → supprimer le cast.
2. Le cast peut être remplacé par un type explicite déclaré au-dessus → préférer la déclaration explicite.
3. Le cast est nécessaire et justifié → ajouter un commentaire `// eslint-disable-next-line — cast nécessaire car X` pour documenter la raison.

**Pas obligatoire** : si le fichier est complexe et l'audit demande > 15 min, laisser tel quel et signaler dans la PR `Concerns: D4-a non audité dans ce fichier (effort > 15 min)`.

**Tracking** : aucun tracking formel. Disparition progressive attendue sur 3-6 mois au rythme des PR.

## Captures showcase historiques manquantes (Phase 06.11 Wave 3 → side-quest)

**Origine** : audit Claude-chat 2026-06-03 lors du cadrage Wave 3 Phase 06.11. La convention `docs/showcase/` impose un dossier par phase livrée avec captures (cf. `CLAUDE.md` §13.5 « Visible Progress Mandate »). Plusieurs dossiers existent mais sont vides à l'issue de leur phase. Couvrir toutes ces phases en Wave 3 = scope trop large (10+ phases, 30+ captures), donc inscription en dette à traiter en side-quest opportuniste.

**Phases avec dossier showcase vide ou incomplet** (état au 2026-06-03) :

- `01-referentiel-patients/`
- `01.5-dpa-rgpd-compliance/`
- `02-saisie-express-course/`
- `03-e2e-passe1-squelette/`
- `04-onboarding-chauffeur-authshell/`
- `04.5-robustesse-regulateur/`
- `04.7-pricing-mockup-caisse/`
- `04.9-pwa-chauffeur-enveloppe/`
- `05.5-pricing-cgss-reel/`
- `06.6-conformite-assistee/`
- `06.7-or-tools-optimisation-de-tournees/`
- `06.8-tableau-bord-dirigeant/`

**Phases manquant le dossier complet** :

- Phase 05 (cockpit Realtime + récurrence + SMS + no-show)
- Phase 06 (facturation CGSS PDF)

**Règle pour Claude Code** : lors de toute PR future qui touche une fonctionnalité d'une de ces phases (par exemple un fix bug sur le cockpit Realtime), **profiter de l'opportunité pour capturer 1-2 écrans** de cette phase et les déposer dans le dossier showcase correspondant. Critère effort : < 30 min pour les captures les plus accessibles, sinon laisser pour PR ultérieure.

**Pas obligatoire** : si effort > 30 min, signaler en `Concerns: captures showcase Phase X non capturées (effort > 30 min)`.

**Tracking** : aucun. Disparition progressive attendue sur 2-4 mois selon rythme PR.
