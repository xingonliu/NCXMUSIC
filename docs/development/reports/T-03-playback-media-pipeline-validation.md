# T-03 播放媒体链路验证报告

- 执行日期：2026-08-06
- 当前结论：`in-progress`；协议链路、状态机与竞态隔离已验证，**真实音频播放尚未验证**
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
| `pnpm test` | pass；14 files / 181 tests（此前 10 files / 58 tests） |
| `pnpm build` | pass；构建产物契约通过 |
| `pnpm smoke:dev` | pass；T-01/T-02 握手、取消、崩溃恢复与重载快照无回归 |
| `pnpm smoke:build` | pass；同上，构建产物形态下无回归 |
| `pnpm smoke:packaged` | 未执行 |

新增 123 个用例分布：`queue-controller` 37、`playback-engine` 37、`playback-coordinator` 29、`music-resolve-url-contract` 20。

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

## 尚未验证的 T-03 通过条件

以下条件构成 T-03 达到 `pass` 的剩余工作，当前**不能**据现有证据宣称通过：

1. **真实格式加载与播放**：MP3、AAC、FLAC 等 API 实际返回格式的 load/play/pause/seek/cancel/切歌，需要真实登录账号或本地支持 Range 的音频服务器。
2. **`Range`、206/416 行为**：现有断言全部基于假媒体元素，没有观测真实 HTTP 分段请求与状态码。
3. **Windows/macOS 后台、最小化、锁屏与系统睡眠恢复**：尚无平台行为记录。
4. **直链路线是否成立**：按 Spike 计划的候选顺序，当前实现走「Renderer `<audio>` 直接播放 Utility 返回的短期 HTTPS URL」。该路线能否成立必须由真实直链观测确认；若失败则需回退到受控 `ncxaudio://` 或等价代理。

第 4 项是当前最大的未知风险：它决定 T-03 走「直接 HTTPS 直链」还是「受控代理」路线，而这一选择会影响 Phase 3 的实现形态。

实现期间已就此修正一处：适配器最初设置了 `crossOrigin='anonymous'`，理由写作「支持 Range 与 206」。该理由不成立——`Range` 与 206 不依赖 CORS，`crossOrigin` 只在需要用 Web Audio 或 canvas *读取*媒体数据时才必要，而本实现的 ducking 走 `element.volume` 相乘。由于网易云 CDN 通常不返回 `Access-Control-Allow-Origin`，保留该属性会直接使直链加载失败。已移除并在代码中记录原因。

## 发现并修复的缺陷

编写引擎测试时发现：换源期间 `HtmlAudioAdapter.setSource` 内部的 `pause()` 会触发原生 `pause` 事件，而引擎的 pause 分支原先只保护 `idle`/`error`，导致切歌途中 `loading` 被打成 `paused`。该状态会在 `canplay` 时自愈，但 UI 每次切歌都会闪现「已暂停」。

修复为两处：`load()` 在换源前显式 `pause()`（使无双音频不变量不依赖具体 Port 实现），且 pause 分支不再覆盖 `loading`。

## 与架构文档的偏差

`NcxMusic-Player-Domain.md` 定义的音质枚举含 `higher` 与 `dolby`，但 `song_url_v1` 的 `SoundQualityType` 不含这两项。当前映射为 `higher → standard`、`dolby → jyeffect`，并在 `auto` 链中排除 `jyeffect`/`sky`/`dolby`。真实账号验证后需回头确认该映射是否符合上游实际行为。

## 关联决策

见 [ADR-003：播放媒体链路](../adr/ADR-003-T03-playback-media-pipeline.md)。
