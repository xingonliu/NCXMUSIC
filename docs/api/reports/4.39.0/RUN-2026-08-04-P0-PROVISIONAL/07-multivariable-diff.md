# 07-MULTIVARIABLE-DIFF（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`

Phase 0 无运行样本，无多变量差异可比。自 Phase 1 起每完成一个接口写入该接口报告 §8，本文件在 Phase 15 汇总。

## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 2. Phase 1 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| login_status / user_account | AUTH_NONE vs AUTH_INVALID | **无结构差异**：无效/截断 Cookie 静默回退未登录，无失效错误码 | `{"code":200,"account":null,"profile":null}` 三态一致 |
| login_status | AUTH_NONE vs AUTH_ANON | 未执行：游客会话被风控（blocked_by_prerequisite） | register_anonimous 400 |
| register_anonimous | 重复注册 | 风控：连续 400（首日多次注册触发） | 3× code 400 |
| logout | 未登录/无效 Cookie | 均返回 code 200（无会话也成功） | `{"code":200}` |
| login_qr_key | 重复调用 | unikey 每次轮换（UUID） | 2 样本不同值 |
| user_detail | 缺失必填 uid | code 400 参数错误 | `{"code":400,"message":"参数错误"}` |
## 3. Phase 2 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| top_list | 资源来源维度 | 仅接受榜单歌单 ID：来自搜索结果的歌单 2488306802 → {"code":400,"message":"请求参数错误"}；榜单来源 ID → 200（v4/detail 返回 playlist 对象，无顶层 tracks） | raw 样本 top_list.id.none.001/002 |
| top_list | 参数负向 | idx 参数被模块直接拒绝（本地 500，不发起请求）；id=0 → 400 | top_list.idx.none.neg.001 / id0.none.neg.001 |
| search / cloudsearch | 非法枚举 | type=999 静默容忍，返回 {"result":{},"code":200}（空结果而非错误） | search.type999 / cloudsearch.type999 |
| banner | 非法枚举 | type=999 静默回退 pc（clientType 映射默认值），返回 PC banner | banner.type999 |
| top_playlist | 非法枚举 | cat=不存在分类XYZ 静默回退全部，返回正常歌单列表 | top_playlist.catbad |
| search / cloudsearch / search_suggest / search_multimatch | 缺失必填 | 空关键词 → {"code":400}（明确错误） | *.empty.none.neg.001 |
| top_song | 非法枚举 | type=999 静默容忍（areaId 999 返回正常列表） | top_song.type999 |
| 夹具池 | 血缘 | 7 类实体 8 桶：songId/artistId/albumId/playlistId/toplistId/mvId/djId/programId，全部来自上游响应（producerApi/producerCase/jsonPath 已记录） | 03-fixture-pool.json |

## 4. Phase 3 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| 风控验证挑战 | 运行期激活 | 多个接口在本次运行中触发 code -462（verifyType 40，verifyUrl st.music.163.com/encrypt-pages，blockText 请完成验证操作）：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0/不存在 等；与 Phase 2 同批接口对比，证明上游风控状态随请求特征动态变化 | raw 样本 *.-462 各 case |
| simi_artist | 登录要求 | AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON（游客 cookie）→ 200。静态假设 none 需修正为 anon_or_user | simi_artist.none.001 / anon.001 |
| song_detail | 缺失必填 | 空 ids → 502（上游 400 透传，无 message）；不存在的超大 id → 200（返回空 songs 数组而非错误） | song_detail.empty / nonexist |
| album_detail | 资源状态 | albumId:0（搜索产出）→ 404 "无专辑商品"（非全部专辑都有商品实体）；旧版 album（/api/album）同 ID → 200 带歌曲 | album_detail.none.001 / album.none.001 |
| song_music_detail | 运行失败 | songId:0 在全部登录层返回 code 400（无 message）——疑似接口需特定上下文或已变更，≥3 层一致，记为 failed 证据 | song_music_detail.* |
| playlist_detail / playlist_track_all / playlist_detail_dynamic | 无效资源 | id=0 与不存在 id → 404 {"message":"歌单不存在"}（HTTP 404 + body code 404） | playlist_detail.id0 / playlist_track_all.id0 |
| artist_songs / artist_album / artist_top_song / artist_desc / artists / album / album_privilege | 无效资源 | id=0 → 404（code 404，无 message 或 artist:null） | *.id0.none.neg.001 |
| playlist_track_all | 边界 | limit=0 → 200（空 tracks 数组，offset 切片语义：trackIds.slice(offset, offset+limit)） | playlist_track_all.limit0 |
| related_playlist | 实现形态 | 非 API：直接抓取 music.163.com 网页 HTML 正则解析（GET https://music.163.com/playlist?id=），返回 code 200 与解析列表 | related_playlist.none.001 |

## 4. Phase 3 多变量差异（RUN-2026-08-04-P0-PROVISIONAL）

| 接口 | 维度 | 结论 | 证据 |
| --- | --- | --- | --- |
| 风控验证挑战 | 运行期激活 | 多个接口在本次运行中触发 code -462（verifyType 40，verifyUrl st.music.163.com/encrypt-pages，blockText 请完成验证操作）：artist_songs id=0、artist_album 无效 Cookie、simi_artist 未登录、simi_song 无效 Cookie、playlist_detail id=0/不存在 等；与 Phase 2 同批接口对比，证明上游风控状态随请求特征动态变化 | raw 样本 *.-462 各 case |
| simi_artist | 登录要求 | AUTH_NONE → {"code":301,"message":"未登录"}；AUTH_ANON（游客 cookie）→ 200。静态假设 none 需修正为 anon_or_user | simi_artist.none.001 / anon.001 |
| song_detail | 缺失必填 | 空 ids → 502（上游 400 透传，无 message）；不存在的超大 id → 200（返回空 songs 数组而非错误） | song_detail.empty / nonexist |
| album_detail | 资源状态 | albumId:0（搜索产出）→ 404 "无专辑商品"（非全部专辑都有商品实体）；旧版 album（/api/album）同 ID → 200 带歌曲 | album_detail.none.001 / album.none.001 |
| song_music_detail | 运行失败 | songId:0 在全部登录层返回 code 400（无 message）——疑似接口需特定上下文或已变更，≥3 层一致，记为 failed 证据 | song_music_detail.* |
| playlist_detail / playlist_track_all / playlist_detail_dynamic | 无效资源 | id=0 与不存在 id → 404 {"message":"歌单不存在"}（HTTP 404 + body code 404） | playlist_detail.id0 / playlist_track_all.id0 |
| artist_songs / artist_album / artist_top_song / artist_desc / artists / album / album_privilege | 无效资源 | id=0 → 404（code 404，无 message 或 artist:null） | *.id0.none.neg.001 |
| playlist_track_all | 边界 | limit=0 → 200（空 tracks 数组，offset 切片语义：trackIds.slice(offset, offset+limit)） | playlist_track_all.limit0 |
| related_playlist | 实现形态 | 非 API：直接抓取 music.163.com 网页 HTML 正则解析（GET https://music.163.com/playlist?id=），返回 code 200 与解析列表 | related_playlist.none.001 |

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