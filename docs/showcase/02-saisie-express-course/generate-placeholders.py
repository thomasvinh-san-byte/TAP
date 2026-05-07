"""Génère 6 placeholders annotés PNG/GIF pour Phase 2 Visible Progress.

Usage :
    python3 docs/showcase/02-saisie-express-course/generate-placeholders.py

Les captures réelles sont produites en CI cloud / preview Vercel via :
    PHASE_2_CAPTURES=1 pnpm --filter @tap/web test:e2e -- saisie-express

Le test `apps/web/tests/e2e/saisie-express.spec.ts` appelle
`page.screenshot({path: docs/showcase/02-saisie-express-course/NN-...})`
aux 6 moments clés derrière le flag d'env `PHASE_2_CAPTURES`.

Ce script existe pour :
  1. Garantir que les 6 fichiers existent dans le repo (acceptance Phase 2)
  2. Documenter visuellement le contenu attendu de chaque capture
  3. Permettre de régénérer les placeholders si supprimés par erreur
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1440, 900
BG = (245, 247, 250)
INK = (28, 32, 40)
ACCENT = (37, 99, 235)
MUTED = (107, 114, 128)
GRID = (220, 226, 234)

CAPTURES = [
    ("01-modal-express-vide.png", "Capture 1/6 — Modal saisie express vide",
     "Après Cmd/Ctrl+Shift+K depuis /patients ou /courses\n"
     "Focus dans champ « Rechercher un patient »\n"
     "8 champs visibles : patient · date · pickup · dropoff · mode · urgence · notes\n"
     "Boutons « Mettre en pause » et « Créer la course »"),
    ("02-modal-recherche-patient.png", "Capture 2/6 — Recherche patient fuzzy",
     "Champ patient : « Ho » (2 chars)\n"
     "Liste « Résultats de recherche » : Hoarau Patrick (+ autres)\n"
     "Tri pertinence pg_trgm, < 1500 ms\n"
     "Téléphone tabular-nums à droite"),
    ("03-modal-rempli-pret-submit.png", "Capture 3/6 — Formulaire complet",
     "Patient sélectionné : « Sélectionné : Patrick Hoarau »\n"
     "Date : « demain 14h » (parsé Indian/Reunion)\n"
     "Pickup : « 12 rue Pasteur, Saint-Denis »\n"
     "Dropoff : « CHU Bellepierre »\n"
     "Mode : Taxi conventionné · Urgence : Programmée\n"
     "« Sauvegardé il y a 3 s »"),
    ("04-toast-creation-confirmee.gif", "Capture 4/6 — Toast Sonner",
     "Click « Créer la course » → fade-out modal optimistic\n"
     "Toast Sonner : « Course créée pour Patrick Hoarau »\n"
     "Apparition < 100 ms, durée 4 s"),
    ("05-brouillons-dropdown-3-en-attente.png", "Capture 5/6 — DraftQueue",
     "Bouton header « Brouillons (3) » badge tabular-nums\n"
     "Dropdown ouvert listant 3 items :\n"
     "  · Adresse A → … (« il y a 12 s »)\n"
     "  · Adresse B → … (« à l'instant »)\n"
     "  · 12 rue Pasteur Test… → … (« il y a 2 min »)\n"
     "Trash hover destructive"),
    ("06-page-courses-liste-30j.png", "Capture 6/6 — Page /courses",
     "Heading « Courses » + raccourci kbd\n"
     "Filtres : statut (Tous) · mode (Tous) · recherche fuzzy\n"
     "Tableau 6 colonnes : Date · Patient · Trajet · Mode · Urgence · Statut\n"
     "≥ 30 lignes (seed démo + courses créées E2E)"),
]


def _fonts():
    try:
        return (
            ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32),
            ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20),
            ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16),
        )
    except OSError:
        d = ImageFont.load_default()
        return d, d, d


def make_png(path, title, body):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([(40, 40), (W - 40, H - 40)], outline=GRID, width=2)
    for x in range(80, W - 40, 40):
        d.line([(x, 60), (x, H - 60)], fill=GRID, width=1)
    for y in range(80, H - 40, 40):
        d.line([(60, y), (W - 60, y)], fill=GRID, width=1)
    ft, fb, fs = _fonts()
    d.rectangle([(60, 80), (W - 60, 160)], fill=ACCENT)
    d.text((80, 100), title, fill=(255, 255, 255), font=ft)
    d.text((80, 200), body, fill=INK, font=fb, spacing=8)
    d.text(
        (80, H - 130),
        "PLACEHOLDER — capture réelle à produire depuis preview Vercel\n"
        "Script automatisé : PHASE_2_CAPTURES=1 pnpm --filter @tap/web test:e2e -- saisie-express\n"
        "Voir .planning/phases/02-saisie-express-course/02-SUMMARY.md § Walkthrough",
        fill=MUTED, font=fs, spacing=4)
    img.save(path, "PNG", optimize=True)


def make_gif(path, title, body):
    frames = []
    for label in [
        "Frame 1 — Click « Créer la course »",
        "Frame 2 — Modal fade-out (~150 ms)",
        "Frame 3 — Toast Sonner « Course créée pour Patrick Hoarau »",
    ]:
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        d.rectangle([(40, 40), (W - 40, H - 40)], outline=GRID, width=2)
        ft, fb, fs = _fonts()
        d.rectangle([(60, 80), (W - 60, 160)], fill=ACCENT)
        d.text((80, 100), title, fill=(255, 255, 255), font=ft)
        d.text((80, 200), body, fill=INK, font=fb, spacing=8)
        d.text((80, 480), label, fill=ACCENT, font=ft)
        d.text(
            (80, H - 130),
            "PLACEHOLDER — capture réelle à produire depuis preview Vercel",
            fill=MUTED, font=fs)
        frames.append(img)
    frames[0].save(
        path, format="GIF", save_all=True, append_images=frames[1:],
        duration=1000, loop=0, optimize=True)


if __name__ == "__main__":
    for fname, title, body in CAPTURES:
        p = os.path.join(OUT, fname)
        if fname.endswith(".gif"):
            make_gif(p, title, body)
        else:
            make_png(p, title, body)
        print(f"{fname}: {os.path.getsize(p)} bytes")
