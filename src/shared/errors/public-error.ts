import { redactSensitiveText } from './redact-sensitive-text'

/** 把未知错误压缩为可公开展示的脱敏短文案。 */
export function sanitizeErrorMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value)
  return redactSensitiveText(message).slice(0, 200)
}
