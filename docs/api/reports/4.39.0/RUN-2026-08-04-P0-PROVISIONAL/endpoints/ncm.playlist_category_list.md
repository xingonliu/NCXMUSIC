# ncm.playlist_category_list / playlist_category_list

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`94bb5f409186b38b112515817c0951cf393d703254754e33963b2a1d462d9a58`（pkg）
- 导出名：playlist_category_list
- 路由或调用方式：`/api/playlist/category/list`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：playlist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/playlist_category_list.js（注释：歌单分类列表）
- 类型：interface.d.ts 有函数声明
- 文档：
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| cat | string | 可选（默认 `全部`） | 源码读取 query.cat |
| limit | string | 可选（默认 `24`） | 源码读取 query.limit |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：playlistId, trackId
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
| ncm.playlist_category_list.anon.001 | AUTH_ANON | - | 200 | 199 |  |
| ncm.playlist_category_list.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 154 |  |
| ncm.playlist_category_list.none.001 | AUTH_NONE | - | 200 | 155 |  |
| ncm.playlist_category_list.none.002 | AUTH_NONE | - | 200 | 148 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `algMap.alg_sq_offline[]` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17990594711` |
| `banners` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `highQuality.copywriter` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `highQuality.name` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `可爱摇滚｜一剂抵挡春困的上好良药` |
| `highQuality.picUrl` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/SA6bW1UlPP04rFB2` |
| `playlistIds[]` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2936255937` |
| `playlists[].adType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].algType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].anonimous` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].backgroundImageId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].backgroundImageUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].backgroundText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].cloudTrackCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].commentCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `355` |
| `playlists[].commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `A_PL_0_2936255937` |
| `playlists[].coverImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951165850294740` |
| `playlists[].coverImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951165850294731` |
| `playlists[].coverImgUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/3DUsQdgYRUwlxzVr` |
| `playlists[].coverStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3` |
| `playlists[].coverText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1565759532471` |
| `playlists[].creator.accountStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].creator.anchor` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].creator.authenticationTypes` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `524352` |
| `playlists[].creator.authority` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].creator.authStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].creator.avatarDetail.identityIconUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `playlists[].creator.avatarDetail.identityLevel` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `playlists[].creator.avatarDetail.userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `playlists[].creator.avatarImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166193927840` |
| `playlists[].creator.avatarImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166193927838` |
| `playlists[].creator.avatarImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166193927838` |
| `playlists[].creator.avatarUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/DZA258XIddEA1gwu` |
| `playlists[].creator.backgroundImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166632246400` |
| `playlists[].creator.backgroundImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166632246392` |
| `playlists[].creator.backgroundUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/fNTJn_e7M3cei-ZT` |
| `playlists[].creator.birthday` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `847296000000` |
| `playlists[].creator.city` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110101` |
| `playlists[].creator.defaultAvatar` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].creator.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `playlists[].creator.detailDescription` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `playlists[].creator.djStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].creator.experts` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].creator.experts.1` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `二次元视频达人` |
| `playlists[].creator.experts.2` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `动漫图文达人` |
| `playlists[].creator.expertTags[]` | string | 28 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `playlists[].creator.followed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].creator.gender` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `playlists[].creator.mutual` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].creator.nickname` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `蜜糖男孩` |
| `playlists[].creator.province` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110000` |
| `playlists[].creator.remarkName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].creator.signature` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `优质的厂牌or音乐人可联系：yichd40793                ` |
| `playlists[].creator.userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1650191296` |
| `playlists[].creator.userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `playlists[].creator.vipType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `11` |
| `playlists[].description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `节奏布鲁斯（英语：Rhythm and Blues，简称：R&B或RnB，或作节` |
| `playlists[].highQuality` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `playlists[].iconImgUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2936255937` |
| `playlists[].mix` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `倾吐隐秘情绪｜百位R&B歌手精选` |
| `playlists[].newImported` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].ordered` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `playlists[].originalCoverId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].playCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10224514` |
| `playlists[].playlistType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `UGC` |
| `playlists[].privacy` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].promptedMgcInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].recommendInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].recommendText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].relateResId` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].relateResType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].shareCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1992` |
| `playlists[].socialPlaylistCover` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].specialType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribed` | union<boolean|null> | 12 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].subscribedCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `80755` |
| `playlists[].subscribers[].accountStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].anchor` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].subscribers[].authenticationTypes` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].authority` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].authStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].avatarDetail` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].subscribers[].avatarImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18638921116101470` |
| `playlists[].subscribers[].avatarImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18638921116101472` |
| `playlists[].subscribers[].avatarImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18638921116101472` |
| `playlists[].subscribers[].avatarUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/P-yIscanhubMQNVO` |
| `playlists[].subscribers[].backgroundImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951162868126480` |
| `playlists[].subscribers[].backgroundImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951162868126486` |
| `playlists[].subscribers[].backgroundUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/_f8R60U9mZ42sSNv` |
| `playlists[].subscribers[].birthday` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-2209017600000` |
| `playlists[].subscribers[].city` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `441300` |
| `playlists[].subscribers[].defaultAvatar` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].subscribers[].description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `playlists[].subscribers[].detailDescription` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `playlists[].subscribers[].djStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].experts` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].subscribers[].expertTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].subscribers[].followed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].subscribers[].gender` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `playlists[].subscribers[].mutual` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `playlists[].subscribers[].nickname` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `不语一吟` |
| `playlists[].subscribers[].province` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `440000` |
| `playlists[].subscribers[].remarkName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].subscribers[].signature` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `playlists[].subscribers[].userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `560673940` |
| `playlists[].subscribers[].userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].subscribers[].vipType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `11` |
| `playlists[].subTitle` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].tags[]` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `欧美` |
| `playlists[].title` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].topTrackIds` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].totalDuration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].trackCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `289` |
| `playlists[].trackNumberUpdateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1702927148893` |
| `playlists[].tracks` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `playlists[].trackUpdateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1784912144484` |
| `playlists[].tsSongCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `playlists[].uiPlaylistType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `UGC` |
| `playlists[].updateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1702927148893` |
| `playlists[].userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1650191296` |
