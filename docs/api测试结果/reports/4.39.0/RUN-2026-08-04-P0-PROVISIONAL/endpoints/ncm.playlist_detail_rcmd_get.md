# ncm.playlist_detail_rcmd_get / playlist_detail_rcmd_get

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`01c4cf2f25de02ce1108ca0a67e97374f0cb6bdf21eb75640c55b12780f5573c`（pkg）
- 导出名：playlist_detail_rcmd_get
- 路由或调用方式：`/api/playlist/detail/rcmd/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：playlist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/playlist_detail_rcmd_get.js（注释：相关歌单推荐）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/playlist/detail/rcmd/get
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：playlistId
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

## 13. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.playlist_detail_rcmd_get.anon.001 | AUTH_ANON | - | 200 | 147 |  |
| ncm.playlist_detail_rcmd_get.id0.none.neg.001 | AUTH_NONE | - | 200 | 79 |  |
| ncm.playlist_detail_rcmd_get.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 135 |  |
| ncm.playlist_detail_rcmd_get.none.001 | AUTH_NONE | - | 200 | 127 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `data` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `data.jumpUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlistCollection` |
| `data.rcmdTitle` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `喜欢这个歌单的用户也听了` |
| `data.recPlaylist[].alg` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `alg_similar_tag` |
| `data.recPlaylist[].playlist.action` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlist/134839472?type=0&uiPl` |
| `data.recPlaylist[].playlist.coverImgId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167307403870` |
| `data.recPlaylist[].playlist.coverImgUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/8u788_Kz5Hndj6bo` |
| `data.recPlaylist[].playlist.id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `134839472` |
| `data.recPlaylist[].playlist.name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `车载奢靡享受G/Deep House深度灵魂慢摇` |
| `data.recPlaylist[].playlist.playCount` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `51285188` |
| `data.recPlaylist[].playlist.specialType` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `doesNotCache` | boolean | 1 | 0 | 0 | AUTH_NONE | `true` |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `success` |
