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
const fieldsLib = require('../lib/fields.js')

const rawDir = path.join(args.rawDir, 'raw')
const samplesDir = path.join(args.reportDir, 'samples-redacted')

const phase3Ids = [
  'ncm.song_detail', 'ncm.song_music_detail', 'ncm.lyric', 'ncm.lyric_new', 'ncm.check_music',
  'ncm.album_privilege', 'ncm.playlist_detail', 'ncm.playlist_track_all', 'ncm.playlist_detail_dynamic',
  'ncm.playlist_subscribers', 'ncm.album', 'ncm.album_detail', 'ncm.album_detail_dynamic',
  'ncm.artists', 'ncm.artist_detail', 'ncm.artist_detail_dynamic', 'ncm.artist_songs',
  'ncm.artist_top_song', 'ncm.artist_album', 'ncm.artist_desc', 'ncm.simi_artist',
  'ncm.simi_playlist', 'ncm.simi_song', 'ncm.related_playlist',
]

const BLOCKER_BASE = 'AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成'

const STATUS = {}
for (const id of phase3Ids) STATUS[id] = { status: 'partial', blocker: BLOCKER_BASE, note: '见 §15 运行记录与字段表' }

const FINDINGS = [
  ['风控验证挑战', '运行期激活', '多个接口在本次运行中触发 code -462（verifyType 40，verifyUrl st.music.163.com/encrypt-pages，blockText 请完成验证操作）：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0/不存在 等；与 Phase 2 同批接口对比，证明上游风控状态随请求特征动态变化', 'raw 样本 *.-462 各 case'],
  ['simi_artist', '登录要求', 'AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON（游客 cookie）→ 200。静态假设 none 需修正为 anon_or_user', 'simi_artist.none.001 / anon.001'],
  ['song_detail', '缺失必填', '空 ids → 502（上游 400 透传，无 message）；不存在的超大 id → 200（返回空 songs 数组而非错误）', 'song_detail.empty / nonexist'],
  ['album_detail', '资源状态', 'albumId:0（搜索产出）→ 404 "无专辑商品"（非全部专辑都有商品实体）；旧版 album（/api/album）同 ID → 200 带歌曲', 'album_detail.none.001 / album.none.001'],
  ['song_music_detail', '运行失败', 'songId:0 在全部登录层返回 code 400（无 message）——疑似接口需特定上下文或已变更，≥3 层一致，记为 failed 证据', 'song_music_detail.*'],
  ['playlist_detail / playlist_track_all / playlist_detail_dynamic', '无效资源', 'id=0 与不存在 id → 404 {"message":"歌单不存在"}（HTTP 404 + body code 404）', 'playlist_detail.id0 / playlist_track_all.id0'],
  ['artist_songs / artist_album / artist_top_song / artist_desc / artists / album / album_privilege', '无效资源', 'id=0 → 404（code 404，无 message 或 artist:null）', '*.id0.none.neg.001'],
  ['playlist_track_all', '边界', 'limit=0 → 200（空 tracks 数组，offset 切片语义：trackIds.slice(offset, offset+limit)）', 'playlist_track_all.limit0'],
  ['related_playlist', '实现形态', '非 API：直接抓取 music.163.com 网页 HTML 正则解析（GET https://music.163.com/playlist?id=），返回 code 200 与解析列表', 'related_playlist.none.001'],
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
  for (const id of phase3Ids) {
    const cases = byApi[id] || []
    const mdPath = path.join(endpointsDir, id + '.md')
    if (!fs.existsSync(mdPath)) continue
    const st = STATUS[id]
    let existing = fs.readFileSync(mdPath, 'utf8')
    const marker = existing.indexOf('\n## 15. Phase 3 运行记录')
    if (marker >= 0) existing = existing.slice(0, marker + 1)
    const md = []
    md.push('')
    md.push('## 15. Phase 3 运行记录（' + args.runId + '）')
    md.push('')
    md.push('- 终态：**' + st.status + '**（blocker: ' + st.blocker + '）')
    md.push('')
    md.push('| caseId | auth | status | code | durationMs | error |')
    md.push('| --- | --- | --- | --- | --- | --- |')
    for (const c of cases) {
      const errBody = c.error && c.error.body ? JSON.stringify(c.error.body).slice(0, 120) : (c.error ? c.error.class : '')
      md.push('| ' + c.meta.caseId + ' | ' + c.meta.auth + ' | ' + (c.error ? 'err(' + (c.error.status || '') + ')' : (c.meta.status || '-')) + ' | ' + (c.error ? (c.error.body && typeof c.error.body.code !== 'undefined' ? c.error.body.code : '-') : (c.body && typeof c.body.code !== 'undefined' ? c.body.code : '-')) + ' | ' + (c.meta.durationMs || '') + ' | ' + errBody.replace(/\|/g, '/') + ' |')
    }
    fs.writeFileSync(mdPath, existing + md.join('\n') + '\n')

    const jsonPath = path.join(endpointsDir, id + '.json')
    const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    j.matrix.executed = cases.length
    j.matrix.cases = cases.map((c) => ({
      caseId: c.meta.caseId, auth: c.meta.auth,
      status: c.error ? 'error' : (c.meta.status || null),
      code: c.error ? (c.error.body && typeof c.error.body.code !== 'undefined' ? c.error.body.code : null) : (c.body && typeof c.body.code !== 'undefined' ? c.body.code : null),
      error: c.error ? { class: c.error.class, status: c.error.status, body: c.error.body ? redact(c.error.body) : null, message: c.error.message } : null,
    }))
    j.terminalStatus = st.status
    j.blocker = st.blocker
    fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
  }

  const existingDict = fs.readFileSync(path.join(args.reportDir, '04-field-dictionary.csv'), 'utf8').split('\n').filter(Boolean)
  const seen = new Set(existingDict.slice(1).map((l) => l.split(',')[0] + '|' + l.split(',')[1]))
  const dictRows = []
  for (const id of phase3Ids) {
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
      dictRows.push([id, rec.jsonPath, rawType, '', 'observed', rec.presence, rec.presence, rec.nulls, rec.empties, rec.example === null ? '' : String(rec.example), '', [...rec.auths].join('|'), '', '', '', '', 'unknown', 'runtime-phase3', '', '', ''].join(','))
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

  fs.appendFileSync(path.join(args.reportDir, '07-multivariable-diff.md'), ['', '## 4. Phase 3 多变量差异（' + args.runId + '）', '', '| 接口 | 维度 | 结论 | 证据 |', '| --- | --- | --- | --- |', ...FINDINGS.map((f) => '| ' + f[0] + ' | ' + f[1] + ' | ' + f[2] + ' | ' + f[3] + ' |')].join('\n') + '\n')
  fs.appendFileSync(path.join(args.reportDir, '06-failures-and-blockers.md'), ['', '## 6. Phase 3 运行发现（' + args.runId + '）', '', ...FINDINGS.map((f) => '- **' + f[0] + '**（' + f[1] + '）：' + f[2] + '（' + f[3] + '）')].join('\n') + '\n')

  fs.appendFileSync(path.join(args.reportDir, '02-coverage-summary.md'), ['', '## 12. Phase 3 运行记录（' + args.runId + '）', '', '- 执行接口数：' + phase3Ids.length + '；总执行 case：' + phase3Ids.reduce((a, id) => a + (byApi[id] || []).length, 0) + '（全部线上，并发 1 + 抖动）', '- 终态：' + phase3Ids.length + ' 个 partial（blocker：AUTH_USER 缺失）', '- 风控：code -462 验证挑战在部分接口/参数组合触发（详见 06 §6）；无 429 限流', '- 夹具池：8 桶保持；playlist_detail/artists/artist_top_song 等补充 songId 候选（仍受每实体 100 上限约束）', '- 关键契约事实：见 07 §4'].join('\n') + '\n')
  fs.appendFileSync(path.join(args.reportDir, '00-RUN-MANIFEST.md'), ['', '## 13. Phase 3 运行记录（' + args.runId + '）', '', '- 线上请求数：' + phase3Ids.reduce((a, id) => a + (byApi[id] || []).length, 0) + '（含失败重跑取证，全部持久化错误响应体）', '- 风控状态变化：运行期出现 -462 验证挑战（verifyType 40），Phase 4 媒体请求须降低速率并观察', '- 日志修正：本次起错误响应（status/body/cookieCount）完整落盘'].join('\n') + '\n')

  console.log('phase3 report updated; phase3 cases:', phase3Ids.reduce((a, id) => a + (byApi[id] || []).length, 0), '| samples:', sampleManifest.length)
}

main()
