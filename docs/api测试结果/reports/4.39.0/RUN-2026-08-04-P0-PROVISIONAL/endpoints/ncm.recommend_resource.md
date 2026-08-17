# ncm.recommend_resource / recommend_resource

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`c60687445d968c85cd3b62a71964ddb731bd4b73ce682d3e30adc4dffcc59df8`（pkg）
- 导出名：recommend_resource
- 路由或调用方式：`/api/v1/discovery/recommend/resource`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：recommend / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：user
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/recommend_resource.js（注释：每日推荐歌单）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/recommend/resource
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
- produces：songId, playlistId
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
| ncm.recommend_resource.anon.001 | AUTH_ANON | - | 200 | 184 |  |
| ncm.recommend_resource.inv.001 | AUTH_INVALID_EXPIRED | err | 301 | - | code 301 |
| ncm.recommend_resource.none.001 | AUTH_NONE | err | 301 | - | code 301 |
| ncm.recommend_resource.none.002 | AUTH_NONE | err | 301 | - | code 301 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `featureFirst` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `haveRcmdSongs` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `recommend[].alg` | string | 3 | 0 | 0 | AUTH_ANON | `byNewUserGroup_combine` |
| `recommend[].copywriter` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `recommend[].createTime` | number | 3 | 0 | 0 | AUTH_ANON | `1753875728770` |
| `recommend[].creator.accountStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.authority` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.authStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.avatarImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951167584339280` |
| `recommend[].creator.avatarImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951167584339278` |
| `recommend[].creator.avatarUrl` | string | 3 | 0 | 0 | AUTH_ANON | `https://p4.music.126.net/i_cBHCXeSx60dgg` |
| `recommend[].creator.backgroundImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951162868128400` |
| `recommend[].creator.backgroundImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951162868128395` |
| `recommend[].creator.backgroundUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p1.music.126.net/2zSNIqTcpHL2jIvU` |
| `recommend[].creator.birthday` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.city` | number | 3 | 0 | 0 | AUTH_ANON | `330100` |
| `recommend[].creator.defaultAvatar` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `recommend[].creator.description` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `recommend[].creator.detailDescription` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `recommend[].creator.djStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.expertTags` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `recommend[].creator.followed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `recommend[].creator.gender` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.mutual` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `recommend[].creator.nickname` | string | 3 | 0 | 0 | AUTH_ANON | `辅助做眼离奇失踪` |
| `recommend[].creator.province` | number | 3 | 0 | 0 | AUTH_ANON | `330000` |
| `recommend[].creator.remarkName` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `recommend[].creator.signature` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `recommend[].creator.userId` | number | 3 | 0 | 0 | AUTH_ANON | `7883273021` |
| `recommend[].creator.userType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].creator.vipType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `recommend[].id` | number | 3 | 0 | 0 | AUTH_ANON | `14060893769` |
| `recommend[].name` | string | 3 | 0 | 0 | AUTH_ANON | `循环百次的耐听歌曲推荐` |
| `recommend[].picUrl` | string | 3 | 0 | 0 | AUTH_ANON | `https://p4.music.126.net/35Beaf6W2IYrG4J` |
| `recommend[].playcount` | number | 3 | 0 | 0 | AUTH_ANON | `251372` |
| `recommend[].trackCount` | number | 3 | 0 | 0 | AUTH_ANON | `299` |
| `recommend[].type` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `recommend[].userId` | number | 3 | 0 | 0 | AUTH_ANON | `7883273021` |
