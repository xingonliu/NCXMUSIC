import { describe, expect, it } from 'vitest'

import {
  ASR_UNSUPPORTED_MESSAGE,
  AsrSupportCache,
  buildProviderTextStreamRequest,
  createProviderProfileFingerprint,
  normalizeProviderError,
  parseProviderStreamLine,
  requestProviderTextStream,
  transcribeWithProviderProfile,
  type ProviderHttpClient,
  type ProviderHttpRequest,
  type ProviderHttpResponse,
  type ProviderProfile,
  type ProviderStreamEvent,
  type ProviderToolDefinition
} from '../../src/infrastructure/provider/provider-protocol'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** fake HTTP 响应构造器。 */
type FakeResponder = (
  request: ProviderHttpRequest,
  signal: AbortSignal
) => ProviderHttpResponse | Promise<ProviderHttpResponse>

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身区
// ─────────────────────────────────────────────────────────────────────────────

/** Provider HTTP fake client，用于记录请求并按顺序返回夹具响应。 */
class FakeProviderHttpClient implements ProviderHttpClient {
  /** 已发送请求快照。 */
  readonly requests: ProviderHttpRequest[] = []

  /** 尚未消费的响应构造器队列。 */
  private readonly responders: FakeResponder[]

  constructor(responders: readonly FakeResponder[]) {
    this.responders = [...responders]
  }

  /** 记录请求并返回下一个 fake 响应。 */
  async send(request: ProviderHttpRequest, signal: AbortSignal): Promise<ProviderHttpResponse> {
    this.requests.push(request)
    /** 当前响应构造器。 */
    const responder = this.responders.shift()
    if (!responder) throw new Error('missing fake provider response')
    return responder(request, signal)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 创建 Provider Profile 测试夹具。 */
function createProfile(overrides: Partial<ProviderProfile> = {}): ProviderProfile {
  return {
    profileId: 'profile-1',
    protocol: 'openai-compatible',
    model: 'model-a',
    baseUrl: 'https://provider.example.com/v1',
    headers: {
      authorization: 'Bearer test-token'
    },
    credentialFingerprint: 'credential-a',
    ...overrides
  }
}

/** 创建工具定义测试夹具。 */
function createTool(overrides: Partial<ProviderToolDefinition> = {}): ProviderToolDefinition {
  return {
    name: 'control_player',
    description: '控制播放器',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string'
        }
      },
      required: ['action']
    },
    ...overrides
  }
}

/** 创建异步文本行迭代器。 */
async function* createLines(lines: readonly string[]): AsyncGenerator<string> {
  for (const line of lines) yield line
}

