# NcxMusic 首版开发路线图

> 文档状态：Execution Baseline 0.1
> 建立日期：2026-08-05
> 范围：Windows、macOS 首个开源版本
> 原则：顺序表示依赖关系，不表示未经团队容量评估的工期承诺

## 1. 总体策略

首版按“风险先行、纵向闭环、领域扩展、双平台发布”开发。API 全量审计可以持续并行，但开发只消费已经通过门禁的契约快照，不能直接读取测试样本的偶然字段。

```text
Phase 0 技术门禁
  → Phase 1 工程骨架与统一 UI
  → Phase 2 账户与 Music Service
  → Phase 3 搜索到播放纵向闭环
  → Phase 4 完整音乐客户端页面
  → Phase 5 小云 Agent 主闭环
  → Phase 6 记忆、画像与推荐
  → Phase 7 语音、Shell、Skill 与 MCP
  → Phase 8 双平台发布硬化
```

不采用“先把全部页面画完，再接真实能力”的方式。每一阶段都要有真实领域命令、错误状态和测试，UI Mock 只能用于尚未通过 API Gate 的字段。

## 2. 跨阶段强制约束

- 单包模块化单体，Main、Preload、Renderer、Utility Process 是构建入口和运行边界，不拆内部 workspace。
- Renderer 不直连 NeteaseCloudMusicApiEnhanced、数据库、文件系统、Shell 或 Credential Vault。
- 所有跨进程数据先定义共享 Zod Contract，再实现发送端和接收端。
- 音乐按钮、系统媒体键、小云和语音都进入唯一 PlaybackCommand/PlaybackCoordinator。
- 通用 UI 只从 NcxMusic Design System 导入；业务页面不能直接导入 Reka UI。
- 每个 API 字段先进入 Adapter 和标准实体，页面与 Tool 不读取上游原始响应。
- 每个副作用先定义权限动作、幂等键、取消和失败终态，再写 Handler。
- Windows/macOS 行为同时进入验收，不把另一平台留到发布前集中补齐。

## 3. API 审计并行门禁

全量 API Audit 不阻塞工程骨架，但分三次向开发提供只读契约快照：

| Gate | 开发所需最低内容 | 解锁阶段 |
| --- | --- | --- |
| API-A 账户与公共实体 | 游客、正式登录、会话失效；song/artist/album/playlist/user 标准字段及 ID 血缘 | Phase 2 |
| API-B 播放闭环 | search、song detail、song URL/音质、lyric、权限/付费字段，多登录态差异 | Phase 3 |
| API-C 写入与全能力目录 | 喜欢、收藏、歌单、评论、签到等副作用；全部接口的能力、参数和风险标签 | Phase 4～7 |

每个 Gate 都必须包含版本、样本登录态、字段字典、未知字段、稳定失败和回归夹具。后续审计修正契约时使用显式 Schema Migration 或 Adapter 兼容，不在页面临时打补丁。

## 4. Phase 0：技术门禁与版本冻结

### 工作内容

1. 冻结 Node 活跃 LTS、pnpm、Electron、Vue、TypeScript、electron-vite、electron-builder、Reka UI、Zod、测试工具的精确版本并提交锁文件。
2. 建立 Main/Preload/Renderer/Utility 最小运行链路、构建入口和双平台 CI。
3. 执行 `NcxMusic-Technical-Spike-Plan.md` 的 T-01～T-08。
4. 为通过的结论建立 ADR；失败方案移出生产入口。

### 完成门禁

- `pnpm dev/typecheck/lint/test/build/package` 可运行。
- 进程拓扑、播放媒体链路、登录凭据、Shell 取消和 WindowChrome 没有阻断问题。
- 全局按住说话、系统媒体集成与 ASR 至少有可接受的明确回退。
- API-A、API-B 已达到可消费状态，或相应业务阶段保持未解锁。

## 5. Phase 1：工程骨架、Contract 与 Design System

### 1A. 源码和质量基线

- 建立 `src/main`、`src/preload`、`src/utility`、`src/renderer`、`src/shared` 和 `tests`。
- 配置 TypeScript 严格模式、ESLint、Stylelint、Vitest、Vue Test Utils、Playwright 和依赖边界检查。
- 建立 Contract Registry、错误码、Result、领域 ID、时间与日志脱敏基础库。
- 建立 SQLite Migration Runner、配置 Schema 版本和测试数据库夹具。

### 1B. AppShell 与统一 UI

- 先实现颜色、间距、圆角、阴影、模糊、字体、动效和层级 Token。
- Reka UI 只封装在 `design-system/primitives/reka`；图标冻结为当前官方 Vue 包 `@lucide/vue` 的命名导入，业务专用缺失图标放在 NcxMusic 自有 Icon Registry。
- 实现 Button、IconButton、Input、Tooltip、Menu、ContextMenu、Toast、Dialog、AlertDialog、Drawer、Popover、ScrollArea、Skeleton、Empty/Error State。
- 实现 WindowChrome、AppShell、三级区域左侧导航、PageShell、PageHeader、Section 和 PlayerSafeArea。
- 建立 UI Lab，覆盖亮暗主题、紧凑窗口、降低动画/透明度、中文长文案和键盘操作。

