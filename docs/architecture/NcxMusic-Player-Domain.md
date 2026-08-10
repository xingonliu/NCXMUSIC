# NcxMusic 播放域设计（音频状态与播放队列）

> 文档状态：Candidate Baseline 0.3（产品行为已冻结，媒体链路待 Phase 0 验证）
> 最后更新：2026-08-05
> 文档用途：约束播放器音频状态、播放队列和恢复行为；媒体链路技术验证通过后升级为实现基线
> 范围：播放状态机、队列、全局唯一内容音频、音频焦点和持久化。Agent、权限和 IPC 是外部输入源，不在本领域内作决策。
> 当前状态：Vue SPA、根层唯一 AudioHost、PlayerBar 路由可见性、队列入口、上一首、暂停式恢复、三种播放模式、可见队列洗牌、不可播放跳歌、队列删除、无撤销及快照写入规则均已确认；直接 HTTPS/受控媒体代理、格式与系统媒体中心仍按 Phase 0 Spike 验证。

## 1. 技术讨论约束

1. **单一事实源**：`PlaybackEngine` 持有当前媒体状态，`QueueController` 持有队列状态；UI 只消费快照，`HTMLAudioElement` 只是带副作用的执行器。
2. **职责分离**：队列决定“播什么”，引擎负责“把指定媒体播好”，异步 URL 解析由独立 `TrackResolver` 完成。
3. **统一命令入口**：按钮、快捷键、小云、系统媒体键和恢复流程都投递同一种领域命令。
4. **命令向下、事件向上**：调用方发送意图，真实媒体事件和执行结果由引擎上报，不能用 UI 猜测播放状态。
5. **全局只有一个内容音频源**：主播放、试听和 Agent 点播复用同一引擎，不创建第二个内容播放器。
6. **纯转移与副作用分离**：状态归约、队列算法可纯函数测试；媒体调用、URL 获取和持久化作为 Effects/Adapters。
7. **异步结果不得越代写入**：切歌、重取 URL 和媒体事件都绑定 generation，旧任务必须取消或忽略。

## 2. 顶层结构

```text
UI / 快捷键 / 小云 / 系统媒体键
                  │ PlaybackCommand
                  ▼
          PlaybackCoordinator
          ├─ QueueController
          ├─ TrackResolver ── Music API Adapter
          ├─ PlaybackEngine ─ HTMLAudioElement
          └─ PlaybackStore  ─ Snapshot persistence
                  │ PlaybackEvent + Snapshot
                  ▼
             UI / Action Journal
```

- `QueueController` 不获取播放 URL，也不直接操作 `<audio>`。
- `PlaybackEngine` 不决定下一首，也不修改歌单或队列。
- `PlaybackCoordinator` 编排“选择队列项 → 解析可播放源 → 装载 → 按意图播放”，并持有取消句柄。
- Renderer 已确定使用 Vue SPA。唯一 `AudioHost` 常驻 AppShell 根层并位于 `RouterView` 之外；领域层仍保持纯 TypeScript，通过 Vue 适配层订阅。

### 2.1 跨进程播放命令

```text
Agent Tool → Policy Middleware → PlayerCommandGateway（Utility）
                                      │ IPC / MessagePort
                                      ▼
PlayerCommandBridge（Renderer 根层常驻）→ PlaybackCoordinator
                                      │
                                      └→ PlayerCommandResult + Snapshot → Agent Tool
```

- Agent 不能调用 Vue 组件或 Pinia 内存函数。它只在权限中间件放行后发送领域命令。
- 命令信封至少包含 `protocolVersion`、`commandId`、`issuedBy`、`expectedRevision`、`type` 和经 Schema 验证的 `payload`。
- 命令结果以 `commandId` 关联，区分 `succeeded`、`rejected`、`stale`、`failed`、`unavailable` 和 `timeout`，并携带最新 snapshot 或裁剪后错误。
- Tool 必须等到命令回执或超时才返回模型，不得将“已发送”当作播放成功。Renderer 重载、MessagePort 中断或 AudioHost 不可用时，所有未决命令显式失败并在重新握手后才接收新命令。
- `PlayerCommandBridge` 不放在 `AgentPage.vue` 或任何路由页面中。Pinia 只订阅快照和分发命令，不通过 DOM ID 持有 `<audio>`、不手工猜测播放成功状态。
- Vue 页面调用类型化 Music Gateway，通过 Preload 进入 Utility Process 中的 Music Service；Agent Tool 在 Utility Process 内复用同一 Service。Renderer 不直连 NeteaseCloudMusicApiEnhanced。

