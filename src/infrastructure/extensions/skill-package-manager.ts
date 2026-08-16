import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'

import AdmZip from 'adm-zip'
import { parseDocument } from 'yaml'
import { z } from 'zod'

import {
  SkillRuntimeDescriptorSchema,
  SkillSnapshotSchema,
  SkillToolManifestSchema,
  type SkillRuntimeDescriptor,
  type SkillSnapshot,
  type SkillToolManifest
} from '../../shared/schemas/extensions'

// ========= 类型 =========

/** 已校验 SKILL.md 的内部完整结构。 */
interface ValidatedSkillManifest {
  /** Skill 稳定名称。 */
  readonly name: string
  /** 声明版本。 */
  readonly version: string
  /** 安装与启用界面说明。 */
  readonly description: string
  /** 可选 JavaScript 入口相对路径。 */
  readonly entry?: string
  /** 声明工具。 */
  readonly tools: SkillToolManifest[]
  /** Prompt 正文。 */
  readonly prompt: string
}

/** NcxMusic 私有 Skill 安装记录。 */
interface SkillInstallMetadata {
  /** 元数据 Schema 版本。 */
  readonly schemaVersion: 1
  /** 来源类型。 */
  readonly sourceType: 'appdata' | 'folder' | 'zip' | 'git' | 'market'
  /** Main 私有完整来源；不发给 Renderer 或模型。 */
  readonly source: string
  /** 无秘密来源摘要。 */
  readonly sourceLabel: string
  /** 内容 SHA-256。 */
  readonly contentHash: string
  /** Git 锁定 commit。 */
  readonly gitCommit?: string
  /** 是否已由用户显式启用。 */
  readonly enabled: boolean
  /** 首次安装时间。 */
  readonly installedAt: number
  /** 最近变更时间。 */
  readonly updatedAt: number
  /** 最近错误。 */
  readonly error?: string
  /** 移入应用内回收站后的过期时间。 */
  readonly trashExpiresAt?: number
}

/** Skill 安装来源。 */
export type SkillInstallSource =
  | { readonly type: 'folder'; readonly path: string }
  | { readonly type: 'zip'; readonly path: string }
  | { readonly type: 'git'; readonly url: string }
  | { readonly type: 'market'; readonly slug: string; readonly version?: string; readonly downloadUrl: string }

// ========= 变量 =========

/** 单个 Skill 最大文件数。 */
const MAX_SKILL_FILES = 2_000

/** 单个 Skill 最大总字节数。 */
const MAX_SKILL_BYTES = 25 * 1_024 * 1_024

/** SKILL.md 最大字节数。 */
const MAX_SKILL_MARKDOWN_BYTES = 256 * 1_024

/** Skill 卸载回收期。 */
const SKILL_TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000

/** SKILL.md Frontmatter 宽松解析 Schema（适配开源/社区多样性）。 */
const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(128).transform((val) => val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') || 'skill'),
  version: z.union([z.string(), z.number()]).nullish().transform((value) => (value !== null && value !== undefined) ? String(value) : '1.0.0').pipe(z.string().min(1).max(80)),
  description: z.string().trim().min(1).transform((value) => value.slice(0, 500)),
  entry: z.string().trim().min(1).max(500).optional(),
  tools: z.array(SkillToolManifestSchema).max(32).default([])
})

// ========= 类 =========

/** Main 侧 Skill 发现、暂存校验、原子切换、回滚与七天回收管理器。 */
export class SkillPackageManager {
  /** Skill 权威根目录。 */
  private readonly skillsRoot: string

  /** 安装暂存目录。 */
  private readonly stagingRoot: string

  /** 单版本回滚目录。 */
  private readonly previousRoot: string

  /** 七天回收站目录。 */
  private readonly trashRoot: string

