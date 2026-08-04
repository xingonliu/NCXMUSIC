'use strict'

const CATEGORY_RULES = [
  [/^(login_|register_|captcha_|logout|verify_|nickname_check|cellphone_existence_check|countries_code_list|activate_init_profile|rebind|user_replacephone|user_binding)/, 'auth'],
  [/^(login_qr_|login_status|login_refresh)/, 'auth'],
  [/^register_anonimous/, 'auth'],
  [/^register_xeapikey|register_checktoken/, 'auth'],
  [/^(search_|cloudsearch|search)/, 'search'],
  [/^song_/, 'song'],
  [/^lyric_|^lyric/, 'lyric'],
  [/^album/, 'album'],
  [/^artist/, 'artist'],
  [/^(playlist_|sheet_|pl_count)/, 'playlist'],
  [/^(top_playlist|toplist|top_list|top_song|top_artists|top_mv|top_album|chart_)/, 'toplist'],
  [/^comment_/, 'comment'],
  [/^user_/, 'user'],
  [/^personalized_|^personal_fm|fm_trash|recommend_|^recommend_resource|^recommend_songs/, 'recommend'],
  [/^dj/, 'dj'],
  [/^program_recommend/, 'dj'],
  [/^mv_/, 'mv'],
  [/^video_/, 'video'],
  [/^voice_/, 'voice'],
  [/^voicelist_/, 'voice'],
  [/^cloud_|^cloud$/, 'cloud'],
  [/^audio_match|^song_url_match/, 'audio-match'],
  [/^simi_/, 'simi'],
  [/^msg_/, 'message'],
  [/^event_|^event$|^hot_topic|^topic_/, 'social'],
  [/^follow|^get_userids/, 'social'],
  [/^send_|^share_resource|^resource_like|^hug_comment|^comment_hug/, 'social'],
  [/^record_recent_|^recent_listen_list|^listen_data_/, 'listen-history'],
  [/^vip_/, 'vip'],
  [/^yunbei_/, 'yunbei'],
  [/^musician_/, 'musician'],
  [/^digitalAlbum_/, 'digital-album'],
  [/^sign_|^daily_signin|^signin_progress/, 'sign'],
  [/^device_/, 'device'],
  [/^inner_version|^setting|^batch$|^api$/, 'system'],
  [/^ugc_/, 'ugc'],
  [/^rep_ugc_/, 'ugc'],
  [/^sati_/, 'ugc'],
  [/^thinktank_/, 'ugc'],
  [/^mlog_/, 'mlog'],
  [/^starpick_/, 'starpick'],
  [/^style_/, 'style'],
  [/^radio_/, 'radio'],
  [/^broadcast_/, 'broadcast'],
  [/^listenTogether_|^listen_together/, 'together'],
  [/^middle_play_/, 'lottery'],
  [/^music_first_listen_info/, 'song'],
  [/^calendar$|^lbs_city_code/, 'system'],
  [/^avatar_upload|^playlist_cover_update/, 'profile-media'],
  [/^fanscenter_/, 'fans-center'],
  [/^history_recommend_/, 'recommend'],
  [/^homepage_/, 'homepage'],
  [/^similar|^simi/, 'simi'],
  [/^summary_annual/, 'summary'],
  [/^related_/, 'related'],
  [/^playmode_|^playmode_/, 'playmode'],
  [/^song_url/, 'song'],
  [/^scrobble|^weblog|^relay_play_state_submit/, 'telemetry'],
  [/^verify_getQr|^verify_qrcodestatus/, 'auth'],
]