## 3. PlaybackEngine

### 3.1 状态模型

```ts
type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error'

type PlaybackIntent = 'play' | 'pause'

interface PlaybackSnapshot {
  status: PlaybackStatus
  intent: PlaybackIntent
  track: TrackSummary | null
  generation: number
  positionMs: number
  durationMs: number | null
  bufferedMs: number
  volume: number
  muted: boolean
  seeking: boolean
  error: PlaybackError | null
}
```

`status` 表示媒体当前事实，`intent` 表示用户期望。两者必须分开：歌曲已可播放不代表用户要求播放，缓冲中也不代表用户取消了播放意图。

### 3.2 关键转移

```text
load(source, autoplay)
  → generation + 1
  → status=loading, intent=autoplay ? play : pause
  → loadedmetadata/canplay
      ├─ intent=pause → ready
      └─ intent=play  → await audio.play()
                           ├─ resolved / playing event → playing
                           └─ rejected                → error

playing + waiting/stalled → buffering
buffering + playing event → playing
play intent + pause()      → paused, intent=pause
ended                     → emit ended，交给队列决策
```

约束：

- `loadedmetadata`、`canplay` 只更新媒体就绪信息，不能直接把状态改成 `playing`。
- `audio.play()` 是异步操作；只有 Promise 成功或收到有效 generation 的 `playing` 事件后才能声明正在播放。
- `pause`、`ended`、`error`、`waiting`、`stalled`、`seeking`、`seeked` 和 `durationchange` 都要纳入事件映射。
- `ready` 表示已经装载但尚未开始；`paused` 表示曾经开始后被暂停。UI 可以使用同一个暂停图标，但恢复语义不同。
- 非法状态组合由 reducer 拒绝，例如 `track=null` 时不能进入 `playing`。

### 3.3 对外接口草案

```ts
interface LoadMediaInput {
  track: TrackSummary
  source: ResolvedMediaSource
  autoplay: boolean
  startPositionMs?: number
}

interface PlaybackEngine {
  load(input: LoadMediaInput): Promise<void>
  play(): Promise<void>
  pause(): void
  toggle(): Promise<void>
  stop(): void
  seek(positionMs: number): void
  setVolume(volume: number): void
  setMuted(muted: boolean): void
  getSnapshot(): PlaybackSnapshot
  subscribe(listener: (event: PlaybackEvent) => void): () => void
}
```

`subscribe` 必须返回 disposer，组件卸载和引擎销毁时解除监听，避免重复订阅和内存泄漏。

### 3.4 URL 解析与竞态

```text
select item
  → abort previous resolve
  → generation++
  → resolve(trackId, AbortSignal)
  → generation 仍匹配？
      ├─ 否：丢弃结果
      └─ 是：engine.load(...)
```

- 队列只保存稳定歌曲 ID 和展示摘要，不保存长期可复用的播放 URL。
- URL 过期后由 `TrackResolver` 重新获取，不由 UI 拼接或缓存 Cookie。
- 快速切歌、退出登录、停止播放和应用退出必须取消未完成解析。
- 媒体事件处理器捕获当前 generation；旧 source 的迟到事件不得更新新歌曲。
- `resetMedia()` 执行 `pause → removeAttribute('src') → load()`，用于停止旧下载；复用的是同一个 audio 元素，不存在“旧 audio 元素”。

### 3.5 音质偏好与解析结果

