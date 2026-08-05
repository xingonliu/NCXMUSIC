'use strict'
const fs = require('fs')
const path = require('path')

const args = require('../lib/args.js')({
  inventory: { type: 'string', required: true },
  staticAnalysis: { type: 'string', required: true },
  poolFile: { type: 'string', required: true },
  outSpec: { type: 'string', required: true },
  outStatus: { type: 'string', required: true },
})

const inv = JSON.parse(fs.readFileSync(args.inventory, 'utf8')).inventory
const analysis = JSON.parse(fs.readFileSync(args.staticAnalysis, 'utf8'))
const byModule = new Map(analysis.map((a) => [a.moduleName, a]))
const pool = JSON.parse(fs.readFileSync(args.poolFile, 'utf8')).pool
const poolEntities = new Set(Object.keys(pool))

const remaining = inv.filter((r) => !r.executedCaseCount || r.executedCaseCount === 0)
const remainingIds = new Set(remaining.map((r) => r.apiAuditId))

const BLOCKED_AUTH_USER = [
  'ncm.user_account', 'ncm.user_binding', 'ncm.user_bindingcellphone', 'ncm.user_replacephone', 'ncm.user_update',
  'ncm.user_cloud', 'ncm.user_cloud_detail', 'ncm.user_cloud_del', 'ncm.user_comment_history', 'ncm.user_medal',
  'ncm.user_mutualfollow_get', 'ncm.user_social_status', 'ncm.user_social_status_edit', 'ncm.user_social_status_rcmd',
  'ncm.user_social_status_support', 'ncm.user_subcount', 'ncm.user_level', 'ncm.user_audio', 'ncm.user_event',
  'ncm.user_event_all', 'ncm.user_dj', 'ncm.user_playlist_create', 'ncm.user_playlist_collect', 'ncm.user_playlist',
  'ncm.user_record', 'ncm.user_follows', 'ncm.user_followeds', 'ncm.user_follow_mixed',
  'ncm.likelist', 'ncm.like', 'ncm.song_like', 'ncm.song_like_check', 'ncm.song_purchased', 'ncm.song_downlist',
  'ncm.song_monthdownlist', 'ncm.song_singledownlist', 'ncm.song_order_update', 'ncm.song_cloud_download',
  'ncm.song_lyrics_mark', 'ncm.song_lyrics_mark_add', 'ncm.song_lyrics_mark_del', 'ncm.song_lyrics_mark_user_page',
  'ncm.playlist_mylike', 'ncm.playlist_create', 'ncm.playlist_delete', 'ncm.playlist_update', 'ncm.playlist_name_update',
  'ncm.playlist_desc_update', 'ncm.playlist_tags_update', 'ncm.playlist_order_update', 'ncm.playlist_privacy',
  'ncm.playlist_cover_update', 'ncm.playlist_track_add', 'ncm.playlist_track_delete', 'ncm.playlist_update_playcount',
  'ncm.playlist_subscribe', 'ncm.playlist_import_name_task_create', 'ncm.playlist_import_task_status',
  'ncm.album_sub', 'ncm.album_sublist', 'ncm.artist_sub', 'ncm.artist_sublist', 'ncm.mv_sub', 'ncm.mv_sublist',
  'ncm.video_sub', 'ncm.comment_add', 'ncm.comment_delete', 'ncm.comment_like', 'ncm.comment_reply', 'ncm.comment_report',
  'ncm.follow', 'ncm.event_del', 'ncm.event_forward', 'ncm.event_privacy', 'ncm.send_text', 'ncm.send_song',
  'ncm.send_playlist', 'ncm.send_album', 'ncm.share_resource', 'ncm.hug_comment', 'ncm.resource_like',
  'ncm.recommend_songs_dislike', 'ncm.fm_trash', 'ncm.daily_signin', 'ncm.signin_progress', 'ncm.sign_happy_info',
  'ncm.yunbei', 'ncm.yunbei_info', 'ncm.yunbei_sign', 'ncm.yunbei_expense', 'ncm.yunbei_receipt', 'ncm.yunbei_tasks',
  'ncm.yunbei_tasks_todo', 'ncm.yunbei_task_finish', 'ncm.yunbei_rcmd_song', 'ncm.yunbei_rcmd_song_history',
  'ncm.yunbei_today', 'ncm.vip_info', 'ncm.vip_info_v2', 'ncm.vip_sign', 'ncm.vip_sign_info', 'ncm.vip_sign_detail',
  'ncm.vip_sign_history', 'ncm.vip_growthpoint', 'ncm.vip_growthpoint_details', 'ncm.vip_growthpoint_get',
  'ncm.vip_growthpoint_getall', 'ncm.vip_tasks', 'ncm.vip_tasks_v1', 'ncm.vip_timemachine', 'ncm.musician_cloudbean',
  'ncm.musician_cloudbean_obtain', 'ncm.musician_data_overview', 'ncm.musician_play_trend', 'ncm.musician_sign',
  'ncm.musician_tasks', 'ncm.musician_tasks_new', 'ncm.musician_vip_tasks', 'ncm.listen_data_realtime_report',
  'ncm.listen_data_report', 'ncm.listen_data_song_play_rank', 'ncm.listen_data_today_song', 'ncm.listen_data_total',
  'ncm.listen_data_year_report', 'ncm.recent_listen_list', 'ncm.fanscenter_overview_get', 'ncm.fanscenter_trend_list',
  'ncm.fanscenter_basicinfo_age_get', 'ncm.fanscenter_basicinfo_gender_get', 'ncm.fanscenter_basicinfo_province_get',
  'ncm.device_list', 'ncm.device_kickoff', 'ncm.msg_comments', 'ncm.msg_forwards', 'ncm.msg_notices',
  'ncm.msg_private', 'ncm.msg_private_history', 'ncm.msg_recentcontact', 'ncm.scrobble', 'ncm.scrobble_v1',
  'ncm.weblog', 'ncm.relay_play_state_submit', 'ncm.listenTogether_room_create', 'ncm.listenTogether_room_check',
  'ncm.listenTogether_status', 'ncm.listenTogether_accept', 'ncm.listenTogether_end', 'ncm.listenTogether_heatbeat',
  'ncm.listenTogether_play_command', 'ncm.listenTogether_sync_list_command', 'ncm.listenTogether_sync_playlist_get',
  'ncm.middle_play_do_lottery', 'ncm.middle_play_lottery_remain_chance', 'ncm.summary_annual',
  'ncm.avatar_upload', 'ncm.playlist_cover_update', 'ncm.cloud_upload_token', 'ncm.cloud_upload_complete',
  'ncm.cloud_import', 'ncm.cloud_match', 'ncm.cloud_lyric_get', 'ncm.voice_upload', 'ncm.voice_delete',
  'ncm.voicelist_my_created', 'ncm.voicelist_trans', 'ncm.topic_sublist', 'ncm.sati_resource_sub',
  'ncm.sati_resource_sub_list', 'ncm.broadcast_sub', 'ncm.dj_sub', 'ncm.dj_sublist', 'ncm.dj_difm_channel_subscribe',
  'ncm.dj_difm_channel_unsubscribe', 'ncm.dj_difm_subscribe_channels_get', 'ncm.rep_ugc_user_collect-vip',
  'ncm.rep_ugc_user_get', 'ncm.rep_ugc_user_vip', 'ncm.rep_ugc_user_sign', 'ncm.rep_ugc_activity_collect',
  'ncm.rep_ugc_exam_start', 'ncm.rep_ugc_exam_submit', 'ncm.rep_ugc_exam_result_get', 'ncm.rep_ugc_exam_info_get',
  'ncm.rep_ugc_exam_question_single_get', 'ncm.rep_ugc_activity_get', 'ncm.thinktank_audit_resource_update',
  'ncm.ugc_user_devote', 'ncm.history_recommend_songs', 'ncm.history_recommend_songs_detail',
  'ncm.song_url_match', 'ncm.activate_init_profile', 'ncm.register_cellphone', 'ncm.register_checktoken_v2',
  'ncm.register_checktoken_v3', 'ncm.register_xeapikey', 'ncm.login', 'ncm.login_cellphone', 'ncm.captcha_sent',
  'ncm.captcha_sent_v1', 'ncm.captcha_safe_sent', 'ncm.captcha_verify', 'ncm.cellphone_existence_check',
  'ncm.rebind', 'ncm.user_replacephone', 'ncm.user_bindingcellphone', 'ncm.device_kickoff', 'ncm.logout',
  'ncm.verify_getQr', 'ncm.verify_qrcodestatus', 'ncm.lbs_city_code', 'ncm.ugc_lottery', 'ncm.ugc_artist_search',
  'ncm.ugc_artist_get', 'ncm.ugc_album_get', 'ncm.ugc_mv_get',   'ncm.ugc_song_get', 'ncm.ugc_detail', 'ncm.comment_video', 'ncm.digitalAlbum_purchased',
]

