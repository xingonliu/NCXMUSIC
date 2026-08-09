# Phase 4 完整音乐客户端页面验证

> 执行日期：2026-08-09
> 结论：`provisional-pass`
> 对应路线图：Phase 4

## 1. 页面与路由

首版音乐页面已完成正式路由装配：

| 页面 | 路由 | 主要交付 |
| --- | --- | --- |
| 发现 | `/discover` | 独立 Section、推荐歌单、每日推荐、新歌、播放全部、签到 |
| 我喜欢 | `/library/liked` | 登录门禁、喜欢歌曲、集合播放、取消喜欢、虚拟列表 |
| 歌单/专辑 | `/playlists/:id`、`/albums/:id` | Hero、元数据、收藏、播放/入队、虚拟列表 |
| 歌手 | `/artists/:id` | 歌手资料、热门歌曲、专辑、相似歌手及独立失败边界 |
| 个人信息 | `/profile` | 游客门禁、公开资料、签到、缓存与账户操作 |
| 设置 | `/settings` | 账户、音乐、外观、数据四组设置 |
| 播放详情/沉浸歌词 | `/playback`、`/lyrics` | 页面内完整控制、歌词、队列和高精度封面 |

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

## 3. Adapter 与写入边界

`MusicReadPayloadSchema` 新增发现、每日歌曲、用户歌单、喜欢歌曲、歌手专辑与相似歌手请求。Renderer 只消费 `songCollection`、`playlistCollection`、`albumCollection`、`artistCollection` 和标准实体结果。

`music.mutate` 是独立严格协议，不与 `music.read` 混用。已登记动作：

- 喜欢/取消喜欢歌曲；
- 收藏/取消收藏歌单与专辑；
- 创建、重命名、删除自建歌单；
- 向歌单添加或移除歌曲；
- 每日签到。

Utility 在执行写入前检查活动凭据租约；游客返回 `AUTH_REQUIRED`。写操作不透明重试，只返回操作名、成功标记、稳定实体 ID 和标准时间，不返回 Cookie、上游响应或数据库路径。

## 4. UI 与交互

- `MediaArtwork` 使用 `thumbnail`、`compact`、`card`、`feature`、`hero` 五档语义尺寸，并通过 URL API 替换唯一 `param`。
- `VirtualTrackList` 使用固定行高、可视窗口和前后缓冲，长列表不会一次挂载全部歌曲行。
- `TrackRow` 支持播放、下一首、队尾入队、喜欢和复制链接右键动作；歌单导航支持自建/收藏分组及管理菜单。
- 删除自建歌单使用 `AlertDialog`；取消收藏直接执行并通过页面轻提示反馈。
- 游客完全隐藏歌单次导航；登录用户显示我喜欢、自建歌单和可折叠收藏歌单。
- 主题支持跟随系统、浅色和深色；歌词翻译、播放音质及关闭窗口行为可设置。
- 主窗口默认关闭行为为最小化继续播放；选择退出后关闭按钮进入真实退出流程。

## 5. 自动验证

已新增并通过：

- `tests/contract/music-mutation-contract.test.ts`：严格写入载荷、秘密字段拒绝、危险目标校验；
- `tests/unit/netease-music-api-adapter.test.ts`：Phase 4 集合归一化与标准写入回执；
- `tests/unit/music-service.test.ts`：游客写入门禁和凭据租约单次执行；
- `tests/unit/phase4-music-ui.test.ts`：五档封面、占位布局和长列表虚拟窗口。

全量结果：

- `pnpm typecheck`：通过；
- `pnpm lint`：通过，架构边界无错误；保留仓库 warning 级 Vue 模板排版提示；
- `pnpm test`：38 个文件通过、1 个文件按环境跳过，325 个测试通过、6 个按环境跳过；
- `pnpm test:e2e`：1/1 通过；
- `pnpm build` 与 `pnpm smoke:build`：通过；
- 隔离用户目录 Electron 截图：1280×800 与最小 960×640 首屏非空，22 张真实封面加载；紧凑态 PlayerBar 关闭位移滤镜后无内容拉伸，页面横向宽度等于视口。

## 6. 保留风险

- 当前自动测试使用标准化 API 夹具，没有替代真实登录账号的写入回归。
- VIP、付费、已购与高码率资源仍需真实权益账号覆盖。
- macOS 与 Windows 的原生窗口、不同 DPI 和最小窗口视觉仍需发布硬化阶段截图验证。
- API 上游可能对推荐、签到或收藏接口返回账户相关业务码；统一 Adapter 会安全转换为标准失败，不会让页面读取原始字段。
