# NcxMusic 播放域设计（音频状态与播放队列）

> 文档状态：已确认（2026-08-03 技术讨论定稿）
> 文档用途：作为播放器音频状态管理与播放队列开发的实现基线
> 范围：仅播放域本身（音频状态机、队列管理、全局唯一音频、持久化）。不涉及 Agent、权限、IPC 协议等外部输入源——任何调用方（用户点击、快捷键、小 N、系统媒体键）都只是向统一命令面投递命令的外部输入。

## 1. 核心原则

1. **单一事实源**：播放器领域状态只存在一份——`PlaybackEngine` 持有音频状态，`QueueController` 持有队列状态，UI 全部只读快照，`<audio>` 元素只是执行器，不做任何业务决策。
2. **引擎与队列分离**：`QueueController` 做"播什么、下一首是什么"的决策，`PlaybackEngine` 做"把当前这首播好"的执行。二者是**平级组合**（`QueueController` 包含一个 `engine`），不是继承关系。
3. **命令统一入口**：所有输入（按钮、键盘、音频事件、Agent 指令、启动恢复、系统媒体键）归约为同一组命令，走同一执行路径。播放器领域不感知调用者是谁。
4. **命令向下、事件向上**：元数据（歌曲实体、URL）由上层传入引擎；实时状态（进度、状态、错误）只能由引擎产生并向上输出。没有事件上行，设计是单向死路。
5. **全局仅一个音频**：任一时刻只有一条内容音频流。应用层单实例锁 + 引擎单例 + 唯一 `<audio>` 元素 + 统一音效出口，四层落实。
6. **可测试性**：状态转移 = 纯函数（给定 state + command → 新 state），副作用（驱动 audio）分离，穷举可测。领域类不依赖 Vue，注入 audio 工厂便于 mock。

## 2. 顶层结构

```text
┌─ 控制栏/UI（Vue composable 薄包装）────────────────┐
│  读 engine.getSnapshot() 渲染进度/播放按钮/音量      │
│  读 queue.getSnapshot() 渲染队列面板/模式/上下首      │
└──────────────┬───────────────────────────────────┘
               │ 命令（play/pause/next/seek/...）
┌─ QueueController（父：列表与播放决策）───────────────┐
│  load / enqueue / playNext / removeAt / reorder    │
│  clear / undo / setMode                            │
│  模式判定：ended → next/回卷/重播/停止               │
└──────────────┬───────────────────────────────────┘
               │ changeSong() 下行；ended/error 事件上行
┌─ PlaybackEngine（子：当前歌曲音频）──────────────────┐
│  唯一 HTMLAudioElement（注入创建）                   │
│  状态机：idle / loading / playing / paused / error  │
│  方法：play / pause / toggle / changeSong / seek    │
│        setVolume / getSnapshot                      │
│  事件：onEnded / onError / onProgress / onStateChange│
└───────────────────────────────────────────────────┘
```

## 3. PlaybackEngine：当前歌曲音频管理

### 3.1 状态机

```text
        ┌─────────┐   changeSong()   ┌─────────┐
        │  idle   │ ───────────────▶ │ loading │
        └─────────┘                  └────┬────┘
              ▲                           │ loadedmetadata/canplay
              │ stop()/队列清空             ▼
              │                        ┌─────────┐
              │      ┌──────────────── │ playing │
              │      │                 └────┬────┘
              │      │ pause()              │ play()/toggle
              │      ▼                      ▼
              │   ┌─────────┐  resume   ┌─────────┐
              │   │ paused  │ ────────▶ │ playing │
              │   └─────────┘           └─────────┘
              │                              │
              │   error（URL失效/VIP/下架）    │ ended → 通知 QueueController
              │                              ▼
              └───────────────────────  停止或按队列决策切下一首
```

- 状态合法组合由转移表约束，不允许"playing 但 song 为空"等非法态。
- 播放失败（URL 过期、VIP/下架）→ 停在 `error` 态并携带错误原因，**不自动跳过**，如实告知用户。

### 3.2 对外方法

```ts
class PlaybackEngine {
  // 下行命令（外部调用）
  play(): void                    // 继续/开始（audio.play()）
  pause(): void
  toggle(): void
  changeSong(input: { song: Song; url: string }): void  // 设 src → loading → playing
  seek(ms: number): void
  setVolume(v: number): void      // 0~1，含 muted
  getSnapshot(): PlaybackSnapshot // status/positionMs/durationMs/volume/muted/song/error

  // 上行事件（引擎主动通知）
  onEnded(cb: () => void): void                 // 歌自然放完，由队列决定下一首
  onError(cb: (err: PlaybackError) => void): void
  onProgress(cb: (posMs: number) => void, throttleMs?: number): void  // 节流 ~4Hz
  onStateChange(cb: (snap: PlaybackSnapshot) => void): void

  // 内部
  private audio: HTMLAudioElement  // 构造时注入工厂创建，可 mock
}
```

