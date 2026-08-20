import { readFile, stat } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const requiredArtifacts = [
  'out/main/index.js',
  'out/main/inputHook.js',
  'out/main/skillHost.js',
  'out/main/utility.js',
  'out/preload/index.js',
  'out/renderer/index.html'
]

for (const artifact of requiredArtifacts) {
  const metadata = await stat(join(projectRoot, artifact))
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error(`构建产物无效：${artifact}`)
  }
}

const preload = await readFile(join(projectRoot, 'out/preload/index.js'), 'utf8')
if (/require\(["']zod["']\)/u.test(preload)) {
  throw new Error('Sandboxed Preload 不得外置 zod')
}
if (!preload.includes('contextBridge')) {
  throw new Error('Preload 缺少受限 ContextBridge')
}
if (preload.includes('send:(...') || preload.includes('invoke:(...')) {
  throw new Error('Preload 不得暴露通用 IPC')
}

const utility = await readFile(join(projectRoot, 'out/main/utility.js'), 'utf8')
if (!utility.includes('parentPort')) {
  throw new Error('Utility 构建入口缺少 parentPort 控制面')
}
if (!utility.includes('createRequire') || !utility.includes('app.asar')) {
  throw new Error('Utility 缺少 packaged API Adapter 的确定模块解析入口')
}
/** Node.js 内置模块的带前缀与无前缀名称集合。 */
const builtinModuleNames = new Set(builtinModules.flatMap((name) => (
  name.startsWith('node:') ? [name, name.slice(5)] : [name, `node:${name}`]
)))
// Node.js 22 的实验性 SQLite 可能尚未出现在 builtinModules 列表中。
builtinModuleNames.add('node:sqlite')
builtinModuleNames.add('sqlite')
/** Utility 构建结果中保留的全部 CommonJS 模块引用。 */
const utilityRequires = [...utility.matchAll(/require\(["']([^"']+)["']\)/gu)]
  .map((match) => match[1])
  .filter((name) => name !== undefined)
/** 已由 electron-builder 明确解包、可供 Utility 直接解析的依赖前缀。 */
const unpackedUtilityDependencyPrefixes = ['ajv/', 'ajv-formats/']
/** 无法由解包入口安全解析的第三方外部模块。 */
const unsafeUtilityExternals = [...new Set(utilityRequires.filter((name) => (
  !name.startsWith('.') &&
  !builtinModuleNames.has(name) &&
  !unpackedUtilityDependencyPrefixes.some((prefix) => name.startsWith(prefix))
)))]
if (unsafeUtilityExternals.length > 0) {
  throw new Error(`Utility 不得外置第三方依赖：${unsafeUtilityExternals.join(', ')}`)
}

const inputHook = await readFile(join(projectRoot, 'out/main/inputHook.js'), 'utf8')
if (!inputHook.includes('uiohook-napi') || !inputHook.includes('parentPort')) {
  throw new Error('InputHookHost 构建入口缺少原生 Hook 加载或受限父进程通道')
}
if (/mousemove|mousedown|mouseup|wheel/u.test(inputHook)) {
  throw new Error('InputHookHost 不得监听或转发鼠标事件')
}

for (const artifact of ['out/preload/index.js', 'out/renderer/index.html']) {
  const content = await readFile(join(projectRoot, artifact), 'utf8')
  if (/MUSIC_U|cookieHeader|auth\.session\.probe|auth\.lease\.grant/u.test(content)) {
    throw new Error(`${artifact} 不得包含凭据租约控制面`)
  }
}

console.info('Build artifact contract: pass')
