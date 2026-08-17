# ncm.artist_mv / artist_mv

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`041bf1c2376422439aa6fdd35a820d4591ce7b2d52a539e06ed9160479805e65`（pkg）
- 导出名：artist_mv
- 路由或调用方式：`/api/artist/mvs`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_mv.js（注释：歌手相关MV）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/mv
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |
| limit | string | 未发现默认值 | 源码读取 query.limit |
| offset | string | 未发现默认值 | 源码读取 query.offset |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：artistId, pageToken
- produces：artistId, mvId
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

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.artist_mv.anon.001 | AUTH_ANON | - | 200 | 86 |  |
| ncm.artist_mv.id0.none.neg.001 | AUTH_NONE | - | 200 | 84 |  |
| ncm.artist_mv.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 72 |  |
| ncm.artist_mv.none.001 | AUTH_NONE | - | 200 | 72 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `hasMore` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `mvs[].artist.albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `mvs[].artist.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `mvs[].artist.briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `mvs[].artist.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `7763` |
| `mvs[].artist.img1v1Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `18686200114669624` |
| `mvs[].artist.img1v1Id_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `18686200114669622` |
| `mvs[].artist.img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p3.music.126.net/VnZiScyynLG7atLI` |
| `mvs[].artist.musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `mvs[].artist.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `G.E.M.邓紫棋` |
| `mvs[].artist.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `mvs[].artist.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `mvs[].artist.topicPerson` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `mvs[].artist.trans` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `mvs[].artistName` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `G.E.M.邓紫棋` |
| `mvs[].duration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `14000` |
| `mvs[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `34724956` |
| `mvs[].imgurl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p3.music.126.net/jJrv-_D3U9VI_ZFR` |
| `mvs[].imgurl16v9` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p4.music.126.net/2SLY7ajwbrpJjzpN` |
| `mvs[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `G.E.M.邓紫棋为大家送来了2026马年祝福` |
| `mvs[].playCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `125627` |
| `mvs[].publishTime` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `2026-02-16` |
| `mvs[].status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `mvs[].subed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `time` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1663603208458` |
