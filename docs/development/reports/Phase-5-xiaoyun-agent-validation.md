# Phase 5 小云 Agent 主闭环验证

> 执行日期：2026-08-11
> 结论：`pass`
> 对应路线图：Phase 5

## 1. Provider Profile 与三协议

Provider Profile 由 Main Process 独占管理。Renderer 只能通过严格 IPC 提交编辑请求并取得公开快照；API Key 与自定义 Header 值使用 Electron `safeStorage` 加密后写入用户数据目录，公开结果只包含 Header 名称、凭据存在标记和实测能力。Main 只通过私有控制通道把当前执行 Profile 注入 Utility，Renderer、对话快照、Tool 卡和错误消息都不包含可逆凭据。

模型设置已支持：

- OpenAI Compatible、Anthropic Messages 与 Gemini Generate Content；
- 内置服务预设、多个 Profile、默认 Profile、启用/停用和删除；
- Base URL、模型 ID、API Key 与自定义 Header；
- 连接、流式输出与 Tool Call 能力验证，以及最近验证快照。
- 默认 Profile 在磁盘恢复后由 Main 重新注入 Utility；再次打开应用无需重复选择模型。

三种协议统一产出文本增量、Tool Call 增量和完成事件。多 Tool 流使用协议调用槽位关联后续参数分片；Assistant Tool Call 与 Tool Result 历史分别转换为 OpenAI `tool_calls`、Anthropic `tool_use/tool_result` 和 Gemini `functionCall/functionResponse`，避免第二轮请求丢失工具上下文。

## 2. Runtime 与生命周期

手写 Agent Runtime 常驻 Utility Process，并执行以下代码硬限制：

| 边界 | 实现 |
| --- | --- |
| Active Turn | 同一会话最多一个；新消息先取消旧 Turn |
| Tool Round | 每 Turn 最多 12 轮 |
| Tool Call | 每 Turn 最多 24 次，非法/拒绝/失败同样计数 |
| 只读并发 | 每批最多 4 个 |
| 副作用 | 按模型原始顺序串行并持有冲突域 |
| 主动预算 | 10 分钟；审批和选择等待暂停计时 |
| Provider 空闲 | 90 秒无有效增量超时 |
| Provider 重试 | 仅超时重试，初始请求外最多 5 次，不切换 Profile |
| 收尾 | 达到限额后只允许一次不暴露 Tool 的最终总结 |

Provider 流、Music Service 请求、排队 Tool、审批、选择、播放器命令和状态读取都进入同一 Turn 生命周期。停止、新消息、账户切换和退出会取消未决工作；账户切换在 SQLite 上下文改变前先终止旧 Turn，避免旧请求落到新账户。离开小云路由、折叠导航、最小化和关闭到托盘不会取消 Turn，Renderer 通过应用作用域订阅持续接收完整快照。

## 3. Tool、实体与真实播放器

模型固定可见 10 个核心业务 Tool：

- `smart_search_and_play`
- `control_player`
- `queue_manager`
- `playlist_manager`
- `library_manager`
- `music_explorer`
- `comments_and_social`
- `account_manager`
- `user_profile_memory`
- `request_user_selection`

另有 `find_music_api_capabilities` 与 `call_music_api` 两步兜底。完整 Capability Catalog 不进入 Prompt；调用只接受已登记 ID 和对应参数 Schema，写入型签到仍按 `music.library_playlist` 分类，不能借通用入口绕过审批。相似歌手和评论兜底只接受本轮事实池实体引用，不接受原始 API path。

Entity Resolver 只从本轮标准实体事实池解析 `current`、稳定 ID 和语义名称。普通播放意图按上游相关性、歌名/歌手命中与版本标记优先原唱或最高相关候选并直接播放；只有会实质改变用户意图的歧义才返回选择。SelectionCard 的实体展示字段由 Runtime 从事实池生成，结果返回 `selectedOptionKeys` 与 `selectedRefs`；后续播放用稳定 `entityRef` 直接执行，不重复搜索，也不保存待执行回调。

播放器写入统一发送类型化 `PlayerCommandAction` 到 Renderer 唯一 `PlayerCommandGateway`，携带执行前 `expectedRevision` 并等待真实回执后才向模型报告成功。播放器和队列读取通过独立状态请求取得唯一 `PlaybackCoordinator` 的脱敏快照；封面 URL、媒体 URL、内部错误和凭据不进入模型。队列项写入只接受本轮真实播放器快照中已出现的 `queueItemId`，入队和替换只接受事实池歌曲引用。

