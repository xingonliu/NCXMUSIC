# NcxMusic 跨进程通信协议

> 文档状态：Baseline 0.1
> 建立日期：2026-08-04
> 最后更新：2026-08-05
> 关联决策：A-001、A-004、D-011

## 1. 目标与边界

本协议连接 Electron Main、Preload、Renderer 和 Utility Process，覆盖音乐 API、Agent 流式输出、工具状态、审批、用户选择、播放器命令和运行时快照。

协议目标：

1. Renderer 不获得通用 `ipcRenderer` 或任意通道调用能力。
2. 所有跨进程输入均视为不可信数据，在入口执行运行时 Schema 校验。
3. 有限操作使用请求/响应，增量与状态变化使用事件，所有任务支持显式取消。
4. Renderer 重载或 Utility Process 重启后不复用旧端口，不重复执行副作用。
5. Cookie、API Key、Shell 环境、数据库句柄、Error 实例和堆栈不能进入业务消息。

## 2. 通道拓扑

```text
Bootstrap / Control Plane
Renderer → Preload → Main ConnectionBroker ↔ Utility Supervisor

Data Plane
Renderer Gateway ↔ Preload MessagePort Adapter
                         ║ transferred MessageChannelMain
                    Utility MessagePort Adapter
```

Main 创建 `MessageChannelMain`，一端通过 `webContents.postMessage` 交给对应窗口的 Preload，另一端通过 `utilityProcess.postMessage` 交给 Utility Process。

- Preload 持有 Renderer 侧端口，并只向 Vue 暴露按用例命名的类型化函数和订阅；不向页面暴露原始 MessagePort。
- Utility Process 持有另一端，注册 Music、Agent、Approval、Selection、Memory 和 PlayerCommand Handler。
- Main 不转发正常业务消息；只负责身份校验、端口配对、进程生命周期、凭据代理和连接状态。
- Main 与 Utility Process 的监督/凭据控制使用单独的窄控制通道，不能与 Renderer 业务数据通道混用。

## 3. 连接握手

1. Preload 初始化后，通过固定 Bootstrap IPC 请求连接。
2. Main 校验 `senderFrame`、窗口实例、页面来源和当前 Utility Process generation。
3. Main 创建新的 `connectionId` 与 MessageChannel，并分别转移两个端口。
4. Preload 与 Utility Process 互发 `system.hello`，声明 `protocolVersion`、应用版本、连接 ID 和能力集合。
5. 双方确认后连接进入 `ready`，Preload 才释放排队的只读请求。
6. 协议主版本不一致时返回 `PROTOCOL_VERSION_MISMATCH`，关闭端口并要求重新加载或更新应用，不尝试猜测字段兼容。

每次 Renderer 文档重载、Utility Process 重启或 Main 重新配对都生成新的 `connectionId`。旧连接上的迟到消息必须丢弃。

## 4. 消息信封

协议使用 Zod 4 `strictObject` 和判别联合定义，未知字段、未知消息名称和错误 Payload 均拒绝。TypeScript 类型只通过 `z.infer` 从 Schema 生成，不维护第二套手写 DTO。

```ts
type ProtocolVersion = 1

interface MessageBase {
  protocolVersion: ProtocolVersion
  connectionId: string
  messageId: string
  sentAt: number
}

interface RequestEnvelope extends MessageBase {
  kind: 'request'
  name: string
  requestId: string
  deadlineAt?: number
  payload: unknown
}

interface ResponseEnvelope extends MessageBase {
  kind: 'response'
  name: string
  requestId: string
  result: { ok: true; data: unknown } | { ok: false; error: ProtocolError }
}

interface EventEnvelope extends MessageBase {
  kind: 'event'
  name: string
  eventId: string
  streamId?: string
  sequence?: number
  payload: unknown
}

interface CancelEnvelope extends MessageBase {
  kind: 'cancel'
  name: string
  requestId: string
  reason: 'user' | 'timeout' | 'navigation' | 'shutdown'
}
```

`name` 不是任意字符串。共享 Contract Registry 必须为每个名称同时登记方向、权限域、Payload Schema、结果 Schema、默认超时和是否允许重试。

## 5. 请求、响应与取消

- 每个请求只允许一个终态响应；响应通过 `requestId` 关联。
- 调用端统一维护 Pending Request Map，并在超时、端口关闭或取消时清理。
- 取消是尽力而为：收到取消后停止尚未开始的任务；已提交给不可取消上游的任务可以继续清理，但结果不得再改变已取消的前端状态。
- 只读请求可按 Registry 策略重试；写操作、Shell、MCP 安装和审批后操作禁止透明重试。
- Renderer 路由切换只取消页面作用域请求，不取消根层播放器、Agent 会话、待审批任务和活动 Selection Tool；选择工具的最终打断规则由其生命周期决策确定。

## 6. 流式事件

Agent 文本增量、思考增量、工具状态和进度使用 `streamId + sequence`：

- 同一 Stream 的 `sequence` 从 0 递增，终态事件只能出现一次。
- Preload 发现序号缺口、重复终态或未知 Stream 时停止应用增量，并请求对应任务快照。
- 文本增量允许合并批次，审批、选择请求、工具结果和播放命令结果不得被合并或丢弃。
- 连接断开后不从旧序号继续复用；新连接先获取 Snapshot，再订阅后续事件。

### 6.1 SelectionCard 交互契约

Utility Process 在 `request_user_selection` Tool 进入等待态后发送 `agent.selection.requested` 事件；Renderer 通过 Preload 的专用方法提交 `agent.selection.resolve` 请求，不获得通用 Agent 事件写入口。