```ts
type MusicQualityLevel =
  | 'standard'
  | 'higher'
  | 'exhigh'
  | 'lossless'
  | 'hires'
  | 'jyeffect'
  | 'sky'
  | 'dolby'
  | 'jymaster'

type MusicQualityPreference = 'auto' | MusicQualityLevel

interface ResolvedMediaSource {
  url: string
  requestedQuality: MusicQualityPreference
  actualQuality: MusicQualityLevel
  attemptedQualities: MusicQualityLevel[]
  downgraded: boolean
  downgradeReason?: 'track-unavailable' | 'account-unavailable' | 'device-unsupported' | 'upstream-fallback'
  bitrate?: number
  format?: string
  size?: number
  freeTrialInfo?: unknown
}
```

- `MusicQualityPreference` 是持久化的全局设置，默认 `auto`。`auto` 只沿 `jymaster → hires → lossless → exhigh → higher → standard` 常规高保真链选择；队列只保存歌曲引用，不固化当时的 URL 或音质结果。
- `TrackResolver` 每次解析时结合全局偏好、当前账户和实际 API 结果；不通过 UI 的 VIP/付费小标推断可播音质。
- 常规档位的回退序列为 `jymaster → hires → lossless → exhigh → higher → standard`，从用户首选位置开始。`jyeffect`/`sky`/`dolby` 不进入 `auto` 或码率排序，仅在用户显式选择时尝试；不可用时回退当前账户的最高常规档位。
- 上游若已自动降级，以响应的实际 `level` 为准并停止进一步请求；URL 为空或实际档位无法解码时才继续向下尝试。具体字段以 API First 样本为准。
- `unblock=true` 时上游模块明确不保证音质偏好生效，正常播放解析禁止使用该参数实现音质选择。
- `actualQuality`、码率和格式属于本次媒体源状态，可供播放 UI 展示，但不写回歌曲永久字段。

播放中变更 `MusicQualityPreference` 时：

1. 立即持久化新偏好，为本次换源创建独立 `qualityResolveRevision` 和 AbortController；新源就绪前保持旧媒体源工作。
2. 后台解析当前 `queueItemId` 的新源。用户再次修改音质、切歌、停止、登出或退出时取消该解析；迟到结果必须丢弃。
3. 新源就绪且仍指向同一队列项时，在交换瞬间读取最新 `positionMs` 和 `intent`，然后才为媒体换代递增 generation、load 新源、在 metadata 就绪后 seek，并且仅在 `intent='play'` 时恢复播放。
4. 若最终媒体档位、格式和 URL 未变，不重载。若新源因网络或上游错误解析失败，保留旧源和当前播放，显示轻提示；持久化的新偏好在后续解析时继续使用。

## 4. QueueController

### 4.1 数据结构

```ts
type QueueSourceKind =
  | 'search'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'liked'
  | 'recommend'
  | 'manual'

interface QueueSource {
  kind: QueueSourceKind
  ref?: string          // 只放稳定引用，例如网易云 playlistId
  label?: string
}

interface QueueItem {
  queueItemId: string   // 同一歌曲可多次入队，因此不能只用 songId
  track: TrackSummary
  source: QueueSource
  addedAt: number
}

interface TrackAccessMeta {
  badges: Array<'vip' | 'paid'>
  // 只保存归一化结果；是否可播仍在请求 URL 时按当前账户判断
}

interface QueueSnapshot {
  items: QueueItem[]            // UI 可见且实际生效的唯一播放顺序
  currentItemId: string | null
  mode: 'loop' | 'loop-one' | 'shuffle'
  revision: number
}
```

`source.kind='playlist'` 与 `source.ref='<playlistId>'` 分开，禁止一处写 `playlist`、另一处写 `playlist:<id>`。

### 4.2 显式队列命令

```ts
interface QueueController {
  replaceAndPlay(context: PlayContext): QueueEffect
  insertAndPlay(item: QueueItem): QueueEffect
  playNext(items: QueueItem[]): QueueEffect
  enqueue(items: QueueItem[]): QueueEffect
  remove(queueItemId: string): QueueEffect
  reorder(queueItemId: string, toIndex: number): QueueEffect
  clear(): QueueEffect
  next(reason: 'manual' | 'ended' | 'error-policy'): QueueEffect
  previous(): QueueEffect
  setMode(mode: PlayMode): QueueEffect
  getSnapshot(): QueueSnapshot
}
```

