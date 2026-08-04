# ncm.artist_songs / artist_songs

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`d8a99a25e18e7d11b66828920b2bf716ab2fce0a1d30f8ebd418f2d42ad8580e`（pkg）
- 导出名：artist_songs
- 路由或调用方式：`/api/v1/artist/songs`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_songs.js
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/songs
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| order | string | 可选（默认 `hot`） | 源码读取 query.order |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |
| limit | string | 可选（默认 `100`） | 源码读取 query.limit |

- crypto 模式：（未指定）
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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.artist_songs.anon.001 | AUTH_ANON | - | 200 | 217 |  |
| ncm.artist_songs.hot.none.001 | AUTH_NONE | - | 200 | 120 |  |
| ncm.artist_songs.id0.none.neg.001 | AUTH_NONE | err | -462 | - | code -462 |
| ncm.artist_songs.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 345 |  |
| ncm.artist_songs.page.none.001 | AUTH_NONE | - | 200 | 140 |  |
| ncm.artist_songs.time.none.001 | AUTH_NONE | - | 200 | 112 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `more` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `songs[].a` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].al.alia[]` | string | 7 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Heartbeat` |
| `songs[].al.id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `174925713` |
| `songs[].al.name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `T.I.M.E.` |
| `songs[].al.pic` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951168919708420` |
| `songs[].al.pic_str` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951168919708423` |
| `songs[].al.picUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `https://p4.music.126.net/aJWtwvdYRXvKUpA` |
| `songs[].al.tns[]` | string | 2 | 0 | 0 | AUTH_NONE | `争` |
| `songs[].alia` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Full Stop` |
| `songs[].ar[].id` | number | 22 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `7763` |
| `songs[].ar[].name` | string | 22 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `G.E.M.邓紫棋` |
| `songs[].artistClassics` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `songs[].cd` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `01` |
| `songs[].cf` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `songs[].cp` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2713508` |
| `songs[].crbt` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].djId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].dt` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `253735` |
| `songs[].fee` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].ftype` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].h.br` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `320000` |
| `songs[].h.fid` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].h.size` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `10152045` |
| `songs[].h.sr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `48000` |
| `songs[].h.vd` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-27088` |
| `songs[].hr` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].hr.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1620630` |
| `songs[].hr.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `songs[].hr.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `51401370` |
| `songs[].hr.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `48000` |
| `songs[].hr.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `-27451` |
| `songs[].id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2083785152` |
| `songs[].l.br` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `128000` |
| `songs[].l.fid` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].l.size` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `4060845` |
| `songs[].l.sr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `48000` |
| `songs[].l.vd` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-22900` |
| `songs[].m.br` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `192000` |
| `songs[].m.fid` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].m.size` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `6091245` |
| `songs[].m.sr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `48000` |
| `songs[].m.vd` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-24509` |
| `songs[].mark` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `17716748288` |
| `songs[].mst` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `9` |
| `songs[].mv` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `唯一` |
| `songs[].no` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2` |
| `songs[].noCopyrightRcmd` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].pop` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `100` |
| `songs[].privilege.bd` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.chargeInfoList[].chargeMessage` | null | 45 | 45 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.chargeInfoList[].chargeType` | number | 45 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].privilege.chargeInfoList[].chargeUrl` | null | 45 | 45 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.chargeInfoList[].rate` | number | 45 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `128000` |
| `songs[].privilege.code` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.cp` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].privilege.cs` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].privilege.dl` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.dlLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `songs[].privilege.dlLevels` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.downloadMaxbr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `songs[].privilege.downloadMaxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `songs[].privilege.fee` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].privilege.fl` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.flag` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1545476` |
| `songs[].privilege.flLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `songs[].privilege.freeTrialPrivilege.cannotListenReason` | union<number|null> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].privilege.freeTrialPrivilege.freeLimitTagType` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.freeTrialPrivilege.listenType` | union<number|null> | 15 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.freeTrialPrivilege.playReason` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.freeTrialPrivilege.resConsumable` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].privilege.freeTrialPrivilege.userConsumable` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].privilege.id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2083785152` |
| `songs[].privilege.ignoreCache` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.maxbr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `songs[].privilege.maxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `songs[].privilege.message` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.payed` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.pl` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.playMaxbr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `songs[].privilege.playMaxBrLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `songs[].privilege.plLevel` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `songs[].privilege.plLevels` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.preSell` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].privilege.rightSource` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.rscl` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].privilege.sp` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `7` |
| `songs[].privilege.st` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].privilege.subp` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].privilege.toast` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].pst` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].rt` | union<string|null> | 15 | 3 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `songs[].rtUrl` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].rtUrls` | array<unknown> | 15 | 0 | 15 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].rtype` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].rurl` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].songJumpInfo` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].sq.br` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `853817` |
| `songs[].sq.fid` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].sq.size` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `27080453` |
| `songs[].sq.sr` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `48000` |
| `songs[].sq.vd` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-28035` |
| `songs[].st` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].t` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].tns[]` | string | 4 | 0 | 0 | AUTH_NONE | `Long After` |
| `songs[].v` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `4` |
| `total` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `420` |
