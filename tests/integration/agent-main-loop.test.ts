import { describe, expect, it } from 'vitest'

import {
  AgentRuntime,
  type AgentProviderPort
} from '../../src/domains/agent/agent-runtime'
import type { AgentRuntimeEvent, AgentSnapshot } from '../../src/shared/schemas/agent'

// ========= 变量 =========

/** 标准歌曲搜索结果夹具。 */
const searchResult = {
  kind: 'search' as const,
  query: '晴天',
  songs: [{
    kind: 'song' as const,
    id: '1',
    name: '晴天',
    artists: [{ id: '2', name: '周杰伦', alias: [] }],
    album: { id: '3', name: '叶惠美' },
    durationMs: 269_000,
    access: { badges: [], playableKnown: true },
    sources: [{ api: 'fixture', observedAt: '2026-08-10T08:00:00.000Z' }],
    updatedAt: '2026-08-10T08:00:00.000Z'
  }],
  artists: [],
  albums: [],
  playlists: [],
  updatedAt: '2026-08-10T08:00:00.000Z'
}

// ========= 工具函数 =========

/** 创建先调用搜播工具、再输出最终文本的 Provider。 */
function createProvider(): AgentProviderPort {
  /** 当前 Provider 请求轮次。 */
  let requestIndex = 0
  return {
    stream: async function* () {
      requestIndex += 1
      if (requestIndex === 1) {
        yield { type: 'tool-call-delta', id: 'call-search', name: 'smart_search_and_play', argumentsDelta: '{"action":"play","query":"晴天"}' }
        yield { type: 'completed', finishReason: 'tool_calls' }
        return
      }
      yield { type: 'text-delta', text: '已经为你播放《晴天》。' }
      yield { type: 'completed', finishReason: 'stop' }
    }
  }
}

/** 等待 Runtime 达到指定状态。 */
function waitForSnapshot(
  subscribe: (resolve: (snapshot: AgentSnapshot) => void) => void,
  predicate: (snapshot: AgentSnapshot) => boolean
): Promise<AgentSnapshot> {
  return new Promise((resolve, reject) => {
    /** 测试硬超时。 */
    const timer = setTimeout(() => reject(new Error('agent snapshot timeout')), 2_000)
    subscribe((snapshot) => {
      if (!predicate(snapshot)) return
      clearTimeout(timer)
      resolve(snapshot)
    })
  })
}

/** 构造带可控事件的 Agent Runtime。 */
function createRuntime(level: 'M1' | 'M2'): {
  runtime: AgentRuntime
  events: AgentRuntimeEvent[]
  onSnapshot: (listener: (snapshot: AgentSnapshot) => void) => void
} {
  /** 已观察到的 Runtime 事件。 */
  const events: AgentRuntimeEvent[] = []
  /** 快照订阅器。 */
  const listeners: Array<(snapshot: AgentSnapshot) => void> = []
  /** 被测 Agent Runtime。 */
  const runtime = new AgentRuntime({
    provider: createProvider(),
    music: {
      read: async () => searchResult,
      mutate: async () => ({ operation: 'dailySignin', applied: true }),
      cancel: () => {}
    },
    musicSafetyLevel: level,
    emit: (event) => {
      events.push(event)
      if (event.type === 'snapshot') listeners.forEach((listener) => listener(event.snapshot))
      if (event.type === 'player-command') {
        void runtime.command({
          operation: 'playerCommandResult',
          toolCallId: event.request.toolCallId,
          ok: true,
          summary: '已真实播放《晴天》。',
          latestRevision: 1
        })
      }
    }
  })
  runtime.configureProvider({
    profileId: crypto.randomUUID(),
    protocol: 'openai-compatible',
    model: 'model-a',
    baseUrl: 'https://provider.example.com/v1'
  })
  return {
    runtime,
    events,
    onSnapshot: (listener) => listeners.push(listener)
  }
}

// ========= 测试 =========

describe('agent main loop', () => {
  it('未传音乐等级时默认使用 M1', () => {
    /** 使用产品默认权限的 Agent Runtime。 */
    const runtime = new AgentRuntime({
      provider: createProvider(),
      music: {
        read: async () => searchResult,
        mutate: async () => ({ operation: 'dailySignin', applied: true }),
        cancel: () => {}
      },
      emit: () => {}
    })

    expect(runtime.snapshot().musicSafetyLevel).toBe('M1')
  })

  it('M2 下完成搜索、PlayerCommand 真实回执和最终回复', async () => {
    /** M2 搜播测试夹具。 */
    const fixture = createRuntime('M2')
    /** 本轮完成快照 Promise。 */
    const completed = waitForSnapshot(fixture.onSnapshot, (snapshot) => snapshot.turnStatus === 'completed')
    await fixture.runtime.command({ operation: 'sendMessage', content: '播放晴天' })
    /** 搜播完成快照。 */
    const snapshot = await completed

    expect(snapshot.tools[0]).toMatchObject({ status: 'succeeded', resultSummary: '已真实播放《晴天》。' })
    expect(fixture.events.map((event) => event.type)).toContain('player-command')
    expect(snapshot.messages.at(-1)?.content).toContain('已经为你播放')
  })

  it('M1 拒绝审批后播放器保持零执行', async () => {
    /** M1 审批测试夹具。 */
    const fixture = createRuntime('M1')
    /** 待审批快照 Promise。 */
    const pending = waitForSnapshot(fixture.onSnapshot, (snapshot) => snapshot.approvals.some((approval) => approval.status === 'pending'))
    await fixture.runtime.command({ operation: 'sendMessage', content: '播放晴天' })
    /** 已进入审批状态的快照。 */
    const approvalSnapshot = await pending
    /** 当前唯一待决审批。 */
    const approval = approvalSnapshot.approvals.find((item) => item.status === 'pending')
    if (!approval) throw new Error('missing approval')
    await fixture.runtime.command({ operation: 'respondApproval', approvalId: approval.approvalId, decision: 'reject' })
    /** 拒绝后的最终快照。 */
    const completed = await waitForSnapshot(fixture.onSnapshot, (snapshot) => snapshot.turnStatus === 'completed')

    expect(fixture.events.some((event) => event.type === 'player-command')).toBe(false)
    expect(completed.tools[0]).toMatchObject({ status: 'rejected', errorCode: 'USER_REJECTED' })
  })
})
