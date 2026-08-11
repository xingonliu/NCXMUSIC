import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

import { z } from 'zod'

import type { UtilitySupervisor } from './utility-supervisor'
import {
  ShellSettingsRequestSchema,
  ShellSettingsResultSchema,
  ShellWorkspaceSnapshotSchema,
  type ShellSettingsRequest,
  type ShellSettingsResult,
  type ShellWorkspaceSnapshot
} from '../shared/schemas/shell'

// ========= 类型 =========

/** Shell 设置持久文档。 */
interface ShellSettingsDocument {
  /** 文档版本。 */
  readonly schemaVersion: 1
  /** 用户授权工作区。 */
  readonly workspaces: readonly ShellWorkspaceSnapshot[]
}

/** Shell Settings Coordinator 构造参数。 */
export interface ShellSettingsCoordinatorOptions {
  /** AppData 数据根目录。 */
  readonly dataRoot: string
  /** Utility 监督器。 */
  readonly supervisor: UtilitySupervisor
  /** 系统目录选择器。 */
  readonly chooseDirectory: () => Promise<string | undefined>
}

// ========= 变量 =========

/** 持久文档严格 Schema。 */
const ShellSettingsDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  workspaces: z.array(ShellWorkspaceSnapshotSchema).max(64)
})

/** 默认无用户授权工作区。 */
const EMPTY_DOCUMENT: ShellSettingsDocument = { schemaVersion: 1, workspaces: [] }

// ========= 类 =========

/** Main 独占 Shell 授权目录持久化与 Utility 边界同步。 */
export class ShellSettingsCoordinator {
  /** 配置文件路径。 */
  private readonly configPath: string

  /** 当前内存文档。 */
  private document: ShellSettingsDocument = EMPTY_DOCUMENT

  constructor(private readonly options: ShellSettingsCoordinatorOptions) {
    this.configPath = resolve(options.dataRoot, 'shell', 'settings.json')
    this.load()
  }

  /** 处理 Renderer 工作区设置请求。 */
  async handle(rawRequest: ShellSettingsRequest): Promise<ShellSettingsResult> {
    /** 经共享 Schema 校验的请求。 */
    const request = ShellSettingsRequestSchema.parse(rawRequest)
    /** 可选操作摘要。 */
    let message: string | undefined
    if (request.operation === 'chooseWorkspace') {
      /** 用户通过系统对话框明确选择的目录。 */
      const selected = await this.options.chooseDirectory()
      if (selected) {
        /** 规范化绝对路径。 */
        const rootPath = resolve(selected)
        /** 已存在同路径项。 */
        const existing = this.document.workspaces.find((item) => samePath(item.rootPath, rootPath))
        if (!existing) {
          this.document = {
            schemaVersion: 1,
            workspaces: [...this.document.workspaces, {
              id: crypto.randomUUID(),
              name: basename(rootPath) || rootPath,
              rootPath
            }]
          }
          this.persist()
        }
        message = existing ? '该目录已经授权。' : 'Shell 工作区已授权。'
      }
    } else if (request.operation === 'removeWorkspace') {
      this.document = {
        schemaVersion: 1,
        workspaces: this.document.workspaces.filter((item) => item.id !== request.workspaceId)
      }
      this.persist()
      message = 'Shell 工作区授权已移除；正在运行的命令不伪装为回滚。'
    }
    if (request.operation !== 'snapshot') this.syncUtility()
    return ShellSettingsResultSchema.parse({
      workspaces: this.document.workspaces,
      ...(message ? { message } : {})
    })
  }

  /** Utility 启动/重启后同步授权边界。 */
  syncUtility(): boolean {
    return this.options.supervisor.postControl({
      kind: 'shell.workspace.sync',
      workspaces: this.document.workspaces
    })
  }

  /** 从磁盘读取严格设置，损坏时安全回退为空。 */
  private load(): void {
    try {
      /** 未信任磁盘内容。 */
      const decoded = JSON.parse(readFileSync(this.configPath, 'utf8')) as unknown
      this.document = ShellSettingsDocumentSchema.parse(decoded)
    } catch {
      this.document = EMPTY_DOCUMENT
    }
  }

  /** 同目录临时文件原子持久化。 */
  private persist(): void {
    /** 配置目录。 */
    const directory = dirname(this.configPath)
    /** 同目录临时文件。 */
    const temporary = `${this.configPath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporary, `${JSON.stringify(this.document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(temporary, this.configPath)
  }
}

// ========= 函数 =========

/** 按平台大小写规则比较规范化路径。 */
function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left)
  const normalizedRight = resolve(right)
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight
}