已确认的小云语义：

- 播放目标是单曲：`insertAndPlay`。队列非空时把歌曲插入当前项之后，立即将 `currentItemId` 切换到新项并播放；队列为空时插为第一项。新歌曲进入正式 `items`，不使用队列外临时状态，播放后也不自动删除。
- 播放目标是歌单：`replaceAndPlay`，用歌单建立新队列；未指定歌曲时从第一首开始。

已确认的页面入口语义：

- 歌单、专辑、“我喜欢”和歌手热门歌曲等集合详情中的歌曲行：`replaceAndPlay`，用当前完整列表替换队列，`startIndex` 指向点击项。
- 小云精确点播、全局搜索单曲和推荐单曲卡片：`insertAndPlay`，插入当前项之后并立即切换播放。

页面或 Agent 的其他动作必须明确选择 `replaceAndPlay`、`insertAndPlay`、`playNext` 或 `enqueue`。搜索和推荐 Section 的“播放全部”调用 `replaceAndPlay`，以当前可见歌曲集合替换队列并从第一首开始。电台、MV 等非首版页面若后续立项，必须在接入时另行冻结队列语义。

### 4.3 索引、删除与上一首

- 当前项使用稳定 `queueItemId` 标识，数组移动后不靠脆弱的旧 index 找回。
- 单曲插播项是正式队列项，必须在队列 UI 中显示且不会自动清理。连续点播时，以最新当前项为基准继续插到其后并立即播放。
- 删除非当前项只修改队列，不中断当前媒体。
- 删除当前项立即停止当前媒体并切换到删除后占据同一位置的下一项；删除的是末项且队列仍非空时回到第一项。该规则优先于 `loop-one`。
- shuffle 不建立额外序列；删除当前项时仍以 `items` 中删除后占据同一位置的项为接替项。
- 删除队列唯一项或执行 `clear()`：停止媒体、取消 URL 解析、清空 source，`currentItemId=null`，进入 idle/空队列状态。
- 手动排序直接改变 `items`；在 shuffle 模式下不退出模式，并立即按调整后的可见列表继续播放。
- `previous` 每次都执行切歌，禁止根据当前播放时长改成“从头重播当前歌曲”。所有模式都取当前可见 `items` 的上一项，位于首项时回到末项。
- 切离歌曲后不保存该歌曲的独立续播位置；再次回到该歌曲时从头播放。
- `revision` 在队列、当前项或模式发生语义变化时单调递增；异步 Agent 命令携带 `expectedRevision`，过期后返回当前状态并要求重新规划或显式合并。

### 4.4 Shuffle

- 用户进入 shuffle 时，对当前 `items` 执行一次无偏洗牌（如 Fisher–Yates），将结果直接作为新的可见队列，然后从第一项开始播放。
- 只保留一份 `items`，不保留洗牌前顺序、隐藏 `playOrder` 或另一套随机历史；切回 loop 时也不恢复洗牌前顺序。
- shuffle 中的 next、previous、自然结束、增删和拖动均以当前可见 `items` 为准；拖动后从新顺序继续播放。
- 当 shuffle 播完当前列表并进入下一轮时，再次将当前 `items` 洗牌并从第一项开始；队列多于一项时避免上一轮末项紧接成为新一轮首项。
- `loop`、`loop-one` 与 `shuffle` 是首版全部播放模式，三者互斥；默认 `loop`。

### 4.5 首版无队列撤销

- `replaceAndPlay`、`insertAndPlay`、`remove`、`reorder` 和 `clear` 即时生效，不创建 Undo 快照。
- 小云的大范围队列变更通过轻提示展示影响数量，不提供撤销按钮。
- 队列操作只影响本地播放现场，不得复用歌单 CRUD Service；网易云歌单写入是独立领域行为并经过权限中间件。

## 5. 播放模式与错误策略

