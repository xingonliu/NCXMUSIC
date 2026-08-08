# T-07 系统媒体集成验证报告

- 执行日期：2026-08-08
- 当前结论：`provisional-pass`；Chromium Media Session 契约已接入唯一 PlaybackCoordinator，Windows SMTC / macOS Now Playing 真实锁屏与蓝牙媒体键仍待设备矩阵验证
- 基线提交：本任务完成提交
- 关联架构：`docs/architecture/NcxMusic-Player-Domain.md`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | macOS 26.5.2 (25F84) |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| Chromium 媒体面 | `navigator.mediaSession` |

## 实现范围

- `src/renderer/features/music/system-media-session.ts`：新增 Chromium Media Session 桥，负责同步元数据、封面、播放状态和进度，并将系统媒体动作投递回播放命令。
- `src/renderer/features/music/use-player.ts`：在应用唯一播放器运行时中创建和释放系统媒体桥，不向 UI 暴露第二个播放状态源。
- `src/domains/player/types.ts`：为 `TrackSummary` 增加可选 `artwork` 候选图，供 UI 与系统媒体元数据复用，不携带播放地址或鉴权信息。
- `tests/unit/system-media-session.test.ts`：覆盖元数据/封面/状态/进度同步、系统 play/pause/上一首/下一首/seek 动作、平台不支持动作跳过、dispose 清理和位置裁剪。
- `scripts/run-system-media-spike.mjs` / `.github/workflows/quality.yml`：新增 T-07 专项验证脚本并接入双平台 CI。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `pnpm t07:spike` | pass；目标类型检查通过，`system-media-session` 与 `playback-coordinator` 相关单测 35 条通过 |
| `pnpm typecheck` | pass |
| `pnpm exec eslint src/renderer/features/music/system-media-session.ts src/renderer/features/music/use-player.ts tests/unit/system-media-session.test.ts tests/unit/player-bar.test.ts scripts/run-system-media-spike.mjs` | pass |
| `pnpm exec vitest run tests/unit/player-bar.test.ts` | pass；6 条通过 |

## 已验证的 T-07 条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| 元数据、封面、播放状态同步 | pass（契约层） | 当前曲目被转换为 `MediaMetadataInit`，封面候选图过滤空 `src` 后传给 Media Session |
| 进度同步 | pass（契约层） | 有效时长下调用 `setPositionState`，位置裁剪到 `[0, duration]`，无效时长清理位置状态 |
| 系统媒体动作进入同一命令管道 | pass | play/pause/previous/next/seek 全部调用注入的 `PlaybackCoordinator` 命令，不操作 audio 元素 |
| 不创建第二播放状态源 | pass | 系统媒体桥只订阅 `PlayerSnapshot`，不保存队列、不解析 URL、不持有 HTMLAudioElement |
| 平台差异可降级 | pass | `setActionHandler` 对不支持动作的异常只跳过该动作，不影响其他动作与播放器运行 |
| 生命周期清理 | pass | `dispose()` 清理 handler、metadata、playbackState、positionState 和快照订阅 |

## 尚未验证的 T-07 条件

1. Windows 锁屏界面 / SMTC 面板是否完整展示标题、作者、专辑、封面和进度。
2. Windows 键盘媒体键、蓝牙耳机 AVRCP 控制是否全部由 Chromium Media Session 回调触发。
3. macOS Now Playing 面板、Touch Bar/键盘媒体键、蓝牙耳机控制是否全部由 Chromium Media Session 回调触发。
4. 后台、锁屏、睡眠唤醒、路由切换和窗口最小化组合场景下，系统媒体状态是否与 `PlayerSnapshot` 长时间保持一致。

## 已知非 T-07 阻塞

- `pnpm lint` 当前仍会扫描 `src/renderer/public/assets/shader-worker-CJN-6C3l.js`，该 public 产物缺少 worker/browser lint 环境，报 `self` / `ImageData` `no-undef`。
- `pnpm test` 当前存在范围外失败：T-03 真实网络集成缺少 `xeapi public key`；`tests/unit/shell-policy-classifier.test.ts` 的一个 Windows 路径逃逸断言返回 allow。

## 关联决策

见 [ADR-007：T-07 系统媒体集成策略](../adr/ADR-007-T07-system-media-integration.md)。
