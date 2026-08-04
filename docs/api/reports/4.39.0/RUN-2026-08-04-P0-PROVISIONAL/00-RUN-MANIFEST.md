# 00-RUN-MANIFEST

> runId：`RUN-2026-08-04-P0-PROVISIONAL`
>
> 阶段：Phase 0（版本冻结与静态审计）
>
> 生成时间：2026-08-04T10:36:08.371Z

## 1. 运行标识与参与者

| 项 | 值 |
| --- | --- |
| runId | `RUN-2026-08-04-P0-PROVISIONAL` |
| 执行 Agent | opencode (DeepSeek 审计 Agent) |
| 操作者 | 仓库所有者（AI 会话） |
| 开始时间 | 2026-08-04T10:36:08.371Z |
| 结束时间 | Phase 0 静态产物生成完成时刻（见提交记录） |

## 2. 版本冻结（PROVISIONAL，存在阻断）

**阻断项：NcxMusic 仓库目前为文档仓库，尚无应用代码与 lockfile。** 因此无法按手册 §1.1 的要求从 lockfile 解析安装版本、完整性哈希与模块清单。本轮以官方 npm 包 `@neteasecloudmusicapienhanced/api@4.39.0` 与官方仓库观察提交双重锚定，标记为 provisional；NcxMusic lockfile 建立后必须创建新 runId 重跑发现器，以清单差异驱动增量审计。

| 项 | 值 |
| --- | --- |
| 官方仓库 | https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced |
| 上游提交（锚定） | `4045f1ad3f82987588aaf9ea8eb3c79a61b06bb6` |
| 包名 | @neteasecloudmusicapienhanced/api |
| 解析版本 | 4.39.0 |
| NcxMusic lockfile 完整性 | **缺失（阻断）** |
| npm tarball | `.artifacts\api-audit\RUN-2026-08-04-P0-PROVISIONAL\raw\package\neteasecloudmusicapienhanced-api-4.39.0.tgz` |
| tarball SHA-256 | `aa63e7cf3c01321de46471ae2628fbf65536514ecb728d5deaa99ea6f8a43c20` |
| tarball shasum（npm 公布） | 8cc8c7c54354f31a2310ad7f21160e77392ac8cc |
| tarball integrity（npm 公布） | sha512-faaLGT9pOmw2lu2kxdHAeyy+Ni/UqZW/laAb+Np+QexUwXKxDvPTbW3GiLkIromdAfSR519oGGizX3+Unf0q2w== |
| 包内文件数 | 492（含 module 431 个 JS） |

### 2.1 NcxMusic 仓库状态

| 项 | 值 |
| --- | --- |
| 分支 | agent/profile-memory-prd |
| HEAD | `6321217f0a0ac96a8ce735323251fda562d7e9a2` |
| 工作树 | 有未提交改动：M .gitignore; ?? docs/api/reports/; ?? scripts/ |

## 3. 发现统计与来源差集

| 来源 | 数量 |
| --- | --- |
| repo module JS（提交 4045f1a） | 433 |
| npm 包 module JS（4.39.0） | 431 |
| interface.d.ts 函数声明 | 404 |
| docs 接口文档小节 | 391（其中带路由 386） |
| 测试/示例文件 | 17 |
| Universe 并集（apiAuditId） | 436 |

### 3.1 模块差集

- 仅存在于 repo（不在 npm 包）：`event_privacy`, `user_event_all`
- 仅存在于 npm 包（不在 repo）：无
- repo 与 pkg 字节不一致（checksumDiffer）：`decrypt`, `share_resource`, `user_event`, `voice_upload`（repo 更新于发布的 4.39.0；差异已记录于 endpoints 报告与 06 报告）
- 类型声明存在但无模块文件（moduleMissing）：`comment_hotwall_list`, `user_safe`, `listen_together_status`（按手册 §1.1 必须入账，预计终态 not_exported 或 alias，待 Phase 14 验证）
- docs 路由存在但无法映射到模块：`yunbei_tasks_receipt`, `yunbei_tasks_expense`, `vip_task_v1`, `rep_ugc_user_collect_vip`（其中 yunbei_tasks_receipt/yunbei_tasks_expense/vip_task_v1 疑似对应 yunbei_receipt/yunbei_expense/vip_tasks_v1，记入 06 报告待核）

## 4. 运行环境

| 项 | 值 |
| --- | --- |
| Node.js | v22.22.2 |
| npm | 10.9.7 |
| pnpm | not installed |
| git | git version 2.42.0.windows.2 |
| Electron | N/A (仓库尚无 Electron 应用代码) |
| Chromium | N/A (仓库尚无 Electron 应用代码) |
| OS | win32 10.0.26200 (x64) |
| 语言/地区 | zh-CN（推断） |
| 时区 | Asia/Shanghai（zh-CN） |

