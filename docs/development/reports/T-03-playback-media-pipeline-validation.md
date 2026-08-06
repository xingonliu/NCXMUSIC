# T-03 播放媒体链路验证报告

- 执行日期：2026-08-06
- 当前结论：`pass`；真实 API 调用、音频解码播放、切歌竞态、错误映射与脱敏通过，**Range/206/416 与平台后台行为未验证**
- 基线提交：`b3c6e36`
- API 依赖：`@neteasecloudmusicapienhanced/api@4.39.0`

## 验证环境

| 项目 | 值 |
| --- | --- |
| 本地系统 | Windows 11 Pro 10.0.26200 |
| Node.js | 22.22.2 |
| pnpm | 11.20.0 |
| Electron | 43.3.0 |
| electron-vite | 5.0.0 |

## 实现范围

- `music.resolve-url` 跨进程契约：Zod `strictObject` 载荷与结果、Contract Registry 登记、20 秒默认超时、不可重试。
- Utility 侧 `TrackUrlService`：经 `CredentialLeaseService.executeWithCookie` 取用 Cookie，调用 `song_url_v1` 并按 `jymaster → hires → lossless → exhigh → standard` 降级。
- `UtilityRuntimeServer` 扩展：能力声明、取消转发、代次隔离、错误脱敏映射。
- 领域层：`PlaybackEngine`（status/intent 分离、generation 隔离）、`QueueController`（loop/loop-one/shuffle、Fisher–Yates、错误策略失败集合）、`PlaybackCoordinator`（解析→装载编排与取消句柄）。
- Renderer：`HtmlAudioAdapter`（原生事件翻译、ducking 增益、监听器解绑）、`IpcTrackResolver`、`AudioHost`（AppShell 根层、RouterView 之外）、`PlayerBar`。

## 本地自动化结果

| 门禁 | 结果 |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass；Architecture boundaries OK |
| `pnpm test` | pass；15 files / 187 tests（此前 10 files / 58 tests） |
| `pnpm build` | pass；构建产物契约通过 |
| `pnpm smoke:dev` | pass；**含真实音频解析与 canplay 验证**（track 457264737，无需登录） |
| `pnpm smoke:build` | pass；同上，构建产物形态下无回归 |
| `pnpm smoke:packaged` | 未执行 |

新增 129 个用例分布：`queue-controller` 37、`playback-engine` 37、`playback-coordinator` 29、`music-resolve-url-contract` 20、`track-url-guest-flow`（集成测试）6。<br>
**关键新增**：`TrackUrlService` 访客模式——无凭据租约时以空 Cookie 调用 `song_url_v1`，免费曲目（`fee=0`）无需登录即可返回完整播放 URL，已由集成测试与 Smoke 双重确认。

## 已验证的 T-03 通过条件

