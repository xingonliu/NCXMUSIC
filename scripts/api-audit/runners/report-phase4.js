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

const STATUS = {
  'ncm.song_url_v1': { status: 'partial', blocker: 'AUTH_VIP/PURCHASED 缺失（音质矩阵 VIP 行 blocked_by_prerequisite）；INVALID 层部分被 -462 阻断；enhanced 配置缺失（B-003）' },
  'ncm.song_url': { status: 'partial', blocker: '同上；多数 NONE/INVALID 样本被 -462 阻断' },
  'ncm.song_url_v1_302': { status: 'partial', blocker: '全部样本被 -462 验证挑战阻断，无成功样本；需风控冷却后补测' },
  'ncm.song_download_url': { status: 'partial', blocker: 'ANON 成功样本仅证明未购付费歌 → code -105；AUTH_VIP/PURCHASED 缺失' },
  'ncm.song_download_url_v1': { status: 'partial', blocker: '同上' },
  'ncm.mv_url': { status: 'partial', blocker: 'INVALID 层被 -462 阻断；VIP/已购层缺失' },
  'ncm.song_detail': { status: 'partial', blocker: 'AUTH_USER 登录层缺失（B-002）；Phase 4 增补 3 个媒体夹具标签样本' },
  'ncm.video_url': { status: 'blocked_by_prerequisite', blocker: '无 videoId 夹具（Phase 2 视频搜索未产出；待视频域发现后补测）' },
}

function qualityMatrix(rawDir) {
  const rows = []
  const songLabel = {}
  const d = rawDir
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.raw.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))
    if (!r.body || r.error) continue
    if (r.meta.caseId.includes('media-fixture')) {
      const s = r.body.songs && r.body.songs[0]
      songLabel[r.meta.params.ids] = s ? s.name + '（' + (s.ar || []).map((a) => a.name).join('/') + '，fee=' + s.fee + '）' : '?'
    }
  }
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.raw.json') && x.includes('song_url_v1.') && !x.includes('302'))) {
    const r = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))
    const c = r.meta.caseId.split('.')
    const song = c[3] === 'A' ? 'A:光年之外(fee1)' : c[3] === 'B' ? 'B:Kapitel8(fee0)' : c[3]
    const lvl = c[4]
    const auth = c[5]
    if (r.error) {
      rows.push([song, lvl, auth, 'ERR-' + (r.error.body && r.error.body.code !== undefined ? r.error.body.code : r.error.class), '', '', ''])
      continue
    }
    const it = (r.body.data && r.body.data[0]) || {}
    const ft = it.freeTrialInfo
    rows.push([song, lvl, auth, it.url ? 'URL' : 'null', it.br, it.fee + '/' + it.payed, ft ? '试听' + (ft.end || 0) + 's(f' + ft.fragmentType + ')' : '-', it.level || '-'])
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2].localeCompare(b[2]))
  return rows
}

const matrix = qualityMatrix(path.join(args.rawDir, 'raw'))

const covExtra = []
covExtra.push('')
covExtra.push('### 13.1 音质矩阵（song_url_v1，canonical）')
covExtra.push('')
covExtra.push('| 歌曲 | level | auth | url | br | fee/payed | 试听 | 实际level |')
covExtra.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const r of matrix) covExtra.push('| ' + r.join(' | ') + ' |')
covExtra.push('')
covExtra.push('- 歌A（光年之外，fee=1）：全部 9 档请求均返回 128k mp3 试听 URL（level 请求被忽略/降级），freeTrial 30s；ANON 层 freeTrialInfo.fragmentType=6、NONE 层=-1（游客 cookie 改变试听元数据形态）')
covExtra.push('- 歌B（免费，fee=0）：lossless/hires 等高档返回 320k mp3（非 flac 容器），higher→192k，standard→128k')

const probes = JSON.parse(fs.readFileSync(path.join(args.rawDir, 'media-probes', 'summary.json'), 'utf8'))
const probeMedia = probes.results.filter((r) => /music\.126\.net|vod\.126\.net/.test(r.urlShape || ''))

