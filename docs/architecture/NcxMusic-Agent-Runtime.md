# NcxMusic 手写 Agent Runtime

> 文档状态：Baseline 0.1
> 建立日期：2026-08-04
> 最后更新：2026-08-11
> 关联决策：A-006、D-013、D-101、D-102、D-103、D-106、D-109、D-110、D-111、D-112

## 1. 目标

小云不使用 Agent 框架。Utility Process 内实现可审计、可取消、可恢复快照的 Agent Runtime，并让 Provider、Tool、权限和 UI 通过稳定事件协作。

核心约束：

1. 产品只有一个连续会话，同时最多一个 Active Turn。
2. LLM 只提出 Tool Call，不决定权限、并发、超时、重试或是否真正执行。
3. 所有 Tool Call 必须经过 Schema、Policy、Scheduler 和 Executor，不能直接调用底层 API。
4. 只读工具可以受控并行，有副作用的操作必须按冲突域确定性串行。
5. 限额、取消和失败必须产生明确终态，不能让 UI 永久停在“执行中”。

### 产品输出基线

- Agent 正式名称为“小云”，首版不提供重命名或人格切换。
- 默认使用简体中文，语气友好、自然、简洁，优先给出结果；复杂任务提供必要进度，用户明确要求时再展开细节。
- 小云不能把“已发送命令”表述为“已执行成功”，所有操作性结论都必须来自真实 Tool Result。
- 首页“小云为你推荐”只展示内容，不自动播放或修改队列。用户明确提出“随便放点歌”“来点适合现在听的”等开放式播放意图时，小云可依据画像与当前上下文选歌并立即播放，无需先展示 SelectionCard；真实播放仍经过正常工具与音乐权限规则。
- 音乐安全默认等级为 M3。普通播放请求优先选择原唱或最高相关候选并立即播放；只有会实质改变意图且无法可靠判断的歧义才请求选择。

## 2. 运行时组件

```text
TurnCoordinator
├─ ContextBuilder
├─ ProviderAdapter / StreamNormalizer
├─ ToolRegistry / ToolSchemaValidator
├─ PolicyGateway
├─ ToolScheduler
├─ ToolExecutor
├─ ApprovalCoordinator
├─ LimitController / CancellationController
├─ MemoryWriter
└─ RuntimeEventSink
```

- `TurnCoordinator`：单 Turn 状态机和循环入口。
- `ContextBuilder`：组装系统提示词、当前块、Working Memory、画像片段、Skill Prompt 和可见 Tool Schema。
- `ProviderAdapter`：适配 OpenAI Compatible、Anthropic Messages 和 Gemini，并归一化增量事件。
- `ToolRegistry`：保存工具元数据、输入/输出 Schema、风险分类和冲突域生成器。
- `PolicyGateway`：在能力注册校验通过后调用纯函数权限引擎，返回允许或需要审批；作用域或策略校验失败时返回确定性拒绝。
- `ToolScheduler`：控制并行度、资源锁、排队顺序和取消。
- `ToolExecutor`：执行内置工具、音乐 API、PlayerCommand、MCP、Skill 或 Shell Adapter。
- `RuntimeEventSink`：写入 IPC 事件、ToolExecutionCard、Action Journal 和调试日志。

## 3. Turn 状态机

```text
queued
  → building_context
  → requesting_model
  → streaming_model
  ├─ finalizing → completed
  └─ validating_tool_batch
       → scheduling_tools
       ├─ awaiting_approval
       ├─ executing_tools
       └─ collecting_results
            → requesting_model

任意非终态
  ├─ cancelling → cancelled
  ├─ failing → failed
  └─ limit_reached → finalizing → completed
```

同一会话只有一个 Active Turn。离开小云路由、折叠主导航、最小化窗口、关闭到托盘或语音悬浮组件消失不会取消 Turn。点击停止、退出应用、账号切换或 Runtime 故障触发相应取消/失败规则；用户在 Active Turn 中发送新消息时，旧 Turn 以 `superseded_by_user_message` 取消，再立即用新消息创建 Turn。

## 4. Tool Call 状态机

