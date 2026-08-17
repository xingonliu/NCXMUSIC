import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import tar from 'tar-stream'
import unbzip2 from 'unbzip2-stream'
import { z } from 'zod'

import type { VoiceLocalModelId } from '../../shared/schemas/voice-settings'
import {
  LOCAL_VOICE_MODELS,
  localVoiceDownloadUrls,
  localVoiceInstalledBytes,
  localVoiceModelDefinition,
  type LocalVoiceModelDefinition
} from './local-model-catalog'

// ========= 类型 =========

/** 模型安装器对外状态。 */
export interface LocalModelInstallSnapshot {
  /** 模型 ID。 */
  readonly modelId: VoiceLocalModelId
  /** 安装状态。 */
  readonly state: 'not-installed' | 'downloading' | 'installed' | 'failed'
  /** 百分比下载进度。 */
  readonly progress?: number | undefined
  /** 已下载字节数。 */
  readonly downloadedBytes?: number | undefined
  /** 失败原因。 */
  readonly error?: string | undefined
}

/** 模型安装进度监听器。 */
export type LocalModelInstallListener = (snapshot: LocalModelInstallSnapshot) => void

/** 安装目录中的清单。 */
interface InstalledModelManifest {
  /** 清单版本。 */
  readonly version: 1
  /** 模型 ID。 */
  readonly modelId: VoiceLocalModelId
  /** 模型版本。 */
  readonly modelVersion: string
  /** 验证过的归档 SHA-256。 */
  readonly archiveSha256: string
  /** 完成安装时间。 */
  readonly installedAt: number
}

// ========= 变量 =========

/** 安装清单 Schema。 */
const InstalledModelManifestSchema = z.strictObject({
  version: z.literal(1),
  modelId: z.enum(['light', 'accurate']),
  modelVersion: z.string().min(1),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  installedAt: z.number().int().positive()
})

/** 下载进度事件最短间隔。 */
const PROGRESS_INTERVAL_MS = 250

// ========= 类 =========

/** 管理本地语音模型的断点下载、校验和选择性安装。 */
export class LocalModelInstaller {
  /** 应用私有模型根目录。 */
  readonly modelsRoot: string

  /** 当前安装任务。 */
  private readonly tasks = new Map<VoiceLocalModelId, AbortController>()

  /** 当前公开状态。 */
  private readonly states = new Map<VoiceLocalModelId, LocalModelInstallSnapshot>()

  /** 状态订阅者。 */
  private readonly listeners = new Set<LocalModelInstallListener>()

  constructor(userDataPath: string) {
    this.modelsRoot = join(userDataPath, 'voice-models')
    for (const model of LOCAL_VOICE_MODELS) {
      this.states.set(model.id, {
        modelId: model.id,
        state: this.isInstalled(model.id) ? 'installed' : 'not-installed'
      })
    }
  }

  /** 订阅安装状态变化。 */
  onChange(listener: LocalModelInstallListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 返回某个模型的安装状态。 */
  snapshot(modelId: VoiceLocalModelId): LocalModelInstallSnapshot {
    return this.states.get(modelId) ?? { modelId, state: 'not-installed' }
  }

  /** 返回模型稳定安装目录。 */
  modelDirectory(modelId: VoiceLocalModelId): string {
    return join(this.modelsRoot, modelId)
  }

  /** 验证模型是否完整安装。 */
  isInstalled(modelId: VoiceLocalModelId): boolean {
    /** 模型定义。 */
    const model = localVoiceModelDefinition(modelId)
    /** 安装目录。 */
    const modelDirectory = this.modelDirectory(modelId)
    try {
      /** 安装清单。 */
      const manifest = InstalledModelManifestSchema.parse(
        JSON.parse(readFileSync(join(modelDirectory, 'manifest.json'), 'utf8')) as unknown
      )
      if (manifest.modelId !== model.id || manifest.modelVersion !== model.version || manifest.archiveSha256 !== model.archiveSha256) {
        return false
      }
      return [...model.files, ...model.supplements].every((file) => {
        /** 已安装文件状态。 */
        const status = statSync(join(modelDirectory, file.targetPath))
        return status.isFile() && status.size === file.bytes
      })
    } catch {
      return false
    }
  }

  /** 后台安装模型；重复点击复用当前任务。 */
  install(modelId: VoiceLocalModelId): void {
    if (this.tasks.has(modelId) || this.isInstalled(modelId)) return
    /** 本次任务取消器。 */
    const controller = new AbortController()
    this.tasks.set(modelId, controller)
    this.publish({ modelId, state: 'downloading', progress: 0, downloadedBytes: 0 })
    void this.runInstall(modelId, controller.signal).then(() => {
      this.publish({ modelId, state: 'installed', progress: 100 })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) this.publish({ modelId, state: 'not-installed' })
      else this.publish({ modelId, state: 'failed', error: toSafeMessage(error) })
    }).finally(() => {
      this.tasks.delete(modelId)
    })
  }

