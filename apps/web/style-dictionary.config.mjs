/**
 * Style Dictionary v4 config — Phase 06.14 (D-09, D-11, D-12).
 *
 * Génère 2 outputs depuis 2 token sets DTCG (D-01) :
 *   - `src/styles/tokens.generated.css` : fragment `:root { … }` (light) +
 *     `[data-theme='dark'] { … }` (dark). Importé en tête de globals.css.
 *   - `src/styles/tokens.generated.ts`  : export JS hex pour contextes
 *     hors-DOM (PDF @react-pdf/renderer, themeColor manifest PWA).
 *
 * Convention de nommage des CSS vars (D-12) : les noms exacts actuellement
 * consommés par tailwind.config.ts et globals.css sont préservés via une
 * table de mapping ci-dessous. Drop-in replacement, zéro refactor des
 * consommateurs.
 */

import StyleDictionary from 'style-dictionary';

// ---- Mapping token path → nom de var CSS (D-12) -----------------------------

const VAR_NAME_MAP = {
  'color.surface.primary': 'background',
  'color.surface.card': 'card',
  'color.surface.muted': 'muted',
  'color.surface.driver': 'driver-surface',
  'color.surface.popover': 'popover',
  'color.text.primary': 'foreground',
  'color.text.muted': 'muted-foreground',
  'color.text.onAction': 'primary-foreground',
  'color.text.onAccent': 'accent-foreground',
  'color.text.onDanger': 'destructive-foreground',
  'color.text.onPopover': 'popover-foreground',
  'color.text.onCard': 'card-foreground',
  'color.action.primary': 'primary',
  'color.action.accent': 'accent',
  'color.action.focusRing': 'ring',
  'color.feedback.success': 'success',
  'color.feedback.warning': 'warning',
  'color.feedback.danger': 'destructive',
  'color.feedback.info': 'info',
  'color.border.default': 'border',
  'color.border.input': 'input',
  'radius.lg': 'radius',
};

// ---- Helpers ----------------------------------------------------------------

/** Extrait les composantes HSL d'une string `hsl(H S% L%)` → `H S% L%`. */
function stripHslWrapper(value) {
  const match = value.match(/^hsl\(([^)]+)\)$/);
  return match ? match[1].trim() : value;
}

/** Convertit `hsl(H S% L%)` en hex `#rrggbb` (pour les contextes JS). */
function hslToHex(hslString) {
  const stripped = stripHslWrapper(hslString);
  const parts = stripped.split(/\s+/);
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  const toHex = (n) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Sérialise une valeur de token en string CSS adaptée :
 *   - color HSL : composantes nues (`H S% L%`) pour réutilisation avec
 *     le pattern `hsl(var(--x) / <alpha-value>)` côté Tailwind.
 *   - autres : valeur telle quelle.
 */
function cssValue(token) {
  if (token.$type === 'color' && typeof token.$value === 'string') {
    return stripHslWrapper(token.$value);
  }
  return token.$value;
}

/** Parcours profond du JSON tokens pour produire une liste { path, token }. */
function flattenTokens(obj, prefix = []) {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value && '$type' in value) {
        out.push({ path: [...prefix, key].join('.'), token: value });
      } else {
        out.push(...flattenTokens(value, [...prefix, key]));
      }
    }
  }
  return out;
}

/** Indente proprement les lignes de déclaration CSS. */
function declLines(tokens, mapped) {
  return tokens
    .filter(({ path }) => (mapped ? VAR_NAME_MAP[path] : !VAR_NAME_MAP[path]))
    .map(({ path, token }) => {
      const name = mapped ? VAR_NAME_MAP[path] : path.replace(/\./g, '-');
      return `  --${name}: ${cssValue(token)};`;
    });
}

// ---- Custom format CSS (D-09, D-12) -----------------------------------------

