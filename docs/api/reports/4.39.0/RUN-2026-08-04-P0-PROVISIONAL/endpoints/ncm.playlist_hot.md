# ncm.playlist_hot / playlist_hot

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`db9e93e334924222d9c57f68b1c4c111117bcc65761a23c5a448c66eb41387d4`（pkg）
- 导出名：playlist_hot
- 路由或调用方式：`/api/playlist/hottags`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：playlist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/playlist_hot.js（注释：热门歌单分类）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/playlist/hot
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
- produces：playlistId, trackId
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
| ncm.playlist_hot.anon.001 | AUTH_ANON | - | 200 | 61 |  |
| ncm.playlist_hot.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 50 |  |
| ncm.playlist_hot.none.001 | AUTH_NONE | - | 200 | 57 |  |
| ncm.playlist_hot.none.002 | AUTH_NONE | - | 200 | 51 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `tags[].activity` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `tags[].category` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `tags[].createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1378707544870` |
| `tags[].hot` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `tags[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5001` |
| `tags[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `tags[].playlistTag.category` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `tags[].playlistTag.createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1378707544870` |
| `tags[].playlistTag.highQuality` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].playlistTag.highQualityPos` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].playlistTag.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5001` |
| `tags[].playlistTag.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `tags[].playlistTag.officialPos` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].playlistTag.position` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].playlistTag.type` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `tags[].playlistTag.usedCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10491198` |
| `tags[].position` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].type` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `tags[].usedCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10491198` |
