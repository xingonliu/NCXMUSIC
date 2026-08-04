'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

class SessionStore {
  constructor(dir) {
    this.dir = dir
    fs.mkdirSync(dir, { recursive: true })
  }

  pathFor(label) {
    return path.join(this.dir, label + '.cookie')
  }

  save(label, cookieValue) {
    if (!cookieValue) return null
    fs.writeFileSync(this.pathFor(label), cookieValue, 'utf8')
    return { label, sha256: sha256(cookieValue), savedAt: new Date().toISOString() }
  }

  load(label) {
    const p = this.pathFor(label)
    if (!fs.existsSync(p)) return null
    return fs.readFileSync(p, 'utf8').trim()
  }

  describe(label) {
    const v = this.load(label)
    return v ? { label, sha256: sha256(v), length: v.length, generatedAt: new Date().toISOString() } : null
  }
}

function makeInvalidCookie(kind) {
  if (kind === 'truncated') return 'MUSIC_U=abc'
  if (kind === 'expired') return 'MUSIC_U=' + crypto.randomBytes(24).toString('hex')
  return 'MUSIC_U=' + crypto.randomBytes(16).toString('hex')
}

function cookieForLayer(store, layer) {
  switch (layer) {
    case 'AUTH_NONE': return null
    case 'AUTH_ANON': return store.load('guest-01')
    case 'AUTH_USER': return process.env.NCM_AUTH_USER_COOKIE || null
    case 'AUTH_VIP': return process.env.NCM_AUTH_VIP_COOKIE || null
    case 'AUTH_PURCHASED': return process.env.NCM_AUTH_PURCHASED_COOKIE || null
    case 'AUTH_INVALID_TRUNCATED': return makeInvalidCookie('truncated')
    case 'AUTH_INVALID_EXPIRED': return makeInvalidCookie('expired')
    default: return null
  }
}

module.exports = { SessionStore, cookieForLayer, makeInvalidCookie, sha256 }
