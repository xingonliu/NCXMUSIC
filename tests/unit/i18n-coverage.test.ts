import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { enUSSourceMessages } from '../../src/renderer/locales/en-US-source'

// ========= 变量 =========

/** 仓库根目录；Vitest 由项目根目录启动。 */
const REPOSITORY_ROOT = process.cwd()

// ========= 函数 =========

/** 执行国际化维护脚本并返回标准输出。 */
function runI18nScript(scriptPath: string, ...argumentsList: string[]): string {
  return execFileSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8'
  })
}

// ========= 测试 =========

describe('renderer i18n coverage', () => {
  it('keeps every compatibility translation free of untranslated Han text', () => {
    for (const [source, translation] of Object.entries(enUSSourceMessages)) {
      expect(translation, source).not.toMatch(/\p{Script=Han}/u)
    }
  })

  it('has no unregistered Chinese template or runtime UI strings', () => {
    /** 静态模板文案覆盖审计输出。 */
    const templateAudit = runI18nScript(
      'scripts/audit-i18n-coverage.mjs',
      'src/renderer',
      '--template-only',
      '--unmapped'
    )
    /** 运行时脚本文案覆盖审计输出。 */
    const scriptAudit = runI18nScript(
      'scripts/audit-i18n-coverage.mjs',
      'src/renderer',
      '--script-only',
      '--unmapped'
    )
    expect(templateAudit).toContain('TOTAL=0')
    expect(scriptAudit).toContain('TOTAL=0')
  })

  it('keeps static and dynamic Vue template migrations idempotent', () => {
    /** 静态模板迁移预检输出。 */
    const staticMigration = runI18nScript(
      'scripts/migrate-vue-template-i18n.mjs',
      'src/renderer',
      '--dry-run'
    )
    /** 动态模板迁移预检输出。 */
    const dynamicMigration = runI18nScript(
      'scripts/migrate-vue-template-i18n.mjs',
      'src/renderer',
      '--dynamic',
      '--dry-run'
    )
    expect(staticMigration).toContain('FILES=0 REPLACEMENTS=0')
    expect(dynamicMigration).toContain('FILES=0 REPLACEMENTS=0')
  })
})
