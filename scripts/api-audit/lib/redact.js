'use strict'
const crypto = require('crypto')

const SENSITIVE_KEY = /cookie|csrf|token|music_u|deviceid|device_id|sessionid|signature|secret|unikey|qrcode|verify|params|nonce|sign/i
const URL_LIKE = /^https?:\/\//

function redactValue(key, value) {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY.test(key)) return '<REDACTED:' + key + '>'
    if (/MUSIC_U=[0-9a-f]{10,}/i.test(value)) return value.replace(/MUSIC_U=[0-9a-f]{10,}/gi, 'MUSIC_U=<REDACTED>')
    if (/__csrf=[0-9a-f]{6,}/i.test(value)) return value.replace(/__csrf=[0-9a-f]{6,}/gi, '__csrf=<REDACTED>')
    if (URL_LIKE.test(value)) {
      try {
        const u = new URL(value)
        const q = u.searchParams
        let touched = false
        for (const k of [...q.keys()]) {
          if (SENSITIVE_KEY.test(k) || k === 'params') {
            q.delete(k)
            q.set(k, '<REDACTED>')
            touched = true
          }
        }
        const hash = crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)
        const clean = touched ? u.origin + u.pathname + '?' + q.toString() : u.origin + u.pathname
        return clean + '#hash=' + hash
      } catch (e) {
        return '<REDACTED:url>'
      }
    }
  }
  return value
}

function redact(node, key) {
  if (Array.isArray(node)) return node.map((x) => redact(x, key))
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = redact(v, k)
    return out
  }
  return redactValue(key, node)
}

module.exports = { redact }
