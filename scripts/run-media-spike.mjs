import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─────────────────────────────────────────────────────────────────────────────
// T-03 播放媒体链路 Spike CLI
//
// 复用 T-02 持久 Profile 的网易云登录，然后启动 Electron 自动运行媒体 Smoke：
// 解析 → 装载 → 播放 → 暂停 → seek → 取消 → 快速切歌，并观测 Range/206/416。
//
// 用法：
//   pnpm t03:spike [--profile <name>] [--tracks <id1,id2,...>] [--target build|packaged]
//   pnpm t03:purge                      删除凭据 env 与测试 Profile
//
// 首次需要交互登录：
//   pnpm t02:spike --profile t03-test --scenario interactive --target build
// 之后每次只跑媒体验证：
//   pnpm t03:spike --profile t03-test
// ─────────────────────────────────────────────────────────────────────────────

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const _require = createRequire(import.meta.url)

// ── 变量区 ──

const T03_ENV = '.env.t03.local'

// ── 函数区 ──

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function redact(value) {
  return String(value)
    .replace(/(["']?(?:cookie(?:header)?|music_u|authorization|api[- ]?key|bearer)["']?\s*[:=]\s*)["'][^"'\r\n]*["']/giu, '$1"[REDACTED]"')
    .replace(/((?:cookie|authorization)\s*:\s*)[^\r\n]+/giu, '$1[REDACTED]')
    .replace(/((?:cookieheader|music_u|api[- ]?key|bearer)\s*[:=]\s*)["']?[^\s,;}"']+["']?/giu, '$1[REDACTED]')
}

function packagedExecutable(packagedRoot) {
  if (process.platform === 'win32') {
    const executable = join(packagedRoot, 'win-unpacked', 'NcxMusic.exe')
    if (existsSync(executable)) return executable
  }
  if (process.platform === 'darwin') {
    for (const candidate of ['mac-arm64', 'mac', 'mac-universal']) {
      const executable = join(packagedRoot, candidate, 'NcxMusic.app', 'Contents', 'MacOS', 'NcxMusic')
      if (existsSync(executable)) return executable
    }
  }
  throw new Error(`当前平台没有 T-03 packaged 入口：${process.platform}`)
}

// ── 主流程区 ──

const scenario = process.argv[2]
const subcommand = scenario === 'purge' ? 'purge' : 'run'

if (subcommand === 'purge') {
  const envPath = join(projectRoot, T03_ENV)
  const existedBefore = existsSync(envPath)
  try {
    await rm(envPath, { force: true })
    if (!existedBefore) console.info('未找到凭据 env 文件，无需清理。')
    else console.info(`已删除 ${T03_ENV}`)
  } catch (error) {
    console.error(`删除 ${T03_ENV} 失败：${error.message}`)
    process.exit(1)
  }

  const profilesDir = join(projectRoot, '.artifacts', 't03', 'profiles')
  if (existsSync(profilesDir)) {
    await rm(profilesDir, { recursive: true, force: true })
    console.info('已删除 T-03 测试 Profile 目录。')
  } else {
    console.info('未找到 T-03 测试 Profile 目录。')
  }
  console.info('purge 完成。如需同时退出网易云远端登录，请在已打开的 NcxMusic 窗口中重新扫码——NcxMusic 不存储你的账号密码。')
  process.exit(0)
}

// 正常运行
const target = option('target', 'build')
const profileName = option('profile', 't03-default')
const tracks = option('tracks', '')
const packageRoot = resolve(projectRoot, option('package-root', 'release'))

if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(profileName)) {
  throw new Error('profile 只允许小写字母、数字和连字符。')
}
if (!['build', 'packaged'].includes(target)) throw new Error(`未知目标：${target}`)

const artifactsRoot = resolve(projectRoot, '.artifacts', 't03')
const profilePath = resolve(artifactsRoot, 'profiles', profileName)
const relativeProfile = relative(artifactsRoot, profilePath)
if (relativeProfile.startsWith('..') || isAbsolute(relativeProfile)) {
  throw new Error('profile 路径越界。')
}
await mkdir(profilePath, { recursive: true })
await mkdir(join(artifactsRoot, 'evidence'), { recursive: true })

const command = target === 'packaged' ? packagedExecutable(packageRoot) : _require('electron')
const args = target === 'packaged'
  ? [`--user-data-dir=${profilePath}`]
  : ['.', `--user-data-dir=${profilePath}`]

const environment = {
  ...process.env,
  NCX_T03_SPIKE: '1',
  ...(tracks.trim() ? { NCX_T03_TRACKS: tracks.trim() } : {})
}
delete environment.ELECTRON_RUN_AS_NODE

console.info(`T-03 Spike (${target})；profile=${profileName}`)
if (tracks) console.info(`曲目 ID：${tracks}`)
else console.info('未指定曲目 ID（NCX_T03_TRACKS）；Smoke 将因缺少 t03tracks 参数而退出。')

const child = spawn(command, args, {
  cwd: projectRoot,
  env: environment,
  windowsHide: false,
  stdio: ['ignore', 'pipe', 'pipe']
})

let result
let buffered = ''
let containsCredentialValue = false
const consume = (chunk, stream) => {
  const raw = String(chunk)
  if (/music_u\s*[:=]\s*(?!\[REDACTED\])/iu.test(raw)) containsCredentialValue = true
  const safe = redact(raw)
  buffered = `${buffered}${safe}`.slice(-1_048_576)
  const writer = stream === 'stderr' ? process.stderr : process.stdout
  writer.write(safe)
  for (const line of buffered.split(/\r?\n/u)) {
    if (!line.startsWith('NCX_T03_RESULT ')) continue
    try {
      result = JSON.parse(line.slice('NCX_T03_RESULT '.length))
    } catch {
      // 格式错误留到 exit code 判定
    }
  }
}
child.stdout.on('data', (chunk) => consume(String(chunk), 'stdout'))
child.stderr.on('data', (chunk) => consume(String(chunk), 'stderr'))

const timeoutMs = 3 * 60_000
const exit = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => {
    child.kill()
    reject(new Error('T-03 Spike 超时。'))
  }, timeoutMs)
  child.once('error', (error) => {
    clearTimeout(timer)
    reject(error)
  })
  child.once('exit', (code, signal) => {
    clearTimeout(timer)
    resolveExit({ code, signal })
  })
})

const evidence = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  spike: 'T-03',
  target,
  platform: process.platform,
  arch: process.arch,
  profileName,
  exit,
  result: result ?? null,
  containsCredentialValue
}
const stamp = evidence.recordedAt.replace(/[:.]/gu, '-')
const evidencePath = join(artifactsRoot, 'evidence', `t03-${target}-${stamp}.json`)
await writeFile(`${evidencePath}`, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

if (exit.code !== 0 || result?.ok !== true || evidence.containsCredentialValue) {
  throw new Error(`T-03 Spike 未通过；脱敏证据：${evidencePath}`)
}

const mediaSummary = result?.mediaRequests
if (mediaSummary) {
  console.info(`媒体请求观测：${mediaSummary.recordCount} 次、206=${mediaSummary.sawPartialContent}、416=${mediaSummary.sawRangeNotSatisfiable}、Range=${mediaSummary.sawRangeRequest}、Content-Type=${JSON.stringify(mediaSummary.contentTypes)}`)
}
console.info(`T-03 Spike: pass；脱敏证据：${evidencePath}`)
