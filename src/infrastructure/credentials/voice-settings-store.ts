import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { totalmem } from 'node:os'

import { z } from 'zod'

import {
  VoiceCloudSettingsInputSchema,
  VoiceCloudProtocolSchema,
  VoiceLocalLoadModeSchema,
  VoiceLocalModelIdSchema,
  VoiceRecognitionSourceSchema,
  type VoiceCloudSettingsInput,
  type VoiceLocalLoadMode,
  type VoiceLocalModelId,
  type VoiceRecognitionSource
} from '../../shared/schemas/voice-settings'
import type { ProviderSecretCipher } from './provider-profile-store'

// ========= 类型 =========

/** Renderer 不可见的独立云端 ASR 执行配置。 */
export interface VoiceCloudRuntimeSettings {
  /** 协议适配器。 */
  readonly protocol: VoiceCloudSettingsInput['protocol']
  /** 服务根地址。 */
  readonly baseUrl: string
  /** 转写模型 ID。 */
  readonly modelId: string
  /** 是否请求 SSE 增量结果。 */
  readonly streaming: boolean
  /** 带秘密值的最终请求头。 */
  readonly headers: Readonly<Record<string, string>>
}

/** Main 内部使用的完整非秘密设置。 */
export interface VoiceStoredSettingsSnapshot {
  /** 默认识别来源。 */
  readonly source: VoiceRecognitionSource
  /** 本地模型 ID。 */
  readonly localModelId: VoiceLocalModelId
  /** 是否使用本地增量结果。 */
  readonly localStreaming: boolean
  /** 本地模型加载策略。 */
  readonly localLoadMode: VoiceLocalLoadMode
  /** 云端公开配置。 */
  readonly cloud: {
    readonly protocol: VoiceCloudSettingsInput['protocol']
    readonly baseUrl: string
    readonly modelId: string
    readonly streaming: boolean
    readonly streamingSupported: boolean
    readonly hasApiKey: boolean
    readonly headerNames: readonly string[]
  }
}

/** 加密保存的独立云端秘密。 */
interface VoiceCloudSecrets {
  /** API Key。 */
  readonly apiKey?: string | undefined
  /** 自定义请求头。 */
  readonly customHeaders: Readonly<Record<string, string>>
}

/** Main 内存中的语音设置记录。 */
interface VoiceSettingsRecord {
  /** 默认识别来源。 */
  source: VoiceRecognitionSource
  /** 本地模型 ID。 */
  localModelId: VoiceLocalModelId
  /** 是否使用本地增量结果。 */
  localStreaming: boolean
  /** 本地模型加载策略。 */
  localLoadMode: VoiceLocalLoadMode
  /** 云端协议。 */
  cloudProtocol: VoiceCloudSettingsInput['protocol']
  /** 云端服务地址。 */
  cloudBaseUrl: string
  /** 云端模型 ID。 */
  cloudModelId: string
  /** 是否请求云端 SSE。 */
  cloudStreaming: boolean
  /** 加密秘密。 */
  encryptedCloudSecrets?: string | undefined
}

// ========= 变量 =========

/** 语音配置文件版本。 */
const VOICE_SETTINGS_VERSION = 1 as const

/** 加密秘密的校验 Schema。 */
const VoiceCloudSecretsSchema = z.strictObject({
  apiKey: z.string().max(8_192).optional(),
  customHeaders: z.record(z.string(), z.string())
})

/** 磁盘语音设置 Schema。 */
const VoiceSettingsFileSchema = z.strictObject({
  version: z.literal(VOICE_SETTINGS_VERSION),
  source: VoiceRecognitionSourceSchema,
  localModelId: VoiceLocalModelIdSchema,
  localStreaming: z.boolean(),
  localLoadMode: VoiceLocalLoadModeSchema,
  cloudProtocol: VoiceCloudProtocolSchema,
  cloudBaseUrl: z.url().max(2_048),
  cloudModelId: z.string().min(1).max(200),
  cloudStreaming: z.boolean(),
  encryptedCloudSecrets: z.string().min(1).optional()
})

// ========= 类 =========

/** Main 独占的语音来源与独立 ASR 加密配置仓库。 */
export class VoiceSettingsStore {
  /** 配置文件路径。 */
  private readonly filePath: string

  /** 当前内存记录。 */
  private record: VoiceSettingsRecord

  constructor(userDataPath: string, private readonly cipher: ProviderSecretCipher) {
    this.filePath = join(userDataPath, 'voice-settings.json')
    this.record = createDefaultVoiceSettings(false)
  }

  /** 读取磁盘；首次使用按现有 Provider 状态选择兼容默认来源。 */
  load(hasConversationProfile: boolean): VoiceStoredSettingsSnapshot {
    try {
      /** 未信任磁盘内容。 */
      const decoded = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown
      this.record = VoiceSettingsFileSchema.parse(decoded)
    } catch {
      this.record = createDefaultVoiceSettings(hasConversationProfile)
      this.persist()
    }
    return this.snapshot()
  }

