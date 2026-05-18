# Plan-2 — Assets PWA (manifest + icônes + splash + meta tags)

**Phase**: 04.9 PWA chauffeur enveloppe
**Wave**: 2/7
**Dépendances**: aucune (parallèle W1 et W3)
**Estimation**: 1.5h (vélocité projetée 25-30 min réel)
**Refs**: Option A cross-platform LOCKED (PR #109), UI-SPEC PR #110, DEC-014 portrait-only

---

## Goal

Générer tous les assets PWA installables cross-platform : `manifest.json` + 6 icônes (Android maskable + iOS apple-touch + fallback any) + 3 splash DPR iOS + meta tags HTML head dans le layout root.

Option A LOCKED : iOS Safari + Android testés en parallèle. Splash iOS statique 3 DPR + manifest Android auto-généré.

---

## Fichiers à créer

- `apps/web/public/manifest.json`
- `apps/web/public/icons/icon-192-any.png` (192×192, Android home fallback)
- `apps/web/public/icons/icon-512-any.png` (512×512, Android splash auto fallback)
- `apps/web/public/icons/icon-192-maskable.png` (Android adaptive, safe zone 80%)
- `apps/web/public/icons/icon-512-maskable.png`
- `apps/web/public/icons/apple-touch-icon-180.png` (180×180, iOS Safari home, sans padding)
- `apps/web/public/splash/apple-launch-750x1334.png` (iPhone SE/8 @ 2x)
- `apps/web/public/splash/apple-launch-1170x2532.png` (iPhone 13/14/15 @ 3x)
- `apps/web/public/splash/apple-launch-1290x2796.png` (iPhone 15 Pro Max @ 3x)

## Fichiers à modifier

- `apps/web/src/app/layout.tsx` — viewport export + meta tags PWA dans `<head>`

---

## Méthode de génération recommandée (Option B CLI)

Plan recommande **`pwa-asset-generator`** (CLI npm, déterministe, reproductible) :

```bash
npx pwa-asset-generator apps/web/public/logo-tap.svg apps/web/public/icons \
  --icon-only --type png --background "<TAP-BACKGROUND-HSL>" --padding "0%" \
  --maskable false  # générer apple-touch-icon (sans padding)

npx pwa-asset-generator apps/web/public/logo-tap.svg apps/web/public/icons \
  --icon-only --type png --background "<TAP-BACKGROUND-HSL>" --padding "10%" \
  --maskable true  # générer maskable 192/512

npx pwa-asset-generator apps/web/public/logo-tap.svg apps/web/public/splash \
  --splash-only --type png --background "<TAP-BACKGROUND-HSL>" \
  --portrait-only --landscape false
```

**Validation visuelle manuelle** avant commit :
- Maskable.app Editor (drag icon-512-maskable.png) — logo doit rentrer dans toutes les formes (circle, squircle, rounded square)
- Inspection iPhone réel splash (Wave 6 UAT)

**Alternative manuelle** (si pwa-asset-generator pas dispo) :
- Maskable.app Editor pour maskable (export 192+512)
- Inkscape/Figma export PNG `apple-touch-icon-180` carré sans padding
- Photoshop/Figma splash iOS : logo centré sur fond `background_color`, dimensions device-spécifiques

---

## `manifest.json` shape

```json
{
  "name": "TAP Réunion — Chauffeur",
  "short_name": "TAP Chauffeur",
  "description": "Application chauffeur taxi conventionné 974",
  "lang": "fr-FR",
  "dir": "ltr",
  "start_url": "/conduite",
  "scope": "/conduite/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "<TAP-PRIMARY-HSL>",
  "background_color": "<TAP-BACKGROUND-HSL>",
  "icons": [
    { "src": "/icons/icon-192-any.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-any.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Note** : iOS Safari n'utilise PAS les icons du manifest. `<link rel="apple-touch-icon">` HTML override.

---

## Détermination couleurs theme_color + background_color

Extraire depuis `apps/web/src/app/globals.css` :

```bash
grep -E "^\s+--primary:|^\s+--background:" apps/web/src/app/globals.css
```

Convertir HSL CSS → hex/hsl manifest format. Valeurs candidates :
- `theme_color` : couleur `--primary` (sera statusbar Android)
- `background_color` : couleur `--background` (sera fond splash Android auto)

Wave 2 doit valider visuellement la cohérence header app ↔ statusbar.

---

## Meta tags `apps/web/src/app/layout.tsx`

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '<TAP-PRIMARY-HSL>',
};

// Dans <head> du return :
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="TAP Chauffeur" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-startup-image"
      href="/splash/apple-launch-750x1334.png"
      media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
<link rel="apple-touch-startup-image"
      href="/splash/apple-launch-1170x2532.png"
      media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
<link rel="apple-touch-startup-image"
      href="/splash/apple-launch-1290x2796.png"
      media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
```

---

## Critères GREEN Wave 2

- `manifest.json` valide (Chrome DevTools Application → Manifest pas d'erreur)
- 6 icônes + 3 splash iOS générés et commitées sous `public/icons/` et `public/splash/`
- Layout root contient viewport export + meta tags PWA
- Test installation Chrome desktop : « Install app » disponible dans omnibox
- Test installation iPhone Safari : « Ajouter à l'écran d'accueil » montre apple-touch-icon nette
- Lighthouse PWA audit score > 90 (Chrome DevTools)
- typecheck PASS, lint PASS

---

## Anti-patterns / NE PAS FAIRE

- ❌ `apple-mobile-web-app-capable` seul sans manifest (web.dev anti-pattern, fallback UX inconsistent)
- ❌ Skip apple-touch-icon-180 sous prétexte manifest icons (iOS Safari les ignore)
- ❌ Maskable avec logo bord à bord (safe zone 80% obligatoire, sinon coupures sur shapes Samsung)
- ❌ Theme_color différent du header app (incohérence statusbar ↔ contenu)
- ❌ Splash iOS skip Option B/C (Option A LOCKED PR #109)
- ❌ Icônes générées sans validation visuelle (Maskable.app preview obligatoire avant commit)
- ❌ Orientation `any` ou `landscape` (DEC-014 LOCKED portrait-only chauffeur 1 main)
