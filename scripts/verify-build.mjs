import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const requiredArtifacts = [
  'out/main/index.js',
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

const utility = await readFile(join(projectRoot, 'out/main/utility.js'), 'utf8')
if (!utility.includes('parentPort')) {
  throw new Error('Utility 构建入口缺少 parentPort 控制面')
}
if (!utility.includes('createRequire') || !utility.includes('app.asar')) {
  throw new Error('Utility 缺少 packaged API Adapter 的确定模块解析入口')
}

for (const artifact of ['out/preload/index.js', 'out/renderer/index.html']) {
  const content = await readFile(join(projectRoot, artifact), 'utf8')
  if (/MUSIC_U|cookieHeader|auth\.lease\.grant/u.test(content)) {
    throw new Error(`${artifact} 不得包含凭据租约控制面`)
  }
}

console.info('Build artifact contract: pass')