  /** 返回无秘密的公开设置。 */
  snapshot(): VoiceStoredSettingsSnapshot {
    /** 当前秘密；解密异常时按无凭据处理。 */
    const secrets = this.safeSecrets()
    return {
      source: this.record.source,
      localModelId: this.record.localModelId,
      localStreaming: this.record.localStreaming,
      localLoadMode: this.record.localLoadMode,
      cloud: {
        protocol: this.record.cloudProtocol,
        baseUrl: this.record.cloudBaseUrl,
        modelId: this.record.cloudModelId,
        streaming: this.record.cloudStreaming,
        streamingSupported: this.record.cloudModelId.trim().toLowerCase() !== 'whisper-1',
        hasApiKey: Boolean(secrets.apiKey),
        headerNames: Object.keys(secrets.customHeaders).sort()
      }
    }
  }

  /** 更新默认识别来源。 */
  setSource(source: VoiceRecognitionSource): VoiceStoredSettingsSnapshot {
    this.record.source = VoiceRecognitionSourceSchema.parse(source)
    this.persist()
    return this.snapshot()
  }

  /** 更新本地模型及加载策略。 */
  setLocal(modelId: VoiceLocalModelId, streaming: boolean, loadMode: VoiceLocalLoadMode): VoiceStoredSettingsSnapshot {
    this.record.localModelId = VoiceLocalModelIdSchema.parse(modelId)
    this.record.localStreaming = streaming
    this.record.localLoadMode = VoiceLocalLoadModeSchema.parse(loadMode)
    this.persist()
    return this.snapshot()
  }

  /** 保存独立云端 ASR 配置并加密秘密。 */
  saveCloud(rawInput: VoiceCloudSettingsInput): VoiceStoredSettingsSnapshot {
    if (!this.cipher.isAvailable()) throw new Error('当前系统安全存储不可用，无法保存语音 API 凭据。')
    /** 已校验配置。 */
    const input = VoiceCloudSettingsInputSchema.parse(rawInput)
    /** 上一次秘密。 */
    const previous = this.safeSecrets()
    /** 本次秘密。 */
    const secrets: VoiceCloudSecrets = {
      ...(input.apiKey !== undefined
        ? (input.apiKey ? { apiKey: input.apiKey } : {})
        : (previous.apiKey ? { apiKey: previous.apiKey } : {})),
      customHeaders: input.customHeaders
    }
    this.record.cloudProtocol = input.protocol
    this.record.cloudBaseUrl = input.baseUrl.replace(/\/+$/u, '')
    this.record.cloudModelId = input.modelId
    this.record.cloudStreaming = input.streaming
    this.record.encryptedCloudSecrets = this.cipher.encrypt(JSON.stringify(VoiceCloudSecretsSchema.parse(secrets))).toString('base64')
    this.persist()
    return this.snapshot()
  }

  /** 解密并返回仅供 Main 发起请求的云端配置。 */
  cloudRuntime(): VoiceCloudRuntimeSettings {
    /** 解密后的秘密。 */
    const secrets = this.readSecrets()
    /** 默认认证头。 */
    const authorization = secrets.apiKey ? { authorization: `Bearer ${secrets.apiKey}` } : {}
    return {
      protocol: this.record.cloudProtocol,
      baseUrl: this.record.cloudBaseUrl,
      modelId: this.record.cloudModelId,
      streaming: this.record.cloudStreaming && this.record.cloudModelId.trim().toLowerCase() !== 'whisper-1',
      headers: { ...authorization, ...secrets.customHeaders }
    }
  }

  /** 解密当前秘密；无记录时返回空秘密。 */
  private readSecrets(): VoiceCloudSecrets {
    if (!this.record.encryptedCloudSecrets) return { customHeaders: {} }
    if (!this.cipher.isAvailable()) throw new Error('当前系统安全存储不可用。')
    /** 解密文本。 */
    const plaintext = this.cipher.decrypt(Buffer.from(this.record.encryptedCloudSecrets, 'base64'))
    return VoiceCloudSecretsSchema.parse(JSON.parse(plaintext) as unknown)
  }

  /** 安全读取秘密供快照使用。 */
  private safeSecrets(): VoiceCloudSecrets {
    try {
      return this.readSecrets()
    } catch {
      return { customHeaders: {} }
    }
  }

  /** 原子写入配置文件。 */
  private persist(): void {
    /** 文件目录。 */
    const directory = dirname(this.filePath)
    /** 同目录临时文件。 */
    const temporaryPath = `${this.filePath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporaryPath, `${JSON.stringify({ version: VOICE_SETTINGS_VERSION, ...this.record }, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600
    })
    renameSync(temporaryPath, this.filePath)
  }
}

// ========= 函数 =========

/** 创建兼顾升级用户与低内存设备的默认语音设置。 */
function createDefaultVoiceSettings(hasConversationProfile: boolean): VoiceSettingsRecord {
  /** 物理内存 GiB。 */
  const totalMemoryGiB = totalmem() / (1024 ** 3)
  return {
    source: hasConversationProfile ? 'conversation' : 'local',
    localModelId: totalMemoryGiB < 8 ? 'light' : 'accurate',
    localStreaming: true,
    localLoadMode: 'on-demand',
    cloudProtocol: 'openai-transcriptions',
    cloudBaseUrl: 'https://api.openai.com/v1',
    cloudModelId: 'gpt-4o-mini-transcribe',
    cloudStreaming: true
  }
}
