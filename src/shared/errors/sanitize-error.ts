import type { ProtocolError } from '../contracts/runtime'
import { redactSensitiveText } from './redact-sensitive-text'

export function sanitizeErrorMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value)
  return redactSensitiveText(message).slice(0, 200)
}

export function unavailableError(reason: unknown): ProtocolError {
  return {
    code: 'UTILITY_UNAVAILABLE',
    message: sanitizeErrorMessage(reason),
    retryable: true
  }
}
