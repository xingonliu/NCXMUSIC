import { copyFileSync, existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ========= 变量 =========

/** 项目工程根目录。 */
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

/** 待同步的自定义 ICNS 图标源文件路径。 */
const sourceIcnsPath = join(projectRoot, 'resources/icon.icns')

/** macOS 本地开发依赖的 Electron.app 资源图标路径。 */
const electronAppIcnsPath = join(
  projectRoot,
  'node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns'
)

/** macOS 本地开发依赖的 Electron.app 根目录路径。 */
const electronAppBundlePath = join(
  projectRoot,
  'node_modules/electron/dist/Electron.app'
)

// ========= 函数 =========

/**
 * 将项目自定义图标同步到 node_modules 中 Electron.app 内部，
 * 确保 macOS 在本地开发模式下台前调度（Stage Manager）、程序坞（Dock）和切换器能正确读取应用图标。
 */
function syncDevelopmentElectronIcon() {
  if (process.platform !== 'darwin') return
  if (!existsSync(sourceIcnsPath) || !existsSync(electronAppIcnsPath)) return

  try {
    copyFileSync(sourceIcnsPath, electronAppIcnsPath)
    const now = new Date()
    utimesSync(electronAppBundlePath, now, now)
    console.info('Development Electron.app icon synchronized')
  } catch (error) {
    console.warn('Failed to sync development Electron icon:', error)
  }
}

// ========= 执行 =========

syncDevelopmentElectronIcon()
