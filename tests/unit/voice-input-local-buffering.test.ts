// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {} from '../../src/renderer/env'

// ========= 类型 =========

/** 可由测试控制完成时机的 Promise。 */
interface Deferred<T> {
  /** 待完成 Promise。 */
  readonly promise: Promise<T>
  /** 完成 Promise。 */
  readonly resolve: (value: T) => void
  /** 拒绝 Promise。 */
  readonly reject: (error: unknown) => void
}

// ========= 变量 =========

/** 播放器音量闪避夹具。 */
const playerFixture = vi.hoisted(() => ({
  setDuckGain: vi.fn<(gain: number) => void>()
}))

/** 当前 ScriptProcessor 的 PCM 回调。 */
let audioProcessListener: ((event: AudioProcessingEvent) => void) | undefined

/** Main 本地会话启动请求。 */
const startLocalSession = vi.fn<() => Promise<void>>()

/** Renderer 发送给 Main 的 PCM 块。 */
const sendLocalChunk = vi.fn<(input: { readonly samples: Float32Array }) => void>()

/** Renderer 请求结束本地会话。 */
const finishLocalSession = vi.fn<() => Promise<{ voiceSessionId: string; text: string }>>()

/** Renderer 取消本地会话。 */
const cancelLocalSession = vi.fn<() => void>()

// ========= Mock =========

vi.mock('../../src/renderer/features/music/use-player', () => ({
  usePlayerRuntime: () => ({ engine: { setDuckGain: playerFixture.setDuckGain } })
}))

vi.mock('../../src/renderer/design-system/use-toast', () => ({
  showToast: vi.fn()
}))

import { useVoiceInput } from '../../src/renderer/features/voice/use-voice-input'

// ========= 函数 =========

/** 创建可控制完成时机的 Promise。 */
function deferred<T>(): Deferred<T> {
  /** Promise resolve 函数。 */
  let resolve!: (value: T) => void
  /** Promise reject 函数。 */
  let reject!: (error: unknown) => void
  /** 测试控制的 Promise。 */
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/** 构造满足本地语音启动路径的设置快照。 */
function voiceSettingsResult(streaming: boolean): object {
  return {
    snapshot: {
      source: 'local',
      local: { modelId: 'light', streaming, loadMode: 'on-demand' },
      models: [{ id: 'light', installState: 'installed' }, { id: 'accurate', installState: 'installed' }]
    }
  }
}

/** 向当前 ScriptProcessor 注入一块浏览器采样率 PCM。 */
function emitPcmChunk(): void {
  /** 固定的非静音输入样本。 */
  const samples = Float32Array.from({ length: 4_096 }, () => 0.25)
  audioProcessListener?.({
    inputBuffer: { getChannelData: () => samples }
  } as unknown as AudioProcessingEvent)
}

/** 安装测试所需的最小媒体与 NCX Bridge。 */
function installRuntime(streaming: boolean): void {
  /** 只包含语音控制器会调用方法的媒体流。 */
  const stream = {
    getTracks: () => [{ stop: vi.fn() }]
  } as unknown as MediaStream
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) }
  })
  /** 测试使用的最小 Web Audio 上下文。 */
  class MockAudioContext {
    /** 浏览器输入采样率。 */
    readonly sampleRate = 48_000
    /** 静音节点连接目标。 */
    readonly destination = {}

    /** 创建麦克风源节点。 */
    createMediaStreamSource(): MediaStreamAudioSourceNode {
      return { connect: vi.fn(), disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode
    }

    /** 创建频谱分析节点。 */
    createAnalyser(): AnalyserNode {
      return {
        fftSize: 256,
        smoothingTimeConstant: 0.72,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn()
      } as unknown as AnalyserNode
    }

    /** 创建可注入 PCM 回调的处理节点。 */
    createScriptProcessor(): ScriptProcessorNode {
      return {
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          audioProcessListener = listener as (event: AudioProcessingEvent) => void
        },
        connect: vi.fn(),
        disconnect: vi.fn()
      } as unknown as ScriptProcessorNode
    }

    /** 创建静音增益节点。 */
    createGain(): GainNode {
      return {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn()
      } as unknown as GainNode
    }

    /** 关闭测试音频上下文。 */
    async close(): Promise<void> {}
  }
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: MockAudioContext
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: vi.fn(() => 1)
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: vi.fn()
  })
  Object.defineProperty(window, 'ncx', {
    configurable: true,
    value: {
      voiceSettings: {
        request: vi.fn(async () => voiceSettingsResult(streaming)),
        startLocalSession,
        sendLocalChunk,
        finishLocalSession,
        cancelLocalSession
      }
    }
  })
}

// ========= 生命周期 =========

beforeEach(() => {
  audioProcessListener = undefined
  vi.clearAllMocks()
  finishLocalSession.mockResolvedValue({
    voiceSessionId: '11111111-1111-4111-8111-111111111111',
    text: ''
  })
})

afterEach(() => {
  useVoiceInput().cancel('测试清理。')
})

// ========= 测试 =========

describe('useVoiceInput local on-demand buffering', () => {
  it('流式模式在模型加载时缓存，ready 后冲刷并继续实时发送', async () => {
    /** 受控的模型 ready Promise。 */
    const ready = deferred<void>()
    startLocalSession.mockReturnValue(ready.promise)
    installRuntime(true)
    /** 应用级语音控制器。 */
    const voice = useVoiceInput()

    await voice.press('composer-button')
    expect(voice.state.value).toBe('listening')
    emitPcmChunk()
    expect(sendLocalChunk).not.toHaveBeenCalled()

    ready.resolve(undefined)
    await ready.promise
    await vi.waitFor(() => expect(sendLocalChunk).toHaveBeenCalledTimes(1))
    emitPcmChunk()
    expect(sendLocalChunk).toHaveBeenCalledTimes(2)
  })

  it('非流式模式在松手前保留完整录音，松手后一次性提交全部分块', async () => {
    /** 受控的模型 ready Promise。 */
    const ready = deferred<void>()
    startLocalSession.mockReturnValue(ready.promise)
    installRuntime(false)
    /** 应用级语音控制器。 */
    const voice = useVoiceInput()

    await voice.press('composer-button')
    emitPcmChunk()
    emitPcmChunk()
    expect(sendLocalChunk).not.toHaveBeenCalled()

    voice.release('composer-button')
    expect(voice.state.value).toBe('transcribing')
    expect(finishLocalSession).not.toHaveBeenCalled()
    ready.resolve(undefined)
    await ready.promise
    await vi.waitFor(() => expect(sendLocalChunk).toHaveBeenCalledTimes(1))
    expect(sendLocalChunk.mock.calls[0]?.[0].samples.length).toBeGreaterThan(2_000)
    expect(finishLocalSession).toHaveBeenCalledTimes(1)
  })
})
