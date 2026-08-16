import { sanitizeErrorMessage } from '../../shared/errors/public-error'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** T-08 首批需要验证的 Provider 协议族。 */
export type ProviderProtocol = 'openai-compatible' | 'anthropic-messages' | 'gemini-generate-content'

/** Provider Profile 中足以决定协议能力和 ASR 缓存边界的公开配置。 */
export interface ProviderProfile {
  /** 用户配置中的稳定 Profile ID。 */
  readonly profileId: string
  /** 当前 Profile 选择的协议族。 */
  readonly protocol: ProviderProtocol
  /** 当前 Profile 选择的模型名。 */
  readonly model: string
  /** 当前 Profile 的服务根地址，不在此处推断品牌能力。 */
  readonly baseUrl: string
  /** 当前 Profile 注入请求的头；值只进入内存哈希，不写日志。 */
  readonly headers?: Readonly<Record<string, string>>
  /** 当前凭据的不可逆指纹；切换凭据时用于让 ASR 能力缓存失效。 */
  readonly credentialFingerprint?: string
}

/** Provider 流式请求中使用的最小消息结构。 */
export interface ProviderMessage {
  /** Provider 对话角色。 */
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  /** 已归一化、可发送给 Provider 的文本内容。 */
  readonly content: string
  /** Tool 回填消息关联的调用 ID。 */
  readonly toolCallId?: string
  /** Tool 回填消息对应的注册工具名，Gemini functionResponse 必需。 */
  readonly toolName?: string
  /** Assistant 消息中已经完整归一化的 Tool Call。 */
  readonly toolCalls?: readonly ProviderCompletedToolCall[]
}

/** Provider 对话历史中的完整 Tool Call。 */
export interface ProviderCompletedToolCall {
  /** Provider Tool Call ID。 */
  readonly id: string
  /** 注册工具名。 */
  readonly name: string
  /** 完整 JSON 参数文本。 */
  readonly arguments: string
}

/** Runtime 暴露给模型的工具定义在协议层的最小公共形态。 */
export interface ProviderToolDefinition {
  /** 模型可见的工具名称。 */
  readonly name: string
  /** 模型可见的工具说明。 */
  readonly description: string
  /** JSON Schema 形态的输入参数定义。 */
  readonly parameters: Readonly<Record<string, unknown>>
}

/** 构造文本流式请求所需的输入。 */
export interface ProviderTextStreamInput {
  /** 当前 Turn 的对话消息。 */
  readonly messages: readonly ProviderMessage[]
  /** 当前 Turn 可见的工具定义。 */
  readonly tools?: readonly ProviderToolDefinition[]
  /** Provider 单次输出上限。 */
  readonly maxTokens?: number
}

/** 协议层可发出的 HTTP 请求。 */
export interface ProviderHttpRequest {
  /** 请求方法。 */
  readonly method: 'POST'
  /** 完整请求 URL。 */
  readonly url: string
  /** 请求头，已合并 Profile headers。 */
  readonly headers: Readonly<Record<string, string>>
  /** 请求体，测试夹具可直接断言结构，真实 fetch 再序列化。 */
  readonly body: unknown
}

/** 协议层 HTTP 响应的最小读取接口。 */
export interface ProviderHttpResponse {
  /** HTTP 状态码。 */
  readonly status: number
  /** 响应头快照。 */
  readonly headers?: Readonly<Record<string, string>>
  /** 流式文本行，SSE 与 JSONL 都在这里归一。 */
  readonly lines?: AsyncIterable<string>
  /** 非流式 JSON 响应体。 */
  readonly json?: unknown
  /** 非流式文本响应体。 */
  readonly text?: string
}

/** 真实 fetch 与单测 fake client 共享的 HTTP 客户端接口。 */
export interface ProviderHttpClient {
  /** 发送请求并遵守 Runtime 传入的取消信号。 */
  send(request: ProviderHttpRequest, signal: AbortSignal): Promise<ProviderHttpResponse>
}

/** Provider 流归一化后的增量事件。 */
export type ProviderStreamEvent =
  | {
      /** 文本增量事件。 */
      readonly type: 'text-delta'
      /** 本次新增文本。 */
      readonly text: string
    }
  | {
      /** Tool Call 增量事件。 */
      readonly type: 'tool-call-delta'
      /** Provider 返回或夹具生成的调用 ID。 */
      readonly id: string
      /** Provider 响应中的稳定调用槽位。 */
      readonly index?: number
      /** Provider 返回的工具名称。 */
      readonly name?: string
      /** Provider 返回的 JSON 参数片段。 */
      readonly argumentsDelta?: string
    }
  | {
      /** Provider 流完成事件。 */
      readonly type: 'completed'
      /** Provider 原始结束原因。 */
      readonly finishReason?: string
    }

/** 归一化 Provider 错误的稳定错误码。 */
export type ProviderErrorCode =
  | 'auth'
  | 'quota'
  | 'rate-limit'
  | 'request'
  | 'unsupported'
  | 'content-policy'
  | 'cancelled'
  | 'timeout'
  | 'server'
  | 'network'
  | 'unknown'

/** Runtime 可以安全展示和决策的 Provider 错误。 */
export interface NormalizedProviderError {
  /** 当前错误所属协议。 */
  readonly protocol: ProviderProtocol
  /** 稳定错误码。 */
  readonly code: ProviderErrorCode
  /** 已脱敏、截断的展示消息。 */
  readonly message: string
  /** HTTP 状态码，网络错误可为空。 */
  readonly status?: number
  /** 是否允许 Runtime 按策略重试。 */
  readonly retryable: boolean
  /** Provider 原始错误类型或 code，已脱敏。 */
  readonly providerType?: string
}

/** normalizeProviderError 的输入形态。 */
export interface ProviderErrorInput {
  /** 当前错误所属协议。 */
  readonly protocol: ProviderProtocol
  /** HTTP 状态码，网络错误可为空。 */
  readonly status?: number
  /** Provider 原始错误体。 */
  readonly body?: unknown
  /** 本地异常原因。 */
  readonly cause?: unknown
  /** AbortSignal 是否已经取消。 */
  readonly aborted?: boolean
}

