import { spawnSync } from 'node:child_process'

// ========= 变量 =========

/** 需要串行执行的窗口契约验证命令。 */
const checks = [
  {
    name: 'target-typecheck',
    command: 'pnpm',
    args: [
      'exec',
      'tsc',
      '--noEmit',
      '--target',
      'ES2023',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--lib',
      'ES2023',
      '--types',
      'node',
      '--types',
      'electron',
      '--strict',
      '--skipLibCheck',
      '--esModuleInterop',
      '--noUncheckedIndexedAccess',
      '--exactOptionalPropertyTypes',
      '--isolatedModules',
      'src/main/window-chrome.ts',
      'tests/unit/window-chrome.test.ts'
    ]
  },
  {
    name: 'window-chrome-tests',
    command: 'pnpm',
    args: ['exec', 'vitest', 'run', 'tests/unit/window-chrome.test.ts']
  }
]

// ========= 函数 =========

/** 执行一个窗口契约验证命令，失败时直接终止脚本。 */
function runCheck(check) {
  console.info(`[T-06] ${check.name}`)
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// ========= 生命周期 =========

for (const check of checks) runCheck(check)
console.info('[T-06] WindowChrome contract: pass')
