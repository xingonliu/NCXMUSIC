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