/** ASR 能力探测缓存中的稳定状态。 */
export type AsrSupportStatus = 'supported' | 'unsupported'

/** ASR 能力缓存记录。 */
export interface AsrSupportCacheEntry {
  /** 当前 Profile 指纹对应的 ASR 支持状态。 */
  readonly status: AsrSupportStatus
  /** 最近一次探测得到的简短原因。 */
  readonly reason?: string
}

/** Provider Profile ASR 转写输入。 */
export interface AsrTranscriptionInput {
  /** 当前唯一 Provider Profile。 */
  readonly profile: ProviderProfile
  /** 用户本次录音的原始音频缓冲，仅在内存中使用并在 finally 中清零。 */
  readonly audio: Uint8Array
  /** 录音 MIME 类型。 */
  readonly mimeType: string
  /** 可注入的 HTTP 客户端，默认使用 fetch。 */
  readonly client?: ProviderHttpClient
  /** 可注入的 ASR 能力缓存，便于测试和 Runtime 生命周期管理。 */
  readonly cache?: AsrSupportCache
  /** Runtime 取消信号。 */
  readonly signal?: AbortSignal
}

/** Provider ASR 转写结果。 */
export type AsrTranscriptionResult =
  | {
      /** 已完成转写。 */
      readonly status: 'transcribed'
      /** Provider 返回的识别文本。 */
      readonly text: string
    }
  | {
      /** 当前 Profile 已确认不支持 ASR。 */
      readonly status: 'unsupported'
      /** 面向用户的固定提示文案。 */
      readonly message: string
      /** 最近一次探测得到的简短原因。 */
      readonly reason?: string
    }

// ─────────────────────────────────────────────────────────────────────────────
// 常量区
// ─────────────────────────────────────────────────────────────────────────────

/** Anthropic Messages 协议固定版本头，后续产品化可移入模型目录。 */
const ANTHROPIC_VERSION = '2023-06-01'

/** Provider 文本请求默认输出上限。 */
const DEFAULT_MAX_TOKENS = 1024

/** ASR 不支持时统一使用的确认文案，避免自动切换供应商。 */
export const ASR_UNSUPPORTED_MESSAGE =
  '当前大模型不支持语音识别（ASR）。'

/** ASR 能力探测使用的内存哨兵音频，不复用用户原始录音。 */
const ASR_PROBE_BYTES = new Uint8Array([0])

/** fetch 请求接受的正文构造器名称集合。 */
const BODY_INIT_TAGS = new Set(['FormData', 'Blob', 'ArrayBuffer', 'URLSearchParams'])

/** Provider 返回网页而不是模型 API 流时的可操作提示。 */
const HTML_RESPONSE_MESSAGE =
  'Provider 返回了 HTML 页面而不是模型 API 流。请检查 Base URL 是否指向 API 根地址，并确认所选协议与服务商一致。'

/** Provider 返回非流式成功响应时的可操作提示。 */
const NON_STREAM_RESPONSE_MESSAGE =
  'Provider 未返回 SSE/JSONL 流。请检查 Base URL、所选协议及模型服务的流式响应支持。'

/** Provider 流分片不是合法 JSON 时的可操作提示。 */
const INVALID_STREAM_JSON_MESSAGE =
  'Provider 流包含无效 JSON。请检查 Base URL、所选协议及上游代理响应。'

// ─────────────────────────────────────────────────────────────────────────────
// 错误区
// ─────────────────────────────────────────────────────────────────────────────

/** Provider 协议层抛出的结构化错误。 */
export class ProviderProtocolError extends Error {
  /** 已归一化的 Provider 错误。 */
  readonly normalized: NormalizedProviderError

  constructor(normalized: NormalizedProviderError) {
    super(normalized.message)
    this.name = 'ProviderProtocolError'
    this.normalized = normalized
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 请求构造区
// ─────────────────────────────────────────────────────────────────────────────

/** 构造当前 Profile 的文本流式请求。 */
export function buildProviderTextStreamRequest(
  profile: ProviderProfile,
  input: ProviderTextStreamInput
): ProviderHttpRequest {
  if (profile.protocol === 'openai-compatible') return buildOpenAITextStreamRequest(profile, input)
  if (profile.protocol === 'anthropic-messages') return buildAnthropicTextStreamRequest(profile, input)
  return buildGeminiTextStreamRequest(profile, input)
}

/** 构造 OpenAI Compatible Chat Completions 流式请求。 */
function buildOpenAITextStreamRequest(
  profile: ProviderProfile,
  input: ProviderTextStreamInput
): ProviderHttpRequest {
  /** OpenAI Compatible 的 tools 使用 function 包装。 */
  const tools = input.tools?.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))

  /** OpenAI Compatible 请求体保持最小协议字段。 */
  const body = {
    model: profile.model,
    messages: input.messages.map((message) => compactUndefined({
      role: message.role,
      content: message.role === 'assistant' && message.toolCalls?.length && !message.content
        ? null
        : message.content,
      tool_call_id: message.toolCallId,
      tool_calls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: { name: toolCall.name, arguments: toolCall.arguments }
      }))
    })),
    stream: true,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    tools: tools && tools.length > 0 ? tools : undefined
  }

  return {
    method: 'POST',
    url: joinProviderUrl(profile.baseUrl, '/chat/completions'),
    headers: jsonStreamHeaders(profile),
    body: compactUndefined(body)
  }
}

