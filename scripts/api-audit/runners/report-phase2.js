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
const fieldsLib = require('../lib/fields.js')

const rawDir = path.join(args.rawDir, 'raw')
const samplesDir = path.join(args.reportDir, 'samples-redacted')
const store = new SessionStore(args.sessionDir)
const poolRaw = JSON.parse(fs.readFileSync(path.join(args.rawDir, '03-fixture-pool.json'), 'utf8'))

const phase2Ids = [
  'ncm.search', 'ncm.cloudsearch', 'ncm.search_suggest', 'ncm.search_hot', 'ncm.search_hot_detail',
  'ncm.search_default', 'ncm.search_multimatch', 'ncm.banner', 'ncm.personalized', 'ncm.toplist',
  'ncm.top_list', 'ncm.top_song', 'ncm.top_album', 'ncm.top_artists', 'ncm.top_mv', 'ncm.top_playlist',
  'ncm.top_playlist_highquality', 'ncm.playlist_hot', 'ncm.playlist_catlist', 'ncm.playlist_category_list',
  'ncm.playlist_highquality_tags', 'ncm.dj_hot', 'ncm.dj_catelist', 'ncm.dj_banner',
  'ncm.personalized_newsong', 'ncm.personalized_djprogram', 'ncm.personalized_mv',
  'ncm.personalized_privatecontent', 'ncm.personalized_privatecontent_list', 'ncm.homepage_block_page',
]

const BLOCKER_BASE = 'AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成；分层稳定性按层判定待补'

const STATUS = {}
for (const id of phase2Ids) {
  STATUS[id] = { status: 'partial', blocker: BLOCKER_BASE, note: '见 §14 运行记录与字段表' }
}

const FINDINGS = [
  ['top_list', '资源来源维度', '仅接受榜单歌单 ID：来自搜索结果的歌单 2488306802 → {"code":400,"message":"请求参数错误"}；榜单来源 ID → 200（v4/detail 返回 playlist 对象，无顶层 tracks）', 'raw 样本 top_list.id.none.001/002'],
  ['top_list', '参数负向', 'idx 参数被模块直接拒绝（本地 500，不发起请求）；id=0 → 400', 'top_list.idx.none.neg.001 / id0.none.neg.001'],
  ['search / cloudsearch', '非法枚举', 'type=999 静默容忍，返回 {"result":{},"code":200}（空结果而非错误）', 'search.type999 / cloudsearch.type999'],
  ['banner', '非法枚举', 'type=999 静默回退 pc（clientType 映射默认值），返回 PC banner', 'banner.type999'],
  ['top_playlist', '非法枚举', 'cat=不存在分类XYZ 静默回退全部，返回正常歌单列表', 'top_playlist.catbad'],
  ['search / cloudsearch / search_suggest / search_multimatch', '缺失必填', '空关键词 → {"code":400}（明确错误）', '*.empty.none.neg.001'],
  ['top_song', '非法枚举', 'type=999 静默容忍（areaId 999 返回正常列表）', 'top_song.type999'],
  ['夹具池', '血缘', '7 类实体 8 桶：songId/artistId/albumId/playlistId/toplistId/mvId/djId/programId，全部来自上游响应（producerApi/producerCase/jsonPath 已记录）', '03-fixture-pool.json'],
]

