# ncm.artist_video / artist_video

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`546939d306d17f55177920b4aa870c5b0696353f6a6e4358a42ca41c637608fb`（pkg）
- 导出名：artist_video
- 路由或调用方式：`/api/mlog/artist/video`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_video.js（注释：歌手相关视频）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/video
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| size | string | 可选（默认 `10`） | 源码读取 query.size |
| cursor | string | 可选（默认 `0`） | 源码读取 query.cursor |
| order | string | 可选（默认 `0`） | 源码读取 query.order |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：artistId, pageToken
- produces：artistId, mvId
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 8）

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

## 13. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.artist_video.anon.001 | AUTH_ANON | - | 200 | 115 |  |
| ncm.artist_video.id0.none.neg.001 | AUTH_NONE | - | 400 | 50 |  |
| ncm.artist_video.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 105 |  |
| ncm.artist_video.none.001 | AUTH_NONE | - | 200 | 110 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `data` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `data.page.cursor` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10` |
| `data.page.more` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.page.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10` |
| `data.records[].actionTime` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].alg` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].followedShowReason` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].id` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `34724956` |
| `data.records[].logInfo` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].matchField` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.records[].matchFieldContent` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].position` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].priorShowLive` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].reason` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].reasonType` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.audioDTO` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.coverColor` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-1118482` |
| `data.records[].resource.mlogBaseData.coverDetail` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.coverDynamicUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.coverHeight` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `240` |
| `data.records[].resource.mlogBaseData.coverPicKey` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951172654633627` |
| `data.records[].resource.mlogBaseData.coverUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/2SLY7ajwbrpJjzpN` |
| `data.records[].resource.mlogBaseData.coverWidth` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `426` |
| `data.records[].resource.mlogBaseData.desc` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.records[].resource.mlogBaseData.duration` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `14000` |
| `data.records[].resource.mlogBaseData.graphic` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.greatCover` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogBaseData.id` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `34724956` |
| `data.records[].resource.mlogBaseData.interveneText` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.mixInfo` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.originalTitle` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.pubTime` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1771171201447` |
| `data.records[].resource.mlogBaseData.relatedPubUsers` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.talk` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.text` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋为大家送来了2026马年祝福` |
| `data.records[].resource.mlogBaseData.threadId` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_MV_5_34724956` |
| `data.records[].resource.mlogBaseData.type` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3` |
| `data.records[].resource.mlogBaseData.userId` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.video` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogBaseData.videos[].check` | boolean | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogBaseData.videos[].container` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `m3u8` |
| `data.records[].resource.mlogBaseData.videos[].duration` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `14000` |
| `data.records[].resource.mlogBaseData.videos[].height` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `240` |
| `data.records[].resource.mlogBaseData.videos[].md5` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.records[].resource.mlogBaseData.videos[].size` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `938884` |
| `data.records[].resource.mlogBaseData.videos[].tag` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `TS_240P` |
| `data.records[].resource.mlogBaseData.videos[].tagSign.br` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `240` |
| `data.records[].resource.mlogBaseData.videos[].tagSign.tagSign` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `TS_240P` |
| `data.records[].resource.mlogBaseData.videos[].tagSign.type` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `TS` |
| `data.records[].resource.mlogBaseData.videos[].url` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `cloudmusic/obj/core/78053871187/271463f6` |
| `data.records[].resource.mlogBaseData.videos[].width` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `426` |
| `data.records[].resource.mlogExtVO.algSong` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.artistName` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `data.records[].resource.mlogExtVO.artists[].followed` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogExtVO.artists[].id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `data.records[].resource.mlogExtVO.artists[].img1v1Url` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/fq1O8ZRT5_FHzg_u` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.avatarDetail.identityIconUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.avatarDetail.identityLevel` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.avatarDetail.userType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.avatarUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/oJorrgJ3IotZUAbZ` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.followed` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.nickname` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `GEM鄧紫棋` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.userId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `281382` |
| `data.records[].resource.mlogExtVO.artists[].mlogUser.userType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `data.records[].resource.mlogExtVO.artists[].name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `data.records[].resource.mlogExtVO.canCollect` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogExtVO.channelTag` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.collectReason` | union<null|string> | 9 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `该视频没有配乐，不可添加到视频歌单` |
| `data.records[].resource.mlogExtVO.commentCount` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1707` |
| `data.records[].resource.mlogExtVO.liked` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].resource.mlogExtVO.likedCount` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `13764` |
| `data.records[].resource.mlogExtVO.playCount` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `125627` |
| `data.records[].resource.mlogExtVO.shareCount` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1147` |
| `data.records[].resource.mlogExtVO.song` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.song.albumName` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Sacrifice` |
| `data.records[].resource.mlogExtVO.song.artists[].artistId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1047337` |
| `data.records[].resource.mlogExtVO.song.artists[].artistName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `英雄联盟` |
| `data.records[].resource.mlogExtVO.song.coverUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/zthIUEzkMAb4xKe-` |
| `data.records[].resource.mlogExtVO.song.duration` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `249306` |
| `data.records[].resource.mlogExtVO.song.endTime` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.song.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2754115754` |
| `data.records[].resource.mlogExtVO.song.isLiked` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.song.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Sacrifice` |
| `data.records[].resource.mlogExtVO.song.playedNum` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.song.privilege` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.song.startTime` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.specialTag` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogExtVO.videoStartPlayTime` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.mlogPlaylists` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.relatedPubUsers` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.shareUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://music.163.com/mv/34724956/#hash=` |
| `data.records[].resource.source` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].resource.status` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.records[].resource.userProfile` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].sameCity` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.records[].srcId` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.records[].type` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `ok` |
