import { existsSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellWorkspace {
  /** 用户授权工作区 ID。 */
  id: string
  /** 用户授权工作区根目录，必须是绝对路径。 */
  rootPath: string
}

export interface ResolvedShellWorkspace {
  /** 已解析的工作区 ID。 */
  workspaceId: string
  /** 规范化后的工作区根目录。 */
  rootPath: string
  /** 规范化后的执行目录。 */
  cwd: string
}

export interface ShellWorkspaceRegistryOptions {
  /** 应用管理的默认空白工作区。 */
  defaultWorkspaceRoot: string
  /** 用户已经授权的工作区列表。 */
  workspaces?: ShellWorkspace[]
  /** 可注入的真实路径解析器，测试中用于模拟 symlink/junction。 */
  realpath?: (path: string) => string
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量区
// ─────────────────────────────────────────────────────────────────────────────

const WINDOWS_DEVICE_PATH = /^\\\\[.?]\\/u
const WINDOWS_DRIVE = /^[a-z]:/iu

// ─────────────────────────────────────────────────────────────────────────────
// ShellWorkspaceRegistry
// ─────────────────────────────────────────────────────────────────────────────

export class ShellWorkspaceRegistry {
  // ── 变量区 ──
  private readonly workspaces = new Map<string, ShellWorkspace>()
  private readonly defaultWorkspaceRoot: string
  private readonly realpath: (path: string) => string

  constructor(options: ShellWorkspaceRegistryOptions) {
    this.defaultWorkspaceRoot = resolve(options.defaultWorkspaceRoot)
    this.realpath = options.realpath ?? ShellWorkspaceRegistry.realpathPreservingMissingLeaf
    for (const workspace of options.workspaces ?? []) this.register(workspace)
  }

  // ── 函数区 ──

  /** 注册或替换用户授权的 Shell 工作区。 */
  register(workspace: ShellWorkspace): void {
    if (!workspace.id.trim()) throw new Error('Shell workspace id is required')
    if (!isAbsolute(workspace.rootPath)) throw new Error('Shell workspace root must be absolute')
    if (WINDOWS_DEVICE_PATH.test(workspace.rootPath)) throw new Error('Shell workspace root cannot be a device path')
    this.workspaces.set(workspace.id, {
      id: workspace.id,
      rootPath: resolve(workspace.rootPath)
    })
  }

  /** 原子替换全部用户授权工作区。 */
  replace(workspaces: readonly ShellWorkspace[]): void {
    /** 先在临时 Registry 完成全部验证，避免半应用。 */
    const validated = new ShellWorkspaceRegistry({
      defaultWorkspaceRoot: this.defaultWorkspaceRoot,
      workspaces: [...workspaces],
      realpath: this.realpath
    })
    this.workspaces.clear()
    for (const workspace of validated.workspaces.values()) this.workspaces.set(workspace.id, workspace)
  }

  /** 解析 Tool 输入中的 workspaceId 和 cwd，并保证结果不逃逸授权根目录。 */
  resolve(workspaceId?: string, cwd?: string): ResolvedShellWorkspace {
    const workspace = workspaceId ? this.workspaces.get(workspaceId) : undefined
    if (workspaceId && !workspace) throw new Error('Shell workspace is not authorized')

    const rootPath = workspace?.rootPath ?? this.defaultWorkspaceRoot
    const relativeCwd = cwd ?? '.'
    if (this.hasAbsoluteOrDevicePath(relativeCwd)) {
      throw new Error('Shell cwd must be relative to an authorized workspace')
    }

    const candidate = resolve(rootPath, relativeCwd)
    const normalizedRoot = this.normalizeForCompare(this.realpath(rootPath))
    const normalizedCwd = this.normalizeForCompare(this.realpath(candidate))
    if (!this.isInsideOrEqual(normalizedCwd, normalizedRoot)) {
      throw new Error('Shell cwd escapes the authorized workspace')
    }

    return {
      workspaceId: workspace?.id ?? 'default',
      rootPath: normalizedRoot,
      cwd: normalizedCwd
    }
  }

  /** 判断命令参数路径是否是允许自动执行的工作区相对路径。 */
  resolvePathArgument(argument: string, workspace: ResolvedShellWorkspace): string {
    if (!argument || argument === '-') throw new Error('Shell path argument is not a file path')
    if (argument.startsWith('~') || this.hasAbsoluteOrDevicePath(argument)) {
      throw new Error('Shell path argument must be workspace-relative')
    }

    const candidate = resolve(workspace.cwd, argument)
    const normalized = this.normalizeForCompare(this.realpath(candidate))
    if (!this.isInsideOrEqual(normalized, workspace.rootPath)) {
      throw new Error('Shell path argument escapes the authorized workspace')
    }
    return normalized
  }

  /** 生成默认工作区路径，供 Utility Process 无用户授权目录时使用。 */
  static defaultRoot(appName = 'ncxmusic'): string {
    return resolve(tmpdir(), appName, 'shell', basename(homedir()) || 'default-workspace')
  }

  /** 解析已存在祖先的真实路径，并保留尚未创建的末端路径。 */
  static realpathPreservingMissingLeaf(path: string): string {
    const absolute = resolve(path)
    let existing = absolute
    const missing: string[] = []
    while (!existsSync(existing)) {
      const parent = dirname(existing)
      if (parent === existing) break
      missing.unshift(basename(existing))
      existing = parent
    }

    const resolvedExisting = existsSync(existing) ? realpathSync.native(existing) : existing
    return missing.length === 0 ? resolvedExisting : join(resolvedExisting, ...missing)
  }

  private hasAbsoluteOrDevicePath(value: string): boolean {
    return isAbsolute(value) || WINDOWS_DEVICE_PATH.test(value) || WINDOWS_DRIVE.test(value)
  }

  private normalizeForCompare(value: string): string {
    const normalized = resolve(value)
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized
  }

  private isInsideOrEqual(candidate: string, root: string): boolean {
    if (candidate === root) return true
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`
    return candidate.startsWith(prefix)
  }
}