```text
received
  → validating
  ├─ invalid
  └─ resolving_capability
       ├─ unavailable
       └─ policy_check
            ├─ denied
            ├─ awaiting_approval
            │    ├─ rejected
            │    ├─ approval_cancelled
            │    └─ queued
            └─ queued
                 ├─ awaiting_user_selection
                 │    ├─ selected → succeeded
                 │    ├─ selection_cancelled
                 │    └─ selection_timed_out
                 └─ executing
                      ├─ succeeded
                      ├─ failed
                      ├─ timed_out
                      └─ cancelled
```

每个 Tool Call 在进入下一轮模型请求前必须拥有一个终态结果。Provider 一次返回多个 Tool Call 时，Runtime 按原始顺序回填结果，即使内部并行完成顺序不同。

## 5. Tool 元数据

每个工具注册时至少声明：

```ts
interface ToolDefinition {
  name: string
  description: string
  inputSchema: ZodType
  outputSchema: ZodType
  classify(input: unknown, context: ToolContext): ToolOperation
  execute(input: unknown, context: ToolContext): Promise<ToolResult>
}

interface ToolOperation {
  action: string
  effect: 'read' | 'interaction' | 'write' | 'external-process' | 'install'
  riskAction: string
  concurrency: 'parallel' | 'serial'
  conflictKeys: string[]
  cancellable: boolean
  timeoutPolicy: string
  retryPolicy: string
}
```

模型只能看到完成裁剪后的名称、描述和输入 Schema。高层 Tool 使用判别式 `action` 输入；`classify()` 在 Schema、能力和实体解析完成后，根据规范化 action/参数生成本次调用的 effect、风险、冲突域、超时与重试规则。一个 Tool 内的只读 `list` 和写入 `delete` 不能共享静态风险标签。分类器和执行函数属于 Runtime 内部元数据，不进入 Prompt，也不能由 Dynamic Skill 覆盖。

Tool Registry 是正向能力边界：只有注册成功且在当前账户、功能开关与扩展状态下可见的 Tool 才会进入模型请求。Runtime 仍必须防御模型伪造名称；未知 Tool、未声明 Action 或 Music Gateway 未注册的 `capabilityId` 在 `resolving_capability` 阶段结束为 `unavailable`，返回 `CAPABILITY_UNAVAILABLE`，不进入审批和 Executor。

### 内置 Tool 暴露策略

首版模型可见的音乐/账户核心 Tool 固定为：`smart_search_and_play`、`control_player`、`queue_manager`、`playlist_manager`、`library_manager`、`music_explorer`、`comments_and_social`、`account_manager`、`user_profile_memory`、`request_user_selection`。底层 NeteaseCloudMusicApiEnhanced endpoint 只作为 Adapter/Capability 登记，不自动成为模型 Tool。

冷门能力使用 `find_music_api_capabilities` 与 `call_music_api` 两步兜底。前者是只读目录检索，只返回本次最相关的少量 capability 说明、参数契约和实体引用要求；后者只接受目录中已注册的 `capabilityId`，根据该条目的 Zod Schema 验证参数并复用 Entity Resolver。完整目录不注入 System Prompt，`call_music_api` 也不接受原始 API path。

Shell Tool、`mcp_manager`、已连接 MCP Tool 和 Dynamic Skill Tool 根据功能开关与安装状态动态加入可见集合，不计入上述 10 个内置核心业务 Tool。动态工具仍必须经过 Tool Registry、Schema、Policy 和 Scheduler，不能覆盖内置工具元数据。

### 用户选择工具

`request_user_selection` 是 Runtime 内置的 `effect: interaction` Tool，本质是让模型把一个选择题呈现成可点击答案以减少用户输入，不是业务操作。它声明 `single | multiple` 模式并接受 2~5 个可混排选项：`entity` 选项只引用本轮工具结果或 Entity Pool 中已有实体，由 Runtime 解析安全展示字段；`text` 选项只包含稳定 `optionKey`、纯文本标题和可选简短说明。模型不能直接构造原始网易云 ID、HTML、Markdown、组件 Props、图片 URL 或可执行回调。

