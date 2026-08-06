import { describe, expect, it } from 'vitest'

import {
  ShellOutputBuffer,
  clipShellModelText,
  createModelSafeShellResult
} from '../../src/infrastructure/shell/output-buffer'
import { SHELL_OUTPUT_CHANNEL_LIMIT_BYTES, type ExecuteShellResult } from '../../src/shared/schemas/shell'

// ─────────────────────────────────────────────────────────────────────────────
// Shell 输出裁剪与脱敏
// ─────────────────────────────────────────────────────────────────────────────

describe('ShellOutputBuffer', () => {
  it('统一脱敏流式输出和最终快照', () => {
    const buffer = new ShellOutputBuffer()
    const appended = buffer.append('Authorization: Bearer token123\n')

    expect(appended.text).toContain('[REDACTED]')
    expect(buffer.snapshot().text).toContain('[REDACTED]')
    expect(buffer.snapshot().text).not.toContain('token123')
  })

  it('每通道最多保留 1 MiB 并标记截断', () => {
    const buffer = new ShellOutputBuffer()
    buffer.append('a'.repeat(SHELL_OUTPUT_CHANNEL_LIMIT_BYTES - 2))
    const final = buffer.append('bbbb')

    expect(final.truncated).toBe(true)
    expect(Buffer.byteLength(buffer.snapshot().text, 'utf8')).toBe(SHELL_OUTPUT_CHANNEL_LIMIT_BYTES)
  })
})

describe('Shell model result clipping', () => {
  it('模型结果超过 64 KiB 时保留头尾并裁剪', () => {
    const clipped = clipShellModelText(`head-${'x'.repeat(80 * 1024)}-tail`)

    expect(clipped.truncated).toBe(true)
    expect(clipped.text).toContain('head-')
    expect(clipped.text).toContain('-tail')
    expect(clipped.text).toContain('clipped')
  })

  it('将 stdout/stderr 合并成模型安全结果', () => {
    const result: ExecuteShellResult = {
      status: 'succeeded',
      exitCode: 0,
      signal: null,
      durationMs: 1,
      stdout: 'x'.repeat(80 * 1024),
      stderr: 'Authorization: Bearer secret',
      stdoutTruncated: false,
      stderrTruncated: false
    }

    const safe = createModelSafeShellResult(result)

    expect(safe.modelTruncated).toBe(true)
    expect(safe.result.stdoutTruncated).toBe(true)
    expect(safe.result.stdout).not.toContain('secret')
  })
})
