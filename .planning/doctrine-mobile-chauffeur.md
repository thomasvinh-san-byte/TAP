# Doctrine mobile — parcours chauffeur (PWA terrain)

> Nature DISTINCTE du back-office régulateur : usage terrain, une main, en
> mouvement, réseau variable. Les doctrines alignement/formulaire ne
> s'appliquent PAS telles quelles. Sourcée. 2026-06-09.

## Constat (captures + code)

- Layout `(driver)` : `<main mx-auto max-w-[640px]>` → sur DESKTOP, colonne
  centrée + grand vide beige (artefact de visualisation ; sur vrai téléphone =
  plein écran, OK). 640px est correct pour mobile. Ne PAS sur-corriger : c'est
  une PWA mobile.
- Bandeau « PWA debug · état détecté : unsupported » VISIBLE → ne doit JAMAIS
  être en prod.
- Bandeau géoloc très verbeux (5 lignes) en haut → mange la hauteur sur petit
  écran.
- Actions (Démarrer/Clôturer/Patient absent) en bas de carte → globalement bien.
- Cartes course : liseré d'état (orange en cours, vert terminé) = bon repère
  visuel.

## Principes sourcés (mobile/PWA terrain 2025-2026)

1. **Zone du pouce** : actions primaires dans les 2/3 inférieurs ; coins hauts =
   nav/actions rares. Usage une main = la norme terrain.
2. **Cibles ≥44×44px** + espacement suffisant (anti fat-finger).
3. **Responsive PWA** : réarranger selon viewport ; mobile-first (prioriser
   données + actions importantes). 640px max = OK mobile ; sur desktop, accepter
   le centrage (PWA destinée au téléphone) OU tinter le fond pour ancrer (déjà
   fait).
4. **Mobile-first / trim** : masquer le superflu (debug), condenser les bandeaux
   verbeux, garder l'essentiel (heure, patient, trajet, action).
5. **Feedback tap** (toasts « Course démarrée » déjà présents = bon), états
   offline (PWA, réseau variable) — cached-first.
6. **Patterns natifs** : back qui restaure la position de scroll, bottom-sheet
   pour les modales d'action (Clôturer/Absent) plutôt que modale centrée.

## Doctrine TAP mobile (règles)

- **M1 — Largeur mobile assumée.** max-w ~640px CONSERVÉ (mobile). Sur desktop,
  ne pas chercher à remplir : c'est une PWA téléphone. Le tint de fond ancre
  déjà visuellement.
- **M2 — Zéro debug en prod.** Le bandeau « PWA debug/état détecté » masqué hors
  dev (NODE_ENV/flag). Jamais visible par un chauffeur.
- **M3 — Bandeau géoloc condensé.** Version courte par défaut (1 ligne + « i »
  qui déplie le détail), dismissable et mémorisé (ne pas réafficher le pavé à
  chaque visite).
- **M4 — Actions dans la zone du pouce.** Action primaire de course
  (Démarrer/Clôturer) large, en bas de carte (déjà ~OK). Cibles ≥44px,
  espacement anti-erreur. Action destructive (Patient absent) visuellement
  distincte et un cran moins accessible.
- **M5 — Cartes course lisibles.** Heure (gros, tabular), patient, mode·statut,
  trajet (départ→arrivée), liseré d'état. Hiérarchie claire, scannable d'un coup
  d'œil en mouvement. Conserver les libellés métier (Taxi conv., TPMR,
  Programmée…).
- **M6 — Modales d'action = bottom-sheet sur mobile.** Clôturer/Absent en
  feuille basse (pouce) plutôt que modale centrée, si faisable sans gros
  refactor ; sinon modale OK mais boutons en zone basse.

## Prochaine étape : MAQUETTE mobile (cadre téléphone ~390px)

Maquette de « Ma journée » dans un cadre téléphone réel (pas étiré desktop)
appliquant M1-M5 : bandeau géoloc condensé, pas de debug, carte course dense +
action pouce. Validée avant implémentation. Le détail course / modales = lot
suivant si besoin.

## Refs

uxcam, droidsonroids, lollypop, nextnative (zone pouce, 44px, bottom nav),
appinstitute/MDN (responsive PWA, mobile-first). Captures conduite. Cockpit reste
la réf desktop ; ici doctrine SÉPARÉE (mobile).

---

## MISE À JOUR (recherche sourcée) — géoloc & modales

### M3bis — Géoloc : notice par couches, 1re couche INFORMATIVE (pas ultra-minimale)

Recherche RGPD (layered notice, IAPP/ICO/privacy patterns) : la 1re couche DOIT
contenir qui/quoi/pourquoi, pas juste un libellé. Donc PAS « Position partagée »
seul + i. Première couche (1-2 lignes, toujours visible) : QUOI (position captée
aux pointages) + POURQUOI (liée à la course) + rétention (90 j) → ex. « Position
captée à chaque pointage, liée à la course · conservée 90 j max ». Puis « En
savoir plus » CLAIR et visible (pas caché, pas de dark pattern) qui déplie :
service uniquement, permission refusable (le pointage marche sans GPS), retrait.
Dismissable + mémorisé (pas de réaffichage du détail à chaque visite). Le bandeau
ACTUEL (5 lignes) est trop long ; la v1 maquette (1 ligne) était trop courte →
cible = 1re couche informative + détail dépliable.

### M6bis — Modales d'action = BOTTOM-SHEET sur mobile (tranché)

Recherche (Material, LogRocket, Mobbin, Plotline) : sur mobile, préférer
bottom-sheet/plein écran aux boîtes centrées ; bottom-sheet = plus d'espace (3
bords), scroll propre, et surtout zone du POUCE (les actions Clôturer/Absent
partent de boutons en bas de carte → pouce déjà en bas). DONC :

- Clôturer la course (tarif + modes paiement + toggle) → bottom-sheet
  haut/extensible. Si trop chargé avec clavier numérique ouvert → plein écran
  (fullscreen) acceptable (formulaire nécessitant focus total). Modal cap 50%
  puis extensible (Material).
- Patient absent (confirmation + motif optionnel) → bottom-sheet.
- Boutons d'action DANS la feuille en zone basse ; fermeture par swipe down +
  backdrop + bouton explicite. Champ tarif = clavier numérique (inputmode).
- Implémentation : si refactor lourd, étape ; à défaut, garder modale mais
  boutons en bas. Cible = bottom-sheet.

---

> Statut d'implémentation (Phase 06.55, DEC-134) : M2 (debug masqué hors dev),
> M3bis (géoloc en couches + dismiss mémorisé), M6/M6bis (bottom-sheet partagé
> `components/ui/bottom-sheet.tsx` sur Clôturer + Patient absent) livrés ; M4/M5
> (carte + actions zone pouce) déjà conformes. Maquette :
> `.planning/mockups/conduite-mobile-maquette.html`.
