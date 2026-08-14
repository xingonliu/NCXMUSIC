import { z } from 'zod'

import type {
  AgentExternalToolPort
} from '../../domains/agent/agent-runtime'
import {
  ExecuteShellInputSchema,
  type ShellSafetyLevel
} from '../../shared/schemas/shell'
import {
  McpServerEditableSchema,
  McpServerIdSchema,
  SkillNameSchema
} from '../../shared/schemas/extensions'
import type { ShellExecutor } from '../shell/executor'
import type { ShellPolicyClassifier } from '../shell/policy-classifier'
import type { McpManager } from './mcp-manager'
import type { SkillRuntimeManager } from './skill-runtime-manager'

// ========= 类型 =========

/** Main 执行扩展生命周期动作的私有端口。 */
export interface ExtensionLifecyclePort {
  /** 发送一次已经 ApprovalCard 批准的变更并等待 Main 终态。 */
  request(
    resource: 'skill' | 'mcp',
    action: 'install' | 'enable' | 'disable' | 'update' | 'rollback' | 'uninstall' | 'delete',
    payload: Readonly<Record<string, unknown>>
  ): Promise<{ readonly ok: boolean; readonly code: string; readonly summary: string }>
}

/** 外部工具网关构造参数。 */
export interface AgentExternalToolsOptions {
  /** Phase 0 Shell 执行器。 */
  readonly shellExecutor: ShellExecutor
  /** 同一 CommandSafetyControl 的分类器。 */
  readonly shellClassifier: ShellPolicyClassifier
  /** Dynamic Skill Host 管理器。 */
  readonly skills: SkillRuntimeManager
  /** MCP SDK 管理器。 */
  readonly mcp: McpManager
  /** Main 生命周期变更端口。 */
  readonly lifecycle: ExtensionLifecyclePort
}

// ========= Schema =========

/** Agent 可请求的 Skill 生命周期输入。 */
const ManageSkillInputSchema = z.strictObject({
  action: z.enum(['install', 'enable', 'disable', 'update', 'rollback', 'uninstall']),
  name: SkillNameSchema.optional(),
  url: z.url().max(2_048).optional()
}).superRefine((input, context) => {
  if (input.action === 'install' && (!input.url || !/^https:\/\//iu.test(input.url))) {
    context.addIssue({ code: 'custom', path: ['url'], message: 'Agent 安装 Skill 只接受 HTTPS Git URL。' })
  }
  if (input.action !== 'install' && !input.name) {
    context.addIssue({ code: 'custom', path: ['name'], message: '当前动作需要 Skill 名。' })
  }
})

/** Agent 可请求的 MCP 生命周期输入；不接受 Secret 值。 */
const ManageMcpInputSchema = z.strictObject({
  action: z.enum(['install', 'enable', 'disable', 'update', 'rollback', 'delete']),
  serverId: McpServerIdSchema.optional(),
  config: McpServerEditableSchema.optional()
}).superRefine((input, context) => {
  if (['install', 'update'].includes(input.action) && !input.config) {
    context.addIssue({ code: 'custom', path: ['config'], message: '安装或更新需要无秘密 MCP 配置。' })
  }
  if (!['install', 'update'].includes(input.action) && !input.serverId) {
    context.addIssue({ code: 'custom', path: ['serverId'], message: '当前动作需要 serverId。' })
  }
})

// ========= 变量 =========

/** Shell 模型工具定义。 */
const EXECUTE_SHELL_DEFINITION = {
  name: 'execute_shell',
  description: '在用户已授权工作区内执行一条 PowerShell（Windows）或 zsh（macOS）命令。命令会经过确定性 S1-S4 策略和必要的 ApprovalCard。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '单条完整命令。' },
      workspaceId: { type: 'string', description: '用户已授权工作区 ID；省略时使用应用临时工作区。' },
      cwd: { type: 'string', description: '相对工作区根目录的执行目录。' },
      timeoutMs: { type: 'integer', minimum: 1_000, maximum: 600_000 },
      purpose: { type: 'string', description: '说明为何需要执行该命令。' }
    },
    required: ['command', 'purpose'],
    additionalProperties: false
  }
} as const

