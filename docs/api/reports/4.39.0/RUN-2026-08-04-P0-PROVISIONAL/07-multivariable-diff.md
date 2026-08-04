# 07-MULTIVARIABLE-DIFF（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`

Phase 0 无运行样本，无多变量差异可比。自 Phase 1 起每完成一个接口写入该接口报告 §8，本文件在 Phase 15 汇总。

## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| register_xeapikey / XEAPI-001 | 契约冲突 | 服务器解密负载 {publicKey,version,nextUpdateTime} 无 sk，模块 100% 抛错；sk=xeapiSignKey 静态常量回退引导实测可用（inferred） | register_xeapikey.none.min.00{1,2,3} |
| register_anonimous | 风控 | 多次注册触发上游风控 code 400（无消息），退避 45s 仍失败；冷却后恢复 | register_anonimous.none.* |
| login_status / user_account | 无效 Cookie | AUTH_INVALID（截断/过期）与 AUTH_NONE 响应完全一致：{"code":200,"account":null,"profile":null}，无失效错误，静默回退未登录 | login_status.inv.* / user_account.inv.* |
| logout | 未登录 | 无会话也返回 code 200（不报错） | logout.none.neg.001 |
| user_detail | 缺失必填 | 缺 uid → {"code":400,"message":"参数错误"} | user_detail.none.neg.missing-uid.001 |
| login_qr_key | 轮换 | unikey 每次调用轮换（UUID）；unikey 已入脱敏名单 | login_qr_key.none.min.00{1,2} |

## 3. Phase 2 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| top_list | 资源来源 | 仅接受榜单歌单 ID：搜索歌单 2488306802 → 400 请求参数错误；榜单 ID → 200（v4/detail 返回 playlist 对象）；idx 参数模块级 500 拒绝 | top_list.id.none.001/002, idx.none.neg.001 |
| search / cloudsearch | 非法枚举 | type=999 静默容忍：{"result":{},"code":200} 空结果 | search.type999 / cloudsearch.type999 |
| banner / top_playlist / top_song | 非法枚举 | banner type=999→pc 默认；cat=不存在分类→全部；top_song type=999→正常列表 | banner.type999 / top_playlist.catbad / top_song.type999 |
| search 系 | 缺失必填 | 空关键词 → code 400 明确错误 | *.empty.none.neg.001 |
| 夹具池 | 血缘 | 8 桶实体全部来自上游响应；top_list 链式消费 toplistId 验证血缘机制 | 03-fixture-pool.json / 03-parameter-lineage.json |

## 4. Phase 3 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| 风控验证挑战 | 运行期激活 | code -462（verifyType 40，st.music.163.com/encrypt-pages）随请求特征动态触发：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0 等 | raw 样本 *-462 各 case |
| simi_artist | 登录要求 | AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON → 200；静态假设修正为 anon_or_user | simi_artist.none.001 / anon.001 |
| song_detail | 参数边界 | 空 ids → 502（上游 400 透传）；不存在超大 id → 200 空 songs 数组 | song_detail.empty / nonexist |
| album_detail | 资源状态 | albumId:0 → 404 无专辑商品（非全部专辑有商品实体）；旧版 album 同 ID → 200 带歌曲 | album_detail.none.001 / album.none.001 |
| song_music_detail | 运行失败 | songId:0 全登录层 code 400（无消息）——接口契约或上下文异常，≥3 层一致 | song_music_detail.* |
| playlist 系 | 无效资源 | id=0 与不存在 → 404 歌单不存在（HTTP 404 + body code 404） | playlist_detail.id0 / playlist_track_all.id0 |
| artist 系 / album 系 | 无效资源 | id=0 → 404（code 404，无 message 或 artist:null） | *.id0.none.neg.001 |
| playlist_track_all | 边界 | limit=0 → 200 空 tracks（trackIds.slice(offset, offset+limit) 语义） | playlist_track_all.limit0 |
| related_playlist | 实现形态 | 非 API：抓取 music.163.com 网页 HTML 正则解析（GET /playlist?id=） | related_playlist.none.001 |

## 5. Phase 4 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| song_url_v1 | 音质矩阵 | 付费歌 9 档（standard~jymaster）未登录/游客均返回同一 128k mp3 试听 URL（br=128012，freeTrial 30s，level 降级）；免费歌 lossless→320k mp3、higher→192k、standard→128k；高音质真档需 AUTH_VIP（blocked_by_prerequisite） | §13.1 矩阵 + raw 样本 |
| song_url_v1 | 试听元数据 | NONE 层 freeTrialInfo.fragmentType=-1，ANON（游客 cookie）层=6；end=30s；fragSource=default | song_url_v1.A.*.none/anon |
| song_url（旧版）/ song_download_url(_v1) | 付费下载 | 未购付费歌 download → data.code=-105（url null），freeTrialPrivilege.cannotListenReason=1；试听与下载分离 | song_download_url*.A.anon.001 |
| 风控验证挑战 | 运行期 | -462（verifyId 1007602）覆盖多数媒体接口的 NONE/INVALID 层：song_url_v1.302 全部、song_url 多数、song_download_url* NONE、mv_url INVALID；ANON 层多数成功 | raw 样本 ERR-462 |
| 媒体 URL | 生命周期 | expi=1200s（歌曲）/3600s（MV）；签发后约 30 分钟探测（超出 expi 窗口）HEAD 仍 200 且 content-length 一致——到期语义非硬拒绝（或 CDN 宽限），完整下载验证未执行（§12.2 仅小范围探测） | media-probes/summary.json |
| 媒体 URL | 形态 | m*.music.126.net/jd-musicrep-ts 带 vuutv 签名 query；MV 为 vod.126.net 带 wsSecret/wsTime；报告仅保留 origin+path+hash | media-probes/summary.json |
| MV | 可播放性 | mv_url 返回 1080p mp4（r=1080，约 79MB，audio/video 200 HEAD，Range 支持），fee=0 | mv_url.none/anon.001 + probes |
| video_url | 夹具缺口 | 无 videoId 夹具（视频域发现未完成），blocked_by_prerequisite | 03-fixture-pool.json |
| enhanced 配置 | 网络分层 | unblock=true 未执行（B-003 enhanced 缺失）；canonical 样本单独统计 | 00-RUN-MANIFEST §10 |