| 模式 | 自动 ended 行为 | 手动 next 行为 |
| --- | --- | --- |
| `loop` | 末项回到第一项 | 末项回到第一项 |
| `loop-one` | 当前项重播 | 跳到队列下一项 |
| `shuffle` | 沿可见 `items` 前进；末项结束后重新洗牌下一轮 | 沿可见 `items` 前进 |

首版默认 `loop`。不提供 `order`/顺序播放；队列非空时不会仅因到达末项自动停止。`loop-one` 只影响自然 `ended`，手动上一首和下一首继续按队列切歌。

歌曲经过 URL 获取和必要的播放尝试后最终判定不可播放时：

1. 引擎上报归一化 `PlaybackError`，UI 显示轻量 Message/Toast，不能弹阻断式模态框。
2. 队列执行 `next(reason='error-policy')`。即使当前是 `loop-one`，错误跳转也必须离开失败歌曲。
3. 一次连续自动跳转维护失败集合，不重复尝试同一 `queueItemId`；所有队列项都失败后停止并提示，避免列表循环无限跳歌。
4. URL 过期是否先自动重取、网络错误重试次数等属于 API/网络技术策略，但最终用户行为保持“轻提示后切歌”。

列表展示与播放能力分离：`TrackSummary` 保存 API Adapter 归一化的 `vip`/`paid` 权益小标，`TrackRow` 在歌单、专辑等列表显示 `VIP` 或“付费”。小标不禁用点击；会员或已购买账户仍可正常播放。其他版权状态首版不增加列表标记，原始字段映射必须经过 API First 样本验证。

## 6. 试听与片段

- 试听和完整歌曲复用同一引擎与队列，不建立第二个 audio 类。
- API Adapter 需要将是否为试听、可播放区间和版权原因归一化到 `ResolvedMediaSource`。
- UI 根据归一化元数据展示“试听”和剩余时间；播放域只执行允许的区间。
- NeteaseCloudMusicApiEnhanced 的试听字段、URL 有效期和不同账户返回差异必须先通过 API First 测试确认，不能假设所有试听都固定为 30 秒。

## 7. 全局唯一音频与 Audio Focus

1. Electron 主进程使用单实例锁避免多开产生两个独立播放器。
2. 应用作用域只创建一个 `PlaybackEngine` 和一个 `HTMLAudioElement`。
3. lint/架构测试禁止业务模块直接 `new Audio()`。
4. 短提示音通过独立、受控的 SFX 出口，可与内容音频混音，但受统一静音设置管理。

语音输入不应无条件“暂停后恢复”。`AudioFocusManager` 获取焦点时记录：

- 获取前是否正在播放。
- 当前歌曲 generation。
- 语音任务期间是否出现用户或 Agent 的播放状态命令。

已确认 `Alt+Space` 聆听阶段采用 ducking：

- 当音乐正在播放时，不 pause，通过独立的瞬时增益将有效输出降到原输出约 20%；不修改持久化的用户 volume。
- 松开快捷键即释放该语音焦点。只有“获取前正在播放、歌曲 generation 未变、期间没有新的 pause/play/切歌意图”同时成立时才恢复原输出。
- 若期间发生新播放意图，释放焦点只移除本次 ducking 标记，不恢复旧媒体状态。首版不实现 TTS，因此不建立 TTS 音频焦点分支。

## 8. 关窗与后台播放

- “关闭窗口时”设置只有 `minimize` 和 `quit` 两个持久值，默认 `minimize`，不增加 `ask` 或其他第三状态；`minimize` 是兼容旧配置的字段名，UI 展示为“关闭到托盘并继续播放”。
- `minimize`：拦截关闭按钮并隐藏主窗口，使其不再占用任务栏；保留系统托盘入口、Renderer、AudioHost 和 Utility Process，当前音乐继续播放。独立最小化按钮仍调用普通窗口最小化。
- `quit`：关闭按钮执行应用退出；停止播放、持久化恢复快照、取消 URL 解析并释放快捷键、媒体会话和 Utility Process。
- 用户从菜单或系统明确执行“退出应用”时，不受 `minimize` 设置阻止。
- 托盘单击或“显示主窗口”、应用二次启动及 macOS 激活事件均恢复并聚焦现有主窗口；托盘“退出应用”进入与 `quit` 相同的受控退出流程。
- 播放引擎不能放在路由页面组件内，避免切页或关闭临时窗口时被销毁。