/** Skill 生命周期模型工具定义。 */
const MANAGE_SKILL_DEFINITION = {
  name: 'manage_skill',
  description: '安装、启用、禁用、显式更新、回滚或卸载 Dynamic Skill；每次变更都需要 ApprovalCard。安装只接受 HTTPS Git URL。',
  parameters: {
    type: 'object',
    properties: {
      action: { enum: ['install', 'enable', 'disable', 'update', 'rollback', 'uninstall'] },
      name: { type: 'string' },
      url: { type: 'string', description: 'install 使用的 HTTPS Git URL。' }
    },
    required: ['action'],
    additionalProperties: false
  }
} as const

/** MCP 生命周期模型工具定义。 */
const MANAGE_MCP_DEFINITION = {
  name: 'mcp_manager',
  description: '安装、启用、禁用、更新、回滚或删除 MCP Server 配置；每次变更都需要 ApprovalCard，不能接收或读取凭据值。',
  parameters: {
    type: 'object',
    properties: {
      action: { enum: ['install', 'enable', 'disable', 'update', 'rollback', 'delete'] },
      serverId: { type: 'string' },
      config: { type: 'object', description: '不含 Secret 值的 MCP 配置。' }
    },
    required: ['action'],
    additionalProperties: false
  }
} as const

// ========= 类 =========

/** 统一把 Shell、Skill 与 MCP 暴露给 Agent 既有 Registry/Policy/Approval/Scheduler 链。 */
export class AgentExternalTools implements AgentExternalToolPort {
  constructor(private readonly options: AgentExternalToolsOptions) {}

  /** 组合当前模型可见定义；Shell 仅在用户开关开启时可见。 */
  providerDefinitions(input: {
    readonly commandSafetyLevel: ShellSafetyLevel
    readonly shellToolEnabled: boolean
  }): ReturnType<AgentExternalToolPort['providerDefinitions']> {
    this.options.shellClassifier.setSafetyLevel(input.commandSafetyLevel)
    return [
      ...(input.shellToolEnabled ? [EXECUTE_SHELL_DEFINITION] : []),
      MANAGE_SKILL_DEFINITION,
      MANAGE_MCP_DEFINITION,
      ...this.options.skills.providerDefinitions(),
      ...this.options.mcp.providerDefinitions()
    ]
  }

  /** 汇总启用 Skill 的系统提示。 */
  systemPrompts(): readonly string[] {
    return this.options.skills.systemPrompts()
  }

  /** 判断外部工具是否已注册。 */
  has(name: string): boolean {
    return name === 'execute_shell'
      || name === 'manage_skill'
      || name === 'mcp_manager'
      || this.options.skills.has(name)
      || this.options.mcp.has(name)
  }

