---
description: Audite une phase GSD livrée via le subagent auditor (lecture seule, post-merge).
argument-hint: <numéro de phase, ex. 06.8>
---

Utilise le subagent `auditor` pour auditer la phase **$ARGUMENTS** qui vient d'être
mergée. Périmètre à lui donner :

- Phase auditée : $ARGUMENTS
- Sync `main`, vérifie les livrables réels, puis build / typecheck / lint / format verts.
- Cohérence des chiffres (réutilisation des helpers caisse/facturation), carte
  conformité factuelle (jamais de verdict), NFR-001, RLS + guards si la phase
  touche une table.
- Traçabilité : tout amendement d'un DEC LOCKED documenté des deux côtés dans PROJECT.md.
- Clôture : ROADMAP `[x]`, item CONCERNS résolu/reporté, STATE à jour.

Rends le verdict en tableau (✅ / ⚠️ / ❌) et liste ce qui reste à valider en
preview par l'humain. Ne modifie aucun fichier.
