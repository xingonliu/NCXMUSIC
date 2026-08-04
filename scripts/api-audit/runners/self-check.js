'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const args = require('../lib/args.js')({
  workDir: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  phase: { type: 'string', default: '0' },
})

const errors = []

function assert(cond, msg) {
  if (!cond) errors.push(msg)
}

const discovery = JSON.parse(fs.readFileSync(path.join(args.workDir, '01-discovery-universe.json'), 'utf8'))
const inventoryJson = JSON.parse(fs.readFileSync(path.join(args.reportDir, '01-api-inventory.json'), 'utf8'))
const inventory = inventoryJson.inventory
const invIds = new Set(inventory.map((r) => r.apiAuditId))
const uniIds = new Set(discovery.universe.map((u) => u.apiAuditId))

assert(invIds.size === uniIds.size, 'inventory count != universe count')
for (const id of uniIds) assert(invIds.has(id), 'universe - inventory not empty: ' + id)
for (const id of invIds) assert(uniIds.has(id), 'inventory - universe not empty: ' + id)

const endpointsDir = path.join(args.reportDir, 'endpoints')
const repIds = new Set()
if (fs.existsSync(endpointsDir)) {
  for (const f of fs.readdirSync(endpointsDir)) {
    if (f.endsWith('.md')) repIds.add(f.slice(0, -'.md'.length))
  }
}
for (const id of invIds) assert(repIds.has(id), 'inventory - endpointReports not empty: ' + id)
for (const id of repIds) assert(invIds.has(id), 'endpointReports - inventory not empty: ' + id)

const { parseCsv } = require('../lib/csv.js')
const invCsv = parseCsv(fs.readFileSync(path.join(args.reportDir, '01-api-inventory.csv'), 'utf8'))
const invHeaderCols = invCsv[0].length
for (let i = 1; i < invCsv.length; i++) {
  assert(invCsv[i].length === invHeaderCols, '01-api-inventory.csv row ' + (i + 1) + ' has ' + invCsv[i].length + ' cols, expected ' + invHeaderCols)
}
assert(invCsv.length - 1 === inventory.length, '01-api-inventory.csv row count mismatch: ' + (invCsv.length - 1) + ' vs ' + inventory.length)

const dictCsvPath = path.join(args.reportDir, '04-field-dictionary.csv')
const dictCsv = fs.existsSync(dictCsvPath) ? parseCsv(fs.readFileSync(dictCsvPath, 'utf8')) : []
const dictHeaderCols = dictCsv.length ? dictCsv[0].length : 0
for (let i = 1; i < dictCsv.length; i++) {
  assert(dictCsv[i].length === dictHeaderCols, '04-field-dictionary.csv row ' + (i + 1) + ' has ' + dictCsv[i].length + ' cols, expected ' + dictHeaderCols)
}
assert(dictCsv.length > 0, '04-field-dictionary.csv empty')

const LEGAL_STATUS = new Set([
  'passed', 'partial', 'failed_stable', 'blocked_by_prerequisite', 'blocked_by_safety',
  'rate_limited', 'deprecated', 'alias', 'not_exported', 'unsupported_environment',
])

let withStatus = 0
let tested = 0
for (const r of inventory) {
  if (r.executedCaseCount > 0) {
    tested++
    if (r.terminalStatus) withStatus++
    else assert(false, 'runtime-tested API missing terminalStatus: ' + r.apiAuditId)
  }
  if (r.terminalStatus) {
    assert(LEGAL_STATUS.has(r.terminalStatus), 'illegal terminalStatus ' + r.terminalStatus + ' for ' + r.apiAuditId)
    const jsonPath = path.join(endpointsDir, r.apiAuditId + '.json')
    if (fs.existsSync(jsonPath)) {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      assert(j.terminalStatus === r.terminalStatus, 'status mismatch inventory vs endpoint json for ' + r.apiAuditId + ': ' + r.terminalStatus + ' vs ' + j.terminalStatus)
      const cases = j.matrix.cases || []
      assert(cases.length === r.executedCaseCount, 'executedCaseCount mismatch for ' + r.apiAuditId + ': inventory=' + r.executedCaseCount + ' json=' + cases.length)
      assert((j.evidence || []).length === cases.length, 'evidence count mismatch for ' + r.apiAuditId)
      for (const c of cases) {
        assert(!!c.sampleHash, 'case missing sampleHash: ' + r.apiAuditId + ' ' + c.caseId)
      }
      const rawFileNames = new Set((j.evidence || []).map((e) => e.rawFile))
      for (const f of rawFileNames) {
        assert(fs.existsSync(path.join(args.workDir, 'raw', f)), 'evidence rawFile missing: ' + f)
      }
    }
  }
  if (r.plannedCaseCount < 1) assert(false, 'plannedCaseCount < 1: ' + r.apiAuditId)
}
if (args.phase !== '0') {
  assert(tested === withStatus, 'terminal statuses missing for tested APIs: ' + (tested - withStatus))
  console.log('phase ' + args.phase + ': runtime-tested=' + tested + ' all-tested-have-status=' + (tested === withStatus) + ' (unassigned=' + (inventory.length - withStatus) + ' pending runtime phases)')
} else {
  console.log('phase 0: terminalStatus assignment deferred to runtime phases (' + withStatus + '/' + inventory.length + ' assigned)')
}

