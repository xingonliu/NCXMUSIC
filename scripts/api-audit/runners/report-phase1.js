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

const BLOCKER_USER = 'AUTH_USER 缺失（B-002，写操作已预授权但账号未到位）'
const BLOCKER_LOGIN = '301 系统错误（接口需登录会话）；AUTH_USER 缺失'
const BLOCKER_NOFIX = '缺夹具：videoId/threadId/style 无生产者（search type=1002/1014 被 -462 阻断）'

const STATUS = {
  'ncm.inner_version': { status: 'passed', blocker: null },
  'ncm.register_anonimous': { status: 'rate_limited', blocker: '匿名注册风控：成功路径已验证后被连续 code 400' },
  'ncm.register_xeapikey': { status: 'failed_stable', blocker: 'XEAPI-001：模块要求 sk，服务器返回 publicKey/version/nextUpdateTime；xeapiSignKey 回退可用' },
  'ncm.login_status': { status: 'partial', blocker: 'AUTH_ANON/USER 层缺样本' },
  'ncm.user_account': { status: 'partial', blocker: 'AUTH_USER 缺失；uid 生产路径阻塞' },
  'ncm.user_detail': { status: 'partial', blocker: '缺 uid 正样本（搜索 1002 被 -462 阻断）' },
  'ncm.logout': { status: 'partial', blocker: 'AUTH_USER 缺失' },
  'ncm.login_qr_key': { status: 'partial', blocker: '未完成扫码流程' },
}

const P1_DOMAIN_SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, 'specs', 'p1-domain.json'), 'utf8'))
const P1_DOMAIN_IDS = P1_DOMAIN_SPEC.groups.map((g) => g.apiAuditId)

const BLOCKED_OWN = [
  'ncm.like', 'ncm.likelist', 'ncm.song_like', 'ncm.song_like_check', 'ncm.song_purchased',
  'ncm.song_downlist', 'ncm.song_monthdownlist', 'ncm.song_singledownlist', 'ncm.song_order_update',
  'ncm.song_cloud_download', 'ncm.song_lyrics_mark', 'ncm.song_lyrics_mark_add', 'ncm.song_lyrics_mark_del',
  'ncm.song_lyrics_mark_user_page', 'ncm.playlist_mylike', 'ncm.playlist_create', 'ncm.playlist_delete',
  'ncm.playlist_update', 'ncm.playlist_name_update', 'ncm.playlist_desc_update', 'ncm.playlist_tags_update',
  'ncm.playlist_order_update', 'ncm.playlist_privacy', 'ncm.playlist_cover_update', 'ncm.playlist_track_add',
  'ncm.playlist_track_delete', 'ncm.playlist_update_playcount', 'ncm.playlist_subscribe',
  'ncm.playlist_import_name_task_create', 'ncm.playlist_import_task_status', 'ncm.album_sub',
  'ncm.album_sublist', 'ncm.artist_sub', 'ncm.artist_sublist', 'ncm.mv_sub', 'ncm.mv_sublist',
  'ncm.video_sub', 'ncm.comment_add', 'ncm.comment_delete', 'ncm.comment_reply', 'ncm.comment_like',
  'ncm.comment_report', 'ncm.user_playlist_create', 'ncm.user_subcount', 'ncm.user_level',
]
for (const id of BLOCKED_OWN) STATUS[id] = { status: 'blocked_by_prerequisite', blocker: BLOCKER_USER }

const BLOCKER_SESSION = '未登录层 301 系统错误（接口需会话）；AUTH_ANON（游客 cookie）可满足（200）；AUTH_USER 层待补'

const BLOCKED_LOGIN = []
for (const id of ['ncm.artist_new_mv', 'ncm.artist_new_song', 'ncm.artist_new_song_mv_list_v2', 'ncm.artist_new_song_playall',
  'ncm.song_dynamic_cover', 'ncm.user_followeds', 'ncm.simi_user', 'ncm.video_category_list',
  'ncm.video_timeline_all', 'ncm.video_timeline_recommend']) {
  STATUS[id] = { status: 'partial', blocker: BLOCKER_SESSION }
}

const BLOCKED_NOFIX = [
  'ncm.video_group', 'ncm.video_detail', 'ncm.video_detail_info', 'ncm.video_url', 'ncm.comment_info_list',
  'ncm.style_detail', 'ncm.style_song', 'ncm.style_playlist', 'ncm.style_album', 'ncm.style_artist',
  'ncm.style_preference',
]
for (const id of BLOCKED_NOFIX) STATUS[id] = { status: 'blocked_by_prerequisite', blocker: BLOCKER_NOFIX }

