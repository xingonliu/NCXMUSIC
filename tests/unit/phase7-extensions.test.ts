import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { McpSecretProtector } from '../../src/infrastructure/extensions/mcp-config-store'
import { McpConfigStore } from '../../src/infrastructure/extensions/mcp-config-store'
import { SkillPackageManager } from '../../src/infrastructure/extensions/skill-package-manager'
import { ExtensionCoordinator } from '../../src/main/extension-coordinator'
import type { UtilitySupervisor } from '../../src/main/utility-supervisor'

// ========= 变量 =========

/** 每个测试创建并在 afterEach 清理的目录。 */
const temporaryDirectories: string[] = []

/** 可逆测试保护器，只验证 Secret 不以明文落盘。 */
const testProtector: McpSecretProtector = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from([...value].reverse().join(''), 'utf8'),
  decrypt: (value) => [...value.toString('utf8')].reverse().join('')
}

// ========= 函数 =========

/** 创建并记录隔离临时目录。 */
function temporaryDirectory(prefix: string): string {
  /** 新临时目录。 */
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

/** 写入一个最小 Dynamic Skill 包。 */
function writeSkill(root: string, version: string, extra = ''): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'SKILL.md'), [
    '---',
    'name: test-skill',
    `version: ${version}`,
    'description: Phase 7 test skill',
    'entry: index.mjs',
    'tools:',
    '  - name: echo_tool',
    '    description: Echo a value',
    '    inputSchema:',
    '      type: object',
    '---',
    'Always use the declared tool for echo tasks.'
  ].join('\n'))
  writeFileSync(join(root, 'index.mjs'), `export const tools = { echo_tool: async (input) => input };\n${extra}`)
}

// ========= 生命周期 =========

