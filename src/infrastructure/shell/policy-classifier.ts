import { spawn } from 'node:child_process'

import {
  ShellPolicyDecisionSchema,
  type ExecuteShellInput,
  type ShellCommandTag,
  type ShellPolicyDecision,
  type ShellSafetyLevel
} from '../../shared/schemas/shell'
import type { ResolvedShellWorkspace, ShellWorkspaceRegistry } from './workspace-registry'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export type ShellPlatform = 'win32' | 'darwin'

export interface PowerShellAstInspection {
  /** PowerShell Parser 是否接受该命令文本。 */
  syntaxOk: boolean
  /** Parser 或 AST 检查返回的原因。 */
  reason?: string
  /** AST 中提取到的命令节点名称。 */
  commands: string[]
  /** 是否包含脚本块、变量展开、管道、重定向等动态/复合语法。 */
  hasUnsafeAst: boolean
}

export interface PowerShellAstInspector {
  /** 使用 PowerShell Parser 解析命令并返回 AST 摘要。 */
  inspect(command: string): Promise<PowerShellAstInspection>
}

export interface ZshSyntaxChecker {
  /** 使用 zsh -n 或测试替身检查语法是否有效。 */
  check(command: string): Promise<{ ok: boolean; reason?: string }>
}

export interface ShellPolicyClassifierOptions {
  /** 当前运行平台；只支持 Windows 与 macOS。 */
  platform: ShellPlatform
  /** 当前 Shell 自动执行安全等级。 */
  safetyLevel: ShellSafetyLevel
  /** 工作区边界解析器。 */
  workspaceRegistry: ShellWorkspaceRegistry
  /** PowerShell AST 检查器；Windows 默认调用 powershell.exe Parser。 */
  powershellAstInspector?: PowerShellAstInspector
  /** zsh 语法检查器；macOS 默认调用 /bin/zsh -n。 */
  zshSyntaxChecker?: ZshSyntaxChecker
}

interface ParsedCommand {
  /** 标准化后的可执行文件名。 */
  executable: string
  /** 原始 token 序列，首项为可执行文件。 */
  tokens: string[]
}

