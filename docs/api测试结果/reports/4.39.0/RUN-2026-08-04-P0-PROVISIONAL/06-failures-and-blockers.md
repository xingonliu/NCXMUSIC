# 06-FAILURES-AND-BLOCKERS（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`

## 1. 阻断与缺口（需用户一次性解决）

### B-001 NcxMusic lockfile 缺失 → 版本冻结为 provisional

- 现状：NcxMusic 仓库（docs-only）无应用代码与 pnpm-lock.yaml，无法按手册 §1.1 从 lockfile 解析安装版本与完整性。
- 已做：以 npm 包 4.39.0 tarball（SHA-256 `aa63e7cf3c01321de46471ae2628fbf65536514ecb728d5deaa99ea6f8a43c20`）+ 官方 repo 提交 `4045f1ad3f82987588aaf9ea8eb3c79a61b06bb6` 双重锚定，全量静态发现已按该锚点完成。
- 待办：NcxMusic 应用建立 lockfile 后创建新 runId，重跑发现器做清单差异审计。

### B-002 测试账号缺失（AUTH_USER / AUTH_VIP / AUTH_PURCHASED）

- 需求：1 个普通测试账号（account-basic-01）、1 个 VIP 账号（account-vip-01）、1 个含已购资源账号（account-purchased-01）。
- 影响：Phase 1 起登录层对比、Phase 4 音质专项矩阵（9 档 × 账号层）、VIP/付费资源接口。缺失期间这些接口只能 partial/blocked_by_prerequisite。
- 用户提供方式：登录 Cookie 仅进入本机凭据层与运行时内存，不入 Git；以匿名标签记录。

### B-003 enhanced 网络配置缺失

- canonical 配置可直接开始；enhanced（unblock/代理）需要解锁凭据与代理地址，登记为测试缺口，Phase 4 评估。

### B-004 写操作授权

- Phase 11 前需确认：允许在 account-basic-01 上执行 `NCXMUSIC_API_TEST_<runId>` 前缀沙盒写操作（歌单创建/增删歌/评论发布删除/点赞/关注）。
- 头像/昵称/绑定/私信等高影响写操作默认不做成功写入。

## 2. 上游差异与疑似别名（Phase 14 验证）

- repo 与 npm 4.39.0 字节不一致模块：decrypt、share_resource、user_event、voice_upload（repo 较新；运行时以锁定版本源码为准，本 run 以 npm 包 4.39.0 为事实基线）
- npm 包缺失但 repo 存在：event_privacy、user_event_all
- 类型声明存在但无模块：comment_hotwall_list、user_safe、listen_together_status（listen_together_status 疑似与 listentogether_status 同义，待验证）
- docs 路由无法映射：/yunbei/tasks/receipt（疑似 yunbei_receipt）、/yunbei/tasks/expense（疑似 yunbei_expense）、/vip/task/v1（疑似 vip_tasks_v1）、/rep/ugc/user/collect-vip（模块名含连字符 rep_ugc_user_collect-vip，映射已覆盖）
- 官方文档标注云村热评接口下架：docs 中"云村热评(官方下架,暂不能用)"，对应模块待确认（song_copyright_rcmd 或 hot_topic 相关，Phase 13 取证）

## 3. 已知差异证据（checksumDiffer 明细）

| 模块 | repo SHA-256 | pkg SHA-256 | 差异摘要 |
| --- | --- | --- | --- |
| decrypt | `d64bf5bce14397d27506278a1e001b367f3b883a9a8666037bfa37f5819ba141` | `1911cfd130ff5567cf8877a2bcd48b23b2b73a6ded79a57279c34de2aa7f3121` | 见该模块 endpoint 报告 §2 |
| share_resource | `6e2f55982fba470e87fe7c456634ff6be8bb3ff4649c8c3995362e4319539aec` | `c142d01842ae0a96d73783f35155a1d59b457c43240cb785824d06c8c06e9241` | 见该模块 endpoint 报告 §2 |
| user_event | `5e93c7ed1e3cc58d9baa335712851a155c29bf2309f35b241b1308d386043824` | `3a7f4070afb17d804dd4463a0787c88544f1eb4512c2a5675f47045d2ca7fc8b` | 见该模块 endpoint 报告 §2 |
| voice_upload | `b279f9d7de8d1da87c2f60b4e4bab0691d23300370b7805928a498739f9af5b3` | `dcec5457bfba29439b6adcc0b89f02e2c6da9127f41d3247dd078e6cdf7e17d9` | 见该模块 endpoint 报告 §2 |