  /** 取消正在进行的模型安装。 */
  cancel(modelId: VoiceLocalModelId): void {
    this.tasks.get(modelId)?.abort()
  }

  /** 删除应用私有目录中的指定模型和对应断点文件。 */
  remove(modelId: VoiceLocalModelId): void {
    this.cancel(modelId)
    /** 已白名单解析的模型定义。 */
    const model = localVoiceModelDefinition(modelId)
    /** 安装目录。 */
    const modelDirectory = this.assertInsideRoot(this.modelDirectory(model.id))
    /** 断点文件。 */
    const partialPath = this.assertInsideRoot(join(this.modelsRoot, '.downloads', `${basename(new URL(model.officialUrl).pathname)}.part`))
    rmSync(modelDirectory, { recursive: true, force: true })
    rmSync(partialPath, { force: true })
    this.publish({ modelId, state: 'not-installed' })
  }

  /** 执行完整安装事务。 */
  private async runInstall(modelId: VoiceLocalModelId, signal: AbortSignal): Promise<void> {
    /** 模型定义。 */
    const model = localVoiceModelDefinition(modelId)
    /** 下载目录。 */
    const downloadDirectory = join(this.modelsRoot, '.downloads')
    /** 归档断点路径。 */
    const archivePath = join(downloadDirectory, `${basename(new URL(model.officialUrl).pathname)}.part`)
    /** 原子安装暂存目录。 */
    const stagingDirectory = join(this.modelsRoot, `.${model.id}.installing`)
    mkdirSync(downloadDirectory, { recursive: true })
    this.assertDiskSpace(model)
    await this.downloadVerified(model.officialUrl, archivePath, model.archiveBytes, model.archiveSha256, signal, modelId)
    rmSync(stagingDirectory, { recursive: true, force: true })
    mkdirSync(stagingDirectory, { recursive: true })
    try {
      await extractSelectedFiles(archivePath, stagingDirectory, model, signal)
      for (const supplement of model.supplements) {
        await this.downloadVerified(
          supplement.officialUrl,
          join(stagingDirectory, supplement.targetPath),
          supplement.bytes,
          supplement.sha256,
          signal,
          modelId,
          false
        )
      }
      /** 安装清单。 */
      const manifest: InstalledModelManifest = {
        version: 1,
        modelId: model.id,
        modelVersion: model.version,
        archiveSha256: model.archiveSha256,
        installedAt: Date.now()
      }
      writeFileSync(join(stagingDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      /** 稳定目标目录。 */
      const targetDirectory = this.modelDirectory(model.id)
      rmSync(targetDirectory, { recursive: true, force: true })
      renameSync(stagingDirectory, targetDirectory)
      rmSync(archivePath, { force: true })
    } catch (error) {
      rmSync(stagingDirectory, { recursive: true, force: true })
      throw error
    }
  }

  /** 从镜像或官方地址下载并做字节数、SHA-256 双重校验。 */
  private async downloadVerified(
    officialUrl: string,
    destination: string,
    expectedBytes: number,
    expectedSha256: string,
    signal: AbortSignal,
    modelId: VoiceLocalModelId,
    reportProgress = true
  ): Promise<void> {
    /** 候选下载地址。 */
    const urls = localVoiceDownloadUrls(officialUrl)
    /** 最近一次失败。 */
    let lastError: unknown
    for (const [index, url] of urls.entries()) {
      try {
        if (index > 0) rmSync(destination, { force: true })
        await downloadWithResume(url, destination, expectedBytes, signal, (downloadedBytes) => {
          if (!reportProgress) return
          this.publish({
            modelId,
            state: 'downloading',
            downloadedBytes,
            progress: Math.min(100, Math.round((downloadedBytes / expectedBytes) * 100))
          })
        })
        /** 下载后的 SHA-256。 */
        const digest = await sha256File(destination)
        if (digest !== expectedSha256) throw new Error('下载文件校验失败，已拒绝安装。')
        return
      } catch (error) {
        if (signal.aborted) throw error
        if (existsSync(destination) && statSync(destination).size >= expectedBytes) {
          rmSync(destination, { force: true })
        }
        lastError = error
      }
    }
    throw lastError ?? new Error('模型下载失败。')
  }

  /** 校验安装所需临时磁盘空间。 */
  private assertDiskSpace(model: LocalVoiceModelDefinition): void {
    mkdirSync(this.modelsRoot, { recursive: true })
    /** 文件系统空间信息。 */
    const fileSystem = statfsSync(this.modelsRoot)
    /** 可用字节数。 */
    const availableBytes = Number(fileSystem.bavail) * Number(fileSystem.bsize)
    /** 归档、安装文件和 15% 安全余量。 */
    const requiredBytes = Math.ceil((model.archiveBytes + localVoiceInstalledBytes(model)) * 1.15)
    if (availableBytes < requiredBytes) throw new Error('磁盘空间不足，无法安全下载并解包该模型。')
  }

  /** 确保删除目标始终位于应用私有模型根目录内。 */
  private assertInsideRoot(targetPath: string): string {
    /** 模型根目录绝对路径。 */
    const root = resolve(this.modelsRoot)
    /** 目标绝对路径。 */
    const target = resolve(targetPath)
    /** 相对路径。 */
    const relativePath = relative(root, target)
    if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === '..') {
      throw new Error('拒绝访问模型目录之外的路径。')
    }
    return target
  }

  /** 保存状态并广播。 */
  private publish(snapshot: LocalModelInstallSnapshot): void {
    this.states.set(snapshot.modelId, snapshot)
    for (const listener of this.listeners) listener(snapshot)
  }
}

// ========= 函数 =========

/** 支持 HTTP Range 的流式断点下载。 */
async function downloadWithResume(
  url: string,
  destination: string,
  expectedBytes: number,
  signal: AbortSignal,
  onProgress: (downloadedBytes: number) => void
): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true })
  /** 已存在断点字节数。 */
  let offset = existsSync(destination) ? statSync(destination).size : 0
  if (offset > expectedBytes) {
    rmSync(destination, { force: true })
    offset = 0
  }
  /** 下载请求头。 */
  const headers = offset > 0 ? { range: `bytes=${offset}-` } : {}
  /** 网络响应。 */
  const response = await fetch(url, { headers, signal, redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`模型下载失败（HTTP ${response.status}）。`)
  /** 服务器是否正确接受断点。 */
  const appending = offset > 0 && response.status === 206
  if (offset > 0 && !appending) offset = 0
  /** 进度统计变换流。 */
  let downloadedBytes = offset
  /** 上次进度事件时间。 */
  let lastProgressAt = 0
  /** Web 流转 Node 流。 */
  const source = Readable.fromWeb(response.body as never)
  source.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.byteLength
    /** 当前时间。 */
    const now = Date.now()
    if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
      lastProgressAt = now
      onProgress(downloadedBytes)
    }
  })
  await pipeline(source, createWriteStream(destination, { flags: appending ? 'a' : 'w' }))
  onProgress(downloadedBytes)
  if (statSync(destination).size !== expectedBytes) throw new Error('下载文件大小与模型清单不一致。')
}