  constructor(dataRoot: string) {
    this.skillsRoot = join(resolve(dataRoot), 'skills')
    this.stagingRoot = join(this.skillsRoot, '.staging')
    this.previousRoot = join(this.skillsRoot, '.previous')
    this.trashRoot = join(this.skillsRoot, '.trash')
    for (const directory of [this.skillsRoot, this.stagingRoot, this.previousRoot, this.trashRoot]) {
      mkdirSync(directory, { recursive: true })
    }
  }

  // ========= 函数 =========

  /** 扫描 AppData、补齐手工 Skill 默认禁用记录并清理过期回收项。 */
  discover(): SkillSnapshot[] {
    this.purgeExpiredTrash()
    /** 已发现的正常安装项。 */
    const installed = readdirSync(this.skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => this.readSnapshot(join(this.skillsRoot, entry.name), 'appdata'))
      .filter((entry): entry is SkillSnapshot => Boolean(entry))
    /** 尚在七天回收期内的卸载项。 */
    const trashed = readdirSync(this.trashRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => this.readSnapshot(join(this.trashRoot, entry.name), 'appdata', true))
      .filter((entry): entry is SkillSnapshot => Boolean(entry))
    return [...installed, ...trashed].sort((left, right) => left.name.localeCompare(right.name))
  }

  /** 安装本地文件夹、ZIP 或 HTTPS Git Skill；新包默认禁用，显式更新保留启用态。 */
  async install(source: SkillInstallSource): Promise<SkillSnapshot> {
    /** 本次唯一暂存目录。 */
    const staging = join(this.stagingRoot, crypto.randomUUID())
    mkdirSync(staging, { recursive: true })
    try {
      /** 实际包含 SKILL.md 的暂存根目录。 */
      const packageRoot = await this.stageSource(source, staging)
      /** 经全部安全门禁验证的 manifest。 */
      const manifest = validateSkillPackage(packageRoot)
      /** 完整内容哈希。 */
      const contentHash = hashSkillPackage(packageRoot)
      /** Git 安装锁定的 commit。 */
      const gitCommit = source.type === 'git' ? await readGitCommit(packageRoot) : undefined
      /** 目标权威目录。 */
      const target = join(this.skillsRoot, manifest.name)
      /** 新安装记录。 */
      const now = Date.now()
      /** 原安装记录，用于保留首次安装时间。 */
      const previousMetadata = existsSync(target) ? readMetadata(target) : undefined
      const metadata: SkillInstallMetadata = {
        schemaVersion: 1,
        sourceType: source.type,
        source: source.type === 'git' ? source.url : (source.type === 'market' ? source.downloadUrl : resolve(source.path)),
        sourceLabel: sourceLabel(source),
        contentHash,
        ...(gitCommit ? { gitCommit } : {}),
        enabled: false,
        installedAt: previousMetadata?.installedAt ?? now,
        updatedAt: now
      }
      writeMetadata(packageRoot, metadata)
      this.atomicReplace(target, packageRoot, manifest.name)
      /** 已安装结果必须可重新验证。 */
      const snapshot = this.readSnapshot(target, source.type)
      if (!snapshot) throw new Error('Skill 安装后验证失败。')
      return snapshot
    } finally {
      if (existsSync(staging)) rmSync(staging, { recursive: true, force: true })
    }
  }

  /** 启用或禁用已安装 Skill。 */
  setEnabled(name: string, enabled: boolean): SkillSnapshot {
    /** 已安装 Skill 根目录。 */
    const root = this.skillRoot(name)
    /** 重新验证，避免启用后才发现内容被破坏。 */
    validateSkillPackage(root)
    /** 当前安装记录。 */
    const metadata = requiredMetadata(root)
    /** 清除旧错误且不写入可选字段 undefined。 */
    const { error: _error, ...metadataWithoutError } = metadata
    void _error
    /** 更新后的安装记录。 */
    const nextMetadata: SkillInstallMetadata = {
      ...metadataWithoutError,
      enabled,
      updatedAt: Date.now()
    }
    writeMetadata(root, nextMetadata)
    /** 更新后的公开快照。 */
    const snapshot = this.readSnapshot(root, metadata.sourceType)
    if (!snapshot) throw new Error('Skill 状态更新失败。')
    return snapshot
  }

