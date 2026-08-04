'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const args = require('../lib/args.js')({
  rawDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  outDir: { type: 'string', required: true },
  workspace: { type: 'string', required: true },
  maxUrls: { type: 'int', default: 60 },
})

const { createRequire } = require('module')
const axios = createRequire(path.resolve(args.workspace, 'package.json'))('axios').default

function collectUrls(rawDir) {
  const urls = new Map()
  for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
    if (!r.body || r.error) continue
    const walk = (node, base) => {
      if (Array.isArray(node)) { node.forEach((x, i) => walk(x, base + '[' + i + ']')); return }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'url' && typeof v === 'string' && /^https?:\/\//.test(v)) {
            if (!urls.has(v)) urls.set(v, [])
            urls.get(v).push({ caseId: r.meta.caseId, jsonPath: base + '.' + k })
          } else if (k !== 'url') {
            walk(v, base ? base + '.' + k : k)
          }
        }
      }
    }
    walk(r.body, '')
  }
  return urls
}

async function probe(url) {
  const out = { url, startedAt: new Date().toISOString() }
  const tryRequest = async (config) => {
    const t0 = Date.now()
    const res = await axios({ ...config, url, timeout: 15000, maxRedirects: 5, validateStatus: () => true })
    out.durationMs = Date.now() - t0
    out.finalUrl = res.request && res.request.res && res.request.res.responseUrl ? res.request.res.responseUrl : (res.request._redirectable && res.request._redirectable._currentUrl) || url
    out.status = res.status
    out.contentType = res.headers['content-type'] || null
    out.contentLength = res.headers['content-length'] || null
    out.acceptRanges = res.headers['accept-ranges'] || null
    out.bytes = res.data ? (Buffer.isBuffer(res.data) ? res.data.length : String(res.data).length) : 0
    out.method = config.method
  }
  try {
    await tryRequest({ method: 'HEAD' })
  } catch (e1) {
    try {
      await tryRequest({ method: 'GET', headers: { Range: 'bytes=0-1' }, responseType: 'arraybuffer' })
    } catch (e2) {
      out.status = null
      out.error = String((e2 && e2.message) || e2).slice(0, 200)
    }
  }
  return out
}

async function main() {
  const urls = collectUrls(args.rawDir)
  const unique = [...urls.keys()].slice(0, args.maxUrls)
  const results = []
  for (const url of unique) {
    results.push(await probe(url))
  }
  const probeDir = path.join(args.outDir, 'media-probes')
  fs.mkdirSync(probeDir, { recursive: true })
  for (const r of results) {
    const key = crypto.createHash('sha256').update(r.url).digest('hex').slice(0, 12)
    fs.writeFileSync(path.join(probeDir, 'probe-' + key + '.json'), JSON.stringify(r, null, 2))
  }
  const summary = results.map((r) => {
    let shape = r.url
    try {
      const u = new URL(r.url)
      shape = u.origin + u.pathname
    } catch (e) { /* keep */ }
    return {
      urlShape: shape,
      urlHash: crypto.createHash('sha256').update(r.url).digest('hex').slice(0, 16),
      status: r.status,
      method: r.method,
      contentType: r.contentType,
      contentLength: r.contentLength,
      acceptRanges: r.acceptRanges,
      bytes: r.bytes,
      durationMs: r.durationMs,
      finalUrlHash: r.finalUrl ? crypto.createHash('sha256').update(r.finalUrl).digest('hex').slice(0, 16) : null,
      error: r.error || null,
      consumers: urls.get(r.url).map((c) => c.caseId + '@' + c.jsonPath),
    }
  })
  fs.writeFileSync(path.join(probeDir, 'summary.json'), JSON.stringify({ runId: args.runId, note: 'URL 签发于 2026-08-04 ~19:35(+8)，expi=1200s/3600s；本探测在签发窗口之后执行，即到期后状态', probed: summary.length, totalUnique: unique.length, results: summary }, null, 2))
  console.log('probes done:', summary.length, '| statuses:', summary.map((s) => s.status).join(','))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
