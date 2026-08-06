import { spawnSync } from 'node:child_process'
import { platform } from 'node:os'

// ========= 变量 =========

const checks = [
  {
    name: 'typecheck',
    command: 'pnpm',
    args: ['exec', 'tsc', '-p', 'tsconfig.node.json', '--noEmit']
  },
  {
    name: 'shell-tests',
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      'tests/unit/shell-policy-classifier.test.ts',
      'tests/unit/shell-output-buffer.test.ts',
      'tests/unit/shell-process-supervisor.test.ts',
      'tests/unit/shell-executor.test.ts',
      'tests/contract/shell-execute-contract.test.ts',
      'tests/contract/runtime-contract.test.ts',
      'tests/contract/utility-runtime.test.ts'
    ]
  }
]

const powerShellAstProbe = `
$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput('Get-Location', [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw $errors[0].Message }
$commands = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true))
if ($commands.Count -ne 1 -or [string]$commands[0].GetCommandName() -ne 'Get-Location') { throw 'PowerShell AST command extraction failed' }
Write-Output 'PowerShell AST smoke: pass'
`

// ========= 函数 =========

/** 执行一个验证命令，并在失败时终止脚本。 */
function runCheck(check) {
  console.info(`[T-05] ${check.name}`)
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

/** 在 Windows 上执行 PowerShell AST 真实 Parser smoke。 */
function runPowerShellAstSmoke() {
  if (platform() !== 'win32') return
  console.info('[T-05] powershell-ast-smoke')
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', powerShellAstProbe],
    { stdio: 'inherit' }
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// ========= 生命周期 =========

for (const check of checks) runCheck(check)
runPowerShellAstSmoke()
console.info('[T-05] Shell process supervision: pass')
