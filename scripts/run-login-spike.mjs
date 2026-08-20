import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const allowedScenarios = new Set([
  'guest',
  'invalid',
  'expired',
  'interactive',
  'restore',
  'logout',
  'switch'
])

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function redact(value) {
  return String(value)
    .replace(
      /(["']?(?:cookie(?:header)?|music_u|authorization|api[-_ ]?key|bearer)["']?\s*[:=]\s*)["'][^"'\r\n]*["']/giu,
      '$1"[REDACTED]"'
    )
    .replace(/((?:cookie|authorization)\s*:\s*)[^\r\n]+/giu, '$1[REDACTED]')
    .replace(
      /((?:cookieheader|music_u|api[-_ ]?key|bearer)\s*[:=]\s*)["']?[^\s,;}"']+["']?/giu,
      '$1[REDACTED]'
    )
}

function packagedExecutable(packagedRoot) {
  if (process.platform === 'win32') {
    const executable = join(packagedRoot, 'win-unpacked', 'Ncxmusic.exe')
    if (existsSync(executable)) return executable
  }
  if (process.platform === 'darwin') {
    for (const candidate of ['mac-arm64', 'mac', 'mac-universal']) {
      const executable = join(
        packagedRoot,
        candidate,
        'Ncxmusic.app',
        'Contents',
        'MacOS',
        'Ncxmusic'
      )
      if (existsSync(executable)) return executable
    }
  }
  throw new Error(`当前平台没有 T-02 packaged 入口：${process.platform}`)
}

const scenario = option('scenario', 'interactive')
const target = option('target', 'packaged')
const profileName = option('profile', scenario)
const packageRoot = resolve(projectRoot, option('package-root', 'release'))
if (!allowedScenarios.has(scenario)) throw new Error(`未知场景：${scenario}`)
if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(profileName)) {
  throw new Error('profile 只允许小写字母、数字和连字符。')
}
if (!['build', 'packaged'].includes(target)) throw new Error(`未知目标：${target}`)

const artifactsRoot = resolve(projectRoot, '.artifacts', 't02')
const profilePath = resolve(artifactsRoot, 'profiles', profileName)
const relativeProfile = relative(artifactsRoot, profilePath)
if (relativeProfile.startsWith('..') || isAbsolute(relativeProfile)) {
  throw new Error('profile 路径越界。')
}
await mkdir(profilePath, { recursive: true })
await mkdir(join(artifactsRoot, 'evidence'), { recursive: true })

const command = target === 'packaged' ? packagedExecutable(packageRoot) : require('electron')
const args =
  target === 'packaged'
    ? [`--user-data-dir=${profilePath}`]
    : ['.', `--user-data-dir=${profilePath}`]
const environment = {
  ...process.env,
  NCX_T02_SPIKE: '1',
  NCX_T02_SCENARIO: scenario
}
delete environment.ELECTRON_RUN_AS_NODE

console.info(`T-02 ${scenario} (${target})；profile=${profileName}`)
if (scenario === 'interactive') {
  console.info('请只在网易云官方登录窗口内完成交互；Ncxmusic 不收集账号或密码。')
}

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
    if (!line.startsWith('NCX_T02_RESULT ')) continue
    try {
      result = JSON.parse(line.slice('NCX_T02_RESULT '.length))
    } catch {
      // The process exit code will reject malformed evidence.
    }
  }
}
child.stdout.on('data', (chunk) => consume(String(chunk), 'stdout'))
child.stderr.on('data', (chunk) => consume(String(chunk), 'stderr'))

const timeoutMs = scenario === 'interactive' ? 11 * 60 * 1_000 : 90_000
const exit = await new Promise((resolveExit, reject) => {
  const timer = setTimeout(() => {
    child.kill()
    reject(new Error(`T-02 ${scenario} 超时。`))
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
  scenario,
  target,
  platform: process.platform,
  arch: process.arch,
  profileName,
  exit,
  result: result ?? null,
  containsCredentialValue
}
const stamp = evidence.recordedAt.replace(/[:.]/gu, '-')
const evidencePath = join(artifactsRoot, 'evidence', `${scenario}-${target}-${stamp}.json`)
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

if (exit.code !== 0 || result?.ok !== true || evidence.containsCredentialValue) {
  throw new Error(`T-02 ${scenario} 未通过；脱敏证据：${evidencePath}`)
}
console.info(`T-02 ${scenario}: pass；脱敏证据：${evidencePath}`)
