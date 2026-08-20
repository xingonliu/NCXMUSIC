import { spawnSync } from 'node:child_process'

// ========= 变量 =========

/** 需要串行执行的系统媒体集成验证命令。 */
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
      'vite/client',
      '--strict',
      '--skipLibCheck',
      '--esModuleInterop',
      '--noUncheckedIndexedAccess',
      '--exactOptionalPropertyTypes',
      '--isolatedModules',
      'src/renderer/env.d.ts',
      'src/domains/player/types.ts',
      'src/domains/player/playback-coordinator.ts',
      'src/renderer/features/music/system-media-session.ts',
      'src/renderer/features/music/use-player.ts',
      'tests/unit/system-media-session.test.ts'
    ]
  },
  {
    name: 'system-media-tests',
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      'tests/unit/system-media-session.test.ts',
      'tests/unit/playback-coordinator.test.ts'
    ]
  }
]

// ========= 函数 =========

/** 执行一个系统媒体集成验证命令，失败时直接终止脚本。 */
function runCheck(check) {
  console.info(`[T-07] ${check.name}`)
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// ========= 生命周期 =========

for (const check of checks) runCheck(check)
console.info('[T-07] System media integration contract: pass')