## 4. Phase 1 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **登录门槛**（301 系统错误）：artist_new_mv/artist_new_song/artist_new_song_mv_list_v2/artist_new_song_playall/song_dynamic_cover/user_followeds/simi_user/video_category_list/video_timeline_all/video_timeline_recommend 在未登录下发 301 系统错误（需会话；video_* 的 ANON 层 200，说明游客 cookie 可满足）（raw 样本 301 各 case）
- **user_record**（权限）：播放记录接口对公开 uid 也返回 code -2 无权限访问（未登录）（user_record.none.001）
- **playlist_tracks**（模块缺陷）：旧版歌单歌曲接口模块本地崩溃（query.s 未定义时 split 报错），4/4 可复现 failed_stable（playlist_tracks.*）
- **风控验证挑战**（无效 Cookie 层）：AUTH_INVALID 层在 comment_*/user_playlist/user_record/artist_fans/artist_follow_count/song_red_count/search(1002/1014) 广泛触发 -462（verifyId 1007602）（raw 样本 *inv.* ERR-462）
- **search type=1002/1014**（生产者阻断）：用户/视频搜索生产者在未登录层全部被 -462 阻断；userId 改由评论响应 user.userId 生产（100 条），videoId 仍缺（03-fixture-pool.json）
- **评论夹具**（生产）：comment_music/comment_album 等响应生产 commentId=50 条（含 parentCommentId），comment_floor 可测；threadId 无生产者（03-fixture-pool.json）
- **comment_floor**（依赖）：parentCommentId 取自评论响应（血缘记录），测试成功（comment_floor.none.001）
- **song_url_ncmget**（本地工具）：无网络调用（本地返回），三种调用形态一致（song_url_ncmget.local.*）
- **album/artist 列表**（非法枚举）：album_list type=bogus/area=XX 与 album_songsaleboard type=bogus → 404；artist_list type=99 静默容忍（*.bad.none.neg.001）

## 5. Phase 2 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **top_list**（资源来源）：仅接受榜单歌单 ID：搜索歌单 2488306802 → 400 请求参数错误；榜单 ID → 200（v4/detail 返回 playlist 对象）；idx 参数模块级 500 拒绝（top_list.id.none.001/002, idx.none.neg.001）
- **search / cloudsearch**（非法枚举）：type=999 静默容忍：{"result":{},"code":200} 空结果（search.type999 / cloudsearch.type999）
- **banner / top_playlist / top_song**（非法枚举）：banner type=999→pc 默认；cat=不存在分类→全部；top_song type=999→正常列表（banner.type999 / top_playlist.catbad / top_song.type999）
- **search 系**（缺失必填）：空关键词 → code 400 明确错误（*.empty.none.neg.001）
- **夹具池**（血缘）：8 桶实体全部来自上游响应；top_list 链式消费 toplistId 验证血缘机制（03-fixture-pool.json / 03-parameter-lineage.json）

## 6. Phase 3 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **风控验证挑战**（运行期激活）：code -462（verifyType 40，st.music.163.com/encrypt-pages）随请求特征动态触发：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0 等（raw 样本 *-462 各 case）
- **simi_artist**（登录要求）：AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON → 200；静态假设修正为 anon_or_user（simi_artist.none.001 / anon.001）
- **song_detail**（参数边界）：空 ids → 502（上游 400 透传）；不存在超大 id → 200 空 songs 数组（song_detail.empty / nonexist）
- **album_detail**（资源状态）：albumId:0 → 404 无专辑商品（非全部专辑有商品实体）；旧版 album 同 ID → 200 带歌曲（album_detail.none.001 / album.none.001）
- **song_music_detail**（运行失败）：songId:0 全登录层 code 400（无消息）——接口契约或上下文异常，≥3 层一致（song_music_detail.*）
- **playlist 系**（无效资源）：id=0 与不存在 → 404 歌单不存在（HTTP 404 + body code 404）（playlist_detail.id0 / playlist_track_all.id0）
- **artist 系 / album 系**（无效资源）：id=0 → 404（code 404，无 message 或 artist:null）（*.id0.none.neg.001）
- **playlist_track_all**（边界）：limit=0 → 200 空 tracks（trackIds.slice(offset, offset+limit) 语义）（playlist_track_all.limit0）
- **related_playlist**（实现形态）：非 API：抓取 music.163.com 网页 HTML 正则解析（GET /playlist?id=）（related_playlist.none.001）