## 5. 网络配置

| 项 | 值 |
| --- | --- |
| 网络地区 | 未配置代理（canonical 直连预期）；具体地区未记录，Phase 1 起每样本记录 |
| unblock/解锁 | canonical 配置下不启用（enhanced 配置缺失，登记测试缺口） |
| ENABLE_PROXY | 未设置（canonical） |

## 6. 账户分层

| 层 | 状态 | 匿名标签 |
| --- | --- | --- |
| AUTH_NONE | 可用（无需账号） | - |
| AUTH_ANON | 可自动生产（register_anonimous） | guest-01（Phase 1 创建） |
| AUTH_USER | **缺失** | account-basic-01（待申请） |
| AUTH_VIP | **缺失** | account-vip-01（待申请） |
| AUTH_PURCHASED | **缺失** | account-purchased-01（待申请） |
| AUTH_INVALID | 可构造（截断/过期 MUSIC_U） | test-invalid-01 |

按手册 §4.4/§8.5，缺失账号统一登记于 06-failures-and-blockers.md，集中一次向用户申请，不逐接口询问。

## 7. 写操作授权

- 可逆写操作（沙盒资源）：**未授权**（Phase 11 前需用户确认专用账号与沙盒前缀 `NCXMUSIC_API_TEST_<runId>`）
- 高影响写操作（头像/昵称/绑定/私信）：**未授权**
- 付费操作：**未授权**（一律 blocked_by_safety）

## 8. 请求节奏预算

- 初始并发：1；确认无风控后纯读取最多 2；写操作串行
- 请求抖动：350–800ms 随机
- 限流退避：30s 起并降低全局速率
- 重试：纯读取网络错误最多 3 次（2/5/15s 退避）；写操作不透明重试
- 媒体专项预算：song_url_v1 等专项矩阵（9 音质 × 账号层 × 代表歌曲 × canonical/enhanced），在 RUN 阶段清单中单独说明

## 9. 工具链与复现

```
node scripts/api-audit/runners/build-phase0.js \
  --pkgDir <npm包解包目录> --repoDir <repo克隆> --workDir .artifacts/api-audit/<runId>/raw \
  --runId <runId> --packageVersion 4.39.0 --reportDir docs/api/reports/4.39.0/<runId>
node scripts/api-audit/runners/report-phase0.js --workDir ... --reportDir ...（生成本目录全部报告）
node scripts/api-audit/runners/self-check.js --reportDir ...（零遗漏与脱敏门禁）
```

## 10. 运行配置分层

| 配置 | 状态 | 说明 |
| --- | --- | --- |
| canonical | 计划默认 | 关闭 unblock/代理，观察原始上游合同 |
| enhanced | 登记缺口 | 无解锁凭据与账号，Phase 4 音质矩阵时再评估 |
## 11. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行 Agent：opencode (DeepSeek 审计 Agent)
- 线上请求数：23（并发 1，抖动 350–800ms）
- guest-01 游客会话：**未建立（register_anonimous 被风控，见 B-005）**
- xeapi 密钥引导：已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）
- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400
## 11. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行 Agent：opencode (DeepSeek 审计 Agent)
- 线上请求数：23（并发 1，抖动 350–800ms）
- guest-01 游客会话：**未建立（register_anonimous 被风控，见 B-005）**
- xeapi 密钥引导：已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）
- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400
## 11. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行 Agent：opencode (DeepSeek 审计 Agent)
- 线上请求数：0（并发 1，抖动 350–800ms）
- guest-01 游客会话：**未建立（register_anonimous 被风控，见 B-005）**
- xeapi 密钥引导：已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）
- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400
## 11. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行 Agent：opencode (DeepSeek 审计 Agent)
- 线上请求数：15（并发 1，抖动 350–800ms）
- guest-01 游客会话：**未建立（register_anonimous 被风控，见 B-005）**
- xeapi 密钥引导：已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）
- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400
## 11. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行 Agent：opencode (DeepSeek 审计 Agent)
- 线上请求数：17（并发 1，抖动 350–800ms）
- guest-01 游客会话：**未建立（register_anonimous 被风控，见 B-005）**
- xeapi 密钥引导：已建立（bootstrap-fallback-sk-static，见 C-001/XEAPI-001）
- 关键契约事实：无效 Cookie 静默回退未登录（B-006）；user_detail 缺 uid 返回 code 400