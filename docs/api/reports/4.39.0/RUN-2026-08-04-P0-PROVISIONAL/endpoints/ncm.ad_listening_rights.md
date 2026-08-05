# ncm.ad_listening_rights / ad_listening_rights

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`ed07a0bed601557158826734d0a71ae2d9ef4f3c77a7e635a506fea85bf19dc0`（pkg）
- 导出名：ad_listening_rights
- 路由或调用方式：`/api/ad/homepage/free/tab/extend/v2`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：other / rare
- 副作用级别：read
- 测试阶段（§6 优先级）：P2
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/ad_listening_rights.js（注释：获取免费听时长状态）
- 类型：interface.d.ts 无对应函数声明（types-missing）
- 文档：docs:/ad/listening/rights
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| （未发现 query 参数读取） | | | |

- crypto 模式：xeapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：（无）
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 5）

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
| ncm.ad_listening_rights.anon.001 | AUTH_ANON | - | 200 | 124 |  |
| ncm.ad_listening_rights.inv.001 | AUTH_INVALID_EXPIRED | err | 2001 | - | code 2001 |
| ncm.ad_listening_rights.none.001 | AUTH_NONE | err | 2001 | - | code 2001 |
| ncm.ad_listening_rights.none.002 | AUTH_NONE | err | 2001 | - | code 2001 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `data.actionTitle` | string | 1 | 0 | 0 | AUTH_ANON | `领30分钟` |
| `data.actionUrl` | string | 1 | 0 | 0 | AUTH_ANON | `orpheus://nm/motivationAd/show?adPositio` |
| `data.assetCardStyle` | string | 1 | 0 | 0 | AUTH_ANON | `t1` |
| `data.cardContent.actionTitle` | string | 1 | 0 | 0 | AUTH_ANON | `点击领取30分钟免费听` |
| `data.cardContent.actionUrl` | string | 1 | 0 | 0 | AUTH_ANON | `orpheus://nm/motivationAd/show?adPositio` |
| `data.cardContent.amount` | number | 1 | 0 | 0 | AUTH_ANON | `30` |
| `data.cardContent.cardTopLeftTitle` | string | 1 | 0 | 0 | AUTH_ANON | `看视频 续时长` |
| `data.cardContent.cardTopRightDesc` | string | 1 | 0 | 0 | AUTH_ANON | `浏览小视频，获取免费听时长` |
| `data.cardContent.unit` | string | 1 | 0 | 0 | AUTH_ANON | `分钟` |
| `data.cardType` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `data.rightsCoverToday` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.rightsEndTime` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.rightsRemainingTime` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.rightsUpperLimit` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.ruleTitle` | string | 1 | 0 | 0 | AUTH_ANON | `免费听歌活动规则` |
| `data.ruleUrl` | string | 1 | 0 | 0 | AUTH_ANON | `https://y.music.163.com/g/yida/adfeaa597` |
| `data.status` | string | 1 | 0 | 0 | AUTH_ANON | `INIT` |
| `data.title` | string | 1 | 0 | 0 | AUTH_ANON | `看视频 免费听VIP歌曲` |
| `data.vipInfoContent` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.vipInfoContentV2` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.yunbeiEntry` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.yunbeiEntryV2.adInfo.actionUrl` | string | 1 | 0 | 0 | AUTH_ANON | `orpheus://nm/motivationAd/show?adPositio` |
| `data.yunbeiEntryV2.adInfo.amount` | number | 1 | 0 | 0 | AUTH_ANON | `268` |
| `data.yunbeiEntryV2.adInfo.baseSource` | number | 1 | 0 | 0 | AUTH_ANON | `538` |
| `data.yunbeiEntryV2.adInfo.behaviorSeqNo` | string | 1 | 0 | 0 | AUTH_ANON | `ad:mall:behavior:0e80d544554749eebca0e3c` |
| `data.yunbeiEntryV2.adInfo.bonusSource` | number | 1 | 0 | 0 | AUTH_ANON | `539` |
| `data.yunbeiEntryV2.adInfo.limit` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.yunbeiEntryV2.entranceType` | string | 1 | 0 | 0 | AUTH_ANON | `FREE_LISTEN_VIP_EXCHANGE` |
| `data.yunbeiEntryV2.esource` | string | 1 | 0 | 0 | AUTH_ANON | `free_listen_vip_exchange` |
| `data.yunbeiEntryV2.exchangePrice` | number | 1 | 0 | 0 | AUTH_ANON | `6000` |
| `data.yunbeiEntryV2.productImgUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p1.music.126.net/Wssw1avnLUKJobKi` |
| `data.yunbeiEntryV2.productName` | string | 1 | 0 | 0 | AUTH_ANON | `【每日可领】黑胶VIP天卡` |
| `data.yunbeiEntryV2.productStatus` | number | 1 | 0 | 0 | AUTH_ANON | `3` |
| `data.yunbeiEntryV2.productType` | number | 1 | 0 | 0 | AUTH_ANON | `2` |
| `data.yunbeiEntryV2.showValueLabel` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.yunbeiEntryV2.skuId` | number | 1 | 0 | 0 | AUTH_ANON | `866400807` |
| `data.yunbeiEntryV2.withdrawAmount` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.yunbeiEntryV2.withdrawUrl` | string | 1 | 0 | 0 | AUTH_ANON | `https://st.music.163.com/g/ad-music/with` |
| `data.yunbeiEntryV2.yunbeiAmount` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.yunbeiEntryV2.yunbeiCenterUrl` | string | 1 | 0 | 0 | AUTH_ANON | `orpheus://rnpage?component=rn-cloudshell` |
| `message` | null | 1 | 1 | 0 | AUTH_ANON |  |
