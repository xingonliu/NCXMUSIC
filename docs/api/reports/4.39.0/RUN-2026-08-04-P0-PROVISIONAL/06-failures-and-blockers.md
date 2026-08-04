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

### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）

- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。
- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。
- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。
- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。
- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。

### B-005 register_anonimous 被风控（rate_limited）

- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。
- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。
- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。

### B-006 无效 Cookie 行为确认（契约事实）

- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。
## 4. Phase 1 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）

- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。
- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。
- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。
- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。
- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。

### B-005 register_anonimous 被风控（rate_limited）

- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。
- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。
- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。

### B-006 无效 Cookie 行为确认（契约事实）

- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。
## 4. Phase 1 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）

- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。
- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。
- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。
- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。
- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。

### B-005 register_anonimous 被风控（rate_limited）

- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。
- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。
- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。

### B-006 无效 Cookie 行为确认（契约事实）

- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。
## 4. Phase 1 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）

- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。
- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。
- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。
- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。
- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。

### B-005 register_anonimous 被风控（rate_limited）

- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。
- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。
- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。

### B-006 无效 Cookie 行为确认（契约事实）

- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。
## 4. Phase 1 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

### C-001 / XEAPI-001 register_xeapikey 模块契约与服务器冲突（failed_stable）

- 源码/类型预期：解密负载必须含 `sk`（register_xeapikey.js: `if (!publicKey.sk) throw`），xeapiEncryptS 同时使用 `publicKey` 与 `sk`。
- 运行事实：服务器解密负载为 `{publicKey, version, nextUpdateTime}`，**无 sk 字段**。模块 100% 抛错（≥3 次可复现）。
- 引导回退（已实测可用）：`sk` 使用 util/crypto.js 静态常量 `xeapiSignKey` 写入 `<tmp>/xeapi_public_key` 后，register_anonimous 成功返回 code 200。
- 语义置信度：inferred（xeapiSignKey 是唯一匹配的静态密钥；未由上游文档证明）。
- 处理：运行器内置 ensureXeapiKey 回退；依赖升级后强制重跑本冲突全部 case。

### B-005 register_anonimous 被风控（rate_limited）

- 成功路径已验证 1 次（code 200，返回 userId/createTime/cookie），随后同 IP 多次注册触发风控：连续 code 400（`{"code":400}` 无消息），退避 45s 后仍失败。
- 影响：AUTH_ANON 层（guest-01）本轮未取得，login_status/user_account 的 ANON 用例未执行（已从样本中删除，不留伪证）。
- 恢复：冷却后（建议 ≥1 小时）重试 register_anonimous；成功即写入 guest-01 会话，补跑 ANON 用例。

### B-006 无效 Cookie 行为确认（契约事实）

- login_status / user_account：AUTH_INVALID（截断/过期 MUSIC_U）与 AUTH_NONE 响应完全一致，**无明确失效错误**；Adapter 不能依赖 code 区分，需自行校验 account/profile 是否为 null。
## 5. Phase 2 运行发现（RUN-2026-08-04-P0-PROVISIONAL）

- **top_list**（资源来源维度）：仅接受榜单歌单 ID：来自搜索结果的歌单 2488306802 → {"code":400,"message":"请求参数错误"}；榜单来源 ID → 200（v4/detail 返回 playlist 对象，无顶层 tracks）（raw 样本 top_list.id.none.001/002）
- **top_list**（参数负向）：idx 参数被模块直接拒绝（本地 500，不发起请求）；id=0 → 400（top_list.idx.none.neg.001 / id0.none.neg.001）
- **search / cloudsearch**（非法枚举）：type=999 静默容忍，返回 {"result":{},"code":200}（空结果而非错误）（search.type999 / cloudsearch.type999）
- **banner**（非法枚举）：type=999 静默回退 pc（clientType 映射默认值），返回 PC banner（banner.type999）
- **top_playlist**（非法枚举）：cat=不存在分类XYZ 静默回退全部，返回正常歌单列表（top_playlist.catbad）
- **search / cloudsearch / search_suggest / search_multimatch**（缺失必填）：空关键词 → {"code":400}（明确错误）（*.empty.none.neg.001）
- **top_song**（非法枚举）：type=999 静默容忍（areaId 999 返回正常列表）（top_song.type999）
- **夹具池**（血缘）：7 类实体 8 桶：songId/artistId/albumId/playlistId/toplistId/mvId/djId/programId，全部来自上游响应（producerApi/producerCase/jsonPath 已记录）（03-fixture-pool.json）
