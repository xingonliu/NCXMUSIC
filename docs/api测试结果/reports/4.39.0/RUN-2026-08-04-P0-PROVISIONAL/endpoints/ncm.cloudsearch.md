# ncm.cloudsearch / cloudsearch

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`2c831a3a86413c2747b92970041387fcdb934aba5aabf9a6c2f91816ade80657`（pkg）
- 导出名：cloudsearch
- 路由或调用方式：`/api/cloudsearch/pc`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：search / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/cloudsearch.js（注释：搜索）
- 类型：interface.d.ts 有函数声明
- 文档：
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| keywords | string | 未发现默认值 | 源码读取 query.keywords |
| type | string | 可选（默认 `1`） | 源码读取 query.type |
| limit | string | 可选（默认 `30`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId, artistId, albumId, playlistId, mvId, videoId, djId
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
| ncm.cloudsearch.empty.none.neg.001 | AUTH_NONE | - | 400 | 78 |  |
| ncm.cloudsearch.kw1.anon.001 | AUTH_ANON | - | 200 | 382 |  |
| ncm.cloudsearch.kw1.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 322 |  |
| ncm.cloudsearch.kw1.none.001 | AUTH_NONE | - | 200 | 232 |  |
| ncm.cloudsearch.kw2.none.001 | AUTH_NONE | - | 200 | 226 |  |
| ncm.cloudsearch.page.boundary.001 | AUTH_NONE | - | 200 | 245 |  |
| ncm.cloudsearch.page.mid.001 | AUTH_NONE | - | 200 | 243 |  |
| ncm.cloudsearch.type999.none.neg.001 | AUTH_NONE | - | 200 | 77 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 8 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `400` |
| `result.songCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `318` |
| `result.songs[].al.id` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `result.songs[].al.name` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].al.pic` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `result.songs[].al.pic_str` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235039` |
| `result.songs[].al.picUrl` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/fkqFqMaEt0CzxYS-` |
| `result.songs[].al.tns` | array<unknown> | 16 | 0 | 16 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].alia` | array<unknown> | 11 | 0 | 11 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].alia[]` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.songs[].ar[].alia[]` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `result.songs[].ar[].alias` | array<unknown> | 9 | 0 | 9 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].ar[].alias[]` | string | 27 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `result.songs[].ar[].id` | number | 26 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `result.songs[].ar[].name` | string | 26 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `result.songs[].ar[].tns` | array<unknown> | 26 | 0 | 26 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].cd` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].cf` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result.songs[].copyright` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `result.songs[].cp` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1415926` |
| `result.songs[].djId` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].dt` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `235505` |
| `result.songs[].fee` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].ftype` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].h.br` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result.songs[].h.fid` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].h.size` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9422933` |
| `result.songs[].h.sr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `result.songs[].h.vd` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-44887` |
| `result.songs[].hr.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1631060` |
| `result.songs[].hr.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].hr.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `56495579` |
| `result.songs[].hr.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result.songs[].hr.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-50168` |
| `result.songs[].id` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `result.songs[].l.br` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `result.songs[].l.fid` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].l.size` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3769199` |
| `result.songs[].l.sr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `result.songs[].l.vd` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-40588` |
| `result.songs[].m.br` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `192000` |
| `result.songs[].m.fid` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].m.size` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5653777` |
| `result.songs[].m.sr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `result.songs[].m.vd` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-42341` |
| `result.songs[].mark` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17179877376` |
| `result.songs[].mst` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9` |
| `result.songs[].mv` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5404646` |
| `result.songs[].name` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].no` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].originCoverType` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].originSongSimpleData.albumMeta.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `result.songs[].originSongSimpleData.albumMeta.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].originSongSimpleData.artists[].id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `result.songs[].originSongSimpleData.artists[].name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `result.songs[].originSongSimpleData.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].originSongSimpleData.songId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `result.songs[].pop` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `result.songs[].privilege.chargeInfoList[].chargeType` | number | 48 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].privilege.chargeInfoList[].rate` | number | 48 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `result.songs[].privilege.code` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.cp` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].privilege.cs` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result.songs[].privilege.dl` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.dlLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `result.songs[].privilege.downloadMaxbr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result.songs[].privilege.downloadMaxBrLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result.songs[].privilege.fee` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].privilege.fl` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.flag` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1541124` |
| `result.songs[].privilege.flLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `result.songs[].privilege.freeTrialPrivilege.cannotListenReason` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `result.songs[].privilege.freeTrialPrivilege.listenType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `result.songs[].privilege.freeTrialPrivilege.resConsumable` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result.songs[].privilege.freeTrialPrivilege.userConsumable` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result.songs[].privilege.id` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `result.songs[].privilege.maxbr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result.songs[].privilege.maxBrLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result.songs[].privilege.payed` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.pl` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.playMaxbr` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result.songs[].privilege.playMaxBrLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result.songs[].privilege.plLevel` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `result.songs[].privilege.preSell` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result.songs[].privilege.rightSource` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.sp` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7` |
| `result.songs[].privilege.st` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].privilege.subp` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].privilege.toast` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result.songs[].pst` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].publishTime` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1483027200007` |
| `result.songs[].resourceState` | boolean | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `result.songs[].rt` | string | 5 | 0 | 0 | AUTH_NONE | `600902000009484210` |
| `result.songs[].rtUrls` | array<unknown> | 16 | 0 | 16 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].rtype` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].s_id` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].single` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].sq.br` | number | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `887395` |
| `result.songs[].sq.fid` | number | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].sq.size` | number | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `26123277` |
| `result.songs[].sq.sr` | number | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `result.songs[].sq.vd` | number | 13 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-45090` |
| `result.songs[].st` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].t` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].v` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `139` |
| `result.songs[].version` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `105` |
| `trp.rules[]` | string | 14 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `search_tab_song::552458417::searchAlg$is` |