let dupSections = 0
for (const f of fs.readdirSync(endpointsDir).filter((x) => x.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(endpointsDir, f), 'utf8')
  const seen = new Set()
  for (const m of text.matchAll(/^##\s*(\d+)\.\s*Phase\s*\d+\s*运行记录/gm)) {
    if (seen.has(m[1])) {
      dupSections++
      assert(false, 'duplicate phase section ## ' + m[1] + ' in ' + f)
    }
    seen.add(m[1])
  }
}
for (const f of ['00-RUN-MANIFEST.md', '02-coverage-summary.md', '06-failures-and-blockers.md', '07-multivariable-diff.md']) {
  const p = path.join(args.reportDir, f)
  if (!fs.existsSync(p)) continue
  const text = fs.readFileSync(p, 'utf8')
  const seen = new Set()
  for (const m of text.matchAll(/^##\s*(\d+)\.\s*Phase\s*\d+\s*运行记录/gm)) {
    if (seen.has(m[1])) {
      dupSections++
      assert(false, 'duplicate phase section ## ' + m[1] + ' in ' + f)
    }
    seen.add(m[1])
  }
}
console.log('duplicate phase sections found: ' + dupSections)

const manifestPath = path.join(args.reportDir, 'samples-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const rawFiles = fs.readdirSync(path.join(args.workDir, 'raw')).filter((x) => x.endsWith('.raw.json'))
assert(manifest.samples.length === rawFiles.length, 'samples-manifest count ' + manifest.samples.length + ' != raw files ' + rawFiles.length)
const manifestIds = new Set()
for (const s of manifest.samples) {
  assert(fs.existsSync(path.join(args.workDir, 'raw', s.rawFile)), 'manifest rawFile missing: ' + s.rawFile)
  assert(fs.existsSync(path.join(args.reportDir, 'samples-redacted', s.redactedFile)), 'manifest redactedFile missing: ' + s.redactedFile)
  manifestIds.add(s.caseId)
}
const rawCaseIds = new Set(rawFiles.map((f) => JSON.parse(fs.readFileSync(path.join(args.workDir, 'raw', f), 'utf8')).meta.caseId))
assert(manifestIds.size === rawCaseIds.size, 'manifest caseId set mismatch with raw files')
for (const id of manifestIds) assert(rawCaseIds.has(id), 'manifest caseId not in raw: ' + id)

const lineage = JSON.parse(fs.readFileSync(path.join(args.reportDir, '03-parameter-lineage.json'), 'utf8'))
for (const e of lineage.runtimeEdges || []) {
  assert(!!e.idHash && e.idHash.length === 16, 'lineage edge missing idHash: ' + e.consumerCaseId)
}

try {
  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'redaction', 'secret-scan.js'),
    '--scanDir', args.reportDir,
  ], { stdio: 'inherit' })
} catch (e) {
  errors.push('secret scan on reportDir failed')
}

try {
  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'redaction', 'secret-scan.js'),
    '--scanDir', path.join(__dirname, '..'),
  ], { stdio: 'inherit' })
} catch (e) {
  errors.push('secret scan on scripts dir failed')
}

if (errors.length) {
  console.error('SELF-CHECK FAILED:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(1)
}
console.log('SELF-CHECK PASSED (phase ' + args.phase + '): universe=' + uniIds.size + ' inventory=' + invIds.size + ' reports=' + repIds.size + ' samples=' + manifest.samples.length)
