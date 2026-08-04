# ncm.top_playlist / top_playlist

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`f392b386e39df3b4bdaf385b98a149e1385ebbdf640222a76d959e3321bd3b77`（pkg）
- 导出名：top_playlist
- 路由或调用方式：`/api/playlist/list`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：toplist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/top_playlist.js（注释：分类歌单）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/top/playlist
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| cat | string | 可选（默认 `全部`） | 源码读取 query.cat |
| order | string | 可选（默认 `hot`） | 源码读取 query.order |
| limit | string | 可选（默认 `50`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId
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
| ncm.top_playlist.anon.001 | AUTH_ANON | - | 200 | 343 |  |
| ncm.top_playlist.catall.hot.none.001 | AUTH_NONE | - | 200 | 144 |  |
| ncm.top_playlist.catbad.none.neg.001 | AUTH_NONE | - | 200 | 109 |  |
| ncm.top_playlist.catrock.none.001 | AUTH_NONE | - | 200 | 283 |  |
| ncm.top_playlist.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 173 |  |
| ncm.top_playlist.ordernew.none.001 | AUTH_NONE | - | 200 | 64 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `cat` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `全部` |
| `code` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `more` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `playlists[].adType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].alg` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `alg_sq_offline` |
| `playlists[].algType` | union<null|string> | 15 | 13 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].anonimous` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].backgroundImageId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].backgroundImageUrl` | union<null|string> | 15 | 14 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/lPnQICkowspN-7gW` |
| `playlists[].backgroundText` | union<null|string> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `摇滚发烧必听` |
| `playlists[].cloudTrackCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].commentCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `6` |
| `playlists[].commentThreadId` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `A_PL_0_17990594711` |
| `playlists[].coverImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951173274628960` |
| `playlists[].coverImgId_str` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951173274628960` |
| `playlists[].coverImgUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p4.music.126.net/Sr6oQAIyKdawA_zf` |
| `playlists[].coverStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `3` |
| `playlists[].coverText` | union<null|array<unknown>> | 13 | 12 | 1 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `playlists[].coverText[]` | string | 4 | 0 | 0 | AUTH_NONE | `摇滚` |
| `playlists[].createTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1779648967800` |
| `playlists[].creator.accountStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].creator.anchor` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.authenticationTypes` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `72` |
| `playlists[].creator.authority` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].creator.authStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `playlists[].creator.avatarDetail` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlists[].creator.avatarDetail.identityIconUrl` | string | 14 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `playlists[].creator.avatarDetail.identityLevel` | number | 14 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `playlists[].creator.avatarDetail.userType` | number | 14 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `4` |
| `playlists[].creator.avatarImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951173130943070` |
| `playlists[].creator.avatarImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951173130943072` |
| `playlists[].creator.avatarUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/MDErMLW4-M7nvCt8` |
| `playlists[].creator.backgroundImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `18902803904772116` |
| `playlists[].creator.backgroundImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `18902803904772116` |
| `playlists[].creator.backgroundUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/gy1zhVmVr8KRmFYO` |
| `playlists[].creator.birthday` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1022774400000` |
| `playlists[].creator.city` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `350800` |
| `playlists[].creator.defaultAvatar` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.description` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].creator.detailDescription` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].creator.djStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `10` |
| `playlists[].creator.experts` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].creator.expertTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].creator.expertTags[]` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `影视原声` |
| `playlists[].creator.followed` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.gender` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `playlists[].creator.mutual` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.nickname` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `洛米Gemini` |
| `playlists[].creator.province` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `350000` |
| `playlists[].creator.remarkName` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].creator.signature` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `祝我们好在春天` |
| `playlists[].creator.userId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `312608589` |
| `playlists[].creator.userType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `4` |
| `playlists[].creator.vipType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `11` |
| `playlists[].description` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `晚风拾清韵，轻音乐治愈人间。
褪去世间嘈杂，远离纷扰喧嚣。
清新舒缓的氛围感曲调` |
| `playlists[].highQuality` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].iconImgUrl` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `17990594711` |
| `playlists[].mix` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `纯音乐｜专注 放松 清新 氛围 纯音乐` |
| `playlists[].newImported` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].ordered` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists[].originalCoverId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].playCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `153718` |
| `playlists[].playlistType` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `UGC` |
| `playlists[].privacy` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].promptedMgcInfo` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].recommendInfo` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].recommendText` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].relateResId` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].relateResType` | union<null|string> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].shareCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `39` |
| `playlists[].socialPlaylistCover` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].specialType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].status` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribed` | union<boolean|null> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribedCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1583` |
| `playlists[].subscribers[].accountStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].anchor` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].authenticationTypes` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].authority` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].authStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].avatarDetail` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].avatarImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951169909982400` |
| `playlists[].subscribers[].avatarImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951169909982401` |
| `playlists[].subscribers[].avatarUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/kCa5XK4ZAxq2EPzt` |
| `playlists[].subscribers[].backgroundImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951162868126480` |
| `playlists[].subscribers[].backgroundImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951162868126486` |
| `playlists[].subscribers[].backgroundUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/_f8R60U9mZ42sSNv` |
| `playlists[].subscribers[].birthday` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-2209017600000` |
| `playlists[].subscribers[].city` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `360100` |
| `playlists[].subscribers[].defaultAvatar` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].description` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].detailDescription` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].djStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].experts` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].expertTags` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].followed` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].gender` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2` |
| `playlists[].subscribers[].mutual` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].nickname` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `桥本环奈美惠一` |
| `playlists[].subscribers[].province` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `360000` |
| `playlists[].subscribers[].remarkName` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].signature` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].userId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1893296497` |
| `playlists[].subscribers[].userType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].vipType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `11` |
| `playlists[].subTitle` | union<null|string> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `Peter Holmström分享无法割舍的5张经典摇滚专辑` |
| `playlists[].tags` | array<unknown> | 4 | 0 | 4 | AUTH_NONE | `undefined` |
| `playlists[].tags[]` | string | 33 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `轻音乐` |
| `playlists[].title` | union<null|string> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `摇滚发烧必听` |
| `playlists[].topTrackIds` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].totalDuration` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].trackCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `60` |
| `playlists[].trackNumberUpdateTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1783750664114` |
| `playlists[].tracks` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].trackUpdateTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1783750669663` |
| `playlists[].tsSongCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].uiPlaylistType` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `UGC` |
| `playlists[].updateTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1783750664114` |
| `playlists[].userId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `312608589` |
| `total` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `695` |
