# ncm.user_detail_new / user_detail_new

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`2d3bc4ff082cc0bbe76f2fa52f7b2edc625912f064ec4636a40f4ed8db86f58a`（pkg）
- 导出名：user_detail_new
- 路由或调用方式：`/api/w/v1/user/detail/${query.uid} (templated)`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：user / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：user
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/user_detail_new.js（注释：用户详情）
- 类型：interface.d.ts 有函数声明
- 文档：
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| uid | string | 未发现默认值 | 源码读取 query.uid |

- crypto 模式：eapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：userId
- produces：userId, uid
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 6）

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

- 分页形态（静态）：none
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

## 17. Phase 6 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 账号缺失（B-002）；写操作/私有域已预授权但账号未到位）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.user_detail_new.anon.001 | AUTH_ANON | - | 200 | 174 |  |
| ncm.user_detail_new.id0.none.neg.001 | AUTH_NONE | err | -462 | - | code -462 |
| ncm.user_detail_new.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.user_detail_new.none.001 | AUTH_NONE | err | -462 | - | code -462 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `adValid` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `bindings[].bindingTime` | number | 3 | 0 | 0 | AUTH_ANON | `1594291626882` |
| `bindings[].expired` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `bindings[].expiresIn` | number | 3 | 0 | 0 | AUTH_ANON | `2147483647` |
| `bindings[].id` | number | 3 | 0 | 0 | AUTH_ANON | `10660454763` |
| `bindings[].refreshTime` | number | 3 | 0 | 0 | AUTH_ANON | `1594291626` |
| `bindings[].tokenJsonStr` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `bindings[].type` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `bindings[].url` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `bindings[].userId` | number | 3 | 0 | 0 | AUTH_ANON | `281382` |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `createDays` | number | 1 | 0 | 0 | AUTH_ANON | `4866` |
| `createTime` | number | 1 | 0 | 0 | AUTH_ANON | `1365520082017` |
| `identify.actionUrl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `identify.imageDesc` | string | 1 | 0 | 0 | AUTH_ANON | `香港歌手` |
| `identify.imageUrl` | string | 1 | 0 | 0 | AUTH_ANON | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `level` | number | 1 | 0 | 0 | AUTH_ANON | `4` |
| `listenSongs` | number | 1 | 0 | 0 | AUTH_ANON | `158` |
| `mobileSign` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `newUser` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `pcSign` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `peopleCanSeeMyPlayRecord` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.accountStatus` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profile.allAuthTypes[].desc` | string | 1 | 0 | 0 | AUTH_ANON | `香港歌手` |
| `profile.allAuthTypes[].tags` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.allAuthTypes[].type` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.allSubscribedCount` | number | 1 | 0 | 0 | AUTH_ANON | `25898` |
| `profile.artistId` | number | 1 | 0 | 0 | AUTH_ANON | `7763` |
| `profile.artistIdentity[]` | number | 2 | 0 | 0 | AUTH_ANON | `3` |
| `profile.artistName` | string | 1 | 0 | 0 | AUTH_ANON | `G.E.M.邓紫棋` |
| `profile.authority` | number | 1 | 0 | 0 | AUTH_ANON | `3` |
| `profile.authStatus` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `profile.avatarDetail.identityIconUrl` | string | 1 | 0 | 0 | AUTH_ANON | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `profile.avatarDetail.identityLevel` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `profile.avatarDetail.userType` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.avatarImgId` | number | 1 | 0 | 0 | AUTH_ANON | `109951167771736530` |
| `profile.avatarImgId_str` | string | 1 | 0 | 0 | AUTH_ANON | `109951167771736533` |
| `profile.avatarImgIdStr` | string | 1 | 0 | 0 | AUTH_ANON | `109951167771736533` |
| `profile.avatarUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/oJorrgJ3IotZUAbZ` |
| `profile.backgroundImgId` | number | 1 | 0 | 0 | AUTH_ANON | `109951167773869000` |
| `profile.backgroundImgIdStr` | string | 1 | 0 | 0 | AUTH_ANON | `109951167773868994` |
| `profile.backgroundUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p1.music.126.net/nlH22cnwKf5SBO9W` |
| `profile.birthday` | number | 1 | 0 | 0 | AUTH_ANON | `-2209017600000` |
| `profile.blacklist` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.cCount` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.city` | number | 1 | 0 | 0 | AUTH_ANON | `810100` |
| `profile.createTime` | number | 1 | 0 | 0 | AUTH_ANON | `1365520082017` |
| `profile.defaultAvatar` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.description` | string | 1 | 0 | 0 | AUTH_ANON | `香港歌手` |
| `profile.detailDescription` | string | 1 | 0 | 0 | AUTH_ANON | `香港歌手` |
| `profile.djStatus` | number | 1 | 0 | 0 | AUTH_ANON | `10` |
| `profile.eventCount` | number | 1 | 0 | 0 | AUTH_ANON | `17` |
| `profile.expertTags` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.followed` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.followeds` | number | 1 | 0 | 0 | AUTH_ANON | `14344461` |
| `profile.followMe` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.follows` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profile.followTime` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.gender` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.inBlacklist` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.mainAuthType.desc` | string | 1 | 0 | 0 | AUTH_ANON | `香港歌手` |
| `profile.mainAuthType.tags` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.mainAuthType.type` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.mutual` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `profile.newFollows` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profile.nickname` | string | 1 | 0 | 0 | AUTH_ANON | `GEM鄧紫棋` |
| `profile.playlistBeSubscribedCount` | number | 1 | 0 | 0 | AUTH_ANON | `25898` |
| `profile.playlistCount` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.privacyItemUnlimit.age` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.privacyItemUnlimit.area` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.privacyItemUnlimit.college` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.privacyItemUnlimit.gender` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.privacyItemUnlimit.user_page_profile` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.privacyItemUnlimit.villageAge` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `profile.province` | number | 1 | 0 | 0 | AUTH_ANON | `810000` |
| `profile.remarkName` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profile.sCount` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profile.sDJPCount` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profile.signature` | string | 1 | 0 | 0 | AUTH_ANON | `Let's Get Everybody Moving!` |
| `profile.userId` | number | 1 | 0 | 0 | AUTH_ANON | `281382` |
| `profile.userType` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `profile.vipType` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `profileVillageInfo.imageUrl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `profileVillageInfo.targetUrl` | string | 1 | 0 | 0 | AUTH_ANON | `https://sg.music.163.com/g/cloud-card-3#` |
| `profileVillageInfo.title` | string | 1 | 0 | 0 | AUTH_ANON | `领取村民证` |
| `recallUser` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `userPoint.balance` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `userPoint.blockBalance` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `userPoint.status` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `userPoint.updateTime` | number | 1 | 0 | 0 | AUTH_ANON | `1785900341400` |
| `userPoint.userId` | number | 1 | 0 | 0 | AUTH_ANON | `281382` |
| `userPoint.version` | number | 1 | 0 | 0 | AUTH_ANON | `10` |
