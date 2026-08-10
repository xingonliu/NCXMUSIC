import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { z } from 'zod'

import {
  ProviderCapabilitySnapshotSchema,
  ProviderProfileInputSchema,
  ProviderRuntimeProfileSchema,
  PublicProviderProfileSchema,
  type ProviderCapabilitySnapshot,
  type ProviderProfileInput,
  type ProviderRuntimeProfile,
  type PublicProviderProfile
} from '../../shared/schemas/provider-profile'

// ========= 类型 =========

/** Main 安全存储实现的最小接口，测试可注入内存替身。 */
export interface ProviderSecretCipher {
  /** 当前系统是否能安全加密。 */
  isAvailable(): boolean
  /** 加密 UTF-8 秘密。 */
  encrypt(value: string): Buffer
  /** 解密 UTF-8 秘密。 */
  decrypt(value: Buffer): string
}

/** 只存在于 Main 内存或加密文件中的秘密。 */
interface ProviderSecrets {
  /** 用户 API Key。 */
  readonly apiKey?: string | undefined
  /** 自定义 Header 值。 */
  readonly customHeaders: Readonly<Record<string, string>>
}

/** Profile 持久化记录。 */
interface StoredProviderProfile {
  /** 稳定 Profile ID。 */
  readonly profileId: string
  /** 用户展示名称。 */
  readonly displayName: string
  /** Provider 协议。 */
  readonly protocol: ProviderProfileInput['protocol']
  /** 服务根地址。 */
  readonly baseUrl: string
  /** 模型 ID。 */
  readonly modelId: string
  /** 仅用于公开展示的 Header 名称。 */
  readonly headerNames: readonly string[]
  /** 是否启用。 */
  readonly enabled: boolean
  /** 加密后的秘密 JSON。 */
  readonly encryptedSecrets: string
  /** 最近能力验证快照。 */
  readonly capabilitySnapshot?: ProviderCapabilitySnapshot | undefined
  /** 最近验证时间。 */
  readonly lastVerifiedAt?: number | undefined
}

// ========= 变量 =========

/** Provider Profile 文件版本。 */
const PROVIDER_STORE_VERSION = 1 as const

/** 加密前秘密 Schema。 */
const ProviderSecretsSchema = z.strictObject({
  apiKey: z.string().max(8_192).optional(),
  customHeaders: z.record(z.string(), z.string())
})

/** 磁盘 Profile Schema。 */
const StoredProviderProfileSchema = z.strictObject({
  profileId: z.uuid(),
  displayName: z.string().min(1).max(80),
  protocol: ProviderProfileInputSchema.shape.protocol,
  baseUrl: z.url().max(2_048),
  modelId: z.string().min(1).max(200),
  headerNames: z.array(z.string()).max(16),
  enabled: z.boolean(),
  encryptedSecrets: z.string().min(1),
  capabilitySnapshot: ProviderCapabilitySnapshotSchema.optional(),
  lastVerifiedAt: z.number().int().positive().optional()
})

/** 完整磁盘文件 Schema。 */
const ProviderStoreFileSchema = z.strictObject({
  version: z.literal(PROVIDER_STORE_VERSION),
  defaultProfileId: z.uuid().optional(),
  profiles: z.array(StoredProviderProfileSchema)
})

// ========= 类 =========

/** Main 独占的 Provider Profile 与加密凭据仓库。 */
export class ProviderProfileStore {
  /** Profile 文件路径。 */
  private readonly filePath: string

  /** 当前默认 Profile ID。 */
  private defaultProfileId: string | undefined

  /** 当前磁盘记录。 */
  private profiles: StoredProviderProfile[] = []

  constructor(userDataPath: string, private readonly cipher: ProviderSecretCipher) {
    this.filePath = join(userDataPath, 'provider-profiles.json')
  }

  /** 读取磁盘；损坏文件按空仓库处理且绝不猜测秘密。 */
  load(): PublicProviderProfile[] {
    try {
      /** 未信任磁盘内容。 */
      const decoded = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown
      /** 校验后的文件。 */
      const parsed = ProviderStoreFileSchema.parse(decoded)
      this.profiles = parsed.profiles
      this.defaultProfileId = parsed.defaultProfileId
    } catch {
      this.profiles = []
      this.defaultProfileId = undefined
    }
    return this.list()
  }

