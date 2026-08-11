import type {
  MediaElementEvent,
  MediaElementPort,
  PlaybackError
} from '../../../domains/player/types'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

/** 需要转发到领域层的媒体事件名 */
const FORWARDED_EVENTS = [
  'loadedmetadata',
  'canplay',
  'playing',
  'pause',
  'waiting',
  'stalled',
  'timeupdate',
  'progress',
  'seeking',
  'seeked',
  'ended',
  'error'
] as const

/** MediaError.code → 领域错误码映射 */
const MEDIA_ERROR_CODES: Record<number, PlaybackError['code']> = {
  1: 'aborted', // MEDIA_ERR_ABORTED
  2: 'source-expired', // MEDIA_ERR_NETWORK：短期 URL 续传失败时先重新解析一次
  3: 'decode-error', // MEDIA_ERR_DECODE
  4: 'media-unsupported' // MEDIA_ERR_SRC_NOT_SUPPORTED
}

// ─────────────────────────────────────────────────────────────────────────────
// HtmlAudioAdapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MediaElementPort 的 HTMLAudioElement 实现。
 *
 * 全应用只应存在一个实例，由 AudioHost 在 AppShell 根层创建。
 * 负责把原生媒体事件翻译成领域事件，不持有任何播放状态判断。
 */
export class HtmlAudioAdapter implements MediaElementPort {
  // ── 变量区 ──

  private readonly element: HTMLAudioElement

  private readonly listeners = new Set<(event: MediaElementEvent) => void>()

  /** 用户持久音量（0~1），与 ducking 增益相乘后写入元素 */
  private userVolume = 1

  /** 瞬时 ducking 增益（0~1），聆听阶段降到约 0.2 */
  private duckGain = 1

  /** 已注册的原生监听器，dispose 时逐个解绑，防止监听器增长 */
  private readonly boundHandlers = new Map<string, (event: Event) => void>()

  /** 当前媒体源 generation。 */
  private sourceGeneration = 0

  /** 换源后延迟绑定原生事件的计时器。 */
  private attachTimer: ReturnType<typeof setTimeout> | undefined

  /** 用于 Web Audio API 频谱分析的 AudioContext。 */
  private audioContext: AudioContext | undefined

  /** 用于频域分析的 AnalyserNode。 */
  private analyserNode: AnalyserNode | undefined

  /** Web Audio 缓存的频域数据数组。 */
  private frequencyData: Uint8Array | undefined

  /** 经过 EMA 指数衰减平滑后的低频能量。 */
  private smoothedAudioEnergy = 0

  /**
   * @param element 可选的既有 audio 元素；省略时自行创建一个游离元素
   */
  constructor(element?: HTMLAudioElement) {
    this.element = element ?? new Audio()
    // 设置 crossOrigin 为 anonymous 以允许 Web Audio API AnalyserNode 提取频谱，
    // Main 进程会通过 webRequest.onHeadersReceived 统一注入 Allow-Origin 头。
    this.element.crossOrigin = 'anonymous'
    this.element.preload = 'auto'
    this.attachNativeListeners()
  }

  // ── 命令区 ──

  /**
   * 设置媒体源并触发加载。
   * 换源前先 pause 并清空旧源，确保不会出现两路音频同时出声。
   */
  setSource(url: string, sourceGeneration = this.sourceGeneration + 1): void {
    this.detachNativeListeners()
    this.element.pause()
    this.sourceGeneration = sourceGeneration
    this.element.src = url
    this.element.load()
    this.scheduleNativeListeners(sourceGeneration)
  }

  /** 清空源并释放底层缓冲 */
  clearSource(): void {
    this.detachNativeListeners()
    this.element.pause()
    this.element.removeAttribute('src')
    // load() 使元素回到 HAVE_NOTHING，真正释放已缓冲数据
    this.element.load()
  }

  play(): Promise<void> {
    this.ensureAudioAnalyzer()
    if (this.audioContext?.state === 'suspended') {
      void this.audioContext.resume()
    }
    return this.element.play()
  }

  pause(): void {
    this.element.pause()
  }

  seek(positionMs: number): void {
    // seekable 为空时（元数据尚未就绪）直接赋值会抛错，交由引擎的 pending 位置兜底
    try {
      this.element.currentTime = positionMs / 1_000
    } catch {
      // 忽略：canplay 后引擎会重新应用起始位置
    }
  }

  setVolume(volume: number): void {
    this.userVolume = volume
    this.applyEffectiveVolume()
  }

  setMuted(muted: boolean): void {
    this.element.muted = muted
  }

  /** 设置 ducking 增益，不改变用户持久音量 */
  setDuckGain(gain: number): void {
    this.duckGain = gain
    this.applyEffectiveVolume()
  }