const BLOCKED_AUTH_ANON = [
  'ncm.digitalAlbum_ordering', 'ncm.dj_paygift',
]

const BLOCKED_SAFETY = [
  'ncm.digitalAlbum_ordering', 'ncm.dj_paygift', 'ncm.cloud_import',
]

const BLOCKED_NO_FIXTURE = []
const NO_FIXTURE_RULES = [
  [/^ncm\.video_/, 'videoId'],
  [/^ncm\.mlog_/, 'mlogId'],
  [/^ncm\.topic_/, 'topicId'],
  [/^ncm\.event/, 'eventId'],
  [/^ncm\.comment_event/, 'eventId'],
  [/^ncm\.sheet_/, 'sheetId'],
  [/^ncm\.chart_/, 'chartId'],
  [/^ncm\.style_/, 'styleId'],
  [/^ncm\.voice/, 'voiceId'],
  [/^ncm\.voicelist/, 'voicelistId'],
  [/^ncm\.ugc_/, 'ugcId'],
  [/^ncm\.sati_/, 'satiId'],
  [/^ncm\.thinktank_/, 'thinktankId'],
  [/^ncm\.fanscenter_/, 'userId'],
]

const OVERRIDE_STATUS = {
  'ncm.comment_hotwall_list': { status: 'not_exported', blocker: 'interface.d.ts 声明存在但无模块文件' },
  'ncm.user_safe': { status: 'not_exported', blocker: 'interface.d.ts 声明存在但无模块文件' },
  'ncm.listen_together_status': { status: 'not_exported', blocker: 'interface.d.ts 声明存在但无模块文件（对应模块 listentogether_status）' },
  'ncm.verify_getQr': { status: 'blocked_by_prerequisite', blocker: '网易云盾验证码流程（需真实交互）' },
  'ncm.verify_qrcodestatus': { status: 'blocked_by_prerequisite', blocker: '网易云盾验证码流程（需真实交互）' },
}

