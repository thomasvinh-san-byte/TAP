#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Applique la révision roadmap TAP (sync réel 04.5/04.7 + recadrage réglementaire 2027
+ Phase 08 géoloc post-HDS + DEC-074/075 + amendement ADR-005).
Robuste : chaque édition vérifie que sa cible existe (sinon arrêt net), et détecte
si la révision est déjà appliquée (idempotent). N'édite PAS STATE.md (déjà compacté
par compact-state.py — évite le double-emploi)."""
import sys, io

ROADMAP = ".planning/ROADMAP.md"
CONCERNS = ".planning/codebase/CONCERNS.md"
PROJECT = ".planning/PROJECT.md"
ADR5 = "docs/adr/ADR-005-teletransmission-b2-cnda-differee.md"

errs = []

def edit(path, old, new, label, optional_done_marker=None):
    """Remplace old→new dans path. Si old absent mais marqueur 'déjà fait' présent → skip.
    Sinon → erreur (cible introuvable)."""
    txt = io.open(path, encoding="utf-8").read()
    if old in txt:
        if old == new:
            print(f"  = {label} : identique, rien à faire"); return
        io.open(path, "w", encoding="utf-8").write(txt.replace(old, new, 1))
        print(f"  ✓ {label}")
    elif optional_done_marker and optional_done_marker in txt:
        print(f"  • {label} : déjà appliqué (skip)")
    else:
        errs.append(f"{label} : cible introuvable dans {path}")
        print(f"  ✗ {label} : CIBLE INTROUVABLE")

print("ROADMAP.md")
edit(ROADMAP,
  "- [ ] **Phase 04.5: Robustesse régulateur + dette CONCERNS**",
  "- [x] **Phase 04.5: Robustesse régulateur + dette CONCERNS**",
  "04.5 cochée", optional_done_marker="- [x] **Phase 04.5:")
edit(ROADMAP,
  "**Estimation : 6-9 h. Prérequis : UAT walkthrough dirigeant terminé.**",
  "**Livré 2026-05-15 (PR #71..#87, ~3h45 réel vs 14h estimé, vélocité -73%).**",
  "04.5 mention livraison", optional_done_marker="Livré 2026-05-15 (PR #71")
edit(ROADMAP,
  "- [ ] **Phase 04.7: Pricing mockup + Caisse + Migration géocoding**",
  "- [x] **Phase 04.7: Pricing mockup + Caisse + Migration géocoding**",
  "04.7 cochée", optional_done_marker="- [x] **Phase 04.7:")
edit(ROADMAP,
  "**Pricing réel reporté Phase 05.5 (DEC-021). Estimation : 6-9 h.**",
  "**Pricing réel reporté Phase 05.5 (DEC-021). Livré 2026-05-15 (PR #88..#99).**",
  "04.7 mention livraison", optional_done_marker="Livré 2026-05-15 (PR #88")

# Phase 08 — ligne de liste, insérée juste après la ligne de liste Phase 07.
p07 = "- [ ] **Phase 07: Mobile native chauffeur (OPTIONNEL — décision business V2)**"
p08_line = ("\n- [ ] **Phase 08: Géolocalisation opérationnelle temps réel** — Suivi position "
  "véhicules pour la régulation : carte cockpit live, ETA temps réel (régulateur + patient SMS), "
  "km à vide / km en charge réels, comparaison itinéraire prévu vs réalisé, historique 90 j puis "
  "purge (CDC §5.17). **Distincte de la géoloc certifiée facturation (hors périmètre, DEC-074).** "
  "Depends on: Phase 06.5 (HDS — DEC-075, position de véhicules-patients = donnée de santé "
  "indirecte). Faisabilité technique liée à Phase 07 : la capture GPS en arrière-plan n'est pas "
  "fiable en PWA (iOS surtout) — le discuss devra trancher PWA premier-plan dégradé vs natif. "
  "**Estimation : à cadrer en discuss.**")
txt = io.open(ROADMAP, encoding="utf-8").read()
if "Phase 08: Géolocalisation opérationnelle" in txt:
    print("  • Phase 08 (liste) : déjà présente (skip)")
elif p07 in txt:
    end = txt.index("\n", txt.index(p07) + len(p07))
    txt = txt[:end] + p08_line + txt[end:]
    io.open(ROADMAP, "w", encoding="utf-8").write(txt)
    print("  ✓ Phase 08 (liste) insérée après Phase 07")
else:
    errs.append("Phase 08 : ancre Phase 07 introuvable dans ROADMAP")
    print("  ✗ Phase 08 : ancre Phase 07 INTROUVABLE")

# Table fonctionnalités héritées
edit(ROADMAP,
  "| Géolocalisation temps réel chauffeur | Reporté V3 (Passe 4 ne livre pas le streaming GPS — V1 ne le requiert pas) |",
  "| Géolocalisation temps réel chauffeur | Phase 08 — géoloc opérationnelle, post-HDS (DEC-075). Non requise en V1. |",
  "table héritée : géoloc", optional_done_marker="Phase 08 — géoloc opérationnelle, post-HDS")

# Footer
edit(ROADMAP,
  "*Dernière mise à jour : 2026-05-14 — Phase 04 marquée livrée + 5 hotfixes post-merge (DEC-029..033) + Phase 03.2 inscrite + Phase 07 mobile natif ajoutée + estimations alignées avec vision macro VISION.md.*",
  "*Dernière mise à jour : 2026-05-22 — sync réel (04.5/04.7 cochées livrées), recadrage réglementaire 2027 (SEFi/géoloc certifiée, DEC-074), ajout Phase 08 géoloc opérationnelle post-HDS (DEC-075). Antérieur : 2026-05-14 — Phase 04 livrée + hotfixes DEC-029..033 + Phase 03.2 + Phase 07.*",
  "footer", optional_done_marker="Dernière mise à jour : 2026-05-22")

# Phase 08 — bloc « Phase Details » détaillé, inséré à la fin du bloc ### Phase 07
# (juste avant le « --- » qui le clôt).
p08_details = """### Phase 08: Géolocalisation opérationnelle temps réel
**Goal**: La régulatrice voit la position temps réel des véhicules sur une carte cockpit, avec ETA, km à vide/charge réels et comparaison prévu/réalisé. Le patient reçoit un ETA par SMS.
**Depends on**: Phase 06.5 (HDS). DEC-075 : pas de positions réelles de véhicules-patients en prod avant HDS.
**Cadre RGPD géoloc salarié (CDC §5.17)**: base légale = exécution du contrat de travail ; information préalable obligatoire ; limitation au temps de service (pause déjeuner possible avec consentement) ; conservation 90 j puis purge automatique ; consultation réservée aux rôles dirigeant + régulateur.
**Contrainte technique structurante**: la capture GPS en arrière-plan PWA est non fiable (iOS Safari met l'app en pause hors premier plan ; Android Chrome s'interrompt si le chauffeur ouvre Waze/Maps ; le service worker n'a pas accès à `navigator.geolocation`). Deux options à trancher en discuss : (a) PWA premier-plan seulement (dégradé, écran allumé) ; (b) coupler à l'app native Phase 07 (seul suivi continu fiable).
**Hors périmètre**: géoloc certifiée Assurance maladie / alimentation facturation SEFi (DEC-074 — incombe à la solution certifiée du taxi).
**Estimation**: à cadrer en discuss
**UI hint**: yes (carte cockpit live + ETA)
**Plans**: TBD — `/gsd-discuss-phase 08`

---
"""
txt = io.open(ROADMAP, encoding="utf-8").read()
if "### Phase 08: Géolocalisation opérationnelle" in txt:
    print("  • Phase 08 (détails) : déjà présents (skip)")
else:
    p07d = "### Phase 07: Mobile native chauffeur (OPTIONNEL — décision business V2)"
    if p07d in txt:
        # premier « --- » après le titre de détails Phase 07
        sep = txt.index("\n---", txt.index(p07d))
        sep_end = txt.index("\n", sep + 1) + 1  # fin de la ligne ---
        txt = txt[:sep_end] + "\n" + p08_details + txt[sep_end:]
        io.open(ROADMAP, "w", encoding="utf-8").write(txt)
        print("  ✓ Phase 08 (détails) insérés après le bloc Phase 07")
    else:
        errs.append("Phase 08 détails : bloc Phase 07 introuvable")
        print("  ✗ Phase 08 (détails) : bloc Phase 07 INTROUVABLE")

print("CONCERNS.md")
edit(CONCERNS,
  "- Facturation CGSS PDF mensuelle + télétransmission B2 via logiciel certifié CNDA (échéance réglementaire **31 mai 2026**).",
  "- **Cadre réglementaire 2027 (corrigé 2026-05-22).** Géolocalisation certifiée Assurance "
  "maladie obligatoire au **1er janvier 2027** pour conserver le conventionnement ; le télé-service "
  "**SEFi** remplace la norme B2 comme facturation obligatoire au plus tard au **1er janvier 2027** ; "
  "les deux exigent un logiciel certifié **CNDA** (arrêtés Légifrance 16/05 et 29/07/2025). "
  "**Positionnement TAP (DEC-074)** : TAP ne porte PAS cette certification — il s'interface par "
  "export avec la solution certifiée du taxi. La facturation PDF de TAP reste un récapitulatif "
  "estimatif (« ne vaut pas bordereau B2/SEFi »). Risque avant-vente : clarifier que TAP est "
  "complémentaire d'une solution certifiée, pas un substitut.",
  "CONCERNS recadrage 2027", optional_done_marker="Cadre réglementaire 2027 (corrigé 2026-05-22)")
edit(CONCERNS,
  "- **Géolocalisation temps réel** : tracking position chauffeur pour cockpit régulateur live map.",
  "- **Géolocalisation opérationnelle temps réel** : déplacée vers la **Phase 08, post-HDS "
  "(DEC-075)** — n'est pas livrée par la Phase 06. Suivi position véhicules pour carte cockpit "
  "live + ETA ; distincte de la géoloc certifiée facturation (hors périmètre, DEC-074).",
  "CONCERNS géoloc → Phase 08", optional_done_marker="déplacée vers la **Phase 08, post-HDS")

print("PROJECT.md")
dec73_anchor = "| **DEC-073** Carte de statut de conformité = factuelle"
txt = io.open(PROJECT, encoding="utf-8").read()
if "**DEC-074**" in txt:
    print("  • DEC-074/075 : déjà présentes (skip)")
elif dec73_anchor in txt:
    line_end = txt.index("\n", txt.index(dec73_anchor))
    rows = ("\n| **DEC-074** Positionnement non-certifié — TAP s'interface | révision roadmap "
      "2026-05-22 | CANDIDATE | TAP est un logiciel opérationnel non certifié. Il s'interface par "
      "export avec une solution certifiée tierce (facturation/géoloc certifiée Assurance maladie). "
      "La certification CNDA/SEFi et la géoloc certifiée obligatoire au 1er janvier 2027 sont "
      "**hors périmètre TAP** — elles incombent au taxi et à sa solution certifiée. Précise DEC-064 "
      "et ADR-005. Risque avant-vente : clarifier que TAP est complémentaire, pas un substitut. |"
      "\n| **DEC-075** Géoloc opérationnelle post-HDS | révision roadmap 2026-05-22 | CANDIDATE | "
      "La géolocalisation opérationnelle temps réel (CDC §5.17) est la **Phase 08, postérieure à la "
      "migration HDS (06.5)**. Aucune position réelle de véhicule transportant des patients n'est "
      "stockée en prod avant HDS (donnée de santé indirecte ; RGPD géoloc salarié). Faisabilité liée "
      "à la Phase 07 (capture GPS arrière-plan non fiable en PWA). |")
    txt = txt[:line_end] + rows + txt[line_end:]
    io.open(PROJECT, "w", encoding="utf-8").write(txt)
    print("  ✓ DEC-074/075 (CANDIDATE) ajoutées après DEC-073")
else:
    errs.append("DEC-074/075 : ancre DEC-073 introuvable dans PROJECT")
    print("  ✗ DEC-074/075 : ancre DEC-073 INTROUVABLE")

print("ADR-005")
amend = """

## Amendement 2026-05-22 — recadrage réglementaire + positionnement (DEC-074)

Précision suite à l'audit des arrêtés Légifrance (16 mai + 29 juillet 2025) :
la géolocalisation certifiée Assurance maladie devient obligatoire au 1er janvier
2027 pour conserver le conventionnement, et SEFi remplace la norme B2 comme
facturation obligatoire au plus tard au 1er janvier 2027 (logiciel certifié CNDA
requis). La décision n'est plus seulement un « report » : par conception (DEC-074),
TAP reste un outil opérationnel non certifié et s'interface par export avec la
solution certifiée du taxi. Le fardeau de la certification (CNDA, SEFi, géoloc
certifiée) incombe au taxi et à sa solution certifiée, pas à TAP.
"""
txt = io.open(ADR5, encoding="utf-8").read()
if "Amendement 2026-05-22" in txt:
    print("  • ADR-005 amendement : déjà présent (skip)")
else:
    io.open(ADR5, "a", encoding="utf-8").write(amend)
    print("  ✓ ADR-005 amendement ajouté")

if errs:
    print("\n!! ÉCHEC — cibles introuvables :")
    for e in errs: print("   -", e)
    sys.exit(1)
print("\nRévision roadmap appliquée.")
