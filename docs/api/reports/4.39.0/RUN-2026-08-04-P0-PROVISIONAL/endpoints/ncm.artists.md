# ncm.artists / artists

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`b7adc45277b86324c4a742fc95dc1a4f809d2259c10b8582307c74d0a28802ad`（pkg）
- 导出名：artists
- 路由或调用方式：`/api/v1/artist/${query.id} (templated)`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artists.js（注释：歌手单曲）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artists
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：artistId, mvId
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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.artists.anon.001 | AUTH_ANON | - | 200 | 165 |  |
| ncm.artists.id0.none.neg.001 | AUTH_NONE | err | 404 | - | code 404 |
| ncm.artists.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 622 |  |
| ncm.artists.none.001 | AUTH_NONE | - | 200 | 126 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `artist.accountId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `281382` |
| `artist.albumSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `61` |
| `artist.alias[]` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `artist.briefDesc` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `邓紫棋（G.E.M.），本名邓诗颖，1991年8月16日出生于上海市，中国香港流` |
| `artist.followed` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `artist.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `artist.img1v1Id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167771736530` |
| `artist.img1v1Id_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167771736533` |
| `artist.img1v1Url` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/oJorrgJ3IotZUAb` |
| `artist.musicSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `420` |
| `artist.mvSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `116` |
| `artist.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `artist.picId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167773880640` |
| `artist.picId_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167773880633` |
| `artist.picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/fq1O8ZRT5_FHzg_` |
| `artist.publishTime` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1543476333382` |
| `artist.topicPerson` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `artist.trans` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `hotSongs[].a` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].al.alia[]` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Heartbeat` |
| `hotSongs[].al.id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `174925713` |
| `hotSongs[].al.name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `T.I.M.E.` |
| `hotSongs[].al.pic` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951168919708420` |
| `hotSongs[].al.pic_str` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951168919708423` |
| `hotSongs[].al.picUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/aJWtwvdYRXvKUpA` |
| `hotSongs[].alia` | array<unknown> | 6 | 0 | 6 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `hotSongs[].alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Full Stop` |
| `hotSongs[].ar[].alia[]` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `hotSongs[].ar[].id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `hotSongs[].ar[].name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `hotSongs[].artistClassics` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].cd` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `01` |
| `hotSongs[].cf` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `hotSongs[].cp` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2713508` |
| `hotSongs[].crbt` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].djId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].dt` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `253735` |
| `hotSongs[].fee` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].ftype` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].h.br` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `hotSongs[].h.fid` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].h.size` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10152045` |
| `hotSongs[].h.sr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `hotSongs[].h.vd` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-27088` |
| `hotSongs[].hr` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].hr.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1620630` |
| `hotSongs[].hr.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].hr.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `51401370` |
| `hotSongs[].hr.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `hotSongs[].hr.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-27451` |
| `hotSongs[].id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2083785152` |
| `hotSongs[].l.br` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `hotSongs[].l.fid` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].l.size` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4060845` |
| `hotSongs[].l.sr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `hotSongs[].l.vd` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-22900` |
| `hotSongs[].m.br` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `192000` |
| `hotSongs[].m.fid` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].m.size` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `6091245` |
| `hotSongs[].m.sr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `hotSongs[].m.vd` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-24509` |
| `hotSongs[].mark` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17716748288` |
| `hotSongs[].mst` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9` |
| `hotSongs[].mv` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `唯一` |
| `hotSongs[].no` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `hotSongs[].noCopyrightRcmd` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].pop` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `hotSongs[].privilege.bd` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.chargeInfoList[].chargeMessage` | null | 27 | 27 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.chargeInfoList[].chargeType` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].privilege.chargeInfoList[].chargeUrl` | null | 27 | 27 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.chargeInfoList[].rate` | number | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `hotSongs[].privilege.code` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.cp` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].privilege.cs` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `hotSongs[].privilege.dl` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.dlLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `hotSongs[].privilege.dlLevels` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.downloadMaxbr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `hotSongs[].privilege.downloadMaxBrLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `hotSongs[].privilege.fee` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].privilege.fl` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.flag` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1545476` |
| `hotSongs[].privilege.flLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `hotSongs[].privilege.freeTrialPrivilege.cannotListenReason` | union<number|null> | 9 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].privilege.freeTrialPrivilege.freeLimitTagType` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.freeTrialPrivilege.listenType` | union<number|null> | 9 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.freeTrialPrivilege.playReason` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.freeTrialPrivilege.resConsumable` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `hotSongs[].privilege.freeTrialPrivilege.userConsumable` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `hotSongs[].privilege.id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2083785152` |
| `hotSongs[].privilege.ignoreCache` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.maxbr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `hotSongs[].privilege.maxBrLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `hotSongs[].privilege.message` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.payed` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.pl` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.playMaxbr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `hotSongs[].privilege.playMaxBrLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `hotSongs[].privilege.plLevel` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `hotSongs[].privilege.plLevels` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.preSell` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `hotSongs[].privilege.rightSource` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.rscl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].privilege.sp` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7` |
| `hotSongs[].privilege.st` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].privilege.subp` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].privilege.toast` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `hotSongs[].pst` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].rt` | union<string|null> | 9 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `hotSongs[].rtUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].rtUrls` | array<unknown> | 9 | 0 | 9 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `hotSongs[].rtype` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].rurl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].songJumpInfo` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `hotSongs[].sq.br` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `853817` |
| `hotSongs[].sq.fid` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].sq.size` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `27080453` |
| `hotSongs[].sq.sr` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `hotSongs[].sq.vd` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-28035` |
| `hotSongs[].st` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `hotSongs[].t` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `hotSongs[].v` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `more` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
