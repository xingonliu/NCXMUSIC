# ADR-001：Electron 进程骨架与运行时连接

- 状态：Accepted
- 日期：2026-08-05
- 对应 Spike：T-01

## 背景

Renderer 需要使用本地 Utility 能力，但不能获得 Node、`ipcRenderer`、原始 `MessagePort` 或任意 Channel 调用能力。Renderer 重载和 Utility 崩溃还必须可恢复，并阻止旧连接上的迟到消息污染当前状态。

## 决策

1. Main 持有 `ConnectionBroker` 和 `UtilitySupervisor`。Broker 为每次配对生成新的 UUID `connectionId`，通过 `MessageChannelMain` 分别向 Preload 与 Utility 转移端口。
2. Preload 在隔离世界内持有 Renderer 侧端口，只通过 `contextBridge` 暴露 `waitUntilReady`、`ping`、`cancel`、`snapshot`、`retryUtility` 和 `onStatus` 等按用例命名的类型化 Gateway。
3. Preload 与 Utility 在端口上交换协议版本为 1 的 `system.hello`。后续 `ping`、`cancel`、`snapshot` 消息均由严格 Zod Schema 校验，未知字段和未注册消息名直接拒绝。
4. 每条消息携带 `connectionId`。连接替换会立即关闭旧端口、终止旧连接待处理请求；任一端收到非当前连接的迟到消息时丢弃。
5. Utility 意外退出后由 Main 按 1 秒、2 秒、5 秒最多重启三次；连续失败后进入本次会话的 `disabled` 状态，只允许用户显式重试。稳定运行 5 分钟后清零失败窗口。
6. Utility 快照的生命周期属于 Utility 进程，不属于 Renderer 文档。Renderer 重载后建立新连接，通过 `snapshot` 恢复当前进程的 `startedAt`、请求计数和待处理请求视图。

## 结果

- Renderer 的攻击面限制在固定、可审计的业务 Gateway，通用 IPC 不进入页面全局对象。
- 连接世代和 Utility 进程世代被分别建模；页面重载不等同于 Utility 重启。
- 请求超时、取消、进程故障和协议错误统一返回裁剪后的公共错误，不向 Renderer 泄露内部异常。
- 自动化 Smoke 在开发服务、生产构建和解包后的打包应用中执行相同的握手、故障重启、重载恢复断言。

## 取舍

- 首版协议仅注册 `system.ping` 与 `system.snapshot`，取消是控制信封而不是独立业务方法；新增能力必须先扩展共享 Schema 和命名 Gateway。
- 快照当前只验证运行时连接状态，不承担后续播放器或任务领域的持久化；这些领域应在各自协议中定义版本和恢复语义。