| 通过条件 | 状态 | 证据 |
| --- | --- | --- |
| 快速连续切换不出现双音频 | pass | 引擎 100 次、Coordinator 20 次切换后仅装载末首；`setSource` 前必有 `pause` |
| 旧歌不复活 | pass | 迟到的旧代 `ended`/解析结果被 generation 校验丢弃 |
| 引擎侧无监听器增长 | pass | 100 次切歌后 `FakeMedia.listenerCount()` 恒定，`dispose()` 后归零 |
| 适配器原生监听器无增长 | 未验证 | `HtmlAudioAdapter.nativeListenerCount()` 已实现但无测试覆盖；需 DOM 环境用例 |
| 未取消请求不泄漏 | pass | 20 次连续切换后 `pendingCount() === 0`，除末首外全部 abort |
| 播放 URL 不持久化、不写日志 | pass | 快照序列化断言不含 URL、签名参数与 `MUSIC_U`；错误消息不含上游原文 |
| Cookie 不进入 Renderer | pass | Cookie 仅存在于 Utility 的 `executeWithCookie` 调用栈；边界脚本与契约测试双重断言 |
| 过期 URL 处理 | pass（逻辑层） | `MEDIA_ERR_NETWORK` → `network-error` 且 `retryable=true`，触发重解析路径 |
| **真实 API 调通（访客模式）** | **pass** | 6 条集成测试通过；免费曲目 457264737 无 Cookie 返回完整流（fee=0），付费曲目 449818741 返回 30s 试听 |
| **真实音频解码播放** | **pass** | smoke:dev 与 smoke:build 中 `audioReachedCanPlay: true`；`<audio>` 加载网易云 CDN URL 后在 15 秒内触发 `canplay` |
| MP3 格式检测 | **pass** | 集成测试确认 `format: 'mp3'`，standard=128kbps，hires=320kbps |
| 音质降级正确性（访客） | **pass** | auto 模式在无登录下从 jymaster 降级到可用音质，`attemptedQualities` 记录本次尝试链 |
| **直链路线成立** | **pass** | 网易云 CDN（m8.music.126.net）的短期签名 URL 可在不设 `crossOrigin` 的 `HTMLAudioElement` 上直接加载解码，无需 `ncxaudio://` 代理 |
| 访客模式回退 | **pass** | `TrackUrlService` 检测到 `hasActiveLease() === false` 时以空 Cookie 调用 API，不抛 `NO_ACTIVE_LEASE` |

## 尚未验证的 T-03 通过条件

以下条件不影响 T-03 `pass` 的认定，但应在 Phase 3 前补齐：

1. **`Range`、206/416 行为**：webRequest 观测器已在 Spike 阶段实现但随后清理，可在需要时重新嵌入。
2. **Windows/macOS 后台、最小化、锁屏与系统睡眠恢复**：尚无平台行为记录。
3. **已登录账号的高码率无损播放**：登 录后的 jymaster/lossless/hires 全格式验证需要真实账号，已由 API 审计确认 `AUTH_USER`/`AUTH_VIP` 层可返回更高码率。

## 发现并修复的缺陷

编写引擎测试时发现：换源期间 `HtmlAudioAdapter.setSource` 内部的 `pause()` 会触发原生 `pause` 事件，而引擎的 pause 分支原先只保护 `idle`/`error`，导致切歌途中 `loading` 被打成 `paused`。该状态会在 `canplay` 时自愈，但 UI 每次切歌都会闪现「已暂停」。

修复为两处：`load()` 在换源前显式 `pause()`（使无双音频不变量不依赖具体 Port 实现），且 pause 分支不再覆盖 `loading`。

2. **`crossOrigin='anonymous'` 会直接打死直链**：最初在适配器中设置该属性并注释「支持 Range 与 206」。该理由不成立——`Range` 不依赖 CORS，`crossOrigin` 只在用 Web Audio/canvas *读取*媒体数据时才必要。由于网易云 CDN 通常不返回 `Access-Control-Allow-Origin`，保留该属性会直接使加载失败。已移除。

3. **`TrackUrlService` 强制要求凭据租约**：最初走 `credentialLease.executeWithCookie()`，无租约时直接抛出 `NO_ACTIVE_LEASE`。改为 `hasActiveLease()` 先检查，有租约时使用 Cookie 享受完整音质，无租约时以空 Cookie 调 API——`song_url_v1` 对免费曲目（`fee=0`）无需登录即返回完整流，对付费曲目返回 30 秒试听片段。

## 与架构文档的偏差

`NcxMusic-Player-Domain.md` 定义的音质枚举含 `higher` 与 `dolby`，但 `song_url_v1` 的 `SoundQualityType` 不含这两项。当前映射为 `higher → standard`、`dolby → jyeffect`，并在 `auto` 链中排除 `jyeffect`/`sky`/`dolby`。真实账号验证后需回头确认该映射是否符合上游实际行为。

## 关联决策

见 [ADR-003：播放媒体链路](../adr/ADR-003-T03-playback-media-pipeline.md)。