  /** 严格解析并按当前统一安全设置分类外部工具。 */
  async resolve(
    name: string,
    rawInput: unknown,
    input: { readonly commandSafetyLevel: ShellSafetyLevel; readonly shellToolEnabled: boolean }
  ): ReturnType<AgentExternalToolPort['resolve']> {
    if (name === 'execute_shell') {
      /** 严格 Shell 输入。 */
      const parsed = ExecuteShellInputSchema.safeParse(rawInput)
      if (!parsed.success) return undefined
      if (!input.shellToolEnabled) {
        return {
          input: parsed.data,
          operation: {
            effect: 'write',
            conflictKeys: ['shell'],
            title: '执行 Shell 命令',
            deniedReason: 'Shell Tool 已在设置中关闭。'
          }
        }
      }
      this.options.shellClassifier.setSafetyLevel(input.commandSafetyLevel)
      /** Phase 0 确定性策略结论。 */
      const decision = await this.options.shellClassifier.classify(parsed.data)
      return {
        input: parsed.data,
        operation: {
          effect: decision.tags.includes('read') ? 'read' : 'write',
          conflictKeys: [`shell:${parsed.data.workspaceId ?? 'default'}`],
          title: `执行 Shell：${decision.executable}`,
          ...(decision.action === 'deny' ? { deniedReason: decision.reason } : {}),
          ...(decision.action === 'ask' ? { requiresApproval: decision.reason } : {})
        }
      }
    }

    if (name === 'manage_skill') return lifecycleResolution(ManageSkillInputSchema.safeParse(rawInput), '管理 Dynamic Skill')
    if (name === 'mcp_manager') return lifecycleResolution(ManageMcpInputSchema.safeParse(rawInput), '管理 MCP Server')
    if (!isRecord(rawInput)) return undefined
    if (this.options.skills.has(name)) {
      return {
        input: rawInput,
        operation: {
          effect: 'write',
          conflictKeys: [name.slice(0, name.lastIndexOf('.'))],
          title: `调用 ${name}`,
          requiresApproval: 'Dynamic Skill 工具属于第三方代码，需要逐次批准。'
        }
      }
    }
    if (this.options.mcp.has(name)) {
      /** MCP Server ID 冲突域。 */
      const serverScope = name.split('.').slice(0, 2).join('.')
      return {
        input: rawInput,
        operation: {
          effect: 'write',
          conflictKeys: [serverScope],
          title: `调用 ${name}`,
          requiresApproval: '每次外部 MCP Tool Call 都必须由用户逐次批准。'
        }
      }
    }
    return undefined
  }

  /** 执行已通过一次性审批或自动策略允许的外部工具。 */
  async execute(
    name: string,
    input: Record<string, unknown>,
    toolCallId: string,
    signal: AbortSignal
  ): ReturnType<AgentExternalToolPort['execute']> {
    if (name === 'execute_shell') {
      /** Shell 执行终态。 */
      const result = await this.options.shellExecutor.execute(toolCallId, input, {
        approved: true,
        source: 'approval-card'
      }, signal)
      return {
        ok: result.status === 'succeeded',
        code: result.status === 'succeeded' ? 'OK' : `SHELL_${result.status.toUpperCase()}`,
        summary: shellSummary(result),
        data: result
      }
    }
    if (name === 'manage_skill') {
      /** 已验证生命周期输入。 */
      const request = ManageSkillInputSchema.parse(input)
      return this.options.lifecycle.request('skill', request.action, request)
    }
    if (name === 'mcp_manager') {
      /** 已验证生命周期输入。 */
      const request = ManageMcpInputSchema.parse(input)
      return this.options.lifecycle.request('mcp', request.action, request)
    }
    if (this.options.skills.has(name)) return this.options.skills.call(name, input, signal)
    if (this.options.mcp.has(name)) return this.options.mcp.call(name, input, signal)
    return { ok: false, code: 'CAPABILITY_UNAVAILABLE', summary: '外部工具未注册。' }
  }
}

// ========= 函数 =========

/** 把严格生命周期输入转换为统一的强制审批分类。 */
function lifecycleResolution(
  parsed: ReturnType<typeof ManageSkillInputSchema.safeParse> | ReturnType<typeof ManageMcpInputSchema.safeParse>,
  title: string
): Awaited<ReturnType<AgentExternalToolPort['resolve']>> {
  if (!parsed.success) return undefined
  return {
    input: parsed.data,
    operation: {
      effect: 'write',
      conflictKeys: ['extensions:lifecycle'],
      title,
      requiresApproval: '扩展生命周期变更需要逐次批准，并只影响 NcxMusic 管理的配置或安装目录。'
    }
  }
}

/** 判断未知输入是否普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 生成 ToolCard 可展开查看的有限 Shell 输出摘要。 */
function shellSummary(result: Awaited<ReturnType<ShellExecutor['execute']>>): string {
  /** 优先展示 stderr，否则展示 stdout。 */
  const output = (result.stderr || result.stdout).trim()
  /** 终态前缀。 */
  const prefix = `Shell ${result.status}（exit=${result.exitCode ?? 'null'}，${result.durationMs}ms）`
  return output ? `${prefix}\n${output}`.slice(0, 1_000) : prefix
}
