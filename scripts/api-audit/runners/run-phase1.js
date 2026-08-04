'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  pkgPath: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  rawDir: { type: 'string', required: true },
  sessionDir: { type: 'string', required: true },
  spec: { type: 'string', required: true },
  maxNetworkCases: { type: 'int', default: 40 },
  filter: { type: 'string' },
})

const { SessionStore, cookieForLayer } = require('../lib/session.js')
const { redact } = require('../lib/redact.js')
const fieldsLib = require('../lib/fields.js')
const { FixturePool, extract } = require('../lib/pool.js')

const api = require(args.pkgPath)
const store = new SessionStore(args.sessionDir)
const spec = JSON.parse(fs.readFileSync(args.spec, 'utf8'))
const pool = new FixturePool()
const poolFile = path.join(args.rawDir, '03-fixture-pool.json')
if (fs.existsSync(poolFile)) {
  const prev = JSON.parse(fs.readFileSync(poolFile, 'utf8'))
  for (const [entity, arr] of Object.entries(prev.pool || {})) {
    pool.add(arr.map((e) => ({ ...e, producerCase: e.producerCase || '' })))
  }
  console.log('pool seeded from previous run:', [...pool.byEntity.keys()].map((k) => k + '=' + (pool.byEntity.get(k) || []).length).join(', '))
}

async function ensureXeapiKey() {
  const os = require('os')
  const keyFile = path.join(os.tmpdir(), 'xeapi_public_key')
  if (fs.existsSync(keyFile)) return { cached: true, file: keyFile }
  try {
    const res = await api.register_xeapikey({ timeout: 30000 })
    if (res.body && res.body.sk) {
      fs.writeFileSync(keyFile, JSON.stringify(res.body))
      return { cached: false, file: keyFile, via: 'register_xeapikey' }
    }
    throw new Error('register_xeapikey returned no sk')
  } catch (e) {
    const { createRequire } = require('module')
    const pkgRequire = createRequire(path.join(args.pkgPath, 'package.json'))
    const axios = pkgRequire('axios')
    const encrypt = require(path.join(args.pkgPath, 'util', 'crypto.js'))
    const APP_CONF = require(path.join(args.pkgPath, 'util', 'config.json')).APP_CONF
    const nonce = String(Math.floor(Math.random() * 1e16)).padStart(16, '0')
    const timestamp = String(Date.now())
    const res = await axios({
      method: 'POST',
      url: APP_CONF.apiDomain + '/api/gorilla/anti/crawler/security/key/get',
      headers: {
        'User-Agent': 'NeteaseMusic/9.1.65.240927161425(9001065);Dalvik/2.1.0 (Linux; U; Android 14; 23013RK75C Build/UKQ1.230804.001)',
      },
      data: new URLSearchParams({
        appVersion: '9.1.65',
        currentKeyVersion: '',
        deviceId: '',
        nonce,
        os: 'android',
        requestType: 'active',
        signature: encrypt.xeapiSign(timestamp, nonce),
        t1: '',
        t2: '',
        timestamp,
        uid: '',
      }).toString(),
      proxy: false,
    })
    const dec = encrypt.xeapiDecryptPublicKey(res.data.data.encryptedData)
    const sk = 'mUHCwVNWJbunMqAHf5MImuirT6plvs6VSFW62MGHstFQxhBGdEoIhLItH3djc4+FB/OKty3+lL2rGeoFBpVe5g=='
    fs.writeFileSync(keyFile, JSON.stringify({ ...dec, sk }))
    return { cached: false, file: keyFile, via: 'bootstrap-fallback-sk-static' }
  }
}

const rawDir = path.join(args.rawDir, 'raw')
const logDir = path.join(args.rawDir, 'request-log')
const samplesDir = path.join(args.reportDir, 'samples-redacted')
for (const d of [rawDir, logDir, samplesDir]) fs.mkdirSync(d, { recursive: true })

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function jitter() {
  return 350 + Math.floor(Math.random() * 450)
}

const requestLog = []
const skippedLog = []
const sampleManifest = []
const fieldAgg = new Map()
let networkCases = 0

