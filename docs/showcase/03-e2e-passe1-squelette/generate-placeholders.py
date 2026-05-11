"""Génère 10 placeholders annotés PNG pour Phase 3 Visible Progress.

Usage :
    python3 docs/showcase/03-e2e-passe1-squelette/generate-placeholders.py

Les captures réelles sont produites manuellement par le dev solo après
merge de la PR clôture Passe 1, en jouant le walkthrough
`03-SUMMARY.md § Walkthrough script` sur la preview Vercel.

Ce script existe pour :
  1. Garantir que les 10 fichiers existent dans le repo
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
    ("01-shell-mode-jour.png", "Capture 1/10 — Shell régulateur mode jour",
     "Header sticky 56 px : logo TAP · Patients · Courses · DraftQueue · UserMenu (DD)\n"
     "Background clair, tabs avec underline actif sur l'onglet courant\n"
     "Main 1280 px max-width centré"),
    ("02-shell-mode-nuit.png", "Capture 2/10 — Shell régulateur mode nuit",
     "Même cadrage que 01, toggle dark via UserMenu\n"
     "Contrastes WCAG AA conservés, accent bleu profond\n"
     "Background ≤ slate-900, foreground ≥ slate-50"),
    ("03-liste-patients-enrichie.png", "Capture 3/10 — /patients header enrichi",
     "Heading « Patients » + bouton « + Nouvelle course » + bouton « Nouveau patient »\n"
     "Recherche fuzzy active, liste 10 lignes seed démo 974\n"
     "Aucun nom propre côté profils démo (utiliser uniquement seed patients)"),
    ("04-liste-courses-colonnes-denses.png", "Capture 4/10 — /courses 30 lignes",
     "Filtres actifs : statut · mode · urgence · recherche\n"
     "≥ 30 lignes — colonnes Date · Patient · Trajet · Mode · Urgence · Statut · Chauffeur\n"
     "Densité régulateur (8h/jour)"),
    ("05-drawer-course-assignee.png", "Capture 5/10 — Drawer course assignée",
     "Drawer 480 px à droite\n"
     "Header : « Course » + bouton « Modifier » (outline, size sm)\n"
     "Sections : Trajet · Mode/Urgence · Assignation (chauffeur + véhicule) · Historique"),
    ("06-modal-edition-course.png", "Capture 6/10 — Modal édition course",
     "Titre « Modifier la course » (au lieu de « Nouvelle course »)\n"
     "Champs pré-remplis (patient en pill, date, pickup, dropoff, mode, urgence)\n"
     "Bouton submit : « Enregistrer les modifications »\n"
     "PAS de bouton « Mettre en pause », PAS d'indicateur auto-save"),
    ("07-modal-assignation-chauffeur.png", "Capture 7/10 — Modal assignation",
     "Modal centré, liste chauffeurs actifs + véhicules actifs\n"
     "Sélection en deux étapes (chauffeur puis véhicule)\n"
     "Bouton « Assigner » disabled tant que les 2 ne sont pas choisis"),
    ("08-conduite-chauffeur-mobile-375.png", "Capture 8/10 — /conduite mobile 375",
     "Largeur viewport 375 px (iPhone SE)\n"
     "Header logo TAP + UserMenu (CD)\n"
     "Section h2 « Aujourd'hui » + cards\n"
     "Section h2 « Demain » + cards\n"
     "Boutons d'action ≥ 56 px hauteur"),
    ("09-modal-cloture-bottom-sheet.png", "Capture 9/10 — Modal clôture",
     "Bottom sheet mobile 375 px\n"
     "Champs : montant · méthode (espèces/CB/chèque) · switch encaissé\n"
     "Bouton primaire pleine largeur « Clôturer »"),
    ("10-page-dev-switch-session.png", "Capture 10/10 — Page /dev",
     "3 cards : Dirigeant Démo · Régulateur Démo · Chauffeur Démo\n"
     "Avatars DD / RD / CD (InitialsAvatar)\n"
     "Boutons h-12 form action loginAsDemoAction\n"
     "Affichée uniquement si NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true"),
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
        "PLACEHOLDER — capture réelle à produire post-merge depuis preview Vercel\n"
        "Walkthrough : .planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md\n"
        "Rituel 5/5 à appliquer après production des 10 captures",
        fill=MUTED, font=fs, spacing=4)
    img.save(path, "PNG", optimize=True)


if __name__ == "__main__":
    for fname, title, body in CAPTURES:
        p = os.path.join(OUT, fname)
        make_png(p, title, body)
        print(f"{fname}: {os.path.getsize(p)} bytes")
