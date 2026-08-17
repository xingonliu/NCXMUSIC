import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { ProviderSecretCipher } from '../../src/infrastructure/credentials/provider-profile-store'
import { VoiceSettingsStore } from '../../src/infrastructure/credentials/voice-settings-store'
import {
  LOCAL_VOICE_MODELS,
  localVoiceInstalledBytes
} from '../../src/infrastructure/voice/local-model-catalog'

// ========= 变量 =========

/** 测试创建的临时配置目录。 */
const temporaryDirectories: string[] = []

/** 可逆测试 Cipher，仅验证磁盘不写秘密明文。 */
const testCipher: ProviderSecretCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from([...value].reverse().join(''), 'utf8'),
  decrypt: (value) => [...value.toString('utf8')].reverse().join('')
}

// ========= 生命周期 =========

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ========= 测试 =========

describe('voice settings store and model catalog', () => {
  it('升级用户默认复用当前对话模型，新用户默认使用本地', () => {
    /** 升级用户隔离目录。 */
    const existingDirectory = mkdtempSync(join(tmpdir(), 'ncx-voice-existing-'))
    /** 新用户隔离目录。 */
    const freshDirectory = mkdtempSync(join(tmpdir(), 'ncx-voice-fresh-'))
    temporaryDirectories.push(existingDirectory, freshDirectory)

    expect(new VoiceSettingsStore(existingDirectory, testCipher).load(true).source).toBe('conversation')
    expect(new VoiceSettingsStore(freshDirectory, testCipher).load(false).source).toBe('local')
  })

  it('加密独立 ASR 凭据且强制 whisper-1 非流式', () => {
    /** 当前测试隔离目录。 */
    const directory = mkdtempSync(join(tmpdir(), 'ncx-voice-cloud-'))
    temporaryDirectories.push(directory)
    /** 被测设置仓库。 */
    const store = new VoiceSettingsStore(directory, testCipher)
    store.load(false)
    /** 保存后的公开设置。 */
    const snapshot = store.saveCloud({
      protocol: 'openai-transcriptions',
      baseUrl: 'https://provider.example.com/v1/',
      modelId: 'whisper-1',
      apiKey: 'voice-secret-key',
      customHeaders: { 'X-Tenant': 'voice-private-tenant' },
      streaming: true
    })
    /** 磁盘配置文本。 */
    const disk = readFileSync(join(directory, 'voice-settings.json'), 'utf8')

    expect(snapshot.cloud.streamingSupported).toBe(false)
    expect(snapshot.cloud.hasApiKey).toBe(true)
    expect(disk).not.toContain('voice-secret-key')
    expect(disk).not.toContain('voice-private-tenant')
    expect(store.cloudRuntime()).toMatchObject({
      baseUrl: 'https://provider.example.com/v1',
      streaming: false,
      headers: {
        authorization: 'Bearer voice-secret-key',
        'X-Tenant': 'voice-private-tenant'
      }
    })
  })

  it('模型目录只安装运行所需 INT8 文件并公开准确体积预算', () => {
    /** 轻量模型。 */
    const light = LOCAL_VOICE_MODELS.find((model) => model.id === 'light')
    /** 准确模型。 */
    const accurate = LOCAL_VOICE_MODELS.find((model) => model.id === 'accurate')

    expect(light?.archiveBytes).toBe(458_187_351)
    expect(light && localVoiceInstalledBytes(light)).toBe(60_387_707)
    expect(accurate?.archiveSha256).toHaveLength(64)
    expect(accurate && localVoiceInstalledBytes(accurate)).toBe(240_193_764)
  })
})
