# ncm.artist_album / artist_album

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`1db0660a631daa9ba64d82b2ab21c75fce7ddf3191e23d3a440ec4e9cc93c6c6`（pkg）
- 导出名：artist_album
- 路由或调用方式：`/api/artist/albums/${query.id} (templated)`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_album.js（注释：歌手专辑列表）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/album
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| limit | string | 可选（默认 `30`） | 源码读取 query.limit |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |
| id | string | 未发现默认值 | 源码读取 query.id |

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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 缺失（B-002，写操作已预授权但账号未到位））

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.artist_album.anon.001 | AUTH_ANON | - | 200 | 107 |  |
| ncm.artist_album.id0.none.neg.001 | AUTH_NONE | err | 404 | - | code 404 |
| ncm.artist_album.inv.001 | AUTH_INVALID_EXPIRED | err | -462 | - | code -462 |
| ncm.artist_album.none.001 | AUTH_NONE | - | 200 | 79 |  |
| ncm.artist_album.page.none.001 | AUTH_NONE | - | 200 | 82 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `artist.albumSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `61` |
| `artist.alias[]` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_NONE | `G.E.M.` |
| `artist.briefDesc` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `artist.followed` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `artist.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `7763` |
| `artist.img1v1Id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167771736530` |
| `artist.img1v1Id_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167771736533` |
| `artist.img1v1Url` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p4.music.126.net/oJorrgJ3IotZUAb` |
| `artist.musicSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `420` |
| `artist.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `G.E.M.邓紫棋` |
| `artist.picId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167773880640` |
| `artist.picId_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951167773880633` |
| `artist.picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p4.music.126.net/fq1O8ZRT5_FHzg_` |
| `artist.topicPerson` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `artist.trans` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `200` |
| `hotAlbums[].alias` | array<unknown> | 7 | 0 | 7 | AUTH_ANON,AUTH_NONE | `undefined` |
| `hotAlbums[].alias[]` | string | 2 | 0 | 0 | AUTH_ANON,AUTH_NONE | `2025英雄联盟全球总决赛主题曲` |
| `hotAlbums[].artist.albumSize` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `365` |
| `hotAlbums[].artist.alias[]` | string | 14 | 0 | 0 | AUTH_ANON,AUTH_NONE | `英雄联盟` |
| `hotAlbums[].artist.briefDesc` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].artist.followed` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotAlbums[].artist.id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1047337` |
| `hotAlbums[].artist.img1v1Id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `18686200114669624` |
| `hotAlbums[].artist.img1v1Id_str` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `18686200114669622` |
| `hotAlbums[].artist.img1v1Url` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p4.music.126.net/VnZiScyynLG7atL` |
| `hotAlbums[].artist.musicSize` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1380` |
| `hotAlbums[].artist.name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `英雄联盟` |
| `hotAlbums[].artist.picId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951165103609060` |
| `hotAlbums[].artist.picId_str` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951165103609061` |
| `hotAlbums[].artist.picUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p4.music.126.net/sRVN7yqE0Ja-dDX` |
| `hotAlbums[].artist.topicPerson` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].artist.trans` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `League Of Legends` |
| `hotAlbums[].artist.transNames[]` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `League Of Legends` |
| `hotAlbums[].artists[].albumSize` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].artists[].alias` | array<unknown> | 21 | 0 | 21 | AUTH_ANON,AUTH_NONE | `undefined` |
| `hotAlbums[].artists[].briefDesc` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].artists[].followed` | boolean | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotAlbums[].artists[].id` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1047337` |
| `hotAlbums[].artists[].img1v1Id` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `18686200114669624` |
| `hotAlbums[].artists[].img1v1Id_str` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `18686200114669622` |
| `hotAlbums[].artists[].img1v1Url` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p3.music.126.net/VnZiScyynLG7atL` |
| `hotAlbums[].artists[].musicSize` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].artists[].name` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `英雄联盟` |
| `hotAlbums[].artists[].picId` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].artists[].picUrl` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].artists[].topicPerson` | number | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].artists[].trans` | string | 21 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].awardTags` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotAlbums[].blurPicUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p3.music.126.net/zizkZ3dTnwmO31W` |
| `hotAlbums[].briefDesc` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].commentThreadId` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `R_AL_3_351088947` |
| `hotAlbums[].company` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Riot Games` |
| `hotAlbums[].companyId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `0` |
| `hotAlbums[].copyrightId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1416512` |
| `hotAlbums[].description` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].displayTags` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_NONE |  |
| `hotAlbums[].id` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `351088947` |
| `hotAlbums[].isSub` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `hotAlbums[].mark` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `8320` |
| `hotAlbums[].name` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Sacrifice (Anyma Remix)` |
| `hotAlbums[].onSale` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotAlbums[].paid` | boolean | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `false` |
| `hotAlbums[].pic` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951172317017230` |
| `hotAlbums[].picId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951172317017230` |
| `hotAlbums[].picId_str` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `109951172317017230` |
| `hotAlbums[].picUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `https://p4.music.126.net/zizkZ3dTnwmO31W` |
| `hotAlbums[].publishTime` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1763654400000` |
| `hotAlbums[].size` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `hotAlbums[].songs` | array<unknown> | 9 | 0 | 9 | AUTH_ANON,AUTH_NONE | `undefined` |
| `hotAlbums[].status` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `1` |
| `hotAlbums[].subType` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Remix` |
| `hotAlbums[].tags` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `` |
| `hotAlbums[].transNames[]` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE | `争` |
| `hotAlbums[].type` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_NONE | `Single` |
| `kindTabs` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_NONE |  |
| `more` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_NONE | `true` |