const FREQUENCY_HIGH = new Set([
  'search', 'cloudsearch', 'search_suggest', 'search_hot', 'search_default', 'search_multimatch', 'search_match',
  'song_detail', 'song_url', 'song_url_v1', 'lyric', 'lyric_new', 'check_music',
  'playlist_detail', 'playlist_track_all', 'playlist_tracks', 'playlist_hot', 'playlist_catlist', 'top_playlist',
  'album', 'album_detail', 'album_newest', 'album_sublist',
  'artist', 'artists', 'artist_songs', 'artist_top_song', 'artist_sublist', 'artist_album',
  'banner', 'personalized', 'recommend_resource', 'recommend_songs', 'personal_fm',
  'toplist', 'top_list', 'top_song',
  'comment_music', 'comment_playlist', 'comment_hot', 'comment_new', 'comment_album', 'comment_dj', 'comment_mv', 'comment_video',
  'user_account', 'user_detail', 'user_playlist', 'login_status', 'login_refresh', 'inner_version',
  'like', 'likelist', 'song_like', 'song_like_check',
  'user_record', 'user_subcount', 'user_level',
  'register_anonimous', 'logout', 'captcha_sent',
  'personalized_newsong', 'personalized_privatecontent', 'personalized_djprogram', 'personalized_mv',
  'playlist_create', 'playlist_subscribe', 'playlist_track_add', 'playlist_track_delete',
  'comment_add', 'comment_delete', 'comment_like', 'comment_reply',
  'follow', 'user_follows', 'user_followeds',
  'mv_detail', 'mv_url', 'video_detail', 'video_url',
  'dj_detail', 'dj_program', 'dj_sub', 'dj_sublist',
  'record_recent_song', 'record_recent_playlist', 'record_recent_album',
  'top_playlist_highquality', 'top_artists', 'top_album', 'top_mv',
  'user_cloud', 'user_cloud_detail',
  'simi_playlist', 'simi_song', 'simi_artist',
  'related_playlist', 'related_allvideo',
  'style_playlist', 'style_album', 'style_song', 'style_artist',
  'login_cellphone', 'login', 'login_qr_key', 'login_qr_create', 'login_qr_check',
  'playlist_detail_dynamic', 'playlist_mylike',
  'recommend_songs_dislike', 'fm_trash',
  'signin_progress', 'daily_signin',
  'song_purchased', 'song_download_url',
  'vip_info', 'user_binding',
])

const FREQUENCY_RARE = new Set([
  'event_privacy', 'user_event_all', 'song_url_ncmget', 'playlist_import_name_task_create', 'playlist_import_task_status',
  'verify_getQr', 'verify_qrcodestatus', 'rep_ugc_exam_start', 'rep_ugc_exam_submit', 'rep_ugc_exam_result_get',
  'thinktank_audit_resource_detail', 'thinktank_audit_resource_update', 'sati_resource_list', 'sati_resource_list_more',
  'sati_timescene_resources_get', 'summary_annual', 'history_recommend_songs', 'history_recommend_songs_detail',
  'mlog_music_rcmd', 'mlog_to_video', 'mlog_url', 'starpick_comments_summary', 'music_first_listen_info',
  'middle_play_do_lottery', 'middle_play_lottery_remain_chance', 'rep_ugc_user_collect-vip', 'song_creators',
  'song_wiki_summary', 'song_dynamic_cover', 'song_red_count', 'audio_match', 'yunbei_expense',
  'rep_ugc_exam_info_get', 'rep_ugc_exam_question_single_get', 'rep_ugc_activity_get', 'rep_ugc_activity_collect',
  'fanscenter_overview_get', 'fanscenter_trend_list', 'fanscenter_basicinfo_age_get', 'fanscenter_basicinfo_gender_get',
  'fanscenter_basicinfo_province_get', 'calendar', 'countryside_code_list', 'countries_code_list',
  'ugc_detail', 'ugc_song_get', 'ugc_album_get', 'ugc_artist_get', 'ugc_mv_get', 'ugc_artist_search', 'ugc_user_devote',
  'threshold_detail_get', 'sheet_preview', 'sheet_list', 'sign_happy_info', 'vip_growthpoint', 'vip_growthpoint_details',
  'vip_growthpoint_get', 'vip_growthpoint_getall', 'vip_sign_detail', 'vip_sign_history', 'vip_sign_info',
  'device_list', 'device_kickoff', 'user_mutualfollow_get', 'user_social_status', 'user_social_status_edit',
  'user_social_status_rcmd', 'user_social_status_support', 'creator_authinfo_get', 'ad_get', 'ad_listening_rights',
  'ad_listening_rights_gain', 'aidj_content_rcmd', 'song_lyrics_mark', 'song_lyrics_mark_add', 'song_lyrics_mark_del',
  'song_lyrics_mark_user_page', 'broadcast_channel_list', 'broadcast_channel_collect_list', 'broadcast_category_region_get',
  'broadcast_channel_currentinfo', 'broadcast_sub', 'radio_sport_get', 'rep_ugc_user_get', 'rep_ugc_user_vip',
  'rep_ugc_user_sign', 'rep_ugc_user_collect-vip', 'ugc_lottery',
])