## 4. 策略、审批与选择

音乐权限默认 M3。M1～M4 与命令 S1～S4 均为纯函数策略；等级只能放行已经注册且通过 Schema 的能力，不能创建新 Tool、Action 或 Capability。M1 对所有音乐副作用审批，M2 放行播放器/队列，M3 放行音乐库/歌单/公开社交，M4 才放行高影响账户动作。

Approval Coordinator 保证每个 Tool Call 单独批准、拒绝、五分钟过期和生命周期取消；拒绝映射 `USER_REJECTED`，底层 Music Service 与 PlayerCommand 保持零执行。Selection Coordinator 同时只允许一个活动选择，单选和多选均校验 2～5 个唯一选项，固定十分钟过期，选择本身无业务副作用。

## 5. UI 与首次引导

- 小云作为一级路由加入主导航；Agent Store 在应用作用域持续订阅，路由离开不取消 Turn。
- AgentComposer 支持流式状态、停止和模型未配置禁用态。
- Assistant 消息通过持久化的 `toolCallIds` 与工具卡关联，纯工具调用消息不再渲染空文本气泡；应用重启后仍按原消息位置恢复工具记录。
- ToolExecutionCard 只显示调用了什么工具、状态、耗时与脱敏调用参数，不再展示 Tool Result；结果统一由小云消息面向用户表达。
- ApprovalCard 只有“批准”和“拒绝”，无关闭或永久授权；SelectionCard 支持实体封面、单选和多选完成。
- Composer 下方直接展示音乐安全与命令安全控件；安全设置页同步提供 M/S 等级和 Phase 7 Shell 开关说明。
- 七步首次引导覆盖欢迎、播放器、小云、音乐安全、模型配置、网易云登录和完成；模型配置步骤复用正式 Provider Profile 面板。
- 动效遵守减少动态效果，玻璃材质遵守减少透明度，高对比模式补强边界。

构建产物已在隔离用户目录以 1280×800 启动并截图检查；首次引导与小云模型未配置态内容完整，主导航、Composer、安全控件和底部播放器无互相遮挡。

## 6. 自动验证

主要新增验证：

- `tests/unit/agent-policy.test.ts`：M1～M4、S1～S4 与未注册能力拒绝；
- `tests/unit/agent-tool-registry.test.ts`：10+2 正向注册、选择实体引用直达、选择参数 Schema 和未知 Action 拒绝；
- `tests/unit/agent-tool-scheduler.test.ts`：四路只读并发、副作用顺序与冲突域；
- `tests/unit/agent-entity-resolver.test.ts`：唯一实体与同名消歧；
- `tests/unit/agent-interaction-coordinators.test.ts`：审批拒绝/过期、选择纯答案与实体引用；
- `tests/unit/provider-profile-store.test.ts`：公开快照和磁盘均无凭据明文，重启后恢复默认模型；
- `tests/unit/agent-conversation-service.test.ts`：账户隔离的对话、工具与消息关联持久化；
- `tests/integration/agent-main-loop.test.ts`：默认 M3、搜播真实回执与 M1 拒绝零执行；
- `tests/e2e/phase5-agent-workflow.spec.ts`：原唱直播、选择引用直达且不重复搜索、歌单写入、拒绝零执行和播放器状态桥；
- `tests/unit/phase5-agent-ui.test.ts`：工具历史关联、空气泡抑制、调用参数展示和结果隐藏。

最终门禁：

- `pnpm typecheck`：通过；
- `pnpm lint`：通过，0 个错误，架构边界通过；
- `pnpm test`：通过；
- `pnpm test:e2e`：7/7 通过；
- `pnpm smoke:build`：构建产物契约与 Electron 冒烟通过，覆盖 Utility 崩溃恢复、取消、音频可播放、快照恢复和 Renderer 重载重连；
- 隔离用户目录 Electron 视觉检查：1280×800 首次引导和小云页通过。

## 7. 保留边界

- Phase 5 不生成长期记忆或音乐人格画像；`user_profile_memory` 只报告 Phase 6 能力状态。
- Shell、Dynamic Skill 和 MCP 的模型可见执行入口属于 Phase 7；本阶段实现并展示 S1～S4 策略，但不提前把这些动态能力加入模型请求。
- 自动 E2E 使用标准 Music Service 与 Provider 夹具，真实第三方模型计费、速率限制和上游协议差异仍需 Provider 实机矩阵覆盖。
- macOS/Windows 原生窗口、不同 DPI、真实权益账号和真实写入回归继续归入 Phase 8 发布硬化。