  /** 按原始来源显式检查并安装更新；不自动更新。 */
  async update(name: string): Promise<SkillSnapshot> {
    /** 当前安装记录。 */
    const metadata = requiredMetadata(this.skillRoot(name))
    if (metadata.sourceType === 'appdata') throw new Error('AppData 手工 Skill 请直接编辑后重新发现。')
    /** 原来源。 */
    const source: SkillInstallSource = metadata.sourceType === 'git'
      ? { type: 'git', url: metadata.source }
      : metadata.sourceType === 'market'
        ? {
            type: 'market',
            slug: name,
            downloadUrl: `https://api.skillhub.cn/api/v1/download?slug=${encodeURIComponent(name)}`
          }
        : { type: metadata.sourceType, path: metadata.source }
    /** 显式更新前的启用态。 */
    const wasEnabled = metadata.enabled
    /** 原子安装新版本，替换瞬间保持禁用。 */
    const installed = await this.install(source)
    return wasEnabled ? this.setEnabled(installed.name, true) : installed
  }

  /** 与唯一上一版本原子交换。 */
  rollback(name: string): SkillSnapshot {
    /** 当前权威目录。 */
    const current = this.skillRoot(name)
    /** 唯一上一版本目录。 */
    const previous = join(this.previousRoot, name)
    if (!existsSync(previous)) throw new Error('没有可回滚的 Skill 版本。')
    validateSkillPackage(previous)
    /** 交换期间的临时目录。 */
    const swap = join(this.stagingRoot, `rollback-${crypto.randomUUID()}`)
    renameSync(current, swap)
    try {
      renameSync(previous, current)
      renameSync(swap, previous)
    } catch (error) {
      if (!existsSync(current) && existsSync(swap)) renameSync(swap, current)
      throw error
    }
    /** 回滚目标公开快照。 */
    const snapshot = this.readSnapshot(current, requiredMetadata(current).sourceType)
    if (!snapshot) throw new Error('Skill 回滚后验证失败。')
    return snapshot
  }

  /** 停用并移入应用内回收站，七天后才物理删除。 */
  uninstall(name: string): SkillSnapshot {
    /** 当前 Skill 根目录。 */
    const current = this.skillRoot(name)
    /** 当前元数据。 */
    const metadata = requiredMetadata(current)
    /** 回收过期时间。 */
    const trashExpiresAt = Date.now() + SKILL_TRASH_RETENTION_MS
    writeMetadata(current, {
      ...metadata,
      enabled: false,
      updatedAt: Date.now(),
      trashExpiresAt
    })
    /** 回收站唯一目录。 */
    const destination = join(this.trashRoot, `${name}-${Date.now()}`)
    renameSync(current, destination)
    /** 回收站公开快照。 */
    const snapshot = this.readSnapshot(destination, metadata.sourceType, true)
    if (!snapshot) throw new Error('Skill 移入回收站后验证失败。')
    return snapshot
  }

  /** 返回 Utility 可执行的已启用 Skill 描述。 */
  runtimeDescriptors(): SkillRuntimeDescriptor[] {
    /** 已启用且可完整验证的 Skill。 */
    const descriptors: SkillRuntimeDescriptor[] = []
    for (const snapshot of this.discover()) {
      if (snapshot.state !== 'enabled') continue
      /** 当前 Skill 权威根目录。 */
      const root = this.skillRoot(snapshot.name)
      /** 重新解析的 manifest。 */
      const manifest = validateSkillPackage(root)
      /** 当前安装记录。 */
      const metadata = requiredMetadata(root)
      descriptors.push(SkillRuntimeDescriptorSchema.parse({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        rootPath: root,
        ...(manifest.entry ? { entryPath: resolveInside(root, manifest.entry) } : {}),
        prompt: manifest.prompt,
        contentHash: metadata.contentHash,
        enabled: true,
        tools: manifest.tools
      }))
    }
    return descriptors
  }

