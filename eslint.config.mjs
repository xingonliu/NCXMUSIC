import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'release/**',
      'coverage/**',
      'docs/api/reports/**',
      'scripts/api-audit/**',
      'dome/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error'
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
    files: ['src/renderer/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '**/main/**',
            '**/preload/**',
            '**/utility/**',
            '**/infrastructure/netease/**',
            '**/infrastructure/credentials/**',
            '**/infrastructure/persistence/**',
            '**/infrastructure/shell/**'
          ]
        }
      ]
    }
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly'
      }
    }
  },
  {
    files: ['scripts/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly'
      }
    }
  }
)
