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
if (preload.includes('send:(...') || preload.includes('invoke:(...')) {
  throw new Error('Preload 不得暴露通用 IPC')
}

const utility = await readFile(join(projectRoot, 'out/main/utility.js'), 'utf8')
if (!utility.includes('parentPort')) {
  throw new Error('Utility 构建入口缺少 parentPort 控制面')
}

console.info('Build artifact contract: pass')