  /** 读取一个已安装 Skill 的安全公开快照。 */
  private readSnapshot(
    root: string,
    fallbackSourceType: SkillInstallMetadata['sourceType'],
    trashed = false
  ): SkillSnapshot | undefined {
    try {
      /** 当前包声明。 */
      const manifest = validateSkillPackage(root)
      /** 已有或为手工复制创建的安装记录。 */
      let metadata = readMetadata(root)
      if (!metadata) {
        /** 手工复制 Skill 只进入发现态，默认禁用。 */
        const now = Date.now()
        metadata = {
          schemaVersion: 1,
          sourceType: fallbackSourceType,
          source: root,
          sourceLabel: 'AppData 手工目录',
          contentHash: hashSkillPackage(root),
          enabled: false,
          installedAt: now,
          updatedAt: now
        }
        writeMetadata(root, metadata)
      }
      return SkillSnapshotSchema.parse({
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        sourceType: metadata.sourceType,
        sourceLabel: metadata.sourceLabel,
        contentHash: metadata.contentHash,
        ...(metadata.gitCommit ? { gitCommit: metadata.gitCommit } : {}),
        state: trashed ? 'trashed' : metadata.error ? 'error' : metadata.enabled ? 'enabled' : 'disabled',
        hasJavaScript: Boolean(manifest.entry),
        tools: manifest.tools,
        installedAt: metadata.installedAt,
        updatedAt: metadata.updatedAt,
        previousVersionAvailable: existsSync(join(this.previousRoot, manifest.name)),
        ...(metadata.trashExpiresAt ? { trashExpiresAt: metadata.trashExpiresAt } : {}),
        ...(metadata.error ? { error: metadata.error } : {})
      })
    } catch {
      return undefined
    }
  }

