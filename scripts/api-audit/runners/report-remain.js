'use strict'
const fs = require('fs')
const path = require('path')
const { runPhaseReport } = require('../lib/phase-report.js')

const args = require('../lib/args.js')({
  rawDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  packageVersion: { type: 'string', required: true },
  sessionDir: { type: 'string' },
  agentName: { type: 'string', default: 'opencode (DeepSeek 审计 Agent)' },
})

const remainStatus = JSON.parse(fs.readFileSync(path.join(__dirname, 'specs', 'remain-status.json'), 'utf8')).statuses

const BLOCKER_USER = 'AUTH_USER 账号缺失（B-002）；写操作/私有域已预授权但账号未到位'

function finalizeStatus(id, cases) {
  const base = remainStatus[id] || { status: 'partial', blocker: BLOCKER_USER }
  if (base.status !== 'partial') return base
  if (!cases.length) return base
  const errs = cases.filter((c) => c.error)
  const oks = cases.filter((c) => !c.error)
  if (errs.length === cases.length && cases.length >= 2) {
    const codes = [...new Set(errs.map((c) => (c.error.body && c.error.body.code !== undefined ? c.error.body.code : c.error.status)))]
    if (codes.length === 1 && codes[0] === 301) {
      return { status: 'blocked_by_prerequisite', blocker: '301 需登录会话；AUTH_ANON 未满足（待账号）' }
    }
    if (codes.length === 1 && codes[0] === -462) {
      return { status: 'partial', blocker: '全部样本被 -462 验证挑战阻断（verifyId 1007602）；风控冷却后补测' }
    }
    if (codes.every((c) => c === null)) {
      return { status: 'failed_stable', blocker: '模块级异常（非网络）：' + errs[0].error.message.slice(0, 80) }
    }
  }
  return { status: 'partial', blocker: BLOCKER_USER }
}

const FINDINGS = [
  ['登录门槛', '剩余域', 'personal_fm/personal_fm_mode/recommend_songs/recommend_resource/login_refresh/digitalAlbum_detail 等私有化接口在未登录层返回 301/需登录错误；AUTH_ANON 表现各异（运行时样本为准）', 'raw 样本 301 各 case'],
  ['风控验证挑战', '剩余域', '-462（verifyId 1007602）在部分剩余接口的 AUTH_INVALID 层触发', 'raw 样本 *inv.* ERR-462'],
  ['模块级异常', '剩余域', '无 HTTP 状态的本地异常按 failed_stable 自动判定（终态由运行器证据推导）', 'remain-status.json 运行后细化'],
  ['本地工具', '剩余域', 'decrypt/eapi_decrypt/audio_match 为本地加密/指纹工具（无 request 调用），本域补测', 'raw 样本 local.*'],
]

runPhaseReport({
  phase: 6,
  specPath: path.join(__dirname, 'specs', 'p-remain.json'),
  statusMap: {},
  findings: FINDINGS,
  sectionNumbers: { manifest: 15, coverage: 14, failures: 8, diff: 6 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
})

const rawDir = path.join(args.rawDir, 'raw')
const byApi = {}
for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json'))) {
  const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
  if (!byApi[r.meta.apiAuditId]) byApi[r.meta.apiAuditId] = []
  byApi[r.meta.apiAuditId].push(r)
}

const invJsonPath = path.join(args.reportDir, '01-api-inventory.json')
const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
for (const rec of inv.inventory) {
  if (!remainStatus[rec.apiAuditId]) continue
  const st = finalizeStatus(rec.apiAuditId, byApi[rec.apiAuditId] || [])
  rec.terminalStatus = st.status
  rec.blocker = st.blocker
}
fs.writeFileSync(invJsonPath, JSON.stringify(inv, null, 2))
const { parseCsv, toCsvRow } = require('../lib/csv.js')
const csvPath = path.join(args.reportDir, '01-api-inventory.csv')
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
const header = rows[0]
const byId = new Map(inv.inventory.map((r) => [r.apiAuditId, r]))
const out = [header]
for (let i = 1; i < rows.length; i++) {
  const rec = byId.get(rows[i][0])
  out.push(rec ? header.map((h) => rec[h]) : rows[i])
}
fs.writeFileSync(csvPath, out.map(toCsvRow).join('\n') + '\n')
for (const id of Object.keys(remainStatus)) {
  const jsonPath = path.join(args.reportDir, 'endpoints', id + '.json')
  if (!fs.existsSync(jsonPath)) continue
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const st = finalizeStatus(id, byApi[id] || [])
  j.terminalStatus = st.status
  j.blocker = st.blocker
  fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
}
const unassigned = inv.inventory.filter((r) => !r.executedCaseCount && !r.terminalStatus)
if (unassigned.length) {
  console.error('APIs without status:', unassigned.map((r) => r.apiAuditId).join(', '))
  process.exit(1)
}
const bySt = {}
for (const rec of inv.inventory) {
  if (!rec.terminalStatus) continue
  bySt[rec.terminalStatus] = (bySt[rec.terminalStatus] || 0) + 1
}
console.log('remain report done; all APIs statused:', JSON.stringify(bySt))
