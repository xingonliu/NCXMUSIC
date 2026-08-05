import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.artifacts/**',
      '.reasonix/**',
      'coverage/**',
      'docs/api/**',
      'dome/**',
      'node_modules/**',
      'out/**',
      'playwright-report/**',
      'release/**',
      'scripts/api-audit/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-undef': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/main/**',
            '**/preload/**',
            '**/utility/**',
            '**/infrastructure/credentials/**',
            '**/infrastructure/netease/**',
            '**/infrastructure/persistence/**',
            '**/infrastructure/shell/**'
          ]
        }
      ]
    }
  }
)
