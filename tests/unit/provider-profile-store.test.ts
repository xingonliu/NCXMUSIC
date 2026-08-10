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

  it('公开快照不含秘密且磁盘不出现 API Key 明文', () => {
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
    expect(saved.headerNames).toEqual(['X-Tenant'])
    expect(JSON.stringify(saved)).not.toContain('secret-api-key-value')
    expect(disk).not.toContain('secret-api-key-value')
    expect(disk).not.toContain('private-tenant')
    expect(store.runtimeProfile()?.headers).toMatchObject({
      authorization: 'Bearer secret-api-key-value',
      'X-Tenant': 'private-tenant'
    })
  })
})