/** 收集 Provider 流式事件。 */
async function collectStream(stream: AsyncGenerator<ProviderStreamEvent>): Promise<ProviderStreamEvent[]> {
  /** 已收集的归一化事件。 */
  const events: ProviderStreamEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

/** 读取 fake client 的指定请求。 */
function getRequest(client: FakeProviderHttpClient, index = 0): ProviderHttpRequest {
  /** 已记录的目标请求。 */
  const request = client.requests[index]
  if (!request) throw new Error(`missing fake request ${index}`)
  return request
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试区
// ─────────────────────────────────────────────────────────────────────────────

describe('provider protocol fixtures', () => {
  it('构造并解析 OpenAI Compatible 文本流、Tool Call 和完成事件', async () => {
    const profile = createProfile()
    const client = new FakeProviderHttpClient([
      () => ({
        status: 200,
        lines: createLines([
          'data: {"choices":[{"delta":{"content":"你好"}}]}',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"control_player","arguments":"{\\"action\\""}}]}}]}',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"play\\"}"}}]},"finish_reason":"tool_calls"}]}',
          'data: [DONE]'
        ])
      })
    ])

    const events = await collectStream(
      requestProviderTextStream(
        profile,
        {
          messages: [{ role: 'user', content: '播放' }],
          tools: [createTool()]
        },
        { client }
      )
    )
    const request = getRequest(client)
    const body = request.body as Record<string, unknown>

    expect(request.url).toBe('https://provider.example.com/v1/chat/completions')
    expect(body).toMatchObject({
      model: 'model-a',
      stream: true
    })
    expect(body.tools).toMatchObject([
      {
        type: 'function',
        function: {
          name: 'control_player'
        }
      }
    ])
    expect(events).toEqual([
      { type: 'text-delta', text: '你好' },
      {
        type: 'tool-call-delta',
        id: 'call_1',
        index: 0,
        name: 'control_player',
        argumentsDelta: '{"action"'
      },
      {
        type: 'tool-call-delta',
        id: 'call_1',
        index: 0,
        argumentsDelta: ':"play"}'
      },
      { type: 'completed', finishReason: 'tool_calls' },
      { type: 'completed', finishReason: 'stop' }
    ])
  })

  it('构造并解析 Anthropic Messages 文本流和 tool_use 增量', async () => {
    const profile = createProfile({
      protocol: 'anthropic-messages',
      baseUrl: 'https://anthropic.example.com'
    })
    const request = buildProviderTextStreamRequest(profile, {
      messages: [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '搜索歌曲' }
      ],
      tools: [createTool()]
    })
    const body = request.body as Record<string, unknown>

    expect(request.url).toBe('https://anthropic.example.com/messages')
    expect(request.headers['anthropic-version']).toBe('2023-06-01')
    expect(body.system).toBe('系统提示')
    expect(body.tools).toMatchObject([{ name: 'control_player' }])
    expect(
      parseProviderStreamLine(
        'anthropic-messages',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"结果"}}'
      )
    ).toEqual([{ type: 'text-delta', text: '结果' }])
    expect(
      parseProviderStreamLine(
        'anthropic-messages',
        'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"call_a","name":"control_player"}}'
      )
    ).toEqual([{ type: 'tool-call-delta', id: 'call_a', index: 1, name: 'control_player' }])
    expect(
      parseProviderStreamLine(
        'anthropic-messages',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"action\\":\\"pause\\"}"}}'
      )
    ).toEqual([{ type: 'tool-call-delta', id: 'tool-1', index: 1, argumentsDelta: '{"action":"pause"}' }])
  })

  it('构造并解析 Gemini generateContent 文本流和 functionCall', () => {
    const profile = createProfile({
      protocol: 'gemini-generate-content',
      model: 'gemini-test',
      baseUrl: 'https://gemini.example.com/v1beta'
    })
    const request = buildProviderTextStreamRequest(profile, {
      messages: [
        { role: 'system', content: '系统提示' },
        { role: 'user', content: '下一首' }
      ],
      tools: [createTool()]
    })
    const body = request.body as Record<string, unknown>
    const events = parseProviderStreamLine(
      'gemini-generate-content',
      'data: {"candidates":[{"content":{"parts":[{"text":"好的"},{"functionCall":{"name":"control_player","args":{"action":"next"}}}]},"finishReason":"STOP"}]}'
    )

    expect(request.url).toBe(
      'https://gemini.example.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse'
    )
    expect(body.systemInstruction).toMatchObject({ parts: [{ text: '系统提示' }] })
    expect(body.tools).toMatchObject([
      {
        functionDeclarations: [
          {
            name: 'control_player'
          }
        ]
      }
    ])
    expect(events).toEqual([
      { type: 'text-delta', text: '好的' },
      {
        type: 'tool-call-delta',
        id: 'tool-1',
        name: 'control_player',
        argumentsDelta: '{"action":"next"}'
      },
      { type: 'completed', finishReason: 'STOP' }
    ])
  })

  it('归一化 Provider 错误并脱敏敏感头', () => {
    const error = normalizeProviderError({
      protocol: 'openai-compatible',
      status: 401,
      body: {
        error: {
          type: 'auth_error',
          message: 'authorization: Bearer secret-token'
        }
      }
    })

    expect(error).toMatchObject({
      protocol: 'openai-compatible',
      code: 'auth',
      retryable: false,
      providerType: 'auth_error'
    })
    expect(error.message).toContain('[REDACTED]')
    expect(error.message).not.toContain('secret-token')
  })

  it('取消信号会产生稳定 cancelled 错误', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      collectStream(
        requestProviderTextStream(
          createProfile(),
          { messages: [{ role: 'user', content: '取消' }] },
          { signal: controller.signal }
        )
      )
    ).rejects.toMatchObject({
      normalized: {
        code: 'cancelled',
        retryable: false
      }
    })
  })

  it('HTML 成功响应会提示检查 API Base URL，而不是暴露 JSON 语法错误', async () => {
    /** 返回前端网页的错误 Provider 客户端。 */
    const client = new FakeProviderHttpClient([
      () => ({
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        lines: createLines(['<!doctype html>', '<html></html>'])
      })
    ])

    await expect(
      collectStream(
        requestProviderTextStream(
          createProfile(),
          { messages: [{ role: 'user', content: '测试错误地址' }] },
          { client }
        )
      )
    ).rejects.toMatchObject({
      normalized: {
        code: 'request',
        message: expect.stringContaining('HTML 页面'),
        providerType: 'invalid_response_format',
        retryable: false,
        status: 200
      }
    })
  })

  it('缺少 Content-Type 时也会安全归一化 HTML 流分片', async () => {
    /** 没有响应类型头但正文为网页的错误 Provider 客户端。 */
    const client = new FakeProviderHttpClient([
      () => ({
        status: 200,
        lines: createLines(['<!doctype html>'])
      })
    ])

    await expect(
      collectStream(
        requestProviderTextStream(
          createProfile(),
          { messages: [{ role: 'user', content: '测试无响应头地址' }] },
          { client }
        )
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining('HTML 页面'),
      normalized: {
        code: 'request',
        providerType: 'invalid_response_format',
        retryable: false
      }
    })
  })

  it('2xx 非流式响应会返回稳定的流式协议提示', async () => {
    /** 忽略 stream 参数并返回普通 JSON 的 Provider 客户端。 */
    const client = new FakeProviderHttpClient([
      () => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        json: { choices: [] }
      })
    ])

    await expect(
      collectStream(
        requestProviderTextStream(
          createProfile(),
          { messages: [{ role: 'user', content: '测试非流式响应' }] },
          { client }
        )
      )
    ).rejects.toMatchObject({
      normalized: {
        code: 'request',
        message: expect.stringContaining('SSE/JSONL'),
        providerType: 'invalid_response_format',
        retryable: false,
        status: 200
      }
    })
  })
})

