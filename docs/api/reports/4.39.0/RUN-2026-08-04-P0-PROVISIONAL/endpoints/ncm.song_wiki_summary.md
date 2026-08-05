# ncm.song_wiki_summary / song_wiki_summary

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`bfecfcd2527b94137a39493c25e38d5c6e5bf215c067c1fc96e739a7fed104b0`（pkg）
- 导出名：song_wiki_summary
- 路由或调用方式：`/api/song/play/about/block/page`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：song / rare
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/song_wiki_summary.js（注释：音乐百科基础信息）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/song/wiki/summary
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：songId
- produces：songId
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
| ncm.song_wiki_summary.anon.001 | AUTH_ANON | - | 200 | 211 |  |
| ncm.song_wiki_summary.id0.none.neg.001 | AUTH_NONE | - | 200 | 114 |  |
| ncm.song_wiki_summary.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 185 |  |
| ncm.song_wiki_summary.none.001 | AUTH_NONE | - | 200 | 182 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `data.blocks[].adInfo` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].alg` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `data.blocks[].blockConfig` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].blockCursor` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].blockParam` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].canRefresh` | boolean | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `data.blocks[].channel` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `SONG_PLAY_ABOUT_TAB_SIM_CHANNEL` |
| `data.blocks[].code` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `SONG_PLAY_ABOUT_MUSIC_MEMORY` |
| `data.blocks[].creatives` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `undefined` |
| `data.blocks[].creatives[].action` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].adInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].blockId` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].code` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].creativeId` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].creativeType` | union<string|null> | 12 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `songTag` |
| `data.blocks[].creatives[].id` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].position` | union<null|string> | 12 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9999` |
| `data.blocks[].creatives[].resources` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].creatives[].resources[].action` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].alg` | union<null|string> | 24 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `alg-music-rec-pp-sim_song-si-I2I` |
| `data.blocks[].creatives[].resources[].resourceExt` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceExt.musicMemoryTextType` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].resourceExt.specialType` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].resourceExtInfo` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceId` | union<null|string> | 24 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1827600686` |
| `data.blocks[].creatives[].resources[].resourcePolicyId` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceType` | string | 24 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `melody_style` |
| `data.blocks[].creatives[].resources[].resourceUrl` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].scm` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.buttons` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.colorList` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.coverTagVO` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.descriptions` | null | 21 | 21 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.descriptions[].description` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `求你别离开我` |
| `data.blocks[].creatives[].resources[].uiElement.descriptions[].tag` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.icons` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].action` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].height` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].uiElement.images[].imageId` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].uiElement.images[].imageUrl` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/9FhSEQtMhP-JP3_U` |
| `data.blocks[].creatives[].resources[].uiElement.images[].imageWithoutTextUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].md5` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].superscript` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].tag` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].title` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.images[].width` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].uiElement.labels` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.action` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.action.clickAction.action` | number | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.action.clickAction.targetUrl` | string | 15 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://rnpage?resId=rn-genre&componen` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.title` | string | 24 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `原声带-电影原声` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.titleImgId` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.titleImgUrl` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.subTitles` | null | 15 | 15 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.subTitles[].action` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.subTitles[].title` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `林达浪/h3R3` |
| `data.blocks[].creatives[].resources[].uiElement.subTitles[].titleImgId` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.subTitles[].titleImgUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.superscript` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.textLinks` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.type` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.videos` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].valid` | boolean | 24 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.blocks[].creatives[].resources[].visibleStatus` | null | 24 | 24 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.buttons` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.colorList` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.coverTagVO` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.descriptions` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.icons` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.images` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.labels` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.mainTitle.action` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.mainTitle.title` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `曲风` |
| `data.blocks[].creatives[].uiElement.mainTitle.titleImgId` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.mainTitle.titleImgUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.subTitles` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.superscript` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.textLinks` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.textLinks[].tag` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.textLinks[].text` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `国语` |
| `data.blocks[].creatives[].uiElement.textLinks[].url` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.type` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].uiElement.videos` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].crossPlatformConfig` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].extInfo` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].hasMore` | boolean | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `data.blocks[].hideTitle` | boolean | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `data.blocks[].id` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `35999e58003240d3bff559b6bc1da946` |
| `data.blocks[].md5` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].opRcmd` | number | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `data.blocks[].position` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `5` |
| `data.blocks[].scm` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `data.blocks[].showType` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `MUSIC_MEMORY_MULTI_TWO_GRID` |
| `data.blocks[].uiElement.buttons` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.colorList` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.coverTagVO` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.descriptions` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.icons` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.images` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.images[].action` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].height` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].uiElement.images[].imageId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].uiElement.images[].imageUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/fkqFqMaEt0CzxYS-` |
| `data.blocks[].uiElement.images[].imageWithoutTextUrl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].md5` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].superscript` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].tag` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].title` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.images[].width` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].uiElement.labels` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.mainTitle.action` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.mainTitle.title` | string | 10 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `回忆坐标` |
| `data.blocks[].uiElement.mainTitle.titleImgId` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.mainTitle.titleImgUrl` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.subTitles` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.subTitles[].action.clickAction.action` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.blocks[].uiElement.subTitles[].action.clickAction.targetUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://rnpage?component=music-pedia-r` |
| `data.blocks[].uiElement.subTitles[].title` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `全部` |
| `data.blocks[].uiElement.subTitles[].titleImgId` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.subTitles[].titleImgUrl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.superscript` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.textLinks` | null | 7 | 7 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].uiElement.textLinks[].tag` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.textLinks[].text` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `参与共建` |
| `data.blocks[].uiElement.textLinks[].url` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://music.163.com/st/musicwiki/pedia` |
| `data.blocks[].uiElement.type` | union<null|string> | 10 | 7 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `data.blocks[].uiElement.videos` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.blocks[].visibleStatus` | null | 10 | 10 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.cursor` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `{"SONG_PLAY_ABOUT_TAB_SIM_CHANNEL":"{\"b` |
| `data.hasMore` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `data.pageCodeContext` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `data.pageConfig` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
