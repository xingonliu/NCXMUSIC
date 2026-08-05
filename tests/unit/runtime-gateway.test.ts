import { describe, expect, it } from 'vitest'

import { RuntimeGateway, type RuntimeClientPort } from '../../src/preload/runtime-gateway'
import {
  HelloEnvelopeSchema,
  ResponseEnvelopeSchema,
  messageBase
} from '../../src/shared/schemas/runtime'

class FakeClientPort implements RuntimeClientPort {
  readonly messages: unknown[] = []
  closed = false
  private messageHandler: ((message: unknown) => void) | undefined
  private closeHandler: (() => void) | undefined

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  start(): void {}

  close(): void {
    this.closed = true
  }

  setMessageHandler(handler: (message: unknown) => void): void {
    this.messageHandler = handler
  }

  setCloseHandler(handler: () => void): void {
    this.closeHandler = handler
  }

  emit(message: unknown): void {
    this.messageHandler?.(message)
  }

  fail(): void {
    this.closeHandler?.()
  }
}

function metadata(connectionId = crypto.randomUUID()) {
  return {
    connectionId,
    protocolVersion: 1 as const,
    appVersion: '0.1.0',
    utilityGeneration: 1
  }
}

function utilityHello(connectionId: string) {
  return HelloEnvelopeSchema.parse({
    ...messageBase(connectionId),
    kind: 'event',
    name: 'system.hello',
    eventId: crypto.randomUUID(),
    payload: {
      role: 'utility',
      appVersion: '0.1.0',
      capabilities: ['system.ping', 'system.snapshot']
    }
  })
}

describe('RuntimeGateway', () => {
  it('requires a valid utility hello before becoming ready', async () => {
    const gateway = new RuntimeGateway()
    const port = new FakeClientPort()
    const connection = metadata()
    gateway.attach(port, connection)

    const ready = gateway.waitUntilReady(100)
    port.emit(utilityHello(connection.connectionId))

    await expect(ready).resolves.toBe(true)
    expect(port.messages).toHaveLength(1)
  })

  it('fails pending work immediately when a connection is replaced', async () => {
    const gateway = new RuntimeGateway()
    const firstPort = new FakeClientPort()
    const firstConnection = metadata()
    gateway.attach(firstPort, firstConnection)
    firstPort.emit(utilityHello(firstConnection.connectionId))
    await gateway.waitUntilReady()

    const pending = gateway.ping({ delayMs: 5_000 })
    const secondPort = new FakeClientPort()
    gateway.attach(secondPort, metadata())

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'CONNECTION_REPLACED' }
    })
    expect(firstPort.closed).toBe(true)
  })

  it('ignores a late response from the replaced connection', async () => {
    const gateway = new RuntimeGateway()
    const firstPort = new FakeClientPort()
    const firstConnection = metadata()
    gateway.attach(firstPort, firstConnection)
    firstPort.emit(utilityHello(firstConnection.connectionId))
    await gateway.waitUntilReady()

    const secondPort = new FakeClientPort()
    const secondConnection = metadata()
    gateway.attach(secondPort, secondConnection)
    secondPort.emit(utilityHello(secondConnection.connectionId))
    await gateway.waitUntilReady()

    const requestId = crypto.randomUUID()
    const pending = gateway.ping({ requestId })
    firstPort.emit(
      ResponseEnvelopeSchema.parse({
        ...messageBase(firstConnection.connectionId),
        kind: 'response',
        name: 'system.ping',
        requestId,
        result: {
          ok: true,
          data: { utilityGeneration: 1, receivedAt: 1, respondedAt: 2 }
        }
      })
    )

    secondPort.emit(
      ResponseEnvelopeSchema.parse({
        ...messageBase(secondConnection.connectionId),
        kind: 'response',
        name: 'system.ping',
        requestId,
        result: {
          ok: true,
          data: { utilityGeneration: 1, receivedAt: 3, respondedAt: 4 }
        }
      })
    )

    await expect(pending).resolves.toMatchObject({
      ok: true,
      data: { receivedAt: 3, respondedAt: 4 }
    })
  })

  it('fails pending work when the runtime port reports an error', async () => {
    const gateway = new RuntimeGateway()
    const port = new FakeClientPort()
    const connection = metadata()
    gateway.attach(port, connection)
    port.emit(utilityHello(connection.connectionId))
    await gateway.waitUntilReady()

    const pending = gateway.ping({ delayMs: 5_000 })
    port.fail()

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { code: 'UTILITY_UNAVAILABLE' }
    })
  })
})
