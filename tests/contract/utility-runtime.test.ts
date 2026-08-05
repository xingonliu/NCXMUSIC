import { describe, expect, it } from 'vitest'

import {
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema,
  messageBase
} from '../../src/shared/contracts/runtime'
import { UtilityRuntimeServer, type RuntimePort } from '../../src/utility/runtime-server'

class MemoryPort implements RuntimePort {
  peer: MemoryPort | undefined
  private readonly listeners = new Set<(message: unknown) => void>()
  private closed = false

  postMessage(message: unknown): void {
    if (!this.closed) {
      queueMicrotask(() => {
        for (const listener of this.peer?.listeners ?? []) {
          listener(message)
        }
      })
    }
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

function channel(): [MemoryPort, MemoryPort] {
  const first = new MemoryPort()
  const second = new MemoryPort()
  first.peer = second
  second.peer = first
  return [first, second]
}

async function nextMessage(port: MemoryPort): Promise<unknown> {
  return new Promise((resolve) => {
    const unsubscribe = port.subscribe((message) => {
      unsubscribe()
      resolve(message)
    })
  })
}

describe('UtilityRuntimeServer', () => {
  it('handshakes, pings, cancels, and returns a recovery snapshot', async () => {
    const connectionId = crypto.randomUUID()
    const [client, utility] = channel()
    const server = new UtilityRuntimeServer()
    const helloFromUtility = nextMessage(client)

    server.attach(utility, {
      connectionId,
      protocolVersion: 1,
      appVersion: '0.0.1',
      utilityGeneration: 7
    })
    expect(HelloEnvelopeSchema.parse(await helloFromUtility).payload.role).toBe('utility')

    client.postMessage({
      ...messageBase(connectionId),
      kind: 'event',
      name: 'system.hello',
      eventId: crypto.randomUUID(),
      payload: {
        role: 'preload',
        appVersion: '0.0.1',
        capabilities: ['system.ping', 'system.snapshot']
      }
    })
    await Promise.resolve()

    const pingRequestId = crypto.randomUUID()
    const pingResponse = nextMessage(client)
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'request',
      name: 'system.ping',
      requestId: pingRequestId,
      payload: { delayMs: 0 }
    })
    const ping = ResponseEnvelopeSchema.parse(await pingResponse)
    expect(ping.requestId).toBe(pingRequestId)
    expect(ping.result.ok).toBe(true)

    const cancelRequestId = crypto.randomUUID()
    const cancelResponse = nextMessage(client)
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'request',
      name: 'system.ping',
      requestId: cancelRequestId,
      payload: { delayMs: 5_000 }
    })
    await Promise.resolve()
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'cancel',
      name: 'system.ping',
      requestId: cancelRequestId,
      reason: 'user'
    })
    const cancelled = ResponseEnvelopeSchema.parse(await cancelResponse)
    expect(cancelled.result).toMatchObject({
      ok: false,
      error: { code: 'REQUEST_CANCELLED' }
    })

    const snapshotResponse = nextMessage(client)
    client.postMessage({
      ...messageBase(connectionId),
      kind: 'request',
      name: 'system.snapshot',
      requestId: crypto.randomUUID(),
      payload: {}
    })
    const snapshot = ResponseEnvelopeSchema.parse(await snapshotResponse)
    expect(snapshot.result).toMatchObject({
      ok: true,
      data: {
        protocolVersion: 1,
        connectionId,
        utilityGeneration: 7,
        pendingRequestIds: []
      }
    })

    server.shutdown()
  })
})
