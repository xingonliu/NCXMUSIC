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

import type { AgentExternalToolsOptions } from '../../src/infrastructure/extensions/agent-external-tools'
import { AgentExternalTools } from '../../src/infrastructure/extensions/agent-external-tools'
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
    /** MCP Hub 中国可能返回超过设置页展示上限的长描述。 */
    const longDescription = `Search the web with Brave. ${'long description '.repeat(180)}`
    /** MCP Hub 中国 fetch mock。 */
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      /** 被请求的 MCP Hub 中国 URL。 */
      const url = new URL(String(input))
      expect(`${url.origin}${url.pathname}`).toBe('https://mcp-cn.com/api/servers')
      expect(url.searchParams.get('page')).toBe('2')
      expect(url.searchParams.get('pageSize')).toBe('12')
      expect(url.searchParams.get('keywords')).toBe('brave')
      return new Response(JSON.stringify({
        code: 0,
        message: 'success',
        data: [{
          server_id: 101,
          qualified_name: 'brave',
          creator: 'brave',
          display_name: 'Brave Search',
          description: longDescription,
          logo: 'https://mcp-cn.com/logo.png',
          use_count: 118196,
          is_domestic: false,
          created_at: '2025-09-05 18:07:47',
          package_url: 'https://brave.com/search/api/',
          connections: '[{type:stdio,config:{command:npx,args:[-y,brave]}}]'
        }],
        pagination: {
          page: 2,
          pageSize: 12,
          total: 60
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    /** MCP 市场搜索结果。 */
    const result = await coordinator.handle({
      operation: 'mcp.market.search',
      page: 2,
      pageSize: 12,
      q: 'brave'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.snapshot.mcpServers).toHaveLength(0)
    expect(result.mcpMarket?.servers[0]).toMatchObject({
      qualifiedName: 'brave',
      displayName: 'Brave Search',
      verified: true
    })
    expect(result.mcpMarket?.servers[0]?.description).toHaveLength(2_000)
    expect(result.mcpMarket?.pagination).toMatchObject({ currentPage: 2, pageSize: 12, totalPages: 5, totalCount: 60 })
    coordinator.shutdown()
  })

  it('MCP 市场条目详情解析支持获取 command、args 与 env 配置', async () => {
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
    /** MCP Hub 中国 detail fetch mock。 */
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(String(input))
      expect(`${url.origin}${url.pathname}`).toBe('https://mcp-cn.com/api/servers/get_details')
      expect(url.searchParams.get('qualifiedName')).toBe('@modelcontextprotocol/server-github')
      return new Response(JSON.stringify({
        code: 0,
        message: 'success',
        data: {
          server_id: 62,
          logo: 'https://github.com/github.png',
          qualified_name: '@modelcontextprotocol/server-github',
          display_name: 'GitHub',
          description: 'GitHub MCP Server',
          connections: '[{type:stdio,config:{command:npx,args:[-y,@modelcontextprotocol/server-github],env:{GITHUB_PERSONAL_ACCESS_TOKEN:<YOUR_TOKEN>}}}]',
          package_url: 'https://www.npmjs.com/package/@modelcontextprotocol/server-github'
        }
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const resolved = await coordinator.handle({
      operation: 'mcp.market.resolve',
      qualifiedName: '@modelcontextprotocol/server-github'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolved.marketDetail).toMatchObject({
      qualifiedName: '@modelcontextprotocol/server-github',
      displayName: 'GitHub',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '<YOUR_TOKEN>'
      }
    })
    coordinator.shutdown()
  })

  it('MCP 连接测试失败时抛出错误，成功时返回工具发现消息', async () => {
    /** 记录 control message 监听器。 */
    let controlHandler: ((message: unknown) => void) | undefined
    /** 被测 Utility Supervisor 夹具。 */
    const supervisor = {
      onControlMessage: (handler: (message: unknown) => void) => {
        controlHandler = handler
        return () => { controlHandler = undefined }
      },
      postControl: (msg: unknown) => {
        const req = msg as { kind?: string; requestId?: string; serverId?: string }
        if (req.kind === 'extension.probe.request' && req.requestId) {
          setTimeout(() => {
            if (req.serverId === 'failing-server') {
              controlHandler?.({
                kind: 'extension.probe.result',
                requestId: req.requestId,
                serverId: req.serverId,
                ok: false,
                capabilities: {},
                tools: [],
                message: 'Streamable HTTP error: Missing Authorization header'
              })
            } else {
              controlHandler?.({
                kind: 'extension.probe.result',
                requestId: req.requestId,
                serverId: req.serverId,
                ok: true,
                capabilities: { tools: {} },
                tools: [{ name: 'query', inputSchema: { type: 'object' } }],
                message: '连接成功，发现 1 个工具。'
              })
            }
          }, 5)
        }
        return true
      }
    } as unknown as UtilitySupervisor

    const coordinator = new ExtensionCoordinator({
      dataRoot: temporaryDirectory('ncx-mcp-probe-test-'),
      protector: testProtector,
      supervisor,
      chooseSkillSource: async () => undefined
    })

    // 先保存基础配置
    await coordinator.handle({
      operation: 'mcp.upsert',
      config: {
        serverId: 'failing-server',
        displayName: 'Failing',
        transport: 'streamable_http',
        url: 'https://example.com/failing',
        args: [],
        environmentNames: [],
        headerNames: [],
        enabled: true
      },
      environment: {},
      headers: {}
    })
    await coordinator.handle({
      operation: 'mcp.upsert',
      config: {
        serverId: 'working-server',
        displayName: 'Working',
        transport: 'streamable_http',
        url: 'https://example.com/working',
        args: [],
        environmentNames: [],
        headerNames: [],
        enabled: true
      },
      environment: {},
      headers: {}
    })

    // 测试失败场景：必须拒绝并抛出错误，不能被当作成功返回
    await expect(coordinator.handle({
      operation: 'mcp.test',
      serverId: 'failing-server'
    })).rejects.toThrow('Streamable HTTP error: Missing Authorization header')

    // 测试成功场景：必须正常返回 message
    const successResult = await coordinator.handle({
      operation: 'mcp.test',
      serverId: 'working-server'
    })
    expect(successResult.message).toBe('连接成功，发现 1 个工具。')

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

describe('Phase 7 SkillHub 市场集成与 manage_skill 工具', () => {
  it('ExtensionCoordinator 支持从 SkillHub 接口搜索并解析技能列表', async () => {
    const dataRoot = temporaryDirectory('ncx-skill-market-')
    const coordinator = new ExtensionCoordinator({
      dataRoot,
      protector: testProtector,
      supervisor: { postControl: vi.fn(), onControlMessage: () => () => {} } as unknown as UtilitySupervisor,
      chooseSkillSource: async () => undefined
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          total: 2,
          skills: [
            {
              slug: 'agent-phone-call',
              name: '智能电话外呼助手',
              version: '1.2.0',
              description: 'AI phone call agent',
              description_zh: '智能电话外呼助手',
              category: 'ai-agent',
              subCategories: [{ key: 'voice', name: '语音交互' }],
              downloads: 1200,
              stars: 88,
              installs: 950,
              iconUrl: 'https://cdn.skillhub.cn/icons/phone.png',
              ownerName: 'DevTeam',
              verified: true,
              homepage: 'https://skillhub.cn/skills/agent-phone-call'
            },
            {
              slug: 'code-review-pro',
              name: '代码评审专家',
              version: '2.0.1',
              description: 'Code review assistant',
              description_zh: '代码审查助手',
              category: 'dev-programming',
              downloads: 800,
              stars: 55,
              verified: false
            }
          ]
        }
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await coordinator.handle({
      operation: 'skill.market.search',
      page: 1,
      pageSize: 10,
      sortBy: 'downloads',
      q: 'phone'
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.skillhub.cn/api/skills?page=1&pageSize=10&sortBy=downloads&keyword=phone'),
      expect.any(Object)
    )
    expect(result.skillMarket).toBeDefined()
    expect(result.skillMarket?.skills).toHaveLength(2)
    expect(result.skillMarket?.skills[0]).toMatchObject({
      slug: 'agent-phone-call',
      name: '智能电话外呼助手',
      version: '1.2.0',
      downloads: 1200,
      verified: true
    })
    expect(result.skillMarket?.pagination).toMatchObject({
      currentPage: 1,
      pageSize: 10,
      totalPages: 1,
      totalCount: 2
    })

    coordinator.shutdown()
  })

  it('AgentExternalTools 的 manage_skill search 动作为只读免批并可执行搜索', async () => {
    const mockLifecycle = {
      request: vi.fn().mockResolvedValue({ ok: true, code: 'OK', summary: '已发起' })
    }
    const mockOptions: AgentExternalToolsOptions = {
      shellExecutor: { execute: vi.fn() } as unknown as AgentExternalToolsOptions['shellExecutor'],
      shellClassifier: { setSafetyLevel: vi.fn(), classify: vi.fn() } as unknown as AgentExternalToolsOptions['shellClassifier'],
      skills: { has: () => false, call: vi.fn() } as unknown as AgentExternalToolsOptions['skills'],
      mcp: { has: () => false, call: vi.fn() } as unknown as AgentExternalToolsOptions['mcp'],
      lifecycle: mockLifecycle
    }
    const tools = new AgentExternalTools(mockOptions)

    const testContext = { commandSafetyLevel: 'S1' as const, shellToolEnabled: true }

    // 1. 测试 search 动作 resolve：只读、无 requiresApproval 阻断
    const searchResolution = await tools.resolve('manage_skill', {
      action: 'search',
      query: 'browser'
    }, testContext)
    expect(searchResolution).toBeDefined()
    expect(searchResolution?.operation.effect).toBe('read')
    expect(searchResolution?.operation.requiresApproval).toBeUndefined()

    // 2. 测试 search 动作 execute：调用 SkillHub API
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 0,
        data: {
          total: 1,
          skills: [{
            slug: 'browser-navigator',
            name: '浏览器导航器',
            version: '1.0.0',
            description_zh: '自动化网页操作',
            downloads: 500,
            stars: 30
          }]
        }
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const searchExecution = await tools.execute('manage_skill', {
      action: 'search',
      query: 'browser'
    }, 'call-1', new AbortController().signal)

    expect(searchExecution.ok).toBe(true)
    expect(searchExecution.summary).toContain('SkillHub 市场搜索“browser”')
    const searchData = searchExecution.data as { total: number; skills: Array<{ slug: string }> }
    expect(searchData.total).toBe(1)
    expect(searchData.skills[0]?.slug).toBe('browser-navigator')

    // 3. 测试 install 动作 resolve：写操作、必须 ApprovalCard 逐次批准
    const installResolution = await tools.resolve('manage_skill', {
      action: 'install',
      slug: 'browser-navigator'
    }, testContext)
    expect(installResolution).toBeDefined()
    expect(installResolution?.operation.effect).toBe('write')
    expect(installResolution?.operation.requiresApproval).toBeDefined()

    // 4. 测试 install 动作 execute：向 lifecycle 发送请求
    await tools.execute('manage_skill', {
      action: 'install',
      slug: 'browser-navigator'
    }, 'call-2', new AbortController().signal)
    expect(mockLifecycle.request).toHaveBeenCalledWith('skill', 'install', expect.objectContaining({
      action: 'install',
      slug: 'browser-navigator',
      name: 'browser-navigator'
    }))
  })
})
