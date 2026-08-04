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

const phase2Ids = [
  'ncm.search', 'ncm.cloudsearch', 'ncm.search_suggest', 'ncm.search_hot', 'ncm.search_hot_detail',
  'ncm.search_default', 'ncm.search_multimatch', 'ncm.banner', 'ncm.personalized', 'ncm.toplist',
  'ncm.top_list', 'ncm.top_song', 'ncm.top_album', 'ncm.top_artists', 'ncm.top_mv', 'ncm.top_playlist',
  'ncm.top_playlist_highquality', 'ncm.playlist_hot', 'ncm.playlist_catlist', 'ncm.playlist_category_list',
  'ncm.playlist_highquality_tags', 'ncm.dj_hot', 'ncm.dj_catelist', 'ncm.dj_banner',
  'ncm.personalized_newsong', 'ncm.personalized_djprogram', 'ncm.personalized_mv',
  'ncm.personalized_privatecontent', 'ncm.personalized_privatecontent_list', 'ncm.homepage_block_page',
]

const BLOCKER = 'AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成'
const STATUS = {}
for (const id of phase2Ids) STATUS[id] = { status: 'partial', blocker: BLOCKER }

const FINDINGS = [
  ['top_list', '资源来源', '仅接受榜单歌单 ID：搜索歌单 2488306802 → 400 请求参数错误；榜单 ID → 200（v4/detail 返回 playlist 对象）；idx 参数模块级 500 拒绝', 'top_list.id.none.001/002, idx.none.neg.001'],
  ['search / cloudsearch', '非法枚举', 'type=999 静默容忍：{"result":{},"code":200} 空结果', 'search.type999 / cloudsearch.type999'],
  ['banner / top_playlist / top_song', '非法枚举', 'banner type=999→pc 默认；cat=不存在分类→全部；top_song type=999→正常列表', 'banner.type999 / top_playlist.catbad / top_song.type999'],
  ['search 系', '缺失必填', '空关键词 → code 400 明确错误', '*.empty.none.neg.001'],
  ['夹具池', '血缘', '8 桶实体全部来自上游响应；top_list 链式消费 toplistId 验证血缘机制', '03-fixture-pool.json / 03-parameter-lineage.json'],
]

runPhaseReport({
  phase: 2,
  specPath: path.join(__dirname, 'specs', 'phase2.json'),
  statusMap: STATUS,
  findings: FINDINGS,
  sectionNumbers: { manifest: 12, coverage: 11, failures: 5, diff: 3 },
  rawDir: path.join(args.rawDir, 'raw'),
  poolPath: path.join(args.rawDir, '03-fixture-pool.json'),
  runId: args.runId,
  reportDir: args.reportDir,
  packageVersion: args.packageVersion,
  sessionDir: args.sessionDir,
  agentName: args.agentName,
})
