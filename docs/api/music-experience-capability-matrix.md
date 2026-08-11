# 音乐体验 API 能力矩阵

本文记录发现、浏览、搜索、个人主页、集合详情与歌手详情使用的标准能力，以及上游字段缺失时的界面降级规则。Renderer 只消费 `MusicReadResult`，不直接依赖网易云原始响应。

## 读取能力

| 标准操作 | 网易云适配器能力 | 页面用途 | 降级规则 |
| --- | --- | --- | --- |
| `getFeaturedPlaylists` | `personalized` | 发现页精选歌单、浏览页新歌推荐歌单 | 独立 Section 显示错误，不阻塞其他内容 |
| `getNewSongs` | `top_song` | 发现页十首双列新歌、浏览页最新单曲 | 返回空集合时显示空状态 |
| `getDailySongs` | `recommend_songs` | 猜你喜欢 | 未登录或请求失败时使用新歌集合 |
| `getPersonalFm` | `personal_fm` | 个人电台卡 | 不可用时保留明确的空状态 |
| `getRecommendedArtists` | `top_artists` | 发现页与浏览页歌手推荐 | 同类 Section 独立失败 |
| `getNewAlbums` | `top_album` | 浏览页最新专辑 | 同类 Section 独立失败 |
| `getCharts` | `toplist` | 榜单预览与完整榜单页 | 榜单标签由响应中的 `updateFrequency` 去重生成，不维护静态分类 |
| `getCategoryPlaylists` | `top_playlist` | 按风格、场景、情绪浏览歌单 | `category` 原样来自动态 facet 选项 |
| `getArtists` | `artist_list` | 地区、类型、首字母筛选歌手 | 筛选值只能来自 `getBrowseFacets`，页面不维护枚举 |
| `getBrowseFacets` | `playlist_catlist` 与 `artist_list` 能力描述 | 浏览页与歌手探索的标签、筛选项 | 歌单分类实时解析 `categories`/`sub`；歌手固定数值域集中在适配器能力层 |
| `getSearchSuggestions` | `search_suggest` | 输入中实时搜索建议 | 请求取消与 180ms 防抖；失败时不显示伪造建议 |
| `search` | `cloudsearch` | 全部、歌曲、歌手、专辑、歌单、歌词结果 | `category` 决定上游搜索类型；各分类独立展示 |
| `getLyrics` | `lyric_new`，缺失时回退 `lyric` | 普通与沉浸歌词时间轴 | 优先解析 `yrc` 的行级和字/音节级绝对时间；无 `yrc` 时解析 `lrc`，并以相邻行间隔和文本长度上限推断持续时间；`tlyric` 按起始毫秒合并翻译 |
| `getListeningHistory` | `user_record` | 最近一周与所有时间听歌排行 | `score` 映射到歌曲 `listeningCount` |
| `getArtistSongs` | `artist_songs` | 参与作品与合集 | 无明确合作艺人关系时以近期作品替代并显示说明 |

## 写入能力

| 标准操作 | 网易云适配器能力 | 用途 |
| --- | --- | --- |
| `subscribeArtist` | `artist_sub` | 关注或取消关注歌手 |
| `subscribePlaylist` | `playlist_subscribe` | 添加或移除资料库中的歌单 |
| `likeTrack` | `like` | 收藏歌曲 |

## 动态筛选约束

- 多标签探索 Section 不在 Vue 页面写死选项。音乐风格、场景、情绪由 `playlist_catlist` 返回的分类树生成；歌手地区、类型、首字母由适配器公布的 `artist_list` 参数能力生成。
- 页面只按稳定的 facet key 选择展示位置，标签文字、选项文字和请求值都来自 `getBrowseFacets`。
- 排行榜标签由当前 `toplist` 响应里的更新频率生成；上游新增或删除频率后，界面会在下一次读取时同步变化。
- 搜索结果的实体类型标签属于标准搜索协议，不属于内容分类 facet；其值与 `MusicSearchPayloadSchema.category` 保持一致。
- Renderer 只消费标准歌词内存对象：歌词行包含 `lineStartMs`、`lineDurationMs`、`text`、`words`，逐字块包含 `text`、`startMs`、`durationMs`；不把上游 YRC 文本或 TTML 解析职责下放到页面。

## 不可得字段的优雅降级

- 网易云用户详情没有可靠的“获赞总数”字段：个人主页显示“暂未公开”，并提供解释性提示，不伪造数值。
- 歌手接口没有稳定的动态视频封面字段：歌手头图使用 `coverUrl`，缺失时回退到 `artworkUrl`，再缺失时使用纯色背景。
- 参与作品接口不保证直接标注客串关系：优先筛选包含其他艺人的歌曲，无法识别时展示近期作品并明确标注降级原因。
- 相似歌手接口可能要求登录或受上游限制：失败时回退到热门歌手推荐，同时排除当前歌手。
