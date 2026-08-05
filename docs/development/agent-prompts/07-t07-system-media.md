# Prompt 07：T-07 系统媒体集成

执行通用协议，只完成 Phase 0 T-07。

## 必读

- 技术验证计划 T-07。
- `docs/architecture/NcxMusic-Player-Domain.md`。
- `docs/architecture/NcxMusic-IPC-Protocol.md`。

## 任务

在 T-03 媒体 Spike 上验证 Windows SMTC、macOS Now Playing/Media Keys 与 Electron 可用能力。系统播放、暂停、上一首、下一首必须转换成共享 `PlaybackCommand`，与 UI/Agent 未来使用同一 Coordinator，禁止建立第二套播放状态。

验证元数据更新、应用后台、锁屏、设备媒体键、快速连续输入和不可用平台 API 的 fallback。不要开发正式队列、PlayerBar 或 Agent。

## 验收

双平台各自给出 `pass` 或明确 fallback，并证明命令没有绕过唯一播放管道。输出 ADR、矩阵和 Checkpoint，然后停止。
