const QUOTED_SECRET_FIELD =
  /(["']?(?:cookie(?:header)?|music_u|authorization|api[-_ ]?key|bearer)["']?\s*[:=]\s*)["'][^"'\r\n]*["']/giu
const HEADER_SECRET = /((?:cookie|authorization)\s*:\s*)[^\r\n]+/giu
const INLINE_SECRET =
  /((?:cookieheader|music_u|api[-_ ]?key|bearer)\s*[:=]\s*)["']?[^\s,;}"']+["']?/giu

export function redactSensitiveText(value: unknown): string {
  return String(value)
    .replace(QUOTED_SECRET_FIELD, '$1"[REDACTED]"')
    .replace(HEADER_SECRET, '$1[REDACTED]')
    .replace(INLINE_SECRET, '$1[REDACTED]')
}
