import { basename } from 'node:path'

import type { VoiceLocalModelId } from '../../shared/schemas/voice-settings'

// ========= 类型 =========

/** 归档中需要保留的单个模型文件。 */
export interface LocalVoiceModelFile {
  /** 归档内的相对路径。 */
  readonly archivePath: string
  /** 安装目录内的相对路径。 */
  readonly targetPath: string
  /** 用于完整性与磁盘预算的精确字节数。 */
  readonly bytes: number
}

/** 不在主归档中的补充模型文件。 */
export interface LocalVoiceSupplementFile {
  /** 官方文件地址。 */
  readonly officialUrl: string
  /** 安装目录内的相对路径。 */
  readonly targetPath: string
  /** 文件精确字节数。 */
  readonly bytes: number
  /** 文件 SHA-256。 */
  readonly sha256: string
}

/** 内置本地语音模型的受审计下载定义。 */
export interface LocalVoiceModelDefinition {
  /** 稳定模型 ID。 */
  readonly id: VoiceLocalModelId
  /** 用户可读名称。 */
  readonly name: string
  /** 用户可读能力说明。 */
  readonly description: string
  /** 上游版本标识。 */
  readonly version: string
  /** 支持语言。 */
  readonly languages: readonly string[]
  /** 实际流式语义。 */
  readonly streamMode: 'true-streaming' | 'vad-segmented'
  /** 官方归档地址。 */
  readonly officialUrl: string
  /** 归档精确字节数。 */
  readonly archiveBytes: number
  /** 归档 SHA-256。 */
  readonly archiveSha256: string
  /** 选择性解包清单。 */
  readonly files: readonly LocalVoiceModelFile[]
  /** 可选的补充文件。 */
  readonly supplements: readonly LocalVoiceSupplementFile[]
  /** 运行时经验估算。 */
  readonly estimatedMemoryMiB: number
  /** 上游模型许可说明。 */
  readonly licenseName: string
  /** 上游模型说明地址。 */
  readonly licenseUrl: string
}

// ========= 变量 =========

/** GitHub 官方模型发布根地址。 */
const OFFICIAL_RELEASE_ROOT = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models'

/** 轻量中英语音模型定义。 */
const LIGHT_MODEL: LocalVoiceModelDefinition = {
  id: 'light',
  name: '轻量 · 中英流式',
  description: 'Zipformer 小型中英模型，边说边出字；安装约 58 MiB，运行约 150 MiB。',
  version: '2023-02-16-int8',
  languages: ['中文', '英文'],
  streamMode: 'true-streaming',
  officialUrl: `${OFFICIAL_RELEASE_ROOT}/sherpa-onnx-streaming-zipformer-small-bilingual-zh-en-2023-02-16.tar.bz2`,
  archiveBytes: 458_187_351,
  archiveSha256: '2b7c63322b32e5e0f2526043a1103366119ca58dd615cd7105a37c01db9553d7',
  files: [
    { archivePath: 'encoder-epoch-99-avg-1.int8.onnx', targetPath: 'encoder.int8.onnx', bytes: 42_980_793 },
    { archivePath: 'decoder-epoch-99-avg-1.onnx', targetPath: 'decoder.onnx', bytes: 13_877_276 },
    { archivePath: 'joiner-epoch-99-avg-1.int8.onnx', targetPath: 'joiner.int8.onnx', bytes: 3_228_485 },
    { archivePath: 'tokens.txt', targetPath: 'tokens.txt', bytes: 56_317 },
    { archivePath: 'bpe.model', targetPath: 'bpe.model', bytes: 244_836 }
  ],
  supplements: [],
  estimatedMemoryMiB: 150,
  licenseName: '上游模型说明（商用前请复核数据许可）',
  licenseUrl: 'https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html#sherpa-onnx-streaming-zipformer-small-bilingual-zh-en-2023-02-16-bilingual-chinese-english'
}

/** 准确多语种 SenseVoice 模型定义。 */
const ACCURATE_MODEL: LocalVoiceModelDefinition = {
  id: 'accurate',
  name: '准确 · SenseVoice INT8',
  description: '阿里 SenseVoice INT8，多语种且中文更稳；按语音片段出字，安装约 229 MiB，运行约 350 MiB。',
  version: '2024-07-17-int8',
  languages: ['中文', '英文', '日语', '韩语', '粤语'],
  streamMode: 'vad-segmented',
  officialUrl: `${OFFICIAL_RELEASE_ROOT}/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2`,
  archiveBytes: 163_002_883,
  archiveSha256: '7d1efa2138a65b0b488df37f8b89e3d91a60676e416f515b952358d83dfd347e',
  files: [
    { archivePath: 'model.int8.onnx', targetPath: 'model.int8.onnx', bytes: 239_233_841 },
    { archivePath: 'tokens.txt', targetPath: 'tokens.txt', bytes: 315_894 },
    { archivePath: 'LICENSE', targetPath: 'LICENSE', bytes: 71 },
    { archivePath: 'README.md', targetPath: 'README.md', bytes: 104 }
  ],
  supplements: [{
    officialUrl: `${OFFICIAL_RELEASE_ROOT}/silero_vad.onnx`,
    targetPath: 'silero_vad.onnx',
    bytes: 643_854,
    sha256: '9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6'
  }],
  estimatedMemoryMiB: 350,
  licenseName: 'SenseVoice 模型许可（商用前请复核）',
  licenseUrl: 'https://github.com/FunAudioLLM/SenseVoice'
}

/** 按固定顺序展示的本地模型。 */
export const LOCAL_VOICE_MODELS = [LIGHT_MODEL, ACCURATE_MODEL] as const

// ========= 函数 =========

/** 按 ID 返回内置模型定义。 */
export function localVoiceModelDefinition(modelId: VoiceLocalModelId): LocalVoiceModelDefinition {
  /** 匹配模型。 */
  const model = LOCAL_VOICE_MODELS.find((candidate) => candidate.id === modelId)
  if (!model) throw new Error(`未知本地语音模型：${modelId}`)
  return model
}

/** 返回国内镜像优先、官方地址兜底的下载地址。 */
export function localVoiceDownloadUrls(officialUrl: string): readonly string[] {
  /** 用户或发行方显式配置的国内镜像根地址。 */
  const mirrorRoot = process.env.NCXMUSIC_ASR_MIRROR_BASE_URL?.trim().replace(/\/+$/u, '')
  if (!mirrorRoot) return [officialUrl]
  return [`${mirrorRoot}/${basename(new URL(officialUrl).pathname)}`, officialUrl]
}

/** 计算模型安装后的已知文件字节数。 */
export function localVoiceInstalledBytes(model: LocalVoiceModelDefinition): number {
  return [...model.files, ...model.supplements].reduce((total, file) => total + file.bytes, 0)
}