StyleDictionary.registerFormat({
  name: 'tap/css-themed',
  format: async ({ dictionary, options }) => {
    const lightSource = options.lightSource;
    const darkSource = options.darkSource;

    const lightTokens = flattenTokens(lightSource);
    const darkTokens = flattenTokens(darkSource);

    // light : tous les tokens (mappés vers noms courts + invariants émis tels quels)
    const lightMapped = declLines(lightTokens, true);
    // dark : uniquement les overrides (tous mappés, vu que tokens.dark.json ne contient que les chromatiques)
    const darkMapped = declLines(darkTokens, true);

    return [
      '/* GÉNÉRÉ par tokens:build — ne pas éditer.',
      ' * Source : apps/web/src/styles/tokens.json + tokens.dark.json',
      ' * Régénérer : pnpm --filter @tap/web tokens:build',
      ' */',
      '',
      ':root {',
      ...lightMapped,
      '}',
      '',
      "[data-theme='dark'] {",
      ...darkMapped,
      '}',
      '',
    ].join('\n');
  },
});

// ---- Custom format JS hex (D-05, D-08) --------------------------------------

StyleDictionary.registerFormat({
  name: 'tap/js-hex',
  format: async ({ options }) => {
    const lightSource = options.lightSource;
    const darkSource = options.darkSource;

    function buildObject(source) {
      const tokens = flattenTokens(source).filter(({ token }) => token.$type === 'color');
      const out = {};
      for (const { path, token } of tokens) {
        const parts = path.split('.');
        let cursor = out;
        for (let i = 0; i < parts.length - 1; i++) {
          cursor[parts[i]] = cursor[parts[i]] ?? {};
          cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = hslToHex(token.$value);
      }
      return out;
    }

    const light = buildObject(lightSource);
    const dark = buildObject(darkSource);

    return [
      '/* GÉNÉRÉ par tokens:build — ne pas éditer.',
      ' * Source : apps/web/src/styles/tokens.json + tokens.dark.json',
      ' * Régénérer : pnpm --filter @tap/web tokens:build',
      ' *',
      ' * Export hex pour contextes hors-DOM (PDF @react-pdf/renderer,',
      ' * themeColor manifest PWA). Format hex `#rrggbb`.',
      ' */',
      '',
      `export const tokensLight = ${JSON.stringify(light, null, 2)} as const;`,
      '',
      `export const tokensDark = ${JSON.stringify(dark, null, 2)} as const;`,
      '',
      'export type TokensColor = typeof tokensLight;',
      '',
    ].join('\n');
  },
});

// ---- Hook simple : exécute les 2 formats avec accès aux 2 sources ----------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lightSource = JSON.parse(readFileSync(resolve(__dirname, 'src/styles/tokens.json'), 'utf8'));
const darkSource = JSON.parse(
  readFileSync(resolve(__dirname, 'src/styles/tokens.dark.json'), 'utf8'),
);

// Style Dictionary 4.x : instancier puis utiliser les formatters directement.
const sd = new StyleDictionary({});
await sd.hasInitialized;

const cssFormatter = StyleDictionary.hooks.formats['tap/css-themed'];
const jsFormatter = StyleDictionary.hooks.formats['tap/js-hex'];

const cssOutput = await cssFormatter({
  dictionary: { allTokens: [], tokens: {} },
  options: { lightSource, darkSource },
});

const jsOutput = await jsFormatter({
  dictionary: { allTokens: [], tokens: {} },
  options: { lightSource, darkSource },
});

const cssPath = resolve(__dirname, 'src/styles/tokens.generated.css');
const jsPath = resolve(__dirname, 'src/styles/tokens.generated.ts');

mkdirSync(dirname(cssPath), { recursive: true });

// Formatter via prettier pour rester idempotent vs guard-commit (D-11).
const prettierConfig = (await prettier.resolveConfig(cssPath)) ?? {};
const cssFormatted = await prettier.format(cssOutput, { ...prettierConfig, parser: 'css' });
const jsFormatted = await prettier.format(jsOutput, { ...prettierConfig, parser: 'typescript' });

writeFileSync(cssPath, cssFormatted, 'utf8');
writeFileSync(jsPath, jsFormatted, 'utf8');

console.log(`✓ Generated ${cssPath}`);
console.log(`✓ Generated ${jsPath}`);