  /** 将来源复制、解压、克隆或下载到唯一 staging，并返回包根目录。 */
  private async stageSource(source: SkillInstallSource, staging: string): Promise<string> {
    /** staging 内源目录。 */
    const destination = join(staging, 'package')
    if (source.type === 'folder') {
      validateLocalSource(source.path)
      cpSync(resolve(source.path), destination, { recursive: true, errorOnExist: true })
    } else if (source.type === 'zip') {
      validateLocalSource(source.path)
      extractZipSafely(resolve(source.path), destination)
    } else if (source.type === 'market') {
      if (!/^https?:\/\//iu.test(source.downloadUrl)) throw new Error('SkillHub 下载地址只允许 HTTP 或 HTTPS。')
      /** staging 内临时 ZIP 文件路径。 */
      const zipPath = join(staging, `${source.slug}.zip`)
      await downloadZip(source.downloadUrl, zipPath)
      extractZipSafely(zipPath, destination)
    } else {
      if (!/^https:\/\//iu.test(source.url)) throw new Error('Git Skill 只允许 HTTPS 仓库。')
      await runProcess('git', ['clone', '--depth', '1', '--no-tags', '--', source.url, destination])
    }
    return locatePackageRoot(destination)
  }

  /** 使用上一版本目录原子替换当前安装。 */
  private atomicReplace(target: string, stagedPackageRoot: string, name: string): void {
    /** 唯一上一版本目录。 */
    const previous = join(this.previousRoot, name)
    if (existsSync(previous)) rmSync(previous, { recursive: true, force: true })
    if (existsSync(target)) renameSync(target, previous)
    try {
      mkdirSync(dirname(target), { recursive: true })
      renameSync(stagedPackageRoot, target)
    } catch (error) {
      if (!existsSync(target) && existsSync(previous)) renameSync(previous, target)
      throw error
    }
  }

  /** 解析并验证已安装 Skill 名对应的权威目录。 */
  private skillRoot(name: string): string {
    if (!/^[a-z][a-z0-9-]{1,62}$/u.test(name)) throw new Error('Skill 名称不合法。')
    /** 已解析目标目录。 */
    const root = resolveInside(this.skillsRoot, name)
    if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error('Skill 不存在。')
    return root
  }

  /** 删除已超过七天保留期的应用内回收项。 */
  private purgeExpiredTrash(): void {
    for (const entry of readdirSync(this.trashRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      /** 回收项完整路径。 */
      const root = join(this.trashRoot, entry.name)
      /** 回收项安装记录。 */
      const metadata = readMetadata(root)
      if (metadata?.trashExpiresAt !== undefined && metadata.trashExpiresAt <= Date.now()) {
        rmSync(root, { recursive: true, force: true })
      }
    }
  }
}

// ========= 函数 =========

/** 解析并严格校验一个 Skill 包。 */
export function validateSkillPackage(root: string): ValidatedSkillManifest {
  assertPackageTree(root)
  /** SKILL.md 路径。 */
  const markdownPath = join(root, 'SKILL.md')
  if (!existsSync(markdownPath) || !statSync(markdownPath).isFile()) throw new Error('Skill 缺少 SKILL.md。')
  if (statSync(markdownPath).size > MAX_SKILL_MARKDOWN_BYTES) throw new Error('SKILL.md 超过 256 KiB。')
  /** SKILL.md 文本。 */
  const markdown = readFileSync(markdownPath, 'utf8')
  /** YAML Frontmatter 与 Prompt 正文。 */
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(markdown)
  if (!match?.[1]) throw new Error('SKILL.md 缺少 YAML Frontmatter。')
  /** YAML 1.2 core 文档；不注册自定义 tag。 */
  const document = parseDocument(match[1], {
    schema: 'core',
    strict: true,
    stringKeys: true,
    prettyErrors: true
  })
  if (document.errors.length > 0) throw new Error(`SKILL.md YAML 无效：${document.errors[0]?.message ?? 'unknown'}`)
  /** 经别名上限约束转换的普通对象。 */
  const frontmatter = SkillFrontmatterSchema.parse(document.toJS({ maxAliasCount: 20 }))
  if (
    frontmatter.name !== basename(root)
    && !root.includes(`${sep}.staging${sep}`)
    && !root.includes(`${sep}.trash${sep}`)
  ) {
    throw new Error('Skill 名称必须与安装目录名一致。')
  }
  if (frontmatter.entry) {
    /** 已解析 JavaScript 入口。 */
    const entryPath = resolveInside(root, frontmatter.entry)
    if (!existsSync(entryPath) || !statSync(entryPath).isFile() || !/\.[cm]?js$/iu.test(entryPath)) {
      throw new Error('Skill entry 必须是包内现有 JavaScript 文件。')
    }
  }
  if (!frontmatter.entry && frontmatter.tools.length > 0) throw new Error('声明工具的 Skill 必须提供 JavaScript entry。')
  return {
    name: frontmatter.name,
    version: frontmatter.version,
    description: frontmatter.description,
    ...(frontmatter.entry ? { entry: frontmatter.entry } : {}),
    tools: frontmatter.tools,
    prompt: match[2] ?? ''
  }
}

/** 遍历包树并拒绝符号链接、原生模块、超限内容与 lifecycle script。 */
function assertPackageTree(root: string): void {
  /** 待扫描目录。 */
  const pending = [resolve(root)]
  /** 已扫描文件数。 */
  let fileCount = 0
  /** 已扫描总字节数。 */
  let totalBytes = 0
  while (pending.length > 0) {
    /** 当前目录。 */
    const directory = pending.pop()
    if (!directory) break
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      /** 当前条目完整路径。 */
      const absolute = join(directory, entry.name)
      /** lstat 用于拒绝 symlink/junction 重解析点。 */
      const stats = lstatSync(absolute)
      if (stats.isSymbolicLink()) throw new Error('Skill 不允许符号链接或 junction。')
      if (entry.isDirectory()) {
        pending.push(absolute)
        continue
      }
      if (!entry.isFile()) throw new Error('Skill 包含不支持的文件类型。')
      fileCount += 1
      totalBytes += stats.size
      if (fileCount > MAX_SKILL_FILES || totalBytes > MAX_SKILL_BYTES) throw new Error('Skill 包超过文件数或 25 MiB 上限。')
      if (/\.node$/iu.test(entry.name)) throw new Error('Skill 不支持 .node 原生模块。')
      if (entry.name === 'package.json') assertNoLifecycleScripts(absolute)
    }
  }
}

/** 拒绝任何 npm/pnpm lifecycle script 声明。 */
function assertNoLifecycleScripts(packageJsonPath: string): void {
  /** 未信任 package.json。 */
  const decoded = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { scripts?: unknown }
  if (!decoded.scripts || typeof decoded.scripts !== 'object') return
  /** lifecycle 与包管理安装相关脚本名。 */
  const forbidden = /^(pre|post)?install$|^prepare$|^prepublish|^publish$|^pack$/iu
  if (Object.keys(decoded.scripts).some((name) => forbidden.test(name))) {
    throw new Error('Skill 不允许 npm/pnpm lifecycle script。')
  }
}

/** 计算除 NcxMusic 私有元数据外的确定性内容哈希。 */
function hashSkillPackage(root: string): string {
  /** 按相对路径排序的全部文件。 */
  const files = listFiles(root).filter((path) => basename(path) !== '.ncx-skill.json')
  /** SHA-256 累加器。 */
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(relative(root, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

/** 递归列出普通文件并稳定排序。 */
function listFiles(root: string): string[] {
  /** 待扫描目录。 */
  const pending = [resolve(root)]
  /** 普通文件列表。 */
  const files: string[] = []
  while (pending.length > 0) {
    /** 当前目录。 */
    const directory = pending.pop()
    if (!directory) break
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      /** 当前条目路径。 */
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) pending.push(absolute)
      else if (entry.isFile()) files.push(absolute)
    }
  }
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)))
}

