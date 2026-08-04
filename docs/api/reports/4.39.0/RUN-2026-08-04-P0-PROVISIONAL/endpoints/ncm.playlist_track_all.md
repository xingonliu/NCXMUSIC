# ncm.playlist_track_all / playlist_track_all

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`787aecddc2d29e7a0523974ad78e470b6e647b7d0687697d6cdba0565aca2dfe`（pkg）
- 导出名：playlist_track_all
- 路由或调用方式：`/api/v6/playlist/detail`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：playlist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/playlist_track_all.js（注释：通过传过来的歌单id拿到所有歌曲数据）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/playlist/track/all
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| s | string | 可选（默认 `8`） | 源码读取 query.s |
| limit | string | 未发现默认值 | 源码读取 query.limit |
| offset | string | 未发现默认值 | 源码读取 query.offset |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：playlistId, pageToken
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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.playlist_track_all.anon.001 | AUTH_ANON | - | 200 | 801 |  |
| ncm.playlist_track_all.first.none.001 | AUTH_NONE | - | 200 | 484 |  |
| ncm.playlist_track_all.id0.none.neg.001 | AUTH_NONE | err | -462 | - | code -462 |
| ncm.playlist_track_all.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 546 |  |
| ncm.playlist_track_all.limit0.none.bnd.001 | AUTH_NONE | - | 200 | 657 |  |
| ncm.playlist_track_all.mid.none.001 | AUTH_NONE | - | 200 | 476 |  |
| ncm.playlist_track_all.toplist.none.001 | AUTH_NONE | - | 200 | 392 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `privileges[].bd` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].chargeInfoList[].chargeMessage` | null | 54 | 54 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].chargeInfoList[].chargeType` | number | 54 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].chargeInfoList[].chargeUrl` | null | 54 | 54 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].chargeInfoList[].rate` | number | 54 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `128000` |
| `privileges[].code` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].cp` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].cs` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].dl` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].dlLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].dlLevels` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].downloadMaxbr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].downloadMaxBrLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].fee` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].fl` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].flag` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1541380` |
| `privileges[].flLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].freeTrialPrivilege.cannotListenReason` | union<number|null> | 18 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].freeTrialPrivilege.freeLimitTagType` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.listenType` | union<number|null> | 18 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].freeTrialPrivilege.playReason` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.resConsumable` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].freeTrialPrivilege.userConsumable` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].id` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1405283464` |
| `privileges[].ignoreCache` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].maxbr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].maxBrLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].message` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].payed` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].pl` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].playMaxbr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].playMaxBrLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].plLevel` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].plLevels` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].preSell` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].rightSource` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].rscl` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `privileges[].sp` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `7` |
| `privileges[].st` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].subp` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].toast` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].a` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].additionalTitle` | union<null|string> | 18 | 17 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `(绅士们) (Live)` |
| `songs[].al.id` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `84391762` |
| `songs[].al.name` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `摩天动物园` |
| `songs[].al.pic` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951164581432420` |
| `songs[].al.pic_str` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951164581432409` |
| `songs[].al.picUrl` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `https://p3.music.126.net/KTo5oSxH3CPA5PB` |
| `songs[].al.tns` | array<unknown> | 18 | 0 | 18 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].alia` | array<unknown> | 9 | 0 | 9 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].alia[]` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `Full Stop` |
| `songs[].ar[].alias` | array<unknown> | 21 | 0 | 21 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].ar[].id` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `7763` |
| `songs[].ar[].name` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `G.E.M.邓紫棋` |
| `songs[].ar[].tns` | array<unknown> | 21 | 0 | 21 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].artistClassics` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `songs[].awardTags` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].cd` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `01` |
| `songs[].cf` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `songs[].copyright` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].cp` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1416601` |
| `songs[].crbt` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].displayTags` | union<null|array<unknown>> | 18 | 15 | 3 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].djId` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].dt` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `235632` |
| `songs[].entertainmentTags` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].fee` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].ftype` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].h.br` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `320000` |
| `songs[].h.fid` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].h.size` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `9428242` |
| `songs[].h.sr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `44100` |
| `songs[].h.vd` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-53830` |
| `songs[].hr` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].hr.br` | number | 3 | 0 | 0 | AUTH_NONE | `1786317` |
| `songs[].hr.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].hr.size` | number | 3 | 0 | 0 | AUTH_NONE | `46432687` |
| `songs[].hr.sr` | number | 3 | 0 | 0 | AUTH_NONE | `48000` |
| `songs[].hr.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-47390` |
| `songs[].id` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1405283464` |
| `songs[].l.br` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `128000` |
| `songs[].l.fid` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].l.size` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `3771373` |
| `songs[].l.sr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `44100` |
| `songs[].l.vd` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-49554` |
| `songs[].m.br` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `192000` |
| `songs[].m.fid` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].m.size` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `5656996` |
| `songs[].m.sr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `44100` |
| `songs[].m.vd` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-51239` |
| `songs[].mainTitle` | union<null|string> | 18 | 17 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `The Gentlemen` |
| `songs[].mark` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `17179942912` |
| `songs[].markTags` | array<unknown> | 18 | 0 | 18 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].mst` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `9` |
| `songs[].mv` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `10906470` |
| `songs[].name` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `句号` |
| `songs[].no` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `12` |
| `songs[].noCopyrightRcmd` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].originCoverType` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `songs[].originSongSimpleData` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].pop` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `100` |
| `songs[].pst` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].publishTime` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1576252800000` |
| `songs[].resourceState` | boolean | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `songs[].rt` | union<string|null> | 18 | 11 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `songs[].rtUrl` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].rtUrls` | array<unknown> | 18 | 0 | 18 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].rtype` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].rurl` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].s_id` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].single` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].songFeature` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].songJumpInfo` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].sq.br` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `908590` |
| `songs[].sq.fid` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].sq.size` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `26761664` |
| `songs[].sq.sr` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `44100` |
| `songs[].sq.vd` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `-53834` |
| `songs[].st` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].t` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `songs[].tagPicList` | null | 18 | 18 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `songs[].tns[]` | string | 1 | 0 | 0 | AUTH_NONE | `只因为你那渴望自由的心脏` |
| `songs[].v` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `62` |
| `songs[].version` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `28` |
