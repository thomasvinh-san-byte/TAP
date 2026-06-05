# Horizon des solutions open source — partis pris UI & couleurs

Demande dirigeant : NE PAS calquer un site vitrine institutionnel (le site
departement974.fr est une vitrine grand public — bleu marine + accents rouge/
jaune communicants — ≠ outil de travail). Comparer plutôt de VRAIS outils métier
open source pour situer les bons partis pris. + cadrage chromatique chiffré
(RETEX 2026). Référence pour la direction artistique TAP.

## Pourquoi le site du Département n'est PAS la référence

Vitrine institutionnelle : héro animé, bandeaux événementiels (« 80 ans »),
illustrations, rouge/jaune d'attention, ton communication publique. Optimisé
pour visiteur occasionnel. TAP = outil 8h/jour pour pro. Catégorie différente.
On garde seulement la PARENTÉ (bleu institutionnel sérieux), pas les choix de com.

## Horizon — outils métier open source comparables

| Outil                    | Catégorie                       | Parti pris UI                                                                                                                                            | Couleur                                            |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Frappe CRM / ERPNext** | ERP/CRM métier dense            | Design system maison « Espresso » : « modernisme + minimalisme pour focus sur l'activité, sans distraction d'incohérences ». Vue-based, dense, formulaires/tables. | Neutre dominant + accent mesuré. Philosophie anti-distraction. |
| **Twenty CRM**           | CRM moderne                     | Inspiré Notion/Linear : near-monochrome, dense, raccourcis clavier, command-k.                                                                          | Quasi-monochrome, accent bleu sobre.               |
| **Cal.com**              | Scheduling                      | shadcn/Radix (= MÊME stack que TAP), neutre, focus contenu.                                                                                              | Neutre + 1 accent.                                 |
| **Fleetbase**            | Dispatch/flotte (proche métier TAP) | Console temps réel, cartes, tables denses, dashboard command-center.                                                                                  | Sombre/neutre opérationnel.                        |
| **Linear** (réf DEC-004) | Gestion projet                  | LE modèle densité+clarté, near-monochrome, opinionated.                                                                                                  | Near-monochrome + violet signature rare.           |

**Constat transversal** : les outils métier réussis sont **near-monochrome +
UNE couleur signature rare**. Aucun n'est « coloré ». Le minimalisme dense est
la norme du segment. → Conforte la direction TAP (sobre, une couleur signature).

## Cadrage chromatique chiffré (RETEX 2026) — directement applicable

**Psychologie des couleurs en contexte outil pro :**

- **Bleu marine/profond** (#0F172A–#1E293B) = sophistication, autorité, précision.
  Choix DOMINANT des SaaS denses (Linear, Vercel, Supabase en surface primaire).
  « Extrêmement efficace là où densité + lisibilité prolongée priment. »
  → VALIDE le bleu profond de TAP comme socle institutionnel.
- **Orange/terracotta** (#EA580C–#F97316) = énergie, urgence. « Peut sembler
  AGRESSIF ou BAS DE GAMME comme couleur PRIMAIRE dans un outil pro. Plus
  efficace en ACCENT ciblé sur fond neutre. »
  → CONFIRME : terracotta = accent rare (moment-clé), JAMAIS dominant. C'est
  précisément le piège « ringard » à éviter.
- **Neutre chaud** (#F5F0EB–#E8E0D5) = humain, réaction 2025-26 contre le blanc
  corporate froid ; réduit la fatigue oculaire (proche Notion).
  → VALIDE le tint crème de TAP comme parti pris de fond, pas gadget.

**Règles de structure (à inscrire dans les tokens) :**

- **60-30-10** : 60% dominante (fonds neutres), 30% secondaire (cartes, sidebar),
  10% accent (CTA, états actifs = le terracotta).
- **2-3 teintes actives max** à l'écran simultanément (au-delà = compétition).
- **Palette fonctionnelle** = 1-2 primaires + 1 accent + échelle neutre 6-10
  paliers + 4 sémantiques (erreur/succès/alerte/info).
- **Neutres** : éviter les gris moyens « wireframey » ; quelques gris clairs +
  quelques gris foncés pour un contraste net.
- **WCAG** : le palier 700 d'une couleur passe en général le 4.5:1 sur fond
  clair → base des éléments primaires.

## Conséquence pour TAP (affine la direction, ne la change pas)

La direction écrite (bleu institutionnel dominant + terracotta accent rare +
crème chaud) est CONFORME aux meilleurs outils métier open source ET au cadrage
chromatique pro. Les RETEX ajoutent surtout des RÈGLES CHIFFRÉES à graver dans
les tokens :

1. Appliquer 60-30-10 (terracotta plafonné à ~10% d'usage).
2. Construire une échelle neutre 6-10 paliers (aujourd'hui les neutres sont
   ponctuels) — base d'un système robuste.
3. Vérifier le terracotta en contraste : s'il échoue en texte fin sur blanc,
   l'utiliser en FOND (texte clair) pour les CTA, pas en texte.
4. Limiter à 2-3 teintes actives par écran.

## Décisions dirigeant

1. L'horizon confirme « near-monochrome + 1 accent » : on garde le cap (oui
   recommandé).
2. Graver 60-30-10 + échelle neutre 6-10 paliers dans les tokens (recommandé) ?
3. Référence d'inspiration UI la plus proche à viser : Linear (densité) tempéré
   Frappe « Espresso » (anti-distraction métier) — ça te parle ?

## Refs

RETEX : resgrid/fleetbase (dispatch OSS), frappe.io (Espresso design system),
orbix/skyrye/ixdf (psychologie couleur pro : navy=autorité, orange=accent pas
primaire, warm neutral 2026 ; 60-30-10 ; palette fonctionnelle), eightshapes
(neutres, digital blue), designsystems.surf (Polaris/Carbon/Spectrum).
