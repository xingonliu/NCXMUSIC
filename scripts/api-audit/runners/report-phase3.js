'use strict'
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

const phase3Ids = [
  'ncm.song_detail', 'ncm.song_music_detail', 'ncm.lyric', 'ncm.lyric_new', 'ncm.check_music',
  'ncm.album_privilege', 'ncm.playlist_detail', 'ncm.playlist_track_all', 'ncm.playlist_detail_dynamic',
  'ncm.playlist_subscribers', 'ncm.album', 'ncm.album_detail', 'ncm.album_detail_dynamic',
  'ncm.artists', 'ncm.artist_detail', 'ncm.artist_detail_dynamic', 'ncm.artist_songs',
  'ncm.artist_top_song', 'ncm.artist_album', 'ncm.artist_desc', 'ncm.simi_artist',
  'ncm.simi_playlist', 'ncm.simi_song', 'ncm.related_playlist',
]

const BLOCKER = 'AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成'
const STATUS = {}
for (const id of phase3Ids) STATUS[id] = { status: 'partial', blocker: BLOCKER }

const FINDINGS = [
  ['风控验证挑战', '运行期激活', 'code -462（verifyType 40，st.music.163.com/encrypt-pages）随请求特征动态触发：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0 等', 'raw 样本 *-462 各 case'],
  ['simi_artist', '登录要求', 'AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON → 200；静态假设修正为 anon_or_user', 'simi_artist.none.001 / anon.001'],
  ['song_detail', '参数边界', '空 ids → 502（上游 400 透传）；不存在超大 id → 200 空 songs 数组', 'song_detail.empty / nonexist'],
  ['album_detail', '资源状态', 'albumId:0 → 404 无专辑商品（非全部专辑有商品实体）；旧版 album 同 ID → 200 带歌曲', 'album_detail.none.001 / album.none.001'],
  ['song_music_detail', '运行失败', 'songId:0 全登录层 code 400（无消息）——接口契约或上下文异常，≥3 层一致', 'song_music_detail.*'],
  ['playlist 系', '无效资源', 'id=0 与不存在 → 404 歌单不存在（HTTP 404 + body code 404）', 'playlist_detail.id0 / playlist_track_all.id0'],
  ['artist 系 / album 系', '无效资源', 'id=0 → 404（code 404，无 message 或 artist:null）', '*.id0.none.neg.001'],
  ['playlist_track_all', '边界', 'limit=0 → 200 空 tracks（trackIds.slice(offset, offset+limit) 语义）', 'playlist_track_all.limit0'],
  ['related_playlist', '实现形态', '非 API：抓取 music.163.com 网页 HTML 正则解析（GET /playlist?id=）', 'related_playlist.none.001'],
]

runPhaseReport({
  phase: 3,
  specPath: path.join(__dirname, 'specs', 'phase3.json'),
  statusMap: STATUS,
  findings: FINDINGS,
  sectionNumbers: { manifest: 13, coverage: 12, failures: 6, diff: 4 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
})