## 9. 持久化与启动恢复

已确认恢复完整播放现场，但启动后保持暂停：

```ts
interface PlaybackResumeSnapshot {
  schemaVersion: number
  accountScope: string
  queue: QueueSnapshot
  positionMs: number
  volume: number
  muted: boolean
  savedAt: number
}
```

- 保存正式队列、当前项、当前项进度、音量、静音和播放模式；不为队列中每首歌保存独立进度。
- 不保存媒体 URL、Cookie 或签名 Header；恢复当前项时通过 `TrackResolver` 按歌曲 ID 获取新 URL。
- 启动恢复始终以 `autoplay=false` 装载。`loadedmetadata` 后执行 seek，状态保持 `ready/paused`；只有新的用户或 Agent 播放命令才能出声。
- 快照按账户隔离、带 Schema 版本并原子写入。队列项保存稳定 ID 和必要展示摘要，不能只依赖可能失效的 `sourceRef` 重建。
- 当前冻结语义为 account generation 不一致即丢弃快照，不能跨本次登录 generation 恢复旧现场。
- 当前歌曲已不可播放时保留队列现场并展示原因，不在应用启动阶段静默跳歌。
- 队列、当前项、模式、音量和静音等语义变化后短防抖原子写入；播放进度每 5 秒节流，并在 pause、seek 完成、窗口最小化和退出前刷新。快照不按时间过期，Schema 不兼容或账户 generation 不匹配时丢弃。

## 10. Vue SPA 集成

```text
AppShell（应用生命周期）
  ├─ AudioHost
  │    ├─ 唯一 HTMLAudioElement
  │    └─ PlaybackCoordinator / Engine / Queue
  ├─ RouterView（页面生命周期）
  └─ PlayerBar（路由控制的 UI 生命周期）
```

- `AudioHost` 不放进 `RouterView`、页面 Layout、`KeepAlive` 或条件渲染分支；正常路由切换不得卸载。
- `PlayerBar` 只订阅 snapshot 并发送 `PlaybackCommand`，不创建或拥有播放引擎。
- 隐藏 PlayerBar 不改变播放 intent、队列、音量或当前歌曲，也不能顺带销毁订阅之外的资源。
- Vue Router 使用类型化 `RouteMeta.playerBar: 'show' | 'hide'`。`route.meta` 会合并匹配到的父子路由元数据，父布局可定义默认值，叶子路由显式覆盖。
- 播放详情、沉浸歌词与单曲详情的正式路径分别为 `/player`、`/player/lyrics`、`/songs/:songId`；沉浸页同时使用 `RouteMeta.presentation = 'immersive'` 驱动根层覆盖与历史返回。
- 设置页和个人信息页使用 `hide`；主导航、歌单次导航以及歌单/歌手/专辑列表与详情页使用 `show`；其他页面等待产品确认后逐项填写，不能依赖 URL 字符串猜测。
- PlayerBar 隐藏时页面移除底部安全区，显示时由 AppShell 统一提供 `PlayerSafeArea`，避免歌曲列表末项被遮挡。
- Vue 适配层负责把 snapshot 转为响应式只读状态，并在自身销毁时解除订阅；领域对象生命周期不跟随适配组件。

## 11. 自定义音频协议验证

若采用 `ncxaudio://` 在主进程代理媒体流，必须验证：

- Scheme 在 `app.ready` 前以 `standard`、`secure` 和媒体元素所需的 `stream: true` 能力注册。
- Handler 只接受受控歌曲引用或白名单上游，不允许用户输入任意 URL，不能成为开放代理。
- 严格校验 host、path、账户归属和路径穿越；Cookie 只在主进程 API Adapter 注入。
- 正确转发 `Range`，支持 `206 Partial Content`、`416 Range Not Satisfiable`、`Content-Type`、`Content-Length`、`Accept-Ranges` 和取消请求。
- 登出、切歌和退出时中止上游流；日志不得记录 Cookie、完整签名 URL 或敏感 Header。
- Chromium 对 mp3、aac、flac 等目标格式的实际支持和 seek 行为必须逐一测试。

