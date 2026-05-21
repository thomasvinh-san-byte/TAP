// Configuration ESLint plate (flat config) du monorepo — ESLint 9.
// Résout la dette CI V1.5 « D1 » (VISION § Stratégie CI/qualité V1.5 → V3) :
// ESLint 9+ ne lit plus les fichiers `.eslintrc.*`, et le monorepo n'avait
// aucune configuration. Périmètre volontairement souple : le code n'a jamais
// été linté — les règles bruyantes sont en `warn` pour que la CI reste verte.
// Un durcissement progressif relève d'une phase dédiée, pas de cette wave.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.tsbuildinfo',
      'packages/database/src/types.gen.ts',
      'apps/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-undef': 'off',
      // Espaces irréguliers tolérés en commentaires et chaînes — code
      // d'encodage CSV utf-8-sig (BOM U+FEFF documenté), légitime.
      'no-irregular-whitespace': ['error', { skipComments: true, skipStrings: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
