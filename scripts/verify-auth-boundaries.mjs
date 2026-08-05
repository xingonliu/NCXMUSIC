import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const violations = []

async function filesUnder(directory, extensions) {
  const files = []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await filesUnder(path, extensions)))
    else if (extensions.has(extname(entry.name))) files.push(path)
  }
  return files
}

const forbiddenBundleMarkers = /MUSIC_U|cookieHeader|auth\.session\.probe|auth\.lease\.grant/u
for (const relative of ['out/renderer', 'out/preload']) {
  for (const path of await filesUnder(join(root, relative), new Set(['.js', '.html', '.css']))) {
    const content = await readFile(path, 'utf8')
    if (forbiddenBundleMarkers.test(content)) {
      violations.push(`${relative} 包含凭据控制面标记：${path}`)
    }
  }
}

for (const path of await filesUnder(join(root, '.artifacts', 't02', 'evidence'), new Set(['.json']))) {
  const content = await readFile(path, 'utf8')
  if (/music_u\s*[:=]\s*(?!\[REDACTED\])/iu.test(content)) {
    violations.push(`脱敏证据疑似包含凭据值：${path}`)
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.info('Auth boundary and redacted evidence scan: pass')
}
