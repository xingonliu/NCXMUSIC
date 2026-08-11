import { describe, expect, it } from 'vitest'

import { VoiceTranscriptionService } from '../../src/utility/voice-transcription-service'
import { VoiceRuntimeRequestSchema } from '../../src/shared/schemas/voice'

// ========= 测试 =========

describe('Phase 7 voice runtime privacy', () => {
  it('未配置 Provider 时拒绝上传并将传入音频字节清零', async () => {
    /** 被测 ASR 服务。 */
    const service = new VoiceTranscriptionService()
    /** 模拟内存录音。 */
    const audio = new Uint8Array([1, 2, 3, 4])

    await expect(service.execute(crypto.randomUUID(), {
      operation: 'transcribe',
      voiceSessionId: crypto.randomUUID(),
      mimeType: 'audio/webm',
      audio
    })).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' })
    expect([...audio]).toEqual([0, 0, 0, 0])
  })

  it('拒绝空录音与超过 20 MiB 的录音', () => {
    expect(VoiceRuntimeRequestSchema.safeParse({
      operation: 'transcribe',
      voiceSessionId: crypto.randomUUID(),
      mimeType: 'audio/webm',
      audio: new Uint8Array()
    }).success).toBe(false)
    expect(VoiceRuntimeRequestSchema.safeParse({
      operation: 'transcribe',
      voiceSessionId: crypto.randomUUID(),
      mimeType: 'audio/webm',
      audio: new Uint8Array(20 * 1_024 * 1_024 + 1)
    }).success).toBe(false)
  })

  it('状态查询只暴露配置与能力枚举', async () => {
    /** 未配置服务的公开状态。 */
    const status = await new VoiceTranscriptionService().execute(crypto.randomUUID(), { operation: 'status' })
    expect(status).toEqual({
      operation: 'status',
      configured: false,
      capability: 'unknown',
      message: '请先配置当前大模型。'
    })
  })
})
