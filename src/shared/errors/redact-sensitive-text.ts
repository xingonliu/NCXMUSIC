const COOKIE_JSON = /(["']?cookie["']?\s*[:=]\s*)["'][^"'\r\n]*["']/giu
const COOKIE_HEADER = /(cookie\s*:\s*)[^\r\n]+/giu
const NAMED_SECRET = /((?:music_u|authorization|api[-_ ]?key|bearer)\s*[:=]\s*)["']?[^"'\s,;}]+["']?/giu

export function redactSensitiveText(value: unknown): string {
  return String(value)
    .replace(COOKIE_JSON, '$1"[REDACTED]"')
    .replace(COOKIE_HEADER, '$1[REDACTED]')
    .replace(NAMED_SECRET, '$1[REDACTED]')
}