### 完成门禁

- 路由与 WindowChrome 可在两平台运行，默认 1280×800、最小 960×640、1100px 紧凑阈值生效。
- 业务示例页只使用公共组件，无直接 Reka UI 依赖和任意颜色/Z-Index。
- MessagePort ping、错误、取消、Renderer 重载握手和 Utility Snapshot 有契约测试。

## 6. Phase 2：账户、存储与 Music Service

依赖 API-A。

### 工作内容

- 实现 Credential Vault、网易云隔离 Session、官方网页登录、游客会话、退出和换号 generation。
- 实现 Music Service、Netease Adapter、标准实体池、字段合并入口、请求取消与错误归一化。
- 实现账户隔离的 SQLite、配置、Action Journal、播放快照和 Cache 目录。
- 实现 Music Gateway 的类型化 Preload 接口，先覆盖账户、歌曲、歌手、专辑和歌单只读能力。
- 设置页完成“网易云账户”、存储和隐私基础模块；游客底部账户行及上下文登录入口生效。

### 完成门禁

- 游客启动、官方登录、重启恢复、Cookie 失效、退出和换号 E2E 全部通过。
- Renderer、日志、SQLite 和 Tool 参数无 Cookie/API Key。
- 同一实体的用户名、歌曲、歌手、专辑和歌单字段只通过标准实体池读取。

## 7. Phase 3：搜索到播放的首条纵向闭环

依赖 API-B。这一阶段形成第一个真正可用的播放器版本：

```text
启动/游客
  → 搜索歌曲
  → 打开歌曲或集合详情
  → 获取实际可播音质与 URL
  → 播放、暂停、切歌、seek
  → 展示歌词
  → 重启恢复队列并保持暂停
```

### 工作内容

- 实现纯 TypeScript QueueController、PlaybackEngine、PlaybackCoordinator、TrackResolver 和 PlaybackStore。
- 实现根层 AudioHost、Pinia 只读适配、PlayerBar、QueueDrawer、TrackRow 和 MediaArtwork。
- 实现列表循环、单曲循环、随机洗牌、队列拖动、删除/清空、单曲插播和集合替换。
- 实现音质自动选择、具体档位、逐曲回退、播放中换源和 actualLevel。
- 实现 VIP/付费小标、不可播放轻提示与有限自动跳歌。
- 实现搜索页、搜索结果、最小歌曲详情/播放详情和歌词视图。

### 播放快照默认

- 队列、当前项、模式、音量和静音发生语义变化后立即以短防抖原子写入；播放进度每 5 秒节流写入，并在 pause、seek 完成、最小化和退出前刷新。
- 快照不按时间自动过期；Schema 不兼容或账户 generation 不匹配时丢弃。启动只恢复到暂停态。
- 恢复歌曲失效时保留队列和当前项；用户点击播放后按正常不可播放规则提示并尝试下一首，不在启动时静默改队列。

### 完成门禁

- 播放域测试矩阵通过；快速切歌无旧 generation 回写。
- PlayerBar 隐藏、路由跳转、窗口最小化不会停止 AudioHost。
- 关闭设置的“最小化/退出”两种路径均正确保存并清理。

## 8. Phase 4：完整音乐客户端页面

依赖 Phase 3 和 API-C 的相关只读/写入子集。

### 页面顺序

1. 歌单详情与我喜欢。
2. 专辑详情。
3. 歌手详情与歌手推荐。
4. 发现页。
5. 个人信息页。
6. 设置页剩余音乐、外观和数据模块。
7. 播放详情与沉浸歌词的完整视觉。

发现页和其他页面的 Section 清单、顺序、尺寸与密度暂不冻结，必须经过专项产品讨论。此阶段先实现 Section Registry、条件展示、独立错误边界和布局能力，再按讨论结论装配页面；候选 Section 不能因为已经存在组件就自动进入首版页面。

同时完成右键菜单矩阵、列表虚拟化、五档封面、Context Action、收藏/喜欢/歌单写入和相关 AlertDialog。MV、播客、电台不新增完整路由。

### 完成门禁

- 已冻结首版页面均有 Loading、Empty、Error、Ready 与键盘状态。
- 搜索和推荐“播放全部”按可见集合替换队列；所有入口队列语义一致。
- 登录态、权益、缓存和写操作失败均来自 Adapter 契约，不读取原始 API 字段。

## 9. Phase 5：小云 Agent 主闭环

### 工作内容

- 完成首次引导、Provider Profile、OpenAI Compatible、Anthropic Messages 和 Gemini 协议 Adapter。
- 实现单 Active Turn、流式增量、取消、12 轮/24 Tool Call 限额、超时及五次模型超时重试。
- 实现 10 个核心 Tool、Capability Catalog 两步兜底、Entity Resolver 和 PlayerCommandGateway。
- 实现 M1～M4、S1～S4 纯函数策略、Approval Coordinator、幂等命令和 Tool Scheduler。
- 实现小云一级路由、AgentComposer、ToolExecutionCard、ApprovalCard、SelectionCard 和上下文登录/模型配置提示。