若上述验证失败，优先使用可控的 HTTPS URL 或主进程流式方案，不为了隐藏 Cookie 自创不完整协议。

## 12. 测试矩阵

- reducer：每个状态 × 每个命令的合法转移、非法组合拒绝。
- `audio.play()` 成功、Promise 拒绝、迟到 resolved 和 autoplay policy 拒绝。
- `loadedmetadata/canplay` 不会越过 pause intent 自动播放。
- 快速连续切歌、URL 迟到、旧媒体 error/ended 迟到时不会污染新 generation。
- waiting/buffering/playing、seek、duration 变化和网络恢复。
- queue 增删改、删除当前项、空队列、重复 songId、revision 过期。
- 删除非当前项不中断；删除当前项切到同位置接替项；删除末项回卷第一项；单项删除和 clear 停止并清空媒体源。
- 单曲点播插入 `currentIndex + 1` 后立即成为当前项并保留；连续点播保持插入顺序；空队列时插为第一项。
- 集合详情点击歌曲行时完整列表替换队列，点击项成为当前项；搜索和推荐单曲不会误替换队列。
- previous 无论当前播放多久都切换到可见队列上一项，返回歌曲从头播放。
- VIP/付费 Item 正确显示小标但仍可点击；不可播放时轻提示并切歌；整轮失败后停止且不无限循环。
- 音质默认自动选取账户/歌曲/设备最高可用档位；指定偏好不可用时向下回退，快照报告 `actualQuality` 且不误标首选档位。
- 播放中变更音质会在新源就绪后立即交换，保持最新进度和 intent；连续改设置、切歌和旧 URL 迟到时不得越代，新源失败时旧源不中断。
- 9 档 `/song/url/v1` 覆盖游客/非 VIP/VIP/已购买和不同音源上限；验证上游自动降级、空 URL、`unblock=false` 与 Dolby `os=pc` 行为。
- 进入 shuffle 会直接洗牌可见队列并从首项播放；拖动后按新可见顺序继续；切回 loop 不恢复洗牌前顺序。
- 队列命令不会生成 Undo 快照，播放队列操作也不会误写网易云歌单。
- 启动恢复始终 `autoplay=false`；无有效快照时保持 idle。
- 全局只创建一个 audio 元素；切歌后同一元素的旧请求被中止，旧 generation 事件被忽略。
- 订阅 disposer、组件反复挂载、退出时监听器和请求均已释放。
- `Alt+Space` 按住时有效输出降到约 20% 且不改持久化 volume；松手正常恢复，期间暂停或切歌时不恢复旧状态。
- 关闭策略为 `minimize` 时窗口隐藏到系统托盘且播放不中断；为 `quit` 或明确退出时完成快照后停止媒体、销毁托盘并释放所有资源。
- 自定义协议的 Range、取消、非法路径、跨账户引用、上游错误和敏感日志测试。

## 13. 里程碑 1 技术验证

1. `song/url` 有效期、试听/版权字段、防盗链、Cookie 注入和刷新策略。
2. Electron/Chromium 对目标音频格式、Range、seek 和媒体事件顺序的实际表现。
3. `audio.play()` 在首次启动、恢复、快捷键和用户点击场景中的策略差异。
4. Windows SMTC、macOS Now Playing/媒体键与唯一播放源的集成方式。
5. `ncxaudio://` 与直接 HTTPS 两种链路的安全、性能和取消行为对比。
6. Windows/macOS 关闭按钮映射“隐藏到托盘”/`quit`、托盘恢复、后台播放与明确退出的生命周期验证。

验证结果写入独立 ADR；T-03 与 T-07 通过或采用已记录的 fallback 后，本文件升级为 Baseline。
