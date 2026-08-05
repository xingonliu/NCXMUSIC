# ncm.video_category_list / video_category_list

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`4cd2fe445dee678090869fb70987ecac0d123cd18f739ca0f74656e293518057`（pkg）
- 导出名：video_category_list
- 路由或调用方式：`/api/cloudvideo/category/list`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：video / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/video_category_list.js（注释：视频分类列表）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/video/category/list
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |
| limit | string | 可选（默认 `99`） | 源码读取 query.limit |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：videoId
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

## 13. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: 未登录层 301 系统错误（接口需会话）；AUTH_ANON（游客 cookie）可满足（200）；AUTH_USER 层待补）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.video_category_list.anon.001 | AUTH_ANON | - | 200 | 71 |  |
| ncm.video_category_list.inv.001 | AUTH_INVALID_EXPIRED | err | 301 | - | code 301 |
| ncm.video_category_list.none.001 | AUTH_NONE | err | 301 | - | code 301 |
| ncm.video_category_list.none.002 | AUTH_NONE | err | 301 | - | code 301 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `data[].abExtInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data[].id` | number | 3 | 0 | 0 | AUTH_ANON | `58100` |
| `data[].name` | string | 3 | 0 | 0 | AUTH_ANON | `现场` |
| `data[].relatedVideoType` | string | 3 | 0 | 0 | AUTH_ANON | `TRANSVERSE` |
| `data[].selectTab` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `data[].url` | union<null|string> | 3 | 2 | 0 | AUTH_ANON | `` |
| `message` | string | 1 | 0 | 0 | AUTH_ANON | `success` |
