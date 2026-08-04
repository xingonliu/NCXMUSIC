# 02-COVERAGE-SUMMARY（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`；包版本：4.39.0；生成：2026-08-04T10:36:08.371Z

## 1. Universe 与清单

| 指标 | 值 |
| --- | --- |
| Universe 总数 | 436（436） |
| repo 模块 | 433 |
| pkg 模块 | 431 |
| 类型声明 | 404 |
| docs 小节 | 391 |
| 清单条目 | 436 |
| universe − inventory 差集 | 0（Phase 0 门禁：必须为 0） |

## 2. 阶段分布（§6 优先级，只决定顺序）

| 阶段 | 接口数 |
| --- | --- |
| P0 | 57 |
| P1 | 149 |
| P2 | 197 |
| P3 | 8 |
| P4 | 3 |
| P5 | 22 |
| **合计** | **436** |

## 3. 分类分布

| 分类 | 接口数 |
| --- | --- |
| dj | 30 |
| playlist | 30 |
| song | 28 |
| user | 28 |
| auth | 26 |
| ugc | 26 |
| other | 25 |
| artist | 18 |
| comment | 18 |
| social | 17 |
| recommend | 14 |
| toplist | 13 |
| listen-history | 13 |
| vip | 13 |
| album | 11 |
| voice | 10 |
| yunbei | 10 |
| search | 9 |
| video | 9 |
| musician | 8 |
| mv | 8 |
| style | 7 |
| system | 6 |
| cloud | 6 |
| message | 6 |
| broadcast | 5 |
| fans-center | 5 |
| simi | 5 |
| digital-album | 4 |
| telemetry | 4 |
| sign | 3 |
| mlog | 3 |
| device | 2 |
| homepage | 2 |
| lyric | 2 |
| lottery | 2 |
| playmode | 2 |
| related | 2 |
| audio-match | 1 |
| profile-media | 1 |
| radio | 1 |
| starpick | 1 |
| summary | 1 |
| together | 1 |

## 4. 副作用分类

| 类别 | 接口数 |
| --- | --- |
| read | 298 |
| reversible_write | 108 |
| credential | 22 |
| upload | 6 |
| payment | 2 |

## 5. 登录假设（静态）

| 假设 | 接口数 |
| --- | --- |
| none | 218 |
| user | 208 |
| user_or_vip | 10 |

## 6. 分页形态（静态）

| 形态 | 接口数 |
| --- | --- |
| none | 314 |
| offset | 88 |
| cursor | 34 |

## 7. 计划用例预算

- 计划用例总数（按 §9 最低次数公式）：3304
- 已执行：0（Phase 0 无网络调用）

## 8. 公式（Phase 15 时才冻结）

```
inventoryCoverage = reportedApiCount / universeApiCount   // 当前 436/436（endpoint 报告待生成）
runtimeCoverage = runtimeTestedApiCount / runtimeEligibleApiCount   // Phase 0：N/A（未发起任何线上请求）
matrixCoverage = executedRequiredCases / plannedRequiredCases   // 0 / 3304
rollbackSuccess = verifiedRollbackCount / attemptedWriteScenarioCount   // N/A
fieldEvidenceCoverage = evidencedFieldCount / discoveredFieldCount   // 0 / 0（无运行样本）
```

## 9. Phase 0 自检结论

- [x] Universe 差集为零（436 条目全部进入清单）
- [x] 每个条目含分类、参数契约（静态）、计划用例数与报告路径
- [ ] 终态：全部未赋（运行时阶段按 Phase 逐批赋值）
- [ ] 登录三态：未开始（账号缺口已登记）
- [ ] 运行样本/字段字典/未知字段：Phase 1 起生成
- 详细阻断见 06-failures-and-blockers.md
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| apiAuditId | 执行 case | 终态 | blocker |
| --- | --- | --- | --- |
| ncm.inner_version | 4 | passed | - |
| ncm.register_anonimous | 2 | rate_limited | 匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试 |
| ncm.register_xeapikey | 0 | failed_stable | 上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001） |
| ncm.login_status | 8 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本） |
| ncm.user_account | 8 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号） |
| ncm.user_detail | 1 | partial | 缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向 |
| ncm.logout | 2 | partial | AUTH_USER 缺失；仅未登录/无效 Cookie 负向 |
| ncm.login_qr_key | 2 | partial | 未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留 |

