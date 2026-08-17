# ncm.song_detail / song_detail

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`a85e79d888667b645301597a8c755fc468d62be0506fa94ca98e551bf4ee58a9`（pkg）
- 导出名：song_detail
- 路由或调用方式：`/api/v3/song/detail`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：song / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/song_detail.js（注释：歌曲详情）
- 类型：interface.d.ts 无对应函数声明（types-missing）
- 文档：docs:/song/detail
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| ids | string | 未发现默认值 | 源码读取 query.ids |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：songId
- produces：songId
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

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.song_detail.empty.none.neg.001 | AUTH_NONE | err | 502 | - | code 502 |
| ncm.song_detail.multi.none.001 | AUTH_NONE | - | 200 | 105 |  |
| ncm.song_detail.nonexist.none.neg.001 | AUTH_NONE | - | 200 | 78 |  |
| ncm.song_detail.single.anon.001 | AUTH_ANON | - | 200 | 82 |  |
| ncm.song_detail.single.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 80 |  |
| ncm.song_detail.single.none.001 | AUTH_NONE | - | 200 | 79 |  |

## 16. Phase 4 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.song_detail.media-fixture.songA.001 | AUTH_NONE | - | 200 | 76 |  |
| ncm.song_detail.media-fixture.songB.001 | AUTH_NONE | - | 200 | 105 |  |
| ncm.song_detail.media-fixture.songC.001 | AUTH_NONE | - | 200 | 88 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 8 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `200` |
| `privileges[].bd` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].chargeInfoList` | null | 7 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].chargeInfoList[].chargeMessage` | null | 9 | 9 | 0 | AUTH_NONE |  |
| `privileges[].chargeInfoList[].chargeType` | number | 9 | 0 | 0 | AUTH_NONE | `1` |
| `privileges[].chargeInfoList[].chargeUrl` | null | 9 | 9 | 0 | AUTH_NONE |  |
| `privileges[].chargeInfoList[].rate` | number | 9 | 0 | 0 | AUTH_NONE | `128000` |
| `privileges[].code` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].cp` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].cs` | boolean | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].dl` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].dlLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].dlLevels` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].downloadMaxbr` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].downloadMaxBrLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].fee` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].fl` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].flag` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `1541124` |
| `privileges[].flLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].freeTrialPrivilege.cannotListenReason` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.freeLimitTagType` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.listenType` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.playReason` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].freeTrialPrivilege.resConsumable` | boolean | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `true` |
| `privileges[].freeTrialPrivilege.userConsumable` | boolean | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].id` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `449818741` |
| `privileges[].ignoreCache` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].maxbr` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].maxBrLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].message` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].payed` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].pl` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].playMaxbr` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `999000` |
| `privileges[].playMaxBrLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `jymaster` |
| `privileges[].plLevel` | union<string|null> | 10 | 7 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `none` |
| `privileges[].plLevels` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].preSell` | boolean | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `false` |
| `privileges[].rightSource` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].rscl` | null | 10 | 10 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED |  |
| `privileges[].sp` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `7` |
| `privileges[].st` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `0` |
| `privileges[].subp` | number | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `1` |
| `privileges[].toast` | boolean | 10 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `false` |
| `songs` | array<unknown> | 5 | 0 | 5 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `undefined` |
| `songs[].a` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].additionalTitle` | union<null|string> | 3 | 1 | 0 | AUTH_NONE | `(Teil 127)` |
| `songs[].al.id` | number | 3 | 0 | 0 | AUTH_NONE | `35093341` |
| `songs[].al.name` | string | 3 | 0 | 0 | AUTH_NONE | `光年之外` |
| `songs[].al.pic` | number | 3 | 0 | 0 | AUTH_NONE | `18587244069235040` |
| `songs[].al.pic_str` | string | 3 | 0 | 0 | AUTH_NONE | `18587244069235039` |
| `songs[].al.picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `https://p4.music.126.net/fkqFqMaEt0CzxYS` |
| `songs[].al.tns` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `songs[].alia` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `songs[].alia[]` | string | 1 | 0 | 0 | AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `songs[].ar[].alias` | array<unknown> | 5 | 0 | 5 | AUTH_NONE | `undefined` |
| `songs[].ar[].id` | number | 5 | 0 | 0 | AUTH_NONE | `7763` |
| `songs[].ar[].name` | string | 5 | 0 | 0 | AUTH_NONE | `G.E.M.邓紫棋` |
| `songs[].ar[].tns` | array<unknown> | 5 | 0 | 5 | AUTH_NONE | `undefined` |
| `songs[].artistClassics` | boolean | 3 | 0 | 0 | AUTH_NONE | `false` |
| `songs[].awardTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].cd` | string | 3 | 0 | 0 | AUTH_NONE | `1` |
| `songs[].cf` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `songs[].copyright` | number | 3 | 0 | 0 | AUTH_NONE | `2` |
| `songs[].cp` | number | 3 | 0 | 0 | AUTH_NONE | `1415926` |
| `songs[].crbt` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].displayTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].djId` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].dt` | number | 3 | 0 | 0 | AUTH_NONE | `235505` |
| `songs[].entertainmentTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].fee` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `songs[].ftype` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].h.br` | number | 3 | 0 | 0 | AUTH_NONE | `320000` |
| `songs[].h.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].h.size` | number | 3 | 0 | 0 | AUTH_NONE | `9422933` |
| `songs[].h.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `songs[].h.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-44887` |
| `songs[].hr` | null | 2 | 2 | 0 | AUTH_NONE |  |
| `songs[].hr.br` | number | 1 | 0 | 0 | AUTH_NONE | `1717157` |
| `songs[].hr.fid` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].hr.size` | number | 1 | 0 | 0 | AUTH_NONE | `44768984` |
| `songs[].hr.sr` | number | 1 | 0 | 0 | AUTH_NONE | `48000` |
| `songs[].hr.vd` | number | 1 | 0 | 0 | AUTH_NONE | `-70718` |
| `songs[].id` | number | 3 | 0 | 0 | AUTH_NONE | `449818741` |
| `songs[].l.br` | number | 3 | 0 | 0 | AUTH_NONE | `128000` |
| `songs[].l.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].l.size` | number | 3 | 0 | 0 | AUTH_NONE | `3769199` |
| `songs[].l.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `songs[].l.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-40588` |
| `songs[].m.br` | number | 3 | 0 | 0 | AUTH_NONE | `192000` |
| `songs[].m.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].m.size` | number | 3 | 0 | 0 | AUTH_NONE | `5653777` |
| `songs[].m.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `songs[].m.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-42341` |
| `songs[].mainTitle` | union<null|string> | 3 | 1 | 0 | AUTH_NONE | `Kapitel 8: Zu schön, um wahr zu sein ` |
| `songs[].mark` | number | 3 | 0 | 0 | AUTH_NONE | `17179877376` |
| `songs[].markTags` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `songs[].mst` | number | 3 | 0 | 0 | AUTH_NONE | `9` |
| `songs[].mv` | number | 3 | 0 | 0 | AUTH_NONE | `5404646` |
| `songs[].name` | string | 3 | 0 | 0 | AUTH_NONE | `光年之外` |
| `songs[].no` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].noCopyrightRcmd` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].originCoverType` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `songs[].originSongSimpleData` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].pop` | number | 3 | 0 | 0 | AUTH_NONE | `100` |
| `songs[].pst` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].publishTime` | number | 3 | 0 | 0 | AUTH_NONE | `1483027200007` |
| `songs[].resourceState` | boolean | 3 | 0 | 0 | AUTH_NONE | `true` |
| `songs[].rt` | union<null|string> | 3 | 1 | 0 | AUTH_NONE | `` |
| `songs[].rtUrl` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].rtUrls` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `songs[].rtype` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].rurl` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].s_id` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].single` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].songFeature` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].songJumpInfo` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].sq.br` | number | 3 | 0 | 0 | AUTH_NONE | `887395` |
| `songs[].sq.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].sq.size` | number | 3 | 0 | 0 | AUTH_NONE | `26123277` |
| `songs[].sq.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `songs[].sq.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-45090` |
| `songs[].st` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].t` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `songs[].tagPicList` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `songs[].v` | number | 3 | 0 | 0 | AUTH_NONE | `139` |
| `songs[].version` | number | 3 | 0 | 0 | AUTH_NONE | `105` |
