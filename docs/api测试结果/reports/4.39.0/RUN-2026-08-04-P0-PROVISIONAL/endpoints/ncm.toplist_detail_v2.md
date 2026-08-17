# ncm.toplist_detail_v2 / toplist_detail_v2

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`9f209b3af7e8e1668c245798de3875081f540b005ba46f562c756cdad295cbce`（pkg）
- 导出名：toplist_detail_v2
- 路由或调用方式：`/api/toplist/detail/v2`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：toplist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/toplist_detail_v2.js（注释：所有榜单内容摘要v2）
- 类型：interface.d.ts 有函数声明
- 文档：
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| （未发现 query 参数读取） | | | |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
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

## 17. Phase 6 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 账号缺失（B-002）；写操作/私有域已预授权但账号未到位）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.toplist_detail_v2.anon.001 | AUTH_ANON | - | 200 | 202 |  |
| ncm.toplist_detail_v2.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 259 |  |
| ncm.toplist_detail_v2.none.001 | AUTH_NONE | - | 200 | 186 |  |
| ncm.toplist_detail_v2.none.002 | AUTH_NONE | - | 200 | 173 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `data[].categoryCode` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `TOPPING` |
| `data[].displayType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `ONLY_COVER` |
| `data[].frontDisplayType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `ONLY_COVER_SMALL` |
| `data[].list[].canPlay` | boolean | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data[].list[].category` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `FEATURE` |
| `data[].list[].coverImgId` | number | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951170048519540` |
| `data[].list[].coverType` | null | 36 | 36 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].coverUrl` | union<string|null> | 36 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/_kSxOPqQ5J5etC5` |
| `data[].list[].firstCoverHdUrl` | union<string|null> | 36 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `data[].list[].firstCoverUrl` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `data[].list[].frontTargetUrl` | union<null|string> | 36 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://st.music.163.com/g/store/board#h` |
| `data[].list[].id` | number | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `6723173524` |
| `data[].list[].logName` | union<null|string> | 36 | 20 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `hot` |
| `data[].list[].name` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `网络热歌榜` |
| `data[].list[].nameShowStyle` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `singleRow` |
| `data[].list[].newFirstCoverUrl` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p5.music.126.net/obj/wonDlsKUwrL` |
| `data[].list[].newFirstTextCoverUrl` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `data[].list[].positionInCategory` | number | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1294` |
| `data[].list[].secondCoverUrl` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data[].list[].songCoverImgUrl` | union<string|null> | 36 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/y8ti3PoTDAh5ll6` |
| `data[].list[].subDisplayType` | null | 36 | 36 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].subscriptUrl` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data[].list[].tagCode` | null | 36 | 36 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].targetType` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `PLAYLIST` |
| `data[].list[].targetUrl` | union<null|string> | 36 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://st.music.163.com/g/store/board#h` |
| `data[].list[].toplistCode` | union<null|string> | 36 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `ALBUM_SELL_CHART##` |
| `data[].list[].trackRankList` | null | 21 | 21 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].trackRankList[].artistName` | string | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `马也_Crabbit` |
| `data[].list[].trackRankList[].coverImgUrl` | string | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/Enhy6dPn4gpyqrKh` |
| `data[].list[].trackRankList[].itemId` | null | 45 | 45 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].trackRankList[].itemName` | null | 45 | 45 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].trackRankList[].lastRank` | number | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data[].list[].trackRankList[].rank` | number | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data[].list[].trackRankList[].songName` | string | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `海屿你` |
| `data[].list[].trackRankList[].trackId` | number | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1973665667` |
| `data[].list[].tracks` | null | 21 | 21 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data[].list[].tracks[].first` | string | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `海屿你` |
| `data[].list[].tracks[].second` | string | 45 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `马也_Crabbit` |
| `data[].list[].updateFrequency` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `每周五更新` |
| `data[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `榜单推荐` |
| `data[].targetUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `msg` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