interface TemplateDecision {
  /** 模板所属风险标签。 */
  tags: ShellCommandTag[]
  /** 该命令自动执行所需的最低等级。 */
  minimumLevel: ShellSafetyLevel
  /** 该模板是否可被自动理解。 */
  recognized: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量区
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<ShellSafetyLevel, number> = { S1: 1, S2: 2, S3: 3, S4: 4 }
const POWERSHELL_FORBIDDEN_ARGUMENTS = new Set([
  '-encodedcommand',
  '-enc',
  '-executionpolicy',
  '-file',
  '-command',
  '-windowstyle'
])
const ZSH_FORBIDDEN_SYNTAX = /(?:;|&&|\|\||\||>|<|`|\$\(|\$\{|\$[A-Za-z_]|\n|\r|&)/u
const WILDCARD_PATH = /[*?[\]{}]/u

// ─────────────────────────────────────────────────────────────────────────────
// 默认平台语法检查区
// ─────────────────────────────────────────────────────────────────────────────

export class NativePowerShellAstInspector implements PowerShellAstInspector {
  /** 使用 powershell.exe Parser 输出严格 JSON 摘要，不执行用户命令。 */
  inspect(command: string): Promise<PowerShellAstInspection> {
    const script = `
$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput([string]$payload.command, [ref]$tokens, [ref]$errors)
$commands = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { [string]$_.GetCommandName() })
$unsafe = @($ast.FindAll({ param($node)
  $name = $node.GetType().Name
  if ($name -in @('ScriptBlockExpressionAst','SubExpressionAst','ExpandableStringExpressionAst','VariableExpressionAst','AssignmentStatementAst','RedirectionAst','CommandExpressionAst','InvokeMemberExpressionAst','TypeExpressionAst','UsingExpressionAst','ForEachStatementAst','IfStatementAst','WhileStatementAst','DoWhileStatementAst','TrapStatementAst')) { return $true }
  if ($name -eq 'PipelineAst' -and $node.PipelineElements.Count -gt 1) { return $true }
  if ($name -eq 'StatementBlockAst' -and $node.Statements.Count -gt 1) { return $true }
  return $false
}, $true))
$result = [pscustomobject]@{
  syntaxOk = $errors.Count -eq 0
  reason = if ($errors.Count -eq 0) { '' } else { [string]$errors[0].Message }
  commands = $commands
  hasUnsafeAst = $unsafe.Count -gt 0
}
$result | ConvertTo-Json -Compress
`
    return new Promise((resolve) => {
      const child = spawn('powershell.exe', [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ])
      const chunks: Buffer[] = []
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      child.once('error', (error) => {
        resolve({ syntaxOk: false, reason: error.message, commands: [], hasUnsafeAst: true })
      })
      child.once('exit', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
          const reason = typeof parsed['reason'] === 'string' && parsed['reason'] ? parsed['reason'] : undefined
          resolve({
            syntaxOk: parsed['syntaxOk'] === true,
            commands: Array.isArray(parsed['commands'])
              ? parsed['commands'].filter((item): item is string => typeof item === 'string')
              : [],
            hasUnsafeAst: parsed['hasUnsafeAst'] === true,
            ...(reason ? { reason } : {})
          })
        } catch (error) {
          resolve({
            syntaxOk: false,
            reason: error instanceof Error ? error.message : 'PowerShell AST JSON parse failed',
            commands: [],
            hasUnsafeAst: true
          })
        }
      })
      child.stdin.end(JSON.stringify({ command }))
    })
  }
}

export class NativeZshSyntaxChecker implements ZshSyntaxChecker {
  /** 使用 zsh -n 只做语法检查，不执行用户命令。 */
  check(command: string): Promise<{ ok: boolean; reason?: string }> {
    return new Promise((resolve) => {
      const child = spawn('/bin/zsh', ['-f', '-n', '-c', command])
      const stderr: Buffer[] = []
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
      child.once('error', (error) => resolve({ ok: false, reason: error.message }))
      child.once('exit', (code) => {
        const reason = Buffer.concat(stderr).toString('utf8').trim()
        resolve({
          ok: code === 0,
          ...(code === 0 || !reason ? {} : { reason })
        })
      })
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ShellPolicyClassifier
// ─────────────────────────────────────────────────────────────────────────────

export class ShellPolicyClassifier {
  // ── 变量区 ──
  private readonly platform: ShellPlatform
  private safetyLevel: ShellSafetyLevel
  private readonly workspaceRegistry: ShellWorkspaceRegistry
  private readonly powershellAstInspector: PowerShellAstInspector
  private readonly zshSyntaxChecker: ZshSyntaxChecker

  constructor(options: ShellPolicyClassifierOptions) {
    this.platform = options.platform
    this.safetyLevel = options.safetyLevel
    this.workspaceRegistry = options.workspaceRegistry
    this.powershellAstInspector = options.powershellAstInspector ?? new NativePowerShellAstInspector()
    this.zshSyntaxChecker = options.zshSyntaxChecker ?? new NativeZshSyntaxChecker()
  }

  // ── 函数区 ──

  /** 应用 Agent 当前唯一 CommandSafetyControl 等级。 */
  setSafetyLevel(safetyLevel: ShellSafetyLevel): void {
    this.safetyLevel = safetyLevel
  }

  /** 对 Shell Tool 输入做确定性分类，返回 allow/ask/deny。 */
  async classify(input: ExecuteShellInput): Promise<ShellPolicyDecision> {
    /** 按当前 Shell 平台归一后的执行目录。 */
    const normalizedCwd = input.cwd === undefined ? undefined : this.normalizePathLikeToken(input.cwd)
    let workspace: ResolvedShellWorkspace
    try {
      workspace = this.workspaceRegistry.resolve(input.workspaceId, normalizedCwd)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Shell workspace boundary rejected the command'
      return this.decision('deny', reason, ['unknown'], 'unknown', input.command)
    }
    const platformCheck = await this.checkPlatformSyntax(input.command)
    if (!platformCheck.ok) {
      return this.decision('deny', platformCheck.reason, ['unknown'], 'unknown', input.command)
    }
    if (platformCheck.reason.includes('需审批')) {
      return this.decision('ask', platformCheck.reason, ['unknown'], 'unknown', input.command)
    }

    const parsed = this.parseSingleCommand(input.command)
    if (!parsed) {
      return this.decision('ask', '命令结构超出保守分类器理解范围。', ['unknown'], 'unknown', input.command)
    }

    let hardBoundary: string | undefined
    try {
      hardBoundary = this.checkHardBoundaries(parsed, workspace)
    } catch (error) {
      hardBoundary = error instanceof Error ? error.message : 'Shell hard boundary rejected the command'
    }
    if (hardBoundary) {
      return this.decision('deny', hardBoundary, ['unknown'], parsed.executable, input.command)
    }

    let template: TemplateDecision
    try {
      template = this.classifyTemplate(parsed, workspace)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Shell template boundary rejected the command'
      return this.decision('deny', reason, ['unknown'], parsed.executable, input.command)
    }
    if (!template.recognized) {
      return this.decision('ask', '命令模板未注册，需要逐次审批。', template.tags, parsed.executable, input.command)
    }
    if (this.safetyLevel === 'S1') {
      return this.decision('ask', 'S1 要求所有 Shell 命令逐次审批。', template.tags, parsed.executable, input.command)
    }
    if (LEVEL_ORDER[this.safetyLevel] < LEVEL_ORDER[template.minimumLevel]) {
      return this.decision(
        'ask',
        `${template.minimumLevel} 模板在当前 ${this.safetyLevel} 等级下需要审批。`,
        template.tags,
        parsed.executable,
        input.command
      )
    }
    return this.decision('allow', '命令匹配已注册模板且未越过工作区边界。', template.tags, parsed.executable, input.command)
  }

  private async checkPlatformSyntax(command: string): Promise<{ ok: boolean; reason: string }> {
    if (this.platform === 'win32') {
      const inspected = await this.powershellAstInspector.inspect(command)
      if (!inspected.syntaxOk) return { ok: false, reason: inspected.reason ?? 'PowerShell 语法无效。' }
      if (inspected.commands.length !== 1 || inspected.hasUnsafeAst) {
        return { ok: true, reason: 'PowerShell AST 包含复合或动态语法，需审批。' }
      }
      return { ok: true, reason: 'PowerShell AST 通过。' }
    }

    const syntax = await this.zshSyntaxChecker.check(command)
    if (!syntax.ok) return { ok: false, reason: syntax.reason ?? 'zsh 语法无效。' }
    if (ZSH_FORBIDDEN_SYNTAX.test(command)) {
      return { ok: true, reason: 'zsh 命令包含复合语法或动态展开，需审批。' }
    }
    return { ok: true, reason: 'zsh 语法通过。' }
  }

  private parseSingleCommand(command: string): ParsedCommand | undefined {
    const tokens = tokenizeShellCommand(command)
    const executable = tokens[0]?.toLowerCase()
    if (!executable) return undefined
    return { executable, tokens }
  }

  private checkHardBoundaries(parsed: ParsedCommand, workspace: ResolvedShellWorkspace): string | undefined {
    if (this.platform === 'win32' && parsed.tokens.some((token) => POWERSHELL_FORBIDDEN_ARGUMENTS.has(token.toLowerCase()))) {
      return 'PowerShell 启动参数或编码命令不能进入 Shell Tool。'
    }
    if (parsed.tokens.some((token) => /(?:music_u|cookie|authorization|api[-_]?key|bearer)/iu.test(token))) {
      return '命令包含疑似凭据字面量，已被硬边界拒绝。'
    }
    if (parsed.tokens.some((token) => WILDCARD_PATH.test(token))) {
      return '自动执行模板不接受通配符路径。'
    }

    for (const path of collectPotentialPathArguments(parsed)) {
      this.workspaceRegistry.resolvePathArgument(this.normalizePathLikeToken(path), workspace)
    }
    return undefined
  }

  /** 将命令中的平台路径分隔符转换为当前进程可验证的形式。 */
  private normalizePathLikeToken(token: string): string {
    if (this.platform !== 'win32') return token
    return token.replaceAll('\\', '/')
  }

  private classifyTemplate(parsed: ParsedCommand, workspace: ResolvedShellWorkspace): TemplateDecision {
    if (this.isGitTemplate(parsed)) return this.gitTemplate(parsed)
    if (this.platform === 'win32') return this.windowsTemplate(parsed, workspace)
    return this.zshTemplate(parsed, workspace)
  }

  private isGitTemplate(parsed: ParsedCommand): boolean {
    return parsed.executable === 'git' && parsed.tokens.length >= 2
  }

  private gitTemplate(parsed: ParsedCommand): TemplateDecision {
    const subcommand = parsed.tokens[1]?.toLowerCase() ?? ''
    if (['status', 'diff', 'log', 'show'].includes(subcommand)) {
      return { recognized: true, tags: ['read', 'vcs'], minimumLevel: 'S2' }
    }
    if (['add', 'restore'].includes(subcommand)) {
      return { recognized: true, tags: ['write', 'vcs'], minimumLevel: 'S3' }
    }
    if (['fetch', 'pull'].includes(subcommand)) {
      return { recognized: true, tags: ['network', 'vcs'], minimumLevel: 'S4' }
    }
    if (['commit', 'push', 'tag'].includes(subcommand)) {
      return { recognized: true, tags: ['publish', 'vcs'], minimumLevel: 'S4' }
    }
    return { recognized: false, tags: ['unknown', 'vcs'], minimumLevel: 'S4' }
  }

  private windowsTemplate(parsed: ParsedCommand, workspace: ResolvedShellWorkspace): TemplateDecision {
    const name = parsed.executable
    if (['get-location'].includes(name)) return { recognized: true, tags: ['read'], minimumLevel: 'S2' }
    if (['get-childitem', 'get-item', 'get-content', 'test-path', 'select-string'].includes(name)) {
      return { recognized: true, tags: ['read'], minimumLevel: 'S2' }
    }
    if (['new-item', 'set-content', 'add-content', 'copy-item', 'move-item', 'rename-item'].includes(name)) {
      return { recognized: true, tags: ['write'], minimumLevel: 'S3' }
    }
    if (['remove-item'].includes(name)) {
      this.ensureNoWorkspaceRootTarget(parsed, workspace)
      return { recognized: true, tags: ['delete'], minimumLevel: 'S4' }
    }
    if (['pnpm', 'npm', 'yarn'].includes(name)) return classifyPackageManager(parsed)
    return { recognized: false, tags: ['unknown'], minimumLevel: 'S4' }
  }

  private zshTemplate(parsed: ParsedCommand, workspace: ResolvedShellWorkspace): TemplateDecision {
    const name = parsed.executable
    if (['pwd', 'ls', 'stat', 'file', 'head', 'tail', 'wc', 'grep', 'rg'].includes(name)) {
      return { recognized: true, tags: ['read'], minimumLevel: 'S2' }
    }
    if (name === 'find') return classifyFind(parsed)
    if (['touch', 'mkdir', 'cp', 'mv'].includes(name)) return { recognized: true, tags: ['write'], minimumLevel: 'S3' }
    if (name === 'rm') {
      this.ensureNoWorkspaceRootTarget(parsed, workspace)
      return { recognized: true, tags: ['delete'], minimumLevel: 'S4' }
    }
    if (['pnpm', 'npm', 'yarn'].includes(name)) return classifyPackageManager(parsed)
    return { recognized: false, tags: ['unknown'], minimumLevel: 'S4' }
  }

  private ensureNoWorkspaceRootTarget(parsed: ParsedCommand, workspace: ResolvedShellWorkspace): void {
    for (const path of collectPotentialPathArguments(parsed)) {
      if (this.workspaceRegistry.resolvePathArgument(path, workspace) === workspace.rootPath) {
        throw new Error('Shell delete or move target cannot be the workspace root')
      }
    }
  }

  private decision(
    action: ShellPolicyDecision['action'],
    reason: string,
    tags: ShellCommandTag[],
    executable: string,
    normalizedCommand: string
  ): ShellPolicyDecision {
    return ShellPolicyDecisionSchema.parse({ action, reason, tags, executable, normalizedCommand })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 使用保守 tokenizer 解析单条命令；引号只用于构造字面量，不触发展开。 */
export function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: 'single' | 'double' | undefined
  let escaping = false

  for (const char of command.trim()) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }
    if (char === '\\') {
      current += char
      continue
    }
    if (char === "'" && quote !== 'double') {
      quote = quote === 'single' ? undefined : 'single'
      continue
    }
    if (char === '"' && quote !== 'single') {
      quote = quote === 'double' ? undefined : 'double'
      continue
    }
    if (/\s/u.test(char) && !quote) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += char
  }

  if (quote) return []
  if (current) tokens.push(current)
  return tokens
}

/** 提取模板中可能代表文件系统路径的参数。 */
export function collectPotentialPathArguments(parsed: ParsedCommand): string[] {
  const paths: string[] = []
  for (let index = 1; index < parsed.tokens.length; index += 1) {
    const token = parsed.tokens[index]
    if (!token || token === '--') continue
    if (token.startsWith('-')) {
      const next = parsed.tokens[index + 1]
      if (expectsPathValue(parsed.executable, token) && next && !next.startsWith('-')) {
        paths.push(next)
        index += 1
      }
      continue
    }
    if (looksLikePath(parsed, token, index)) paths.push(token)
  }
  return paths
}

/** 判断一个 flag 是否应将后续 token 视为路径。 */
function expectsPathValue(executable: string, flag: string): boolean {
  const name = executable.toLowerCase()
  const normalized = flag.toLowerCase()
  if (['get-childitem', 'get-item', 'get-content', 'test-path', 'select-string'].includes(name)) {
    return ['-path', '-literalpath'].includes(normalized)
  }
  if (['new-item', 'set-content', 'add-content', 'copy-item', 'move-item', 'rename-item', 'remove-item'].includes(name)) {
    return ['-path', '-literalpath', '-destination', '-targetpath'].includes(normalized)
  }
  return false
}

/** 判断普通 token 是否应按路径做工作区校验。 */
function looksLikePath(parsed: ParsedCommand, token: string, index: number): boolean {
  const name = parsed.executable.toLowerCase()
  if (name === 'git' && index <= 2) return false
  if (['grep', 'rg'].includes(name) && index === 1) return false
  if (name === 'find' && index === 1) return true
  if (['pnpm', 'npm', 'yarn'].includes(name) && index <= 2) return false
  if (/^(?:\.|\.\.|[\w.-]+)(?:[\\/][\w .-]+)*$/u.test(token)) return true
  return token.includes('/') || token.includes('\\')
}

/** 对 find 做额外限制，禁止 -exec、-delete、-ok 等副作用谓词。 */
function classifyFind(parsed: ParsedCommand): TemplateDecision {
  const forbidden = new Set(['-exec', '-execdir', '-delete', '-ok', '-okdir'])
  if (parsed.tokens.some((token) => forbidden.has(token.toLowerCase()))) {
    return { recognized: false, tags: ['unknown'], minimumLevel: 'S4' }
  }
  return { recognized: true, tags: ['read'], minimumLevel: 'S2' }
}

/** 对常见包管理器模板做构建、测试、安装和发布分类。 */
function classifyPackageManager(parsed: ParsedCommand): TemplateDecision {
  const subcommand = parsed.tokens[1]?.toLowerCase() ?? ''
  const scriptName = parsed.tokens[2]?.toLowerCase() ?? ''
  if (['test', 'lint', 'build', 'typecheck'].includes(subcommand)) {
    return { recognized: true, tags: subcommand === 'test' ? ['test'] : ['build'], minimumLevel: 'S3' }
  }
  if (subcommand === 'run' && ['test', 'lint', 'build', 'typecheck'].includes(scriptName)) {
    return { recognized: true, tags: scriptName === 'test' ? ['test'] : ['build'], minimumLevel: 'S3' }
  }
  if (['install', 'add', 'remove', 'update'].includes(subcommand)) {
    return { recognized: true, tags: ['install', 'network', 'write'], minimumLevel: 'S4' }
  }
  if (['publish'].includes(subcommand)) {
    return { recognized: true, tags: ['publish', 'network'], minimumLevel: 'S4' }
  }
  return { recognized: false, tags: ['unknown'], minimumLevel: 'S4' }
}
