# ncm.simi_artist / simi_artist

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`db9f58140f368e5d0eeeb2497894471efc644ac7ad31d2faf90d99ee3934d01d`（pkg）
- 导出名：simi_artist
- 路由或调用方式：`/api/discovery/simiArtist`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：simi / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/simi_artist.js（注释：相似歌手）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/simi/artist
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：songId, artistId, playlistId, userId
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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.simi_artist.anon.001 | AUTH_ANON | - | 200 | 89 |  |
| ncm.simi_artist.id0.none.neg.001 | AUTH_NONE | err | 301 | - | code 301 |
| ncm.simi_artist.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.simi_artist.none.001 | AUTH_NONE | err | 301 | - | code 301 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `artists[].accountId` | union<null|number> | 3 | 2 | 0 | AUTH_ANON | `6228671` |
| `artists[].albumSize` | number | 3 | 0 | 0 | AUTH_ANON | `73` |
| `artists[].alg` | string | 3 | 0 | 0 | AUTH_ANON | `itembased` |
| `artists[].alias[]` | string | 4 | 0 | 0 | AUTH_ANON | `JJ Lin` |
| `artists[].briefDesc` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `artists[].fansCount` | number | 3 | 0 | 0 | AUTH_ANON | `16432276` |
| `artists[].followed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `artists[].id` | number | 3 | 0 | 0 | AUTH_ANON | `3684` |
| `artists[].identifyTag` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `artists[].img1v1Id` | number | 3 | 0 | 0 | AUTH_ANON | `109951168529049970` |
| `artists[].img1v1Id_str` | string | 3 | 0 | 0 | AUTH_ANON | `109951168529049969` |
| `artists[].img1v1Url` | string | 3 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/r6W-zCnV-aduVn_P` |
| `artists[].isSubed` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `artists[].musicSize` | number | 3 | 0 | 0 | AUTH_ANON | `598` |
| `artists[].mvSize` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `artists[].name` | string | 3 | 0 | 0 | AUTH_ANON | `林俊杰` |
| `artists[].picId` | number | 3 | 0 | 0 | AUTH_ANON | `109951168529051970` |
| `artists[].picId_str` | string | 3 | 0 | 0 | AUTH_ANON | `109951168529051968` |
| `artists[].picUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/78q0jUUJ0h08GxAs` |
| `artists[].publishTime` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `artists[].showPrivateMsg` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `artists[].topicPerson` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `artists[].trans` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `artists[].transNames` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
