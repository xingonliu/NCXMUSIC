# ncm.search / search

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`0272ab7a5620253eefc80708f6116876e8ae0c3745d1028a0062d71d8f689bf4`（pkg）
- 导出名：search
- 路由或调用方式：`/api/search/voice/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：search / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/search.js（注释：搜索）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/search
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| type | string | 可选（默认 `1`） | 源码读取 query.type |
| keywords | string | 未发现默认值 | 源码读取 query.keywords |
| limit | string | 可选（默认 `30`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId, artistId, albumId, playlistId, mvId, videoId, djId
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 10）

## 6. 响应信封

- transport：Phase 1 起记录
- business code：Phase 1 起记录
- error shapes：Phase 1 起记录

## 7. 字段表

| JSONPath | rawType | presence | null | conditions | example | meaning | confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 无运行样本）

## 8. 多变量差异

- 未登录 vs 游客：待测
- 游客 vs 普通登录：待测
- 普通 vs VIP：待测
- 未购 vs 已购：待测
- 自有 vs 他人资源：待测
- 默认参数 vs 显式参数：待测

## 9. 分页、缓存和时效

- 分页形态（静态）：offset
- 缓存/时效：Phase 1 起记录

## 10. 副作用与回滚

- pre snapshot：未执行
- write result：未执行
- read-after-write：未执行
- rollback：未执行
- orphan：无

## 11. 未知字段与冲突

（Phase 1 起填充 05-unknown-fields.md）

## 12. NcxMusic 结论

- 当前 Adapter 能否开发：待运行时字段事实
- 标准实体映射：待定
- 降级策略：待定
- 是否建议进入 Capability Catalog：待定（Phase 15）
- 建议权限级别：待定
- 尚未完成事项：登录三态 smoke、最低用例数、结构稳定性、字段字典

## 14. Phase 2 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.search.empty.none.neg.001 | AUTH_NONE | - | 400 | 84 |  |
| ncm.search.kw1.type1.anon.001 | AUTH_ANON | - | 200 | 371 |  |
| ncm.search.kw1.type1.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 241 |  |
| ncm.search.kw1.type1.none.001 | AUTH_NONE | - | 200 | 223 |  |
| ncm.search.kw1.type1.none.002 | AUTH_NONE | - | 200 | 239 |  |
| ncm.search.kw1.type10.none.001 | AUTH_NONE | - | 200 | 234 |  |
| ncm.search.kw1.type100.none.001 | AUTH_NONE | - | 200 | 137 |  |
| ncm.search.kw1.type1000.none.001 | AUTH_NONE | - | 200 | 205 |  |
| ncm.search.kw1.type1004.none.001 | AUTH_NONE | - | 200 | 155 |  |
| ncm.search.kw1.type1014.none.001 | AUTH_NONE | - | 200 | 143 |  |
| ncm.search.kw2.type1.none.001 | AUTH_NONE | - | 200 | 177 |  |
| ncm.search.type999.none.neg.001 | AUTH_NONE | - | 200 | 80 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 12 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `400` |
| `result.albumCount` | number | 1 | 0 | 0 | AUTH_NONE | `453` |
| `result.albums[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_search_precision_album_tab_basic` |
| `result.albums[].alias` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `result.albums[].alias[]` | string | 1 | 0 | 0 | AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.albums[].artist.albumSize` | number | 3 | 0 | 0 | AUTH_NONE | `57` |
| `result.albums[].artist.alia` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `result.albums[].artist.alia[]` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.` |
| `result.albums[].artist.alias` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `result.albums[].artist.alias[]` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.` |
| `result.albums[].artist.briefDesc` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].artist.id` | number | 3 | 0 | 0 | AUTH_NONE | `7763` |
| `result.albums[].artist.img1v1Id` | number | 3 | 0 | 0 | AUTH_NONE | `109951167771736530` |
| `result.albums[].artist.img1v1Id_str` | string | 3 | 0 | 0 | AUTH_NONE | `109951167771736533` |
| `result.albums[].artist.img1v1Url` | string | 3 | 0 | 0 | AUTH_NONE | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `result.albums[].artist.musicSize` | number | 3 | 0 | 0 | AUTH_NONE | `420` |
| `result.albums[].artist.name` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `result.albums[].artist.picId` | number | 3 | 0 | 0 | AUTH_NONE | `109951167773880640` |
| `result.albums[].artist.picId_str` | string | 3 | 0 | 0 | AUTH_NONE | `109951167773880633` |
| `result.albums[].artist.picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p4.music.126.net/fq1O8ZRT5_FHzg_u` |
| `result.albums[].artist.topicPerson` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].artist.trans` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].artists[].albumSize` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].artists[].alias` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `result.albums[].artists[].briefDesc` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].artists[].id` | number | 3 | 0 | 0 | AUTH_NONE | `7763` |
| `result.albums[].artists[].img1v1Id` | number | 3 | 0 | 0 | AUTH_NONE | `109951167771736530` |
| `result.albums[].artists[].img1v1Id_str` | string | 3 | 0 | 0 | AUTH_NONE | `109951167771736533` |
| `result.albums[].artists[].img1v1Url` | string | 3 | 0 | 0 | AUTH_NONE | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `result.albums[].artists[].musicSize` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].artists[].name` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `result.albums[].artists[].picId` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].artists[].picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].artists[].topicPerson` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].artists[].trans` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].blurPicUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p4.music.126.net/fkqFqMaEt0CzxYS-` |
| `result.albums[].briefDesc` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].commentThreadId` | string | 3 | 0 | 0 | AUTH_NONE | `R_AL_3_35093341` |
| `result.albums[].company` | union<string|null> | 3 | 1 | 0 | AUTH_NONE | `蜂鸟音乐` |
| `result.albums[].companyId` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].containedSong` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].copyrightId` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].description` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].id` | number | 3 | 0 | 0 | AUTH_NONE | `35093341` |
| `result.albums[].mark` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].name` | string | 3 | 0 | 0 | AUTH_NONE | `光年之外` |
| `result.albums[].onSale` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `result.albums[].paid` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `result.albums[].pic` | number | 3 | 0 | 0 | AUTH_NONE | `18587244069235040` |
| `result.albums[].picId` | number | 3 | 0 | 0 | AUTH_NONE | `18587244069235040` |
| `result.albums[].picId_str` | string | 3 | 0 | 0 | AUTH_NONE | `18587244069235039` |
| `result.albums[].picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p4.music.126.net/fkqFqMaEt0CzxYS-` |
| `result.albums[].publishTime` | number | 3 | 0 | 0 | AUTH_NONE | `1483027200007` |
| `result.albums[].size` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `result.albums[].songs` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.albums[].status` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.albums[].tags` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.albums[].type` | string | 3 | 0 | 0 | AUTH_NONE | `Single` |
| `result.artistCount` | number | 1 | 0 | 0 | AUTH_NONE | `5` |
| `result.artists[].accountId` | number | 3 | 0 | 0 | AUTH_NONE | `281382` |
| `result.artists[].albumSize` | number | 3 | 0 | 0 | AUTH_NONE | `57` |
| `result.artists[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_search_precision_artist_tab_basic` |
| `result.artists[].alia[]` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.` |
| `result.artists[].alias` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `result.artists[].alias[]` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.` |
| `result.artists[].appendRecText` | string | 3 | 0 | 0 | AUTH_NONE | `演唱: 光年之外` |
| `result.artists[].fansGroup` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.artists[].fansSize` | number | 3 | 0 | 0 | AUTH_NONE | `14347003` |
| `result.artists[].followed` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `result.artists[].id` | number | 3 | 0 | 0 | AUTH_NONE | `7763` |
| `result.artists[].identityIconUrl` | string | 3 | 0 | 0 | AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `result.artists[].img1v1` | number | 3 | 0 | 0 | AUTH_NONE | `109951167771736530` |
| `result.artists[].img1v1Url` | string | 3 | 0 | 0 | AUTH_NONE | `https://p4.music.126.net/oJorrgJ3IotZUAb` |
| `result.artists[].musicSize` | number | 3 | 0 | 0 | AUTH_NONE | `420` |
| `result.artists[].mvSize` | number | 3 | 0 | 0 | AUTH_NONE | `116` |
| `result.artists[].name` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `result.artists[].picId` | number | 3 | 0 | 0 | AUTH_NONE | `109951167773880640` |
| `result.artists[].picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `https://p4.music.126.net/fq1O8ZRT5_FHzg_` |
| `result.artists[].recommendText` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.artists[].trans` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.hasMore` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `result.hlWords` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.hlWords[]` | string | 4 | 0 | 0 | AUTH_NONE | `光年之外` |
| `result.mvCount` | number | 1 | 0 | 0 | AUTH_NONE | `31` |
| `result.mvs[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_search_precision_mv_tab_basic` |
| `result.mvs[].alias` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.mvs[].artistId` | number | 3 | 0 | 0 | AUTH_NONE | `7763` |
| `result.mvs[].artistName` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `result.mvs[].artists[].alias` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `result.mvs[].artists[].alias[]` | string | 6 | 0 | 0 | AUTH_NONE | `邓紫棋` |
| `result.mvs[].artists[].id` | number | 3 | 0 | 0 | AUTH_NONE | `7763` |
| `result.mvs[].artists[].name` | string | 3 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `result.mvs[].artists[].transNames` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.mvs[].arTransName` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.mvs[].briefDesc` | union<string|null> | 3 | 1 | 0 | AUTH_NONE | ` 邓紫棋深情献唱演绎史诗爱情` |
| `result.mvs[].cover` | string | 3 | 0 | 0 | AUTH_NONE | `http://p3.music.126.net/T5u6tvoe6_AJkbOB` |
| `result.mvs[].desc` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.mvs[].duration` | number | 3 | 0 | 0 | AUTH_NONE | `235590` |
| `result.mvs[].id` | number | 3 | 0 | 0 | AUTH_NONE | `5404646` |
| `result.mvs[].mark` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.mvs[].name` | string | 3 | 0 | 0 | AUTH_NONE | `光年之外` |
| `result.mvs[].playCount` | number | 3 | 0 | 0 | AUTH_NONE | `25140730` |
| `result.mvs[].transNames` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.playlistCount` | number | 1 | 0 | 0 | AUTH_NONE | `291` |
| `result.playlists[].action` | string | 3 | 0 | 0 | AUTH_NONE | `orpheus://nm/playlist/detail?id=24883068` |
| `result.playlists[].actionType` | string | 3 | 0 | 0 | AUTH_NONE | `orpheus` |
| `result.playlists[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_search_rec_playlist_tab_basic_rewrit` |
| `result.playlists[].bookCount` | number | 3 | 0 | 0 | AUTH_NONE | `88394` |
| `result.playlists[].coverImgUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p1.music.126.net/fkqFqMaEt0CzxYS-` |
| `result.playlists[].creator.authStatus` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.playlists[].creator.avatarUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p3.music.126.net/Yaj02ehGq7ZKreCA` |
| `result.playlists[].creator.experts` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.playlists[].creator.expertTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.playlists[].creator.nickname` | string | 3 | 0 | 0 | AUTH_NONE | `Master-辰曜` |
| `result.playlists[].creator.userId` | number | 3 | 0 | 0 | AUTH_NONE | `1298326298` |
| `result.playlists[].creator.userType` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.playlists[].description` | union<null|string> | 3 | 1 | 0 | AUTH_NONE | `那个被称作“神仙打架”的年代，华语乐坛的夜空仿佛被无数颗璀璨的星辰点亮。那是一个` |
| `result.playlists[].highQuality` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `result.playlists[].id` | number | 3 | 0 | 0 | AUTH_NONE | `2488306802` |
| `result.playlists[].name` | string | 3 | 0 | 0 | AUTH_NONE | `邓紫棋热门单曲` |
| `result.playlists[].officialPlaylistTitle` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.playlists[].officialTags` | null | 2 | 2 | 0 | AUTH_NONE |  |
| `result.playlists[].officialTags[]` | string | 1 | 0 | 0 | AUTH_NONE | `最多人点` |
| `result.playlists[].playCount` | number | 3 | 0 | 0 | AUTH_NONE | `9528324` |
| `result.playlists[].playlistType` | string | 3 | 0 | 0 | AUTH_NONE | `UGC` |
| `result.playlists[].recommendText` | string | 3 | 0 | 0 | AUTH_NONE | `包含《光年之外》` |
| `result.playlists[].score` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.playlists[].specialType` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.playlists[].subscribed` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `result.playlists[].trackCount` | number | 3 | 0 | 0 | AUTH_NONE | `49` |
| `result.playlists[].userId` | number | 3 | 0 | 0 | AUTH_NONE | `1298326298` |
| `result.searchQcReminder` | null | 2 | 2 | 0 | AUTH_NONE |  |
| `result.songCount` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `318` |
| `result.songs[].album.alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.songs[].album.artist.albumSize` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.alias` | array<unknown> | 15 | 0 | 15 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].album.artist.id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.img1v1` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.img1v1Url` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/6y-UleORITEDbvr` |
| `result.songs[].album.artist.musicSize` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result.songs[].album.artist.picId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.copyrightId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `result.songs[].album.mark` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].album.picId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `result.songs[].album.publishTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1483027200007` |
| `result.songs[].album.size` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].album.status` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].alias` | array<unknown> | 11 | 0 | 11 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].alias[]` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.songs[].artists[].albumSize` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].alias` | array<unknown> | 23 | 0 | 23 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].artists[].id` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `result.songs[].artists[].img1v1` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].img1v1Url` | string | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/6y-UleORITEDbvr` |
| `result.songs[].artists[].musicSize` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].name` | string | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `result.songs[].artists[].picId` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].copyrightId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1415926` |
| `result.songs[].duration` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `235505` |
| `result.songs[].fee` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].ftype` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `result.songs[].mark` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17179877376` |
| `result.songs[].mvid` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5404646` |
| `result.songs[].name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].rtype` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].status` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.videoCount` | number | 1 | 0 | 0 | AUTH_NONE | `22` |
| `result.videos[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_search_precision_video_tab_basic` |
| `result.videos[].aliaName` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.videos[].coverUrl` | string | 3 | 0 | 0 | AUTH_NONE | `https://p3.music.126.net/orxhKbrJbmP53TY` |
| `result.videos[].creator[].userId` | number | 3 | 0 | 0 | AUTH_NONE | `37511311` |
| `result.videos[].creator[].userName` | string | 3 | 0 | 0 | AUTH_NONE | `青岛泰安` |
| `result.videos[].durationms` | number | 3 | 0 | 0 | AUTH_NONE | `124000` |
| `result.videos[].markTypes` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.videos[].playTime` | number | 3 | 0 | 0 | AUTH_NONE | `1571` |
| `result.videos[].title` | string | 3 | 0 | 0 | AUTH_NONE | `青岛城市管理学校2021文艺汇演《光年之外》卜沣、孟俊丽` |
| `result.videos[].transName` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `result.videos[].type` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `result.videos[].vid` | string | 3 | 0 | 0 | AUTH_NONE | `14226082` |
| `trp.rules[]` | string | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `search_tab_song::552458417::searchAlg$is` |
