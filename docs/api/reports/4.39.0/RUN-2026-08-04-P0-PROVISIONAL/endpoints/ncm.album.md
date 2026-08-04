# ncm.album / album

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`c7a2981784dcfd5f56196f3df3697545238f975c04956a9488bcfd2a328336af`（pkg）
- 导出名：album
- 路由或调用方式：`/api/v1/album/${query.id} (templated)`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：album / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/album.js（注释：专辑内容）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/album
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：albumId
- produces：albumId, songId
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

## 15. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.album.anon.001 | AUTH_ANON | - | 200 | 107 |  |
| ncm.album.id0.none.neg.001 | AUTH_NONE | err | 404 | - | code 404 |
| ncm.album.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 115 |  |
| ncm.album.none.001 | AUTH_NONE | - | 200 | 100 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `album.alias[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `album.artist.albumSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `57` |
| `album.artist.alias[]` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `album.artist.briefDesc` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.artist.followed` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `album.artist.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `album.artist.img1v1Id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167771736530` |
| `album.artist.img1v1Id_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167771736533` |
| `album.artist.img1v1Url` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/oJorrgJ3IotZUAb` |
| `album.artist.musicSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `420` |
| `album.artist.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `album.artist.picId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167773880640` |
| `album.artist.picId_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951167773880633` |
| `album.artist.picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/fq1O8ZRT5_FHzg_` |
| `album.artist.topicPerson` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.artist.trans` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.artists[].albumSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.artists[].alias` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `album.artists[].briefDesc` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.artists[].followed` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `album.artists[].id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `album.artists[].img1v1Id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18686200114669624` |
| `album.artists[].img1v1Id_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18686200114669622` |
| `album.artists[].img1v1Url` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/VnZiScyynLG7atL` |
| `album.artists[].musicSize` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.artists[].name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `album.artists[].picId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.artists[].picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.artists[].topicPerson` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.artists[].trans` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.awardTags` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.blurPicUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p4.music.126.net/fkqFqMaEt0CzxYS` |
| `album.briefDesc` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.commentThreadId` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_AL_3_35093341` |
| `album.company` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `蜂鸟音乐` |
| `album.companyId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.copyrightId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.description` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `《光年以外》是年度科幻巨制电影《太空旅客》的中文主题曲，G.E.M.邓紫棋为其填` |
| `album.displayTags` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `album.info.commentCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `811` |
| `album.info.comments` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.commentThread.commentCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `811` |
| `album.info.commentThread.hotCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `33` |
| `album.info.commentThread.id` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_AL_3_35093341` |
| `album.info.commentThread.latestLikedUsers` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `album.info.commentThread.likedCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.info.commentThread.resourceId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `album.info.commentThread.resourceInfo.creator` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.commentThread.resourceInfo.encodedId` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.commentThread.resourceInfo.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `album.info.commentThread.resourceInfo.imgUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/fkqFqMaEt0CzxYS-` |
| `album.info.commentThread.resourceInfo.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `album.info.commentThread.resourceInfo.subTitle` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.commentThread.resourceInfo.userId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-1` |
| `album.info.commentThread.resourceInfo.webUrl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.commentThread.resourceOwnerId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-1` |
| `album.info.commentThread.resourceTitle` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `album.info.commentThread.resourceType` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3` |
| `album.info.commentThread.shareCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2020` |
| `album.info.latestLikedUsers` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `album.info.liked` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `album.info.likedCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.info.resourceId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `album.info.resourceType` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3` |
| `album.info.shareCount` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2020` |
| `album.info.threadId` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_AL_3_35093341` |
| `album.mark` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `album.onSale` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `album.paid` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `album.pic` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `album.picId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `album.picId_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235039` |
| `album.picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/fkqFqMaEt0CzxYS` |
| `album.publishTime` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1483027200007` |
| `album.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `album.songs` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `album.status` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `album.subType` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `录音室版` |
| `album.tags` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `album.type` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Single` |
| `code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `resourceState` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `songs[].a` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].al.alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `songs[].al.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `35093341` |
| `songs[].al.name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `songs[].al.pic` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235040` |
| `songs[].al.pic_str` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18587244069235039` |
| `songs[].al.picUrl` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p3.music.126.net/fkqFqMaEt0CzxYS` |
| `songs[].alia[]` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `电影《太空旅客》中文主题曲` |
| `songs[].ar[].alia[]` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.` |
| `songs[].ar[].id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7763` |
| `songs[].ar[].name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `G.E.M.邓紫棋` |
| `songs[].artistClassics` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].cd` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].cf` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `songs[].cp` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1415926` |
| `songs[].crbt` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].djId` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].dt` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `235505` |
| `songs[].fee` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].ftype` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].h.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `songs[].h.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].h.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9422933` |
| `songs[].h.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `songs[].h.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-44887` |
| `songs[].hr` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `songs[].l.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `songs[].l.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].l.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3769199` |
| `songs[].l.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `songs[].l.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-40588` |
| `songs[].m.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `192000` |
| `songs[].m.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].m.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5653777` |
| `songs[].m.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `songs[].m.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-42341` |
| `songs[].mark` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17179877376` |
| `songs[].mst` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9` |
| `songs[].mv` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5404646` |
| `songs[].name` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `光年之外` |
| `songs[].no` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].noCopyrightRcmd` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].pop` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `100` |
| `songs[].privilege.bd` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.chargeInfoList[].chargeMessage` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.chargeInfoList[].chargeType` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].privilege.chargeInfoList[].chargeUrl` | null | 9 | 9 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.chargeInfoList[].rate` | number | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `128000` |
| `songs[].privilege.code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.cp` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].privilege.cs` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `songs[].privilege.dl` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.dlLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `songs[].privilege.dlLevels` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.downloadMaxbr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `songs[].privilege.downloadMaxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `songs[].privilege.fee` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].privilege.fl` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.flag` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1541124` |
| `songs[].privilege.flLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `songs[].privilege.freeTrialPrivilege.cannotListenReason` | union<number|null> | 3 | 2 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].privilege.freeTrialPrivilege.freeLimitTagType` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.freeTrialPrivilege.listenType` | union<number|null> | 3 | 2 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.freeTrialPrivilege.playReason` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.freeTrialPrivilege.resConsumable` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `songs[].privilege.freeTrialPrivilege.userConsumable` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `songs[].privilege.id` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `449818741` |
| `songs[].privilege.ignoreCache` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.maxbr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `songs[].privilege.maxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `songs[].privilege.message` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.payed` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.pl` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.playMaxbr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `999000` |
| `songs[].privilege.playMaxBrLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `jymaster` |
| `songs[].privilege.plLevel` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `none` |
| `songs[].privilege.plLevels` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.preSell` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `songs[].privilege.rightSource` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.rscl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].privilege.sp` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7` |
| `songs[].privilege.st` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].privilege.subp` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].privilege.toast` | boolean | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `songs[].pst` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].rt` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].rtUrl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].rtUrls` | array<unknown> | 3 | 0 | 3 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `songs[].rtype` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].rurl` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].songJumpInfo` | null | 3 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `songs[].sq.br` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `887395` |
| `songs[].sq.fid` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].sq.size` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `26123277` |
| `songs[].sq.sr` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `44100` |
| `songs[].sq.vd` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-45090` |
| `songs[].st` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `songs[].t` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `songs[].v` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `105` |
