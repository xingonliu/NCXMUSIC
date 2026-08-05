'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { redact } = require('./redact.js')
const fieldsLib = require('./fields.js')

const PHASE_SECTION = {
  1: '## 13. Phase 1 运行记录',
  2: '## 14. Phase 2 运行记录',
  3: '## 15. Phase 3 运行记录',
  4: '## 16. Phase 4 运行记录',
  6: '## 17. Phase 6 运行记录',
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function loadRawByApi(rawDir) {
  const byApi = {}
  for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json')).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
    if (!byApi[r.meta.apiAuditId]) byApi[r.meta.apiAuditId] = []
    byApi[r.meta.apiAuditId].push({ file: f, rec: r })
  }
  return byApi
}

function buildCases(rawEntries, rawDir, phase) {
  return rawEntries.map(({ file, rec }) => {
    const rawFile = path.join(rawDir, file)
    const sampleHash = sha256File(rawFile)
    const redactedFile = path.join(path.dirname(rawDir), '..', '..', 'reports', '4.39.0', 'RUN-2026-08-04-P0-PROVISIONAL', 'samples-redacted', file.replace(/\.raw\.json$/, '.redacted.json'))
    void redactedFile
    const err = rec.error || null
    return {
      caseId: rec.meta.caseId,
      auth: rec.meta.auth,
      phase,
      status: err ? 'error' : rec.meta.status,
      code: err
        ? (err.body && typeof err.body.code !== 'undefined' ? err.body.code : null)
        : (rec.body && typeof rec.body.code !== 'undefined' ? rec.body.code : null),
      durationMs: rec.meta.durationMs,
      error: err ? { class: err.class, status: err.status, code: err.body && typeof err.body.code !== 'undefined' ? err.body.code : null, body: err.body ? redact(err.body) : null, message: err.message } : null,
      sampleHash,
      rawFile: file,
    }
  }).sort((a, b) => a.caseId.localeCompare(b.caseId))
}

function computeFields(rawEntries) {
  const agg = new Map()
  for (const { rec } of rawEntries) {
    if (!rec.body || rec.error) continue
    for (const row of fieldsLib.analyze(rec.body, rec.meta.caseId, rec.meta.auth)) {
      let f = agg.get(row.jsonPath)
      if (!f) {
        f = { jsonPath: row.jsonPath, rawTypes: new Set(), presence: 0, nulls: 0, empties: 0, auths: new Set(), firstSeenCase: null, lastSeenCase: null, example: null }
        agg.set(row.jsonPath, f)
      }
      f.rawTypes.add(row.rawType)
      f.presence++
      f.auths.add(row.auth)
      if (!f.firstSeenCase) f.firstSeenCase = row.caseRef
      f.lastSeenCase = row.caseRef
      if (row.empty) f.empties++
      if (row.rawType === 'null') f.nulls++
      if (row.value !== null && typeof row.value !== 'object' && !Array.isArray(row.value) && f.example === null) {
        const rv = redact({ v: row.value }).v
        f.example = String(rv).slice(0, 60)
      }
    }
  }
  return [...agg.values()].map((f) => ({
    jsonPath: f.jsonPath,
    rawType: f.rawTypes.size === 1 ? [...f.rawTypes][0] : 'union<' + [...f.rawTypes].join('|') + '>',
    presence: f.presence,
    nulls: f.nulls,
    empties: f.empties,
    auths: [...f.auths],
    firstSeenCase: f.firstSeenCase,
    lastSeenCase: f.lastSeenCase,
    example: f.example,
  })).sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
}

function updateEndpointJson(jsonPath, { cases, fields, terminalStatus, blocker }) {
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const byId = new Map((j.matrix.cases || []).map((c) => [c.caseId, c]))
  for (const c of cases) byId.set(c.caseId, c)
  j.matrix.cases = [...byId.values()].sort((a, b) => a.caseId.localeCompare(b.caseId))
  j.matrix.executed = j.matrix.cases.length
  const fById = new Map((j.fields || []).map((f) => [f.jsonPath, f]))
  for (const f of fields) fById.set(f.jsonPath, f)
  j.fields = [...fById.values()].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
  j.evidence = j.matrix.cases.map((c) => ({ caseId: c.caseId, sampleHash: c.sampleHash, rawFile: c.rawFile }))
  if (terminalStatus) {
    j.terminalStatus = terminalStatus
    j.blocker = blocker || null
  }
  fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
  return j
}

function renderEndpointMd(mdPath, jsonPath, runId) {
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const cases = j.matrix.cases || []
  const byPhase = new Map()
  for (const c of cases) {
    const p = c.phase || 1
    if (!byPhase.has(p)) byPhase.set(p, [])
    byPhase.get(p).push(c)
  }
  const sectionNumbers = Object.keys(PHASE_SECTION).map(Number)
  let md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '# ' + j.apiAuditId + '\n'
  const { stripPhaseSections } = require('./md.js')
  md = stripPhaseSections(md, Object.values(PHASE_SECTION))
  const parts = []
  const phases = [...byPhase.keys()].sort((a, b) => a - b)
  let first = true
  for (const p of phases) {
    const sec = []
    sec.push('')
    sec.push(PHASE_SECTION[p] + '（' + runId + '）')
    sec.push('')
    if (first && j.terminalStatus) {
      sec.push('- 终态：**' + j.terminalStatus + '**' + (j.blocker ? '（blocker: ' + j.blocker + '）' : ''))
      sec.push('')
      first = false
    }
    sec.push('| caseId | auth | status | code | durationMs | error |')
    sec.push('| --- | --- | --- | --- | --- | --- |')
    for (const c of byPhase.get(p)) {
      const errDesc = c.error ? (c.error.code !== null && c.error.code !== undefined ? 'code ' + c.error.code : c.error.class) : ''
      sec.push('| ' + c.caseId + ' | ' + c.auth + ' | ' + (c.status === 'error' ? 'err' : (c.status || '-')) + ' | ' + (c.code === null || c.code === undefined ? '-' : c.code) + ' | ' + (c.durationMs || '-') + ' | ' + String(errDesc).replace(/\|/g, '/') + ' |')
    }
    if (p === phases[phases.length - 1] && j.fields && j.fields.length) {
      sec.push('')
      sec.push('### 累计字段表（跨 Phase，' + runId + '）')
      sec.push('')
      sec.push('| JSONPath | rawType | presence | null | empty | auths | example |')
      sec.push('| --- | --- | --- | --- | --- | --- | --- |')
      for (const f of j.fields) {
        sec.push('| `' + f.jsonPath + '` | ' + f.rawType + ' | ' + f.presence + ' | ' + f.nulls + ' | ' + f.empties + ' | ' + (f.auths || []).join(',') + ' | ' + (f.example === null ? '' : '`' + String(f.example).replace(/`/g, '').slice(0, 40) + '`') + ' |')
      }
    }
    parts.push(sec.join('\n'))
  }
  fs.writeFileSync(mdPath, md.replace(/\n*$/, '\n') + parts.join('\n') + '\n')
}

module.exports = { loadRawByApi, buildCases, computeFields, updateEndpointJson, renderEndpointMd, sha256File, PHASE_SECTION }
