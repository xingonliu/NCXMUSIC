# ncm.user_playlist / user_playlist

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`8f67866eb8ac7306f326511bda66e8b18583d74396ffba2d16ebf52f6166bbb3`（pkg）
- 导出名：user_playlist
- 路由或调用方式：`/api/user/playlist`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：user / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：user
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/user_playlist.js（注释：用户歌单）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/user/playlist
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| uid | string | 未发现默认值 | 源码读取 query.uid |
| limit | string | 可选（默认 `30`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：userId, pageToken
- produces：userId, uid
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

## 13. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.user_playlist.anon.001 | AUTH_ANON | - | 200 | 81 |  |
| ncm.user_playlist.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.user_playlist.none.001 | AUTH_NONE | - | 200 | 78 |  |
| ncm.user_playlist.none.002 | AUTH_NONE | - | 200 | 98 |  |
| ncm.user_playlist.page.none.001 | AUTH_NONE | - | 200 | 73 |  |
| ncm.user_playlist.uid0.none.neg.001 | AUTH_NONE | - | 200 | 77 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_NONE | `200` |
| `more` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `playlist[].adType` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].anonimous` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].artists` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].backgroundCoverId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].backgroundCoverUrl` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].cloudTrackCount` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].commentThreadId` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `A_PL_0_343577` |
| `playlist[].containsTracks` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].copied` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].coverImgId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951171295856130` |
| `playlist[].coverImgId_str` | union<string|null> | 8 | 3 | 0 | AUTH_ANON,AUTH_NONE | `109951171295856122` |
| `playlist[].coverImgUrl` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p1.music.126.net/1xWmQ-2kQ_-RpPJ2` |
| `playlist[].createTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1365520082040` |
| `playlist[].creator` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist[].creator.accountStatus` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].creator.anchor` | boolean | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].creator.authenticationTypes` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2` |
| `playlist[].creator.authority` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `3` |
| `playlist[].creator.authStatus` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `playlist[].creator.avatarDetail` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].creator.avatarImgId` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167771736530` |
| `playlist[].creator.avatarImgId_str` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167771736533` |
| `playlist[].creator.avatarImgIdStr` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167771736533` |
| `playlist[].creator.avatarUrl` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p1.music.126.net/oJorrgJ3IotZUAbZ` |
| `playlist[].creator.backgroundImgId` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167773869000` |
| `playlist[].creator.backgroundImgIdStr` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167773868994` |
| `playlist[].creator.backgroundUrl` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p1.music.126.net/nlH22cnwKf5SBO9W` |
| `playlist[].creator.birthday` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].creator.city` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `810100` |
| `playlist[].creator.defaultAvatar` | boolean | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].creator.description` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `香港歌手` |
| `playlist[].creator.detailDescription` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `香港歌手` |
| `playlist[].creator.djStatus` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `10` |
| `playlist[].creator.experts` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].creator.experts.1` | string | 3 | 0 | 0 | AUTH_NONE | `音乐视频达人` |
| `playlist[].creator.experts.2` | string | 3 | 0 | 0 | AUTH_NONE | `音乐图文达人` |
| `playlist[].creator.expertTags` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].creator.followed` | boolean | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].creator.gender` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2` |
| `playlist[].creator.mutual` | boolean | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].creator.nickname` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `GEM鄧紫棋` |
| `playlist[].creator.province` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `810000` |
| `playlist[].creator.remarkName` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].creator.signature` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Let's Get Everybody Moving!` |
| `playlist[].creator.userId` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `281382` |
| `playlist[].creator.userType` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2` |
| `playlist[].creator.vipType` | number | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].description` | union<null|string> | 8 | 5 | 0 | AUTH_ANON,AUTH_NONE | `邓紫棋（Gloria Tang Tsz-Kei），又名G.E.M.，原名邓诗颖，` |
| `playlist[].englishTitle` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].highQuality` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].id` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `343577` |
| `playlist[].mix` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].name` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `GEM鄧紫棋喜欢的音乐` |
| `playlist[].newImported` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].opRecommend` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].ordered` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].playCount` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2221216` |
| `playlist[].privacy` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].recommendInfo` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].sharedUsers` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].shareStatus` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].specialType` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `5` |
| `playlist[].status` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].subscribed` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].subscribedCount` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `22626` |
| `playlist[].subscribers` | array<unknown> | 8 | 0 | 8 | AUTH_ANON,AUTH_NONE | `undefined` |
| `playlist[].tags` | array<unknown> | 5 | 0 | 5 | AUTH_ANON,AUTH_NONE | `undefined` |
| `playlist[].tags[]` | string | 9 | 0 | 0 | AUTH_NONE | `华语` |
| `playlist[].titleImage` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].titleImageUrl` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].top` | boolean | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `playlist[].totalDuration` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `playlist[].trackCount` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `80` |
| `playlist[].trackNumberUpdateTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1751609658013` |
| `playlist[].tracks` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].trackUpdateTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1777553285447` |
| `playlist[].updateFrequency` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_NONE |  |
| `playlist[].updateTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1751609658013` |
| `playlist[].userId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_NONE | `281382` |
