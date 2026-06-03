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
