import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// ========= 类型 =========

/** 测试关心的 Windows 打包身份配置。 */
interface WindowsPackageManifest {
  /** Electron 运行时优先读取的产品显示名称。 */
  readonly productName?: string
  /** electron-builder 打包配置。 */
  readonly build?: {
    /** Windows Shell 使用的稳定应用标识。 */
    readonly appId?: string
    /** 打包产物使用的产品名称。 */
    readonly productName?: string
    /** Windows 主程序文件名。 */
    readonly executableName?: string
    /** Windows 平台配置。 */
    readonly win?: {
      /** Windows 应用图标。 */
      readonly icon?: string
    }
    /** NSIS 安装器配置。 */
    readonly nsis?: Record<string, unknown>
  }
}

// ========= 变量 =========

/** 当前项目清单。 */
const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as WindowsPackageManifest

/** Main 进程入口源码。 */
const mainSource = readFileSync('src/main/index.ts', 'utf8')

// ========= 测试 =========

describe('Windows package identity', () => {
  it('显式固定应用、可执行文件与 NSIS 全部用户可见名称', () => {
    expect(manifest.productName).toBe('Ncxmusic')
    expect(manifest.build?.appId).toBe('io.github.ncxmusic.app')
    expect(manifest.build?.productName).toBe('Ncxmusic')
    expect(manifest.build?.executableName).toBe('Ncxmusic')
    expect(manifest.build?.nsis).toMatchObject({
      artifactName: 'Ncxmusic Setup ${version}.${ext}',
      shortcutName: 'Ncxmusic',
      uninstallDisplayName: 'Ncxmusic ${version}'
    })
  })

  it('显式固定应用、安装器、卸载器与快捷方式图标', () => {
    expect(manifest.build?.win?.icon).toBe('build/icon.ico')
    expect(manifest.build?.nsis).toMatchObject({
      installerIcon: 'build/icon.ico',
      installerHeaderIcon: 'build/icon.ico',
      uninstallerIcon: 'build/icon.ico',
      createDesktopShortcut: true,
      createStartMenuShortcut: true
    })
  })

  it('在创建任何窗口前注册 Windows 身份并覆盖所有窗口任务栏详情', () => {
    /** AppUserModelID 注册位置。 */
    const identityIndex = mainSource.indexOf('app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID)')
    /** 单实例锁申请位置；发生在所有窗口创建之前。 */
    const singleInstanceIndex = mainSource.indexOf('app.requestSingleInstanceLock()')

    expect(identityIndex).toBeGreaterThan(0)
    expect(identityIndex).toBeLessThan(singleInstanceIndex)
    expect(mainSource).toContain("process.platform === 'win32' ? 'icon.ico' : 'icon.png'")
    expect(mainSource.match(/applyWindowsWindowIdentity\(window\)/gu)).toHaveLength(2)
  })
})
