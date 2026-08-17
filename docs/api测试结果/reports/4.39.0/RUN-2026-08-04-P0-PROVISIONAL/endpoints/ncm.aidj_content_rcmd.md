# ncm.aidj_content_rcmd / aidj_content_rcmd

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`aa940e83c49af5b1d57d2cd6962ecde64fbca9b58774977b388cec721ac9f428`（pkg）
- 导出名：aidj_content_rcmd
- 路由或调用方式：`/api/aidj/content/rcmd/info`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：other / rare
- 副作用级别：read
- 测试阶段（§6 优先级）：P2
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/aidj_content_rcmd.js（注释：私人 DJ）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/aidj/content/rcmd
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| latitude | string | 未发现默认值 | 源码读取 query.latitude |
| longitude | string | 未发现默认值 | 源码读取 query.longitude |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：（无）
- producer api / case / JSONPath：Phase 1 起由运行器填充

## 5. 测试矩阵

| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
（Phase 0 未执行；计划用例数 5）

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
| ncm.aidj_content_rcmd.anon.001 | AUTH_ANON | - | 200 | 280 |  |
| ncm.aidj_content_rcmd.inv.001 | AUTH_INVALID_EXPIRED | err | 500 | - | code 500 |
| ncm.aidj_content_rcmd.none.001 | AUTH_NONE | err | 500 | - | code 500 |
| ncm.aidj_content_rcmd.none.002 | AUTH_NONE | err | 500 | - | code 500 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `data.aiDjResources[].type` | string | 3 | 0 | 0 | AUTH_ANON | `audio` |
| `data.aiDjResources[].value.alg` | string | 1 | 0 | 0 | AUTH_ANON | `fm_rand_ns-aidj` |
| `data.aiDjResources[].value.audioList[].announcerName` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].audioId` | string | 2 | 0 | 0 | AUTH_ANON | `prompt_song_509951163339955915_173622097` |
| `data.aiDjResources[].value.audioList[].audioUrl` | string | 2 | 0 | 0 | AUTH_ANON | `http://aidj.music.126.net/20260806112127` |
| `data.aiDjResources[].value.audioList[].detailCategory` | string | 2 | 0 | 0 | AUTH_ANON | `主观评价，点评` |
| `data.aiDjResources[].value.audioList[].duration` | number | 2 | 0 | 0 | AUTH_ANON | `15.098776` |
| `data.aiDjResources[].value.audioList[].fadeInOut` | boolean | 2 | 0 | 0 | AUTH_ANON | `true` |
| `data.aiDjResources[].value.audioList[].gain` | number | 2 | 0 | 0 | AUTH_ANON | `-0.40294266` |
| `data.aiDjResources[].value.audioList[].includeVoice` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].introductionRelatedSongIds[]` | number | 2 | 0 | 0 | AUTH_ANON | `479219481` |
| `data.aiDjResources[].value.audioList[].lastSongSupportAudioSongId` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].modelType` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].nosKey` | string | 2 | 0 | 0 | AUTH_ANON | `jd-music-content-aidj/c6b4/5493/388b/37c` |
| `data.aiDjResources[].value.audioList[].peak` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.audioList[].poolCode` | string | 2 | 0 | 0 | AUTH_ANON | `prompt_song` |
| `data.aiDjResources[].value.audioList[].promptType` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].size` | number | 2 | 0 | 0 | AUTH_ANON | `363041` |
| `data.aiDjResources[].value.audioList[].textType` | string | 2 | 0 | 0 | AUTH_ANON | `乐评` |
| `data.aiDjResources[].value.audioList[].timbreKey` | string | 2 | 0 | 0 | AUTH_ANON | `M791-C2` |
| `data.aiDjResources[].value.audioList[].trp_id` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].trp_type` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.audioList[].validTime` | number | 2 | 0 | 0 | AUTH_ANON | `86399` |
| `data.aiDjResources[].value.includeVoice` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.album.alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.album.artist.albumSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artist.alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.album.artist.briefDesc` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artist.id` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artist.img1v1Id` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artist.img1v1Url` | string | 1 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `data.aiDjResources[].value.songData.album.artist.musicSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artist.name` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artist.picId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artist.picUrl` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artist.trans` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artists[].albumSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artists[].alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.album.artists[].briefDesc` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artists[].id` | number | 1 | 0 | 0 | AUTH_ANON | `12278356` |
| `data.aiDjResources[].value.songData.album.artists[].img1v1Id` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artists[].img1v1Url` | string | 1 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `data.aiDjResources[].value.songData.album.artists[].musicSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artists[].name` | string | 1 | 0 | 0 | AUTH_ANON | `Nohidea` |
| `data.aiDjResources[].value.songData.album.artists[].picId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.artists[].picUrl` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.artists[].trans` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.blurPicUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/qGZA9Po96JW1F6lk` |
| `data.aiDjResources[].value.songData.album.briefDesc` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.commentThreadId` | string | 1 | 0 | 0 | AUTH_ANON | `R_AL_3_35535159` |
| `data.aiDjResources[].value.songData.album.company` | string | 1 | 0 | 0 | AUTH_ANON | `Nohidea` |
| `data.aiDjResources[].value.songData.album.companyId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.copyrightId` | number | 1 | 0 | 0 | AUTH_ANON | `4588635` |
| `data.aiDjResources[].value.songData.album.description` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.id` | number | 1 | 0 | 0 | AUTH_ANON | `35535159` |
| `data.aiDjResources[].value.songData.album.name` | string | 1 | 0 | 0 | AUTH_ANON | `Blank Space` |
| `data.aiDjResources[].value.songData.album.pic` | number | 1 | 0 | 0 | AUTH_ANON | `109951165239367180` |
| `data.aiDjResources[].value.songData.album.picId` | number | 1 | 0 | 0 | AUTH_ANON | `109951165239367180` |
| `data.aiDjResources[].value.songData.album.picId_str` | string | 1 | 0 | 0 | AUTH_ANON | `109951165239367182` |
| `data.aiDjResources[].value.songData.album.picUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/qGZA9Po96JW1F6lk` |
| `data.aiDjResources[].value.songData.album.publishTime` | number | 1 | 0 | 0 | AUTH_ANON | `1495296000000` |
| `data.aiDjResources[].value.songData.album.size` | number | 1 | 0 | 0 | AUTH_ANON | `13` |
| `data.aiDjResources[].value.songData.album.songs` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.album.status` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.album.subType` | string | 1 | 0 | 0 | AUTH_ANON | `录音室版` |
| `data.aiDjResources[].value.songData.album.tags` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.album.transName` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.album.type` | string | 1 | 0 | 0 | AUTH_ANON | `专辑` |
| `data.aiDjResources[].value.songData.alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.artists[].albumSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.artists[].alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.artists[].briefDesc` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.artists[].id` | number | 1 | 0 | 0 | AUTH_ANON | `12278356` |
| `data.aiDjResources[].value.songData.artists[].img1v1Id` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.artists[].img1v1Url` | string | 1 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `data.aiDjResources[].value.songData.artists[].musicSize` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.artists[].name` | string | 1 | 0 | 0 | AUTH_ANON | `Nohidea` |
| `data.aiDjResources[].value.songData.artists[].picId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.artists[].picUrl` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.artists[].trans` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.audition` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.bMusic.bitrate` | number | 1 | 0 | 0 | AUTH_ANON | `128003` |
| `data.aiDjResources[].value.songData.bMusic.dfsId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.bMusic.extension` | string | 1 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.aiDjResources[].value.songData.bMusic.id` | number | 1 | 0 | 0 | AUTH_ANON | `7062033064` |
| `data.aiDjResources[].value.songData.bMusic.name` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.bMusic.playTime` | number | 1 | 0 | 0 | AUTH_ANON | `110031` |
| `data.aiDjResources[].value.songData.bMusic.size` | number | 1 | 0 | 0 | AUTH_ANON | `1761742` |
| `data.aiDjResources[].value.songData.bMusic.sr` | number | 1 | 0 | 0 | AUTH_ANON | `44100` |
| `data.aiDjResources[].value.songData.bMusic.volumeDelta` | number | 1 | 0 | 0 | AUTH_ANON | `-27733` |
| `data.aiDjResources[].value.songData.commentThreadId` | string | 1 | 0 | 0 | AUTH_ANON | `R_SO_4_479219481` |
| `data.aiDjResources[].value.songData.copyFrom` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `data.aiDjResources[].value.songData.copyright` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.copyrightId` | number | 1 | 0 | 0 | AUTH_ANON | `4588635` |
| `data.aiDjResources[].value.songData.crbt` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.dayPlays` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.disc` | string | 1 | 0 | 0 | AUTH_ANON | `1` |
| `data.aiDjResources[].value.songData.duration` | number | 1 | 0 | 0 | AUTH_ANON | `110031` |
| `data.aiDjResources[].value.songData.fee` | number | 1 | 0 | 0 | AUTH_ANON | `8` |
| `data.aiDjResources[].value.songData.ftype` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.hearTime` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.hMusic.bitrate` | number | 1 | 0 | 0 | AUTH_ANON | `320003` |
| `data.aiDjResources[].value.songData.hMusic.dfsId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.hMusic.extension` | string | 1 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.aiDjResources[].value.songData.hMusic.id` | number | 1 | 0 | 0 | AUTH_ANON | `7062033060` |
| `data.aiDjResources[].value.songData.hMusic.name` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.hMusic.playTime` | number | 1 | 0 | 0 | AUTH_ANON | `110031` |
| `data.aiDjResources[].value.songData.hMusic.size` | number | 1 | 0 | 0 | AUTH_ANON | `4404289` |
| `data.aiDjResources[].value.songData.hMusic.sr` | number | 1 | 0 | 0 | AUTH_ANON | `44100` |
| `data.aiDjResources[].value.songData.hMusic.volumeDelta` | number | 1 | 0 | 0 | AUTH_ANON | `-31836` |
| `data.aiDjResources[].value.songData.id` | number | 1 | 0 | 0 | AUTH_ANON | `479219481` |
| `data.aiDjResources[].value.songData.lMusic.bitrate` | number | 1 | 0 | 0 | AUTH_ANON | `128003` |
| `data.aiDjResources[].value.songData.lMusic.dfsId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.lMusic.extension` | string | 1 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.aiDjResources[].value.songData.lMusic.id` | number | 1 | 0 | 0 | AUTH_ANON | `7062033064` |
| `data.aiDjResources[].value.songData.lMusic.name` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.lMusic.playTime` | number | 1 | 0 | 0 | AUTH_ANON | `110031` |
| `data.aiDjResources[].value.songData.lMusic.size` | number | 1 | 0 | 0 | AUTH_ANON | `1761742` |
| `data.aiDjResources[].value.songData.lMusic.sr` | number | 1 | 0 | 0 | AUTH_ANON | `44100` |
| `data.aiDjResources[].value.songData.lMusic.volumeDelta` | number | 1 | 0 | 0 | AUTH_ANON | `-27733` |
| `data.aiDjResources[].value.songData.mMusic.bitrate` | number | 1 | 0 | 0 | AUTH_ANON | `192003` |
| `data.aiDjResources[].value.songData.mMusic.dfsId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.mMusic.extension` | string | 1 | 0 | 0 | AUTH_ANON | `mp3` |
| `data.aiDjResources[].value.songData.mMusic.id` | number | 1 | 0 | 0 | AUTH_ANON | `7062033062` |
| `data.aiDjResources[].value.songData.mMusic.name` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.mMusic.playTime` | number | 1 | 0 | 0 | AUTH_ANON | `110031` |
| `data.aiDjResources[].value.songData.mMusic.size` | number | 1 | 0 | 0 | AUTH_ANON | `2642591` |
| `data.aiDjResources[].value.songData.mMusic.sr` | number | 1 | 0 | 0 | AUTH_ANON | `44100` |
| `data.aiDjResources[].value.songData.mMusic.volumeDelta` | number | 1 | 0 | 0 | AUTH_ANON | `-29272` |
| `data.aiDjResources[].value.songData.mp3Url` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.mvid` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.name` | string | 1 | 0 | 0 | AUTH_ANON | `Butterflies` |
| `data.aiDjResources[].value.songData.no` | number | 1 | 0 | 0 | AUTH_ANON | `10` |
| `data.aiDjResources[].value.songData.playedNum` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.popularity` | number | 1 | 0 | 0 | AUTH_ANON | `100` |
| `data.aiDjResources[].value.songData.position` | number | 1 | 0 | 0 | AUTH_ANON | `10` |
| `data.aiDjResources[].value.songData.publishTime` | number | 1 | 0 | 0 | AUTH_ANON | `1494259200007` |
| `data.aiDjResources[].value.songData.ringtone` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.rtUrl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.rtUrls` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `data.aiDjResources[].value.songData.rtype` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.rurl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.score` | number | 1 | 0 | 0 | AUTH_ANON | `100` |
| `data.aiDjResources[].value.songData.sign` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songData.starred` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songData.starredNum` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.status` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songData.transName` | string | 1 | 0 | 0 | AUTH_ANON | `蝴蝶` |
| `data.aiDjResources[].value.songData.transNames[]` | string | 1 | 0 | 0 | AUTH_ANON | `蝴蝶` |
| `data.aiDjResources[].value.songId` | string | 1 | 0 | 0 | AUTH_ANON | `479219481` |
| `data.aiDjResources[].value.songPrivilege.bd` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.chargeInfoList[].chargeMessage` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.chargeInfoList[].chargeType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.chargeInfoList[].chargeUrl` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.chargeInfoList[].rate` | number | 3 | 0 | 0 | AUTH_ANON | `128000` |
| `data.aiDjResources[].value.songPrivilege.code` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.cp` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `data.aiDjResources[].value.songPrivilege.cs` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songPrivilege.dl` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.dlLevel` | string | 1 | 0 | 0 | AUTH_ANON | `none` |
| `data.aiDjResources[].value.songPrivilege.dlLevels` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.downloadMaxbr` | number | 1 | 0 | 0 | AUTH_ANON | `999000` |
| `data.aiDjResources[].value.songPrivilege.downloadMaxBrLevel` | string | 1 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.aiDjResources[].value.songPrivilege.fee` | number | 1 | 0 | 0 | AUTH_ANON | `8` |
| `data.aiDjResources[].value.songPrivilege.fl` | number | 1 | 0 | 0 | AUTH_ANON | `320000` |
| `data.aiDjResources[].value.songPrivilege.flag` | number | 1 | 0 | 0 | AUTH_ANON | `1540101` |
| `data.aiDjResources[].value.songPrivilege.flLevel` | string | 1 | 0 | 0 | AUTH_ANON | `exhigh` |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.cannotListenReason` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.freeLimitTagType` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.listenType` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.playReason` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.resConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songPrivilege.freeTrialPrivilege.userConsumable` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songPrivilege.id` | number | 1 | 0 | 0 | AUTH_ANON | `479219481` |
| `data.aiDjResources[].value.songPrivilege.ignoreCache` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.maxbr` | number | 1 | 0 | 0 | AUTH_ANON | `999000` |
| `data.aiDjResources[].value.songPrivilege.maxBrLevel` | string | 1 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.aiDjResources[].value.songPrivilege.message` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.paidBigBang` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songPrivilege.payed` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.pc` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.pl` | number | 1 | 0 | 0 | AUTH_ANON | `320000` |
| `data.aiDjResources[].value.songPrivilege.playMaxbr` | number | 1 | 0 | 0 | AUTH_ANON | `999000` |
| `data.aiDjResources[].value.songPrivilege.playMaxBrLevel` | string | 1 | 0 | 0 | AUTH_ANON | `jymaster` |
| `data.aiDjResources[].value.songPrivilege.plLevel` | string | 1 | 0 | 0 | AUTH_ANON | `exhigh` |
| `data.aiDjResources[].value.songPrivilege.plLevels` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.preSell` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.aiDjResources[].value.songPrivilege.realPayed` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.rightSource` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.rscl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `data.aiDjResources[].value.songPrivilege.sp` | number | 1 | 0 | 0 | AUTH_ANON | `7` |
| `data.aiDjResources[].value.songPrivilege.st` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `data.aiDjResources[].value.songPrivilege.subp` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `data.aiDjResources[].value.songPrivilege.toast` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `data.tagName` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `message` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `trp.rules[]` | string | 3 | 0 | 0 | AUTH_ANON | `aidj_greet_audio::*::linkPlatform$positi` |