该 Tool 进入 `awaiting_user_selection` 后暂停自己的结果返回，但不产生业务副作用，也不走 M/S 审批。单选点击即提交且结果长度为 1；多选允许选择 1~5 项，在点击“完成”后提交。两种模式统一返回 `selectedOptionKeys`，实体选项另汇总到 `selectedRefs`；这个结果仅等价于用户回答了问题。点击“取消”返回 `SELECTION_CANCELLED`，固定等待 10 分钟后返回 `SELECTION_EXPIRED`。随后是否调用播放、收藏或歌单工具由模型下一轮重新决定，新的业务 Tool Call 必须重新经过能力校验和 Policy；播放场景必须把 `selectedRefs` 作为 `entityRef` 直接调用，不得再次按文本搜索。Selection Tool 不保存待执行回调、业务 Tool 名称或参数模板，`optionKey` 也不能被 Executor 当作命令分派键。

同一 Active Turn 最多存在一个 `awaiting_user_selection` Tool Call；同批次其他交互调用保持排队，避免同时出现多个选择卡。选择工具计入 24 次 Tool Call 上限。离开页面、收起侧栏、最小化窗口和关闭到托盘不改变状态；Renderer 重载从 Snapshot 恢复剩余时间。用户发送新消息时取消旧选择和旧 Turn，再创建新 Turn。应用退出、账号切换或 Runtime 故障取消选择，不跨应用恢复。

## 6. 调度规则

### 只读工具

- `effect: read`、无依赖且冲突键不互斥时最多并行 4 个。
- 并行上限是整个 Turn 的总上限，不是每个工具各 4 个。
- 同一上游 API Adapter 可以设置更低的独立并发和限流规则。
- 画像分析等组合工具在 LLM 侧计为一次 Tool Call，但内部 API 扇出必须有独立预算和并发限制。

### 有副作用工具

- `write`、`external-process` 和 `install` 默认串行。
- 同一模型批次内按 Tool Call 原始顺序取得资源锁，禁止依赖完成速度改变执行顺序。
- 最低冲突域包括：
  - `player:queue`
  - `account:<id>:favorites`
  - `account:<id>:playlist:<playlistId>`
  - `account:<id>:comments`
  - `shell:<workspace>`
  - `mcp:install`
  - `skill:install`
- PlayerCommand 还必须携带 `expectedRevision`，由 Renderer 的 PlaybackCoordinator 最终判定是否过期。

### 混合批次

同一模型响应同时包含安全只读调用和需要审批的写调用时，独立的只读调用可以先执行；需要审批的调用保持挂起。由于模型协议要求完整回填本批次工具结果，下一轮模型请求必须等待该批次全部 Tool Call 进入终态，但播放器和其他应用功能不受阻塞。

## 7. 硬限额

```text
maxToolRoundsPerTurn = 12
maxToolCallsPerTurn  = 24
maxParallelReadTools = 4
maxActiveTurns       = 1
activeTurnBudgetMs   = 600_000
```

- Tool Round 指一次模型响应提出工具、Runtime 回填结果并准备再次请求模型的完整循环。
- Tool Call 在模型提出时立即计数；参数无效、策略拒绝、用户拒绝和执行失败仍计入，防止模型通过失败重试绕过上限。
- 组合工具内部 API 调用不占 LLM Tool Call 计数，但必须由该工具自己的 Budget 限制。
- 达到任一限额后不再暴露/执行新工具，Runtime 允许一次不带 Tools 的最终模型请求，要求总结已完成内容、未完成原因和用户可采取的下一步。
- 最终总结请求不计为新的 Tool Round，且不能通过文本触发隐式工具执行。
- 限额是代码硬限制，System Prompt 只能告知，不能放宽。
- `activeTurnBudgetMs` 只累计模型请求、工具调度和执行的主动运行时间；ApprovalCard 的 5 分钟等待与 SelectionCard 的 10 分钟等待暂停该计时。

## 8. 审批挂起

### 音乐权限动作分类

Policy Engine 先把音乐 Tool Call 归一化为稳定动作类别，再用用户当前的 M 等级判断。动作名称、对象 ID、目标账户和关键参数都进入规范化输入；不能按自然语言描述或工具展示文案判断权限。

| 动作类别 | 最低免审等级 | 典型动作 |
| --- | ---: | --- |
| `music.playback_queue` | M2 | 播放/暂停、切歌、进度、音量、播放模式、队列插入/移除/排序/替换/清空 |
| `music.library_playlist` | M3 | 喜欢/取消喜欢、收藏/取消收藏、签到、创建/重命名歌单、增删/排序歌单歌曲 |
| `music.public_social` | M3 | 发表评论/删除评论、评论点赞、关注/取消关注 |
| `music.account_high_impact` | M4 | 删除整个自建歌单、修改头像/昵称/资料、手机等账号绑定、退出登录 |

