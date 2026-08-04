# NcxMusic Design System 基线

> 文档状态：Baseline 0.1（组件与交互基线已建立，品牌配色与图标方案待视觉阶段确认）
> 建立日期：2026-08-04
> 最后更新：2026-08-04
> 用途：定义 Renderer 的组件范围、统一页面模式、设计 Token 和验收规则

## 1. 设计目标

NcxMusic 采用精致、克制、接近 macOS 质感的跨平台桌面视觉，但不逐像素复制系统组件。Windows 与 macOS 共用同一套产品语言，只在窗口材质、系统字体回退和平台能力上适配。

设计系统遵守以下原则：

1. 同一语义只有一个权威组件，业务页面不能复制实现。
2. 先使用语义 Token，再由主题映射具体颜色和材质；组件内不散落任意数值。
3. Hover、Focus、Pressed、Disabled、Loading、Selected 和 Error 是组件契约，不由页面临时补齐。
4. 动画只帮助理解层级和状态，不延迟音乐操作，不制造布局跳动。
5. 鼠标、键盘、触控板和屏幕阅读器必须能完成核心操作。

## 2. 分层结构

```text
Design Tokens
  └─ Primitives
      └─ General Components
          └─ Layout Patterns
              └─ Music / Agent Domain Components
```

- **Design Tokens**：颜色、字体、间距、圆角、阴影、模糊、动效、层级和控件尺寸。
- **Primitives**：Surface、Text、Icon、Divider、FocusRing、VisuallyHidden、Portal 和 ScrollArea 等最小能力。
- **General Components**：Button、Input、Dialog、Drawer、Toast、Menu 等无业务含义组件。
- **Layout Patterns**：AppShell、PageShell、PageHeader、Section、列表和网格布局。
- **Domain Components**：TrackRow、PlayerBar、ApprovalCard 等音乐或 Agent 专用组件。

领域组件可以组合通用组件，但不能复制通用组件的内部样式或绕过 Token。

### 2.1 Headless Primitive 基础

首版采用 Reka UI 承担无样式交互 Primitive。它负责焦点管理、键盘导航、Portal、受控状态和 WAI-ARIA 行为；NcxMusic 负责组件命名、Props、Emits、文案、视觉、动画、Token 和产品使用边界。

依赖方向固定为：

```text
reka-ui
  └─ design-system/primitives/reka（内部适配）
      └─ design-system/components（NcxMusic 公开组件）
          └─ patterns / domain components / feature pages
```

- 只有 `design-system/primitives/reka/**` 可以导入 `reka-ui`。
- NcxMusic 公开组件不能直接导出 Reka UI 的 Props、Emits、实例类型或内部部件。
- Dialog、AlertDialog、Drawer、Popover、DropdownMenu、ContextMenu、Tooltip、Select、Combobox、Tabs、表单选择控件、ScrollArea 和 Toast 等优先复用对应 Primitive。
- Button、Card、PageHeader、TrackRow、PlayerBar、ToolExecutionCard 和 ApprovalCard 等产品组件由 NcxMusic 自己实现，不为追求统一而强行套入无关 Primitive。
- Reka UI 的 `data-*` 状态只能在 Design System 内映射到语义 Token；业务样式不能直接选择第三方内部结构。
- 版本由根锁文件冻结。升级时先运行 UI Lab、键盘交互、焦点恢复和视觉回归测试，不在业务页面逐个修补。
- 如果未来替换 Primitive 库，只改内部适配层和公共组件实现，页面调用契约保持不变。

### 2.2 为什么没有选择 Element Plus

Element Plus 是可行方案，并不是因为“不能改样式”而被排除。其当前能力包括 CSS Variables、SCSS 变量覆盖、暗色主题、ConfigProvider 命名空间和 Vite 按需引入；如果目标是快速交付常见后台或工具界面，它通常比 Headless Primitive 更省开发时间。

NcxMusic 首版仍选择 Reka UI，原因是产品的视觉目标不止替换品牌色：

- NcxMusic 需要统一重做控件密度、圆角层级、浮层材质、过渡动画、音乐列表和 macOS 式细节。Element Plus 的主题变量适合改色和部分尺寸，但更深的结构、状态和动画调整仍可能依赖组件类名或内部 DOM。
- Element Plus 已自带完整视觉和 Theme Chalk 样式。先引入再覆盖，意味着同时维护 Element Plus 默认规则、项目 Token 和覆盖层；升级时需要检查覆盖是否仍命中。
- Reka UI 本身无样式，更接近 NcxMusic 所需的“交互与无障碍内核”。项目从第一天只维护一套视觉规则，不需要先消除第三方外观。
- 业务层无论选择哪一个都必须依赖 NcxMusic 自有组件。采用 Reka UI 后，适配层的职责更单一，也更容易在未来替换。