### 建议内部顺序

1. Provider 文本流式对话。
2. 单个只读搜索 Tool。
3. 播放命令与真实回执。
4. 审批挂起/拒绝/过期。
5. 选择卡与实体消歧。
6. 收藏、歌单、评论等写入 Tool。
7. Capability Catalog 通用低频 API 兜底。

### 完成门禁

- 小云可完成“搜索并播放”“把歌加入指定歌单”“需要时询问候选”“用户拒绝后零执行”等真实 E2E。
- 离开小云路由不取消 Turn；新消息、退出、换号和 Utility 故障按冻结终态处理。
- 模型看不到权限等级判断、Cookie、凭据或未注册能力。

## 10. Phase 6：记忆、音乐人格画像与推荐

- 实现 10 分钟会话块、摘要、Working Memory、SQLite FTS5 和账户隔离。
- 实现画像提示、完整分析 Job、变化评分、30/15 分规则、7 天静默期和用户纠正/暂停/删除。
- 实现本地聚合特征、代表样本分页 Tool、云端数据披露和失败恢复。
- 接通“小云为你推荐”的数据能力和小云 Prompt，但不在页面 Section 讨论前硬编码其页面位置或装配顺序；展示模块本身不自动播放。

完成门禁是：退出重登恢复相同账号记忆；游客无画像；画像生成和更新均由用户触发；删除画像不误删聊天或网易云数据。

## 11. Phase 7：语音、Shell、Dynamic Skill 与 MCP

### 7A 语音

- 产品化 T-04 InputHookHost、录音、音乐固定降音和云端 ASR。
- 实现权限提示、快捷键改录、冲突反馈和应用内麦克风回退。
- 不实现 TTS。

### 7B Shell

- 按 Shell Execution Baseline 产品化执行器、分类器、工作区授权、输出流和进程树监督。
- UI 只使用独立 CommandSafetyControl 和现有 ApprovalCard，不增加第三套安全等级。

### 7C Skill/MCP

- Skill 发现、导入、Git 安装、Host、启停、更新、回滚和 7 天回收。
- MCP `stdio`/Streamable HTTP、配置导入导出、按需连接、Tool 命名、逐次审批和进程监督。
- 配置导出不包含凭据、Secret 或可逆 Credential Reference；旧 HTTP+SSE 不实现也不展示兼容标记。

完成门禁包括恶意/损坏包、崩溃进程、配置变化重审、MCP 工具逐次审批和应用退出零孤儿进程。

## 12. Phase 8：双平台发布硬化

- Windows NSIS；macOS DMG/ZIP、签名、公证和 Gatekeeper 验证。
- 冷启动、内存、长列表、封面缓存、Agent 长输出、玻璃材质和后台播放性能预算。
- 键盘、Focus Visible、对比度、减少动画/透明度和关键辅助功能回归。
- 数据迁移、损坏恢复、卸载残留说明、隐私披露、账户风险说明和第三方许可证。
- 关于页只展示版本与仓库入口；不实现更新器。

发布候选必须在干净 Windows/macOS 机器安装验证，不能只运行开发构建。

## 13. 测试分层

| 层级 | 主要对象 | 何时运行 |
| --- | --- | --- |
| Unit | reducer、队列、权限纯函数、字段合并、路径分类、画像评分 | 每次提交 |
| Contract | IPC、Provider、Music Adapter、SQLite migration、Tool Schema | 每次提交 |
| Component | Design System、TrackRow、卡片、路由状态 | 每次提交 |
| Integration | Utility、播放器、数据库、登录 Session、Shell Host | PR/主分支 |
| E2E | 登录、搜索播放、小云工具、审批、重启恢复 | PR/夜间 |
| Packaged Smoke | 安装、签名、权限、原生模块、后台播放 | Release Candidate |

任何 Phase 不以“页面能打开”为完成标准，必须通过该阶段列出的领域和故障验收。

## 14. 开工后的首批任务顺序

1. 创建 `package.json`、锁文件、版本约束和标准脚本。
2. 建立 Main、Preload、Renderer、Utility 与可选 InputHookHost 目录，配置 electron-vite 多入口和最小启动窗口。
3. 建立共享 Zod Contract、受限 Preload 与 Utility ping/snapshot。
4. 建立测试、Lint、依赖边界和双平台 CI。
5. 实现 Design Tokens、`@lucide/vue` Icon Registry、Button/IconButton 和 UI Lab。
6. 实现 AppShell、路由、左侧导航和双平台 WindowChrome。
7. 实现 QueueController/PlaybackCoordinator 纯逻辑与测试。
8. 并行执行登录、媒体链路、按键 Hook、Shell 进程树和系统媒体 Spike。
9. API-A/API-B 通过后接入第一个“游客搜索并播放”纵向闭环。

这九项完成后再开始批量页面，不允许提前复制临时组件或直接依赖上游 API 响应。