/** 构造 Anthropic Messages 流式请求。 */
function buildAnthropicTextStreamRequest(
  profile: ProviderProfile,
  input: ProviderTextStreamInput
): ProviderHttpRequest {
  /** Anthropic system 提示独立于 messages 数组。 */
  const systemText = input.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  /** Anthropic 对话消息不接受 system role。 */
  const messages = input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'assistant',
          content: [
            ...(message.content ? [{ type: 'text', text: message.content }] : []),
            ...message.toolCalls.map((toolCall) => ({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: parseJsonObject(toolCall.arguments)
            }))
          ]
        }
      }
      if (message.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.toolCallId,
            content: message.content
          }]
        }
      }
      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }
    })

  /** Anthropic tools 使用 input_schema 字段。 */
  const tools = input.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }))

  /** Anthropic Messages 请求体保持流式与最大输出上限。 */
  const body = {
    model: profile.model,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    stream: true,
    system: systemText.length > 0 ? systemText : undefined,
    messages,
    tools: tools && tools.length > 0 ? tools : undefined
  }

  return {
    method: 'POST',
    url: joinProviderUrl(profile.baseUrl, '/messages'),
    headers: {
      ...jsonStreamHeaders(profile),
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: compactUndefined(body)
  }
}

/** 构造 Gemini generateContent 流式请求。 */
function buildGeminiTextStreamRequest(
  profile: ProviderProfile,
  input: ProviderTextStreamInput
): ProviderHttpRequest {
  /** Gemini system 提示需要放入 systemInstruction。 */
  const systemText = input.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  /** Gemini contents 使用 user/model 角色。 */
  const contents = input.messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'model',
          parts: [
            ...(message.content ? [{ text: message.content }] : []),
            ...message.toolCalls.map((toolCall) => ({
              functionCall: {
                name: toolCall.name,
                args: parseJsonObject(toolCall.arguments)
              }
            }))
          ]
        }
      }
      if (message.role === 'tool') {
        return {
          role: 'user',
          parts: [{
            functionResponse: {
              name: message.toolName ?? 'tool',
              response: parseJsonObject(message.content)
            }
          }]
        }
      }
      return {
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }
    })

  /** Gemini functionDeclarations 位于 tools.functionDeclarations。 */
  const tools =
    input.tools && input.tools.length > 0
      ? [
          {
            functionDeclarations: input.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }))
          }
        ]
      : undefined

  /** Gemini generateContent 请求体。 */
  const body = {
    contents,
    systemInstruction: systemText.length > 0 ? { parts: [{ text: systemText }] } : undefined,
    generationConfig: {
      maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS
    },
    tools
  }

  return {
    method: 'POST',
    url: joinProviderUrl(
      profile.baseUrl,
      `/${normalizeGeminiModelPath(profile.model)}:streamGenerateContent?alt=sse`
    ),
    headers: jsonStreamHeaders(profile),
    body: compactUndefined(body)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 流式解析区
// ─────────────────────────────────────────────────────────────────────────────

/** 请求 Provider 文本流并逐条产出归一化事件。 */
export async function* requestProviderTextStream(
  profile: ProviderProfile,
  input: ProviderTextStreamInput,
  options: { readonly client?: ProviderHttpClient; readonly signal?: AbortSignal } = {}
): AsyncGenerator<ProviderStreamEvent> {
  /** Runtime 取消信号；没有传入时创建本地信号以简化调用方。 */
  const signal = options.signal ?? new AbortController().signal
  /** 实际 HTTP 客户端；单测默认注入 fake，产品化默认使用 fetch。 */
  const client = options.client ?? fetchProviderHttpClient
  if (signal.aborted) throw new ProviderProtocolError(cancelledError(profile.protocol))

  try {
    /** Provider 协议对应的 HTTP 请求。 */
    const request = buildProviderTextStreamRequest(profile, input)
    /** Provider 返回的 HTTP 响应。 */
    const response = await client.send(request, signal)
    if (isHtmlResponse(response.headers)) {
      throw new ProviderProtocolError(
        unexpectedProviderResponseError(profile.protocol, HTML_RESPONSE_MESSAGE, response.status)
      )
    }
    if (response.status < 200 || response.status >= 300) {
      throw new ProviderProtocolError(
        normalizeProviderError({
          protocol: profile.protocol,
          status: response.status,
          body: response.json ?? response.text
        })
      )
    }

    /** 响应中的流式文本行。 */
    const lines = response.lines
    if (!lines) {
      throw new ProviderProtocolError(
        unexpectedProviderResponseError(profile.protocol, NON_STREAM_RESPONSE_MESSAGE, response.status)
      )
    }
    /** 将协议分片中的调用槽位关联到首个稳定 Tool Call ID。 */
    const toolCallIds = new Map<number, string>()
    for await (const line of lines) {
      if (signal.aborted) throw new ProviderProtocolError(cancelledError(profile.protocol))
      for (const event of parseProviderStreamLine(profile.protocol, line)) {
        if (event.type !== 'tool-call-delta' || event.index === undefined) {
          yield event
          continue
        }
        /** 当前槽位已经观察到的稳定 ID。 */
        const knownId = toolCallIds.get(event.index)
        if (!knownId && event.name) toolCallIds.set(event.index, event.id)
        yield { ...event, id: knownId ?? event.id }
      }
    }
  } catch (cause) {
    if (cause instanceof ProviderProtocolError) throw cause
    throw new ProviderProtocolError(
      normalizeProviderError({ protocol: profile.protocol, cause, aborted: signal.aborted })
    )
  }
}

/** 将单行 SSE/JSONL 解析为 Provider 归一化事件。 */
export function parseProviderStreamLine(
  protocol: ProviderProtocol,
  line: string
): ProviderStreamEvent[] {
  /** SSE data 行解析后的 JSON payload。 */
  let payload: ReturnType<typeof parseDataPayload>
  try {
    payload = parseDataPayload(line)
  } catch {
    /** 当前无效分片是否看起来是 HTML 文档。 */
    const looksLikeHtml = isHtmlText(line)
    throw new ProviderProtocolError(
      unexpectedProviderResponseError(
        protocol,
        looksLikeHtml ? HTML_RESPONSE_MESSAGE : INVALID_STREAM_JSON_MESSAGE
      )
    )
  }
  if (payload.kind === 'skip') return []
  if (payload.kind === 'done') return [{ type: 'completed', finishReason: 'stop' }]
  if (protocol === 'openai-compatible') return parseOpenAIStreamPayload(payload.value)
  if (protocol === 'anthropic-messages') return parseAnthropicStreamPayload(payload.value)
  return parseGeminiStreamPayload(payload.value)
}

/** 解析 OpenAI Compatible 流式 JSON payload。 */
function parseOpenAIStreamPayload(value: unknown): ProviderStreamEvent[] {
  /** OpenAI choices 数组，兼容空数组。 */
  const choices = getArray(getRecord(value), 'choices')
  /** 当前 payload 产出的归一化事件。 */
  const events: ProviderStreamEvent[] = []

  for (const choice of choices) {
    /** OpenAI choice 对象。 */
    const choiceRecord = getRecord(choice)
    /** OpenAI delta 对象。 */
    const delta = getRecord(choiceRecord.delta)
    /** OpenAI 思考链增量（兼容 reasoning_content 与 reasoning 字段）。 */
    const reasoning = getString(delta.reasoning_content) || getString(delta.reasoning)
    if (reasoning) {
      events.push({ type: 'text-delta', text: `<think>${reasoning}</think>` })
    }
    /** OpenAI 正常文本增量。 */
    const content = getString(delta.content)
    if (content) {
      events.push({ type: 'text-delta', text: content })
    }

    /** OpenAI tool_calls 增量数组。 */
    const toolCalls = getArray(delta, 'tool_calls')
    for (const toolCall of toolCalls) {
      /** OpenAI 单个 tool_call 增量。 */
      const toolCallRecord = getRecord(toolCall)
      /** OpenAI function 增量。 */
      const functionRecord = getRecord(toolCallRecord.function)
      events.push(
        createToolCallDelta(
          getString(toolCallRecord.id) ?? `tool-${String(toolCallRecord.index ?? 0)}`,
          getString(functionRecord.name),
          getString(functionRecord.arguments),
          getNumber(toolCallRecord.index)
        )
      )
    }

    /** OpenAI finish_reason。 */
    const finishReason = getString(choiceRecord.finish_reason)
    if (finishReason) events.push({ type: 'completed', finishReason })
  }

  return events
}

/** 解析 Anthropic Messages 流式 JSON payload。 */
function parseAnthropicStreamPayload(value: unknown): ProviderStreamEvent[] {
  /** Anthropic payload 对象。 */
  const record = getRecord(value)
  /** Anthropic 事件类型。 */
  const eventType = getString(record.type)
  if (eventType === 'content_block_delta') return parseAnthropicDelta(record)
  if (eventType === 'content_block_start') return parseAnthropicContentBlockStart(record)
  if (eventType === 'message_delta') {
    return [createCompletedEvent(getString(getRecord(record.delta).stop_reason))]
  }
  if (eventType === 'message_stop') return [{ type: 'completed', finishReason: 'stop' }]
  return []
}

/** 解析 Anthropic content_block_delta。 */
function parseAnthropicDelta(record: Readonly<Record<string, unknown>>): ProviderStreamEvent[] {
  /** Anthropic delta 对象。 */
  const delta = getRecord(record.delta)
  /** Anthropic delta 类型。 */
  const deltaType = getString(delta.type)
  if (deltaType === 'text_delta') {
    /** Anthropic 文本增量。 */
    const text = getString(delta.text)
    return text ? [{ type: 'text-delta', text }] : []
  }
  if (deltaType === 'thinking_delta') {
    /** Anthropic 思考链增量。 */
    const thinking = getString(delta.thinking)
    return thinking ? [{ type: 'text-delta', text: `<think>${thinking}</think>` }] : []
  }
  if (deltaType === 'input_json_delta') {
    return [createToolCallDelta(
      `tool-${String(record.index ?? 0)}`,
      undefined,
      getString(delta.partial_json),
      getNumber(record.index)
    )]
  }
  return []
}

/** 解析 Anthropic content_block_start 中的 tool_use。 */
function parseAnthropicContentBlockStart(
  record: Readonly<Record<string, unknown>>
): ProviderStreamEvent[] {
  /** Anthropic content_block 对象。 */
  const block = getRecord(record.content_block)
  if (getString(block.type) !== 'tool_use') return []
  return [createToolCallDelta(
    getString(block.id) ?? `tool-${String(record.index ?? 0)}`,
    getString(block.name),
    undefined,
    getNumber(record.index)
  )]
}

/** 解析 Gemini generateContent 流式 JSON payload。 */
function parseGeminiStreamPayload(value: unknown): ProviderStreamEvent[] {
  /** Gemini candidates 数组。 */
  const candidates = getArray(getRecord(value), 'candidates')
  /** 当前 payload 产出的归一化事件。 */
  const events: ProviderStreamEvent[] = []

  for (const candidate of candidates) {
    /** Gemini candidate 对象。 */
    const candidateRecord = getRecord(candidate)
    /** Gemini parts 数组。 */
    const parts = getArray(getRecord(candidateRecord.content), 'parts')
    for (const part of parts) {
      /** Gemini part 对象。 */
      const partRecord = getRecord(part)
      /** Gemini 文本增量。 */
      const text = getString(partRecord.text)
      if (text) {
        if (partRecord.thought === true) {
          events.push({ type: 'text-delta', text: `<think>${text}</think>` })
        } else {
          events.push({ type: 'text-delta', text })
        }
      }

      /** Gemini functionCall 对象。 */
      const functionCall = getRecord(partRecord.functionCall)
      /** Gemini functionCall 名称。 */
      const functionName = getString(functionCall.name)
      if (functionName) {
        events.push(
          createToolCallDelta(`tool-${events.length}`, functionName, JSON.stringify(functionCall.args ?? {}))
        )
      }
    }

    /** Gemini finishReason。 */
    const finishReason = getString(candidateRecord.finishReason)
    if (finishReason) events.push({ type: 'completed', finishReason })
  }

  return events
}

/** 构造 Tool Call 增量事件，只写入实际存在的可选字段。 */
function createToolCallDelta(
  id: string,
  name?: string,
  argumentsDelta?: string,
  index?: number
): ProviderStreamEvent {
  /** Tool Call 增量事件。 */
  const event: {
    type: 'tool-call-delta'
    id: string
    index?: number
    name?: string
    argumentsDelta?: string
  } = {
    type: 'tool-call-delta',
    id
  }
  if (name !== undefined) event.name = name
  if (argumentsDelta !== undefined) event.argumentsDelta = argumentsDelta
  if (index !== undefined) event.index = index
  return event
}

/** 构造完成事件，只写入实际存在的结束原因。 */
function createCompletedEvent(finishReason?: string): ProviderStreamEvent {
  /** Provider 完成事件。 */
  const event: {
    type: 'completed'
    finishReason?: string
  } = {
    type: 'completed'
  }
  if (finishReason !== undefined) event.finishReason = finishReason
  return event
}

// ─────────────────────────────────────────────────────────────────────────────
// ASR 区
// ─────────────────────────────────────────────────────────────────────────────

/** ASR 能力缓存，键由协议、模型、Base URL、Headers 和凭据指纹共同决定。 */
export class AsrSupportCache {
  /** 内存中的 ASR 能力缓存。 */
  private readonly entries = new Map<string, AsrSupportCacheEntry>()

  /** 读取当前 Profile 的 ASR 能力缓存。 */
  get(profile: ProviderProfile): AsrSupportCacheEntry | null {
    return this.entries.get(createProviderProfileFingerprint(profile)) ?? null
  }

  /** 写入当前 Profile 的 ASR 能力缓存。 */
  set(profile: ProviderProfile, entry: AsrSupportCacheEntry): void {
    this.entries.set(createProviderProfileFingerprint(profile), entry)
  }

  /** 清空所有 ASR 能力缓存。 */
  clear(): void {
    this.entries.clear()
  }
}

/** 默认 ASR 能力缓存，产品化时由 Utility Provider Runtime 持有即可。 */
export const defaultAsrSupportCache = new AsrSupportCache()

/** 使用当前 Provider Profile 转写音频，不自动切换供应商。 */
export async function transcribeWithProviderProfile(
  input: AsrTranscriptionInput
): Promise<AsrTranscriptionResult> {
  /** Runtime 取消信号；没有传入时创建本地信号以简化调用方。 */
  const signal = input.signal ?? new AbortController().signal
  /** 实际 HTTP 客户端；单测默认注入 fake，产品化默认使用 fetch。 */
  const client = input.client ?? fetchProviderHttpClient
  /** 当前 ASR 能力缓存。 */
  const cache = input.cache ?? defaultAsrSupportCache

  try {
    if (signal.aborted) throw new ProviderProtocolError(cancelledError(input.profile.protocol))

    /** 当前 Profile 已缓存的 ASR 能力。 */
    const cached = cache.get(input.profile)
    if (cached?.status === 'unsupported') return unsupportedAsrResult(cached.reason)

    if (!cached) {
      /** 首次未知能力时的协议探测结果。 */
      const probeResult = await probeAsrSupport(input.profile, client, signal)
      cache.set(input.profile, probeResult)
      if (probeResult.status === 'unsupported') return unsupportedAsrResult(probeResult.reason)
    }

    /** 当前协议对应的真实用户音频转写请求。 */
    const request = buildAsrTranscriptionRequest(input.profile, input.audio, input.mimeType)
    /** Provider ASR 响应。 */
    const response = await client.send(request, signal)
    if (response.status < 200 || response.status >= 300) {
      /** ASR 上传阶段的归一化错误。 */
      const error = normalizeProviderError({
        protocol: input.profile.protocol,
        status: response.status,
        body: response.json ?? response.text
      })
      if (error.code === 'unsupported') {
        cache.set(input.profile, { status: 'unsupported', reason: error.message })
        return unsupportedAsrResult(error.message)
      }
      throw new ProviderProtocolError(error)
    }

    return { status: 'transcribed', text: parseAsrText(input.profile.protocol, response.json) }
  } catch (cause) {
    if (cause instanceof ProviderProtocolError) throw cause
    throw new ProviderProtocolError(
      normalizeProviderError({ protocol: input.profile.protocol, cause, aborted: signal.aborted })
    )
  } finally {
    input.audio.fill(0)
  }
}

/** 探测当前 Provider Profile 是否支持 ASR，探测不上传用户原始音频。 */
async function probeAsrSupport(
  profile: ProviderProfile,
  client: ProviderHttpClient,
  signal: AbortSignal
): Promise<AsrSupportCacheEntry> {
  /** 当前协议对应的 ASR 探测请求。 */
  const request = buildAsrProbeRequest(profile)
  /** Provider ASR 探测响应。 */
  const response = await client.send(request, signal)
  if (response.status >= 200 && response.status < 300) return { status: 'supported' }

  /** ASR 探测阶段的归一化错误。 */
  const error = normalizeProviderError({
    protocol: profile.protocol,
    status: response.status,
    body: response.json ?? response.text
  })
  if (error.code === 'unsupported') return { status: 'unsupported', reason: error.message }
  if (error.code === 'request') return { status: 'supported', reason: error.message }
  throw new ProviderProtocolError(error)
}

/** 构造 ASR 能力探测请求。 */
function buildAsrProbeRequest(profile: ProviderProfile): ProviderHttpRequest {
  return buildAsrTranscriptionRequest(profile, ASR_PROBE_BYTES, 'audio/wav')
}

/** 构造 ASR 转写请求。 */
function buildAsrTranscriptionRequest(
  profile: ProviderProfile,
  audio: Uint8Array,
  mimeType: string
): ProviderHttpRequest {
  if (profile.protocol === 'openai-compatible') return buildOpenAIAsrRequest(profile, audio, mimeType)
  if (profile.protocol === 'anthropic-messages') return buildAnthropicAsrRequest(profile, audio, mimeType)
  return buildGeminiAsrRequest(profile, audio, mimeType)
}

/** 构造 OpenAI Compatible ASR 请求。 */
function buildOpenAIAsrRequest(
  profile: ProviderProfile,
  audio: Uint8Array,
  mimeType: string
): ProviderHttpRequest {
  /** OpenAI Compatible ASR 使用 multipart/form-data。 */
  const form = new FormData()
  form.set('model', profile.model)
  form.set('file', new Blob([copyBytesForBlob(audio)], { type: mimeType }), 'voice.wav')
  return {
    method: 'POST',
    url: joinProviderUrl(profile.baseUrl, '/audio/transcriptions'),
    headers: mergeProfileHeaders(profile, { accept: 'application/json' }),
    body: form
  }
}

/** 构造 Anthropic Messages ASR 探测/转写请求。 */
function buildAnthropicAsrRequest(
  profile: ProviderProfile,
  audio: Uint8Array,
  mimeType: string
): ProviderHttpRequest {
  /** Anthropic ASR 只能通过当前 Messages Profile 的音频内容能力探测，不切换 Provider。 */
  const body = {
    model: profile.model,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: encodeBase64(audio)
            }
          },
          {
            type: 'text',
            text: '请只输出这段音频的转写文本。'
          }
        ]
      }
    ]
  }

  return {
    method: 'POST',
    url: joinProviderUrl(profile.baseUrl, '/messages'),
    headers: {
      ...jsonHeaders(profile),
      'anthropic-version': ANTHROPIC_VERSION
    },
    body
  }
}

