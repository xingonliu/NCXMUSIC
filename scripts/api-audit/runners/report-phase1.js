'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  rawDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  packageVersion: { type: 'string', required: true },
  sessionDir: { type: 'string', required: true },
  agentName: { type: 'string', default: 'opencode (DeepSeek 审计 Agent)' },
})

const { redact } = require('../lib/redact.js')
const { SessionStore } = require('../lib/session.js')

const rawDir = path.join(args.rawDir, 'raw')
const samplesDir = path.join(args.reportDir, 'samples-redacted')
const fieldsLib = require('../lib/fields.js')

const requestLog = []
const rawFiles = fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json')).sort()
for (const f of rawFiles) {
  const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
  requestLog.push({
    caseId: r.meta.caseId,
    apiAuditId: r.meta.apiAuditId,
    auth: r.meta.auth,
    status: r.error ? null : r.meta.status,
    code: r.error ? null : (r.body && typeof r.body.code !== 'undefined' ? r.body.code : null),
    durationMs: r.meta.durationMs,
    error: r.error || null,
  })
}
const logFile = path.join(args.rawDir, 'request-log', 'phase1.jsonl')
fs.writeFileSync(logFile, requestLog.map((x) => JSON.stringify(x)).join('\n') + '\n')

const fieldsAgg = {}
for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json'))) {
  const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
  if (!r.body || r.error) continue
  const id = r.meta.apiAuditId
  if (!fieldsAgg[id]) fieldsAgg[id] = new Map()
  const agg = fieldsAgg[id]
  const rows = fieldsLib.analyze(r.body, r.meta.caseId, r.meta.auth)
  for (const row of rows) {
    let rec = agg.get(row.jsonPath)
    if (!rec) {
      rec = { jsonPath: row.jsonPath, rawTypes: new Set(), presence: 0, nulls: 0, empties: 0, auths: new Set(), firstSeenCase: null, lastSeenCase: null, example: null }
      agg.set(row.jsonPath, rec)
    }
    rec.rawTypes.add(row.rawType)
    rec.presence++
    rec.auths.add(row.auth)
    if (!rec.firstSeenCase) rec.firstSeenCase = row.caseRef
    rec.lastSeenCase = row.caseRef
    if (row.empty) rec.empties++
    if (row.rawType === 'null') rec.nulls++
    if (row.value !== null && typeof row.value !== 'object' && !Array.isArray(row.value) && rec.example === null) rec.example = String(row.value).slice(0, 60)
  }
}
for (const [id, agg] of Object.entries(fieldsAgg)) {
  fieldsAgg[id] = [...agg.values()].map((r) => ({
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
fs.writeFileSync(path.join(args.rawDir, '03-fields-phase1.json'), JSON.stringify(fieldsAgg, null, 2))

const logByCase = new Map(requestLog.map((r) => [r.caseId, r]))
const store = new SessionStore(args.sessionDir)

const STATUS = {
  'ncm.inner_version': { status: 'passed', blocker: null, note: '本地常量返回（localOnly）；未登录/游客/无效 Cookie 与多余参数均返回同一结构，登录与参数维度不适用已取证' },
  'ncm.register_anonimous': { status: 'rate_limited', blocker: '匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试', note: '成功路径已验证（返回 code/userId/createTime/cookie），当前被上游风控' },
  'ncm.register_xeapikey': { status: 'failed_stable', blocker: '上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001）', note: '失败 ≥3 次且可复现；回退引导为绕过方案，非模块契约本身' },
  'ncm.login_status': { status: 'partial', blocker: 'AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本）', note: 'NONE×3 结构稳定；INVALID×2 与 NONE 结构完全一致（无效 Cookie 静默回退未登录，无失效错误）' },
  'ncm.user_account': { status: 'partial', blocker: 'AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号）', note: 'NONE×3 结构稳定；INVALID×2 与 NONE 结构完全一致' },
  'ncm.user_detail': { status: 'partial', blocker: '缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向', note: '缺 uid 返回 {"code":400,"message":"参数错误"}' },
  'ncm.logout': { status: 'partial', blocker: 'AUTH_USER 缺失；仅未登录/无效 Cookie 负向', note: '未登录与无效 Cookie 均返回 code 200（无会话也成功）' },
  'ncm.login_qr_key': { status: 'partial', blocker: '未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留', note: 'NONE×2 返回 unikey（UUID），两次轮换；unikey 已入脱敏名单' },
}

function firstLine(s) {
  return s.split('\n')[0]
}

function main() {
  const sampleManifest = []
  for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json'))) {
    const full = path.join(rawDir, f)
    const r = JSON.parse(fs.readFileSync(full, 'utf8'))
    const rawSha256 = require('crypto').createHash('sha256').update(fs.readFileSync(full)).digest('hex')
    const redacted = redact(r)
    const redactedFile = path.join(samplesDir, f.replace(/\.raw\.json$/, '.redacted.json'))
    fs.writeFileSync(redactedFile, JSON.stringify(redacted, null, 2))
    sampleManifest.push({
      caseId: r.meta.caseId,
      apiAuditId: r.meta.apiAuditId,
      auth: r.meta.auth,
      rawFile: path.relative(args.rawDir, full),
      rawSha256,
      redactedFile: path.relative(args.reportDir, redactedFile),
    })
  }
  fs.writeFileSync(path.join(args.reportDir, 'samples-manifest.json'), JSON.stringify({ runId: args.runId, samples: sampleManifest.sort((a, b) => a.caseId.localeCompare(b.caseId)) }, null, 2))

  const endpointsDir = path.join(args.reportDir, 'endpoints')
  const affected = new Set(requestLog.map((r) => r.apiAuditId))
  const caseRows = {}
  for (const r of requestLog) {
    const id = r.apiAuditId
    if (!caseRows[id]) caseRows[id] = []
    caseRows[id].push(r)
  }

  for (const id of affected) {
    const mdPath = path.join(endpointsDir, id + '.md')
    if (!fs.existsSync(mdPath)) continue
    const jsonPath = path.join(endpointsDir, id + '.json')
    const st = STATUS[id]
    const cases = caseRows[id] || []
    let existing = fs.readFileSync(mdPath, 'utf8')
    const marker = existing.indexOf('\n## 13. Phase 1 运行记录')
    if (marker >= 0) existing = existing.slice(0, marker + 1)
    const md = []
    md.push('')
    md.push('## 13. Phase 1 运行记录（' + args.runId + '）')
    md.push('')
    md.push('- 终态：**' + st.status + '**' + (st.blocker ? '（blocker: ' + st.blocker + '）' : ''))
    md.push('- 说明：' + st.note)
    md.push('')
    md.push('| caseId | auth | status | code | durationMs | note |')
    md.push('| --- | --- | --- | --- | --- | --- |')
    for (const c of cases) {
      md.push('| ' + c.caseId + ' | ' + c.auth + ' | ' + (c.status || 'err') + ' | ' + (c.code !== null ? c.code : '-') + ' | ' + (c.durationMs || '') + ' | ' + (c.error ? c.error.class + ': ' + c.error.message.slice(0, 60) : '') + ' |')
    }
    const fields = fieldsAgg[id]
    if (fields && fields.length) {
      md.push('')
      md.push('### 13.1 运行字段表（Phase 1）')
      md.push('')
      md.push('| JSONPath | rawType | presence | null | empty | auths | example |')
      md.push('| --- | --- | --- | --- | --- | --- | --- |')
      for (const f of fields) {
        md.push('| `' + f.jsonPath + '` | ' + f.rawType + ' | ' + f.presence + ' | ' + f.nulls + ' | ' + f.empties + ' | ' + f.auths.join(',') + ' | ' + (f.example === null ? '' : '`' + String(f.example).replace(/`/g, '').slice(0, 40) + '`') + ' |')
      }
    }
    fs.writeFileSync(mdPath, existing + md.join('\n') + '\n')

    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    j.matrix.executed = cases.length
    j.matrix.cases = cases.map((c) => ({ caseId: c.caseId, auth: c.auth, status: c.status, code: c.code, durationMs: c.durationMs, error: c.error || null }))
    j.fields = (fields || []).map((f) => ({ jsonPath: f.jsonPath, rawType: f.rawType, presenceCount: f.presence, sampleCount: f.presence, nullCount: f.nulls, emptyCount: f.empties, authConditions: f.auths, exampleRedacted: f.example, sourceEvidence: 'runtime-phase1', semanticName: '', semanticConfidence: 'unknown', conflictId: id === 'ncm.register_xeapikey' ? 'XEAPI-001' : null }))
    j.terminalStatus = st.status
    j.blocker = st.blocker
    j.evidence = cases.map((c) => ({ caseId: c.caseId, sampleHash: null, rawFile: 'raw/' + id + '.' + c.caseId + '.raw.json' }))
    j.conflictIds = id === 'ncm.register_xeapikey' ? ['XEAPI-001'] : j.conflictIds
    fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
  }

  const dictRows = []
  for (const [id, fields] of Object.entries(fieldsAgg)) {
    for (const f of fields) {
      dictRows.push([id, f.jsonPath, f.rawType, '', 'observed', f.presence, f.presence, f.nulls, f.empties, f.example === null ? '' : String(f.example).slice(0, 40), '', f.auths.join('|'), '', '', '', '', 'unknown', 'runtime-phase1', '', '', ''].join(','))
    }
  }
  fs.appendFileSync(path.join(args.reportDir, '04-field-dictionary.csv'), dictRows.sort().join('\n') + '\n')

  const cov = []
  cov.push('')
  cov.push('## 10. Phase 1 运行记录（' + args.runId + '）')
  cov.push('')
  cov.push('| apiAuditId | 执行 case | 终态 | blocker |')
  cov.push('| --- | --- | --- | --- |')
  for (const [id, st] of Object.entries(STATUS)) {
    cov.push('| ' + id + ' | ' + (caseRows[id] || []).length + ' | ' + st.status + ' | ' + (st.blocker || '-') + ' |')
  }
  cov.push('')
  cov.push('- 请求节奏：并发 1，抖动 350–800ms；' + requestLog.length + ' 次执行（本地 ' + requestLog.filter((r) => !r.durationMs).length + '，线上 ' + requestLog.filter((r) => r.durationMs).length + '）')
  cov.push('- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited')
  cov.push('- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）')
  cov.push('- 样本：' + sampleManifest.length + ' 个 raw + redacted（samples-manifest.json）')
  fs.appendFileSync(path.join(args.reportDir, '02-coverage-summary.md'), cov.join('\n'))

  const diff = []
  diff.push('')
  diff.push('## 2. Phase 1 多变量差异（' + args.runId + '）')
  diff.push('')
  diff.push('| 接口 | 维度 | 结论 | 证据 |')
  diff.push('| --- | --- | --- | --- |')
  diff.push('| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |')
  diff.push('| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |')
  diff.push('| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |')
  diff.push('| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |')
  diff.push('| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |')
  diff.push('| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |')
  fs.appendFileSync(path.join(args.reportDir, '07-multivariable-diff.md'), diff.join('\n'))

  const block = []
  block.push('')
  block.push('## 4. Phase 1 运行发现（' + args.runId + '）')
  block.push('')
  block.push('### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）')
  block.push('')
  block.push('- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。')
  block.push('- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。')
  block.push('- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。')
  block.push('- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。')
  block.push('- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。')
  block.push('')
  block.push('### B-005 register_anonimous 被风控（rate_limited）')
  block.push('')
  block.push('- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。')
  block.push('- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。')
  block.push('- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。')
  block.push('')
  block.push('### B-006 无效 Cookie 行为确认（契约事实）')
  block.push('')
  block.push('- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。')
  fs.appendFileSync(path.join(args.reportDir, '06-failures-and-blockers.md'), block.join('\n'))

  const guest = store.describe('guest-01')
  const man = []
  man.push('')
  man.push('## 11. Phase 1 运行记录（' + args.runId + '）')
  man.push('')
  man.push('- 执行 Agent：' + args.agentName)
  man.push('- 线上请求数：' + requestLog.filter((r) => r.durationMs).length + '（并发 1，抖动 350–800ms）')
  man.push('- guest-01 游客会话：' + (guest ? '已建立（sha256 ' + guest.sha256.slice(0, 12) + '…）' : '**未建立（register_anonimous 被风控，见 B-005）**'))
  man.push('- xeapi 密钥引导：' + (require('fs').existsSync(require('os').tmpdir() + '/xeapi_public_key') ? '已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）' : '未建立'))
  man.push('- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400')
  fs.appendFileSync(path.join(args.reportDir, '00-RUN-MANIFEST.md'), man.join('\n'))

  const invJsonPath = path.join(args.reportDir, '01-api-inventory.json')
  const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
  for (const rec of inv.inventory) {
    const st = STATUS[rec.apiAuditId]
    if (!st) continue
    rec.terminalStatus = st.status
    rec.blocker = st.blocker
    rec.executedCaseCount = (caseRows[rec.apiAuditId] || []).length
  }
  fs.writeFileSync(invJsonPath, JSON.stringify(inv, null, 2))
  const csvPath = path.join(args.reportDir, '01-api-inventory.csv')
  const csvLines = fs.readFileSync(csvPath, 'utf8').split('\n')
  const header = csvLines[0].split(',')
  const idx = {}
  header.forEach((h, i) => { idx[h] = i })
  function esc(v) {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const byId = new Map(inv.inventory.map((r) => [r.apiAuditId, r]))
  const out = [csvLines[0]]
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i]
    if (!line.trim()) continue
    const rec = byId.get(line.split(',')[0])
    if (!rec) { out.push(line); continue }
    const cells = []
    header.forEach((h) => { cells.push(esc(rec[h])) })
    out.push(cells.join(','))
  }
  fs.writeFileSync(csvPath, out.join('\n') + '\n')
  console.log('inventory updated')

  console.log('phase1 report updated; samples:', sampleManifest.length)
}

main()