function recordFields(apiAuditId, body, caseId, auth) {
  const rows = fieldsLib.analyze(body, caseId, auth)
  let agg = fieldAgg.get(apiAuditId)
  if (!agg) {
    agg = new Map()
    fieldAgg.set(apiAuditId, agg)
  }
  for (const r of rows) {
    let rec = agg.get(r.jsonPath)
    if (!rec) {
      rec = { jsonPath: r.jsonPath, rawTypes: new Set(), presence: 0, nulls: 0, empties: 0, auths: new Set(), firstSeenCase: null, lastSeenCase: null, example: null }
      agg.set(r.jsonPath, rec)
    }
    rec.rawTypes.add(r.rawType)
    rec.presence++
    rec.auths.add(r.auth)
    if (!rec.firstSeenCase) rec.firstSeenCase = caseId
    rec.lastSeenCase = caseId
    if (r.empty) rec.empties++
    if (r.rawType === 'null') rec.nulls++
    if (r.value !== null && typeof r.value !== 'object' && !Array.isArray(r.value) && rec.example === null) {
      rec.example = String(r.value).slice(0, 60)
    }
  }
}

function sha256File(p) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

async function executeCase(apiAuditId, c, moduleFn) {
  const startedAt = new Date()
  const cookie = cookieForLayer(store, c.auth)
  const params = { ...(c.params || {}) }
  if (cookie) params.cookie = cookie
  if (!params.timeout) params.timeout = 30000
  let attempts = 0
  let lastErr = null
  for (;;) {
    attempts++
    try {
      const res = await moduleFn(params)
      const endedAt = new Date()
      const record = {
        caseId: c.caseId,
        apiAuditId,
        auth: c.auth,
        params: c.params || {},
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        attempts,
        status: res && res.status !== undefined ? res.status : null,
        code: res && res.body && res.body.code !== undefined ? res.body.code : null,
        body: res && res.body !== undefined ? res.body : res,
        cookieCount: res && Array.isArray(res.cookie) ? res.cookie.length : null,
      }
      return { record, retryableNetwork: false }
    } catch (e) {
      lastErr = e
      const msg = String(e && e.message ? e.message : e)
      const isNetwork = /ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT|ENOTFOUND|network|socket hang up/i.test(msg)
      const is5xx = /status.?5\d\d/.test(msg) || /503|502|500/.test(msg)
      if ((isNetwork || is5xx) && attempts < 3) {
        await sleep([2000, 5000, 15000][attempts - 1])
        continue
      }
      const record = {
        caseId: c.caseId,
        apiAuditId,
        auth: c.auth,
        params: c.params || {},
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        attempts,
        status: null,
        code: null,
        error: { class: isNetwork ? 'network' : is5xx ? 'http5xx' : 'other', message: msg.slice(0, 500) },
      }
      return { record, retryableNetwork: false }
    }
  }
}

