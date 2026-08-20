import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2]
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const environment = { ...process.env, NCX_SMOKE_TEST: '1' }
const packagedRoot = process.argv[3]
  ? join(projectRoot, process.argv[3])
  : join(projectRoot, 'release')
delete environment.ELECTRON_RUN_AS_NODE

function packagedExecutable() {
  if (process.platform === 'win32') {
    return join(packagedRoot, 'win-unpacked', 'Ncxmusic.exe')
  }
  if (process.platform === 'darwin') {
    const candidates = ['mac-arm64', 'mac', 'mac-universal']
    for (const candidate of candidates) {
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
  throw new Error(`当前平台没有 packaged smoke 入口：${process.platform}`)
}

let command
let args
if (mode === 'development') {
  const electronVitePackage = require.resolve('electron-vite/package.json')
  const electronViteMetadata = require(electronVitePackage)
  const electronViteBin =
    typeof electronViteMetadata.bin === 'string'
      ? electronViteMetadata.bin
      : electronViteMetadata.bin?.['electron-vite']
  if (typeof electronViteBin !== 'string') throw new Error('electron-vite CLI 入口不可用')
  command = process.execPath
  args = [join(dirname(electronVitePackage), electronViteBin), 'dev']
} else if (mode === 'build') {
  command = require('electron')
  args = ['.']
} else if (mode === 'packaged') {
  command = packagedExecutable()
  args = []
} else {
  throw new Error(`未知 smoke 模式：${mode}`)
}

const child = spawn(command, args, {
  cwd: projectRoot,
  env: environment,
  stdio: 'inherit',
  windowsHide: true
})

const timeout = setTimeout(() => {
  console.error(`Electron ${mode} smoke 超时。`)
  child.kill()
  process.exitCode = 1
}, 60_000)

child.once('error', (error) => {
  clearTimeout(timeout)
  console.error(error)
  process.exitCode = 1
})

child.once('exit', (code, signal) => {
  clearTimeout(timeout)
  if (code !== 0) {
    console.error(`Electron ${mode} smoke 失败：code=${code}, signal=${signal}`)
    process.exitCode = code ?? 1
  } else {
    console.info(`Electron ${mode} smoke: pass`)
  }
})
