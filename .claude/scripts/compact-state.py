#!/usr/bin/env python3
"""Compacte .planning/STATE.md sans rien perdre :
- garde la SEULE dernière entrée dans last_activity + un pointeur
- archive toutes les entrées « Précédent : » dans .planning/STATE-HISTORY.md
- rafraîchit « Current Position » et « Phases à venir » du corps (état 06.8 livré)
"""
import re, sys, datetime

STATE = ".planning/STATE.md"
HIST = ".planning/STATE-HISTORY.md"

src = open(STATE, encoding="utf-8").read()

# 1) Isoler le bloc d'activité : de "last_activity:" jusqu'à la ligne "progress:".
m = re.search(r"(?ms)^last_activity:\s*(.*?)\n(?=progress:)", src)
if not m:
    print("!! last_activity/progress introuvable — abandon", file=sys.stderr); sys.exit(1)
activity_full = m.group(1).rstrip()

# 2) Découper sur les marqueurs "Précédent :".
parts = re.split(r"\n\s*Précédent\s*:\s*", activity_full)
latest = parts[0].strip()
previous = [p.strip() for p in parts[1:] if p.strip()]

if not previous:
    print("STATE déjà compacté (aucune entrée « Précédent ») — rien à faire.")
    sys.exit(0)

print(f"Entrées d'activité : 1 récente + {len(previous)} archivées")

# 3) Reconstruire last_activity : dernière entrée + pointeur.
pointer = "Historique complet des phases : .planning/STATE-HISTORY.md"
new_last_activity = f"last_activity: {latest}\n\n{pointer}\n"
src = src[:m.start()] + new_last_activity + src[m.end():]

# 4) Rafraîchir « Current Position » (corps).
new_pos = """## Current Position

Phase: 06.8 (livrée)
Phase next: au choix — 06.5 (HDS, verrou avant 1er client payant) | 06.7 (OR-Tools) | 08 (géoloc opérationnelle, post-HDS, DEC-075) | 07 (natif, optionnel)
Status: Phases 06 / 06.6 / 06.8 livrées — Espace dirigeant complet (facturation + conformité assistée + tableau de bord)
Blockers: aucun bloquant

Progress: [██████████] 100%"""
src = re.sub(r"(?ms)^## Current Position\n.*?\nProgress: \[█+\] 100%", new_pos, src, count=1)

# 5) Rafraîchir « Phases à venir ».
new_avenir = """Phases à venir :
- Phase 06.5 — Migration HDS (verrou avant 1er client payant)
- Phase 06.7 — OR-Tools optimisation de tournées (microservice Python)
- Phase 08   — Géolocalisation opérationnelle temps réel (post-HDS, DEC-075)
- Phase 07   — Mobile native chauffeur (optionnel — débloque le GPS continu fiable)
"""
# IMPORTANT : re.M SEUL (pas de dotall) — sinon « . » mange les sauts de ligne
# et la substitution avale tout le corps suivant.
src = re.sub(r"(?m)^Phases à venir :\n(?:- .*\n)+", new_avenir, src, count=1)

open(STATE, "w", encoding="utf-8").write(src)

# 6) Écrire l'archive (append si existe déjà).
now = datetime.date.today().isoformat()
header = f"# STATE — Historique des phases\n\n> Archive du journal d'activité GSD, sortie de STATE.md le {now} pour alléger le contexte.\n> Ordre antéchronologique (le plus récent en haut). STATE.md ne garde que la dernière entrée.\n\n"
blocks = [f"## (récent) {latest}\n"] + [f"## Précédent\n{p}\n" for p in previous]
open(HIST, "w", encoding="utf-8").write(header + "\n---\n\n".join(blocks) + "\n")

print(f"STATE.md compacté ; {len(previous)+1} entrées archivées dans {HIST}")