const statuses = {}
const blocked = new Set()

function mark(id, status, blocker) {
  if (!remainingIds.has(id)) return
  statuses[id] = { status, blocker }
  blocked.add(id)
}

for (const id of BLOCKED_AUTH_USER) {
  if (OVERRIDE_STATUS[id]) continue
  mark(id, 'blocked_by_prerequisite', 'AUTH_USER 账号缺失（B-002）；写操作/私有域已预授权但账号未到位')
}
for (const id of BLOCKED_SAFETY) {
  if (OVERRIDE_STATUS[id]) continue
  mark(id, 'blocked_by_safety', '支付/购买类：仅静态分析与负向探测，成功路径不执行（手册 §12.8）')
}
for (const r of remaining) {
  if (blocked.has(r.apiAuditId)) continue
  for (const [re, entity] of NO_FIXTURE_RULES) {
    if (re.test(r.apiAuditId)) {
      mark(r.apiAuditId, 'blocked_by_prerequisite', '缺夹具：' + entity + ' 无生产者（池为空）')
      break
    }
  }
}
for (const [id, st] of Object.entries(OVERRIDE_STATUS)) {
  if (blocked.has(id)) statuses[id] = st
  else mark(id, st.status, st.blocker)
}

const testable = remaining.filter((r) => !blocked.has(r.apiAuditId))
const groups = []

function entityFor(id, params) {
  if (params.includes('uid')) return 'userId'
  if (params.includes('pid')) return 'playlistId'
  if (params.includes('mvid')) return 'mvId'
  if (params.includes('vid')) return 'videoId'
  if (!params.some((p) => p === 'id' || p === 'ids')) return null
  if (/^ncm\.song/.test(id)) return 'songId'
  if (/^ncm\.playlist/.test(id)) return 'playlistId'
  if (/^ncm\.album/.test(id)) return 'albumId'
  if (/^ncm\.artist/.test(id)) return 'artistId'
  if (/^ncm\.mv/.test(id)) return 'mvId'
  if (/^ncm\.video/.test(id)) return 'videoId'
  if (/^ncm\.dj/.test(id) || /^ncm\.program|^ncm\.radio/.test(id)) return 'djId'
  if (/^ncm\.comment/.test(id)) return 'commentId'
  if (/^ncm\.user/.test(id)) return 'userId'
  if (/^ncm\.related/.test(id)) return 'songId'
  if (/^ncm\.simi/.test(id)) return 'songId'
  if (/^ncm\.style/.test(id)) return 'songId'
  if (/^ncm\.record_recent/.test(id)) return 'userId'
  if (/^ncm\.song_/.test(id)) return 'songId'
  return null
}

