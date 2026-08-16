import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  ProviderProfileStore,
  type ProviderSecretCipher
} from '../../src/infrastructure/credentials/provider-profile-store'

// ========= 变量 =========

/** 测试创建的临时目录。 */
const temporaryDirectories: string[] = []

/** 可逆测试加密器；只验证仓库不写明文，不模拟系统密码学。 */
const testCipher: ProviderSecretCipher = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from([...value].reverse().join(''), 'utf8'),
  decrypt: (value) => [...value.toString('utf8')].reverse().join('')
}

// ========= 测试 =========

describe('provider profile store', () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('公开快照回显 API Key 但磁盘配置文件不出现明文', () => {
    /** 当前测试隔离目录。 */
    const directory = mkdtempSync(join(tmpdir(), 'ncx-provider-'))
    temporaryDirectories.push(directory)
    /** 被测 Provider Profile 仓库。 */
    const store = new ProviderProfileStore(directory, testCipher)
    store.load()
    /** 保存后公开快照。 */
    const saved = store.save({
      displayName: '测试 Provider',
      protocol: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1',
      modelId: 'model-a',
      apiKey: 'secret-api-key-value',
      customHeaders: { 'X-Tenant': 'private-tenant' },
      enabled: true
    })

    /** 磁盘加密配置文本。 */
    const disk = readFileSync(join(directory, 'provider-profiles.json'), 'utf8')
    expect(saved.hasCredential).toBe(true)
    expect(saved.apiKey).toBe('secret-api-key-value')
    expect(saved.headerNames).toEqual(['X-Tenant'])
    expect(disk).not.toContain('secret-api-key-value')
    expect(disk).not.toContain('private-tenant')
    expect(store.runtimeProfile()?.headers).toMatchObject({
      authorization: 'Bearer secret-api-key-value',
      'X-Tenant': 'private-tenant'
    })
  })

  it('应用重启后恢复默认模型 Profile 与可执行配置', () => {
    /** 当前测试隔离目录。 */
    const directory = mkdtempSync(join(tmpdir(), 'ncx-provider-restart-'))
    temporaryDirectories.push(directory)
    /** 首次应用进程中的 Profile 仓库。 */
    const firstStore = new ProviderProfileStore(directory, testCipher)
    firstStore.load()
    /** 首次保存并自动成为默认项的 Profile。 */
    const saved = firstStore.save({
      displayName: '持久模型',
      protocol: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1',
      modelId: 'persistent-model',
      apiKey: 'persistent-key',
      customHeaders: {},
      enabled: true
    })

    /** 模拟应用重启后重新构造的 Profile 仓库。 */
    const restartedStore = new ProviderProfileStore(directory, testCipher)
    restartedStore.load()

    expect(restartedStore.activeProfileId()).toBe(saved.profileId)
    expect(restartedStore.runtimeProfile()).toMatchObject({
      profileId: saved.profileId,
      model: 'persistent-model'
    })
  })

  it('支持保存与更新 icon 字段并在二次编辑留空密钥时保留原有 API Key', () => {
    /** 当前测试隔离目录。 */
    const directory = mkdtempSync(join(tmpdir(), 'ncx-provider-edit-'))
    temporaryDirectories.push(directory)
    /** 被测仓库。 */
    const store = new ProviderProfileStore(directory, testCipher)
    store.load()

    /** 初始保存包含 icon 和 apiKey。 */
    const initial = store.save({
      displayName: 'OpenAI GPT-4',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4o',
      icon: 'simple-icons:openai',
      apiKey: 'initial-secret-key',
      customHeaders: {},
      enabled: true
    })
    expect(initial.icon).toBe('simple-icons:openai')

    /** 编辑更新名称、模型和图标，未提供 apiKey。 */
    const updated = store.save({
      profileId: initial.profileId,
      displayName: 'OpenAI GPT-4o Mini',
      protocol: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4o-mini',
      icon: 'simple-icons:anthropic',
      customHeaders: {},
      enabled: true
    })

    expect(updated.profileId).toBe(initial.profileId)
    expect(updated.displayName).toBe('OpenAI GPT-4o Mini')
    expect(updated.modelId).toBe('gpt-4o-mini')
    expect(updated.icon).toBe('simple-icons:anthropic')
    expect(updated.hasCredential).toBe(true)
    expect(updated.apiKey).toBe('initial-secret-key')
    expect(store.runtimeProfile()?.headers).toMatchObject({
      authorization: 'Bearer initial-secret-key'
    })
  })

  it('当安全存储历史密钥解密失败时允许重新保存新 API Key 并恢复', () => {
    /** 当前测试隔离目录。 */
    const directory = mkdtempSync(join(tmpdir(), 'ncx-provider-corrupt-'))
    temporaryDirectories.push(directory)
    /** 初始写入 Profile。 */
    const store = new ProviderProfileStore(directory, testCipher)
    store.load()
    const saved = store.save({
      displayName: '测试模型',
      protocol: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1',
      modelId: 'model-a',
      apiKey: 'old-key',
      customHeaders: {},
      enabled: true
    })

    /** 模拟环境变更导致解密失败的 Cipher。 */
    let decryptFails = true
    const flakyCipher: ProviderSecretCipher = {
      isAvailable: () => true,
      encrypt: (value) => Buffer.from([...value].reverse().join(''), 'utf8'),
      decrypt: (value) => {
        if (decryptFails) throw new Error('safeStorage.decryptString failed')
        return [...value.toString('utf8')].reverse().join('')
      }
    }

    /** 用失效 Cipher 打开仓库。 */
    const brokenStore = new ProviderProfileStore(directory, flakyCipher)
    brokenStore.load()
    expect(brokenStore.runtimeProfile()).toBeUndefined()

    /** 重新保存新 API Key，不应因为旧密钥无法解密而崩溃。 */
    const recovered = brokenStore.save({
      profileId: saved.profileId,
      displayName: '测试模型',
      protocol: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1',
      modelId: 'model-a',
      apiKey: 'new-working-key',
      customHeaders: {},
      enabled: true
    })

    expect(recovered.profileId).toBe(saved.profileId)
    decryptFails = false
    expect(brokenStore.runtimeProfile()?.headers).toMatchObject({
      authorization: 'Bearer new-working-key'
    })
  })
})
