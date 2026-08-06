# ADR-003：播放媒体链路与播放域装配

- 状态：Accepted；访客模式真实 API 调用与音频解码播放已验证，直连 HTTPS 路线成立；Range/206/416 与平台后台行为待补
- 日期：2026-08-06
- 对应 Spike：T-03

## 背景

T-03 要验证 Renderer 的 `<audio>` 能否直接播放 Utility 返回的短期 HTTPS 音频 URL，并在此过程中确认 Cookie 不进入 Renderer、播放 URL 不落盘不写日志、快速切歌不产生双音频或悬挂请求。

T-02 已提供可撤销的 Utility 内存 Cookie 租约，但没有任何音乐 API 调用、播放域或媒体宿主。`src/domains/**` 与 `src/infrastructure/**` 在本次之前全部为空占位。

## 决策

1. **采用候选顺序一：直连 HTTPS。** Utility 调用 `song_url_v1` 取得短期签名 URL 并原样返回，Renderer 的 `HTMLAudioElement` 直接加载。暂不实现 `ncxaudio://` 自定义协议，符合 Spike Plan「不为了隐藏短期签名 URL 自建不完整协议」的约束。

2. **URL 解析在 Utility，播放在 Renderer。** 新增 `music.resolve-url` 请求登记进 Contract Registry（`defaultTimeoutMs=20_000`、`retryable=false`）。Utility 侧 `TrackUrlService` 经 `CredentialLeaseService.executeWithCookie()` 取用 Cookie，Cookie 明文不离开该调用栈，响应体只含 `ResolvedMediaSource`，无任何 Cookie 字段。

3. **能力按注入声明。** `UtilityRuntimeServer` 接受可选 `TrackUrlHandler`；未注入时 `system.hello` 不声明 `music.resolve-url`，且该请求返回 `CAPABILITY_UNAVAILABLE`。运行时能力集合与实际可用能力保持一致。

4. **上游错误一律脱敏后映射为协议错误。** `track-unavailable`/`account-unavailable`/无租约统一映射为 `CAPABILITY_UNAVAILABLE`，未知异常映射为可重试的 `UTILITY_UNAVAILABLE`。错误 `message` 不含上游原文、Cookie 或播放 URL。

5. **纯逻辑入 `domains`，DOM 副作用入 `renderer`。** `PlaybackEngine`、`QueueController`、`PlaybackCoordinator` 只依赖 `MediaElementPort` 与 `TrackResolver` 两个接口，不导入 Electron/Vue/DOM，可纯函数测试。`HtmlAudioAdapter`（HTMLAudioElement）与 `IpcTrackResolver`（`window.ncx.runtime`）作为适配器留在 Renderer。

6. **generation 是唯一的竞态仲裁机制。** 每次 `load()`/`stop()` 递增 generation；解析结果、`play()` 拒绝、`ended` 与媒体错误全部按 generation 校验，不匹配即丢弃。`PlaybackCoordinator` 另持 `AbortController`，切歌时先中止上一次解析再换代。

7. **换源前必须先 pause，且该保证下移到领域层。** 原先只有 `HtmlAudioAdapter.setSource` 内部 pause，任何其他 `MediaElementPort` 实现漏掉即会双音频。现由 `PlaybackEngine.load()` 显式 pause 后再 `setSource`，适配器保留自身 pause 作为纵深防御。

8. **`pause` 事件不得覆盖 `loading`。** 换源期间的原生 `pause` 是副产物而非用户暂停，引擎在 `loading` 状态下忽略它，避免每次切歌 UI 闪现「已暂停」。

9. **AudioHost 常驻 AppShell 根层。** 播放器运行时是模块级单例，生命周期不绑定组件树，正常路由切换不会销毁 `HTMLAudioElement`。`PlayerBar` 只订阅快照并投递命令，不持有引擎。

## 结果

- Renderer 只能看到短期 HTTPS URL 与曲目摘要；快照序列化后不含 URL、签名参数或 Cookie，已由测试断言。
- 队列算法（Fisher–Yates 洗牌、删除当前项占位、`loop-one` 与手动 `next` 的差异、错误策略失败集合）可在无 DOM 环境下确定性测试。
- 音质 `auto` 沿 `jymaster → hires → lossless → exhigh → standard` 降级。`higher` 与 `dolby` 是架构层枚举但不在 `SoundQualityType` 中，分别映射为 `standard` 与 `jyeffect`，且不进入 `auto` 链。
- 本阶段不建设搜索页、歌单页、播放列表抽屉与播放进度持久化，留给 Phase 3/4。

## 未关闭项

`Range`/206/416、过期 URL 的真实表现，以及 Windows/macOS 后台、最小化、锁屏与睡眠恢复行为均未验证。这些不影响 T-03 `pass` 的认定，可在 Phase 3 前补齐。
