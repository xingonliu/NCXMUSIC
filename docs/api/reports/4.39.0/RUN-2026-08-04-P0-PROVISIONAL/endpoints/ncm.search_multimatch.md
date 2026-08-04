# ncm.search_multimatch / search_multimatch

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`a37c892438f8c7b159339a6be9992f274a5c8a1c11025e2c98c81017f06e4f02`（pkg）
- 导出名：search_multimatch
- 路由或调用方式：`/api/search/suggest/multimatch`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：search / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/search_multimatch.js（注释：多类型搜索）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/search/multimatch
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| type | string | 可选（默认 `1`） | 源码读取 query.type |
| keywords | string | 可选（默认 ``） | 源码读取 query.keywords |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
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
| ncm.search_multimatch.empty.none.neg.001 | AUTH_NONE | - | 400 | 92 |  |
| ncm.search_multimatch.kw1.anon.001 | AUTH_ANON | - | 200 | 85 |  |
| ncm.search_multimatch.kw1.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 74 |  |
| ncm.search_multimatch.kw1.none.001 | AUTH_NONE | - | 200 | 60 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `400` |
| `result.orders` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
