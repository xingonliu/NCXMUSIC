declare module 'sherpa-onnx-node' {
  /** sherpa-onnx 音频输入。 */
  interface WaveformInput {
    /** 归一化 PCM 样本。 */
    samples: Float32Array
    /** PCM 采样率。 */
    sampleRate: number
  }

  /** 识别结果的最小公共形状。 */
  interface RecognizerResult {
    /** 转写文本。 */
    text?: string
  }

  /** 在线识别流。 */
  interface OnlineStream {
    /** 接收 PCM。 */
    acceptWaveform(input: WaveformInput): void
    /** 标记输入结束。 */
    inputFinished(): void
  }

  /** 在线识别器。 */
  export class OnlineRecognizer {
    /** 从 sherpa-onnx 配置加载模型。 */
    constructor(config: Record<string, unknown>)
    /** 创建会话流。 */
    createStream(): OnlineStream
    /** 当前是否可继续解码。 */
    isReady(stream: OnlineStream): boolean
    /** 解码一个增量窗口。 */
    decode(stream: OnlineStream): void
    /** 读取当前累计结果。 */
    getResult(stream: OnlineStream): RecognizerResult
  }

  /** 离线识别流。 */
  interface OfflineStream {
    /** 接收完整或分块 PCM。 */
    acceptWaveform(input: WaveformInput): void
  }

  /** 离线识别器。 */
  export class OfflineRecognizer {
    /** 从 sherpa-onnx 配置加载模型。 */
    constructor(config: Record<string, unknown>)
    /** 创建识别流。 */
    createStream(): OfflineStream
    /** 异步解码以避免阻塞消息循环。 */
    decodeAsync(stream: OfflineStream): Promise<RecognizerResult>
  }

  /** VAD 输出语音片段。 */
  interface SpeechSegment {
    /** 片段起点。 */
    start: number
    /** 片段 PCM。 */
    samples: Float32Array
  }

  /** Silero 语音活动检测器。 */
  export class Vad {
    /** 创建语音活动检测器。 */
    constructor(config: Record<string, unknown>, bufferSizeInSeconds: number)
    /** 接收 PCM 样本。 */
    acceptWaveform(samples: Float32Array): void
    /** 是否没有待消费语音段。 */
    isEmpty(): boolean
    /** 读取最早语音段。 */
    front(enableExternalBuffer?: boolean): SpeechSegment
    /** 移除最早语音段。 */
    pop(): void
    /** 刷出尾部缓存。 */
    flush(): void
  }
}