/** 安全解压 ZIP：逐条拒绝绝对路径、`..`、反斜杠逃逸与非普通文件。 */
function extractZipSafely(zipPath: string, destination: string): void {
  /** ZIP 读取器。 */
  const archive = new AdmZip(zipPath)
  /** 解压累计字节数。 */
  let totalBytes = 0
  /** ZIP 条目列表。 */
  const entries = archive.getEntries()
  if (entries.length > MAX_SKILL_FILES) throw new Error('ZIP 条目数超过 2,000。')
  mkdirSync(destination, { recursive: true })
  for (const entry of entries) {
    /** 统一斜杠后的相对条目名。 */
    const normalizedName = entry.entryName.replaceAll('\\', '/')
    if (!normalizedName || normalizedName.includes('\0') || normalizedName.startsWith('/') || /^[A-Za-z]:/u.test(normalizedName)) {
      throw new Error('ZIP 包含绝对或无效路径。')
    }
    if (normalizedName.split('/').some((segment) => segment === '..')) throw new Error('ZIP 包含路径逃逸条目。')
    /** 条目最终目标。 */
    const target = resolveInside(destination, normalizedName)
    if (entry.isDirectory) {
      mkdirSync(target, { recursive: true })
      continue
    }
    /** 解压后的条目数据。 */
    const data = entry.getData()
    totalBytes += data.byteLength
    if (totalBytes > MAX_SKILL_BYTES) throw new Error('ZIP 解压后超过 25 MiB。')
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data, { mode: 0o600 })
  }
}

/** 在 ZIP 单顶层目录场景定位真实包根。 */
function locatePackageRoot(destination: string): string {
  if (existsSync(join(destination, 'SKILL.md'))) return destination
  /** 解压后顶层条目。 */
  const entries = readdirSync(destination, { withFileTypes: true }).filter((entry) => entry.name !== '__MACOSX')
  if (entries.length === 1 && entries[0]?.isDirectory()) {
    /** 唯一顶层目录。 */
    const nested = join(destination, entries[0].name)
    if (existsSync(join(nested, 'SKILL.md'))) return nested
  }
  throw new Error('导入内容根目录缺少 SKILL.md。')
}