  subscribe(listener: (event: MediaElementEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 读取经过 EMA 指数衰减平滑后的低频（Bass / Kick）能量值 [0, 1]。
   */
  getAudioEnergy(): number {
    const analyser = this.ensureAudioAnalyzer()
    const buffer = this.frequencyData
    if (!analyser || !buffer || this.element.paused) {
      this.smoothedAudioEnergy *= 0.9
      return this.smoothedAudioEnergy < 0.01 ? 0 : this.smoothedAudioEnergy
    }

    analyser.getByteFrequencyData(buffer)
    /** 取前 8 个 Bin（低于约 350Hz 的低音鼓点区间）。 */
    let sum = 0
    const binCount = Math.min(8, buffer.length)
    for (let index = 0; index < binCount; index += 1) {
      sum += buffer[index] ?? 0
    }
    const rawEnergy = sum / (binCount * 255)

    if (rawEnergy > this.smoothedAudioEnergy) {
      this.smoothedAudioEnergy = rawEnergy * 0.7 + this.smoothedAudioEnergy * 0.3
    } else {
      this.smoothedAudioEnergy = this.smoothedAudioEnergy * 0.88 + rawEnergy * 0.12
    }

    return this.smoothedAudioEnergy
  }

  // ── 生命周期区 ──

  /** 解绑全部原生监听器并释放媒体资源 */
  dispose(): void {
    this.detachNativeListeners()
    this.listeners.clear()
    this.element.pause()
    this.element.removeAttribute('src')
    this.element.load()
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close()
    }
    this.audioContext = undefined
    this.analyserNode = undefined
    this.frequencyData = undefined
  }

  /** 当前已注册的原生监听器数量，供泄漏检测使用 */
  nativeListenerCount(): number {
    return this.boundHandlers.size
  }

  // ── 内部函数区 ──

  /** 有效输出音量 = 用户音量 × ducking 增益 */
  private applyEffectiveVolume(): void {
    this.element.volume = Math.max(0, Math.min(1, this.userVolume * this.duckGain))
  }

  /** 一次性注册所有需要转发的原生事件 */
  private attachNativeListeners(sourceGeneration = this.sourceGeneration): void {
    for (const name of FORWARDED_EVENTS) {
      const handler = (): void => this.translateAndEmit(name, sourceGeneration)
      this.boundHandlers.set(name, handler)
      this.element.addEventListener(name, handler)
    }
  }

  /** 把原生事件翻译为领域事件并广播 */
  private translateAndEmit(
    name: (typeof FORWARDED_EVENTS)[number],
    sourceGeneration: number
  ): void {
    const event = this.translate(name)
    if (!event) return
    for (const listener of this.listeners) listener({ ...event, sourceGeneration })
  }

  /** 解绑当前 source 的全部原生事件监听器。 */
  private detachNativeListeners(): void {
    if (this.attachTimer) clearTimeout(this.attachTimer)
    this.attachTimer = undefined
    for (const [name, handler] of this.boundHandlers) {
      this.element.removeEventListener(name, handler)
    }
    this.boundHandlers.clear()
  }

  /** 等旧 source 已排队事件清空后，为新 source 绑定携带 generation 的监听器。 */
  private scheduleNativeListeners(sourceGeneration: number): void {
    this.attachTimer = setTimeout(() => {
      this.attachTimer = undefined
      if (sourceGeneration !== this.sourceGeneration) return
      this.attachNativeListeners(sourceGeneration)
    }, 0)
  }

  /** 单个原生事件的翻译规则；返回 undefined 表示不转发 */
  private translate(name: (typeof FORWARDED_EVENTS)[number]): MediaElementEvent | undefined {
    switch (name) {
      case 'loadedmetadata':
        return { type: 'loadedmetadata', durationMs: this.readDurationMs() }

      case 'canplay':
        return { type: 'canplay' }

      case 'playing':
        return { type: 'playing' }

      case 'pause':
        return { type: 'pause' }

      case 'waiting':
        return { type: 'waiting' }

      case 'stalled':
        return { type: 'stalled' }

      // progress 与 timeupdate 都只用于刷新位置/缓冲读数
      case 'progress':
      case 'timeupdate':
        return {
          type: 'timeupdate',
          positionMs: Math.round(this.element.currentTime * 1_000),
          bufferedMs: this.readBufferedMs()
        }

      case 'seeking':
        return { type: 'seeking' }

      case 'seeked':
        return { type: 'seeked', positionMs: Math.round(this.element.currentTime * 1_000) }

      case 'ended':
        return { type: 'ended' }

      case 'error':
        return { type: 'error', code: this.readErrorCode() }
    }
  }

  /** 读取媒体时长；Infinity/NaN 视为未知 */
  private readDurationMs(): number | null {
    const duration = this.element.duration
    if (!Number.isFinite(duration) || duration <= 0) return null
    return Math.round(duration * 1_000)
  }

  /** 读取当前播放位置所在缓冲区的结束时间 */
  private readBufferedMs(): number {
    const buffered = this.element.buffered
    const position = this.element.currentTime
    for (let index = 0; index < buffered.length; index += 1) {
      if (buffered.start(index) <= position && position <= buffered.end(index)) {
        return Math.round(buffered.end(index) * 1_000)
      }
    }
    // 未命中任何区间时退回最后一个区间末尾
    return buffered.length > 0 ? Math.round(buffered.end(buffered.length - 1) * 1_000) : 0
  }

  /**
   * 读取错误码。
   * 网络类错误在过期 URL 场景下常表现为 MEDIA_ERR_NETWORK 或 SRC_NOT_SUPPORTED，
   * 由上层根据 retryable 决定是否重新解析地址。
   */
  private readErrorCode(): PlaybackError['code'] {
    const code = this.element.error?.code
    if (code === undefined) return 'network-error'
    return MEDIA_ERROR_CODES[code] ?? 'network-error'
  }

  /** 初始化或获取 Web Audio AnalyserNode 分析节点。 */
  private ensureAudioAnalyzer(): AnalyserNode | undefined {
    if (this.analyserNode) return this.analyserNode
    if (typeof window === 'undefined' || !window.AudioContext) return undefined
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const context = new AudioCtx()
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      const sourceNode = context.createMediaElementSource(this.element)
      sourceNode.connect(analyser)
      analyser.connect(context.destination)

      this.audioContext = context
      this.analyserNode = analyser
      this.frequencyData = new Uint8Array(analyser.frequencyBinCount)
      return analyser
    } catch {
      return undefined
    }
  }
}
