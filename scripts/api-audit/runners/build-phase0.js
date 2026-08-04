'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const args = require('../lib/args.js')({
  pkgDir: { type: 'string', required: true },
  repoDir: { type: 'string', required: true },
  workDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  packageVersion: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
})

const node = process.execPath
const scriptsDir = path.join(__dirname, '..')

execFileSync(node, [
  path.join(scriptsDir, 'inventory', 'discover.js'),
  '--pkgDir', args.pkgDir,
  '--repoDir', args.repoDir,
  '--outDir', args.workDir,
], { stdio: 'inherit' })

execFileSync(node, [
  path.join(scriptsDir, 'analyzers', 'static-analyze.js'),
  '--pkgDir', args.pkgDir,
  '--repoDir', args.repoDir,
  '--outDir', args.workDir,
], { stdio: 'inherit' })

const discovery = JSON.parse(fs.readFileSync(path.join(args.workDir, '01-discovery-universe.json'), 'utf8'))
const analysis = JSON.parse(fs.readFileSync(path.join(args.workDir, '02-static-analysis.json'), 'utf8'))
const { classify } = require(path.join(scriptsDir, 'analyzers', 'classify.js'))

const analysisByModule = new Map(analysis.map((a) => [a.moduleName, a]))

const inventory = discovery.universe.map((u) => {
  const stat = analysisByModule.get(u.moduleName) || { params: [], paginationParams: [], urls: [], templatedUrls: [], cryptoMode: null, checkToken: false, unblock: false, hasCookie: false, localOnly: false, title: null, defaults: [], asyncFn: false, sourceLen: 0 }
  const cls = classify(u.moduleName, stat)
  const route = stat.urls[0] || (stat.templatedUrls[0] ? stat.templatedUrls[0] + ' (templated)' : 'direct-call')
  const requestMethod = stat.localOnly ? 'direct-call' : (stat.cryptoMode ? 'POST/' + stat.cryptoMode : 'POST')
  return {
    apiAuditId: cls.apiAuditId,
    moduleName: u.moduleName,
    exportName: u.exportName,
    route,
    requestMethod,
    discoveredFrom: u.discoveredFrom,
    inRepo: u.inRepo,
    inPkg: u.inPkg,
    moduleChecksum: u.pkgSha256 || u.repoSha256 || '',
    checksumSource: u.pkgSha256 ? 'pkg' : 'repo',
    repoPkgChecksumDiffer: u.repoPkgChecksumDiffer,
    title: stat.title,
    category: cls.category,
    frequency: cls.frequency,
    testPhase: cls.testPhase,
    sideEffectClass: cls.sideEffectClass,
    authRequirementHypothesis: cls.authRequirementHypothesis,
    paginationKind: cls.paginationKind,
    consumes: cls.consumes,
    produces: cls.produces,
    aliasOf: '',
    replacement: '',
    deprecatedEvidence: '',
    cryptoMode: stat.cryptoMode,
    checkToken: stat.checkToken,
    unblock: stat.unblock,
    hasCookie: stat.hasCookie,
    localOnly: stat.localOnly,
    asyncFn: stat.asyncFn,
    params: stat.params,
    defaults: stat.defaults,
    plannedCaseCount: cls.plannedCaseCount,
    executedCaseCount: 0,
    terminalStatus: '',
    reportPath: 'endpoints/' + cls.apiAuditId + '.md',
    blocker: '',
  }
})

function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const csvHeader = [
  'apiAuditId', 'moduleName', 'exportName', 'route', 'requestMethod', 'discoveredFrom',
  'moduleChecksum', 'checksumSource', 'inRepo', 'inPkg', 'repoPkgChecksumDiffer', 'title',
  'category', 'frequency', 'testPhase', 'sideEffectClass', 'authRequirementHypothesis',
  'paginationKind', 'consumes', 'produces', 'aliasOf', 'replacement', 'deprecatedEvidence',
  'cryptoMode', 'checkToken', 'unblock', 'hasCookie', 'localOnly', 'asyncFn',
  'params', 'defaults', 'plannedCaseCount', 'executedCaseCount', 'terminalStatus', 'reportPath', 'blocker',
]

const csvRows = inventory.map((r) =>
  csvHeader.map((h) => {
    let v = r[h]
    if (Array.isArray(v)) v = v.join('|')
    return csvEscape(v)
  }).join(','),
)

fs.mkdirSync(args.reportDir, { recursive: true })
const csvPath = path.join(args.reportDir, '01-api-inventory.csv')
const jsonPath = path.join(args.reportDir, '01-api-inventory.json')
fs.writeFileSync(csvPath, [csvHeader.map(csvEscape).join(','), ...csvRows].join('\n') + '\n')
fs.writeFileSync(jsonPath, JSON.stringify({
  schemaVersion: 1,
  runId: args.runId,
  packageVersion: args.packageVersion,
  generatedAt: new Date().toISOString(),
  inventory,
}, null, 2))

const summary = {
  universeCount: inventory.length,
  byPhase: {},
  byCategory: {},
  bySideEffect: {},
  byAuthHypothesis: {},
  byPagination: {},
  plannedTotalCases: 0,
}
for (const r of inventory) {
  summary.byPhase[r.testPhase] = (summary.byPhase[r.testPhase] || 0) + 1
  summary.byCategory[r.category] = (summary.byCategory[r.category] || 0) + 1
  summary.bySideEffect[r.sideEffectClass] = (summary.bySideEffect[r.sideEffectClass] || 0) + 1
  summary.byAuthHypothesis[r.authRequirementHypothesis] = (summary.byAuthHypothesis[r.authRequirementHypothesis] || 0) + 1
  summary.byPagination[r.paginationKind] = (summary.byPagination[r.paginationKind] || 0) + 1
  summary.plannedTotalCases += r.plannedCaseCount
}
fs.writeFileSync(path.join(args.reportDir, '01-inventory-summary.json'), JSON.stringify(summary, null, 2))
console.log('inventory written:', csvPath)
console.log(JSON.stringify(summary, null, 2))
