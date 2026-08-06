import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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

// ── 构建产物：凭据控制面标记不得进入 Renderer/Preload 包 ──

const forbiddenBundleMarkers = /MUSIC_U|cookieHeader|auth\.session\.probe|auth\.lease\.grant/u
for (const relative of ['out/renderer', 'out/preload']) {
  for (const path of await filesUnder(join(root, relative), new Set(['.js', '.html', '.css']))) {
    const content = await readFile(path, 'utf8')
    if (forbiddenBundleMarkers.test(content)) {
      violations.push(`${relative} 包含凭据控制面标记：${path}`)
    }
  }
}

// ── 脱敏证据：不得包含明文 MusicU ──

for (const path of await filesUnder(
  join(root, '.artifacts', 't02', 'evidence'),
  new Set(['.json'])
)) {
  const content = await readFile(path, 'utf8')
  if (/music_u\s*[:=]\s*(?!\[REDACTED\])/iu.test(content)) {
    violations.push(`脱敏证据疑似包含凭据值：${path}`)
  }
}

// ── T-03 凭据 env：检查文件是否被提交到了 git ──

const envFilename = '.env.t03.local'
const envPath = join(root, envFilename)
if (existsSync(envPath)) {
  try {
    const tracked = execSync(
      `git ls-files --error-unmatch "${envFilename}"`,
      { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }
    )
    if (tracked.length > 0 || process.exitCode === undefined) {
      violations.push(
        `T-03 凭据 env（${envFilename}）已被 git 跟踪。该文件包含明文凭据，绝不能进入版本库。若此文件是最近才被添加的，请立即执行：git rm --cached ${envFilename} 然后重新提交。`
      )
    }
  } catch {
    // git ls-files --error-unmatch 以非零退出码表示未跟踪，这正是预期结果
  }
}

// ── T-03 凭据 env：sanitize 检查，确保不会被意外提交到 artifacts ──

const evidenceFiles = await filesUnder(
  join(root, '.artifacts', 't03'),
  new Set(['.json', '.txt', '.md'])
)
for (const path of evidenceFiles) {
  const content = await readFile(path, 'utf8')
  if (/NCX_T03_COOKIE_HEADER|NCX_T03_MUSIC_U/iu.test(content)) {
    violations.push(`T-03 证据文件疑似包含凭据 env 变量名：${path}`)
  }
}

// ── scripts/ 目录：不应包含硬编码凭据 ──

for (const path of await filesUnder(join(root, 'scripts'), new Set(['.js', '.mjs']))) {
  const content = await readFile(path, 'utf8')
  if (/MUSIC_U\s*[:=]\s*['"]?[^\s'"]{8,}/iu.test(content)) {
    violations.push(`脚本疑似包含硬编码凭据值：${path}`)
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exitCode = 1
} else {
  console.info('Auth boundary and redacted evidence scan: pass')
}