- M1 对全部受支持音乐动作返回 `require_approval`；达到动作规定的最低等级后返回 `allow`，否则仍返回 `require_approval`。
- 用户直接操作 UI 不经过 Agent Policy Engine；对应的人类主动危险确认由 AlertDialog 等 UI 规则处理。
- MCP 安装不属于音乐动作，任何 M 等级都只能返回 `require_approval`。
- 支付、购买、订阅、下单和代购不注册为 Tool，也不进入 Music API Capability Catalog；请求未注册 Tool、Action 或 `capabilityId` 时返回 `CAPABILITY_UNAVAILABLE`，不进入 Policy、审批或 Executor。

- Policy 返回 `require_approval` 后创建稳定 `approvalId`，Tool Call 进入 `awaiting_approval`。
- ApprovalCard 只显示“批准”“拒绝”两个按钮；不提供“批准本次”“本会话允许”“总是允许”或其他授权范围。
- ApprovalCard 不提供关闭按钮，并在创建 5 分钟后固定过期。离开小云页面、折叠主导航、最小化窗口或关闭到托盘不会处理审批；Renderer 重载从 Snapshot 恢复卡片和剩余时间。
- 用户拒绝映射为 `USER_REJECTED`，过期映射为 `APPROVAL_EXPIRED`，应用退出、账号切换、Utility Process 故障或 Turn 取消映射为 `APPROVAL_CANCELLED`；面向模型返回裁剪后的结构化结果。
- 用户批准只解除当前规范化 Tool Call 的挂起，不代表相同工具、参数或后续调用获得会话级或永久授权。工具、参数、目标账号、账户 generation 或 `commandId` 改变后必须重新判断。
- 审批过程中不能预执行底层副作用、预启动 Shell/MCP 进程或提前写配置。
- 具体音乐能力目录、M1~M4 动作映射、Shell S1~S4 分类和作用域校验由 A-007 定义；权限等级不能动态注册新能力。

## 9. 取消语义

用户点击“停止”时：

1. Provider 流使用 AbortSignal 立即请求取消。
2. 尚未开始的 Tool Call 标为 `cancelled` 并从队列移除。
3. 未决审批进入 `approval_cancelled`，不是伪造“用户拒绝”。
4. 正在执行且支持取消的工具接收 AbortSignal。
5. 已越过不可逆提交点的工具继续获取真实结果，不能向用户谎报已撤销；结果只用于状态一致性和审计，不自动开启下一轮模型调用。
6. Turn 在所有必要清理完成后进入 `cancelled`，UI 清除 Streaming/Running 状态。

取消不是回滚。收藏、评论、歌单写入、Shell 命令和安装动作是否支持补偿，由具体工具定义，Runtime 不自动执行相反操作。

用户在 Active Turn 期间发送新消息时复用同一取消路径：停止 Provider 流，移除尚未执行的 Tool Call，取消未决 ApprovalCard 与 SelectionCard，并在必要清理后立即处理新意图。已经成功的操作不回滚；已越过不可逆提交点的操作取得真实结果并写入记录，但不会继续驱动旧 Turn。

## 10. 错误与重试

- Tool Result 使用稳定错误码、可读摘要、`retryable` 和脱敏详情。
- 写操作、Shell、安装和审批后操作不允许透明自动重试。
- 音乐 API 等只读工具只在连接超时、限流或临时 `5xx` 服务错误时最多自动重试 2 次，并采用带随机抖动的短指数退避；鉴权、参数、资源不存在和确定性业务错误不重试。
- 当前 Provider 的模型请求仅在超时时最多自动重试 5 次，即初始请求之外最多再发起 5 次。重试不切换 Provider Profile，不绕过 10 分钟 Turn 主动运行上限，也不重置轮次和 Tool Call 预算。
- 模型响应未完整结束前不执行其中的 Tool Call；发生超时时丢弃本次未完成响应，再重新请求。已经完成的历史 Tool Result 保留在上下文中，重试后产生的新 Tool Call 仍重新经过 Schema、Policy、幂等和调度校验。
- Provider 的鉴权、配额耗尽、请求格式、内容策略和明确不支持等非超时错误不进入上述 5 次重试。
- Provider 失败不能自动切换到另一个 Provider Profile，因为模型、价格和数据接收方可能不同。
- Tool Schema 错误返回给模型后允许其在剩余预算内修正，但每次失败仍占 Tool Call 计数。