### 3.3 内部规范

- `resetAudio()`：`pause()` → `removeAttribute('src')` → `load()`，断开旧流、释放网络资源；`changeSong`、清空、停止时必须调用。
- 事件映射：`loadedmetadata` → durationMs、转 playing；`timeupdate` → 节流 4Hz 更新 positionMs；`ended` → 上报 onEnded（引擎不做切歌决策）；`error` → 进 error 态。
- 歌词高亮：UI 用 `requestAnimationFrame` 从 positionMs 平滑插值，不依赖额外事件。

## 4. QueueController：播放列表管理

### 4.1 统一播放入口（所有来源共用）

```ts
interface PlayContext {
  items: QueueItem[]        // 本次入队的完整候选列表
  startIndex: number        // 从哪首开始
  source: QueueSource       // search | playlist | album | artist | liked | recommend | manual
  sourceRef?: string        // 如 playlist:123456 / album:789
}

interface QueueItem {
  songId: number
  source: QueueSource
  sourceRef?: string        // 溯源：撤销、继续播放、播放排行信号依赖它
  addedAt: number
}

class QueueController {
  private engine: PlaybackEngine   // 组合，非继承

  load(ctx: PlayContext): void     // replace 队列 + 从 startIndex 播 + revision++
  enqueue(items: QueueItem[], atIndex?): void
  playNext(items: QueueItem[]): void   // 插到 currentIndex+1；队列空则直接播第一条
  removeAt(i: number): void
  reorder(from: number, to: number): void
  clear(): void
  undo(): void                       // 恢复最近一次大变更快照（栈深 1）
  setMode(mode: PlayMode): void      // order | loop | loop-one | shuffle
  getSnapshot(): QueueSnapshot       // items 摘要/currentIndex/context/revision/mode
}
```

**关键语义：点歌 = `load()` = replace，不是追加。** 队列是从来源列表切出的临时拷贝，与来源解耦；之后调整队列不影响歌单本身。

### 4.2 各入口行为

| 入口 | items 取什么 | startIndex | source |
| --- | --- | --- | --- |
| 搜索页点单曲 | 该搜索词全部"单曲"类结果（不含歌单/专辑/歌手类） | 点击项 | `search` |
| 搜索建议点歌 | 单曲结果列表 | 点击项 | `search` |
| 搜索点歌单/专辑 | 不直接播，进详情页 | — | — |
| 歌单详情点歌 | 整个歌单歌曲列表 | 点击项 | `playlist:<id>` |
| 专辑详情点歌 | 整个专辑歌曲 | 点击项 | `album:<id>` |
| 歌手详情点热门歌曲 | 热门歌曲列表 | 点击项 | `artist:<id>` |
| 首页推荐 Section 点歌 | 该 Section 歌曲列表 | 点击项 | `recommend` |
| 我喜欢的音乐 | 喜欢列表 | 点击项 | `liked` |
| "试听" | 与普通歌曲一致（见 §6） | 点击项 | `search` |

### 4.3 currentIndex 维护规则

| 操作 | 规则 |
| --- | --- |
| `load` | currentIndex = startIndex；shuffle 时先洗牌再定位 |
| `enqueue` | currentIndex 不变；队列空 → 直接播第一条 |
| `playNext` | currentIndex 不变；队列空 → 直接播 |
| `removeAt(i)` | `i < currentIndex` → `--`；`i === currentIndex` → 原位顶上下一首继续播（删末首按 mode 处理）；`i > currentIndex` → 不变 |
| `reorder(from, to)` | 播放项跟原曲走，不中断；处于 shuffle → 退出 shuffle（手动排序后不再随机） |
| `clear` | currentIndex = -1，停止播放 |

### 4.4 撤销规则

- `load`（替换）、`clear` 必存快照、必可撤销。
- `reorder`、`playNext`、批量 `enqueue`（≥5 首）存快照可撤销。
- 单曲增删不产生撤销。
- 快照 = `{ items, currentIndex, revision }`；`undo` 后 `revision` 继续 +1（revision 只增不减，作为版本号不回落）。
- 撤销只针对最近一次大变更（栈深 1）。

## 5. 播放模式行为

| 模式 | 自动 `ended` 行为 | 手动 `next` 行为 |
| --- | --- | --- |
| `order` | 最后一首 → 停止（status: idle） | 最后一首 → 停止 |
| `loop` | 最后一首 → 回卷第一首 | 最后一首 → 回卷第一首 |
| `loop-one` | 原地重播 | 下一首（手动切歌不受单曲循环限制） |
| `shuffle` | 洗牌队列取下一项 | 洗牌队列取下一项 |

