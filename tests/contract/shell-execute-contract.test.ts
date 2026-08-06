import { describe, expect, it } from 'vitest'

import {
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema,
  messageBase
} from '../../src/shared/schemas/runtime'
import { type RuntimePort, type ShellCommandHandler, UtilityRuntimeServer } from '../../src/utility/runtime-server'

// ─────────────────────────────────────────────────────────────────────────────
// 测试替身区
// ─────────────────────────────────────────────────────────────────────────────

class MemoryPort implements RuntimePort {
  peer: MemoryPort | undefined
  private readonly listeners = new Set<(message: unknown) => void>()
  private closed = false

  postMessage(message: unknown): void {
    if (this.closed) return
    queueMicrotask(() => {
      for (const listener of this.peer?.listeners ?? []) listener(message)
    })
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {}

  close(): void {
    this.closed = true
    this.listeners.clear()
  }
}

class FakeShellHandler implements ShellCommandHandler {
  readonly cancelled: string[] = []
  private rejectPending: ((reason: unknown) => void) | undefined

  async execute(_requestId: string, payload: unknown): Promise<unknown> {
    if ((payload as { command?: string }).command === 'hang') {
      return new Promise((_resolve, reject) => {
        this.rejectPending = reject
      })
    }
    return {
      status: 'succeeded',
      exitCode: 0,
      signal: null,
      durationMs: 1,
      stdout: 'ok',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false
    }
  }

  cancel(requestId: string): void {
    this.cancelled.push(requestId)
    this.rejectPending?.(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    this.rejectPending = undefined
  }
}

/** 建立内存 MessagePort 双端。 */
function channel(): [MemoryPort, MemoryPort] {
  const first = new MemoryPort()
  const second = new MemoryPort()
  first.peer = second
  second.peer = first
  return [first, second]
}

/** 等待端口下一条消息。 */
function nextMessage(port: MemoryPort): Promise<unknown> {
  return new Promise((resolve) => {
    const unsubscribe = port.subscribe((message) => {
      unsubscribe()
      resolve(message)
    })
  })
}

/** 向 UtilityRuntimeServer 发送 preload hello。 */
function sendHello(client: MemoryPort, connectionId: string): void {
  client.postMessage({
    ...messageBase(connectionId),
    kind: 'event',
    name: 'system.hello',
    eventId: crypto.randomUUID(),
    payload: {
      role: 'preload',
      appVersion: '0.1.0',
      capabilities: ['system.ping', 'system.snapshot', 'music.resolve-url', 'shell.execute']
    }
  })
}

/** 建立已握手的 shell.execute Runtime 连接。 */
async function connect(handler?: ShellCommandHandler) {
  const connectionId = crypto.randomUUID()
  const [client, utility] = channel()
  const server = new UtilityRuntimeServer(undefined, handler)
  const helloFromUtility = nextMessage(client)
  server.attach(utility, {
    connectionId,
    protocolVersion: 1,
    appVersion: '0.1.0',
    utilityGeneration: 5
  })
  const hello = HelloEnvelopeSchema.parse(await helloFromUtility)
  sendHello(client, connectionId)
  await Promise.resolve()
  return { client, connectionId, server, capabilities: hello.payload.capabilities }
}

/** 发起 shell.execute 请求。 */
async function requestShell(client: MemoryPort, connectionId: string, payload: unknown, requestId = crypto.randomUUID()) {
  const pending = nextMessage(client)
  client.postMessage({
    ...messageBase(connectionId),
    kind: 'request',
    name: 'shell.execute',
    requestId,
    payload
  })
  return { requestId, response: await pending }
}

// ─────────────────────────────────────────────────────────────────────────────
// shell.execute 契约
// ─────────────────────────────────────────────────────────────────────────────

describe('shell.execute 契约', () => {
  it('注入 handler 后声明 shell.execute 能力', async () => {
    const { capabilities, server } = await connect(new FakeShellHandler())

    expect(capabilities).toContain('shell.execute')
    server.shutdown()
  })

  it('未注入 handler 时请求返回 CAPABILITY_UNAVAILABLE', async () => {
    const { client, connectionId, server } = await connect()
    const { response } = await requestShell(client, connectionId, {
      command: 'Get-Location',
      purpose: '读取目录'
    })

    expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
      ok: false,
      error: { code: 'CAPABILITY_UNAVAILABLE' }
    })
    server.shutdown()
  })

  it('成功响应符合 ExecuteShellResult 契约', async () => {
    const { client, connectionId, server } = await connect(new FakeShellHandler())
    const { response } = await requestShell(client, connectionId, {
      command: 'Get-Location',
      purpose: '读取目录'
    })

    expect(ResponseEnvelopeSchema.parse(response).result).toMatchObject({
      ok: true,
      data: { status: 'succeeded', exitCode: 0, stdout: 'ok' }
    })
    server.shutdown()
  })

  it('取消 shell.execute 会转发到 handler 并返回 REQUEST_CANCELLED', async () => {
    const handler = new FakeShellHandler()
    const { client, connectionId, server } = await connect(handler)
    const requestId = crypto.randomUUID()
    const pending = nextMessage(client)
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'request',
      name: 'shell.execute',
      requestId,
      payload: { command: 'hang', purpose: '挂起命令' }
    })
    await Promise.resolve()
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'cancel',
      name: 'shell.execute',
      requestId,
      reason: 'user'
    })

    expect(ResponseEnvelopeSchema.parse(await pending).result).toMatchObject({
      ok: false,
      error: { code: 'REQUEST_CANCELLED' }
    })
    expect(handler.cancelled).toEqual([requestId])
    server.shutdown()
  })
})