Element Plus 的优势同样保留在决策记录中：组件覆盖更完整、表单与数据组件成熟、默认视觉可直接使用、开发速度更快。若项目目标从“独特播放器视觉”转向“最短时间完成大量通用表单”，可以重新评估，但不同时引入两套通用 UI 组件体系。

## 3. Design Tokens

Token 使用 CSS Custom Properties，并分成三层：基础刻度、语义 Token、组件 Token。例如 `--ncx-space-4` → `--ncx-page-padding-inline` → `--ncx-page-header-gap`。业务代码只能使用语义或组件 Token。

### 3.1 间距

以 4 px 网格为主，6 px 只用于紧凑控件内部：

| Token | 数值 | 常用场景 |
| --- | ---: | --- |
| `space-0` | 0 | 重置 |
| `space-1` | 4 px | 图标内部、极紧间隔 |
| `space-1.5` | 6 px | 紧凑按钮内部 |
| `space-2` | 8 px | 图标与文字、列表内部 |
| `space-3` | 12 px | 控件组、卡片紧凑内边距 |
| `space-4` | 16 px | 默认组件内边距 |
| `space-5` | 20 px | 页面紧凑间距 |
| `space-6` | 24 px | Section 内间距 |
| `space-8` | 32 px | Section 之间 |
| `space-10` | 40 px | 大块内容分隔 |
| `space-12` | 48 px | 页面级留白 |
| `space-16` | 64 px | 沉浸页大留白 |

默认页面横向内边距为 24 px；紧凑窗口可降至 16 px。Section 之间默认 32 px，卡片内部默认 16 px。

### 3.2 圆角

| Token | 数值 | 场景 |
| --- | ---: | --- |
| `radius-xs` | 4 px | 小 Badge、进度元素 |
| `radius-sm` | 6 px | 紧凑控件 |
| `radius-md` | 8 px | Button、Input、列表 Hover 面 |
| `radius-lg` | 12 px | Card、Menu、Popover |
| `radius-xl` | 16 px | Dialog、Drawer 内卡片 |
| `radius-2xl` | 20 px | 大型浮层与沉浸内容 |
| `radius-full` | 9999 px | Avatar、胶囊标签 |

同一组件在不同页面不得改变圆角。封面图片遵循所在组件的固定圆角，不直接继承容器任意值。

### 3.3 控件尺寸

| Token | 高度 | 场景 |
| --- | ---: | --- |
| `control-compact` | 28 px | 高密度表格与次要工具栏 |
| `control-default` | 32 px | 桌面端默认按钮与输入框 |
| `control-prominent` | 36 px | 主操作、首次引导和审批操作 |

图标按钮保持正方形；紧凑尺寸不能用于危险确认和首次引导。可点击区域不得小于组件声明尺寸。

### 3.4 字体