默认超时基线：

```text
musicApiReadTimeoutMs = 20_000
playerCommandTimeoutMs = 10_000
providerIdleTimeoutMs = 90_000
shellDefaultTimeoutMs = 120_000
activeTurnBudgetMs = 600_000
maxReadToolRetries = 2
maxProviderTimeoutRetries = 5
```

`providerIdleTimeoutMs` 从最近一次有效增量重新计时，而不是限制模型完整回答只能持续 90 秒。具体 Tool 可声明更短的超时；需要更长时间的 Shell 调用必须在 Tool 参数与审批展示中明确声明，但仍受 Shell Policy 的硬上限约束。

## 11. 事件与持久化

Runtime 至少发布：

- Turn 状态与计数快照。
- 文本/思考增量。
- Tool Call 接收、排队、审批、执行和终态。
- 限额、取消、Provider 用量和结束原因。

Renderer 重连时按 A-004 拉取 Active Turn Snapshot，不依赖重放所有文本增量。Runtime 为每条 Assistant 消息保存关联的 `toolCallIds`，Renderer 按消息渲染工具卡，纯工具调用消息不生成空文本气泡。ToolExecutionCard 只显示工具名、状态、耗时和脱敏调用参数，不显示 Tool Result；结果由 Assistant 文本归纳。

当前账户的消息、工具和交互终态在状态变化后短防抖写入 SQLite 对话快照，并在账号切换或退出前刷新。10 分钟规则只负责关闭会话块和生成摘要，不作为首次写入条件。应用启动或账户切换后先恢复对应账户快照，再对 Renderer 宣告 Utility 就绪。

应用真正退出后不恢复未完成 Turn，也不自动重跑纯只读任务。下次启动保留对话和工具记录，将末次任务标记为“上次任务已中止”，由用户手动继续。Utility Process 在应用仍运行时崩溃，只自动恢复连接和可用状态；旧 Turn 结束为失败，任何副作用均不自动重放。

## 12. 上下文容量管理

- ContextBuilder 以 Provider 声明、模型目录或用户配置得到的可用上下文窗口为基准；预计输入达到 70% 时自动压缩，不要求用户手动管理。
- 压缩必须保留系统与权限规则、当前用户意图、当前 Turn 未完成事项、最近消息、有效 Tool Result、必要 Working Memory 和已经确认的用户约束。
- 较早的对话块使用已有块摘要替代全文；体积较大的只读结果保留结构化摘要与稳定引用，需要时再从本地历史检索。
- 压缩不得删除待审批/待选择对象、幂等键、账户 generation、当前播放引用或导致副作用被重复规划的执行结果。
- 如果无法可靠取得模型上下文容量，Provider Profile 必须要求明确配置或使用经验证的保守值；不得猜测一个超大窗口后依赖上游报错。

## 13. 验收测试

- 25 个 Tool Call、13 轮循环和无效参数连续修正均能被硬限额阻止。
- 4 个只读工具并发，第 5 个排队；写工具按冲突域和原始顺序执行。
- 同批次只读成功、写工具待审批时，模型不提前进入下一轮，播放器不被阻塞。
- 停止流式响应、停止排队工具、取消审批和不可逆执行完成分别得到正确终态。
- Renderer 重连后恢复同一 Turn Snapshot，不重复 Tool Call；Utility Process 重启后旧 Turn 明确中断。
- 用户拒绝、策略拒绝、参数错误、超时和用户取消在模型结果与 UI 中可区分。
- Active Turn 中发送新消息会取消旧流、排队工具、审批与选择，已完成或不可逆操作保持真实状态，并立即建立新 Turn。
- 只读工具只对临时错误最多重试 2 次；Provider 超时最多重试 5 次，任何非超时 Provider 错误均不触发该策略。
- 90 秒无模型增量、20 秒音乐 API、10 秒 PlayerCommand、120 秒默认 Shell 和 10 分钟主动 Turn 均能得到确定性超时终态。
- 上下文预计达到 70% 时完成压缩，并保留当前目标、未完成事项、必要 Tool Result、权限规则和副作用执行事实。
