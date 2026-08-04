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
