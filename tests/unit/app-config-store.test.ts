import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AppConfigStore } from '../../src/main/app-config-store'

// ========= 变量 =========

/** 测试期间创建的临时配置目录。 */
const temporaryDirectories: string[] = []

// ========= 函数 =========

/** 创建独占的 Main 配置目录。 */
function configRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'ncx-app-config-'))
  temporaryDirectories.push(root)
  return root
}

// ========= 测试 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('AppConfigStore', () => {
  it('由 Main 持久化关闭即退出偏好并在重启后恢复', () => {
    const root = configRoot()
    const firstRun = new AppConfigStore(root)
    expect(firstRun.load().closeWindowBehavior).toBe('minimize')
    firstRun.setCloseWindowBehavior('quit')

    const restarted = new AppConfigStore(root)
    expect(restarted.load().closeWindowBehavior).toBe('quit')
  })

  it('配置损坏时安全回退到最小化', () => {
    const root = configRoot()
    writeFileSync(join(root, 'ncx-config.json'), '{not-json', 'utf8')
    expect(new AppConfigStore(root).load().closeWindowBehavior).toBe('minimize')
  })
})
