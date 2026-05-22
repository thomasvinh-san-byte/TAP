---
description: Compacte STATE.md — archive l'historique verbeux dans STATE-HISTORY.md, garde le statut courant lisible.
---

Compacte `.planning/STATE.md` pour réduire la taxe de contexte, sans rien perdre :

1. Garde dans le frontmatter : `status`, `stopped_at`, `last_updated`, et
   `last_activity` réduit à la SEULE dernière entrée (la plus récente).
2. Déplace toutes les entrées « Précédent : … » accumulées vers
   `.planning/STATE-HISTORY.md` (append, ordre antéchronologique conservé), sous
   un en-tête horodaté.
3. Laisse un pointeur dans `last_activity` :
   « Historique complet : .planning/STATE-HISTORY.md ».
4. Vérifie que « Current Position » et « Phases à venir » du corps reflètent l'état
   réel (phase livrée la plus récente, prochaines phases).
5. Ne touche à AUCUN compteur de `progress:` ni à l'historique des phases livrées.

But : STATE.md reste la photo de l'instant ; l'historique vit à part.