/** 验证用户选择的本地来源存在且类型正确。 */
function validateLocalSource(path: string): void {
  if (!isAbsolute(path) || !existsSync(path)) throw new Error('本地 Skill 来源不存在。')
}

/** 解析相对路径并保证留在指定根目录内。 */
function resolveInside(root: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes('\0')) throw new Error('扩展路径不合法。')
  /** 规范化根目录。 */
  const normalizedRoot = resolve(root)
  /** 规范化候选路径。 */
  const candidate = resolve(normalizedRoot, relativePath)
  /** 平台路径比较值。 */
  const compareRoot = process.platform === 'win32' ? normalizedRoot.toLowerCase() : normalizedRoot
  /** 平台候选比较值。 */
  const compareCandidate = process.platform === 'win32' ? candidate.toLowerCase() : candidate
  if (compareCandidate !== compareRoot && !compareCandidate.startsWith(`${compareRoot}${sep}`)) {
    throw new Error('扩展路径逃逸包根目录。')
  }
  return candidate
}

/** 生成不会泄露完整本地路径的来源摘要。 */
function sourceLabel(source: SkillInstallSource): string {
  if (source.type === 'git') {
    /** Git 来源 URL。 */
    const url = new URL(source.url)
    return `${url.hostname}${url.pathname}`.slice(0, 500)
  }
  if (source.type === 'market') {
    return `SkillHub · ${source.slug}${source.version ? `@${source.version}` : ''}`
  }
  return `${source.type === 'zip' ? 'ZIP' : '文件夹'} · ${basename(source.path)}`
}

/** 从远程 URL 安全下载 ZIP 文件到本地。 */
async function downloadZip(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`下载 SkillHub ZIP 包失败（HTTP ${response.status}）。`)
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(destination, buffer)
}

/** 读取 NcxMusic 私有安装记录。 */
function readMetadata(root: string): SkillInstallMetadata | undefined {
  try {
    /** 未信任元数据。 */
    const value = JSON.parse(readFileSync(join(root, '.ncx-skill.json'), 'utf8')) as SkillInstallMetadata
    if (value.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(value.contentHash)) return undefined
    return value
  } catch {
    return undefined
  }
}

/** 读取必需安装记录。 */
function requiredMetadata(root: string): SkillInstallMetadata {
  /** 当前安装记录。 */
  const metadata = readMetadata(root)
  if (!metadata) throw new Error('Skill 安装记录缺失或损坏。')
  return metadata
}

/** 原子写入 NcxMusic 私有安装记录。 */
function writeMetadata(root: string, metadata: SkillInstallMetadata): void {
  /** 元数据路径。 */
  const target = join(root, '.ncx-skill.json')
  /** 同目录临时路径。 */
  const temporary = `${target}.tmp`
  writeFileSync(temporary, `${JSON.stringify(metadata, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(temporary, target)
}

/** 运行无 Shell 的有限子进程并读取短输出。 */
function runProcess(file: string, args: readonly string[], cwd?: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    /** Git 子进程。 */
    const child = spawn(file, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
      env: { PATH: process.env['PATH'] ?? process.env['Path'] ?? '' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    /** 有界标准输出。 */
    let stdout = ''
    /** 有界标准错误。 */
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout = `${stdout}${chunk.toString('utf8')}`.slice(-16_384) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = `${stderr}${chunk.toString('utf8')}`.slice(-16_384) })
    child.once('error', rejectPromise)
    child.once('exit', (code) => {
      if (code === 0) resolvePromise(stdout.trim())
      else rejectPromise(new Error(stderr.trim() || `${file} 退出码 ${code}`))
    })
  })
}

/** 读取 HTTPS Git 安装的精确 commit。 */
async function readGitCommit(root: string): Promise<string> {
  /** 当前仓库 HEAD。 */
  const commit = await runProcess('git', ['rev-parse', 'HEAD'], root)
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('无法锁定 Git commit。')
  return commit
}
