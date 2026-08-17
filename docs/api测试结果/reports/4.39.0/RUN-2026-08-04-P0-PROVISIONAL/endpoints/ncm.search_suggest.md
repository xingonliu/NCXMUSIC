# ncm.search_suggest / search_suggest

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`d400e46560aaed24d85b02d3d2d192d9a1f10b2b00dcb7a230dd008d39da371b`（pkg）
- 导出名：search_suggest
- 路由或调用方式：`/api/search/suggest/`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：search / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/search_suggest.js（注释：搜索建议）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/search/suggest
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| keywords | string | 可选（默认 ``） | 源码读取 query.keywords |
| type | string | 未发现默认值 | 源码读取 query.type |

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
| ncm.search_suggest.empty.none.neg.001 | AUTH_NONE | - | 400 | 56 |  |
| ncm.search_suggest.kw1.anon.001 | AUTH_ANON | - | 200 | 84 |  |
| ncm.search_suggest.kw1.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 104 |  |
| ncm.search_suggest.kw1.none.001 | AUTH_NONE | - | 200 | 86 |  |
| ncm.search_suggest.kw2.none.001 | AUTH_NONE | - | 200 | 264 |  |
| ncm.search_suggest.mobile.none.001 | AUTH_NONE | - | 200 | 109 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 6 | 0 | 0 | AUTH_NONE,AUTH_ANON,AUTH_INVALID_EXPIRED | `400` |
| `result.albums[].alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.albums[].artist.albumSize` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `57` |
| `result.albums[].artist.alia[]` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `result.albums[].artist.alias` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.albums[].artist.alias[]` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `result.albums[].artist.appendRecText` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.albums[].artist.fansGroup` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.albums[].artist.fansSize` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.albums[].artist.id` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `result.albums[].artist.img1v1` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.albums[].artist.img1v1Url` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/6y-UleORITEDbvr` |
| `result.albums[].artist.musicSize` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `420` |
| `result.albums[].artist.name` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `result.albums[].artist.picId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167773880640` |
| `result.albums[].artist.picUrl` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/fq1O8ZRT5_FHzg_` |
| `result.albums[].artist.recommendText` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.albums[].artist.trans` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.albums[].copyrightId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.albums[].id` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `result.albums[].mark` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.albums[].name` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.albums[].picId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `result.albums[].publishTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1483027200007` |
| `result.albums[].size` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.albums[].status` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.allMatch[].alg` | string | 3 | 0 | 0 | AUTH_NONE | `alg_suggest_other_Consume;Album;Song___{` |
| `result.allMatch[].feature` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.allMatch[].keyword` | string | 3 | 0 | 0 | AUTH_NONE | `光年之外` |
| `result.allMatch[].lastKeyword` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `result.allMatch[].type` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `result.artists[].albumSize` | number | 1 | 0 | 0 | AUTH_NONE | `41` |
| `result.artists[].alia[]` | string | 2 | 0 | 0 | AUTH_NONE | `Jay Chou` |
| `result.artists[].alias[]` | string | 2 | 0 | 0 | AUTH_NONE | `Jay Chou` |
| `result.artists[].appendRecText` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.artists[].fansGroup` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.artists[].fansSize` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.artists[].id` | number | 1 | 0 | 0 | AUTH_NONE | `6452` |
| `result.artists[].img1v1` | number | 1 | 0 | 0 | AUTH_NONE | `109951169164936940` |
| `result.artists[].img1v1Url` | string | 1 | 0 | 0 | AUTH_NONE | `https://p4.music.126.net/_ECPuM0s0qtWhkp` |
| `result.artists[].musicSize` | number | 1 | 0 | 0 | AUTH_NONE | `568` |
| `result.artists[].name` | string | 1 | 0 | 0 | AUTH_NONE | `周杰伦` |
| `result.artists[].picId` | number | 1 | 0 | 0 | AUTH_NONE | `109951169164936450` |
| `result.artists[].picUrl` | string | 1 | 0 | 0 | AUTH_NONE | `https://p3.music.126.net/NWv6PtSBkyWZzqb` |
| `result.artists[].recommendText` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.artists[].trans` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `result.order[]` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `songs` |
| `result.songs[].album.alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.songs[].album.artist.albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].album.artist.appendRecText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.artist.fansGroup` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.artist.fansSize` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.artist.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.img1v1` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/6y-UleORITEDbvr` |
| `result.songs[].album.artist.musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result.songs[].album.artist.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.artist.picUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.artist.recommendText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.artist.trans` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].album.copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `result.songs[].album.mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].album.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].album.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `result.songs[].album.publishTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1483027200007` |
| `result.songs[].album.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].album.status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].alias` | array<unknown> | 8 | 0 | 8 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].alias[]` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `result.songs[].artists[].albumSize` | number | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].alias` | array<unknown> | 19 | 0 | 19 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result.songs[].artists[].appendRecText` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].artists[].fansGroup` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].artists[].fansSize` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].artists[].id` | number | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `result.songs[].artists[].img1v1` | number | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].img1v1Url` | string | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/6y-UleORITEDbvr` |
| `result.songs[].artists[].musicSize` | number | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].name` | string | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `result.songs[].artists[].picId` | number | 19 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].artists[].picUrl` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].artists[].recommendText` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].artists[].trans` | null | 19 | 19 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1415926` |
| `result.songs[].duration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `235505` |
| `result.songs[].fee` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result.songs[].ftype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `result.songs[].mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17179877376` |
| `result.songs[].mvid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5404646` |
| `result.songs[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `result.songs[].rtype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result.songs[].rUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result.songs[].status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
