# ncm.artist_fans / artist_fans

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`3c84831e872878579c0519e9ce32a755f03630aa0cc180428f69bcb921c9e27f`（pkg）
- 导出名：artist_fans
- 路由或调用方式：`/api/artist/fans/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_fans.js（注释：歌手粉丝）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/fans
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| limit | string | 可选（默认 `20`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

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
| ncm.artist_fans.anon.001 | AUTH_ANON | - | 200 | 156 |  |
| ncm.artist_fans.id0.none.neg.001 | AUTH_NONE | err | 404 | - | code 404 |
| ncm.artist_fans.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.artist_fans.none.001 | AUTH_NONE | - | 200 | 112 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `200` |
| `data[].userProfile.accountStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.accountType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `data[].userProfile.anchor` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `data[].userProfile.authenticated` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `data[].userProfile.authenticationTypes` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.authority` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.authStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.avatarDetail` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.avatarImgId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951170534168590` |
| `data[].userProfile.avatarUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p3.music.126.net/Tbyx-5xLvCK3tJWO` |
| `data[].userProfile.backgroundImgId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951162868128400` |
| `data[].userProfile.backgroundUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `http://p1.music.126.net/2zSNIqTcpHL2jIvU` |
| `data[].userProfile.birthday` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `-2209017600000` |
| `data[].userProfile.city` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `140700` |
| `data[].userProfile.createTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1677489961253` |
| `data[].userProfile.defaultAvatar` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `data[].userProfile.description` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.detailDescription` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.djStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.experts` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.expertTags` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.followed` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `data[].userProfile.gender` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `data[].userProfile.lastLoginIP` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2409:8a0c:ae37:eb00:515f:4696:e388:f147` |
| `data[].userProfile.lastLoginTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1785887408523` |
| `data[].userProfile.locationStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `10` |
| `data[].userProfile.mutual` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `data[].userProfile.nickname` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `pokii珀琦的歌喉` |
| `data[].userProfile.province` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `140000` |
| `data[].userProfile.remarkName` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].userProfile.shortUserName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `data[].userProfile.signature` | union<string|null> | 6 | 2 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `data[].userProfile.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `3982046776` |
| `data[].userProfile.userName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `pokii珀琦的歌喉` |
| `data[].userProfile.userType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `data[].userProfile.vipType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `11` |
| `data[].userProfile.viptypeVersion` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1785193576320` |
| `data[].vipRights.associator.iconUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `data[].vipRights.associator.rights` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `data[].vipRights.associator.vipCode` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `100` |
| `data[].vipRights.musicPackage.iconUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `data[].vipRights.musicPackage.rights` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `data[].vipRights.musicPackage.vipCode` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `220` |
| `data[].vipRights.redplus` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE |  |
| `data[].vipRights.redplus.iconUrl` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `data[].vipRights.redplus.rights` | boolean | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
| `data[].vipRights.redplus.vipCode` | number | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `300` |
| `data[].vipRights.redVipAnnualCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `-1` |
| `data[].vipRights.redVipLevel` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `3` |
| `message` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `success` |