const WRITE_VERBS = /^(add|create|delete|del|update|set|sub|unsub|subscribe|like|unlike|follow|unfollow|collect|sign|upload|remove|forward|send|report|reply|hug|trash|share|support|edit|refresh|accept|end|heatbeat|kickoff|rebind|replace|order|buy|purchase|pay|finish|join|leave|close|check|sync|comment)/

function classify(moduleName, stat) {
  const lower = moduleName.toLowerCase()
  const category = (() => {
    for (const [re, cat] of CATEGORY_RULES) {
      if (re.test(moduleName)) return cat
    }
    return 'other'
  })()

  const frequency = FREQUENCY_RARE.has(moduleName)
    ? 'rare'
    : FREQUENCY_HIGH.has(moduleName)
      ? 'high'
      : 'medium'

  const name = moduleName

  const sideEffectClass = (() => {
    if (/^(login|logout|register|captcha|verify|rebind|replacephone|bindingcellphone|nickname_check|cellphone_existence_check)/.test(name)) return 'credential'
    if (/^(avatar_upload|playlist_cover_update|cloud_upload|cloud_import|voice_upload)/.test(name)) return 'upload'
    if (/^(digitalAlbum_ordering|dj_paygift|cloud_import)/.test(name)) return 'payment'
    return (/^(user_update|activate_init_profile|user_social_status_edit|thinktank_audit_resource_update|event_del|playlist_delete|user_cloud_del|voice_delete|comment_delete|song_lyrics_mark_del|device_kickoff|daily_signin|yunbei_sign|yunbei_task_finish|rep_ugc_exam_start|rep_ugc_exam_submit|middle_play_do_lottery|listen_data_report|listen_data_realtime_report|weblog|scrobble|scrobble_v1|relay_play_state_submit|register_cellphone|register_xeapikey|register_checktoken_v2|register_checktoken_v3|verify_getQr|verify_qrcodestatus|logout|rebind|user_replacephone|user_bindingcellphone|musician_cloudbean_obtain|musician_sign|sign_happy_info|playlist_update_playcount|song_lyrics_mark_add|rep_ugc_activity_collect|rep_ugc_user_sign|rep_ugc_user_collect-vip|rep_ugc_user_vip|listenTogether_room_create|listenTogether_end|cloud_upload_complete|cloud_upload_token|playlist_import_name_task_create|playlist_import_task_status|sati_resource_sub|broadcast_sub|topic_sublist|mv_sub|video_sub|dj_sub|album_sub|artist_sub|playlist_subscribe|follow|comment_like|song_like|resource_like|like|hug_comment|playlist_track_add|playlist_track_delete|playlist_create|playlist_update|playlist_name_update|playlist_desc_update|playlist_tags_update|playlist_order_update|playlist_privacy|playlist_track_delete|comment_add|comment_reply|event_forward|send_text|send_song|send_playlist|send_album|share_resource|recommend_songs_dislike|fm_trash|user_playlist_create|user_playlist_collect|dj_difm_channel_subscribe|dj_difm_channel_unsubscribe|listenTogether_accept|listenTogether_heatbeat|listenTogether_play_command|listenTogether_sync_list_command|cloud_match|cloud_lyric_get|cloud_upload_complete|song_order_update|user_event|user_audio|msg_private|msg_forwards|comment_report|playlist_cover_update|song_url_match|song_download_url|song_download_url_v1|song_cloud_download|voice_upload|rep_ugc_exam_result_get|rep_ugc_exam_info_get|rep_ugc_exam_question_single_get|ugc_user_devote|vip_sign|vip_sign_info|vip_sign_detail|vip_sign_history|yunbei_rcmd_song|yunbei_receipt|relay_play_state_submit)/.test(name))
      ? 'reversible_write'
      : 'read'
  })()

  const testPhase = (() => {
    if (/^(inner_version|setting|login_|logout|register_|captcha_|verify_|user_account|user_detail|search|cloudsearch|banner|personalized|toplist|top_list|top_song|top_playlist|playlist_hot|dj_hot|recommend_|countryside_code_list|countries_code_list|nickname_check|cellphone_existence_check|activate_init_profile|get_userids)/.test(name)) return 'P0'
    if (/^(song_|lyric|playlist|album|artist|comment_|comment$|user_playlist|user_record|user_subcount|user_level|user_follow|like|likelist|mv_|video_|simi_|related_|style_|top_album|top_artists|top_mv|check_music)/.test(name)) return 'P1'
    if (/^(personal_fm|fm_trash|personalized_|recommend|record_recent|recent_listen|dj_|program_|radio_|broadcast_|voice|voicelist|msg_|event_|event$|topic_|hot_topic|homepage_|playmode_|history_recommend|listen_data_|listenTogether_|listentogether_|mlog_|starpick_|summary_annual|digitalAlbum_|song_purchased|song_downlist|song_monthdownlist|song_singledownlist|vip_|musician_|yunbei_|fanscenter_|chart_|sheet_|pl_count|calendar|ugc_|rep_ugc_|sati_|thinktank_|middle_play_|audio_match|song_url_match|ad_|aidj_|music_first_listen|music_first_listen_info|playlist_detail_rcmd_get|playlist_subscribers|playlist_mylike|playlist_category_list|playlist_highquality_tags|playlist_video_recent|topic_sublist|share_resource|resource_like|hug_comment|comment_hug_list|send_|scrobble|weblog|relay_play_state_submit|user_audio|user_event|user_cloud|user_cloud_del|user_cloud_detail|cloud_|cloudsearch)/.test(name)) return 'P2'
    if (/^(playlist_create|playlist_delete|playlist_update|playlist_name_update|playlist_desc_update|playlist_tags_update|playlist_order_update|playlist_privacy|playlist_track_add|playlist_track_delete|comment_add|comment_delete|comment_like|comment_reply|comment_report|song_like|resource_like|follow|event_del|event_forward|send_text|send_song|send_playlist|send_album|share_resource|hug_comment|recommend_songs_dislike|fm_trash|daily_signin|signin_progress|sign_happy_info|playlist_subscribe|album_sub|artist_sub|mv_sub|video_sub|dj_sub|dj_difm_channel_subscribe|dj_difm_channel_unsubscribe|topic_sublist|sati_resource_sub|broadcast_sub|user_playlist_create|user_playlist_collect|playlist_cover_update|song_order_update|user_social_status|user_social_status_edit|user_social_status_rcmd|user_social_status_support|msg_private|msg_forwards|listenTogether_accept|listenTogether_end|listenTogether_heatbeat|listenTogether_play_command|listenTogether_sync_list_command|listenTogether_room_check|listenTogether_room_create|listenTogether_status|listenTogether_sync_playlist_get|yunbei_sign|yunbei_task_finish|yunbei_rcmd_song|rep_ugc_activity_collect|rep_ugc_user_sign|rep_ugc_user_collect-vip|musician_sign|musician_cloudbean_obtain|vip_sign|vip_sign_info|vip_sign_detail|vip_sign_history|playlist_update_playcount|like)/.test(name)) return 'P3'
    if (/^(avatar_upload|cloud_upload|cloud_import|cloud_upload_token|cloud_upload_complete|voice_upload|voice_lyric|device_|playlist_import_|sati_resource_sub|thinktank_audit_resource_update|ugc_artist_search|ugc_user_devote|summary_annual)/.test(name)) return 'P4'
    return 'P5'
  })()

  const authRequirementHypothesis = (() => {
    if (/^(song_url|song_url_v1|song_url_v1_302|song_url_ncmget|song_download_url|song_download_url_v1|song_cloud_download|mv_url|video_url)/.test(name)) return 'user_or_vip'
    if (/^(register_anonimous|login_qr_key|login_qr_create|login_qr_check|inner_version|banner|search_hot|search_hot_detail|search_default|search_suggest|countries_code_list|countryside_code_list|calendar|captcha_sent|captcha_sent_v1|captcha_safe_sent|captcha_verify|cellphone_existence_check|nickname_check|toplist|top_list|top_song|top_album|top_artists|top_mv|top_playlist|top_playlist_highquality|playlist_hot|playlist_catlist|playlist_category_list|playlist_highquality_tags|dj_catelist|dj_category_excludehot|dj_category_recommend|dj_banner|album_newest|album_songsaleboard|mv_all|video_group|video_group_list|video_category_list|comment_hot|comment_new|comment_floor|comment_info_list|comment_hug_list|personalized|personalized_newsong|personalized_djprogram|personalized_mv|personalized_privatecontent|personalized_privatecontent_list|homepage_block_page|homepage_dragon_ball|search|cloudsearch|search_multimatch|search_match|song_detail|album|album_detail|album_detail_dynamic|artist|artists|artist_songs|artist_top_song|artist_album|artist_desc|artist_detail|artist_detail_dynamic|artist_fans|artist_follow_count|artist_mv|artist_new_mv|artist_new_song|artist_new_song_playall|artist_new_song_mv_list_v2|artist_list|artist_video|playlist_detail|playlist_detail_dynamic|playlist_track_all|playlist_tracks|toplist_detail|toplist_detail_v2|toplist_artist|lyric|lyric_new|simi_artist|simi_mv|simi_playlist|simi_song|simi_user|related_playlist|related_allvideo|mv_detail|mv_detail_info|video_detail|video_detail_info|dj_detail|dj_program|dj_program_detail|dj_radio_hot|dj_hot|dj_recommend|dj_recommend_type|dj_today_perfered|dj_toplist|dj_toplist_hours|dj_toplist_newcomer|dj_toplist_pay|dj_toplist_popular|dj_personalize_recommend|dj_program_toplist|dj_program_toplist_hours|djRadio_top|program_recommend|style_list|style_detail|style_album|style_artist|style_playlist|style_song|style_preference|ugc_song_get|ugc_album_get|ugc_artist_get|ugc_mv_get|ugc_artist_search|ugc_detail|sati_resource_list|sati_resource_list_more|sati_tag_list|sati_timescene_resources_get|thinktank_audit_resource_detail|radio_sport_get|chart_detail|chart_song_detail|playmode_intelligence_list|playmode_song_vector|starpick_comments_summary|music_first_listen_info|song_chorus|song_wiki_summary|song_creators|song_dynamic_cover|mlog_music_rcmd|mlog_url|mlog_to_video|audio_match|voice_detail|voicelist_list|voicelist_search|voicelist_list_search|voicelist_detail|broadcast_channel_list|broadcast_category_region_get|broadcast_channel_currentinfo|broadcast_channel_collect_list|sheet_list|sheet_preview|sign_happy_info|threshold_detail_get|pl_count|song_red_count|verify_getQr|verify_qrcodestatus)/.test(name)) return 'none'
    if (/^(register_anonimous)/.test(name)) return 'anon'
    if (/^(login_|logout|register_|captcha_|verify_|user_|like|likelist|song_like|song_like_check|recommend_songs|recommend_resource|personal_fm|fm_trash|playlist_sublist|playlist_mylike|playlist_subscribe|playlist_subscribers|playlist_create|playlist_delete|playlist_update|playlist_track_add|playlist_track_delete|playlist_cover_update|playlist_import_|playlist_order_update|playlist_privacy|playlist_name_update|playlist_desc_update|playlist_tags_update|playlist_update_playcount|playlist_video_recent|playlist_detail_rcmd_get|comment_add|comment_delete|comment_like|comment_reply|comment_report|comment_hug|follow|user_follows|user_followeds|user_follow_mixed|event_|topic_|hot_topic|msg_|record_recent_|recent_listen_list|listen_data_|user_cloud|user_cloud_detail|user_cloud_del|cloud_|cloud|song_purchased|song_download_url|song_download_url_v1|song_cloud_download|song_downlist|song_monthdownlist|song_singledownlist|digitalAlbum_purchased|digitalAlbum_ordering|digitalAlbum_sales|digitalAlbum_detail|vip_|yunbei_|musician_|signin_progress|daily_signin|sign_|check_music|device_|rebind|user_replacephone|user_bindingcellphone|user_binding|user_update|user_audio|user_dj|user_event|user_event_all|user_comment_history|user_level|user_medal|user_mutualfollow_get|user_social_status|user_social_status_edit|user_social_status_rcmd|user_social_status_support|user_subcount|user_playlist_create|user_playlist_collect|send_|share_resource|resource_like|hug_comment|scrobble|weblog|relay_play_state_submit|listenTogether_|listentogether_|middle_play_|rep_ugc_|ugc_user_devote|sati_resource_sub|sati_resource_sub_list|thinktank_audit_resource_update|avatar_upload|activate_init_profile|get_userids|playlist_delete|playlist_cover_update|song_lyrics_mark|song_lyrics_mark_add|song_lyrics_mark_del|song_lyrics_mark_user_page|song_order_update|voice_upload|voice_lyric|voice_delete|voicelist_my_created|voicelist_trans|fanscenter_|summary_annual|history_recommend_|homepage_|mlog_|starpick_|music_first_listen_info|audio_match|cloud_match|cloud_lyric_get|cloud_upload_token|cloud_upload_complete|cloud_import|song_url_v1_302|song_url_ncmget|user_social_status_support|user_social_status_rcmd|user_social_status_edit|user_social_status|user_social_status|listen_data_realtime_report|listen_data_report|listen_data_song_play_rank|listen_data_today_song|listen_data_total|listen_data_year_report)/.test(name)) return 'user'
    return 'none'
  })()

  const paginationKind = (() => {
    const p = stat.paginationParams || []
    if (p.some((x) => ['cursor', 'before', 'after', 'time', 'lasttime'].includes(x))) return 'cursor'
    if (p.some((x) => ['limit', 'offset', 'page'].includes(x))) return 'offset'
    return 'none'
  })()

  const plannedCaseCount = (() => {
    if (/^(song_url|song_url_v1|song_url_v1_302|song_download_url|song_download_url_v1|song_cloud_download|mv_url|video_url)/.test(name)) return 54
    if (sideEffectClass === 'payment') return 2
    if (sideEffectClass === 'upload') return 7
    if (sideEffectClass === 'credential') return 8
    if (sideEffectClass === 'reversible_write') return 4
    if (testPhase === 'P0' && /search/.test(name)) return 10
    if (testPhase === 'P1' && /comment_|playlist_|album|artist_|song_|lyric|mv_|video_/.test(name) && !/detail$/.test(name)) return 8
    if (paginationKind !== 'none') return 10
    if (FREQUENCY_RARE.has(name)) return 5
    return 6
  })()

  const consumes = []
  const produces = []
  const params = stat.params || []
  const entity = name.split('_')[0]
  if (/^comment_/.test(name) && params.some((p) => /^(id|ids)$/.test(p))) {
    consumes.push('targetResourceId')
  } else if (['song', 'playlist', 'album', 'artist', 'user', 'mv', 'video', 'dj', 'program', 'radio', 'voice', 'voicelist', 'topic', 'event', 'mlog'].includes(entity)) {
    if (params.some((p) => /^(id|ids)$/.test(p))) consumes.push(entity + 'Id')
  }
  if (params.includes('uid') || params.includes('userId')) consumes.push('userId')
  if (params.includes('pid') || params.includes('playlistId')) consumes.push('playlistId')
  if (params.includes('albumId')) consumes.push('albumId')
  if (params.includes('artistId')) consumes.push('artistId')
  if (params.includes('mvId')) consumes.push('mvId')
  if (params.includes('videoId')) consumes.push('videoId')
  if (params.includes('djId') || params.includes('radioId')) consumes.push('djId')
  if (params.includes('programId')) consumes.push('programId')
  if (params.includes('commentId')) consumes.push('commentId')
  if (params.includes('threadId')) consumes.push('threadId')
  if (params.includes('limit') || params.includes('offset') || params.includes('cursor')) consumes.push('pageToken')
  const prodEntities = []
  if (/^search|^cloudsearch/.test(name)) prodEntities.push('songId', 'artistId', 'albumId', 'playlistId', 'mvId', 'videoId', 'djId')
  else if (/^song_/.test(name) || name === 'song') prodEntities.push('songId')
  else if (/^artist/.test(name)) prodEntities.push('artistId', 'mvId')
  else if (/^album/.test(name)) prodEntities.push('albumId', 'songId')
  else if (/^playlist/.test(name) || /^sheet/.test(name)) prodEntities.push('playlistId', 'trackId')
  else if (/^user/.test(name)) prodEntities.push('userId', 'uid')
  else if (/^mv/.test(name)) prodEntities.push('mvId')
  else if (/^video/.test(name)) prodEntities.push('videoId')
  else if (/^dj|program|radio/.test(name)) prodEntities.push('djId', 'programId', 'radioId')
  else if (/^voice|voicelist/.test(name)) prodEntities.push('voiceId', 'voicelistId')
  else if (/^comment/.test(name)) prodEntities.push('commentId', 'threadId')
  else if (/^toplist|top_list|top_/.test(name)) prodEntities.push('songId')
  else if (/^personalized|recommend|banner|homepage/.test(name)) prodEntities.push('songId', 'playlistId')
  else if (/^login|register|logout|verify/.test(name)) prodEntities.push('cookie', 'uid')
  else if (/^record_recent/.test(name)) prodEntities.push('songId', 'playlistId', 'albumId')
  else if (/^simi/.test(name)) prodEntities.push('songId', 'artistId', 'playlistId', 'userId')
  else if (/^related/.test(name)) prodEntities.push('playlistId', 'videoId')
  else if (/^event/.test(name)) prodEntities.push('eventId')
  else if (/^topic/.test(name)) prodEntities.push('topicId')
  else if (/^msg_private/.test(name)) prodEntities.push('userId')
  else if (/^mlog/.test(name)) prodEntities.push('mlogId')
  else if (/^style/.test(name)) prodEntities.push('songId', 'playlistId', 'albumId', 'artistId')
  else if (/^music_first_listen/.test(name)) prodEntities.push('songId')
  produces.push(...prodEntities)

  return {
    apiAuditId: 'ncm.' + name,
    moduleName: name,
    category,
    frequency,
    sideEffectClass,
    testPhase,
    authRequirementHypothesis,
    paginationKind,
    plannedCaseCount,
    consumes: [...new Set(consumes)],
    produces: [...new Set(produces)],
  }
}

module.exports = { classify, CATEGORY_RULES, FREQUENCY_HIGH, FREQUENCY_RARE, WRITE_VERBS }