- 自动 `ended` 与手动 `next`/`prev` 使用**同一套判定逻辑**，差异只在 loop-one（自动重播、手动跳下一首）。
- `revision`：每次队列/歌曲/模式变更 +1；外部操作者提交变更时带 revision，过期则合并/拒绝并返回当前状态，在状态层解决竞态，不弹冲突框。

## 6. 试听：与普通歌曲一致

- 不建第二套音频类、不设 preview 方法、无 30s 特殊逻辑。
- "试听" = 构造 `PlayContext` → `load()`，正常进队列，放完 `ended` → 正常下一首。
- 引擎与队列代码**零试听分支**。

## 7. 全局仅一个音频播放

四层落实：

1. **应用层单实例锁**：`app.requestSingleInstanceLock()`，防多开 = 防双播放器双音频。
2. **引擎单例**：全应用唯一 `PlaybackEngine`，依赖注入（provide/inject 或模块级单例）分发，任何模块不得直接 `new Audio()`（eslint 禁用）。
3. **内容音频互斥**：`changeSong` 前 `resetAudio()` 显式断开旧流；任一时刻只有一条内容音频流（主播放/试听共用同一引擎，天然互斥）。
4. **音效与语音策略**（轻量 `AudioFocusManager`）：
   - 语音输入（`Alt+Space` 录音）：音乐必须暂停，避免 ASR 串扰；松手后按策略恢复。
   - 短提示音（sfx）：允许与音乐混音，统一 sfx 出口播放（便于统一音量与静音联动），不参与互斥。

系统媒体键（macOS media keys / Windows SMTC）的播放/暂停/切歌统一 dispatch 到同一引擎，系统媒体面板只显示一个播放源。

## 8. 关窗行为与托盘

- 设置项 `closeBehavior: 'quit' | 'tray'`，**默认 `'tray'`**。
- `'tray'`：点关闭 = `window.hide()`（不 destroy，Renderer 存活，音频继续）→ 托盘图标；点击图标恢复窗口；托盘菜单含"显示主窗口 / 退出"。
- `'quit'`：点关闭 = 正常退出，播放停止。
- 托盘驻留时系统媒体键/媒体面板继续工作。
- 播放引擎生命周期 = Renderer 生命周期，不放进会被销毁的组件。

## 9. 持久化

| 数据 | 时机 | 恢复 |
| --- | --- | --- |
| `volume` / `muted` / `mode` | 变更即写（设置存储） | 启动即恢复，不触发播放 |
| 继续播放 `{ songId, sourceRef, positionMs }` | 切歌时或每 30s 写 | 启动时按 `sourceRef` 重新取列表 → `load` + `seek` 恢复现场 |
| 播放队列本身 | 不跨重启持久化 | 按 `sourceRef` 重建，避免存过期队列 |
| 进度条位置 | 不持久化 | 刷新归零（桌面播放器常规行为） |

## 10. Vue 集成方式

- 领域类在纯 TS 层（`src/player/`），不依赖 Vue。
- Vue 侧 composable 薄包装：

```ts
// usePlayer.ts
const engine = new PlaybackEngine(createAudioFactory())
const queue = new QueueController(engine)

export function usePlayer() {
  const snapshot = ref(engine.getSnapshot())
  engine.onStateChange(s => { snapshot.value = s })
  return { engine, queue, snapshot }
}
```

- 控制栏：进度条/播放按钮/音量 ← `engine.getSnapshot()`；上一首/下一首/模式/队列信息 ← `queue.getSnapshot()`。
- 音频层未来若换 Web Audio / 原生播放器，只改 `PlaybackEngine` 内部，队列与控制栏不动。

## 11. 测试面

- 状态机转移表穷举：每个状态 × 每个命令 → 期望状态（含非法转移拒绝）。
- 边界：`ended` 在 order 最后一首 → idle；loop 末首 → 第一首；loop-one → 重播；`removeAt` 当前项 → 播下一项；`reorder` 期间 currentIndex 跟随；shuffle 中手动 reorder → 退出 shuffle。
- 撤销：undo 后状态复原、revision 单调递增。
- 全局唯一：断言应用只创建一个 audio 元素；`changeSong` 后旧元素无 src、无下载中状态。
- 引擎注入 mock audio、队列注入 mock 引擎，均不依赖 Vue，纯单测。

## 12. 关联的技术验证项（里程碑 1）

以下不在播放域设计范围内，但决定音频链路成立与否，需在里程碑 1 验证：

- `song/url` 有效期与防盗链规则（URL 过期重取策略）。
- flac 等格式在 Electron/Chromium 的播放支持。
- `ncxaudio://` 自定义协议流式转发性能（凭据隔离方案）。