- 请求节奏：并发 1，抖动 350–800ms；27 次执行（本地 4，线上 23）
- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited
- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）
- 样本：19 个 raw + redacted（samples-manifest.json）
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| apiAuditId | 执行 case | 终态 | blocker |
| --- | --- | --- | --- |
| ncm.inner_version | 4 | passed | - |
| ncm.register_anonimous | 2 | rate_limited | 匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试 |
| ncm.register_xeapikey | 0 | failed_stable | 上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001） |
| ncm.login_status | 8 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本） |
| ncm.user_account | 8 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号） |
| ncm.user_detail | 1 | partial | 缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向 |
| ncm.logout | 2 | partial | AUTH_USER 缺失；仅未登录/无效 Cookie 负向 |
| ncm.login_qr_key | 2 | partial | 未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留 |

- 请求节奏：并发 1，抖动 350–800ms；27 次执行（本地 4，线上 23）
- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited
- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）
- 样本：19 个 raw + redacted（samples-manifest.json）
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| apiAuditId | 执行 case | 终态 | blocker |
| --- | --- | --- | --- |
| ncm.inner_version | 0 | passed | - |
| ncm.register_anonimous | 0 | rate_limited | 匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试 |
| ncm.register_xeapikey | 3 | failed_stable | 上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001） |
| ncm.login_status | 0 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本） |
| ncm.user_account | 0 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号） |
| ncm.user_detail | 0 | partial | 缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向 |
| ncm.logout | 0 | partial | AUTH_USER 缺失；仅未登录/无效 Cookie 负向 |
| ncm.login_qr_key | 0 | partial | 未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留 |

- 请求节奏：并发 1，抖动 350–800ms；3 次执行（本地 3，线上 0）
- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited
- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）
- 样本：22 个 raw + redacted（samples-manifest.json）
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| apiAuditId | 执行 case | 终态 | blocker |
| --- | --- | --- | --- |
| ncm.inner_version | 4 | passed | - |
| ncm.register_anonimous | 0 | rate_limited | 匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试 |
| ncm.register_xeapikey | 3 | failed_stable | 上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001） |
| ncm.login_status | 5 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本） |
| ncm.user_account | 5 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号） |
| ncm.user_detail | 1 | partial | 缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向 |
| ncm.logout | 2 | partial | AUTH_USER 缺失；仅未登录/无效 Cookie 负向 |
| ncm.login_qr_key | 2 | partial | 未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留 |

- 请求节奏：并发 1，抖动 350–800ms；22 次执行（本地 7，线上 15）
- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited
- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）
- 样本：22 个 raw + redacted（samples-manifest.json）
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| apiAuditId | 执行 case | 终态 | blocker |
| --- | --- | --- | --- |
| ncm.inner_version | 4 | passed | - |
| ncm.register_anonimous | 2 | rate_limited | 匿名注册风控：1 次成功（证据未持久化，见运行日志）+ 退避 45s 后仍 3 次 code 400；需冷却后重试 |
| ncm.register_xeapikey | 3 | failed_stable | 上游模块契约与服务器响应冲突：模块要求解密负载含 sk，服务器返回 publicKey/version/nextUpdateTime；静态常量 xeapiSignKey 作为 sk 的引导回退已实测可用（conflictId XEAPI-001） |
| ncm.login_status | 5 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；分层稳定性未满足（无参数接口无法产生每层 3 个有差异样本） |
| ncm.user_account | 5 | partial | AUTH_ANON/AUTH_USER/VIP 缺失；无 uid 生产路径（需登录账号） |
| ncm.user_detail | 1 | partial | 缺 uid（uid 生产需 AUTH_USER）；仅完成缺失必填负向 |
| ncm.logout | 2 | partial | AUTH_USER 缺失；仅未登录/无效 Cookie 负向 |
| ncm.login_qr_key | 2 | partial | 未完成 AUTH_ANON/AUTH_USER 层与扫码流程；unikey 为一次性凭据仅本地保留 |

- 请求节奏：并发 1，抖动 350–800ms；24 次执行（本地 7，线上 17）
- 风控事件：register_anonimous 连续 code 400（退避 45s 后仍失败），已按手册停止该域并标记 rate_limited
- 冲突：XEAPI-001（register_xeapikey 期望 sk，服务器返回 publicKey/version/nextUpdateTime）
- 样本：24 个 raw + redacted（samples-manifest.json）