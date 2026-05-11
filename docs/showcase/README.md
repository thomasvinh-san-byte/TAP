# Showcase — captures par phase

> Tout commit qui livre une phase **DOIT** déposer ici au moins un screenshot ou un GIF
> qui prouve que la valeur est visible. Cf. CLAUDE.md § 13.5 « Visible Progress Mandate ».

## Convention

```
docs/showcase/
├── README.md                                  ← ce fichier
├── 01-referentiel-patients/
│   ├── 01-cockpit-recherche-fuzzy.png         (≤ 500 Ko)
│   ├── 02-drawer-patient-400px.png
│   ├── 03-edit-patient-form.gif               (≤ 5 Mo, 30 s max)
│   └── 04-audit-log-mutation.png
├── 01.5-dpa-rgpd-compliance/
│   ├── 01-bandeau-cookies-cnil.png
│   ├── 02-portail-patient-accces.png
│   ├── 03-admin-registre-traitements.png
│   └── 04-pdf-registre-export.png
├── 02-saisie-express-course/
│   └── ...
└── …
```

**Une phase = un sous-dossier** nommé `{phase-num}-{slug}/`. Tous les fichiers visuels
qui prouvent les success criteria de la phase doivent y être déposés AVANT le commit
de finalisation `docs(N): finaliser Phase N (code complete)`.

## Format

- **Screenshots** : PNG ou JPEG, ≤ 500 Ko, 1280×720 ou 1920×1080 (cible desktop régulateur)
- **GIFs courts** : ≤ 5 Mo, ≤ 30 s, idéalement 30 fps. Outil recommandé : `ffmpeg` ou `Kap`.
- **Vidéos** : MP4 H.264, ≤ 5 Mo, ≤ 30 s. Au-delà, héberger ailleurs et linker.
- **PDF** : pour exports et documents légaux uniquement.

## Aucune donnée patient réelle

Les captures ne doivent JAMAIS contenir :
- de NIR réel (utiliser ceux du seed démo `supabase/seed.demo.sql` — fictifs avec clé Luhn correcte)
- d'adresse réelle d'un patient hors seed démo
- de prénom + nom + date de naissance d'un patient réel

Toute capture qui violerait ces règles doit être immédiatement supprimée + commit `revert`.

## Lien vers le SUMMARY de la phase

Chaque `{phase-num}-SUMMARY.md` (sous `.planning/phases/`) doit contenir une section
« Showcase » qui linke les fichiers de ce dossier. Exemple :

```markdown
## Showcase

- `docs/showcase/01-referentiel-patients/01-cockpit-recherche-fuzzy.png` — recherche fuzzy 2 chars
- `docs/showcase/01-referentiel-patients/02-drawer-patient-400px.png` — drawer 400 px
- URL prod canonique : https://tap-web-brown.vercel.app/ (preview = https://tap-web-git-<branch>-tvss-projects-07aa3591.vercel.app)
```

## Walkthrough scripts

Chaque SUMMARY de phase doit AUSSI contenir 5-10 étapes que la régulatrice peut
suivre sur la preview pour voir la valeur livrée. Format :

```markdown
## Walkthrough

1. Aller sur /login (URL preview)
2. Se connecter avec `regulateur@demo.tap` / `demo1234!`
3. Cliquer sur l'icône loupe en haut à droite
4. Taper « Ho » dans la recherche
5. Vérifier que « Patrick Hoarau » apparaît dans les résultats
6. Cliquer sur « Patrick Hoarau »
7. Vérifier que le drawer 400 px s'ouvre à droite
8. Cliquer sur « Voir la fiche complète »
9. Vérifier que la page /patients/[id] s'affiche avec les 6 blocs prévus
10. Cliquer sur « Modifier » → vérifier que `/patients/[id]/edit` s'affiche
```

Les walkthroughs sont **rejouables par n'importe qui ayant accès à la preview** —
y compris design partners, équipe, futurs employés.