async function main() {
  const boot = await ensureXeapiKey()
  console.log('xeapi key:', boot.via || 'cached', '->', boot.file)
  let total = 0
  let local = 0
  let skipped = 0
  for (const group of spec.groups) {
    if (args.filter && group.apiAuditId !== args.filter) continue
    const moduleFn = api[group.moduleName]
    if (!moduleFn) {
      console.log('SKIP (no export):', group.apiAuditId)
      skipped++
      continue
    }
    for (const c of group.cases) {
      total++
      const localOnly = group.localOnly
      if (!localOnly && networkCases >= args.maxNetworkCases) {
        console.log('BUDGET STOP at', args.maxNetworkCases, 'network cases')
        skipped++
        continue
      }
      if (c.auth === 'AUTH_ANON' && !store.load('guest-01')) {
        skippedLog.push({ caseId: c.caseId, apiAuditId: group.apiAuditId, auth: c.auth, reason: 'guest-01 session unavailable' })
        skipped++
        console.log('case:', c.caseId, '| SKIPPED (no guest session)')
        continue
      }
      await sleep(jitter())
      const resolved = {}
      const lineages = {}
      let missingPool = false
      for (const [k, v] of Object.entries(c.params || {})) {
        const r = pool.resolve(v)
        if (r.lineage && r.lineage.missing) {
          missingPool = true
          console.log('case:', c.caseId, '| MISSING POOL VALUE', r.lineage.missing)
          break
        }
        resolved[k] = r.value
        if (r.lineage) lineages[k] = r.lineage
      }
      if (missingPool) {
        skippedLog.push({ caseId: c.caseId, apiAuditId: group.apiAuditId, auth: c.auth, reason: 'pool value missing' })
        skipped++
        continue
      }
      const { record } = await executeCase(group.apiAuditId, { ...c, params: resolved }, moduleFn)
      record.lineage = Object.keys(lineages).length ? lineages : null
      if (!localOnly) networkCases++
      else local++
      const rawFile = path.join(rawDir, record.apiAuditId + '.' + record.caseId + '.raw.json')
      fs.writeFileSync(rawFile, JSON.stringify({ meta: { caseId: record.caseId, apiAuditId: record.apiAuditId, auth: record.auth, params: record.params, startedAt: record.startedAt, endedAt: record.endedAt, durationMs: record.durationMs, attempts: record.attempts }, body: record.body, error: record.error || null }, null, 2))
      const hash = sha256File(rawFile)
      const redacted = redact({ meta: { caseId: record.caseId, apiAuditId: record.apiAuditId, auth: record.auth, params: record.params, startedAt: record.startedAt, durationMs: record.durationMs }, body: record.body, error: record.error || null })
      const redactedFile = path.join(samplesDir, record.apiAuditId + '.' + record.caseId + '.redacted.json')
      fs.writeFileSync(redactedFile, JSON.stringify(redacted, null, 2))
      sampleManifest.push({ caseId: record.caseId, apiAuditId: record.apiAuditId, auth: record.auth, rawFile: path.relative(args.rawDir, rawFile), rawSha256: hash, redactedFile: path.relative(args.reportDir, redactedFile) })
      requestLog.push(record)
      console.log('case:', record.caseId, '| auth:', record.auth, '| status:', record.status, '| code:', record.code, '| ms:', record.durationMs, record.error ? '| err: ' + record.error.class : '')
      if (record.body && typeof record.body === 'object' && !record.error) {
        recordFields(record.apiAuditId, record.body, record.caseId, record.auth)
        const entries = extract(record.body, record.apiAuditId, record.caseId)
        if (entries.length) {
          pool.add(entries)
          console.log('fixtures +' + entries.length + ' for ' + record.apiAuditId + ' (pool: ' + [...pool.byEntity.keys()].map((k) => k + '=' + (pool.byEntity.get(k) || []).length).join(', ') + ')')
        }
      }
      if (group.guestProducer && record.code === 200 && !record.error) {
        const cookieVal = record.body && record.body.cookie
        if (cookieVal) {
          store.save('guest-01', String(cookieVal))
          console.log('guest-01 session saved (sha256 of cookie not printed)')
        }
      }
      if (record.error && /rate|limit|429|403/i.test(record.error.message)) {
        console.log('RATE-LIMIT signal detected; backing off 30s')
        await sleep(30000)
      }
    }
  }

  const aggOut = {}
  for (const [apiId, agg] of fieldAgg) {
    aggOut[apiId] = [...agg.values()].map((r) => ({
      jsonPath: r.jsonPath,
      rawType: r.rawTypes.size === 1 ? [...r.rawTypes][0] : 'union<' + [...r.rawTypes].join('|') + '>',
      presence: r.presence,
      nulls: r.nulls,
      empties: r.empties,
      auths: [...r.auths],
      firstSeenCase: r.firstSeenCase,
      lastSeenCase: r.lastSeenCase,
      example: r.example,
    })).sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
  }

  const logFile = path.join(args.rawDir, 'request-log', 'phase1.jsonl')
  const existing = []
  if (fs.existsSync(logFile)) {
    existing.push(...fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse))
  }
  const seen = new Set(existing.map((r) => r.caseId))
  for (const r of requestLog) if (!seen.has(r.caseId)) existing.push(r)
  existing.sort((a, b) => a.caseId.localeCompare(b.caseId))
  fs.writeFileSync(logFile, existing.map((r) => JSON.stringify(r)).join('\n') + '\n')
  fs.writeFileSync(path.join(args.rawDir, 'request-log', 'skipped.jsonl'), skippedLog.map((r) => JSON.stringify(r)).join('\n') + (skippedLog.length ? '\n' : ''))
  fs.writeFileSync(poolFile, JSON.stringify({ runId: args.runId, generatedAt: new Date().toISOString(), pool: pool.dump() }, null, 2))
  fs.writeFileSync(path.join(args.reportDir, 'samples-manifest.json'), JSON.stringify({ runId: args.runId, samples: sampleManifest }, null, 2))
  console.log('DONE total=' + total + ' local=' + local + ' network=' + networkCases + ' skipped=' + skipped + ' poolEntities=' + pool.byEntity.size)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
