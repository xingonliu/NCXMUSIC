# ADR-007：T-07 系统媒体集成策略

- 状态：Accepted；先以 Chromium Media Session 作为系统媒体集成入口，真实设备矩阵不足时再补最小原生桥
- 日期：2026-08-08
- 对应 Spike：T-07

## 背景

T-07 要验证系统媒体中心、锁屏、蓝牙耳机和媒体键是否能与唯一 AudioHost 集成。播放器架构已经要求 `PlaybackCoordinator` 是播放命令入口，`PlaybackEngine` 是媒体状态事实源，PlayerBar 只是 UI 控件。因此系统媒体集成不能在 PlayerBar 内添加第二套播放器逻辑，也不能绕过队列 revision / generation。

Electron 的 Renderer 运行在 Chromium 内，Chromium Media Session 是最小可用的跨平台系统媒体桥。Windows SMTC 与 macOS Now Playing 的实际表现仍取决于 Electron / Chromium 在目标平台的实现质量，需要真机矩阵补验。

## 决策

1. **系统媒体先走 Chromium Media Session。** Renderer 创建 `SystemMediaSessionBridge`，读取 `navigator.mediaSession`，并把当前 `PlayerSnapshot` 映射为系统元数据、播放状态和位置状态。
2. **所有系统媒体动作回到 PlaybackCoordinator。** play、pause、上一首、下一首、seekto、seekbackward 和 seekforward 只调用 Coordinator 暴露的命令，不直接操作 HTMLAudioElement。
3. **Media Session 只是适配器，不是状态源。** 桥内不保存队列、不解析播放 URL、不维护播放事实；相对 seek 只读取最近一次快照中的 position/duration。
4. **平台不支持动作时局部降级。** `setActionHandler` 抛出 NotSupportedError 或同类错误时只跳过该动作，已支持动作继续工作。
5. **暂不加入原生桥。** 只有当 Windows SMTC 或 macOS Now Playing 真机矩阵证明 Chromium Media Session 无法满足产品约束时，才新增最小原生桥；原生桥仍必须投递同一组 Coordinator 命令，并消费同一份播放快照。

## 结果

- 新增 `src/renderer/features/music/system-media-session.ts`，以纯 Renderer 适配器方式接入 Media Session。
- `usePlayer()` 的应用单例生命周期负责创建和释放系统媒体桥，保持 AudioHost / PlaybackCoordinator / HTMLAudioElement 唯一。
- `TrackSummary.artwork` 成为系统媒体封面的来源，仍不包含播放地址、Cookie 或短期凭据。
- `pnpm t07:spike` 覆盖目标类型检查、系统媒体桥单测和 PlaybackCoordinator 回归测试。
- CI 质量矩阵新增 `pnpm t07:spike`，在 Windows 与 macOS runner 上持续验证契约层。

## 未关闭项

Windows 锁屏/SMTC、macOS Now Playing、键盘媒体键、蓝牙耳机 AVRCP、后台/睡眠唤醒组合场景仍需要真机验证。若这些场景发现 Chromium Media Session 缺口，下一步只允许新增“系统媒体原生适配器”，不得在 PlayerBar 或其他 UI 组件里放入第二套播放状态或第二套音频控制。