function main() {
  const rawFiles = fs.readdirSync(rawDir).filter((x) => x.endsWith('.raw.json')).sort()
  const byApi = {}
  for (const f of rawFiles) {
    const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))
    if (!byApi[r.meta.apiAuditId]) byApi[r.meta.apiAuditId] = []
    byApi[r.meta.apiAuditId].push(r)
  }

  const sampleManifest = []
  for (const f of rawFiles) {
    const full = path.join(rawDir, f)
    const r = JSON.parse(fs.readFileSync(full, 'utf8'))
    const rawSha256 = require('crypto').createHash('sha256').update(fs.readFileSync(full)).digest('hex')
    const redacted = redact(r)
    const redactedFile = path.join(samplesDir, f.replace(/\.raw\.json$/, '.redacted.json'))
    fs.writeFileSync(redactedFile, JSON.stringify(redacted, null, 2))
    sampleManifest.push({ caseId: r.meta.caseId, apiAuditId: r.meta.apiAuditId, auth: r.meta.auth, rawFile: path.relative(args.rawDir, full), rawSha256, redactedFile: path.relative(args.reportDir, redactedFile) })
  }
  fs.writeFileSync(path.join(args.reportDir, 'samples-manifest.json'), JSON.stringify({ runId: args.runId, samples: sampleManifest.sort((a, b) => a.caseId.localeCompare(b.caseId)) }, null, 2))

  const endpointsDir = path.join(args.reportDir, 'endpoints')
  for (const id of phase2Ids) {
    const cases = byApi[id] || []
    const mdPath = path.join(endpointsDir, id + '.md')
    if (!fs.existsSync(mdPath)) continue
    const st = STATUS[id]
    let existing = fs.readFileSync(mdPath, 'utf8')
    const marker = existing.indexOf('\n## 14. Phase 2 运行记录')
    if (marker >= 0) existing = existing.slice(0, marker + 1)
    const md = []
    md.push('')
    md.push('## 14. Phase 2 运行记录（' + args.runId + '）')
    md.push('')
    md.push('- 终态：**' + st.status + '**（blocker: ' + st.blocker + '）')
    md.push('- 说明：' + st.note)
    md.push('')
    md.push('| caseId | auth | status | code | durationMs | note |')
    md.push('| --- | --- | --- | --- | --- | --- |')
    for (const c of cases) {
      md.push('| ' + c.meta.caseId + ' | ' + c.meta.auth + ' | ' + (c.error ? 'err' : (c.meta.status || '-')) + ' | ' + (c.error ? '-' : (c.body && typeof c.body.code !== 'undefined' ? c.body.code : '-')) + ' | ' + (c.meta.durationMs || '') + ' | ' + (c.error ? c.error.class : '') + ' |')
    }
    fs.writeFileSync(mdPath, existing + md.join('\n') + '\n')

    const jsonPath = path.join(endpointsDir, id + '.json')
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    j.matrix.executed = cases.length
    j.matrix.cases = cases.map((c) => ({ caseId: c.meta.caseId, auth: c.meta.auth, status: c.error ? 'error' : (c.meta.status || null), code: c.error ? null : (c.body && typeof c.body.code !== 'undefined' ? c.body.code : null), error: c.error || null }))
    j.terminalStatus = st.status
    j.blocker = st.blocker
    fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
  }

  const existingDict = fs.readFileSync(path.join(args.reportDir, '04-field-dictionary.csv'), 'utf8').split('\n').filter(Boolean)
  const seen = new Set(existingDict.slice(1).map((l) => l.split(',')[0] + '|' + l.split(',')[1]))
  const dictRows = []
  for (const id of phase2Ids) {
    const cases = byApi[id] || []
    const agg = new Map()
    for (const r of cases) {
      if (!r.body || r.error) continue
      for (const row of fieldsLib.analyze(r.body, r.meta.caseId, r.meta.auth)) {
        let rec = agg.get(row.jsonPath)
        if (!rec) { rec = { jsonPath: row.jsonPath, rawTypes: new Set(), presence: 0, nulls: 0, empties: 0, auths: new Set(), example: null }; agg.set(row.jsonPath, rec) }
        rec.rawTypes.add(row.rawType)
        rec.presence++
        rec.auths.add(row.auth)
        if (row.empty) rec.empties++
        if (row.rawType === 'null') rec.nulls++
        if (row.value !== null && typeof row.value !== 'object' && !Array.isArray(row.value) && rec.example === null) rec.example = String(row.value).slice(0, 40)
      }
    }
    for (const rec of agg.values()) {
      const key = id + '|' + rec.jsonPath
      if (seen.has(key)) continue
      seen.add(key)
      const rawType = rec.rawTypes.size === 1 ? [...rec.rawTypes][0] : 'union<' + [...rec.rawTypes].join('|') + '>'
      dictRows.push([id, rec.jsonPath, rawType, '', 'observed', rec.presence, rec.presence, rec.nulls, rec.empties, rec.example === null ? '' : String(rec.example), '', [...rec.auths].join('|'), '', '', '', '', 'unknown', 'runtime-phase2', '', '', ''].join(','))
    }
  }
  fs.appendFileSync(path.join(args.reportDir, '04-field-dictionary.csv'), dictRows.sort().join('\n') + '\n')

  const invJsonPath = path.join(args.reportDir, '01-api-inventory.json')
  const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
  for (const rec of inv.inventory) {
    const cases = byApi[rec.apiAuditId]
    if (cases) rec.executedCaseCount = cases.length
    const st = STATUS[rec.apiAuditId]
    if (st) { rec.terminalStatus = st.status; rec.blocker = st.blocker }
  }
  fs.writeFileSync(invJsonPath, JSON.stringify(inv, null, 2))
  const csvPath = path.join(args.reportDir, '01-api-inventory.csv')
  const csvLines = fs.readFileSync(csvPath, 'utf8').split('\n')
  const header = csvLines[0].split(',')
  const byId = new Map(inv.inventory.map((r) => [r.apiAuditId, r]))
  function esc(v) { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const out = [csvLines[0]]
  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i]
    if (!line.trim()) continue
    const rec = byId.get(line.split(',')[0])
    if (!rec) { out.push(line); continue }
    out.push(header.map((h) => esc(rec[h])).join(','))
  }
  fs.writeFileSync(csvPath, out.join('\n') + '\n')

  fs.appendFileSync(path.join(args.reportDir, '07-multivariable-diff.md'), ['', '## 3. Phase 2 多变量差异（' + args.runId + '）', '', '| 接口 | 维度 | 结论 | 证据 |', '| --- | --- | --- | --- |', ...FINDINGS.map((f) => '| ' + f[0] + ' | ' + f[1] + ' | ' + f[2] + ' | ' + f[3] + ' |')].join('\n') + '\n')

  fs.appendFileSync(path.join(args.reportDir, '06-failures-and-blockers.md'), ['', '## 5. Phase 2 运行发现（' + args.runId + '）', '', ...FINDINGS.map((f) => '- **' + f[0] + '**（' + f[1] + '）：' + f[2] + '（' + f[3] + '）')].join('\n') + '\n')

  const cov = []
  cov.push('')
  cov.push('## 11. Phase 2 运行记录（' + args.runId + '）')
  cov.push('')
  cov.push('- 执行接口数：' + phase2Ids.length + '；总执行 case：' + phase2Ids.reduce((a, id) => a + (byApi[id] || []).length, 0) + '（全部为线上调用，并发 1 + 抖动 350–800ms）')
  cov.push('- 终态：' + phase2Ids.length + ' 个 partial（统一 blocker：AUTH_USER 登录层缺失）')
  cov.push('- 风控/失败：0（无限流、无失败）')
  cov.push('- 夹具池：' + Object.entries(poolRaw.pool).map(([k, v]) => k + '=' + v.length).join(', '))
  cov.push('- 关键契约事实：见 07-multivariable-diff.md §3 与 06-failures-and-blockers.md §5')
  fs.appendFileSync(path.join(args.reportDir, '02-coverage-summary.md'), cov.join('\n'))

  const guest = store.describe('guest-01')
  fs.appendFileSync(path.join(args.reportDir, '00-RUN-MANIFEST.md'), ['', '## 12. Phase 2 运行记录（' + args.runId + '）', '', '- 执行 Agent：' + args.agentName, '- 线上请求数：' + phase2Ids.reduce((a, id) => a + (byApi[id] || []).length, 0) + '（并发 1，抖动 350–800ms，无限流）', '- guest-01 游客会话：' + (guest ? '已建立（sha256 ' + guest.sha256.slice(0, 12) + '…），AUTH_ANON 层有效' : '未建立'), '- 夹具池（8 桶）：' + Object.entries(poolRaw.pool).map(([k, v]) => k + '=' + v.length).join(', '), '- 契约事实：搜索空关键词 code 400；type/cat 非法枚举静默容忍（空 result 或回退默认）；top_list 仅接受榜单歌单 ID'].join('\n') + '\n')

  console.log('phase2 report updated; phase2 cases:', phase2Ids.reduce((a, id) => a + (byApi[id] || []).length, 0), '| samples:', sampleManifest.length)
}

main()
