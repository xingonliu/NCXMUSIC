# ncm.song_url / song_url

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`2fe652fccf3d69c1faec41ea8b0a68377eacaa2bfff33f97d77264f2a1c25269`（pkg）
- 导出名：song_url
- 路由或调用方式：`/api/song/enhance/player/url`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：song / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：user_or_vip
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/song_url.js（注释：歌曲链接）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/song/url
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| br | string | 未发现默认值 | 源码读取 query.br |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：songId
- produces：songId
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 54）

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

## 16. Phase 4 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: 同上；多数 NONE/INVALID 样本被 -462 阻断）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.song_url.A.br128.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.song_url.A.br320.anon.001 | AUTH_ANON | - | 200 | 121 |  |
| ncm.song_url.A.br999.none.001 | AUTH_NONE | err | -462 | - | code -462 |
| ncm.song_url.A.id0.none.neg.001 | AUTH_NONE | err | -462 | - | code -462 |
| ncm.song_url.B.br999.none.001 | AUTH_NONE | err | -462 | - | code -462 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `data[].accompany` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].auEff` | number | 1 | 0 | 0 | AUTH_ANON | `1001` |
| `data[].beatType` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].br` | number | 1 | 0 | 0 | AUTH_ANON | `128012` |
| `data[].canExtend` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data[].channelLayout` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].closedGain` | number | 1 | 0 | 0 | AUTH_ANON | `-6` |
| `data[].closedPeak` | number | 1 | 0 | 0 | AUTH_ANON | `0.999` |
| `data[].code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `data[].effectTypes` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].encodeType` | string | 1 | 0 | 0 | AUTH_ANON | `mp3` |
| `data[].expi` | number | 1 | 0 | 0 | AUTH_ANON | `1200` |
| `data[].fee` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `data[].flag` | number | 1 | 0 | 0 | AUTH_ANON | `1541124` |
| `data[].freeTimeTrialPrivilege.remainTime` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].freeTimeTrialPrivilege.resConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data[].freeTimeTrialPrivilege.type` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].freeTimeTrialPrivilege.userConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data[].freeTrialInfo.algData.audioEffect` | number | 1 | 0 | 0 | AUTH_ANON | `-1` |
| `data[].freeTrialInfo.algData.fragSource` | string | 1 | 0 | 0 | AUTH_ANON | `alg` |
| `data[].freeTrialInfo.end` | number | 1 | 0 | 0 | AUTH_ANON | `30` |
| `data[].freeTrialInfo.fragmentType` | number | 1 | 0 | 0 | AUTH_ANON | `6` |
| `data[].freeTrialInfo.start` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].freeTrialPrivilege.cannotListenReason` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `data[].freeTrialPrivilege.freeLimitTagType` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].freeTrialPrivilege.listenType` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].freeTrialPrivilege.playReason` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].freeTrialPrivilege.resConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data[].freeTrialPrivilege.userConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data[].gain` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `data[].id` | number | 1 | 0 | 0 | AUTH_ANON | `449818741` |
| `data[].immerseType` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].level` | string | 1 | 0 | 0 | AUTH_ANON | `standard` |
| `data[].levelConfuse` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].md5` | string | 1 | 0 | 0 | AUTH_ANON | `6d022858528f8d8b3cb329a5321e3909` |
| `data[].message` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].musicId` | string | 1 | 0 | 0 | AUTH_ANON | `11273635073` |
| `data[].payed` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].peak` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].podcastCtrp` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].rightSource` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data[].size` | number | 1 | 0 | 0 | AUTH_ANON | `481115` |
| `data[].sr` | number | 1 | 0 | 0 | AUTH_ANON | `44100` |
| `data[].time` | number | 1 | 0 | 0 | AUTH_ANON | `30040` |
| `data[].type` | string | 1 | 0 | 0 | AUTH_ANON | `MP3` |
| `data[].uf` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data[].url` | string | 1 | 0 | 0 | AUTH_ANON | `http://m702.music.126.net/20260804193817` |
| `data[].urlSource` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
