/* GÉNÉRÉ par tokens:build — ne pas éditer.
 * Source : apps/web/src/styles/tokens.json + tokens.dark.json
 * Régénérer : pnpm --filter @tap/web tokens:build
 *
 * Export hex pour contextes hors-DOM (PDF @react-pdf/renderer,
 * themeColor manifest PWA). Format hex `#rrggbb`.
 */

export const tokensLight = {
  color: {
    surface: {
      primary: '#ffffff',
      muted: '#f1f5f9',
      driver: '#fffcf5',
      popover: '#ffffff',
    },
    text: {
      primary: '#0f1729',
      muted: '#65758b',
      onAction: '#ffffff',
      onAccent: '#ffffff',
      onDanger: '#ffffff',
      onPopover: '#0f1729',
    },
    action: {
      primary: '#07409d',
      accent: '#e65d33',
      focusRing: '#07409d',
    },
    feedback: {
      success: '#1a9948',
      warning: '#f98806',
      danger: '#dc2828',
      info: '#3c83f6',
    },
    border: {
      default: '#e1e7ef',
      input: '#e1e7ef',
    },
  },
} as const;

export const tokensDark = {
  color: {
    surface: {
      primary: '#0b111e',
      muted: '#1d283a',
      driver: '#201a13',
      popover: '#0b111e',
    },
    text: {
      primary: '#f1f5f9',
      muted: '#94a3b8',
      onAction: '#0f1729',
      onAccent: '#0b111e',
      onDanger: '#ffffff',
      onPopover: '#f1f5f9',
    },
    action: {
      primary: '#3c83f6',
      accent: '#e96f49',
      focusRing: '#3c83f6',
    },
    feedback: {
      success: '#21c45d',
      warning: '#f9941f',
      danger: '#d02f2f',
      info: '#6da2f8',
    },
    border: {
      default: '#26344b',
      input: '#26344b',
    },
  },
} as const;

export type TokensColor = typeof tokensLight;
