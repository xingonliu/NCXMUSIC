import { spawnSync } from 'node:child_process'

// ========= 变量 =========

/** 需要串行执行的 Provider 与 ASR 协议验证命令。 */
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
      'ES2023,DOM,DOM.Iterable',
      '--types',
      'node',
      '--strict',
      '--skipLibCheck',
      '--esModuleInterop',
      '--noUncheckedIndexedAccess',
      '--exactOptionalPropertyTypes',
      '--isolatedModules',
      'src/shared/errors/redact-sensitive-text.ts',
      'src/shared/errors/public-error.ts',
      'src/infrastructure/provider/provider-protocol.ts',
      'tests/unit/provider-protocol.test.ts'
    ]
  },
  {
    name: 'provider-protocol-tests',
    command: 'pnpm',
    args: ['exec', 'vitest', 'run', 'tests/unit/provider-protocol.test.ts']
  }
]

// ========= 函数 =========

/** 执行一个 Provider 与 ASR 协议验证命令，失败时直接终止脚本。 */
function runCheck(check) {
  console.info(`[T-08] ${check.name}`)
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// ========= 生命周期 =========

for (const check of checks) runCheck(check)
console.info('[T-08] Provider and ASR protocol fixtures: provisional-pass')
