# ncm.dj_category_excludehot / dj_category_excludehot

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`93ae08ebe30f89ec396f121dc0b66fa4a66eca147b804dc327c8487bfd9c1760`（pkg）
- 导出名：dj_category_excludehot
- 路由或调用方式：`/api/djradio/category/excludehot`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：dj / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P2
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/dj_category_excludehot.js（注释：电台非热门类型）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/dj/category/excludehot
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
- produces：djId, programId, radioId
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
| ncm.dj_category_excludehot.anon.001 | AUTH_ANON | - | 200 | 271 |  |
| ncm.dj_category_excludehot.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 69 |  |
| ncm.dj_category_excludehot.none.001 | AUTH_NONE | - | 200 | 55 |  |
| ncm.dj_category_excludehot.none.002 | AUTH_NONE | - | 200 | 63 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `data[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `11` |
| `data[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `知识` |
| `data[].pic56x56Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108734880` |
| `data[].pic56x56IdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108734873` |
| `data[].pic56x56Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/S7xbLcLVSQKbw-a` |
| `data[].pic84x84Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108736830` |
| `data[].pic84x84IdUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/GPd3Pk-XtKekwuX` |
| `data[].pic96x96Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108737810` |
| `data[].pic96x96IdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108737806` |
| `data[].pic96x96Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/7F0vZQ4D3jaUDhM` |
| `data[].picIPad` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108740640` |
| `data[].picIPadStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108740646` |
| `data[].picIPadUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/iwe1bKXrqE5nhUW` |
| `data[].picMacId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108743077` |
| `data[].picMacUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/BkDGDDGmuzJYrQJ` |
| `data[].picPCBlack` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108742600` |
| `data[].picPCBlackStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108742588` |
| `data[].picPCBlackUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/lgaPhsLoAANtHH7` |
| `data[].picPCWhite` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108742100` |
| `data[].picPCWhiteStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108742099` |
| `data[].picPCWhiteUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/4Pg6ZQ0eZ-xou1c` |
| `data[].picUWPId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108736879` |
| `data[].picUWPUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/Schoe7YN5LN9IJJ` |
| `data[].picWeb` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108735870` |
| `data[].picWebStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951166108735875` |
| `data[].picWebUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/wOmtE80i2EMG2dR` |
