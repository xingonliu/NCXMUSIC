'use strict'
const fs = require('fs')
const path = require('path')

function C(apiAuditId, cases) {
  return { apiAuditId, moduleName: apiAuditId.replace(/^ncm\./, ''), cases }
}

function R(caseId, auth, params, expectedClass) {
  return { caseId, auth, params, expectedClass }
}

const groups = []

groups.push(C('ncm.search', [
  R('ncm.search.kw1.type1002.none.001', 'AUTH_NONE', { keywords: '光年之外', type: '1002', limit: 10 }, 'user-results'),
  R('ncm.search.kw1.type1002.anon.001', 'AUTH_ANON', { keywords: '光年之外', type: '1002', limit: 10 }, 'user-results'),
  R('ncm.search.kw1.type1002.inv.001', 'AUTH_INVALID_EXPIRED', { keywords: '光年之外', type: '1002', limit: 10 }, 'user-results-or-fallback'),
  R('ncm.search.kw2.type1002.none.001', 'AUTH_NONE', { keywords: '周杰伦', type: '1002', limit: 10 }, 'user-results'),
  R('ncm.search.kw1.type1014.none.001', 'AUTH_NONE', { keywords: '光年之外', type: '1014', limit: 10 }, 'video-results'),
  R('ncm.search.kw3.type1014.none.001', 'AUTH_NONE', { keywords: '周杰伦 MV', type: '1014', limit: 10 }, 'video-results'),
]))

