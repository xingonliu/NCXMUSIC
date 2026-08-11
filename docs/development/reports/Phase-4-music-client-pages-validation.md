# Phase 4 完整音乐客户端页面验证

> 执行日期：2026-08-10
> 结论：`pass`
> 对应路线图：Phase 4

## 1. 页面与路由

首版音乐页面已完成正式路由装配：

| 页面 | 路由 | 主要交付 |
| --- | --- | --- |
| 发现 | `/discover` | 独立 Section、推荐歌单、每日推荐、新歌、播放全部、签到 |
| 我喜欢 | `/library/liked` | 登录门禁、喜欢歌曲、集合播放、取消喜欢、虚拟列表 |
| 歌单/专辑 | `/playlists/:id`、`/albums/:id` | Hero、元数据、收藏、播放/入队、虚拟列表 |
| 歌手 | `/artists/:id` | 歌手资料、热门歌曲、专辑、相似歌手及独立失败边界 |
| 歌曲 | `/songs/:id` | 歌曲详情、播放入口与评论区 |
| 个人信息 | `/profile` | 游客门禁、公开资料、签到、缓存与账户操作 |
| 设置 | `/settings` | 账户、音乐、外观、数据四组设置 |
| 沉浸播放 | 应用根层展示状态 | 从 PlayerBar 封面连续展开的全窗播放、歌词、队列和高精度封面 |

首次引导、登录和小云仍保留既定路由边界，由其对应阶段实现业务内容；Phase 4 未新增 MV、播客或电台路由。

## 2. Section Registry 装配

发现页首版装配冻结为：

| 顺序 | Section ID | 条件 | 数据依赖 | 缓存键语义 | 状态 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `featured-playlists` | 全部账户 | `getFeaturedPlaylists(10)` | `featured:10` | Loading/Empty/Error/Ready |
| 2 | `daily-songs` | 已登录网易云 | `getDailySongs(20)` | `daily:<accountId>` | Loading/Empty/Error/Ready |
| 3 | `new-songs` | 全部账户 | `getNewSongs(12)` | `new:12` | Loading/Empty/Error/Ready |

Section 请求彼此独立；每日推荐在游客状态直接隐藏，不展示无意义空壳。单个 Section 失败只显示该区块错误和重试入口，不阻断其他内容。所有“播放全部”只使用当前可见歌曲集合替换队列并从首项播放。

歌手页按“歌手资料/热门歌曲、专辑、相似歌手”拆分数据依赖。歌手资料失败阻止 Hero，专辑或相似歌手失败只影响对应 Section。

歌曲、专辑和歌单详情均在主体内容后装配评论 Section。评论读取拥有独立的 Loading、Empty、Error、Ready 与分页状态，不阻断详情主体；游客可以读取，发布、点赞和删除只在登录后开放。

## 3. Adapter 与写入边界

`MusicReadPayloadSchema` 新增发现、每日歌曲、用户歌单、喜欢歌曲、歌手专辑与相似歌手请求。Renderer 只消费 `songCollection`、`playlistCollection`、`albumCollection`、`artistCollection` 和标准实体结果。

`music.mutate` 是独立严格协议，不与 `music.read` 混用。已登记动作：

- 喜欢/取消喜欢歌曲；
- 收藏/取消收藏歌单与专辑；
- 创建、重命名、删除自建歌单；
- 向歌单添加或移除歌曲；
- 调整自建歌单歌曲顺序；
- 发布、删除与点赞/取消点赞歌曲、专辑和歌单评论；
- 每日签到。

Utility 在执行写入前检查活动凭据租约；游客返回 `AUTH_REQUIRED`。写操作不透明重试，只返回操作名、成功标记、稳定实体 ID 和标准时间，不返回 Cookie、上游响应或数据库路径。

## 4. UI 与交互