for (const r of testable) {
  const stat = byModule.get(r.moduleName) || { params: [] }
  const params = stat.params || []
  const entity = entityFor(r.apiAuditId, params)
  const short = r.moduleName
  const cases = []
  if (entity && !poolEntities.has(entity)) {
    mark(r.apiAuditId, 'blocked_by_prerequisite', '缺夹具：' + entity + ' 无生产者（池为空）')
    continue
  }
  const tpl = entity ? '{{pool:' + entity + ':0}}' : null
  if (entity) {
    cases.push({ caseId: 'ncm.' + short + '.none.001', auth: 'AUTH_NONE', params: Object.assign({}, r.params || {}), expectedClass: 'resource' })
    cases[0].params[params.includes('uid') ? 'uid' : (params.includes('pid') ? 'pid' : (params.includes('mvid') ? 'mvid' : (params.includes('vid') ? 'vid' : 'id')))] = tpl
    cases.push({ caseId: 'ncm.' + short + '.anon.001', auth: 'AUTH_ANON', params: JSON.parse(JSON.stringify(cases[0].params)), expectedClass: 'resource' })
    cases.push({ caseId: 'ncm.' + short + '.inv.001', auth: 'AUTH_INVALID_EXPIRED', params: JSON.parse(JSON.stringify(cases[0].params)), expectedClass: 'resource-or-fallback' })
    const neg = JSON.parse(JSON.stringify(cases[0].params))
    const idKey = params.includes('uid') ? 'uid' : (params.includes('pid') ? 'pid' : (params.includes('mvid') ? 'mvid' : (params.includes('vid') ? 'vid' : 'id')))
    neg[idKey] = '0'
    cases.push({ caseId: 'ncm.' + short + '.id0.none.neg.001', auth: 'AUTH_NONE', params: neg, expectedClass: 'negative-invalid-id' })
  } else if (params.includes('limit') || params.includes('offset')) {
    cases.push({ caseId: 'ncm.' + short + '.none.001', auth: 'AUTH_NONE', params: {}, expectedClass: 'list' })
    cases.push({ caseId: 'ncm.' + short + '.page.none.001', auth: 'AUTH_NONE', params: { limit: 5, offset: 10 }, expectedClass: 'list-midpage' })
    cases.push({ caseId: 'ncm.' + short + '.anon.001', auth: 'AUTH_ANON', params: {}, expectedClass: 'list' })
    cases.push({ caseId: 'ncm.' + short + '.inv.001', auth: 'AUTH_INVALID_EXPIRED', params: {}, expectedClass: 'list-or-fallback' })
  } else {
    cases.push({ caseId: 'ncm.' + short + '.none.001', auth: 'AUTH_NONE', params: {}, expectedClass: 'read' })
    cases.push({ caseId: 'ncm.' + short + '.none.002', auth: 'AUTH_NONE', params: {}, expectedClass: 'read-repeat' })
    cases.push({ caseId: 'ncm.' + short + '.anon.001', auth: 'AUTH_ANON', params: {}, expectedClass: 'read' })
    cases.push({ caseId: 'ncm.' + short + '.inv.001', auth: 'AUTH_INVALID_EXPIRED', params: {}, expectedClass: 'read-or-fallback' })
  }
  groups.push({ apiAuditId: r.apiAuditId, moduleName: r.moduleName, cases })
}

for (const r of remaining) {
  if (!statuses[r.apiAuditId]) {
    statuses[r.apiAuditId] = { status: 'partial', blocker: '待运行结果确认' }
  }
}

fs.writeFileSync(args.outSpec, JSON.stringify({ note: '剩余域自动生成 spec（NONE/ANON/INVALID + 负向/分页/重复）', groups }, null, 2))
fs.writeFileSync(args.outStatus, JSON.stringify({ statuses, blockedCount: blocked.size, testableCount: testable.length, groups: groups.length, cases: groups.reduce((a, g) => a + g.cases.length, 0) }, null, 2))
console.log('testable:', testable.length, '| blocked:', blocked.size, '| groups:', groups.length, '| cases:', groups.reduce((a, g) => a + g.cases.length, 0))
const unassigned = remaining.filter((r) => !statuses[r.apiAuditId])
console.log('remaining without status:', unassigned.length, unassigned.map((r) => r.apiAuditId).join(', '))
