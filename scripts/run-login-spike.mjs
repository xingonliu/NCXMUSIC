import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const allowedScenarios = new Set(['guest', 'invalid', 'expired', 'interactive', 'restore', 'logout', 'switch'])

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function redact(value) {
  return String(value)
    .replace(/(["']?cookie["']?\s*[:=]\s*)["'][^"'\r\n]*["']/giu, '$1"[REDACTED]"')
    .replace(/(cookie\s*:\s*)[^\r\n]+/giu, '$1[REDACTED]')
    .replace(/((?:music_u|authorization|bearer)\s*[:=]\s*)["']?[^"'\s,;}]+["']?/giu, '$1[REDACTED]')
}

function packagedExecutable() {
  if (process.platform === 'win32') {
    return join(projectRoot, 'release', 'win-unpacked', 'NcxMusic.exe')
  }
  if (process.platform === 'darwin') {
    return join(projectRoot, 'release', 'mac-arm64', 'NcxMusic.app', 'Contents', 'MacOS', 'NcxMusic')
  }
  throw new Error(`T-02 packaged Spike 暂不支持 ${process.platform}`)
}

const scenario = option('scenario', 'interactive')
const target = option('target', 'packaged')
const profileName = option('profile', scenario)
if (!allowedScenarios.has(scenario)) {
  throw new Error(`未知场景：${scenario}`)
}
if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(profileName)) {
  throw new Error('profile 只允许小写字母、数字和连字符。')
}
if (!['build', 'packaged'].includes(target)) {
  throw new Error(`未知目标：${target}`)
}

const artifactsRoot = resolve(projectRoot, '.artifacts', 't02')
const profilePath = resolve(artifactsRoot, 'profiles', profileName)
if (!profilePath.startsWith(`${artifactsRoot}${process.platform === 'win32' ? '\\' : '/'}`)) {
  throw new Error('profile 路径越界。')
}
await mkdir(profilePath, { recursive: true })
await mkdir(join(artifactsRoot, 'evidence'), { recursive: true })

const command = target === 'packaged' ? packagedExecutable() : require('electron')
const args = target === 'packaged' ? [`--user-data-dir=${profilePath}`] : ['.', `--user-data-dir=${profilePath}`]
const environment = {
  ...process.env,
  NCX_T02_SPIKE: '1',
  NCX_T02_SCENARIO: scenario
}
delete environment.ELECTRON_RUN_AS_NODE

console.info(`T-02 ${scenario} (${target})；profile=${profileName}`)
if (scenario === 'interactive') {
  console.info('请只在网易云官方登录窗口内完成二维码或官方交互；本程序不收集账号或密码。')
}

const child = spawn(command, args, {
  cwd: projectRoot,
  env: environment,
  windowsHide: false,
  stdio: ['ignore', 'pipe', 'pipe']
})

let result
let buffered = ''
const consume = (chunk, stream) => {
  const safe = redact(chunk)
  buffered = `${buffered}${safe}`.slice(-1_048_576)
  const writer = stream === 'stderr' ? process.stderr : process.stdout
  writer.write(safe)
  for (const line of buffered.split(/\r?\n/u)) {
    if (!line.startsWith('NCX_T02_RESULT ')) continue
    try {
      result = JSON.parse(line.slice('NCX_T02_RESULT '.length))
    } catch {
      // The app exit code will mark malformed evidence as failed.
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
  containsCredentialValue: /music_u\s*[:=]\s*(?!\[REDACTED\])/iu.test(buffered)
}
const stamp = evidence.recordedAt.replace(/[:.]/gu, '-')
const evidencePath = join(artifactsRoot, 'evidence', `${scenario}-${target}-${stamp}.json`)
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

if (exit.code !== 0 || result?.ok !== true || evidence.containsCredentialValue) {
  throw new Error(`T-02 ${scenario} 未通过；脱敏证据：${evidencePath}`)
}
console.info(`T-02 ${scenario}: pass；脱敏证据：${evidencePath}`)