- `MediaArtwork` 使用 `thumbnail`、`compact`、`card`、`feature`、`hero` 五档语义尺寸，并通过 URL API 替换唯一 `param`。
- 沉浸播放不再占用二级路由；展示层与 `AppShell`、`PlayerBar` 并列，关闭后保留原页面、导航历史和滚动位置。
- PlayerBar 封面与沉浸页封面通过 View Transition 共享元素连续缩放，开合方向由文档根节点显式标记；关闭时共享元素裁切层同步收敛到 PlayerBar 的 40 × 40px 尺寸和 `--ncx-radius-md` 圆角后才交还真实封面，避免落点抖动。展示层从窗口底部展开；减少动态效果时直接切换。
- 沉浸页关闭短杆固定在页面顶部水平中央，保持单根加粗 SVG 横线，悬停仅显示泛光，不改变形状或增加底色；短杆不再响应拖动、位移阈值或封面手势插值，仅在点击时请求关闭，并继续复用既有 View Transition 共享元素动画返回 PlayerBar。
- 沉浸歌词按已唱、正在唱和未唱三态建立透明度、缩放与模糊层级；`yrc` 逐字时间通过 `requestAnimationFrame` 驱动渐变遮罩、起音微弹跳和随音节时长延展的发光包络。
- 当前歌词或长间奏节点通过质量、刚度和阻尼积分弹簧滚动至容器 38% 高度；鼠标滚轮或触摸浏览会立即暂停跟随，连续交互重置 4 秒闲置计时，恢复后弹簧回到当前焦点。点击任意歌词行会按 `lineStartMs` 跳播并立即恢复跟随。
- 相邻歌词间真实空白超过 8 秒时插入三点式间奏节点；声部标签与整行括号文本归一化为副唱并右侧缩进。当前标准歌词与歌曲实体没有 BPM 字段，因此间奏点使用中性呼吸节律，不宣称与真实 Tempo 对齐。
- `VirtualTrackList` 使用固定行高、可视窗口和前后缓冲，长列表不会一次挂载全部歌曲行。
- `TrackRow` 支持播放、下一首、队尾入队、喜欢、加入歌单、查看详情、小云入口和复制链接；上下文菜单支持鼠标、Context Menu 键与 Shift+F10，并在关闭后恢复焦点。
- 自建歌单支持移除歌曲及上移/下移；顺序变更先提供即时反馈，上游失败时恢复原顺序并提示。
- 评论区支持分页读取、发布、点赞/取消点赞和删除本人评论；删除使用 `AlertDialog`，其他写入动作使用就地反馈且没有透明重试。
- 删除自建歌单使用 `AlertDialog`；取消收藏直接执行并通过页面轻提示反馈。
- 游客完全隐藏歌单次导航；登录用户显示我喜欢、自建歌单和可折叠收藏歌单。
- 主题支持跟随系统、浅色和深色；歌词翻译、播放音质及关闭窗口行为可设置。
- 主窗口默认关闭行为为最小化继续播放；选择退出后关闭按钮进入真实退出流程。

## 5. 自动验证

已新增并通过：

- `tests/contract/music-mutation-contract.test.ts`：严格写入载荷、秘密字段拒绝、危险目标校验；
- `tests/contract/music-read-contract.test.ts`：评论集合严格读取协议与原始字段拒绝；
- `tests/unit/netease-music-api-adapter.test.ts`：评论归一化、评论写入、歌曲排序与标准写入回执；
- `tests/unit/music-service.test.ts`：游客写入门禁和凭据租约单次执行；
- `tests/unit/phase4-music-ui.test.ts`：五档封面、占位布局、长列表虚拟窗口、评论游客态、自建歌单动作与键盘上下文菜单。

全量结果：

- `pnpm typecheck`：通过；
- `pnpm lint`：通过，0 个错误、156 个既有 warning 级 Vue 模板排版提示，架构边界通过；
- `pnpm test`：48 个文件通过、1 个文件按环境跳过，366 个测试通过、6 个按环境跳过；
- `pnpm test:e2e`：1/1 通过；
- `pnpm smoke:build`：构建产物契约与 Electron 冒烟通过，覆盖 Renderer 无 Node 全局、Utility 崩溃恢复、取消、音频可播放、状态快照和重载重连；
- 隔离用户目录 Electron 截图：1280×800 与最小 960×640 首屏非空，22 张真实封面加载；紧凑态 PlayerBar 保留 Liquid Glass 位移滤镜且无内容拉伸，页面横向宽度等于视口。

## 6. 保留风险

- 当前自动测试使用标准化 API 夹具，没有替代真实登录账号的评论、歌单排序及其他写入回归。
- VIP、付费、已购与高码率资源仍需真实权益账号覆盖。
- 2026-08-10 Windows 自动视觉复验因 Computer Use 运行时窗口状态抓取上下文错误未能完成；既有隔离用户目录截图证据保留，macOS/Windows 原生窗口、不同 DPI 和最小窗口视觉矩阵继续由 Phase 8 发布硬化覆盖。
- API 上游可能对推荐、签到或收藏接口返回账户相关业务码；统一 Adapter 会安全转换为标准失败，不会让页面读取原始字段。
