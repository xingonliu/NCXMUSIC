# ncm.personalized_newsong / personalized_newsong

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`45ff8ae4cdd407852a88726fc82bc85a2b76a6efd8956eb0526c2aeb9b7e839f`（pkg）
- 导出名：personalized_newsong
- 路由或调用方式：`/api/personalized/newsong`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：recommend / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/personalized_newsong.js（注释：推荐新歌）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/personalized/newsong
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| limit | string | 可选（默认 `10`） | 源码读取 query.limit |
| areaId | string | 可选（默认 `0`） | 源码读取 query.areaId |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId, playlistId
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

## 14. Phase 2 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.personalized_newsong.anon.001 | AUTH_ANON | - | 200 | 99 |  |
| ncm.personalized_newsong.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 128 |  |
| ncm.personalized_newsong.limit5.none.001 | AUTH_NONE | - | 200 | 124 |  |
| ncm.personalized_newsong.none.001 | AUTH_NONE | - | 200 | 82 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `category` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `result[].alg` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `server_doudi` |
| `result[].canDislike` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].copywriter` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3413127704` |
| `result[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `隐藏相册` |
| `result[].picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/y8ti3PoTDAh5ll6r` |
| `result[].song.album.alias` | array<unknown> | 8 | 0 | 8 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.album.alias[]` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Remix` |
| `result[].song.album.artist.albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.album.artist.briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artist.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.img1v1Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `result[].song.album.artist.musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artist.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artist.topicPerson` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artist.trans` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artists[].albumSize` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artists[].alias` | array<unknown> | 20 | 0 | 20 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.album.artists[].briefDesc` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artists[].id` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `49141872` |
| `result[].song.album.artists[].img1v1Id` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artists[].img1v1Url` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `result[].song.album.artists[].musicSize` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artists[].name` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Top Barry` |
| `result[].song.album.artists[].picId` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artists[].picUrl` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.artists[].topicPerson` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.artists[].trans` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.blurPicUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/y8ti3PoTDAh5ll6r` |
| `result[].song.album.briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_AL_3_389646494` |
| `result[].song.album.company` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.companyId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.gapless` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `389646494` |
| `result[].song.album.mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.album.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `隐藏相册` |
| `result[].song.album.onSale` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.album.pic` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173657422980` |
| `result[].song.album.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173657422980` |
| `result[].song.album.picId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173657422971` |
| `result[].song.album.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/y8ti3PoTDAh5ll6r` |
| `result[].song.album.publishTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1785340800000` |
| `result[].song.album.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.album.songs` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.album.status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.album.subType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `录音室版` |
| `result[].song.album.tags` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.album.transName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.album.type` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Single` |
| `result[].song.alias` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.alias[]` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Remix` |
| `result[].song.artists[].albumSize` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.artists[].alias` | array<unknown> | 20 | 0 | 20 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.artists[].briefDesc` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.artists[].id` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `49141872` |
| `result[].song.artists[].img1v1Id` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.artists[].img1v1Url` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `result[].song.artists[].musicSize` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.artists[].name` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Top Barry` |
| `result[].song.artists[].picId` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.artists[].picUrl` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.artists[].topicPerson` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.artists[].trans` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.audition` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.bMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `result[].song.bMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.bMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].song.bMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684165` |
| `result[].song.bMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.bMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.bMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2506413` |
| `result[].song.bMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.bMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-43902` |
| `result[].song.commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_SO_4_3413127704` |
| `result[].song.copyFrom` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.copyright` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.crbt` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.dayPlays` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.disc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `01` |
| `result[].song.duration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.fee` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `8` |
| `result[].song.ftype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.hearTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.hMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].song.hMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.hMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].song.hMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684156` |
| `result[].song.hMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.hMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.hMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `6265965` |
| `result[].song.hMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.hMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-48252` |
| `result[].song.hrMusic` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.hrMusic.bitrate` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1619840` |
| `result[].song.hrMusic.dfsId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.hrMusic.extension` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `flac` |
| `result[].song.hrMusic.id` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684161` |
| `result[].song.hrMusic.name` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.hrMusic.playTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.hrMusic.size` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `31710897` |
| `result[].song.hrMusic.sr` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.hrMusic.volumeDelta` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-48251` |
| `result[].song.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3413127704` |
| `result[].song.lMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `result[].song.lMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.lMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].song.lMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684165` |
| `result[].song.lMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.lMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.lMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2506413` |
| `result[].song.lMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.lMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-43902` |
| `result[].song.mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.mMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `192000` |
| `result[].song.mMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.mMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].song.mMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684159` |
| `result[].song.mMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.mMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.mMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3759597` |
| `result[].song.mMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.mMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-45634` |
| `result[].song.mp3Url` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.mvid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `隐藏相册` |
| `result[].song.no` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.noCopyrightRcmd` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.originCoverType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.originSongSimpleData` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.playedNum` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.popularity` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `result[].song.position` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.bd` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.chargeInfoList[].chargeMessage` | null | 36 | 36 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.chargeInfoList[].chargeType` | number | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.chargeInfoList[].chargeUrl` | null | 36 | 36 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.chargeInfoList[].rate` | number | 36 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `result[].song.privilege.code` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.cp` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.privilege.cs` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.privilege.dl` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.dlLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `result[].song.privilege.dlLevels` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.downloadMaxbr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result[].song.privilege.downloadMaxBrLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result[].song.privilege.fee` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `8` |
| `result[].song.privilege.fl` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].song.privilege.flag` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1544196` |
| `result[].song.privilege.flLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `exhigh` |
| `result[].song.privilege.freeTrialPrivilege.cannotListenReason` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.freeTrialPrivilege.freeLimitTagType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.freeTrialPrivilege.listenType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.freeTrialPrivilege.playReason` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.freeTrialPrivilege.resConsumable` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.privilege.freeTrialPrivilege.userConsumable` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.privilege.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3413127704` |
| `result[].song.privilege.ignoreCache` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.maxbr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result[].song.privilege.maxBrLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result[].song.privilege.message` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.payed` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.pl` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].song.privilege.playMaxbr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `result[].song.privilege.playMaxBrLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `result[].song.privilege.plLevel` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `exhigh` |
| `result[].song.privilege.plLevels` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.preSell` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.privilege.rightSource` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.rscl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.privilege.sp` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7` |
| `result[].song.privilege.st` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.privilege.subp` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].song.privilege.toast` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.publishTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1785340800000` |
| `result[].song.ringtone` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].song.rtUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.rtUrls` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].song.rtype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.rurl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.score` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `result[].song.sign` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.single` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.sqMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `855246` |
| `result[].song.sqMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.sqMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `flac` |
| `result[].song.sqMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16976684162` |
| `result[].song.sqMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].song.sqMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `156598` |
| `result[].song.sqMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16744156` |
| `result[].song.sqMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].song.sqMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-48251` |
| `result[].song.starred` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].song.starredNum` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].song.transName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].trackNumberUpdateTime` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].type` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