  /** 列出 Renderer 可见的无秘密快照。 */
  list(): PublicProviderProfile[] {
    return this.profiles.map((profile) => this.toPublic(profile))
  }

  /** 返回当前默认 Profile ID。 */
  activeProfileId(): string | undefined {
    return this.profiles.some((profile) => profile.profileId === this.defaultProfileId && profile.enabled)
      ? this.defaultProfileId
      : this.profiles.find((profile) => profile.enabled)?.profileId
  }

  /** 新增或编辑 Profile；未提交 apiKey 时保留已有秘密 Key。 */
  save(rawInput: ProviderProfileInput): PublicProviderProfile {
    if (!this.cipher.isAvailable()) throw new Error('当前系统安全存储不可用，无法保存模型凭据。')
    /** 已校验输入。 */
    const input = ProviderProfileInputSchema.parse(rawInput)
    /** 已有记录。 */
    const existing = input.profileId
      ? this.profiles.find((profile) => profile.profileId === input.profileId)
      : undefined
    /** 已有秘密。 */
    const previousSecrets = existing ? this.readSecrets(existing) : { customHeaders: {} }
    /** 本次持久化秘密。 */
    const secrets: ProviderSecrets = {
      ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : previousSecrets.apiKey ? { apiKey: previousSecrets.apiKey } : {}),
      customHeaders: input.customHeaders
    }
    /** Profile 稳定 ID。 */
    const profileId = input.profileId ?? crypto.randomUUID()
    /** 影响能力结果的配置是否发生变化。 */
    const invalidatesVerification = !existing
      || existing.protocol !== input.protocol
      || existing.baseUrl !== input.baseUrl
      || existing.modelId !== input.modelId
      || input.apiKey !== undefined
      || JSON.stringify(existing.headerNames) !== JSON.stringify(Object.keys(input.customHeaders).sort())
    /** 新磁盘记录。 */
    const stored: StoredProviderProfile = {
      profileId,
      displayName: input.displayName,
      protocol: input.protocol,
      baseUrl: input.baseUrl.replace(/\/+$/u, ''),
      modelId: input.modelId,
      headerNames: Object.keys(input.customHeaders).sort(),
      enabled: input.enabled,
      encryptedSecrets: this.encryptSecrets(secrets),
      ...(!invalidatesVerification && existing?.capabilitySnapshot
        ? { capabilitySnapshot: existing.capabilitySnapshot }
        : {}),
      ...(!invalidatesVerification && existing?.lastVerifiedAt
        ? { lastVerifiedAt: existing.lastVerifiedAt }
        : {})
    }
    /** 被替换记录的索引。 */
    const existingIndex = this.profiles.findIndex((profile) => profile.profileId === profileId)
    if (existingIndex >= 0) this.profiles.splice(existingIndex, 1, stored)
    else this.profiles.push(stored)
    this.defaultProfileId ??= profileId
    this.persist()
    return this.toPublic(stored)
  }

  /** 删除 Profile，并确定性选择下一个启用项为默认。 */
  delete(profileId: string): void {
    this.profiles = this.profiles.filter((profile) => profile.profileId !== profileId)
    if (this.defaultProfileId === profileId) {
      this.defaultProfileId = this.profiles.find((profile) => profile.enabled)?.profileId
    }
    this.persist()
  }

  /** 切换默认 Profile。 */
  setDefault(profileId: string): void {
    /** 目标 Profile。 */
    const target = this.profiles.find((profile) => profile.profileId === profileId)
    if (!target?.enabled) throw new Error('只能选择已启用的 Provider Profile。')
    this.defaultProfileId = profileId
    this.persist()
  }

  /** 记录一次能力验证结果。 */
  markVerified(profileId: string, capabilitySnapshot: ProviderCapabilitySnapshot): void {
    /** 目标索引。 */
    const index = this.profiles.findIndex((profile) => profile.profileId === profileId)
    if (index < 0) throw new Error('Provider Profile 不存在。')
    /** 当前记录。 */
    const current = this.profiles[index]
    if (!current) throw new Error('Provider Profile 不存在。')
    this.profiles[index] = {
      ...current,
      capabilitySnapshot: ProviderCapabilitySnapshotSchema.parse(capabilitySnapshot),
      lastVerifiedAt: Date.now()
    }
    this.persist()
  }

  /** 解密当前默认 Profile 并构造只在 Main/Utility 内存流转的执行配置。 */
  runtimeProfile(profileId = this.activeProfileId()): ProviderRuntimeProfile | undefined {
    if (!profileId) return undefined
    /** 目标记录。 */
    const stored = this.profiles.find((profile) => profile.profileId === profileId && profile.enabled)
    if (!stored) return undefined
    /** 解密秘密。 */
    const secrets = this.readSecrets(stored)
    /** 协议默认认证头。 */
    const credentialHeaders = createCredentialHeaders(stored.protocol, secrets.apiKey)
    /** 凭据指纹，不包含可逆原文。 */
    const credentialFingerprint = createHash('sha256')
      .update(JSON.stringify(secrets))
      .digest('hex')
    return ProviderRuntimeProfileSchema.parse({
      profileId: stored.profileId,
      protocol: stored.protocol,
      model: stored.modelId,
      baseUrl: stored.baseUrl,
      headers: { ...credentialHeaders, ...secrets.customHeaders },
      credentialFingerprint,
      ...(stored.capabilitySnapshot ? { capabilitySnapshot: stored.capabilitySnapshot } : {})
    })
  }

  /** 将磁盘记录裁剪为公开快照。 */
  private toPublic(profile: StoredProviderProfile): PublicProviderProfile {
    /** Profile 是否含有 API Key 或自定义 Header 值。 */
    let hasCredential = profile.headerNames.length > 0
    try {
      hasCredential ||= Boolean(this.readSecrets(profile).apiKey)
    } catch {
      hasCredential = true
    }
    return PublicProviderProfileSchema.parse({
      profileId: profile.profileId,
      displayName: profile.displayName,
      protocol: profile.protocol,
      baseUrl: profile.baseUrl,
      modelId: profile.modelId,
      headerNames: profile.headerNames,
      enabled: profile.enabled,
      isDefault: profile.profileId === this.activeProfileId(),
      hasCredential,
      ...(profile.capabilitySnapshot ? { capabilitySnapshot: profile.capabilitySnapshot } : {}),
      ...(profile.lastVerifiedAt ? { lastVerifiedAt: profile.lastVerifiedAt } : {})
    })
  }

  /** 加密秘密 JSON。 */
  private encryptSecrets(secrets: ProviderSecrets): string {
    /** 经 Schema 校验的秘密 JSON。 */
    const serialized = JSON.stringify(ProviderSecretsSchema.parse(secrets))
    return this.cipher.encrypt(serialized).toString('base64')
  }

  /** 解密并校验秘密 JSON。 */
  private readSecrets(profile: StoredProviderProfile): ProviderSecrets {
    if (!this.cipher.isAvailable()) throw new Error('当前系统安全存储不可用。')
    /** 解密后的秘密文本。 */
    const plaintext = this.cipher.decrypt(Buffer.from(profile.encryptedSecrets, 'base64'))
    return ProviderSecretsSchema.parse(JSON.parse(plaintext) as unknown)
  }

  /** 原子持久化当前仓库。 */
  private persist(): void {
    /** 文件目录。 */
    const directory = dirname(this.filePath)
    /** 同目录临时文件。 */
    const temporaryPath = `${this.filePath}.tmp`
    mkdirSync(directory, { recursive: true })
    writeFileSync(temporaryPath, `${JSON.stringify({
      version: PROVIDER_STORE_VERSION,
      ...(this.defaultProfileId ? { defaultProfileId: this.defaultProfileId } : {}),
      profiles: this.profiles
    }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(temporaryPath, this.filePath)
  }
}

// ========= 函数 =========

/** 按协议生成 API Key 默认认证头；用户自定义 Header 最终可覆盖。 */
function createCredentialHeaders(
  protocol: ProviderProfileInput['protocol'],
  apiKey?: string
): Readonly<Record<string, string>> {
  if (!apiKey) return {}
  if (protocol === 'anthropic-messages') return { 'x-api-key': apiKey }
  if (protocol === 'gemini-generate-content') return { 'x-goog-api-key': apiKey }
  return { authorization: `Bearer ${apiKey}` }
}
