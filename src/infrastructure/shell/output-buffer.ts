import { redactSensitiveText } from '../../shared/errors/redact-sensitive-text'
import {
  SHELL_MODEL_RESULT_HEAD_BYTES,
  SHELL_MODEL_RESULT_LIMIT_BYTES,
  SHELL_MODEL_RESULT_TAIL_BYTES,
  SHELL_OUTPUT_CHANNEL_LIMIT_BYTES,
  type ExecuteShellResult
} from '../../shared/schemas/shell'

// ─────────────────────────────────────────────────────────────────────────────
// 类型区
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellOutputBufferSnapshot {
  /** 已按内存上限裁剪并脱敏的输出文本。 */
  text: string
  /** 该输出通道是否已经超过内存上限。 */
  truncated: boolean
}

export interface ShellModelResult {
  /** 已裁剪至模型可见上限的 Shell 结果。 */
  result: ExecuteShellResult
  /** 是否因为 64 KiB 模型上限发生二次裁剪。 */
  modelTruncated: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// ShellOutputBuffer
// ─────────────────────────────────────────────────────────────────────────────

export class ShellOutputBuffer {
  // ── 变量区 ──
  private text = ''
  private bytes = 0
  private truncated = false

  // ── 函数区 ──

  /** 追加一个输出块，并返回允许流式展示的脱敏文本。 */
  append(chunk: Buffer | string): ShellOutputBufferSnapshot {
    if (this.truncated) return { text: '', truncated: true }

    const safeChunk = redactSensitiveText(chunk)
    const remainingBytes = SHELL_OUTPUT_CHANNEL_LIMIT_BYTES - this.bytes
    const chunkBytes = Buffer.byteLength(safeChunk, 'utf8')
    if (chunkBytes <= remainingBytes) {
      this.text += safeChunk
      this.bytes += chunkBytes
      return { text: safeChunk, truncated: false }
    }

    const allowed = takeUtf8Bytes(safeChunk, Math.max(remainingBytes, 0))
    this.text += allowed
    this.bytes += Buffer.byteLength(allowed, 'utf8')
    this.truncated = true
    return { text: allowed, truncated: true }
  }

  /** 读取当前通道的裁剪状态。 */
  snapshot(): ShellOutputBufferSnapshot {
    return { text: redactSensitiveText(this.text), truncated: this.truncated }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 函数区
// ─────────────────────────────────────────────────────────────────────────────

/** 按 UTF-8 字节长度安全裁剪字符串，避免切断多字节字符。 */
export function takeUtf8Bytes(value: string, limitBytes: number): string {
  if (limitBytes <= 0) return ''
  if (Buffer.byteLength(value, 'utf8') <= limitBytes) return value

  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(value.slice(0, middle), 'utf8') <= limitBytes) low = middle
    else high = middle - 1
  }
  return value.slice(0, low)
}

/** 保留开头和结尾，将单段文本裁剪到模型可见上限。 */
export function clipShellModelText(value: string): { text: string; truncated: boolean } {
  const safeValue = redactSensitiveText(value)
  if (Buffer.byteLength(safeValue, 'utf8') <= SHELL_MODEL_RESULT_LIMIT_BYTES) {
    return { text: safeValue, truncated: false }
  }

  const head = takeUtf8Bytes(safeValue, SHELL_MODEL_RESULT_HEAD_BYTES)
  const tailSource = Buffer.from(safeValue, 'utf8')
  const tail = tailSource.subarray(Math.max(0, tailSource.length - SHELL_MODEL_RESULT_TAIL_BYTES)).toString('utf8')
  return {
    text: `${head}\n[...Shell output clipped for model context...]\n${tail}`,
    truncated: true
  }
}

/** 将 Shell Tool 结果转换为最多 64 KiB 的模型安全结果。 */
export function createModelSafeShellResult(result: ExecuteShellResult): ShellModelResult {
  const combined = [`stdout:\n${result.stdout}`, `stderr:\n${result.stderr}`].join('\n')
  const clipped = clipShellModelText(combined)
  if (!clipped.truncated) return { result, modelTruncated: false }

  return {
    result: {
      ...result,
      stdout: clipped.text,
      stderr: '',
      stdoutTruncated: true,
      stderrTruncated: result.stderrTruncated
    },
    modelTruncated: true
  }
}
