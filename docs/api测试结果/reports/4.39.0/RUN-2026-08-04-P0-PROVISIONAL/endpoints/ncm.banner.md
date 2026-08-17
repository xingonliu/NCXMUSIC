# ncm.banner / banner

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`8afd160679a17c7b6b9873e3aa855b32890f9a6354122a701858260657bd4025`（pkg）
- 导出名：banner
- 路由或调用方式：`/api/v2/banner/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：other / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/banner.js（注释：首页轮播图）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/banner
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| type | string | 未发现默认值 | 源码读取 query.type |

- crypto 模式：（未指定）
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

## 14. Phase 2 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.banner.type0.anon.001 | AUTH_ANON | - | 200 | 154 |  |
| ncm.banner.type0.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 117 |  |
| ncm.banner.type0.none.001 | AUTH_NONE | - | 200 | 106 |  |
| ncm.banner.type2.none.001 | AUTH_NONE | - | 200 | 99 |  |
| ncm.banner.type3.none.001 | AUTH_NONE | - | 200 | 123 |  |
| ncm.banner.type999.none.neg.001 | AUTH_NONE | - | 200 | 101 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `banners[].adDispatchJson` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].adid` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].adLocation` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].adSource` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].adurlV2` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].alg` | string | 6 | 0 | 0 | AUTH_NONE | `banner-feature-1717750403848278` |
| `banners[].bannerBizType` | string | 6 | 0 | 0 | AUTH_NONE | `force_banner` |
| `banners[].bannerId` | string | 6 | 0 | 0 | AUTH_NONE | `1717750403848278` |
| `banners[].bigImageUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `banners[].dynamicVideoData` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].encodeId` | string | 6 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].event` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].exclusive` | boolean | 6 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].extMonitor` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].extMonitorInfo` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].imageUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `banners[].logContext` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].mainTitle` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].monitorBlackList` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].monitorClick` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].monitorClickList` | array<unknown> | 6 | 0 | 6 | AUTH_NONE | `undefined` |
| `banners[].monitorImpress` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].monitorImpressList` | array<unknown> | 6 | 0 | 6 | AUTH_NONE | `undefined` |
| `banners[].monitorType` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].pic` | string | 6 | 0 | 0 | AUTH_NONE | `http://p1.music.126.net/ah0tWohGfH48V9HJ` |
| `banners[].pid` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].program` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].requestId` | string | 6 | 0 | 0 | AUTH_NONE | `` |
| `banners[].s_ctrp` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `linkPlatform$cc$pc_banner_op_channel$bpo` |
| `banners[].scm` | string | 6 | 0 | 0 | AUTH_NONE | `1.music-homepage.homepage_banner_force.b` |
| `banners[].showAdTag` | boolean | 6 | 0 | 0 | AUTH_NONE | `true` |
| `banners[].showContext` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].song` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `banners[].song.al.id` | number | 2 | 0 | 0 | AUTH_NONE | `370354921` |
| `banners[].song.al.name` | string | 2 | 0 | 0 | AUTH_NONE | `明日世界ACT I` |
| `banners[].song.al.pic` | number | 2 | 0 | 0 | AUTH_NONE | `109951173557997840` |
| `banners[].song.al.pic_str` | string | 2 | 0 | 0 | AUTH_NONE | `109951173557997835` |
| `banners[].song.al.picUrl` | string | 2 | 0 | 0 | AUTH_NONE | `http://p3.music.126.net/wlpke49BdPJzaQI7` |
| `banners[].song.al.tns` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `banners[].song.alg` | string | 2 | 0 | 0 | AUTH_NONE | `banner-feature-4888340` |
| `banners[].song.alia` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `banners[].song.ar[].alias` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `banners[].song.ar[].id` | number | 3 | 0 | 0 | AUTH_NONE | `5538` |
| `banners[].song.ar[].name` | string | 3 | 0 | 0 | AUTH_NONE | `汪苏泷` |
| `banners[].song.ar[].tns` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `banners[].song.cd` | string | 2 | 0 | 0 | AUTH_NONE | `01` |
| `banners[].song.cf` | string | 2 | 0 | 0 | AUTH_NONE | `` |
| `banners[].song.copyright` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.cp` | number | 2 | 0 | 0 | AUTH_NONE | `729013` |
| `banners[].song.djId` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.dt` | number | 2 | 0 | 0 | AUTH_NONE | `248240` |
| `banners[].song.fee` | number | 2 | 0 | 0 | AUTH_NONE | `8` |
| `banners[].song.ftype` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.h.br` | number | 2 | 0 | 0 | AUTH_NONE | `320000` |
| `banners[].song.h.fid` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.h.size` | number | 2 | 0 | 0 | AUTH_NONE | `9932205` |
| `banners[].song.h.sr` | number | 2 | 0 | 0 | AUTH_NONE | `48000` |
| `banners[].song.h.vd` | number | 2 | 0 | 0 | AUTH_NONE | `-52316` |
| `banners[].song.hr.br` | number | 2 | 0 | 0 | AUTH_NONE | `2831152` |
| `banners[].song.hr.fid` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.hr.size` | number | 2 | 0 | 0 | AUTH_NONE | `87855505` |
| `banners[].song.hr.sr` | number | 2 | 0 | 0 | AUTH_NONE | `96000` |
| `banners[].song.hr.vd` | number | 2 | 0 | 0 | AUTH_NONE | `-52303` |
| `banners[].song.id` | number | 2 | 0 | 0 | AUTH_NONE | `3369666014` |
| `banners[].song.l.br` | number | 2 | 0 | 0 | AUTH_NONE | `128000` |
| `banners[].song.l.fid` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.l.size` | number | 2 | 0 | 0 | AUTH_NONE | `3972909` |
| `banners[].song.l.sr` | number | 2 | 0 | 0 | AUTH_NONE | `48000` |
| `banners[].song.l.vd` | number | 2 | 0 | 0 | AUTH_NONE | `-48258` |
| `banners[].song.m.br` | number | 2 | 0 | 0 | AUTH_NONE | `192000` |
| `banners[].song.m.fid` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.m.size` | number | 2 | 0 | 0 | AUTH_NONE | `5959341` |
| `banners[].song.m.sr` | number | 2 | 0 | 0 | AUTH_NONE | `48000` |
| `banners[].song.m.vd` | number | 2 | 0 | 0 | AUTH_NONE | `-49776` |
| `banners[].song.mark` | number | 2 | 0 | 0 | AUTH_NONE | `17716748288` |
| `banners[].song.mst` | number | 2 | 0 | 0 | AUTH_NONE | `9` |
| `banners[].song.mv` | number | 2 | 0 | 0 | AUTH_NONE | `34779825` |
| `banners[].song.name` | string | 2 | 0 | 0 | AUTH_NONE | `写故事的人` |
| `banners[].song.no` | number | 2 | 0 | 0 | AUTH_NONE | `4` |
| `banners[].song.originCoverType` | number | 2 | 0 | 0 | AUTH_NONE | `1` |
| `banners[].song.pop` | number | 2 | 0 | 0 | AUTH_NONE | `100` |
| `banners[].song.privilege.chargeInfoList[].chargeType` | number | 6 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.chargeInfoList[].rate` | number | 6 | 0 | 0 | AUTH_NONE | `128000` |
| `banners[].song.privilege.code` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.cp` | number | 2 | 0 | 0 | AUTH_NONE | `1` |
| `banners[].song.privilege.cs` | boolean | 2 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].song.privilege.dl` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.dlLevel` | string | 2 | 0 | 0 | AUTH_NONE | `none` |
| `banners[].song.privilege.downloadMaxbr` | number | 2 | 0 | 0 | AUTH_NONE | `999000` |
| `banners[].song.privilege.downloadMaxBrLevel` | string | 2 | 0 | 0 | AUTH_NONE | `jymaster` |
| `banners[].song.privilege.fee` | number | 2 | 0 | 0 | AUTH_NONE | `8` |
| `banners[].song.privilege.fl` | number | 2 | 0 | 0 | AUTH_NONE | `320000` |
| `banners[].song.privilege.flag` | number | 2 | 0 | 0 | AUTH_NONE | `1544196` |
| `banners[].song.privilege.flLevel` | string | 2 | 0 | 0 | AUTH_NONE | `exhigh` |
| `banners[].song.privilege.freeTrialPrivilege.resConsumable` | boolean | 2 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].song.privilege.freeTrialPrivilege.userConsumable` | boolean | 2 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].song.privilege.id` | number | 2 | 0 | 0 | AUTH_NONE | `3369666014` |
| `banners[].song.privilege.maxbr` | number | 2 | 0 | 0 | AUTH_NONE | `999000` |
| `banners[].song.privilege.maxBrLevel` | string | 2 | 0 | 0 | AUTH_NONE | `jymaster` |
| `banners[].song.privilege.payed` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.pl` | number | 2 | 0 | 0 | AUTH_NONE | `320000` |
| `banners[].song.privilege.playMaxbr` | number | 2 | 0 | 0 | AUTH_NONE | `999000` |
| `banners[].song.privilege.playMaxBrLevel` | string | 2 | 0 | 0 | AUTH_NONE | `jymaster` |
| `banners[].song.privilege.plLevel` | string | 2 | 0 | 0 | AUTH_NONE | `exhigh` |
| `banners[].song.privilege.preSell` | boolean | 2 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].song.privilege.rightSource` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.sp` | number | 2 | 0 | 0 | AUTH_NONE | `7` |
| `banners[].song.privilege.st` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.privilege.subp` | number | 2 | 0 | 0 | AUTH_NONE | `1` |
| `banners[].song.privilege.toast` | boolean | 2 | 0 | 0 | AUTH_NONE | `false` |
| `banners[].song.pst` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.publishTime` | number | 2 | 0 | 0 | AUTH_NONE | `1773331200000` |
| `banners[].song.resourceState` | boolean | 2 | 0 | 0 | AUTH_NONE | `true` |
| `banners[].song.rt` | string | 2 | 0 | 0 | AUTH_NONE | `` |
| `banners[].song.rtUrls` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `banners[].song.rtype` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.s_id` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.single` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.sq.br` | number | 2 | 0 | 0 | AUTH_NONE | `936784` |
| `banners[].song.sq.fid` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.sq.size` | number | 2 | 0 | 0 | AUTH_NONE | `29073060` |
| `banners[].song.sq.sr` | number | 2 | 0 | 0 | AUTH_NONE | `48000` |
| `banners[].song.sq.vd` | number | 2 | 0 | 0 | AUTH_NONE | `-52299` |
| `banners[].song.st` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.t` | number | 2 | 0 | 0 | AUTH_NONE | `0` |
| `banners[].song.v` | number | 2 | 0 | 0 | AUTH_NONE | `52` |
| `banners[].song.version` | number | 2 | 0 | 0 | AUTH_NONE | `18` |
| `banners[].targetId` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `banners[].targetType` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3000` |
| `banners[].titleColor` | string | 6 | 0 | 0 | AUTH_NONE | `blue` |
| `banners[].typeTitle` | string | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `活动` |
| `banners[].url` | union<string|null> | 18 | 1 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://y.music.163.com/g/yida/act/kisso` |
| `banners[].video` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `code` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `trp.rules[]` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `BANNER_PC_V2::pc_banner_op_channel_1::li` |
