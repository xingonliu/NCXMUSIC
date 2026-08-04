'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { toCsvRow, parseCsv } = require('./csv.js')
const { upsertSection } = require('./md.js')
const { redact } = require('./redact.js')
const {
  loadRawByApi, buildCases, computeFields, updateEndpointJson, renderEndpointMd, sha256File,
} = require('./endpoint-facts.js')

const LEGAL_STATUS = new Set([
  'passed', 'partial', 'failed_stable', 'blocked_by_prerequisite', 'blocked_by_safety',
  'rate_limited', 'deprecated', 'alias', 'not_exported', 'unsupported_environment',
])

function idHash(id) {
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 16)
}

function runPhaseReport(opts) {
  const { phase, specPath, statusMap, findings, sectionNumbers, rawDir, poolPath, runId, reportDir, packageVersion, sessionDir, agentName } = opts
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
  const byApi = loadRawByApi(rawDir)
  const apiIds = spec.groups.map((g) => g.apiAuditId)
  const caseIds = new Set(spec.groups.flatMap((g) => g.cases.map((c) => c.caseId)))
  const endpointsDir = path.join(reportDir, 'endpoints')
  const samplesDir = path.join(reportDir, 'samples-redacted')

  for (const id of apiIds) {
    const entries = (byApi[id] || []).filter(({ rec }) => caseIds.has(rec.meta.caseId))
    if (!entries.length) continue
    const cases = buildCases(entries, rawDir, phase)
    const allEntries = byApi[id] || []
    const fields = computeFields(allEntries)
    const jsonPath = path.join(endpointsDir, id + '.json')
    if (!fs.existsSync(jsonPath)) continue
    const st = statusMap[id] || { status: 'partial', blocker: '待补充说明' }
    updateEndpointJson(jsonPath, { cases, fields, terminalStatus: st.status, blocker: st.blocker })
    renderEndpointMd(path.join(endpointsDir, id + '.md'), jsonPath, runId)
  }

  const invJsonPath = path.join(reportDir, '01-api-inventory.json')
  const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
  for (const rec of inv.inventory) {
    if (!apiIds.includes(rec.apiAuditId)) continue
    const jsonPath = path.join(endpointsDir, rec.apiAuditId + '.json')
    if (!fs.existsSync(jsonPath)) continue
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    rec.executedCaseCount = (j.matrix.cases || []).length
    const st = statusMap[rec.apiAuditId]
    if (st) { rec.terminalStatus = st.status; rec.blocker = st.blocker }
  }
  fs.writeFileSync(invJsonPath, JSON.stringify(inv, null, 2))
  const csvPath = path.join(reportDir, '01-api-inventory.csv')
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const header = rows[0]
  const byId = new Map(inv.inventory.map((r) => [r.apiAuditId, r]))
  const out = [header]
  for (let i = 1; i < rows.length; i++) {
    const rec = byId.get(rows[i][0])
    out.push(rec ? header.map((h) => rec[h]) : rows[i])
  }
  fs.writeFileSync(csvPath, out.map(toCsvRow).join('\n') + '\n')

  const dictPath = path.join(reportDir, '04-field-dictionary.csv')
  const dictHeader = [
    'apiAuditId', 'jsonPath', 'rawType', 'elementType', 'requiredObserved', 'presenceCount',
    'sampleCount', 'nullCount', 'emptyCount', 'exampleRedacted', 'valueRangeOrEnum',
    'authConditions', 'resourceConditions', 'firstSeenCase', 'lastSeenCase', 'semanticName',
    'semanticConfidence', 'sourceEvidence', 'normalizedEntity', 'normalizedField', 'conflictId',
  ]
  const dictJsonRows = []
  for (const f of fs.readdirSync(endpointsDir).filter((x) => x.endsWith('.json')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(endpointsDir, f), 'utf8'))
    for (const field of j.fields || []) {
      dictJsonRows.push({
        apiAuditId: j.apiAuditId, jsonPath: field.jsonPath, rawType: field.rawType, elementType: '',
        requiredObserved: 'observed', presenceCount: field.presence, sampleCount: field.presence,
        nullCount: field.nulls, emptyCount: field.empties,
        exampleRedacted: field.example === null ? '' : String(field.example),
        valueRangeOrEnum: '', authConditions: (field.auths || []).join('|'), resourceConditions: '',
        firstSeenCase: field.firstSeenCase || '', lastSeenCase: field.lastSeenCase || '',
        semanticName: '', semanticConfidence: 'unknown', sourceEvidence: 'runtime',
        normalizedEntity: '', normalizedField: '', conflictId: '',
      })
    }
  }
  const dictAllRows = [dictHeader, ...dictJsonRows.map((r) => dictHeader.map((h) => r[h]))]
  fs.writeFileSync(dictPath, dictAllRows.map(toCsvRow).join('\n') + '\n')
  fs.writeFileSync(path.join(reportDir, '04-field-dictionary.json'), JSON.stringify({ schemaVersion: 1, runId, rows: dictJsonRows }, null, 2))

  const allRawFiles = fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json')).sort()
  for (const f of allRawFiles) {
    const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
    const redactedFile = path.join(samplesDir, f.replace(/\.raw\.json$/, '.redacted.json'))
    fs.writeFileSync(redactedFile, JSON.stringify(redact(r), null, 2))
  }
  const sampleManifest = allRawFiles.map((f) => {
    const full = path.join(rawDir, f)
    const r = JSON.parse(fs.readFileSync(full, 'utf8'))
    const redactedFile = path.join(samplesDir, f.replace(/\.raw\.json$/, '.redacted.json'))
    return { caseId: r.meta.caseId, apiAuditId: r.meta.apiAuditId, auth: r.meta.auth, rawFile: f, rawSha256: sha256File(full), redactedFile: path.basename(redactedFile) }
  })
  fs.writeFileSync(path.join(reportDir, 'samples-manifest.json'), JSON.stringify({ runId, samples: sampleManifest.sort((a, b) => a.caseId.localeCompare(b.caseId)) }, null, 2))

  const poolRaw = JSON.parse(fs.readFileSync(poolPath, 'utf8'))
  const runtimeEdges = []
  const paramEntityCandidates = new Map()
  for (const [entity, entries] of Object.entries(poolRaw.pool || {})) {
    for (const e of entries) {
      if (!paramEntityCandidates.has(e.id)) paramEntityCandidates.set(e.id, [])
      paramEntityCandidates.get(e.id).push({ entityType: entity, producerApi: e.producerApi, producerCase: e.producerCase, jsonPath: e.jsonPath })
    }
  }
  for (const f of allRawFiles) {
    const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
    const params = r.meta.params || {}
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue
      const vals = String(v).split(',').map((s) => s.trim()).filter(Boolean)
      for (const val of vals) {
        const cands = paramEntityCandidates.get(val)
        if (!cands) continue
        for (const c of cands) {
          runtimeEdges.push({
            consumerCaseId: r.meta.caseId,
            apiAuditId: r.meta.apiAuditId,
            param: k,
            entityType: c.entityType,
            idHash: idHash(val),
            producerApi: c.producerApi,
            producerCase: c.producerCase,
            producerPath: c.jsonPath,
          })
        }
      }
    }
  }
  const poolSummary = {}
  for (const [entity, entries] of Object.entries(poolRaw.pool || {})) {
    poolSummary[entity] = {
      count: entries.length,
      producers: [...new Set(entries.map((e) => e.producerApi))],
    }
  }
  const lineagePath = path.join(reportDir, '03-parameter-lineage.json')
  const lineage = JSON.parse(fs.readFileSync(lineagePath, 'utf8'))
  lineage.runtimeEdges = runtimeEdges.sort((a, b) => a.consumerCaseId.localeCompare(b.consumerCaseId))
  lineage.poolSummary = poolSummary
  lineage.generatedAt = new Date().toISOString()
  fs.writeFileSync(lineagePath, JSON.stringify(lineage, null, 2))

  const guestLabel = sessionDir ? (fs.existsSync(path.join(sessionDir, 'guest-01.cookie')) ? '已建立（AUTH_ANON 层有效）' : '未建立') : 'N/A'

  upsertSection(path.join(reportDir, '00-RUN-MANIFEST.md'), sectionNumbers.manifest, [
    '## ' + sectionNumbers.manifest + '. Phase ' + phase + ' 运行记录（' + runId + '）',
    '',
    '- 执行 Agent：' + agentName,
    '- 线上请求数：' + allRawFiles.filter((f) => JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8')).meta.apiAuditId !== 'ncm.inner_version').length + '（并发 1，抖动 350–800ms；含失败重跑取证，错误响应体完整落盘）',
    '- guest-01 游客会话：' + guestLabel,
    '- 风控状态：Phase 3/4 出现 code -462 验证挑战（verifyType 40），运行器对 -462 退避 30s',
  ].join('\n'))

  upsertSection(path.join(reportDir, '02-coverage-summary.md'), sectionNumbers.coverage, [
    '## ' + sectionNumbers.coverage + '. Phase ' + phase + ' 运行记录（' + runId + '）',
    '',
    '- 执行接口数：' + apiIds.length + '；执行 case：' + caseIds.size,
    '- 终态：' + apiIds.filter((id) => statusMap[id]).length + ' 个已赋（' + [...new Set(apiIds.map((id) => statusMap[id] && statusMap[id].status))].filter(Boolean).join('/') + '）',
    '- 夹具池（脱敏血缘见 03-parameter-lineage.json）：' + Object.entries(poolRaw.pool || {}).map(([k, v]) => k + '=' + v.length).join(', '),
    '- 关键契约事实：见 07-multivariable-diff.md 与 06-failures-and-blockers.md',
  ].join('\n'))

  upsertSection(path.join(reportDir, '06-failures-and-blockers.md'), sectionNumbers.failures, [
    '## ' + sectionNumbers.failures + '. Phase ' + phase + ' 运行发现（' + runId + '）',
    '',
    ...findings.map((f) => '- **' + f[0] + '**（' + f[1] + '）：' + f[2] + '（' + f[3] + '）'),
  ].join('\n'))

  upsertSection(path.join(reportDir, '07-multivariable-diff.md'), sectionNumbers.diff, [
    '## ' + sectionNumbers.diff + '. Phase ' + phase + ' 多变量差异（' + runId + '）',
    '',
    '| 接口 | 维度 | 结论 | 证据 |',
    '| --- | --- | --- | --- |',
    ...findings.map((f) => '| ' + f[0] + ' | ' + f[1] + ' | ' + f[2] + ' | ' + f[3] + ' |'),
  ].join('\n'))

  console.log('phase ' + phase + ' report updated; apis=' + apiIds.length + ' cases=' + caseIds.size)
}

module.exports = { runPhaseReport, LEGAL_STATUS }