/** 构造 Gemini generateContent ASR 探测/转写请求。 */
function buildGeminiAsrRequest(
  profile: ProviderProfile,
  audio: Uint8Array,
  mimeType: string
): ProviderHttpRequest {
  /** Gemini ASR 复用当前 generateContent Profile 的 inlineData。 */
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: encodeBase64(audio)
            }
          },
          {
            text: '请只输出这段音频的转写文本。'
          }
        ]
      }
    ]
  }

  return {
    method: 'POST',
    url: joinProviderUrl(profile.baseUrl, `/${normalizeGeminiModelPath(profile.model)}:generateContent`),
    headers: jsonHeaders(profile),
    body
  }
}

/** 解析 ASR 响应文本。 */
function parseAsrText(protocol: ProviderProtocol, value: unknown): string {
  if (protocol === 'openai-compatible') {
    /** OpenAI ASR 的 text 字段。 */
    const text = getString(getRecord(value).text)
    if (text) return text
  }
  if (protocol === 'anthropic-messages') {
    /** Anthropic Messages content 文本块。 */
    const text = getArray(getRecord(value), 'content')
      .map((part) => getString(getRecord(part).text))
      .filter(Boolean)
      .join('')
    if (text) return text
  }
  if (protocol === 'gemini-generate-content') {
    /** Gemini candidates 文本块。 */
    const text = getArray(getRecord(value), 'candidates')
      .flatMap((candidate) => getArray(getRecord(getRecord(candidate).content), 'parts'))
      .map((part) => getString(getRecord(part).text))
      .filter(Boolean)
      .join('')
    if (text) return text
  }
  throw new ProviderProtocolError({
    protocol,
    code: 'request',
    message: 'Provider ASR response did not contain transcript text.',
    retryable: false
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 错误归一区
// ─────────────────────────────────────────────────────────────────────────────

/** 将 Provider HTTP/本地异常归一为稳定错误。 */
export function normalizeProviderError(input: ProviderErrorInput): NormalizedProviderError {
  /** Provider 错误体中的 error 对象。 */
  const errorRecord = extractErrorRecord(input.body)
  /** Provider 原始错误消息。 */
  const rawMessage = extractErrorMessage(input, errorRecord)
  /** Provider 原始错误类型。 */
  const providerType = sanitizeOptionalText(
    getString(errorRecord.type) ??
      getString(errorRecord.code) ??
      getString(errorRecord.status) ??
      getString(getRecord(input.body).status)
  )
  /** 当前错误的稳定错误码。 */
  const code = classifyProviderError(input, rawMessage, providerType)

  /** 归一化后的 Provider 错误对象。 */
  const normalized: {
    protocol: ProviderProtocol
    code: ProviderErrorCode
    message: string
    retryable: boolean
    status?: number
    providerType?: string
  } = {
    protocol: input.protocol,
    code,
    message: sanitizeErrorMessage(rawMessage),
    retryable: isRetryableProviderError(code)
  }
  if (input.status !== undefined) normalized.status = input.status
  if (providerType !== undefined) normalized.providerType = providerType
  return normalized
}

/** 从 Provider body 中抽取 error 对象。 */
function extractErrorRecord(body: unknown): Readonly<Record<string, unknown>> {
  /** 顶层响应体对象。 */
  const bodyRecord = getRecord(body)
  /** 常见 Provider error 对象。 */
  const nestedError = getRecord(bodyRecord.error)
  if (Object.keys(nestedError).length > 0) return nestedError
  return bodyRecord
}

/** 提取 Provider 错误消息。 */
function extractErrorMessage(
  input: ProviderErrorInput,
  errorRecord: Readonly<Record<string, unknown>>
): string {
  if (input.aborted) return 'Provider request was cancelled.'
  /** Provider JSON 中的常见 message 字段。 */
  const providerMessage =
    getString(errorRecord.message) ??
    getString(errorRecord.error_description) ??
    getString(errorRecord.status)
  if (providerMessage) return providerMessage
  if (typeof input.body === 'string') return input.body
  if (input.cause instanceof Error) {
    /** 深度提取 Node.js / Undici 原生 fetch 嵌套的底层网络异常 (如 ECONNREFUSED/ETIMEDOUT/ENOTFOUND) */
    const innerCause = 'cause' in input.cause && input.cause.cause instanceof Error
      ? input.cause.cause.message
      : undefined
    return innerCause ? `${input.cause.message} (${innerCause})` : input.cause.message
  }
  if (input.status) return `Provider request failed with HTTP ${input.status}.`
  return 'Provider request failed.'
}

/** 根据状态码、消息和 Provider 类型判断稳定错误码。 */
function classifyProviderError(
  input: ProviderErrorInput,
  message: string,
  providerType?: string
): ProviderErrorCode {
  if (input.aborted) return 'cancelled'
  /** 错误分类所需的小写文本。 */
  const text = `${message} ${providerType ?? ''}`.toLowerCase()
  if (text.includes('timeout') || input.status === 408) return 'timeout'
  if (text.includes('content_policy') || text.includes('safety') || text.includes('blocked')) {
    return 'content-policy'
  }
  if (
    text.includes('unsupported') ||
    text.includes('not supported') ||
    text.includes('unknown content type') ||
    text.includes('not found') ||
    input.status === 404
  ) {
    return 'unsupported'
  }
  if (input.status === 401 || input.status === 403) return 'auth'
  if (input.status === 429) return text.includes('quota') ? 'quota' : 'rate-limit'
  if (input.status && input.status >= 500) return 'server'
  if (input.status && input.status >= 400) return 'request'
  if (input.cause) return 'network'
  return 'unknown'
}

/** 判断 Provider 错误是否允许 Runtime 重试。 */
function isRetryableProviderError(code: ProviderErrorCode): boolean {
  return code === 'rate-limit' || code === 'server' || code === 'timeout' || code === 'network'
}

/** 构造响应格式不符合当前流式协议时的归一化错误。 */
function unexpectedProviderResponseError(
  protocol: ProviderProtocol,
  message: string,
  status?: number
): NormalizedProviderError {
  /** 结合真实 HTTP 状态得到的初始错误分类。 */
  const classifiedCode = classifyProviderError(
    { protocol, ...(status === undefined ? {} : { status }), body: message },
    message,
    'invalid_response_format'
  )
  /** 2xx 响应格式错误需要稳定归为请求配置错误。 */
  const code = classifiedCode === 'unknown' ? 'request' : classifiedCode
  return {
    protocol,
    code,
    message,
    ...(status === undefined ? {} : { status }),
    retryable: isRetryableProviderError(code),
    providerType: 'invalid_response_format'
  }
}

/** 构造取消错误。 */
function cancelledError(protocol: ProviderProtocol): NormalizedProviderError {
  return {
    protocol,
    code: 'cancelled',
    message: 'Provider request was cancelled.',
    retryable: false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetch 客户端区
// ─────────────────────────────────────────────────────────────────────────────

/** 默认 fetch Provider HTTP 客户端。 */
export const fetchProviderHttpClient: ProviderHttpClient = {
  async send(request: ProviderHttpRequest, signal: AbortSignal): Promise<ProviderHttpResponse> {
    /** fetch 可接受的请求体。 */
    const body = serializeRequestBody(request.body)
    /** fetch 返回的原始响应。 */
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body,
      signal
    })

    if (response.ok) {
      /** 成功响应头快照。 */
      const responseHeaders = headersToRecord(response.headers)
      /** 成功响应对象。 */
      const successResponse: {
        status: number
        headers: Readonly<Record<string, string>>
        lines?: AsyncIterable<string>
        json?: unknown
      } = {
        status: response.status,
        headers: responseHeaders
      }
      if (isStreamResponse(request, responseHeaders)) {
        if (response.body) successResponse.lines = decodeResponseLines(response.body)
        return successResponse
      }
      /** 成功 JSON 响应体。 */
      const json = await readJsonSafely(response)
      if (json !== undefined) successResponse.json = json
      return successResponse
    }

    /** 非 2xx 响应的 JSON body。 */
    const json = await readJsonSafely(response.clone())
    /** 非 2xx 响应的 text body。 */
    const text = json === undefined ? await response.text() : undefined
    /** 失败响应对象。 */
    const failureResponse: {
      status: number
      headers: Readonly<Record<string, string>>
      json?: unknown
      text?: string
    } = {
      status: response.status,
      headers: headersToRecord(response.headers)
    }
    if (json !== undefined) failureResponse.json = json
    if (text !== undefined) failureResponse.text = text
    return failureResponse
  }
}

/** 将 fetch ReadableStream 解码为文本行。 */
async function* decodeResponseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  /** 响应流 reader。 */
  const reader = body.getReader()
  /** UTF-8 增量解码器。 */
  const decoder = new TextDecoder()
  /** 尚未遇到换行符的缓冲文本。 */
  let pending = ''

  try {
    while (true) {
      /** 当前读取块。 */
      const chunk = await reader.read()
      if (chunk.done) break
      pending += decoder.decode(chunk.value, { stream: true })
      /** 已按换行切分的文本片段。 */
      const parts = pending.split(/\r?\n/u)
      pending = parts.pop() ?? ''
      for (const part of parts) yield part
    }
    pending += decoder.decode()
    if (pending.length > 0) yield pending
  } finally {
    reader.releaseLock()
  }
}

/** 安全读取响应 JSON。 */
async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 合并 Profile headers 与当前请求默认 headers。 */
function mergeProfileHeaders(
  profile: ProviderProfile,
  defaults: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  return {
    ...defaults,
    ...(profile.headers ?? {})
  }
}

/** 构造 JSON 请求头。 */
function jsonHeaders(profile: ProviderProfile): Readonly<Record<string, string>> {
  return mergeProfileHeaders(profile, {
    accept: 'application/json',
    'content-type': 'application/json'
  })
}

/** 构造 JSON 流式请求头。 */
function jsonStreamHeaders(profile: ProviderProfile): Readonly<Record<string, string>> {
  return mergeProfileHeaders(profile, {
    accept: 'text/event-stream',
    'content-type': 'application/json'
  })
}

/** 判断当前成功响应是否应按流式文本读取。 */
function isStreamResponse(
  request: ProviderHttpRequest,
  responseHeaders: Readonly<Record<string, string>>
): boolean {
  /** 请求 accept 头。 */
  const requestAccept = getHeaderValue(request.headers, 'accept')
  /** 响应 content-type 头。 */
  const responseContentType = getHeaderValue(responseHeaders, 'content-type')
  return (
    requestAccept.includes('text/event-stream') ||
    responseContentType.includes('text/event-stream') ||
    responseContentType.includes('application/x-ndjson')
  )
}

/** 忽略大小写读取 headers。 */
function getHeaderValue(headers: Readonly<Record<string, string>>, key: string): string {
  /** 小写后的目标 header key。 */
  const lowerKey = key.toLowerCase()
  /** 找到的 header 值。 */
  const entry = Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === lowerKey)
  return entry?.[1].toLowerCase() ?? ''
}

/** 判断响应头是否明确表明正文是 HTML 网页。 */
function isHtmlResponse(headers: Readonly<Record<string, string>> | undefined): boolean {
  /** 小写后的响应 Content-Type。 */
  const contentType = getHeaderValue(headers ?? {}, 'content-type')
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml')
}

/** 判断无响应头保护时的流分片是否看起来是 HTML 文档。 */
function isHtmlText(value: string): boolean {
  /** 去除开头空白并转小写后的分片。 */
  const normalized = value.trimStart().toLowerCase()
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html')
}

/** 拼接 Provider base URL 与协议路径，防止路径重复。 */
function joinProviderUrl(baseUrl: string, path: string): string {
  /** 去掉尾部斜杠后的 base URL。 */
  const cleanBase = baseUrl.replace(/\/+$/u, '')
  /** 确保 path 以斜杠开头。 */
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (cleanBase.endsWith(cleanPath)) {
    return cleanBase
  }
  return `${cleanBase}${cleanPath}`
}

/** 标准化 Gemini 模型 URL 路径。 */
function normalizeGeminiModelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`
}

/** 移除对象中的 undefined 字段，避免协议请求出现无意义键。 */
function compactUndefined<T extends Readonly<Record<string, unknown>>>(value: T): Record<string, unknown> {
  /** 紧凑后的对象。 */
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) output[key] = item
  }
  return output
}

/** 将 Tool 参数/结果 JSON 文本解析为普通对象，失败时使用安全文本包装。 */
function parseJsonObject(value: string): Readonly<Record<string, unknown>> {
  try {
    /** 未信任 JSON 值。 */
    const parsed = JSON.parse(value) as unknown
    return getRecord(parsed)
  } catch {
    return { text: value }
  }
}

/** 解析 SSE data 行或 JSONL 行。 */
function parseDataPayload(
  line: string
): { readonly kind: 'skip' } | { readonly kind: 'done' } | { readonly kind: 'json'; readonly value: unknown } {
  /** 去除首尾空白后的原始行。 */
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return { kind: 'skip' }
  /** data: 前缀后的 payload。 */
  const payload = trimmed.startsWith('data:') ? trimmed.slice('data:'.length).trim() : trimmed
  if (!payload) return { kind: 'skip' }
  if (payload === '[DONE]') return { kind: 'done' }
  return { kind: 'json', value: JSON.parse(payload) as unknown }
}

/** 将 unknown 安全转成 record。 */
function getRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Readonly<Record<string, unknown>>
  }
  return {}
}

/** 从 record 中读取数组字段。 */
function getArray(record: Readonly<Record<string, unknown>>, key: string): readonly unknown[] {
  /** 目标字段值。 */
  const value = record[key]
  return Array.isArray(value) ? value : []
}

/** 读取 string 字段。 */
function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** 读取有限 number 字段。 */
function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 安全脱敏可选文本。 */
function sanitizeOptionalText(value: string | undefined): string | undefined {
  return value ? sanitizeErrorMessage(value) : undefined
}

/** 将请求体序列化成 fetch 可接受形态。 */
function serializeRequestBody(body: unknown): BodyInit | null {
  if (body === undefined || body === null) return null
  if (typeof body === 'string') return body
  if (isBodyInitObject(body)) return body as BodyInit
  return JSON.stringify(body)
}

/** 判断对象是否是 fetch 原生 BodyInit。 */
function isBodyInitObject(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  /** 运行时构造器名称。 */
  const constructorName = body.constructor?.name
  return Boolean(constructorName && BODY_INIT_TAGS.has(constructorName))
}

/** 将 Headers 转为普通对象。 */
function headersToRecord(headers: Headers): Record<string, string> {
  /** 普通对象响应头。 */
  const output: Record<string, string> = {}
  headers.forEach((value, key) => {
    output[key] = value
  })
  return output
}

/** 将二进制音频编码成 base64 文本。 */
function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

/** 为 Blob 构造复制一份 ArrayBuffer，避开 SharedArrayBuffer 类型歧义。 */
function copyBytesForBlob(bytes: Uint8Array): ArrayBuffer {
  /** Blob 上传使用的独立副本。 */
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

/** 构造 ASR 不支持结果。 */
function unsupportedAsrResult(reason?: string): AsrTranscriptionResult {
  /** 不支持 ASR 的结果对象。 */
  const result: {
    status: 'unsupported'
    message: string
    reason?: string
  } = {
    status: 'unsupported',
    message: ASR_UNSUPPORTED_MESSAGE
  }
  if (reason !== undefined) result.reason = reason
  return result
}

/** 创建 Provider Profile ASR 能力缓存指纹。 */
export function createProviderProfileFingerprint(profile: ProviderProfile): string {
  /** 已排序并哈希的 headers 指纹。 */
  const headersFingerprint = hashText(
    Object.entries(profile.headers ?? {})
      .map(([key, value]) => `${key.toLowerCase()}:${value}`)
      .sort()
      .join('\n')
  )
  /** 缓存边界中的所有非秘密字段与秘密指纹。 */
  const parts = [
    profile.protocol,
    profile.model,
    profile.baseUrl.replace(/\/+$/u, ''),
    headersFingerprint,
    profile.credentialFingerprint ?? ''
  ]
  return hashText(parts.join('\u001f'))
}

/** 对缓存键材料做轻量哈希，避免在缓存 key 中保留 header 原文。 */
function hashText(value: string): string {
  /** FNV-1a 32 位哈希初始值。 */
  let hash = 0x811c9dc5
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
