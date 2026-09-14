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
    files: [
      'src/renderer/features/music/lyrics-engine/base/**/*.ts',
      'src/renderer/features/music/lyrics-engine/dom/**/*.ts',
      'src/renderer/features/music/lyrics-engine/utils/**/*.ts'
    ],
    rules: {
      // 固定提交的 AMLL 内部源码沿用其编译器与 lint 假设；本地适配器仍执行项目严格规则。
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-irregular-whitespace': 'off',
      'no-useless-assignment': 'off'
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
