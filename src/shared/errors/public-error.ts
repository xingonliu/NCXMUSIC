import type { ProtocolError } from '../schemas/runtime'

const SENSITIVE_PATTERN =
  /(music_u|cookie|authorization|api[-_ ]?key|bearer)\s*[:=]\s*[^\s,;]+/giu

export function sanitizeErrorMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value)
  return message.replace(SENSITIVE_PATTERN, '$1=[REDACTED]').slice(0, 200)
}

export function unavailableError(reason: unknown): ProtocolError {
  return {
    code: 'UTILITY_UNAVAILABLE',
    message: sanitizeErrorMessage(reason),
    retryable: true
  }
}
