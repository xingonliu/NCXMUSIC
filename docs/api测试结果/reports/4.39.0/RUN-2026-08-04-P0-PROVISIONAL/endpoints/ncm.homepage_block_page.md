# ncm.homepage_block_page / homepage_block_page

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`b37f377001f3e00c7b8b3f33252f0e4ee665894fcb16a39d0ef40ae670ac2694`（pkg）
- 导出名：homepage_block_page
- 路由或调用方式：`/api/homepage/block/page`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：homepage / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P2
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/homepage_block_page.js（注释：首页-发现 block page）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/homepage/block/page
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| refresh | string | 未发现默认值 | 源码读取 query.refresh |
| cursor | string | 未发现默认值 | 源码读取 query.cursor |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId, playlistId
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

- 分页形态（静态）：cursor
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
| ncm.homepage_block_page.anon.001 | AUTH_ANON | - | 200 | 796 |  |
| ncm.homepage_block_page.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 112 |  |
| ncm.homepage_block_page.none.001 | AUTH_NONE | - | 200 | 348 |  |
| ncm.homepage_block_page.refresh.none.001 | AUTH_NONE | - | 200 | 119 |  |
| ncm.homepage_block_page.repeat.none.001 | AUTH_NONE | - | 200 | 98 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `data.blockCodeOrderList` | null | 5 | 5 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].action` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlistCollection?referLog=HO` |
| `data.blocks[].actionType` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].blockCode` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `HOMEPAGE_BLOCK_PLAYLIST_RCMD` |
| `data.blocks[].blockDemote` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].blockStyle` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].canClose` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].canFeedback` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].action` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlist/750445279?autoplay=0&` |
| `data.blocks[].creatives[].actionType` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].creatives[].alg` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `alg-music-rec-village_playlist-alg_nsear` |
| `data.blocks[].creatives[].creativeId` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `750445279` |
| `data.blocks[].creatives[].creativeType` | string | 25 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `list` |
| `data.blocks[].creatives[].logInfo` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `{"deepScore":"0.0","cartScore":"0.0","sr` |
| `data.blocks[].creatives[].position` | number | 25 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].action` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlist/750445279?autoplay=0&` |
| `data.blocks[].creatives[].resources[].actionType` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].creatives[].resources[].alg` | union<string|null> | 53 | 21 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `alg-music-rec-village_playlist-alg_nsear` |
| `data.blocks[].creatives[].resources[].ctrp` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].likedCount` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].logInfo` | union<null|string> | 53 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `{"category1":"lan","category2":"欧美"}` |
| `data.blocks[].creatives[].resources[].name` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].playParams` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].position` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].replyCount` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceContentList` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo` | null | 13 | 13 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.alias` | string | 6 | 0 | 0 | AUTH_ANON | `[]` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].albumSize` | number | 22 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].alias` | union<array<unknown>|null> | 22 | 2 | 20 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].briefDesc` | string | 22 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].id` | number | 22 | 0 | 0 | AUTH_ANON | `90331` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].img1v1Id` | number | 22 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].img1v1Url` | union<string|null> | 22 | 2 | 0 | AUTH_ANON | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].musicSize` | number | 22 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].name` | string | 22 | 0 | 0 | AUTH_ANON | `Charlie Puth` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].picId` | number | 22 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].picUrl` | union<string|null> | 22 | 2 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].topicPerson` | number | 22 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.artists[].trans` | union<string|null> | 22 | 2 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.commentSimpleData.commentId` | number | 5 | 0 | 0 | AUTH_ANON | `137291804` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.commentSimpleData.content` | string | 5 | 0 | 0 | AUTH_ANON | `极品蓝调 前奏秒杀` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.commentSimpleData.threadId` | union<string|null> | 5 | 1 | 0 | AUTH_ANON | `R_SO_4_19827042` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.commentSimpleData.userId` | number | 5 | 0 | 0 | AUTH_ANON | `94505459` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.commentSimpleData.userName` | union<string|null> | 5 | 1 | 0 | AUTH_ANON | `千与千寻的夏天丶` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.hasListened` | boolean | 40 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.highQuality` | boolean | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.playCount` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44055536` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.alias` | array<unknown> | 15 | 0 | 15 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.albumSize` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.alias` | array<unknown> | 15 | 0 | 15 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.briefDesc` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.id` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.img1v1Id` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.img1v1Url` | string | 15 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.musicSize` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.name` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.picId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.picUrl` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.topicPerson` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artist.trans` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].albumSize` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].alias` | array<unknown> | 15 | 0 | 15 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].briefDesc` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].id` | number | 15 | 0 | 0 | AUTH_ANON | `90331` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].img1v1Id` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].img1v1Url` | string | 15 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].musicSize` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].name` | string | 15 | 0 | 0 | AUTH_ANON | `Charlie Puth` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].picId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].picUrl` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].topicPerson` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.artists[].trans` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.blurPicUrl` | string | 15 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/ZnSOe-J4MEfPj1J5` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.briefDesc` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.commentThreadId` | string | 15 | 0 | 0 | AUTH_ANON | `R_AL_3_34766248` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.company` | union<string|null> | 15 | 2 | 0 | AUTH_ANON | `华纳音乐` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.companyId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.copyrightId` | number | 15 | 0 | 0 | AUTH_ANON | `7002` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.description` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.dolbyMark` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.gapless` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.id` | number | 15 | 0 | 0 | AUTH_ANON | `34766248` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.mark` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.name` | string | 15 | 0 | 0 | AUTH_ANON | `We Don't Talk Anymore (Mr. Collipark Rem` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.onSale` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.pic` | number | 15 | 0 | 0 | AUTH_ANON | `109951163983943020` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.picId` | number | 15 | 0 | 0 | AUTH_ANON | `109951163983943020` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.picId_str` | string | 15 | 0 | 0 | AUTH_ANON | `109951163983943030` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.picUrl` | string | 15 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/ZnSOe-J4MEfPj1J5` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.publishTime` | number | 15 | 0 | 0 | AUTH_ANON | `1467907200000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.size` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.songs` | array<unknown> | 15 | 0 | 15 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.status` | number | 15 | 0 | 0 | AUTH_ANON | `3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.subType` | string | 15 | 0 | 0 | AUTH_ANON | `Remix` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.tags` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.transName` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.album.type` | string | 15 | 0 | 0 | AUTH_ANON | `Single` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.alias` | array<unknown> | 14 | 0 | 14 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.alias[]` | string | 1 | 0 | 0 | AUTH_ANON | `影视剧《人鱼》主题曲` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].albumSize` | number | 20 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].alias` | array<unknown> | 20 | 0 | 20 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].briefDesc` | string | 20 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].id` | number | 20 | 0 | 0 | AUTH_ANON | `90331` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].img1v1Id` | number | 20 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].img1v1Url` | string | 20 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].musicSize` | number | 20 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].name` | string | 20 | 0 | 0 | AUTH_ANON | `Charlie Puth` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].picId` | number | 20 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].picUrl` | string | 20 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].topicPerson` | number | 20 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.artists[].trans` | string | 20 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.audition` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.bitrate` | number | 15 | 0 | 0 | AUTH_ANON | `128000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.dfsId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.extension` | string | 15 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.id` | number | 15 | 0 | 0 | AUTH_ANON | `7485118694` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.name` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.playTime` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.size` | number | 15 | 0 | 0 | AUTH_ANON | `4071384` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.sr` | number | 15 | 0 | 0 | AUTH_ANON | `44100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.bMusic.volumeDelta` | number | 15 | 0 | 0 | AUTH_ANON | `-74581` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.commentThreadId` | string | 15 | 0 | 0 | AUTH_ANON | `R_SO_4_420478436` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.copyFrom` | string | 15 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.copyright` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.copyrightId` | number | 15 | 0 | 0 | AUTH_ANON | `7002` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.crbt` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.dayPlays` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.disc` | string | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.duration` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.fee` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.ftype` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hearTime` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.bitrate` | number | 15 | 0 | 0 | AUTH_ANON | `320000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.dfsId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.extension` | string | 15 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.id` | number | 15 | 0 | 0 | AUTH_ANON | `7485118696` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.name` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.playTime` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.size` | number | 15 | 0 | 0 | AUTH_ANON | `10178395` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.sr` | number | 15 | 0 | 0 | AUTH_ANON | `44100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hMusic.volumeDelta` | number | 15 | 0 | 0 | AUTH_ANON | `-78806` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.bitrate` | number | 6 | 0 | 0 | AUTH_ANON | `3085167` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.dfsId` | number | 6 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.extension` | string | 6 | 0 | 0 | AUTH_ANON | `flac` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.id` | number | 6 | 0 | 0 | AUTH_ANON | `16918157009` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.name` | null | 6 | 6 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.playTime` | number | 6 | 0 | 0 | AUTH_ANON | `173000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.size` | number | 6 | 0 | 0 | AUTH_ANON | `66719947` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.sr` | number | 6 | 0 | 0 | AUTH_ANON | `96000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.hrMusic.volumeDelta` | number | 6 | 0 | 0 | AUTH_ANON | `-68644` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.id` | number | 15 | 0 | 0 | AUTH_ANON | `420478436` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.bitrate` | number | 15 | 0 | 0 | AUTH_ANON | `128000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.dfsId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.extension` | string | 15 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.id` | number | 15 | 0 | 0 | AUTH_ANON | `7485118694` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.name` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.playTime` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.size` | number | 15 | 0 | 0 | AUTH_ANON | `4071384` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.sr` | number | 15 | 0 | 0 | AUTH_ANON | `44100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.lMusic.volumeDelta` | number | 15 | 0 | 0 | AUTH_ANON | `-74581` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mark` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.bitrate` | number | 15 | 0 | 0 | AUTH_ANON | `192000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.dfsId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.extension` | string | 15 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.id` | number | 15 | 0 | 0 | AUTH_ANON | `7485118695` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.name` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.playTime` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.size` | number | 15 | 0 | 0 | AUTH_ANON | `6107054` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.sr` | number | 15 | 0 | 0 | AUTH_ANON | `44100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mMusic.volumeDelta` | number | 15 | 0 | 0 | AUTH_ANON | `-76270` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mp3Url` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.mvid` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.name` | string | 15 | 0 | 0 | AUTH_ANON | `We Don't Talk Anymore (Mr. Collipark Rem` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.no` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.noCopyrightRcmd` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.originCoverType` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.originSongSimpleData` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.playedNum` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.popularity` | number | 15 | 0 | 0 | AUTH_ANON | `100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.position` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.publishTime` | number | 15 | 0 | 0 | AUTH_ANON | `1467907200007` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.ringtone` | union<null|string> | 15 | 3 | 0 | AUTH_ANON | `` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.rtUrl` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.rtUrls` | array<unknown> | 15 | 0 | 15 | AUTH_ANON | `undefined` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.rtype` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.rurl` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.score` | number | 15 | 0 | 0 | AUTH_ANON | `100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sign` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.single` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.bitrate` | number | 15 | 0 | 0 | AUTH_ANON | `1001017` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.dfsId` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.extension` | string | 15 | 0 | 0 | AUTH_ANON | `flac` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.id` | number | 15 | 0 | 0 | AUTH_ANON | `7485118701` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.name` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.playTime` | number | 15 | 0 | 0 | AUTH_ANON | `254400` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.size` | number | 15 | 0 | 0 | AUTH_ANON | `31832364` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.sr` | number | 15 | 0 | 0 | AUTH_ANON | `44100` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.sqMusic.volumeDelta` | number | 15 | 0 | 0 | AUTH_ANON | `-78854` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.starred` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.starredNum` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.status` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.transName` | union<null|string> | 15 | 12 | 0 | AUTH_ANON | `靠近` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.transNames[]` | string | 3 | 0 | 0 | AUTH_ANON | `靠近` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songData.videoInfo` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.bd` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.chargeInfoList[].chargeMessage` | null | 45 | 45 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.chargeInfoList[].chargeType` | number | 45 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.chargeInfoList[].chargeUrl` | null | 45 | 45 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.chargeInfoList[].rate` | number | 45 | 0 | 0 | AUTH_ANON | `128000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.code` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.cp` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.cs` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.dl` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.dlLevel` | string | 15 | 0 | 0 | AUTH_ANON | `none` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.dlLevels` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.downloadMaxbr` | number | 15 | 0 | 0 | AUTH_ANON | `999000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.downloadMaxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.fee` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.fl` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.flag` | number | 15 | 0 | 0 | AUTH_ANON | `1541124` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.flLevel` | string | 15 | 0 | 0 | AUTH_ANON | `none` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.cannotListenReason` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.freeLimitTagType` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.listenType` | number | 15 | 0 | 0 | AUTH_ANON | `3` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.playReason` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.resConsumable` | boolean | 15 | 0 | 0 | AUTH_ANON | `true` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.freeTrialPrivilege.userConsumable` | boolean | 15 | 0 | 0 | AUTH_ANON | `true` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.id` | number | 15 | 0 | 0 | AUTH_ANON | `420478436` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.ignoreCache` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.maxbr` | number | 15 | 0 | 0 | AUTH_ANON | `999000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.maxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.message` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.paidBigBang` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.payed` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.pc` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.pl` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.playMaxbr` | number | 15 | 0 | 0 | AUTH_ANON | `999000` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.playMaxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.plLevel` | string | 15 | 0 | 0 | AUTH_ANON | `none` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.plLevels` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.preSell` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.realPayed` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.rightSource` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.rscl` | null | 15 | 15 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.sp` | number | 15 | 0 | 0 | AUTH_ANON | `7` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.st` | number | 15 | 0 | 0 | AUTH_ANON | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.subp` | number | 15 | 0 | 0 | AUTH_ANON | `1` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.songPrivilege.toast` | boolean | 15 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.specialType` | number | 23 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].resourceId` | union<string|null> | 53 | 1 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `750445279` |
| `data.blocks[].creatives[].resources[].resourceState` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceType` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `list` |
| `data.blocks[].creatives[].resources[].resourceUrl` | null | 53 | 53 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.image.action` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].creatives[].resources[].uiElement.image.imageUrl` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/c7Gekyb26TumOhCe` |
| `data.blocks[].creatives[].resources[].uiElement.image.imageUrl2` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `data.blocks[].creatives[].resources[].uiElement.image.purePicture` | boolean | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.image.title` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].creatives[].resources[].uiElement.labelTexts` | array<unknown> | 4 | 0 | 4 | AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].creatives[].resources[].uiElement.labelTexts[]` | string | 56 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.canShowTitleLogo` | boolean | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.title` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `网易云音乐10万+评论合集` |
| `data.blocks[].creatives[].resources[].uiElement.rcmdShowType` | string | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.canShowTitleLogo` | boolean | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.rcmdText` | string | 1 | 0 | 0 | AUTH_ANON | `独家首发30天` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.title` | string | 29 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `超70%人播放` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.titleId` | string | 2 | 0 | 0 | AUTH_ANON | `title_10004` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.titleType` | string | 7 | 0 | 0 | AUTH_ANON | `songRcmdTag` |
| `data.blocks[].creatives[].resources[].valid` | boolean | 53 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.blocks[].creatives[].uiElement.button.action` | string | 3 | 0 | 0 | AUTH_ANON | `orpheus://nm/discovery/newsongalbum?tab=` |
| `data.blocks[].creatives[].uiElement.button.actionType` | string | 3 | 0 | 0 | AUTH_ANON | `orpheus` |
| `data.blocks[].creatives[].uiElement.button.biData` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].uiElement.button.iconUrl` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.blocks[].creatives[].uiElement.button.text` | string | 3 | 0 | 0 | AUTH_ANON | `更多新歌` |
| `data.blocks[].creatives[].uiElement.image.imageUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/c7Gekyb26TumOhCe` |
| `data.blocks[].creatives[].uiElement.image.purePicture` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.labelTexts` | array<unknown> | 4 | 0 | 4 | AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].creatives[].uiElement.labelTexts[]` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `data.blocks[].creatives[].uiElement.mainTitle.canShowTitleLogo` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.mainTitle.title` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `网易云音乐10万+评论合集` |
| `data.blocks[].creatives[].uiElement.rcmdShowType` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].creatives[].uiElement.subTitle.canShowTitleLogo` | boolean | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.subTitle.title` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.containerType` | string | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `rn` |
| `data.blocks[].crossPlatformConfig.rnContent.component` | string | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `rn-homepage-modules_dragonBall` |
| `data.blocks[].crossPlatformConfig.rnContent.engineId` | string | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.rnContent.estimatedHeight` | number | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `98` |
| `data.blocks[].crossPlatformConfig.rnContent.estimatedRatio` | string | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.rnContent.moduleName` | string | 4 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `rn-homepage-modules` |
| `data.blocks[].dislikeShowType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].extInfo.banners[].adDispatchJson` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adid` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adLocation` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adSource` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adurlV2` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].alg` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `banner-feature-1717750480637393` |
| `data.blocks[].extInfo.banners[].bannerBizType` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `force_banner` |
| `data.blocks[].extInfo.banners[].bannerId` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `1717750480637393` |
| `data.blocks[].extInfo.banners[].dynamicVideoData` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].encodeId` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `924680166` |
| `data.blocks[].extInfo.banners[].event` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].exclusive` | boolean | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].extInfo.banners[].extMonitor` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].extMonitorInfo` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].logContext` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].mainTitle` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorBlackList` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorClick` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorClickList` | array<unknown> | 12 | 0 | 12 | AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].extInfo.banners[].monitorImpress` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorImpressList` | array<unknown> | 12 | 0 | 12 | AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].extInfo.banners[].monitorType` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].pic` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/uE3Plj0H0aniKkKf` |
| `data.blocks[].extInfo.banners[].pid` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].program` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].requestId` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].extInfo.banners[].s_ctrp` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `syspf_resourceType_1000-syspf_resourceId` |
| `data.blocks[].extInfo.banners[].scm` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `1.music-homepage-home.homepage_banner_fo` |
| `data.blocks[].extInfo.banners[].showAdTag` | boolean | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.blocks[].extInfo.banners[].showContext` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].song` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].targetId` | number | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `924680166` |
| `data.blocks[].extInfo.banners[].targetType` | number | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `1000` |
| `data.blocks[].extInfo.banners[].titleColor` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `red` |
| `data.blocks[].extInfo.banners[].typeTitle` | string | 12 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `歌单` |
| `data.blocks[].extInfo.banners[].url` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].video` | null | 12 | 12 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].resourceIdList[]` | string | 3 | 0 | 0 | AUTH_ANON | `420478436` |
| `data.blocks[].showType` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `HOMEPAGE_SLIDE_PLAYLIST` |
| `data.blocks[].sort` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].uiElement.button.action` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlistCollection?referLog=HO` |
| `data.blocks[].uiElement.button.actionType` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].uiElement.button.biData` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.button.iconUrl` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.button.text` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `查看更多` |
| `data.blocks[].uiElement.mainTitle.canShowTitleLogo` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.blocks[].uiElement.mainTitle.title` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `data.blocks[].uiElement.rcmdShowType` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].uiElement.subTitle.canShowTitleLogo` | boolean | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].uiElement.subTitle.title` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `推荐歌单` |
| `data.blockUUIDs` | null | 5 | 5 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.cursor` | null | 5 | 5 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.demote` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.exposedResource` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `{"song":["17282443","431610014","1440570` |
| `data.guideToast.hasGuideToast` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.guideToast.toastList` | array<unknown> | 5 | 0 | 5 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.hasMore` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.internalTest` | null | 5 | 5 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.pageConfig.abtest[]` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `homepage-v7.3` |
| `data.pageConfig.fullscreen` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.pageConfig.homepageMode` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `RCMD_MODE` |
| `data.pageConfig.nodataToast` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `到底啦~` |
| `data.pageConfig.orderInfo` | union<null|string> | 5 | 1 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `PLAYLIST_MODE_0bc7f39b-06ce-4331-bd35-d9` |
| `data.pageConfig.refreshInterval` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `120000` |
| `data.pageConfig.refreshToast` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.pageConfig.showModeEntry` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.pageConfig.songLabelMarkLimit` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.pageConfig.songLabelMarkPriority[]` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `trial` |
| `data.pageConfig.title` | null | 5 | 5 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.titles` | array<unknown> | 5 | 0 | 5 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `message` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `trp.rules[]` | string | 3 | 0 | 0 | AUTH_ANON | `PAGE_DISCOVERY_DIGITAL_ALBUM_CARD::*::li` |
