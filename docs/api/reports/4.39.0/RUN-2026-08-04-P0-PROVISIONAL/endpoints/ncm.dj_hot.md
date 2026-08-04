# ncm.dj_hot / dj_hot

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`dbd0b3aff27d160a2d74a3a32e83610a2b008c40da2b6763f316c4bd80d7421e`（pkg）
- 导出名：dj_hot
- 路由或调用方式：`/api/djradio/hot/v1`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：dj / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/dj_hot.js（注释：热门电台）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/dj/hot
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| limit | string | 可选（默认 `30`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：djId, programId, radioId
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
| ncm.dj_hot.anon.001 | AUTH_ANON | - | 200 | 90 |  |
| ncm.dj_hot.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 108 |  |
| ncm.dj_hot.limit5.none.001 | AUTH_NONE | - | 200 | 71 |  |
| ncm.dj_hot.none.001 | AUTH_NONE | - | 200 | 92 |  |
| ncm.dj_hot.page.none.001 | AUTH_NONE | - | 200 | 92 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `djRadios[].buyed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `djRadios[].category` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `创作翻唱` |
| `djRadios[].categoryId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2001` |
| `djRadios[].copywriter` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `四合院现场，粗粝而动人` |
| `djRadios[].createTime` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1546664883212` |
| `djRadios[].dj.accountStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `djRadios[].dj.anchor` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `djRadios[].dj.authenticationTypes` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `12296` |
| `djRadios[].dj.authority` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `djRadios[].dj.authStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `djRadios[].dj.avatarDetail` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `djRadios[].dj.avatarImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951163830964130` |
| `djRadios[].dj.avatarImgId_str` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951163830964130` |
| `djRadios[].dj.avatarImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951163830964130` |
| `djRadios[].dj.avatarUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/GmOFC7jIpPCM358I` |
| `djRadios[].dj.backgroundImgId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951164017495460` |
| `djRadios[].dj.backgroundImgIdStr` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951164017495459` |
| `djRadios[].dj.backgroundUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/hWzTM8MCymkmyIFV` |
| `djRadios[].dj.birthday` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `813168000000` |
| `djRadios[].dj.city` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `500101` |
| `djRadios[].dj.defaultAvatar` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `djRadios[].dj.description` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `djRadios[].dj.detailDescription` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `djRadios[].dj.djStatus` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10` |
| `djRadios[].dj.experts` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `djRadios[].dj.expertTags` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `djRadios[].dj.followed` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `djRadios[].dj.gender` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `djRadios[].dj.mutual` | boolean | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `djRadios[].dj.nickname` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `四十只烤翅` |
| `djRadios[].dj.province` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `500000` |
| `djRadios[].dj.remarkName` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `djRadios[].dj.signature` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `一切顺利` |
| `djRadios[].dj.userId` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `426366432` |
| `djRadios[].dj.userType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `djRadios[].dj.vipType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `djRadios[].feeScope` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `djRadios[].id` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `792544462` |
| `djRadios[].name` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `四只烤翅` |
| `djRadios[].picUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/Dk8SWIUBmiiutKN` |
| `djRadios[].playCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `187521040` |
| `djRadios[].programCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `33` |
| `djRadios[].radioFeeType` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `djRadios[].rcmdtext` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `四合院现场，粗粝而动人` |
| `djRadios[].subCount` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `245220` |
| `djRadios[].subed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `hasMore` | boolean | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
