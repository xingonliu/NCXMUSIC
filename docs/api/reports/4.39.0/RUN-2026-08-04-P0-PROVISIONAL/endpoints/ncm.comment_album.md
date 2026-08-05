# ncm.comment_album / comment_album

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`08d651f8b4751461378cfa9755fbe9b142213e2d2dd329de15d661e4e43ddae5`（pkg）
- 导出名：comment_album
- 路由或调用方式：`/api/v1/resource/comments/R_AL_3_${query.id} (templated)`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：comment / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/comment_album.js（注释：专辑评论）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/comment/album
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| limit | string | 可选（默认 `20`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |
| before | string | 可选（默认 `0`） | 源码读取 query.before |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：targetResourceId, pageToken
- produces：commentId, threadId
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
| ncm.comment_album.anon.001 | AUTH_ANON | - | 200 | 104 |  |
| ncm.comment_album.id0.none.neg.001 | AUTH_NONE | - | 200 | 70 |  |
| ncm.comment_album.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.comment_album.none.001 | AUTH_NONE | - | 200 | 436 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `cnum` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `200` |
| `commentBanner` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `comments[].aiCommentLabel` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].beReplied` | array<unknown> | 6 | 0 | 6 | AUTH_ANON,AUTH_NONE | `undefined` |
| `comments[].commentId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `9563156604` |
| `comments[].commentLocationType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].content` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `处听时还在高中` |
| `comments[].contentResource` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].contentStickerExt` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].expressionUrl` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].favorited` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].grade` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].ipLocation.ip` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].ipLocation.location` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `广东` |
| `comments[].ipLocation.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1539358978` |
| `comments[].liked` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].likedCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].medal` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].needDisplayTime` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `comments[].owner` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].parentCommentId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].pendantData` | null | 2 | 2 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].pendantData.id` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `7018571` |
| `comments[].pendantData.imageUrl` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p1.music.126.net/acUvvq1SQhoNbn2L` |
| `comments[].repliedMark` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].richContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `处听时还在高中` |
| `comments[].showFloorComment` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].status` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].time` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1782203051635` |
| `comments[].timeStr` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `06-23` |
| `comments[].user.anonym` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].user.authStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `comments[].user.avatarDetail` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.avatarDetail.identityIconUrl` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `comments[].user.avatarDetail.identityLevel` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `comments[].user.avatarDetail.userType` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `4` |
| `comments[].user.avatarUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p3.music.126.net/bZh5lMc1QEM57GUm` |
| `comments[].user.commonIdentity` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.experts` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.expertTags` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.followed` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].user.highlight` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].user.liveInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.locationInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.mutual` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `comments[].user.nickname` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Bace__` |
| `comments[].user.remarkName` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.socialUserId` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.target` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.thanked` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1539358978` |
| `comments[].user.userType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `4` |
| `comments[].user.vipRights.associator.iconUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `comments[].user.vipRights.associator.rights` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `comments[].user.vipRights.associator.vipCode` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `100` |
| `comments[].user.vipRights.extInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.vipRights.memberLogo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.vipRights.musicPackage.iconUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `comments[].user.vipRights.musicPackage.rights` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `comments[].user.vipRights.musicPackage.vipCode` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `220` |
| `comments[].user.vipRights.redplus` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `comments[].user.vipRights.redVipAnnualCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `comments[].user.vipRights.redVipLevel` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `4` |
| `comments[].user.vipRights.relationType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `comments[].user.vipType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `11` |
| `comments[].userBizLevels` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `hotComments[].aiCommentLabel` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].beReplied` | array<unknown> | 6 | 0 | 6 | AUTH_ANON,AUTH_NONE | `undefined` |
| `hotComments[].commentId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `276121683` |
| `hotComments[].commentLocationType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].content` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `一次访谈，主持人问邓紫棋:“西方有泰勒，蕾哈娜等歌手，并且西方市场趋于饱和，至今` |
| `hotComments[].contentResource` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].contentStickerExt` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].decoration` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].expressionUrl` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].favorited` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].grade` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].ipLocation.ip` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].ipLocation.location` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotComments[].ipLocation.userId` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].liked` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].likedCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1608` |
| `hotComments[].medal` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].needDisplayTime` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `hotComments[].owner` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].parentCommentId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].pendantData` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].repliedMark` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].richContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `一次访谈，主持人问邓紫棋:“西方有泰勒，蕾哈娜等歌手，并且西方市场趋于饱和，至今` |
| `hotComments[].showFloorComment` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].status` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].time` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1483070806865` |
| `hotComments[].timeStr` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2016-12-30` |
| `hotComments[].user.anonym` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].user.authStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].user.avatarDetail` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.avatarDetail.identityIconUrl` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `hotComments[].user.avatarDetail.identityLevel` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `3` |
| `hotComments[].user.avatarDetail.userType` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `207` |
| `hotComments[].user.avatarUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p4.music.126.net/ra2xMcmVyzJ9KDPa` |
| `hotComments[].user.commonIdentity` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.experts` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.experts.1` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `音乐视频达人` |
| `hotComments[].user.experts.2` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `音乐图文达人` |
| `hotComments[].user.expertTags` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.followed` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].user.highlight` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].user.liveInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.locationInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.mutual` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotComments[].user.nickname` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Gloria楽` |
| `hotComments[].user.remarkName` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.socialUserId` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.target` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.thanked` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `76978040` |
| `hotComments[].user.userType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `207` |
| `hotComments[].user.vipRights.associator` | null | 2 | 2 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.vipRights.associator.iconUrl` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `hotComments[].user.vipRights.associator.rights` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `hotComments[].user.vipRights.associator.vipCode` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `100` |
| `hotComments[].user.vipRights.extInfo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.vipRights.memberLogo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.vipRights.musicPackage` | null | 2 | 2 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.vipRights.musicPackage.iconUrl` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `hotComments[].user.vipRights.musicPackage.rights` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `hotComments[].user.vipRights.musicPackage.vipCode` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `220` |
| `hotComments[].user.vipRights.redplus` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotComments[].user.vipRights.redVipAnnualCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `-1` |
| `hotComments[].user.vipRights.redVipLevel` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `6` |
| `hotComments[].user.vipRights.relationType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotComments[].user.vipType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `11` |
| `hotComments[].userBizLevels` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `isMusician` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `more` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `moreHot` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `topComments` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_NONE | `undefined` |
| `total` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `811` |
| `userId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `17788444306` |