```ts
interface SelectionRequestedPayload {
  selectionId: string
  toolCallId: string
  prompt: string
  mode: 'single' | 'multiple'
  options: Array<
    | {
        kind: 'entity'
        optionKey: string
        candidateRef: string
        entityType: 'song' | 'artist' | 'album' | 'playlist'
        title: string
        subtitle?: string
        artworkUrl?: string
        badges?: Array<'vip' | 'paid'>
      }
    | {
        kind: 'text'
        optionKey: string
        label: string
        description?: string
      }
  >
}

interface SelectionResolvePayload {
  selectionId: string
  optionKeys?: string[]
  action: 'select' | 'cancel'
  accountGeneration: number
}
```

- `options` 固定为 2~5 项且允许 `entity`/`text` 混排。实体展示字段由 Utility Process 根据 Entity Pool 构造；文字字段经过长度、控制字符和纯文本校验。Renderer 不能增删或改写选项。
- Resolve 必须匹配当前活动 `selectionId`、`toolCallId` 的隐含关联、账户 generation 和本次 `optionKey` 集合；迟到、重复、重复 key 或伪造 key 均拒绝。`single` 要求恰好 1 项，`multiple` 要求 1~5 项且不能超过卡片选项数。
- `action: select` 只完成 `request_user_selection` Tool 并返回“用户选择了什么”：`selectedOptionKeys`，以及实体选项内部映射的 `selectedRefs`。协议中不存在选项回调、待执行命令或后续 Tool 参数；它不发送 PlayerCommand，也不调用任何业务 Handler。
- 选择后若模型提出新的播放、收藏或歌单 Tool Call，该调用作为全新的 `commandId` 进入能力、Schema 和 Policy 流程。
- SelectionCard 在创建 10 分钟后过期；路由、侧栏与最小化不取消，Renderer 重载从 Snapshot 恢复。新聊天消息取消旧选择与旧 Turn 后开启新 Turn；应用退出、换号或 Runtime 故障取消且不跨应用恢复。

## 7. 错误协议

```ts
interface ProtocolError {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}
```

错误码必须稳定、可测试，至少包括：

- `PROTOCOL_INVALID_MESSAGE`
- `PROTOCOL_VERSION_MISMATCH`
- `CONNECTION_REPLACED`
- `REQUEST_TIMEOUT`
- `REQUEST_CANCELLED`
- `UTILITY_UNAVAILABLE`
- `CAPABILITY_UNAVAILABLE`
- `POLICY_DENIED`
- `USER_REJECTED`
- `APPROVAL_EXPIRED`
- `APPROVAL_CANCELLED`
- `SELECTION_CANCELLED`
- `SELECTION_EXPIRED`

`message` 是可安全显示或记录的摘要，不能包含堆栈、Cookie、API Key、完整模型请求、Shell 环境或原始上游响应。开发日志中的技术详情同样先脱敏。

## 8. 重连与快照恢复

### Renderer 重载

- 旧端口立即作废，所有页面级 Pending Request 返回 `CONNECTION_REPLACED`。
- Preload 重新请求端口并完成 Hello。
- Utility Process 保留仍在运行的 Agent Task、待审批状态和未过期 Selection Tool，在新连接通过后返回 Snapshot。
- Snapshot 至少包含 Agent Task、未决审批、活动选择及其剩余时间、工具状态、账户会话摘要和可恢复的播放读模型版本。
- Renderer 进程自身崩溃会销毁 AudioHost；新页面只能依据快照重建队列和播放位置，不承诺无缝音频续播。

### Utility Process 退出

- Main 关闭关联端口并向 Renderer 标记 `UTILITY_UNAVAILABLE`。
- 未完成 Agent 请求、工具调用和审批全部进入明确失败/中断终态；旧审批不能在新进程中继续批准。
- 播放器仍由 Renderer 持有，可继续播放已获得的媒体 URL，但新的音乐 API 和 Agent 操作暂不可用。
- Main 在非主动退出时按 1 秒、2 秒、5 秒最多重启 3 次，并建立全新连接；连续稳定运行 5 分钟后清零失败窗口。仍失败则本次应用会话停用本地服务并等待用户显式重试，不能循环拉起或重放旧写请求。

## 9. 幂等与副作用

- 所有播放器命令、收藏、评论、歌单写入、Shell 和安装操作携带独立 `commandId`。
- Utility Process 在执行前登记命令状态，重复 `commandId` 返回已有结果或 `COMMAND_IN_PROGRESS`，不能再次执行底层副作用。
- 连接中断且结果未知时，调用端先查询 `commandId` 状态；无法确认结果时向用户说明，不能自动重发。
- `requestId` 只标识一次传输请求，`commandId` 标识一次业务意图，两者不能混用。

## 10. 安全要求

- Main 对每次 Bootstrap IPC 校验 Sender，不只校验通道名。
- Preload 只暴露领域 Gateway；禁止 `send(channel, payload)`、`invoke(channel, payload)` 等通用 API。
- 所有消息必须满足结构化克隆要求，不传函数、DOM、Port 以外的原生句柄或 Error 实例。
- Contract Registry 使用固定 Allowlist；Dynamic Skill 和 MCP 不能动态增加跨进程消息名称。
- 连续无效消息视为连接异常，记录脱敏审计并关闭端口。

## 11. 验收测试

- 每个 Contract 的合法、缺字段、多字段、错误类型和未知名称测试。
- 请求超时、主动取消、迟到响应和重复响应测试。
- 流式乱序、缺序、重复终态和快照追平测试。
- Renderer 重载、Utility Process 崩溃、重启失败和协议不匹配测试。
- 同一 `commandId` 并发发送、断线后查询和重复恢复测试。
- Sender 校验、敏感字段阻断和错误脱敏测试。