describe('provider ASR support fixtures', () => {
  it('缓存 unsupported 后停止后续录音上传，并在模型切换时重新探测', async () => {
    const profile = createProfile()
    const cache = new AsrSupportCache()
    const client = new FakeProviderHttpClient([
      () => ({
        status: 404,
        json: {
          error: {
            message: 'ASR endpoint not supported'
          }
        }
      }),
      () => ({
        status: 404,
        json: {
          error: {
            message: 'ASR endpoint not supported by new model'
          }
        }
      })
    ])
    const firstAudio = new Uint8Array([1, 2, 3])
    const secondAudio = new Uint8Array([4, 5, 6])
    const switchedAudio = new Uint8Array([7, 8, 9])

    const first = await transcribeWithProviderProfile({
      profile,
      audio: firstAudio,
      mimeType: 'audio/wav',
      client,
      cache
    })
    const second = await transcribeWithProviderProfile({
      profile,
      audio: secondAudio,
      mimeType: 'audio/wav',
      client,
      cache
    })
    const switched = await transcribeWithProviderProfile({
      profile: {
        ...profile,
        model: 'model-b'
      },
      audio: switchedAudio,
      mimeType: 'audio/wav',
      client,
      cache
    })

    expect(first).toMatchObject({ status: 'unsupported', message: ASR_UNSUPPORTED_MESSAGE })
    expect(second).toMatchObject({ status: 'unsupported', message: ASR_UNSUPPORTED_MESSAGE })
    expect(switched).toMatchObject({ status: 'unsupported', message: ASR_UNSUPPORTED_MESSAGE })
    expect(client.requests).toHaveLength(2)
    expect(firstAudio).toEqual(new Uint8Array([0, 0, 0]))
    expect(secondAudio).toEqual(new Uint8Array([0, 0, 0]))
    expect(switchedAudio).toEqual(new Uint8Array([0, 0, 0]))
  })

  it('探测 supported 后复用当前 Profile 上传转写，不自动切换供应商', async () => {
    const profile = createProfile()
    const cache = new AsrSupportCache()
    const client = new FakeProviderHttpClient([
      () => ({
        status: 400,
        json: {
          error: {
            message: 'invalid audio probe payload'
          }
        }
      }),
      () => ({
        status: 200,
        json: {
          text: '第一段转写'
        }
      }),
      () => ({
        status: 200,
        json: {
          text: '第二段转写'
        }
      })
    ])
    const firstAudio = new Uint8Array([11, 12])
    const secondAudio = new Uint8Array([13, 14])

    const first = await transcribeWithProviderProfile({
      profile,
      audio: firstAudio,
      mimeType: 'audio/wav',
      client,
      cache
    })
    const second = await transcribeWithProviderProfile({
      profile,
      audio: secondAudio,
      mimeType: 'audio/wav',
      client,
      cache
    })

    expect(first).toEqual({ status: 'transcribed', text: '第一段转写' })
    expect(second).toEqual({ status: 'transcribed', text: '第二段转写' })
    expect(client.requests).toHaveLength(3)
    expect(getRequest(client, 0).url).toBe('https://provider.example.com/v1/audio/transcriptions')
    expect(getRequest(client, 1).url).toBe('https://provider.example.com/v1/audio/transcriptions')
    expect(firstAudio).toEqual(new Uint8Array([0, 0]))
    expect(secondAudio).toEqual(new Uint8Array([0, 0]))
  })

  it('协议、模型、Base URL、Headers 或凭据变化都会改变 ASR 缓存指纹', () => {
    const base = createProfile()
    const fingerprints = new Set([
      createProviderProfileFingerprint(base),
      createProviderProfileFingerprint({ ...base, protocol: 'gemini-generate-content' }),
      createProviderProfileFingerprint({ ...base, model: 'model-b' }),
      createProviderProfileFingerprint({ ...base, baseUrl: 'https://provider-b.example.com/v1' }),
      createProviderProfileFingerprint({ ...base, headers: { authorization: 'Bearer other-token' } }),
      createProviderProfileFingerprint({ ...base, credentialFingerprint: 'credential-b' })
    ])

    expect(fingerprints.size).toBe(6)
  })
})
