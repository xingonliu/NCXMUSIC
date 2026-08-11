import { describe, expect, it } from 'vitest'

import {
  AgentRuntime,
  type AgentExternalToolPort,
  type AgentProviderPort
} from '../../src/domains/agent/agent-runtime'
import type { AgentRuntimeEvent, AgentSnapshot } from '../../src/shared/schemas/agent'

// ========= 函数 =========

/** 创建先调用外部 MCP 工具、再给出最终文本的模型夹具。 */
function createMcpProvider(): AgentProviderPort {
  /** 模型请求轮次。 */
  let round = 0
  return {
    stream: async function* () {
      round += 1
      if (round === 1) {
        yield {
          type: 'tool-call-delta',
          id: 'external-mcp-call',
          name: 'mcp.fixture.echo',
          argumentsDelta: '{"text":"hello"}'
        }
        yield { type: 'completed', finishReason: 'tool_calls' }
        return
      }
      yield { type: 'text-delta', text: '外部工具流程结束。' }
      yield { type: 'completed', finishReason: 'stop' }
    }
  }
}

/** 等待满足断言条件的 Agent 快照。 */
function waitForSnapshot(
  listeners: Array<(snapshot: AgentSnapshot) => void>,
  predicate: (snapshot: AgentSnapshot) => boolean
): Promise<AgentSnapshot> {
  return new Promise((resolve, reject) => {
    /** 测试硬超时。 */
    const timer = setTimeout(() => reject(new Error('phase 7 agent snapshot timeout')), 2_000)
    listeners.push((snapshot) => {
      if (!predicate(snapshot)) return
      clearTimeout(timer)
      resolve(snapshot)
    })
  })
}

/** 构造要求 MCP 每次 ApprovalCard 的 Runtime。 */
function createFixture(): {
  readonly runtime: AgentRuntime
  readonly listeners: Array<(snapshot: AgentSnapshot) => void>
  readonly executions: string[]
} {
  /** 快照监听器。 */
  const listeners: Array<(snapshot: AgentSnapshot) => void> = []
  /** 底层 MCP 执行记录。 */
  const executions: string[] = []
  /** 外部 MCP Tool 正向网关。 */
  const externalTools: AgentExternalToolPort = {
    providerDefinitions: () => [{
      name: 'mcp.fixture.echo',
      description: 'Echo via MCP',
      parameters: { type: 'object', properties: { text: { type: 'string' } } }
    }],
    systemPrompts: () => [],
    has: (name) => name === 'mcp.fixture.echo',
    resolve: async (name, rawInput) => name === 'mcp.fixture.echo'
      && typeof rawInput === 'object'
      && rawInput !== null
      && !Array.isArray(rawInput)
      ? {
          input: rawInput as Record<string, unknown>,
          operation: {
            effect: 'write',
            conflictKeys: ['mcp.fixture'],
            title: '调用 MCP fixture',
            requiresApproval: '所有 MCP Tool Call 必须逐次批准。'
          }
        }
      : undefined,
    execute: async (name) => {
      executions.push(name)
      return { ok: true, code: 'OK', summary: 'MCP fixture completed' }
    }
  }
  /** 被测 Agent Runtime。 */
  const runtime = new AgentRuntime({
    provider: createMcpProvider(),
    music: {
      read: async () => ({}),
      mutate: async () => ({}),
      cancel: () => {}
    },
    externalTools,
    emit: (event: AgentRuntimeEvent) => {
      if (event.type === 'snapshot') listeners.forEach((listener) => listener(event.snapshot))
    }
  })
  runtime.configureProvider({
    profileId: crypto.randomUUID(),
    protocol: 'openai-compatible',
    model: 'fixture',
    baseUrl: 'https://provider.example.com/v1'
  })
  return { runtime, listeners, executions }
}

// ========= 测试 =========

describe('Phase 7 external tool approval', () => {
  it('拒绝 MCP ApprovalCard 时底层保持零执行', async () => {
    /** MCP 审批夹具。 */
    const fixture = createFixture()
    /** 待审批快照。 */
    const pending = waitForSnapshot(fixture.listeners, (snapshot) =>
      snapshot.approvals.some((approval) => approval.status === 'pending'))
    await fixture.runtime.command({ operation: 'sendMessage', content: '调用外部 echo' })
    /** 唯一待决审批。 */
    const approval = (await pending).approvals.find((item) => item.status === 'pending')
    if (!approval) throw new Error('missing MCP approval')
    await fixture.runtime.command({
      operation: 'respondApproval',
      approvalId: approval.approvalId,
      decision: 'reject'
    })
    /** 拒绝后的完成快照。 */
    const completed = await waitForSnapshot(fixture.listeners, (snapshot) => snapshot.turnStatus === 'completed')

    expect(fixture.executions).toHaveLength(0)
    expect(completed.tools[0]).toMatchObject({ status: 'rejected', errorCode: 'USER_REJECTED' })
  })

  it('批准只绑定当前 MCP Tool Call 且恰好执行一次', async () => {
    /** MCP 审批夹具。 */
    const fixture = createFixture()
    /** 待审批快照。 */
    const pending = waitForSnapshot(fixture.listeners, (snapshot) =>
      snapshot.approvals.some((approval) => approval.status === 'pending'))
    await fixture.runtime.command({ operation: 'sendMessage', content: '调用外部 echo' })
    /** 唯一待决审批。 */
    const approval = (await pending).approvals.find((item) => item.status === 'pending')
    if (!approval) throw new Error('missing MCP approval')
    await fixture.runtime.command({
      operation: 'respondApproval',
      approvalId: approval.approvalId,
      decision: 'approve'
    })
    /** 工具执行后的完成快照。 */
    const completed = await waitForSnapshot(fixture.listeners, (snapshot) => snapshot.turnStatus === 'completed')

    expect(fixture.executions).toEqual(['mcp.fixture.echo'])
    expect(completed.tools[0]).toMatchObject({ status: 'succeeded' })
  })
})