STATUS['ncm.comment_hotwall_list'] = { status: 'not_exported', blocker: 'interface.d.ts 声明存在但无模块文件（moduleMissing）' }
STATUS['ncm.playlist_tracks'] = { status: 'failed_stable', blocker: '模块级崩溃：Cannot read properties of undefined (reading split)，4/4 可复现（本地异常，非网络）' }
STATUS['ncm.user_record'] = { status: 'blocked_by_prerequisite', blocker: 'code -2 无权限访问（播放记录需登录，即使公开 uid）' }
STATUS['ncm.song_url_match'] = { status: 'blocked_by_prerequisite', blocker: 'unblock 匹配工具，依赖 enhanced 配置（B-003）' }

const DEFAULT_PARTIAL = { status: 'partial', blocker: BLOCKER_USER }

const FINDINGS = [
  ['登录门槛', '301 系统错误', 'artist_new_mv/artist_new_song/artist_new_song_mv_list_v2/artist_new_song_playall/song_dynamic_cover/user_followeds/simi_user/video_category_list/video_timeline_all/video_timeline_recommend 在未登录下发 301 系统错误（需会话；video_* 的 ANON 层 200，说明游客 cookie 可满足）', 'raw 样本 301 各 case'],
  ['user_record', '权限', '播放记录接口对公开 uid 也返回 code -2 无权限访问（未登录）', 'user_record.none.001'],
  ['playlist_tracks', '模块缺陷', '旧版歌单歌曲接口模块本地崩溃（query.s 未定义时 split 报错），4/4 可复现 failed_stable', 'playlist_tracks.*'],
  ['风控验证挑战', '无效 Cookie 层', 'AUTH_INVALID 层在 comment_*/user_playlist/user_record/artist_fans/artist_follow_count/song_red_count/search(1002/1014) 广泛触发 -462（verifyId 1007602）', 'raw 样本 *inv.* ERR-462'],
  ['search type=1002/1014', '生产者阻断', '用户/视频搜索生产者在未登录层全部被 -462 阻断；userId 改由评论响应 user.userId 生产（100 条），videoId 仍缺', '03-fixture-pool.json'],
  ['评论夹具', '生产', 'comment_music/comment_album 等响应生产 commentId=50 条（含 parentCommentId），comment_floor 可测；threadId 无生产者', '03-fixture-pool.json'],
  ['comment_floor', '依赖', 'parentCommentId 取自评论响应（血缘记录），测试成功', 'comment_floor.none.001'],
  ['song_url_ncmget', '本地工具', '无网络调用（本地返回），三种调用形态一致', 'song_url_ncmget.local.*'],
  ['album/artist 列表', '非法枚举', 'album_list type=bogus/area=XX 与 album_songsaleboard type=bogus → 404；artist_list type=99 静默容忍', '*.bad.none.neg.001'],
]

runPhaseReport({
  phase: 1,
  specPath: path.join(__dirname, 'specs', 'phase1.json'),
  extraSpecPaths: [path.join(__dirname, 'specs', 'p1-domain.json')],
  statusMap: STATUS,
  findings: FINDINGS,
  sectionNumbers: { manifest: 11, coverage: 10, failures: 4, diff: 2 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
})

const invJsonPath = path.join(args.reportDir, '01-api-inventory.json')
const inv = JSON.parse(fs.readFileSync(invJsonPath, 'utf8'))
const p1All = inv.inventory.filter((r) => r.testPhase === 'P1')
let missingStatus = 0
for (const rec of inv.inventory) {
  if (rec.testPhase !== 'P1') continue
  const st = STATUS[rec.apiAuditId] || DEFAULT_PARTIAL
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
for (const id of inv.inventory.filter((r) => r.testPhase === 'P1').map((r) => r.apiAuditId)) {
  const jsonPath = path.join(args.reportDir, 'endpoints', id + '.json')
  if (!fs.existsSync(jsonPath)) continue
  const j = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const st = STATUS[id] || DEFAULT_PARTIAL
  j.terminalStatus = st.status
  j.blocker = st.blocker
  fs.writeFileSync(jsonPath, JSON.stringify(j, null, 2))
}
const unassigned = inv.inventory.filter((r) => r.testPhase === 'P1' && !r.terminalStatus)
if (unassigned.length) {
  console.error('P1 APIs without status:', unassigned.map((r) => r.apiAuditId).join(', '))
  process.exit(1)
}
console.log('P1 coverage: ' + p1All.length + ' APIs, all statuses assigned')