afterEach(() => {
  vi.unstubAllGlobals()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

// ========= 测试 =========

describe('Phase 7 MCP 配置安全边界', () => {
  it('Secret 加密落盘、导出排除 Secret 且实际工具变化强制重批', () => {
    /** 隔离 AppData。 */
    const dataRoot = temporaryDirectory('ncx-mcp-store-')
    /** 被测 MCP 配置仓库。 */
    const store = new McpConfigStore(dataRoot, testProtector)
    store.load()
    store.upsert({
      serverId: 'local-test',
      displayName: 'Local Test',
      transport: 'stdio',
      command: 'node',
      args: ['server-v1.js'],
      environmentNames: ['MCP_TOKEN'],
      headerNames: [],
      enabled: true
    }, { MCP_TOKEN: 'plain-secret-token' }, {}, true)

    /** 首次实际工具发现。 */
    const firstProbe = store.recordProbe('local-test', { tools: {} }, [{
      name: 'alpha',
      description: 'Alpha tool',
      inputSchema: { type: 'object' }
    }])
    expect(firstProbe).toMatchObject({ enabled: false, approvalState: 'reapproval_required' })

    /** 用户查看工具范围并重新启用后的快照。 */
    const approved = store.setEnabled('local-test', true)
    expect(approved).toMatchObject({ enabled: true, approvalState: 'approved' })

    /** Server 静默新增工具必须再次禁用。 */
    const changed = store.recordProbe('local-test', { tools: {} }, [
      { name: 'alpha', inputSchema: { type: 'object' } },
      { name: 'beta', inputSchema: { type: 'object' } }
    ])
    expect(changed).toMatchObject({ enabled: false, approvalState: 'reapproval_required' })

    /** 磁盘和导出都不能出现明文 Secret。 */
    const disk = readFileSync(join(dataRoot, 'extensions', 'mcp-servers.json'), 'utf8')
    const exported = store.exportDocument()
    expect(disk).not.toContain('plain-secret-token')
    expect(exported).not.toContain('plain-secret-token')
    expect(exported).not.toContain('encryptedEnvironment')
  })

  it('拒绝浮动 latest 与旧 SSE 配置', () => {
    /** 被测仓库。 */
    const store = new McpConfigStore(temporaryDirectory('ncx-mcp-invalid-'), testProtector)
    store.load()
    expect(() => store.upsert({
      serverId: 'floating',
      displayName: 'Floating',
      transport: 'stdio',
      command: 'npx',
      args: ['server@latest'],
      environmentNames: [],
      headerNames: [],
      enabled: false
    }, {}, {}, true)).toThrow(/latest/iu)
    expect(() => store.upsert({
      serverId: 'legacy-sse',
      displayName: 'Legacy SSE',
      transport: 'streamable_http',
      url: 'https://example.com/sse',
      args: [],
      environmentNames: [],
      headerNames: [],
      enabled: false
    }, {}, {}, true)).toThrow(/SSE/iu)
  })

  it('导入写入必须绑定刚展示且内容未变化的一次性预览', async () => {
    /** 无进程副作用的 Utility Supervisor 夹具。 */
    const supervisor = {
      onControlMessage: () => () => undefined,
      postControl: () => true
    } as unknown as UtilitySupervisor
    /** 被测 Main 扩展协调器。 */
    const coordinator = new ExtensionCoordinator({
      dataRoot: temporaryDirectory('ncx-mcp-import-'),
      protector: testProtector,
      supervisor,
      chooseSkillSource: async () => undefined
    })
    /** 包含临时明文 Secret 的常见 `.mcp.json`。 */
    const document = JSON.stringify({
      mcpServers: {
        fixture: {
          command: 'node',
          args: ['fixture-server@1.0.0'],
          env: { MCP_TOKEN: 'import-only-secret' }
        }
      }
    })

    /** 首次只预览，不能产生配置写入。 */
    const preview = await coordinator.handle({ operation: 'mcp.import', document, confirm: false })
    expect(preview.snapshot.mcpServers).toHaveLength(0)
    expect(preview.importPreview).toHaveLength(1)
    expect(preview.importToken).toBeTypeOf('string')
    await expect(coordinator.handle({
      operation: 'mcp.import',
      document: `${document} `,
      confirm: true,
      previewToken: preview.importToken
    })).rejects.toThrow(/变化|过期/iu)

    /** 内容变化会消费旧令牌，重新预览后才可一次性确认写入。 */
    const renewed = await coordinator.handle({ operation: 'mcp.import', document, confirm: false })
    const imported = await coordinator.handle({
      operation: 'mcp.import',
      document,
      confirm: true,
      previewToken: renewed.importToken
    })
    expect(imported.snapshot.mcpServers[0]).toMatchObject({
      serverId: 'fixture',
      enabled: false,
      approvalState: 'reapproval_required'
    })
    await expect(coordinator.handle({
      operation: 'mcp.import',
      document,
      confirm: true,
      previewToken: renewed.importToken
    })).rejects.toThrow(/变化|过期/iu)
    coordinator.shutdown()
  })

  it('MCP 市场搜索代理 Smithery 公开目录并返回分页', async () => {
    /** 无进程副作用的 Utility Supervisor 夹具。 */
    const supervisor = {
      onControlMessage: () => () => undefined,
      postControl: () => true
    } as unknown as UtilitySupervisor
    /** 被测 Main 扩展协调器。 */
    const coordinator = new ExtensionCoordinator({
      dataRoot: temporaryDirectory('ncx-mcp-market-'),
      protector: testProtector,
      supervisor,
      chooseSkillSource: async () => undefined
    })
    /** Smithery 可能返回超过设置页展示上限的长描述。 */
    const longDescription = `Search the web with Brave. ${'long description '.repeat(180)}`
    /** Smithery fetch mock。 */
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      /** 被请求的 Smithery URL。 */
      const url = new URL(String(input))
      expect(`${url.origin}${url.pathname}`).toBe('https://api.smithery.ai/servers')
      expect(url.searchParams.get('page')).toBe('2')
      expect(url.searchParams.get('pageSize')).toBe('6')
      expect(url.searchParams.get('q')).toBe('brave')
      expect(url.searchParams.get('topK')).toBe('100')
      return new Response(JSON.stringify({
        servers: [{
          id: '50f26566-7dfe-4842-a5b8-1a9407fb91f4',
          qualifiedName: 'brave',
          namespace: 'brave',
          displayName: 'Brave Search',
          description: longDescription,
          iconUrl: 'https://api.smithery.ai/servers/brave/icon',
          verified: true,
          useCount: 118196,
          remote: true,
          isDeployed: true,
          unlisted: false,
          inactive: false,
          createdAt: '2025-09-05T18:07:47.018Z',
          homepage: 'https://brave.com/search/api/'
        }],
        pagination: {
          currentPage: 2,
          pageSize: 6,
          totalPages: 10,
          totalCount: 60
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    /** MCP 市场搜索结果。 */
    const result = await coordinator.handle({
      operation: 'mcp.market.search',
      page: 2,
      pageSize: 6,
      q: 'brave',
      topK: 100
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.snapshot.mcpServers).toHaveLength(0)
    expect(result.mcpMarket?.servers[0]).toMatchObject({
      qualifiedName: 'brave',
      displayName: 'Brave Search',
      verified: true
    })
    expect(result.mcpMarket?.servers[0]?.description).toHaveLength(2_000)
    expect(result.mcpMarket?.pagination).toMatchObject({ currentPage: 2, totalPages: 10 })
    coordinator.shutdown()
  })

  it('MCP 市场条目详情解析支持获取 deploymentUrl 与 configSchema', async () => {
    /** 无进程副作用的 Utility Supervisor 夹具。 */
    const supervisor = {
      onControlMessage: () => () => undefined,
      postControl: () => true
    } as unknown as UtilitySupervisor
    /** 被测 Main 扩展协调器。 */
    const coordinator = new ExtensionCoordinator({
      dataRoot: temporaryDirectory('ncx-mcp-resolve-'),
      protector: testProtector,
      supervisor,
      chooseSkillSource: async () => undefined
    })
    /** Smithery detail fetch mock。 */
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input))
      expect(`${url.origin}${url.pathname}`).toBe('https://api.smithery.ai/servers/theagenttimes/news')
      return new Response(JSON.stringify({
        qualifiedName: 'theagenttimes/news',
        displayName: 'Agent News',
        description: 'Agent news server',
        remote: true,
        deploymentUrl: 'https://news--theagenttimes.run.tools',
        connections: [{
          type: 'http',
          deploymentUrl: 'https://news--theagenttimes.run.tools',
          configSchema: {}
        }]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const resolved = await coordinator.handle({
      operation: 'mcp.market.resolve',
      qualifiedName: 'theagenttimes/news'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolved.marketDetail).toMatchObject({
      qualifiedName: 'theagenttimes/news',
      displayName: 'Agent News',
      deploymentUrl: 'https://news--theagenttimes.run.tools',
      connections: [{
        type: 'http',
        deploymentUrl: 'https://news--theagenttimes.run.tools'
      }]
    })
    coordinator.shutdown()
  })
})

describe('Phase 7 Dynamic Skill 生命周期', () => {
  it('新导入默认禁用，显式更新保留启用态并可回滚和七天回收', async () => {
    /** 隔离 AppData 与外部来源。 */
    const dataRoot = temporaryDirectory('ncx-skill-data-')
    const sourceRoot = join(temporaryDirectory('ncx-skill-source-'), 'test-skill')
    writeSkill(sourceRoot, '1.0.0')
    /** 被测 Skill 管理器。 */
    const manager = new SkillPackageManager(dataRoot)

    /** 初次安装结果。 */
    const installed = await manager.install({ type: 'folder', path: sourceRoot })
    expect(installed).toMatchObject({ name: 'test-skill', state: 'disabled', version: '1.0.0' })
    expect(manager.runtimeDescriptors()).toHaveLength(0)

    manager.setEnabled('test-skill', true)
    expect(manager.runtimeDescriptors()[0]).toMatchObject({ enabled: true, version: '1.0.0' })

    writeSkill(sourceRoot, '2.0.0', '// changed')
    const updated = await manager.update('test-skill')
    expect(updated).toMatchObject({ state: 'enabled', version: '2.0.0', previousVersionAvailable: true })
    expect(manager.rollback('test-skill').version).toBe('1.0.0')

    const trashed = manager.uninstall('test-skill')
    expect(trashed.state).toBe('trashed')
    expect(trashed.trashExpiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1_000)
  })

  it('拒绝 lifecycle script、原生模块和声明工具却无入口的损坏包', async () => {
    /** 隔离 AppData。 */
    const manager = new SkillPackageManager(temporaryDirectory('ncx-skill-malicious-data-'))
    /** 带 lifecycle script 的来源。 */
    const lifecycleRoot = join(temporaryDirectory('ncx-skill-lifecycle-'), 'test-skill')
    writeSkill(lifecycleRoot, '1.0.0')
    writeFileSync(join(lifecycleRoot, 'package.json'), JSON.stringify({ scripts: { postinstall: 'echo unsafe' } }))
    await expect(manager.install({ type: 'folder', path: lifecycleRoot })).rejects.toThrow(/lifecycle/iu)

    /** 带原生模块的来源。 */
    const nativeRoot = join(temporaryDirectory('ncx-skill-native-'), 'test-skill')
    writeSkill(nativeRoot, '1.0.0')
    writeFileSync(join(nativeRoot, 'addon.node'), 'not-a-native-module')
    await expect(manager.install({ type: 'folder', path: nativeRoot })).rejects.toThrow(/\.node/iu)

    /** 无 JavaScript 入口但声明工具的来源。 */
    const brokenRoot = join(temporaryDirectory('ncx-skill-broken-'), 'test-skill')
    mkdirSync(brokenRoot, { recursive: true })
    writeFileSync(join(brokenRoot, 'SKILL.md'), [
      '---',
      'name: test-skill',
      'version: 1',
      'description: broken',
      'tools:',
      '  - name: echo_tool',
      '    description: Echo',
      '---',
      'broken'
    ].join('\n'))
    await expect(manager.install({ type: 'folder', path: brokenRoot })).rejects.toThrow(/入口|entry/iu)
  })
})