groups.push(C('ncm.song_chorus', [
  R('ncm.song_chorus.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'chorus'),
  R('ncm.song_chorus.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'chorus'),
  R('ncm.song_chorus.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'chorus-or-fallback'),
  R('ncm.song_chorus.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_copyright_rcmd', [
  R('ncm.song_copyright_rcmd.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'copyright-rcmd'),
  R('ncm.song_copyright_rcmd.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'copyright-rcmd'),
  R('ncm.song_copyright_rcmd.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'copyright-rcmd-or-fallback'),
  R('ncm.song_copyright_rcmd.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_creators', [
  R('ncm.song_creators.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'creators'),
  R('ncm.song_creators.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'creators'),
  R('ncm.song_creators.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'creators-or-fallback'),
  R('ncm.song_creators.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_dynamic_cover', [
  R('ncm.song_dynamic_cover.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'dynamic-cover'),
  R('ncm.song_dynamic_cover.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'dynamic-cover'),
  R('ncm.song_dynamic_cover.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'dynamic-cover-or-fallback'),
  R('ncm.song_dynamic_cover.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_red_count', [
  R('ncm.song_red_count.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'red-count'),
  R('ncm.song_red_count.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'red-count'),
  R('ncm.song_red_count.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'red-count-or-fallback'),
  R('ncm.song_red_count.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_wiki_summary', [
  R('ncm.song_wiki_summary.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'wiki-summary'),
  R('ncm.song_wiki_summary.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'wiki-summary'),
  R('ncm.song_wiki_summary.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'wiki-summary-or-fallback'),
  R('ncm.song_wiki_summary.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.song_url_ncmget', [
  R('ncm.song_url_ncmget.local.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'local-ncmget'),
  R('ncm.song_url_ncmget.local.002', 'AUTH_NONE', { id: '{{pool:songId:1}}' }, 'local-ncmget'),
  R('ncm.song_url_ncmget.local.003', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'local-ncmget'),
]))

groups.push(C('ncm.comment_music', [
  R('ncm.comment_music.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1', limit: 10, offset: 0 }, 'comments'),
  R('ncm.comment_music.none.002', 'AUTH_NONE', { id: '{{pool:songId:1}}', type: '1', limit: 10, offset: 0 }, 'comments-other-song'),
  R('ncm.comment_music.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}', type: '1', limit: 10, offset: 0 }, 'comments'),
  R('ncm.comment_music.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}', type: '1', limit: 10, offset: 0 }, 'comments-or-fallback'),
  R('ncm.comment_music.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '1' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_playlist', [
  R('ncm.comment_playlist.none.001', 'AUTH_NONE', { id: '{{pool:playlistId:0}}', type: '2', limit: 10 }, 'comments'),
  R('ncm.comment_playlist.anon.001', 'AUTH_ANON', { id: '{{pool:playlistId:0}}', type: '2', limit: 10 }, 'comments'),
  R('ncm.comment_playlist.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:playlistId:0}}', type: '2', limit: 10 }, 'comments-or-fallback'),
  R('ncm.comment_playlist.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '2' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_album', [
  R('ncm.comment_album.none.001', 'AUTH_NONE', { id: '{{pool:albumId:0}}', type: '3', limit: 10 }, 'comments'),
  R('ncm.comment_album.anon.001', 'AUTH_ANON', { id: '{{pool:albumId:0}}', type: '3', limit: 10 }, 'comments'),
  R('ncm.comment_album.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:albumId:0}}', type: '3', limit: 10 }, 'comments-or-fallback'),
  R('ncm.comment_album.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '3' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_dj', [
  R('ncm.comment_dj.none.001', 'AUTH_NONE', { id: '{{pool:djId:0}}', type: '4', limit: 10 }, 'comments'),
  R('ncm.comment_dj.anon.001', 'AUTH_ANON', { id: '{{pool:djId:0}}', type: '4', limit: 10 }, 'comments'),
  R('ncm.comment_dj.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:djId:0}}', type: '4', limit: 10 }, 'comments-or-fallback'),
  R('ncm.comment_dj.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '4' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_mv', [
  R('ncm.comment_mv.none.001', 'AUTH_NONE', { id: '{{pool:mvId:0}}', type: '6', limit: 10 }, 'comments'),
  R('ncm.comment_mv.anon.001', 'AUTH_ANON', { id: '{{pool:mvId:0}}', type: '6', limit: 10 }, 'comments'),
  R('ncm.comment_mv.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:mvId:0}}', type: '6', limit: 10 }, 'comments-or-fallback'),
  R('ncm.comment_mv.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '6' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_hot', [
  R('ncm.comment_hot.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'hot-comments'),
  R('ncm.comment_hot.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'hot-comments'),
  R('ncm.comment_hot.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'hot-comments-or-fallback'),
  R('ncm.comment_hot.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '1' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment_new', [
  R('ncm.comment_new.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1', sortType: 1, limit: 10 }, 'comments-new'),
  R('ncm.comment_new.none.002', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1', sortType: 2, limit: 10 }, 'comments-new-sort2'),
  R('ncm.comment_new.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}', type: '1', sortType: 1, limit: 10 }, 'comments-new'),
  R('ncm.comment_new.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}', type: '1', sortType: 1, limit: 10 }, 'comments-new-or-fallback'),
  R('ncm.comment_new.id0.none.neg.001', 'AUTH_NONE', { id: '0', type: '1' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.comment', [
  R('ncm.comment.none.001', 'AUTH_NONE', { t: '1', type: '1', id: '{{pool:songId:0}}', limit: 10 }, 'comments'),
  R('ncm.comment.anon.001', 'AUTH_ANON', { t: '1', type: '1', id: '{{pool:songId:0}}', limit: 10 }, 'comments'),
  R('ncm.comment.inv.001', 'AUTH_INVALID_EXPIRED', { t: '1', type: '1', id: '{{pool:songId:0}}', limit: 10 }, 'comments-or-fallback'),
  R('ncm.comment.missing.none.neg.001', 'AUTH_NONE', { t: '1', type: '1' }, 'negative-missing-id'),
]))
groups.push(C('ncm.comment_floor', [
  R('ncm.comment_floor.none.001', 'AUTH_NONE', { parentCommentId: '{{pool:commentId:0}}', id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'comment-floors'),
  R('ncm.comment_floor.anon.001', 'AUTH_ANON', { parentCommentId: '{{pool:commentId:0}}', id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'comment-floors'),
  R('ncm.comment_floor.inv.001', 'AUTH_INVALID_EXPIRED', { parentCommentId: '{{pool:commentId:0}}', id: '{{pool:songId:0}}', type: '1', limit: 10 }, 'comment-floors-or-fallback'),
  R('ncm.comment_floor.missing.none.neg.001', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1' }, 'negative-missing-parent'),
]))
groups.push(C('ncm.comment_info_list', [
  R('ncm.comment_info_list.none.001', 'AUTH_NONE', { type: '1', id: '{{pool:songId:0}}', threadId: '{{pool:threadId:0}}' }, 'comment-info'),
  R('ncm.comment_info_list.anon.001', 'AUTH_ANON', { type: '1', id: '{{pool:songId:0}}', threadId: '{{pool:threadId:0}}' }, 'comment-info'),
  R('ncm.comment_info_list.inv.001', 'AUTH_INVALID_EXPIRED', { type: '1', id: '{{pool:songId:0}}', threadId: '{{pool:threadId:0}}' }, 'comment-info-or-fallback'),
]))
groups.push(C('ncm.comment_hug_list', [
  R('ncm.comment_hug_list.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}', type: '1', page: 0, cursor: '' }, 'hug-list'),
  R('ncm.comment_hug_list.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}', type: '1', page: 0, cursor: '' }, 'hug-list'),
  R('ncm.comment_hug_list.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}', type: '1', page: 0, cursor: '' }, 'hug-list-or-fallback'),
]))

groups.push(C('ncm.playlist_tracks', [
  R('ncm.playlist_tracks.none.001', 'AUTH_NONE', { pid: '{{pool:playlistId:0}}', limit: 20, offset: 0 }, 'tracks-legacy'),
  R('ncm.playlist_tracks.anon.001', 'AUTH_ANON', { pid: '{{pool:playlistId:0}}', limit: 20, offset: 0 }, 'tracks-legacy'),
  R('ncm.playlist_tracks.inv.001', 'AUTH_INVALID_EXPIRED', { pid: '{{pool:playlistId:0}}', limit: 20, offset: 0 }, 'tracks-legacy-or-fallback'),
  R('ncm.playlist_tracks.id0.none.neg.001', 'AUTH_NONE', { pid: '0', limit: 20, offset: 0 }, 'negative-invalid-id'),
]))
groups.push(C('ncm.playlist_detail_rcmd_get', [
  R('ncm.playlist_detail_rcmd_get.none.001', 'AUTH_NONE', { id: '{{pool:playlistId:0}}' }, 'detail-rcmd'),
  R('ncm.playlist_detail_rcmd_get.anon.001', 'AUTH_ANON', { id: '{{pool:playlistId:0}}' }, 'detail-rcmd'),
  R('ncm.playlist_detail_rcmd_get.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:playlistId:0}}' }, 'detail-rcmd-or-fallback'),
  R('ncm.playlist_detail_rcmd_get.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.playlist_video_recent', [
  R('ncm.playlist_video_recent.none.001', 'AUTH_NONE', { pid: '{{pool:playlistId:0}}' }, 'video-recent'),
  R('ncm.playlist_video_recent.anon.001', 'AUTH_ANON', { pid: '{{pool:playlistId:0}}' }, 'video-recent'),
  R('ncm.playlist_video_recent.inv.001', 'AUTH_INVALID_EXPIRED', { pid: '{{pool:playlistId:0}}' }, 'video-recent-or-fallback'),
]))

groups.push(C('ncm.album_list', [
  R('ncm.album_list.new.none.001', 'AUTH_NONE', { type: 'new', area: 'ALL', limit: 10, offset: 0 }, 'album-list'),
  R('ncm.album_list.new.anon.001', 'AUTH_ANON', { type: 'new', area: 'ALL', limit: 10, offset: 0 }, 'album-list'),
  R('ncm.album_list.new.inv.001', 'AUTH_INVALID_EXPIRED', { type: 'new', area: 'ALL', limit: 10, offset: 0 }, 'album-list-or-fallback'),
  R('ncm.album_list.hot.none.001', 'AUTH_NONE', { type: 'hot', area: 'ZH', limit: 10, offset: 0 }, 'album-list-hot'),
  R('ncm.album_list.bad.none.neg.001', 'AUTH_NONE', { type: 'bogus', area: 'XX' }, 'negative-invalid-enum'),
]))
groups.push(C('ncm.album_list_style', [
  R('ncm.album_list_style.none.001', 'AUTH_NONE', { area: 'Z_H', limit: 10, offset: 0 }, 'album-list-style'),
  R('ncm.album_list_style.anon.001', 'AUTH_ANON', { area: 'Z_H', limit: 10, offset: 0 }, 'album-list-style'),
  R('ncm.album_list_style.inv.001', 'AUTH_INVALID_EXPIRED', { area: 'Z_H', limit: 10, offset: 0 }, 'album-list-style-or-fallback'),
  R('ncm.album_list_style.bad.none.neg.001', 'AUTH_NONE', { area: 'XX' }, 'negative-invalid-enum'),
]))
groups.push(C('ncm.album_new', [
  R('ncm.album_new.none.001', 'AUTH_NONE', { area: 'ALL', limit: 10, offset: 0 }, 'new-albums'),
  R('ncm.album_new.anon.001', 'AUTH_ANON', { area: 'ALL', limit: 10, offset: 0 }, 'new-albums'),
  R('ncm.album_new.inv.001', 'AUTH_INVALID_EXPIRED', { area: 'ALL', limit: 10, offset: 0 }, 'new-albums-or-fallback'),
  R('ncm.album_new.zh.none.001', 'AUTH_NONE', { area: 'ZH', limit: 10, offset: 0 }, 'new-albums-zh'),
]))
groups.push(C('ncm.album_newest', [
  R('ncm.album_newest.none.001', 'AUTH_NONE', {}, 'newest-albums'),
  R('ncm.album_newest.none.002', 'AUTH_NONE', {}, 'newest-albums-repeat'),
  R('ncm.album_newest.anon.001', 'AUTH_ANON', {}, 'newest-albums'),
  R('ncm.album_newest.inv.001', 'AUTH_INVALID_EXPIRED', {}, 'newest-albums-or-fallback'),
]))
groups.push(C('ncm.album_songsaleboard', [
  R('ncm.album_songsaleboard.daily.none.001', 'AUTH_NONE', { type: 'daily', albumType: 0 }, 'sales-board'),
  R('ncm.album_songsaleboard.daily.anon.001', 'AUTH_ANON', { type: 'daily', albumType: 0 }, 'sales-board'),
  R('ncm.album_songsaleboard.daily.inv.001', 'AUTH_INVALID_EXPIRED', { type: 'daily', albumType: 0 }, 'sales-board-or-fallback'),
  R('ncm.album_songsaleboard.bad.none.neg.001', 'AUTH_NONE', { type: 'bogus', albumType: 0 }, 'negative-invalid-enum'),
]))

groups.push(C('ncm.artist_list', [
  R('ncm.artist_list.none.001', 'AUTH_NONE', { type: '1', area: '-1', initial: '-1', limit: 10, offset: 0 }, 'artist-list'),
  R('ncm.artist_list.none.002', 'AUTH_NONE', { type: '1', area: '-1', initial: 'C', limit: 10, offset: 0 }, 'artist-list-initial'),
  R('ncm.artist_list.anon.001', 'AUTH_ANON', { type: '1', area: '-1', initial: '-1', limit: 10, offset: 0 }, 'artist-list'),
  R('ncm.artist_list.inv.001', 'AUTH_INVALID_EXPIRED', { type: '1', area: '-1', initial: '-1', limit: 10, offset: 0 }, 'artist-list-or-fallback'),
  R('ncm.artist_list.bad.none.neg.001', 'AUTH_NONE', { type: '99', area: '-1', initial: '-1' }, 'negative-invalid-enum'),
]))
groups.push(C('ncm.artist_fans', [
  R('ncm.artist_fans.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}', limit: 10, offset: 0 }, 'artist-fans'),
  R('ncm.artist_fans.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}', limit: 10, offset: 0 }, 'artist-fans'),
  R('ncm.artist_fans.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}', limit: 10, offset: 0 }, 'artist-fans-or-fallback'),
  R('ncm.artist_fans.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_follow_count', [
  R('ncm.artist_follow_count.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}' }, 'follow-count'),
  R('ncm.artist_follow_count.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}' }, 'follow-count'),
  R('ncm.artist_follow_count.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}' }, 'follow-count-or-fallback'),
  R('ncm.artist_follow_count.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_mv', [
  R('ncm.artist_mv.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}' }, 'artist-mvs'),
  R('ncm.artist_mv.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}' }, 'artist-mvs'),
  R('ncm.artist_mv.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}' }, 'artist-mvs-or-fallback'),
  R('ncm.artist_mv.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_new_mv', [
  R('ncm.artist_new_mv.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-mvs'),
  R('ncm.artist_new_mv.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-mvs'),
  R('ncm.artist_new_mv.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-mvs-or-fallback'),
  R('ncm.artist_new_mv.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_new_song', [
  R('ncm.artist_new_song.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-songs'),
  R('ncm.artist_new_song.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-songs'),
  R('ncm.artist_new_song.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}', limit: 10 }, 'artist-new-songs-or-fallback'),
  R('ncm.artist_new_song.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_new_song_mv_list_v2', [
  R('ncm.artist_new_song_mv_list_v2.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}' }, 'new-works'),
  R('ncm.artist_new_song_mv_list_v2.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}' }, 'new-works'),
  R('ncm.artist_new_song_mv_list_v2.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}' }, 'new-works-or-fallback'),
  R('ncm.artist_new_song_mv_list_v2.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_new_song_playall', [
  R('ncm.artist_new_song_playall.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}' }, 'new-songs-playall'),
  R('ncm.artist_new_song_playall.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}' }, 'new-songs-playall'),
  R('ncm.artist_new_song_playall.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}' }, 'new-songs-playall-or-fallback'),
  R('ncm.artist_new_song_playall.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.artist_video', [
  R('ncm.artist_video.none.001', 'AUTH_NONE', { id: '{{pool:artistId:0}}' }, 'artist-videos'),
  R('ncm.artist_video.anon.001', 'AUTH_ANON', { id: '{{pool:artistId:0}}' }, 'artist-videos'),
  R('ncm.artist_video.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:artistId:0}}' }, 'artist-videos-or-fallback'),
  R('ncm.artist_video.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))

groups.push(C('ncm.user_playlist', [
  R('ncm.user_playlist.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'public-playlists'),
  R('ncm.user_playlist.none.002', 'AUTH_NONE', { uid: '{{pool:userId:1}}', limit: 20, offset: 0 }, 'public-playlists-other'),
  R('ncm.user_playlist.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'public-playlists'),
  R('ncm.user_playlist.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'public-playlists-or-fallback'),
  R('ncm.user_playlist.page.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20, offset: 40 }, 'public-playlists-midpage'),
  R('ncm.user_playlist.uid0.none.neg.001', 'AUTH_NONE', { uid: '0' }, 'negative-invalid-uid'),
]))
groups.push(C('ncm.user_record', [
  R('ncm.user_record.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', type: '1' }, 'recent-record'),
  R('ncm.user_record.none.002', 'AUTH_NONE', { uid: '{{pool:userId:0}}', type: '0' }, 'all-record'),
  R('ncm.user_record.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', type: '1' }, 'recent-record'),
  R('ncm.user_record.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', type: '1' }, 'recent-record-or-fallback'),
  R('ncm.user_record.uid0.none.neg.001', 'AUTH_NONE', { uid: '0', type: '1' }, 'negative-invalid-uid'),
]))
groups.push(C('ncm.user_follows', [
  R('ncm.user_follows.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'follows'),
  R('ncm.user_follows.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'follows'),
  R('ncm.user_follows.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'follows-or-fallback'),
  R('ncm.user_follows.uid0.none.neg.001', 'AUTH_NONE', { uid: '0' }, 'negative-invalid-uid'),
]))
groups.push(C('ncm.user_followeds', [
  R('ncm.user_followeds.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'followeds'),
  R('ncm.user_followeds.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'followeds'),
  R('ncm.user_followeds.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'followeds-or-fallback'),
  R('ncm.user_followeds.uid0.none.neg.001', 'AUTH_NONE', { uid: '0' }, 'negative-invalid-uid'),
]))
groups.push(C('ncm.user_follow_mixed', [
  R('ncm.user_follow_mixed.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20 }, 'follow-mixed'),
  R('ncm.user_follow_mixed.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', limit: 20 }, 'follow-mixed'),
  R('ncm.user_follow_mixed.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', limit: 20 }, 'follow-mixed-or-fallback'),
]))
groups.push(C('ncm.user_playlist_collect', [
  R('ncm.user_playlist_collect.none.001', 'AUTH_NONE', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'collected-playlists'),
  R('ncm.user_playlist_collect.anon.001', 'AUTH_ANON', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'collected-playlists'),
  R('ncm.user_playlist_collect.inv.001', 'AUTH_INVALID_EXPIRED', { uid: '{{pool:userId:0}}', limit: 20, offset: 0 }, 'collected-playlists-or-fallback'),
  R('ncm.user_playlist_collect.uid0.none.neg.001', 'AUTH_NONE', { uid: '0' }, 'negative-invalid-uid'),
]))
groups.push(C('ncm.simi_user', [
  R('ncm.simi_user.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'simi-users'),
  R('ncm.simi_user.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'simi-users'),
  R('ncm.simi_user.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'simi-users-or-fallback'),
  R('ncm.simi_user.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))

groups.push(C('ncm.mv_detail', [
  R('ncm.mv_detail.none.001', 'AUTH_NONE', { mvid: '{{pool:mvId:0}}' }, 'mv-detail'),
  R('ncm.mv_detail.anon.001', 'AUTH_ANON', { mvid: '{{pool:mvId:0}}' }, 'mv-detail'),
  R('ncm.mv_detail.inv.001', 'AUTH_INVALID_EXPIRED', { mvid: '{{pool:mvId:0}}' }, 'mv-detail-or-fallback'),
  R('ncm.mv_detail.id0.none.neg.001', 'AUTH_NONE', { mvid: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.mv_detail_info', [
  R('ncm.mv_detail_info.none.001', 'AUTH_NONE', { mvid: '{{pool:mvId:0}}' }, 'mv-detail-info'),
  R('ncm.mv_detail_info.anon.001', 'AUTH_ANON', { mvid: '{{pool:mvId:0}}' }, 'mv-detail-info'),
  R('ncm.mv_detail_info.inv.001', 'AUTH_INVALID_EXPIRED', { mvid: '{{pool:mvId:0}}' }, 'mv-detail-info-or-fallback'),
  R('ncm.mv_detail_info.id0.none.neg.001', 'AUTH_NONE', { mvid: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.mv_first', [
  R('ncm.mv_first.none.001', 'AUTH_NONE', { limit: 10, area: '全部', order: '上升最快' }, 'mv-first'),
  R('ncm.mv_first.none.002', 'AUTH_NONE', { limit: 10, area: '华语', order: '最新' }, 'mv-first-variant'),
  R('ncm.mv_first.anon.001', 'AUTH_ANON', { limit: 10, area: '全部', order: '上升最快' }, 'mv-first'),
  R('ncm.mv_first.inv.001', 'AUTH_INVALID_EXPIRED', { limit: 10, area: '全部', order: '上升最快' }, 'mv-first-or-fallback'),
]))
groups.push(C('ncm.mv_all', [
  R('ncm.mv_all.none.001', 'AUTH_NONE', { area: '全部', type: '全部', order: '上升最快', limit: 10, offset: 0 }, 'mv-all'),
  R('ncm.mv_all.none.002', 'AUTH_NONE', { area: '华语', type: '内地', order: '最新', limit: 10, offset: 0 }, 'mv-all-variant'),
  R('ncm.mv_all.anon.001', 'AUTH_ANON', { area: '全部', type: '全部', order: '上升最快', limit: 10, offset: 0 }, 'mv-all'),
  R('ncm.mv_all.inv.001', 'AUTH_INVALID_EXPIRED', { area: '全部', type: '全部', order: '上升最快', limit: 10, offset: 0 }, 'mv-all-or-fallback'),
]))
groups.push(C('ncm.mv_exclusive_rcmd', [
  R('ncm.mv_exclusive_rcmd.none.001', 'AUTH_NONE', { limit: 10 }, 'mv-exclusive'),
  R('ncm.mv_exclusive_rcmd.none.002', 'AUTH_NONE', { limit: 10 }, 'mv-exclusive-repeat'),
  R('ncm.mv_exclusive_rcmd.anon.001', 'AUTH_ANON', { limit: 10 }, 'mv-exclusive'),
  R('ncm.mv_exclusive_rcmd.inv.001', 'AUTH_INVALID_EXPIRED', { limit: 10 }, 'mv-exclusive-or-fallback'),
]))
groups.push(C('ncm.simi_mv', [
  R('ncm.simi_mv.none.001', 'AUTH_NONE', { mvid: '{{pool:mvId:0}}' }, 'simi-mvs'),
  R('ncm.simi_mv.anon.001', 'AUTH_ANON', { mvid: '{{pool:mvId:0}}' }, 'simi-mvs'),
  R('ncm.simi_mv.inv.001', 'AUTH_INVALID_EXPIRED', { mvid: '{{pool:mvId:0}}' }, 'simi-mvs-or-fallback'),
  R('ncm.simi_mv.id0.none.neg.001', 'AUTH_NONE', { mvid: '0' }, 'negative-invalid-id'),
]))

groups.push(C('ncm.video_category_list', [
  R('ncm.video_category_list.none.001', 'AUTH_NONE', {}, 'video-categories'),
  R('ncm.video_category_list.none.002', 'AUTH_NONE', {}, 'video-categories-repeat'),
  R('ncm.video_category_list.anon.001', 'AUTH_ANON', {}, 'video-categories'),
  R('ncm.video_category_list.inv.001', 'AUTH_INVALID_EXPIRED', {}, 'video-categories-or-fallback'),
]))
groups.push(C('ncm.video_group_list', [
  R('ncm.video_group_list.none.001', 'AUTH_NONE', {}, 'video-groups'),
  R('ncm.video_group_list.none.002', 'AUTH_NONE', {}, 'video-groups-repeat'),
  R('ncm.video_group_list.anon.001', 'AUTH_ANON', {}, 'video-groups'),
  R('ncm.video_group_list.inv.001', 'AUTH_INVALID_EXPIRED', {}, 'video-groups-or-fallback'),
]))
groups.push(C('ncm.video_timeline_all', [
  R('ncm.video_timeline_all.none.001', 'AUTH_NONE', { offset: 0 }, 'timeline-all'),
  R('ncm.video_timeline_all.none.002', 'AUTH_NONE', { offset: 10 }, 'timeline-all-page2'),
  R('ncm.video_timeline_all.anon.001', 'AUTH_ANON', { offset: 0 }, 'timeline-all'),
  R('ncm.video_timeline_all.inv.001', 'AUTH_INVALID_EXPIRED', { offset: 0 }, 'timeline-all-or-fallback'),
]))
groups.push(C('ncm.video_timeline_recommend', [
  R('ncm.video_timeline_recommend.none.001', 'AUTH_NONE', { offset: 0 }, 'timeline-recommend'),
  R('ncm.video_timeline_recommend.none.002', 'AUTH_NONE', { offset: 10 }, 'timeline-recommend-page2'),
  R('ncm.video_timeline_recommend.anon.001', 'AUTH_ANON', { offset: 0 }, 'timeline-recommend'),
  R('ncm.video_timeline_recommend.inv.001', 'AUTH_INVALID_EXPIRED', { offset: 0 }, 'timeline-recommend-or-fallback'),
]))
groups.push(C('ncm.video_group', [
  R('ncm.video_group.none.001', 'AUTH_NONE', { id: '{{pool:videoId:0}}' }, 'video-group-detail'),
  R('ncm.video_group.anon.001', 'AUTH_ANON', { id: '{{pool:videoId:0}}' }, 'video-group-detail'),
  R('ncm.video_group.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:videoId:0}}' }, 'video-group-detail-or-fallback'),
  R('ncm.video_group.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.video_detail', [
  R('ncm.video_detail.none.001', 'AUTH_NONE', { id: '{{pool:videoId:0}}' }, 'video-detail'),
  R('ncm.video_detail.anon.001', 'AUTH_ANON', { id: '{{pool:videoId:0}}' }, 'video-detail'),
  R('ncm.video_detail.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:videoId:0}}' }, 'video-detail-or-fallback'),
  R('ncm.video_detail.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.video_detail_info', [
  R('ncm.video_detail_info.none.001', 'AUTH_NONE', { vid: '{{pool:videoId:0}}' }, 'video-detail-info'),
  R('ncm.video_detail_info.anon.001', 'AUTH_ANON', { vid: '{{pool:videoId:0}}' }, 'video-detail-info'),
  R('ncm.video_detail_info.inv.001', 'AUTH_INVALID_EXPIRED', { vid: '{{pool:videoId:0}}' }, 'video-detail-info-or-fallback'),
  R('ncm.video_detail_info.vid0.none.neg.001', 'AUTH_NONE', { vid: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.video_url', [
  R('ncm.video_url.none.001', 'AUTH_NONE', { id: '{{pool:videoId:0}}' }, 'video-url'),
  R('ncm.video_url.anon.001', 'AUTH_ANON', { id: '{{pool:videoId:0}}' }, 'video-url'),
  R('ncm.video_url.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:videoId:0}}' }, 'video-url-or-fallback'),
  R('ncm.video_url.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))

groups.push(C('ncm.related_allvideo', [
  R('ncm.related_allvideo.none.001', 'AUTH_NONE', { id: '{{pool:songId:0}}' }, 'related-videos'),
  R('ncm.related_allvideo.anon.001', 'AUTH_ANON', { id: '{{pool:songId:0}}' }, 'related-videos'),
  R('ncm.related_allvideo.inv.001', 'AUTH_INVALID_EXPIRED', { id: '{{pool:songId:0}}' }, 'related-videos-or-fallback'),
  R('ncm.related_allvideo.id0.none.neg.001', 'AUTH_NONE', { id: '0' }, 'negative-invalid-id'),
]))
groups.push(C('ncm.style_list', [
  R('ncm.style_list.none.001', 'AUTH_NONE', {}, 'style-list'),
  R('ncm.style_list.none.002', 'AUTH_NONE', {}, 'style-list-repeat'),
  R('ncm.style_list.anon.001', 'AUTH_ANON', {}, 'style-list'),
  R('ncm.style_list.inv.001', 'AUTH_INVALID_EXPIRED', {}, 'style-list-or-fallback'),
]))

const spec = {
  note: 'Phase 1 域全集（P1 剩余 113 接口的可执行部分）。ID 全部来自夹具池（血缘自动记录）；userId 由 search type=1002 生产、videoId 由 search type=1014 生产、commentId/threadId 由 comment_music 生产。写操作与仅限本账号的接口不在此 spec（报告层统一 blocked_by_prerequisite）。',
  groups,
}

const out = path.join(__dirname, 'specs', 'p1-domain.json')
fs.writeFileSync(out, JSON.stringify(spec, null, 2))
console.log('generated', out, '| groups:', groups.length, '| cases:', groups.reduce((a, g) => a + g.cases.length, 0))