默认使用系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`。

| 样式 | 字号 / 行高 | 字重 |
| --- | --- | --- |
| Caption | 12 / 18 px | 400、500 |
| Body Small | 13 / 20 px | 400、500 |
| Body | 14 / 22 px | 400、500 |
| Body Large | 16 / 24 px | 400、500 |
| Title Small | 18 / 26 px | 600 |
| Title | 24 / 32 px | 600 |
| Display | 32 / 40 px | 600 |

正文不使用 600 以上字重；数字时长、音质和播放数据使用等宽数字特性，避免更新时宽度抖动。

### 3.5 阴影、描边与模糊

| 层级 | 视觉规则 | 场景 |
| --- | --- | --- |
| `elevation-0` | 无阴影，使用语义描边 | 页面、普通列表 |
| `elevation-1` | `0 1px 2px` 轻阴影 | 可交互 Card、Sticky Header |
| `elevation-2` | `0 8px 24px` 中阴影 | Menu、Popover、Tooltip |
| `elevation-3` | `0 18px 48px` 强阴影 | Dialog、Drawer、全局审批层 |

阴影颜色由亮/暗主题 Token 决定，不能在组件内写固定黑色透明度。深色主题主要依靠描边和表面明度区分层级，避免大面积黑影。

模糊只用于窗口 Chrome、全局浮层背景和已确认的渐变模糊遮罩：`blur-sm: 12 px`、`blur-md: 20 px`、`blur-lg: 32 px`。普通 Card 不使用背景模糊，避免性能消耗和视觉噪声。

### 3.6 动效与 Hover

| Token | 时长 | 场景 |
| --- | ---: | --- |
| `motion-instant` | 80 ms | Pressed、开关反馈 |
| `motion-fast` | 120 ms | Hover、Focus、颜色变化 |
| `motion-normal` | 180 ms | Menu、Popover、Toast |
| `motion-slow` | 240 ms | Dialog、Drawer、页面层级变化 |

默认缓动为 `cubic-bezier(0.2, 0.8, 0.2, 1)`。Hover 不能改变组件布局尺寸；按钮和列表只改变语义背景、描边或前景色。只有可点击媒体 Card 可以使用不超过 `translateY(-1px)` 的提升效果。`prefers-reduced-motion` 下移除位移和模糊过渡，只保留即时状态变化。

### 3.7 全局层级

| Token | Z-Index | 场景 |
| --- | ---: | --- |
| `layer-base` | 0 | 页面内容 |
| `layer-sticky` | 100 | PageHeader、SectionHeader |
| `layer-player` | 200 | PlayerBar、队列入口 |
| `layer-popover` | 400 | Menu、Popover、Tooltip |
| `layer-drawer` | 500 | Drawer、Sheet |
| `layer-modal` | 600 | Dialog、全局阻断层 |
| `layer-toast` | 700 | Toast 容器 |
| `layer-voice` | 800 | 语音悬浮组件 |

业务组件不能使用任意 Z-Index。ApprovalCard 默认位于 Agent 会话流内；只有跨页面的未决审批恢复层才使用 `layer-modal`。

### 3.8 颜色 Token

首版先冻结语义名称，具体色值在视觉方向确认后统一填入：

- Surface：`canvas`、`surface`、`surface-raised`、`surface-overlay`、`control-hover`、`control-pressed`、`control-selected`。
- Text：`text-primary`、`text-secondary`、`text-tertiary`、`text-disabled`。
- Border：`border-subtle`、`border-default`、`border-strong`。
- Accent：`accent`、`accent-hover`、`accent-pressed`、`on-accent`。
- State：`success`、`warning`、`danger`、`info`。
- Music：`vip`、`paid`、`playing`。
- Agent：`agent-accent`、`agent-surface`、`approval-pending`。

禁止直接以 `red-500` 等原始色阶表达产品语义；危险操作必须使用 `danger` 语义 Token。

## 4. 首版组件范围

### 4.1 通用组件（P0）

| 类别 | 组件 |
| --- | --- |
| 操作 | Button、IconButton、ButtonGroup、LinkButton |
| 输入 | Input、Textarea、SearchInput、Select、Combobox |
| 选择 | Checkbox、RadioGroup、Switch、Slider、SegmentedControl |
| 展示 | Avatar、Badge、Tag、Card、Separator、Tooltip |
| 导航 | Tabs、DropdownMenu、ContextMenu |
| 状态 | Spinner、Progress、Skeleton、EmptyState、ErrorState、InlineMessage |
| 浮层 | Toast、Dialog、AlertDialog、Drawer、Popover |
| 容器 | ScrollArea、Accordion、VirtualList、ResponsiveGrid |

首版不单独实现 `Modal` 和 `ConfirmDialog`：Modal 是 Dialog 的交互模式，危险确认统一由 AlertDialog 表达。Sheet 是 Drawer 的方向和尺寸变体，不维护第二套组件。

### 4.2 统一布局模式（P0）

- AppShell、WindowChrome、SidebarLayout、PrimaryNav、PlaylistSecondaryNav、AccountFooter。
- PageShell、PageHeader、PageBody、Section、SectionHeader、PlayerSafeArea。
- StickyActionBar、ResizablePanel、SplitView。
- EntityHero：歌单、专辑、歌手等详情页的大型内容头部，放在标准 PageHeader 下方，不能取代返回区域。

### 4.3 音乐领域组件（P0）

- TrackRow、TrackList、TrackIndex、TrackActions、QualityBadge、VipBadge、PaidBadge。
- AlbumCard、ArtistCard、PlaylistCard、MediaArtwork、EntityMeta。
- PlayerBar、PlaybackControls、VolumeControl、ProgressControl、PlayModeControl。
- QueueDrawer、QueueItem、LyricView、LyricLine、NowPlayingView。

#### 4.3.1 MediaArtwork 契约

`MediaArtwork` 是歌曲、专辑、歌单和歌手方形图片的唯一展示入口。组件接收原始 `sourceUrl`、语义 `variant`、替代文本和加载优先级，不允许页面传任意请求尺寸或自行拼接网易云图片参数。

| Variant | 资源尺寸 | UI 场景 |
| --- | ---: | --- |
| `thumbnail` | 96 × 96 | TrackRow、搜索建议、QueueItem 等高密度列表 |
| `compact` | 160 × 160 | PlayerBar、小型实体行与轻量操作消息 |
| `card` | 320 × 320 | 普通 AlbumCard、ArtistCard、PlaylistCard |
| `feature` | 640 × 640 | 推荐卡片和重点推荐 Section |
| `hero` | 1024 × 1024 | EntityHero、NowPlayingView、播放歌词页 |

- 所有 Variant 保持固定纵横比与布局占位，加载中使用统一 Skeleton，失败时使用统一实体占位图，不能触发布局位移。
- 列表和普通卡片默认懒加载；当前播放项、首屏重点推荐和当前详情 Hero 可提升优先级。高精度资源不得因路由外预渲染而整批提前下载。
- 封面使用组件规定的圆角与 `object-fit: cover`；页面不能通过 CSS 背景图绕过尺寸、替代文本、加载和错误状态。
- 模糊背景可以复用已经加载的高精度资源，但不能为了背景效果再请求一份无尺寸原图。
- UI Lab 必须同时展示五档资源、亮暗主题、加载/失败、低网速、长列表和高 DPI 状态，并通过网络面板确认请求尺寸与 Variant 一致。

### 4.4 Agent 领域组件（P0）

- AgentSidebar、AgentComposer、ChatMessage、StreamingMessage。
- MusicSafetyControl、CommandSafetyControl。
- ToolExecutionCard、ApprovalCard、ProfileAnalysisPrompt、MemoryStatus。
- VoiceOverlay、VoiceWaveform、VoiceStateLabel。

`ToolExecutionCard` 展示工具名称、状态、耗时、摘要结果和可展开技术详情。`ApprovalCard` 是独立业务组件，必须同时展示操作对象、影响、风险原因、轻量剩余有效时间，以及文案固定为“批准”“拒绝”的两个按钮；没有关闭图标，不能增加会话级/永久授权，不能用通用 Dialog、Toast 或 ToolExecutionCard 的普通状态代替。

`MusicSafetyControl` 与 `CommandSafetyControl` 是输入框下方两个独立按钮，各自显示当前 M/S 等级并打开对应等级选择面板。音乐等级选择后即时生效并持久化；选择 M4 不触发 AlertDialog、二次确认或重启提示。权限说明放在选择面板内，不能依赖额外弹窗传达当前状态。

### 4.5 后续组件（P1）

- CommandPalette、NotificationCenter、Breadcrumb、DataTable、DatePicker。
- 多选批量操作条、复杂拖拽布局、可停靠面板。

没有首版真实用例的组件不提前开发，避免形成无人使用的组件库。

## 5. 浮层与反馈使用边界

| 组件 | 何时使用 | 禁止用途 |
| --- | --- | --- |
| Toast | 已完成、已失败或轻量来源提示；不要求用户作决定 | 审批、长文本、必须阅读的信息 |
| InlineMessage | 当前 Section、表单或卡片内可恢复的问题 | 跨页面全局通知 |
| Dialog | 需要集中完成的短任务或表单 | 浏览大量内容、频繁播放反馈 |
| AlertDialog | 不可逆或高风险的人类主动操作确认 | 小 N 的权限审批、普通保存 |
| Drawer | 保留当前页面上下文的队列、详情和辅助任务 | 关键危险确认、完整设置页 |
| Popover | 由明确锚点触发的少量信息或控制 | 长表单、复杂导航 |
| DropdownMenu | 与触发对象相关的命令列表 | 表单字段选择；字段选择使用 Select |
| ContextMenu | 鼠标右键的对象快捷操作 | 唯一操作入口 |
| Tooltip | 解释无文字图标或缩写 | 承载操作、错误或关键信息 |
| ApprovalCard | 小 N 工具执行前的批准/拒绝 | 用户主动操作的普通二次确认 |

同一事件不能同时弹 Toast、Dialog 和 Notification。用户拒绝审批后由 ApprovalCard 更新结果，是否补充 Toast 由全局反馈策略统一决定，业务工具不得自行重复提示。

Toast 统一从窗口内容区顶部居中出现，避开 WindowChrome；同时最多显示 3 条。Info/Success 默认 3 秒关闭，Warning/Error 默认 5 秒关闭，Hover 时暂停计时。需要长期保留、展开详情或明确处理的信息不能延长 Toast，而应落到 InlineMessage、ApprovalCard 或后续 NotificationCenter。

Dialog 提供 400、520、680 px 三档最大宽度；Drawer 默认从右侧进入，提供 360、440、560 px 三档宽度，窄窗口下不超过内容区宽度。尺寸由组件变体选择，页面不能传入任意像素值。

## 6. PageHeader 契约

PageHeader 是页面顶部唯一标准 Header，高度默认为 56 px，由 PageShell 负责布局。它只处理页面层级与页面级动作，不承载歌单封面、歌手简介等大型业务内容。

路由必须声明：

```ts
interface PageRouteMeta {
  pageLevel: 1 | 2
  title: string
  fallbackRoute?: RouteLocationRaw
  playerBar: 'show' | 'hide'
  headerVariant?: 'default' | 'transparent'
}
```

- 一级页面不显示返回按钮；二级页面必须提供 `fallbackRoute` 并显示统一 BackButton。
- BackButton 优先返回有效的应用内历史，否则跳转 `fallbackRoute`。
- 页面级主操作放在右侧 `actions` 插槽，并只能使用 Button、IconButton 或 ButtonGroup。
- 详情页的大封面与元信息使用 EntityHero，位于 PageHeader 下方。
- Sticky 状态、标题折叠和背景材质由 PageHeader 自己处理，页面不能复制 Sticky Header。

## 7. Button 与 IconButton 契约

Button 只提供 `primary`、`secondary`、`ghost`、`danger` 四种视觉变体和 `compact`、`default`、`prominent` 三种尺寸。业务语义通过文案和图标表达，不增加“播放按钮色”“歌单按钮色”等页面级变体。

按钮按内容形式分为三类，但只维护两个底层组件：

| 形式 | 组件 | 示例 | 规则 |
| --- | --- | --- | --- |
| 纯文字 | Button | 确认、取消 | 文字必须是明确动词；同一区域最多一个 Primary |
| 纯图标 | IconButton | 关闭侧边栏、收藏、播放、下一首 | 必须提供 `label`，鼠标停留后显示 Tooltip |
| 图标+文字 | Button | 设置图标 +“设置” | 使用 `leadingIcon` 或 `trailingIcon`，不能手工拼接两个点击区 |

### 7.1 IconButton 视觉

- 默认背景透明、边框透明，保持正方形，不使用圆形底板；只有播放主按钮等经单独定义的领域组件可以使用圆形。
- Hover 使用 `control-hover`：亮色主题为浅灰表面，暗色主题为深灰抬升表面；圆角固定 `radius-md`（8 px）。
- Pressed 使用 `control-pressed`，强度高于 Hover，但不能缩放到引起图标位移。
- `compact/default/prominent` 分别为 28/32/36 px，图标建议为 14/16/18 px，由组件 Size Token 决定。
- Toggle 型图标按钮（收藏、静音、循环）使用 `aria-pressed` 与 `selected` 状态；选中态不能只靠颜色，必要时更换实心图标或增加可访问文案。
- 连续工具栏中的 IconButton 间距默认 4 px，各按钮仍保持独立 Hover 面，不合并成一个不规则色块。

### 7.2 IconButton Tooltip

- 全局 Reka TooltipProvider 使用 `delayDuration = 1500`；为满足每个图标都需停留 1.5 秒的规则，`skipDelayDuration` 同样设为 1500。
- 键盘 Tab Focus 时按无障碍行为立即显示，不强制等待 1.5 秒；Escape 关闭。
- 内容由功能名和可选快捷键组成，例如 Windows/Linux 显示“搜索  Ctrl+K”，macOS 显示“搜索  ⌘K”。快捷键使用独立 Keycap 样式，不能和名称连成普通正文。
- Tooltip 只负责解释，不承载按钮状态、错误或必须点击的操作；状态通过 `aria-label`、选中态和页面反馈表达。
- Disabled 按钮如需说明原因，由外层 Tooltip Trigger 承载，并显示“暂不可用”的具体原因。

- 每个 Button 必须覆盖 Default、Hover、Pressed、Focus Visible、Disabled 和 Loading。
- Loading 保持原宽度，禁止因文字替换造成页面跳动。
- IconButton 必须提供可访问名称；没有可见文字时提供 Tooltip。
- Danger 只用于删除、取消收藏、退出登录等破坏性动作。
- 同一操作区最多一个 Primary；批准与拒绝卡片按安全语义使用明确文案，不能只显示图标。
- Design System 之外禁止直接编写带视觉样式的原生 `<button>`。

## 8. ContextMenu 契约

生产环境阻止 Chromium 默认右键菜单。NcxMusic 只在可操作的语义对象、可编辑文本或已有文字选区上展示自有 ContextMenu；空白页面、普通封面图片和无动作装饰区域不显示菜单。

- 业务菜单由 `ContextMenuRegistry` 根据对象类型、页面上下文、账户能力和当前状态纯函数生成，不由页面手写菜单项。
- Reka UI 只提供 ContextMenu、Submenu、键盘导航和焦点 Primitive；视觉、Item Model 与命令路由由 NcxMusic 控制。
- 文本输入菜单通过 Main 的 Electron `context-menu` 参数获取拼写建议和可用编辑状态，再通过受限命令 ID 调用 Undo、Redo、Cut、Copy、Paste、Paste as Plain Text、Delete、Select All 和 Replace Misspelling；不向 Renderer 暴露通用 `webContents`。
- 右键菜单操作复用按钮和快捷键使用的 Command/Use Case，不在菜单点击处理器中复制音乐业务逻辑。
- 用户亲自点击菜单项不经过 Agent 的 M/S 权限审批；不可逆的人类操作仍按产品规则使用 AlertDialog。
- 支持鼠标右键、键盘 Context Menu 键和 `Shift+F10`。打开后使用方向键导航、Enter 执行、Escape 关闭并恢复焦点。
- 生产菜单不提供“检查元素”“刷新页面”“另存图片”等浏览器开发项；开发构建可通过显式开发开关提供调试菜单。

视觉规格：默认宽度 220 px、最大宽度 280 px；Item 高度 30 px，图标 16 px；使用 `radius-lg`、`elevation-2` 和 `layer-popover`。快捷键靠右使用次级文本。危险动作位于末组并使用 Danger 语义，分隔线不能连续或出现在首尾。

具体首版对象菜单建议以 `docs/design/NcxMusic-Context-Menu-Matrix.md` 为准。

## 9. 状态与可访问性

- 键盘 Focus 使用 2 px 高可见 Focus Ring，不能只靠阴影或颜色变化。
- 所有菜单、Dialog、Drawer 和 Popover 统一处理焦点进入、循环、恢复与 Escape。
- 纯图标不能独立表达 VIP、付费、危险和审批状态，必须提供文字或可访问名称。
- Disabled 与 Loading 不混用：Disabled 表示不可操作，Loading 表示操作正在进行。
- 错误状态必须说明恢复动作；Section 请求失败不能阻断其他 Section。
- 颜色不是状态的唯一表达方式；文字对比度和 Focus 对比度在视觉验收时统一测试。

## 10. 工程约束与验收

建议目录：

```text
src/renderer/design-system/
├─ tokens/
├─ primitives/
├─ components/
├─ patterns/
└─ styles/

src/renderer/features/
├─ music/components/
└─ agent/components/
```

- Design System 不导入业务 Store、API 或路由实例；PageHeader 通过明确 Props/Composable 接收路由状态。
- 业务组件不深度导入 Design System 内部文件，只使用公开入口。
- Stylelint 阻止业务样式直接使用任意颜色、阴影和 Z-Index；ESLint 阻止业务页面复制原生交互控件。
- 建立开发专用 UI Lab，展示每个组件的尺寸、主题、状态、长文本、中文/英文、空数据和错误边界；UI Lab 不进入生产导航。
- 通用组件至少覆盖键盘交互、焦点恢复、ARIA 语义和视觉快照测试；复杂组件增加交互测试。

## 11. 尚待视觉阶段确认

1. 品牌主色、亮/暗主题的具体色值与默认主题。
2. 图标库与音乐业务专用图标风格。
3. 最小窗口尺寸与紧凑密度触发点。

以上项目确认后只修改 Token 或 Primitive 实现，不改变本文件已经冻结的组件语义和页面复用规则。
