# ADR-007 — Stratégie de versions de la stack (Next.js / React)

- **Statut** : Accepté
- **Date** : 2026-05-22
- **Remplace** : aucun ADR antérieur
- **Affecte** : socle `apps/web` (Next.js, React), Phase 06.9, DEC-076

## Contexte

Le socle front est en **Next.js 14.2 / React 18**. Trois faits cadrent la
décision :

1. **Sécurité.** L'avis de sécurité Next.js du 11 décembre 2025 impose, pour
   tout projet 13.3+ / 14.x, de passer à la dernière 14.2.x corrigée
   (14.2.35) — CVE de déni de service (CVE-2025-55184 + correctif
   CVE-2025-67779) et d'exposition de code source des Server Functions
   (CVE-2025-55183). Le RCE critique (CVE-2025-66478) ne touche pas la 14.x
   stable.
2. **Next.js 15 est stable** et apporte des changements de comportement
   structurants — notamment la **rupture du cache `fetch()`** : Next 15 ne met
   plus les requêtes `fetch()` en cache par défaut. La montée 14 → 15 n'est
   donc pas un simple bump : elle exige un audit ciblé.
3. **Next.js 16 existe déjà** et **React 19** est disponible — mais aucun
   besoin produit ne les requiert à ce stade.

Le projet est en **bêta fonctionnelle** : l'objectif est de livrer de la
valeur visible sans bloquer sur l'hébergement. La montée Next 15 n'a pas à
s'accrocher à la migration HDS comme jalon — c'est un travail technique
autonome, plus simple à mener maintenant (bêta) qu'en production.

## Décision

1. **Patch de sécurité immédiat** : `next` → **14.2.35** (dernière 14.2.x
   corrigée). Patch de version, React 18 conservé, aucune rupture attendue.
2. **Montée Next 15 en phase autonome** : la montée 14 → 15 devient la
   **Phase 06.9 (Modernisation Next.js 15)**, faisable en bêta, indépendante
   de HDS. Elle inclut l'**audit de la rupture du cache `fetch()`** — chaque
   appel `fetch()` est audité pour rétablir explicitement le cache /
   `revalidate` là où le comportement implicite était attendu — et le passage
   à Turbopack dev stable.
3. **React 19 et Next 16 différés** : on reste sur **React 18** tant qu'aucun
   besoin produit ne le requiert. La montée se fera dans une phase ultérieure
   dédiée, quand elle deviendra nécessaire — pas par anticipation.

## Conséquences

**Positives :**

- Les CVE de décembre 2025 sont fermées immédiatement par un simple patch de
  version, sans risque de rupture.
- La montée Next 15, isolée en Phase 06.9, peut être menée et vérifiée
  tranquillement en bêta — l'audit du cache `fetch()` est un travail ciblé,
  bien plus sûr hors production.
- La stack ne court pas après chaque version majeure : React 18 reste tant
  qu'il suffit, ce qui évite une dette de migration subie.

**Négatives / points de vigilance :**

- À la montée 15, l'audit du cache `fetch()` est obligatoire : un appel laissé
  en cache implicite changerait de comportement silencieusement.
- Rester sur React 18 implique de surveiller la fenêtre de support des
  dépendances qui adopteraient React 19 ; réévaluer si une dépendance clé
  l'exige.

## Référence

Cet ADR matérialise la décision **DEC-076** (modernisation Next 15 autonome,
avant production). Voir aussi `.planning/ROADMAP.md` (Phase 06.9) et le patch
de sécurité 14.2.35 (CVE de décembre 2025).
