# Phase 6 记忆、音乐人格画像与推荐验证

> 执行日期：2026-08-11
> 结论：`pass`
> 对应路线图：Phase 6

## 1. 范围结论

Phase 6 已覆盖 MEM-001～006、PRO-001～011、DAT-011～013 与 SET-003。实现保持既有进程边界：Main 继续独占 Cookie 与 Provider 凭据，Utility 持有账户 SQLite、音乐采集、记忆检索、画像 Job 和模型子循环，Renderer 只接收脱敏快照并发出用户命令。

| 范围 | 实现结果 |
| --- | --- |
| MEM-001～006 | 10 分钟会话块、确定性摘要、Working Memory、FTS5、账户恢复与按账户删除 |
| PRO-001～004 | 音乐证据限定画像、用户触发采集、本地完整扫描与去重聚合 |
| PRO-005～006 | 喜欢 1.5、自建歌单 1、收藏歌单 0；30 分、7 天与追加 15 分规则 |
| PRO-007～009 | 版本/覆盖/证据/置信度展示、最高优先级 override、暂停/恢复/重生成/删除/重试 |
| PRO-010～011 | 发现页画像推荐与仅保存 API 明确字段的基础资料 |
| DAT-011～013 | 画像语义 Journal、整库删除同步清空运行态、最小模型上下文与双入口披露 |
| SET-003 | “小云”设置页提供画像状态、手动任务、修正与数据入口 |

## 2. 会话记忆与 Working Memory

- Agent 连续会话仍短防抖写入 `agent_conversation_snapshot`；最后一条用户消息空闲 10 分钟后，尚未归档的稳定消息写入 `agent_conversation_blocks`。
- 摘要、关键词与重要性在本地确定性生成，不额外调用模型。外部内容 `agent_memory_fts` 通过 Insert/Update/Delete Trigger 与块表同步。
- 检索不直接拼接用户查询，FTS MATCH 与中文 LIKE 补充召回均使用参数；最终按 FTS 相关性、重要性和 30 天内新鲜度有限加权。
- 新 Turn 只选择与当前目标有关的最多 5 个历史块写入 `agent_working_memory`，不会默认把全部聊天装入 Prompt。
- `working-memory.json` 使用同目录临时文件、Flush 与原子替换；SQLite 是权威来源，快照损坏时从账户库重建。
- 登录退出保留账户空间；切换账号先终止旧任务再恢复目标账户。整库删除完成后 Agent 会从空账户空间重新恢复，避免保留已删除的内存态。

## 3. 音乐人格画像

画像生命周期已实现 `unavailable → collecting → ready_local → analyzing → ready/stale/failed/paused`。首次生成、手动更新、重新生成与失败重试都必须由用户按钮或命令启动；启动/换号只执行喜欢集合与歌单摘要级轻量变化检查，不读取歌单详情、不调用模型。

完整 Job 执行以下边界：

1. 分批读取完整喜欢歌曲 ID、全部用户歌单分页、每个歌单详情、歌曲加入时间、周排行、总排行与标准用户详情；喜欢详情与歌单详情最多 4 路并发。
2. 本地按歌曲 ID 去重，生成覆盖率、歌手/年代分布、来源、近期加入权重、变化分和代表证据；喜欢权重 1.5、自建歌单 1、收藏歌单 0，同一歌曲取最高权重。
3. 当前 Provider 默认只收到聚合特征与最多 28 个代表样本。需要更多证据时只能在画像子循环调用 `get_profile_evidence_page`，最多 6 次；该 Tool 不进入小云主会话的 10+2 Registry。
4. 模型输出经过严格 JSON Schema；成功后画像与新基线一起替换。失败保留上次成功画像、代表证据和聚合 Prompt，可直接重试而不重新采集。
5. `account_basic_profile` 只保存 `StandardUserSchema` 明确返回的称呼、性别、生日、来源 API 与更新时间；缺失值为 `NULL`，不让模型补全，也不送入画像 Prompt。

变化提示执行冻结规则：达到 30 分后提示；关闭后静默 7 天；静默期内相对关闭时再增加 15 分可提前提示。纠正、隐藏和补充保存为 override，在画像展示、推荐和 Agent Prompt 中优先于模型结论。画像独立删除只删除画像、证据与 override，不删除聊天、长期记忆、基础资料或网易云数据。

## 4. UI、推荐与数据披露

- 小云输入区正上方装配 `ProfileAnalysisBanner`，展示初始化/更新/失败重试、采集进度和模型数据披露；任务在后台运行，普通聊天与播放器不被阻塞。
- 设置新增“小云”页，提供状态、版本、覆盖率、证据、置信度、手动更新、单独重新生成、暂停/恢复、纠正/隐藏/补充和画像删除。
- 个人信息页展示画像摘要与主要结论。
- “小云为你推荐”放在发现页标题后的首个内容 Section，仅在已登录且画像可用时展示。候选来自正常音乐读取结果并按画像种子与结论稳定重排；模块本身不自动播放，只有用户点击歌曲或“播放全部”才进入播放器。
- 模型设置与画像初始化两个入口均披露：云端 Provider 只接收当前请求所需上下文或聚合画像样本，可能产生 Token 费用，不接收 Cookie、账户数据库或完整歌单文件。
- 数据页统计会话块、聊天消息与画像版本；整库删除文案明确覆盖聊天、记忆、画像、基础资料、播放快照、偏好、Journal 和缓存，同时声明不删除登录 Cookie 或网易云云端数据。

## 5. 自动验证

新增或扩展的主要验证：

- `tests/unit/phase6-memory.test.ts`：10 分钟归档、中文/FTS 召回、Working Memory 与账号隔离；
- `tests/unit/phase6-personalization.test.ts`：变化计分、30/7/15 规则、本地聚合、用户触发、证据分页、基础资料字段来源、游客拒绝与独立删除；
- `tests/unit/phase6-personalization-ui.test.ts`：提示装配顺序、双入口披露、设置控制、画像展示与推荐门控；
- `tests/unit/account-data-service.test.ts`：账户数据统计与安全删除；
- 既有 Agent、音乐、账户隔离、Renderer 与构建冒烟套件全量回归。

最终门禁：

- `pnpm typecheck`：通过；
- `pnpm lint`：通过，0 个错误，架构边界通过；Vue 模板规则仍报告非阻断 warning；
- `pnpm test`：63 个文件通过、1 个文件按环境跳过；417 项通过、6 项跳过；
- `pnpm test:e2e`：10/10 通过；
- `pnpm smoke:build`：Build Artifact Contract 与 Electron Build Smoke 通过，包含 Utility 崩溃恢复、取消、音频可播放、快照恢复和 Renderer 重载重连。

## 6. 已知边界

- 自动化使用标准 Music Service 与 Provider 夹具，未消耗真实第三方模型 Token，也未覆盖真实网易云超大曲库、限流和权益差异；这些属于发布前实机矩阵，而不是将云端调用静默纳入测试。
- 当前 Node 22 的 `node:sqlite` 在测试输出中仍带 ExperimentalWarning。业务层已通过单写者、迁移备份、事务和 Schema 校验约束风险，但升级 Node/Electron 时必须重新验证 API 稳定性与 FTS5 构建能力。
- 首版为关键词全文检索，不引入向量模型或 Provider Embedding；中文使用有限二元词补充召回，语义近义召回质量仍受此设计边界限制。