/** 流式计算文件 SHA-256。 */
async function sha256File(filePath: string): Promise<string> {
  /** SHA-256 实例。 */
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

/** 从已验证归档中只提取运行时所需文件。 */
async function extractSelectedFiles(
  archivePath: string,
  destinationDirectory: string,
  model: LocalVoiceModelDefinition,
  signal: AbortSignal
): Promise<void> {
  /** tar 解包器。 */
  const extractor = tar.extract()
  /** 期望文件路径到目标定义的映射。 */
  const expected = new Map(model.files.map((file) => [file.archivePath, file]))
  /** 已提取路径。 */
  const extracted = new Set<string>()
  extractor.on('entry', (header, stream, next) => {
    /** 去掉归档顶层文件夹后的相对路径。 */
    const normalizedArchivePath = header.name.replace(/^\.\/+/u, '')
    /** 同时兼容带顶层目录与直接平铺的归档。 */
    const archivePathWithoutRoot = expected.has(normalizedArchivePath)
      ? normalizedArchivePath
      : normalizedArchivePath.split('/').slice(1).join('/')
    /** 目标文件定义。 */
    const target = expected.get(archivePathWithoutRoot)
    if (!target || header.type !== 'file') {
      stream.resume()
      stream.once('end', next)
      return
    }
    /** 目标路径。 */
    const targetPath = join(destinationDirectory, target.targetPath)
    mkdirSync(dirname(targetPath), { recursive: true })
    void pipeline(stream, createWriteStream(targetPath)).then(() => {
      if (statSync(targetPath).size !== target.bytes) throw new Error(`模型文件大小异常：${target.targetPath}`)
      extracted.add(target.archivePath)
      next()
    }).catch((error: unknown) => extractor.destroy(error as Error))
  })
  /** 取消监听器。 */
  const abort = (): void => {
    extractor.destroy(new Error('模型安装已取消。'))
  }
  signal.addEventListener('abort', abort, { once: true })
  try {
    await pipeline(createReadStream(archivePath), unbzip2(), extractor)
  } finally {
    signal.removeEventListener('abort', abort)
  }
  if (extracted.size !== model.files.length) throw new Error('模型归档缺少运行所需文件。')
}

/** 将未知异常压缩为可公开的短消息。 */
function toSafeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : '模型安装失败。').slice(0, 300)
}