const FINDINGS = [
  ['song_url_v1', '音质矩阵', '付费歌 9 档（standard~jymaster）未登录/游客均返回同一 128k mp3 试听 URL（br=128012，freeTrial 30s，level 降级）；免费歌 lossless→320k mp3、higher→192k、standard→128k；高音质真档需 AUTH_VIP（blocked_by_prerequisite）', '§13.1 矩阵 + raw 样本'],
  ['song_url_v1', '试听元数据', 'NONE 层 freeTrialInfo.fragmentType=-1，ANON（游客 cookie）层=6；end=30s；fragSource=default', 'song_url_v1.A.*.none/anon'],
  ['song_url（旧版）/ song_download_url(_v1)', '付费下载', '未购付费歌 download → data.code=-105（url null），freeTrialPrivilege.cannotListenReason=1；试听与下载分离', 'song_download_url*.A.anon.001'],
  ['风控验证挑战', '运行期', '-462（verifyId 1007602）覆盖多数媒体接口的 NONE/INVALID 层：song_url_v1.302 全部、song_url 多数、song_download_url* NONE、mv_url INVALID；ANON 层多数成功', 'raw 样本 ERR-462'],
  ['媒体 URL', '生命周期', 'expi=1200s（歌曲）/3600s（MV）；签发后约 30 分钟探测（超出 expi 窗口）HEAD 仍 200 且 content-length 一致——到期语义非硬拒绝（或 CDN 宽限），完整下载验证未执行（§12.2 仅小范围探测）', 'media-probes/summary.json'],
  ['媒体 URL', '形态', 'm*.music.126.net/jd-musicrep-ts 带 vuutv 签名 query；MV 为 vod.126.net 带 wsSecret/wsTime；报告仅保留 origin+path+hash', 'media-probes/summary.json'],
  ['MV', '可播放性', 'mv_url 返回 1080p mp4（r=1080，约 79MB，audio/video 200 HEAD，Range 支持），fee=0', 'mv_url.none/anon.001 + probes'],
  ['video_url', '夹具缺口', '无 videoId 夹具（视频域发现未完成），blocked_by_prerequisite', '03-fixture-pool.json'],
  ['enhanced 配置', '网络分层', 'unblock=true 未执行（B-003 enhanced 缺失）；canonical 样本单独统计', '00-RUN-MANIFEST §10'],
]

const manifestExtra = [
  '## 14. Phase 4 运行记录（' + args.runId + '）',
  '',
  '- 执行 Agent：' + args.agentName,
  '- 线上请求数：56（并发 1，抖动 350–800ms；-462 挑战退避 30s/次）',
  '- 媒体探测：39 个唯一 URL（含 33 个音频/视频 CDN URL），HEAD 全 200（探测在签发窗口后执行）',
  '- 风控：-462 验证挑战大面积覆盖媒体接口 NONE/INVALID 层（verifyId 1007602）；ANON 层多数成功',
  '- enhanced：未执行（B-003）；AUTH_VIP/PURCHASED：缺失（音质矩阵 VIP 行 blocked_by_prerequisite）',
]

runPhaseReport({
  phase: 4,
  specPath: path.join(__dirname, 'specs', 'phase4.json'),
  statusMap: STATUS,
  findings: FINDINGS,
  sectionNumbers: { manifest: 14, coverage: 13, failures: 7, diff: 5 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
  coverageExtra: covExtra,
  manifestExtra: manifestExtra.join('\n'),
})

const invJsonPath = path.join(args.reportDir, '01-api-inventory.json')
const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
for (const rec of inv.inventory) {
  const st = STATUS[rec.apiAuditId]
  if (st) { rec.terminalStatus = st.status; rec.blocker = st.blocker }
}
fs.writeFileSync(invJsonPath, JSON.stringify(inv, null, 2))
for (const id of Object.keys(STATUS)) {
  const jsonPath = path.join(args.reportDir, 'endpoints', id + '.json')
  if (!fs.existsSync(jsonPath)) continue
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const st = STATUS[id]
  j.terminalStatus = st.status
  j.blocker = st.blocker
  fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
}
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