## 7. Phase 4 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **song_url_v1**（音质矩阵）：付费歌 9 档（standard~jymaster）未登录/游客均返回同一 128k mp3 试听 URL（br=128012，freeTrial 30s，level 降级）；免费歌 lossless→320k mp3、higher→192k、standard→128k；高音质真档需 AUTH_VIP（blocked_by_prerequisite）（§13.1 矩阵 + raw 样本）
- **song_url_v1**（试听元数据）：NONE 层 freeTrialInfo.fragmentType=-1，ANON（游客 cookie）层=6；end=30s；fragSource=default（song_url_v1.A.*.none/anon）
- **song_url（旧版）/ song_download_url(_v1)**（付费下载）：未购付费歌 download → data.code=-105（url null），freeTrialPrivilege.cannotListenReason=1；试听与下载分离（song_download_url*.A.anon.001）
- **风控验证挑战**（运行期）：-462（verifyId 1007602）覆盖多数媒体接口的 NONE/INVALID 层：song_url_v1.302 全部、song_url 多数、song_download_url* NONE、mv_url INVALID；ANON 层多数成功（raw 样本 ERR-462）
- **媒体 URL**（生命周期）：expi=1200s（歌曲）/3600s（MV）；签发后约 30 分钟探测（超出 expi 窗口）HEAD 仍 200 且 content-length 一致——到期语义非硬拒绝（或 CDN 宽限），完整下载验证未执行（§12.2 仅小范围探测）（media-probes/summary.json）
- **媒体 URL**（形态）：m*.music.126.net/jd-musicrep-ts 带 vuutv 签名 query；MV 为 vod.126.net 带 wsSecret/wsTime；报告仅保留 origin+path+hash（media-probes/summary.json）
- **MV**（可播放性）：mv_url 返回 1080p mp4（r=1080，约 79MB，audio/video 200 HEAD，Range 支持），fee=0（mv_url.none/anon.001 + probes）
- **video_url**（夹具缺口）：无 videoId 夹具（视频域发现未完成），blocked_by_prerequisite（03-fixture-pool.json）
- **enhanced 配置**（网络分层）：unblock=true 未执行（B-003 enhanced 缺失）；canonical 样本单独统计（00-RUN-MANIFEST §10）

## 8. Phase 5 决策记录（RUN-2026-08-04-P0-PROVISIONAL）

- **B-007 Phase 5 暂缓（操作者指示，2026-08-04）**：用户私有读取域本轮不执行测试，raw 层无新增样本；清单中该域接口保持未测状态（executedCaseCount=0、terminalStatus 空）。
- 原因：AUTH_USER 账号缺失（B-002），未登录负向层价值有限且不构成三态对比。
- 补测方案：账号到位后按 §7 Phase 5 顺序执行 user_playlist/likelist/user_record/user_cloud 等，复用现有夹具池与运行器（--filter 单组重跑）。

## 8. Phase 6 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **登录门槛**（剩余域）：personal_fm/personal_fm_mode/recommend_songs/recommend_resource/login_refresh/digitalAlbum_detail 等私有化接口在未登录层返回 301/需登录错误；AUTH_ANON 表现各异（运行时样本为准）（raw 样本 301 各 case）
- **风控验证挑战**（剩余域）：-462（verifyId 1007602）在部分剩余接口的 AUTH_INVALID 层触发（raw 样本 *inv.* ERR-462）
- **模块级异常**（剩余域）：无 HTTP 状态的本地异常按 failed_stable 自动判定（终态由运行器证据推导）（remain-status.json 运行后细化）
- **本地工具**（剩余域）：decrypt/eapi_decrypt/audio_match 为本地加密/指纹工具（无 request 调用），本域补测（raw 样本 local.*）