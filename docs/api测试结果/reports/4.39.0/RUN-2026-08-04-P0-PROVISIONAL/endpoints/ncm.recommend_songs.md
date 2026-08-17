# ncm.recommend_songs / recommend_songs

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`2a09b5ca8f0609c4d0efcac5c10ef49e6d457361ce3134b04f75b0e09edd35b2`（pkg）
- 导出名：recommend_songs
- 路由或调用方式：`/api/v3/discovery/recommend/songs`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：recommend / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：user
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/recommend_songs.js（注释：每日推荐歌曲）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/recommend/songs
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| afresh | string | 未发现默认值 | 源码读取 query.afresh |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：songId, playlistId
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
| ncm.recommend_songs.anon.001 | AUTH_ANON | - | 200 | 365 |  |
| ncm.recommend_songs.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 228 |  |
| ncm.recommend_songs.none.001 | AUTH_NONE | - | 200 | 165 |  |
| ncm.recommend_songs.none.002 | AUTH_NONE | - | 200 | 270 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `data.algReturnDemote` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.dailyRecommendInfo` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].a` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].additionalTitle` | union<null|string> | 12 | 11 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `(live)` |
| `data.dailySongs[].al.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10804` |
| `data.dailySongs[].al.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `第二天堂` |
| `data.dailySongs[].al.pic` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951171891430450` |
| `data.dailySongs[].al.pic_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951171891430447` |
| `data.dailySongs[].al.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/Gk4t93WwafRZtt9n` |
| `data.dailySongs[].al.tns` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].alg` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `hot_toplist_fill` |
| `data.dailySongs[].alia` | array<unknown> | 6 | 0 | 6 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].alia[]` | string | 6 | 0 | 0 | AUTH_INVALID_EXPIRED,AUTH_NONE | `电视剧《炽夏》片尾曲` |
| `data.dailySongs[].ar[].alias` | array<unknown> | 16 | 0 | 16 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].ar[].id` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3684` |
| `data.dailySongs[].ar[].name` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `林俊杰` |
| `data.dailySongs[].ar[].tns` | array<unknown> | 16 | 0 | 16 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].awardTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].cd` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `01` |
| `data.dailySongs[].cf` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.dailySongs[].copyright` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.dailySongs[].cp` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `22036` |
| `data.dailySongs[].crbt` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].displayTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].djId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].dt` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `267946` |
| `data.dailySongs[].entertainmentTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].fee` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.dailySongs[].ftype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].h.br` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `data.dailySongs[].h.fid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].h.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10720697` |
| `data.dailySongs[].h.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `data.dailySongs[].h.vd` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-27755` |
| `data.dailySongs[].hr` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].hr.br` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1731593` |
| `data.dailySongs[].hr.fid` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].hr.size` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `46741729` |
| `data.dailySongs[].hr.sr` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `data.dailySongs[].hr.vd` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-54690` |
| `data.dailySongs[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `108914` |
| `data.dailySongs[].l.br` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `data.dailySongs[].l.fid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].l.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4288305` |
| `data.dailySongs[].l.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `data.dailySongs[].l.vd` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-23765` |
| `data.dailySongs[].m.br` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `192000` |
| `data.dailySongs[].m.fid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].m.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `6432435` |
| `data.dailySongs[].m.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `data.dailySongs[].m.vd` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-25325` |
| `data.dailySongs[].mainTitle` | union<null|string> | 12 | 11 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `如果爱忘了 ` |
| `data.dailySongs[].mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17179877376` |
| `data.dailySongs[].markTags` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].mst` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9` |
| `data.dailySongs[].mv` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `522362` |
| `data.dailySongs[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `江南` |
| `data.dailySongs[].no` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `6` |
| `data.dailySongs[].noCopyrightRcmd` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].originCoverType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.dailySongs[].originSongSimpleData` | null | 11 | 11 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].originSongSimpleData.albumMeta.id` | number | 1 | 0 | 0 | AUTH_ANON | `28330` |
| `data.dailySongs[].originSongSimpleData.albumMeta.name` | string | 1 | 0 | 0 | AUTH_ANON | `如果爱忘了` |
| `data.dailySongs[].originSongSimpleData.artists[].id` | number | 1 | 0 | 0 | AUTH_ANON | `9203` |
| `data.dailySongs[].originSongSimpleData.artists[].name` | string | 1 | 0 | 0 | AUTH_ANON | `戚薇` |
| `data.dailySongs[].originSongSimpleData.name` | string | 1 | 0 | 0 | AUTH_ANON | `如果爱忘了` |
| `data.dailySongs[].originSongSimpleData.songId` | number | 1 | 0 | 0 | AUTH_ANON | `285321` |
| `data.dailySongs[].pop` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `data.dailySongs[].privilege.bd` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.chargeInfoList[].chargeMessage` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.chargeInfoList[].chargeType` | number | 9 | 0 | 0 | AUTH_ANON | `1` |
| `data.dailySongs[].privilege.chargeInfoList[].chargeUrl` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.chargeInfoList[].rate` | number | 9 | 0 | 0 | AUTH_ANON | `128000` |
| `data.dailySongs[].privilege.code` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.cp` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `data.dailySongs[].privilege.cs` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].privilege.dl` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.dlLevel` | string | 3 | 0 | 0 | AUTH_ANON | `none` |
| `data.dailySongs[].privilege.dlLevels` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.downloadMaxbr` | number | 3 | 0 | 0 | AUTH_ANON | `999000` |
| `data.dailySongs[].privilege.downloadMaxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.dailySongs[].privilege.fee` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `data.dailySongs[].privilege.fl` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.flag` | number | 3 | 0 | 0 | AUTH_ANON | `1540100` |
| `data.dailySongs[].privilege.flLevel` | string | 3 | 0 | 0 | AUTH_ANON | `none` |
| `data.dailySongs[].privilege.freeTrialPrivilege.cannotListenReason` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.freeTrialPrivilege.freeLimitTagType` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.freeTrialPrivilege.listenType` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.freeTrialPrivilege.playReason` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.freeTrialPrivilege.resConsumable` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].privilege.freeTrialPrivilege.userConsumable` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].privilege.id` | number | 3 | 0 | 0 | AUTH_ANON | `108914` |
| `data.dailySongs[].privilege.ignoreCache` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.maxbr` | number | 3 | 0 | 0 | AUTH_ANON | `999000` |
| `data.dailySongs[].privilege.maxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.dailySongs[].privilege.message` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.paidBigBang` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].privilege.payed` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.pc` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.pl` | number | 3 | 0 | 0 | AUTH_ANON | `128000` |
| `data.dailySongs[].privilege.playMaxbr` | number | 3 | 0 | 0 | AUTH_ANON | `999000` |
| `data.dailySongs[].privilege.playMaxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.dailySongs[].privilege.plLevel` | string | 3 | 0 | 0 | AUTH_ANON | `standard` |
| `data.dailySongs[].privilege.plLevels` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.preSell` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].privilege.realPayed` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.rightSource` | number | 3 | 0 | 0 | AUTH_ANON | `3` |
| `data.dailySongs[].privilege.rscl` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.dailySongs[].privilege.sp` | number | 3 | 0 | 0 | AUTH_ANON | `7` |
| `data.dailySongs[].privilege.st` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.dailySongs[].privilege.subp` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `data.dailySongs[].privilege.toast` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data.dailySongs[].pst` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].publishTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1086278400000` |
| `data.dailySongs[].reason` | union<string|null> | 12 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `超74%人播放` |
| `data.dailySongs[].recommendReason` | union<string|null> | 12 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `超74%人播放` |
| `data.dailySongs[].resourceState` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.dailySongs[].rt` | union<string|null> | 12 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `600902000009222907` |
| `data.dailySongs[].rtUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].rtUrls` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.dailySongs[].rtype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].rurl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].s_id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].single` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].songFeature` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].songJumpInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].sq.br` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `944860` |
| `data.dailySongs[].sq.fid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].sq.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `31646511` |
| `data.dailySongs[].sq.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `data.dailySongs[].sq.vd` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-27717` |
| `data.dailySongs[].st` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].t` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.dailySongs[].tagPicList` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.dailySongs[].tns[]` | string | 1 | 0 | 0 | AUTH_ANON | `River South` |
| `data.dailySongs[].v` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `174` |
| `data.dailySongs[].version` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `140` |
| `data.demote` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.fromCache` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.mvResourceInfos` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.orderSongs` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.recommendReasons[].reason` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `超74%人播放` |
| `data.recommendReasons[].reasonId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `title_10004` |
| `data.recommendReasons[].songId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `108914` |
| `data.recommendReasons[].targetUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
