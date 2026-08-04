# ncm.top_list / top_list

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`e605ccca326f8b5363855eb25f0a099088dc632e9070bfa6d1557937c73b5c51`（pkg）
- 导出名：top_list
- 路由或调用方式：`/api/playlist/v4/detail`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：toplist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/top_list.js（注释：排行榜）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/top/list
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| idx | string | 未发现默认值 | 源码读取 query.idx |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：（未指定）
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：songId
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

## 14. Phase 2 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 终态：**partial**（blocker: AUTH_USER 登录层缺失（账号待申请，见 B-002）；三态对比未完成）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.top_list.id.anon.001 | AUTH_ANON | - | 400 | 113 |  |
| ncm.top_list.id.inv.001 | AUTH_INVALID_EXPIRED | - | 400 | 95 |  |
| ncm.top_list.id.none.001 | AUTH_NONE | - | 400 | 77 |  |
| ncm.top_list.id.none.002 | AUTH_NONE | - | 200 | 132 |  |
| ncm.top_list.id0.none.neg.001 | AUTH_NONE | - | 400 | 84 |  |
| ncm.top_list.idx.none.neg.001 | AUTH_NONE | - | 500 | - |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `400` |
| `data` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `debugInfo` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `failData` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `请求参数错误` |
| `msg` | string | 5 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `请求参数错误` |
| `playlist.adType` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.algTags` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.backgroundCoverId` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.backgroundCoverUrl` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.bannedTrackIds` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.cloudTrackCount` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.commentCount` | number | 1 | 0 | 0 | AUTH_NONE | `98` |
| `playlist.commentThreadId` | string | 1 | 0 | 0 | AUTH_NONE | `A_PL_0_13940140402` |
| `playlist.copied` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.coverImgId` | number | 1 | 0 | 0 | AUTH_NONE | `109951173621885020` |
| `playlist.coverImgId_str` | string | 1 | 0 | 0 | AUTH_NONE | `109951173621885027` |
| `playlist.coverImgUrl` | string | 1 | 0 | 0 | AUTH_NONE | `https://p1.music.126.net/jmvu3sYDGdohJEe` |
| `playlist.coverStatus` | number | 1 | 0 | 0 | AUTH_NONE | `3` |
| `playlist.createTime` | number | 1 | 0 | 0 | AUTH_NONE | `1751871584770` |
| `playlist.creator.accountStatus` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.creator.anchor` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.creator.authenticationTypes` | number | 1 | 0 | 0 | AUTH_NONE | `532488` |
| `playlist.creator.authority` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.creator.authStatus` | number | 1 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.creator.avatarDetail.identityIconUrl` | string | 1 | 0 | 0 | AUTH_NONE | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `playlist.creator.avatarDetail.identityLevel` | number | 1 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.creator.avatarDetail.userType` | number | 1 | 0 | 0 | AUTH_NONE | `4` |
| `playlist.creator.avatarImgId` | number | 1 | 0 | 0 | AUTH_NONE | `109951165808890060` |
| `playlist.creator.avatarImgId_str` | string | 1 | 0 | 0 | AUTH_NONE | `109951165808890059` |
| `playlist.creator.avatarImgIdStr` | string | 1 | 0 | 0 | AUTH_NONE | `109951165808890059` |
| `playlist.creator.avatarUrl` | string | 1 | 0 | 0 | AUTH_NONE | `http://p1.music.126.net/yOvT76xxyTIIyHBJ` |
| `playlist.creator.backgroundImgId` | number | 1 | 0 | 0 | AUTH_NONE | `109951165935926540` |
| `playlist.creator.backgroundImgIdStr` | string | 1 | 0 | 0 | AUTH_NONE | `109951165935926545` |
| `playlist.creator.backgroundUrl` | string | 1 | 0 | 0 | AUTH_NONE | `http://p1.music.126.net/ZWlMvb9F7e_vVTHH` |
| `playlist.creator.birthday` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.creator.city` | number | 1 | 0 | 0 | AUTH_NONE | `650100` |
| `playlist.creator.defaultAvatar` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.creator.description` | string | 1 | 0 | 0 | AUTH_NONE | `` |
| `playlist.creator.detailDescription` | string | 1 | 0 | 0 | AUTH_NONE | `` |
| `playlist.creator.djStatus` | number | 1 | 0 | 0 | AUTH_NONE | `10` |
| `playlist.creator.experts` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.creator.expertTags` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.creator.followed` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.creator.gender` | number | 1 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.creator.mutual` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.creator.nickname` | string | 1 | 0 | 0 | AUTH_NONE | `Alimjan_Abdurezak阿力木江` |
| `playlist.creator.province` | number | 1 | 0 | 0 | AUTH_NONE | `650000` |
| `playlist.creator.remarkName` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.creator.signature` | string | 1 | 0 | 0 | AUTH_NONE | `新疆艺术学院优秀毕业生， 音乐学专业，五年制本科学习毕业。新疆流行音乐制作人，歌` |
| `playlist.creator.userId` | number | 1 | 0 | 0 | AUTH_NONE | `1661470704` |
| `playlist.creator.userType` | number | 1 | 0 | 0 | AUTH_NONE | `4` |
| `playlist.creator.vipType` | number | 1 | 0 | 0 | AUTH_NONE | `11` |
| `playlist.description` | string | 1 | 0 | 0 | AUTH_NONE | `那个被称作“神仙打架”的年代，华语乐坛的夜空仿佛被无数颗璀璨的星辰点亮。那是一个` |
| `playlist.detailPageTitle` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.displayTags` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.displayUserInfoAsTagOnly` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.distributeTags` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `playlist.englishTitle` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.gradeStatus` | string | 1 | 0 | 0 | AUTH_NONE | `NONE` |
| `playlist.highQuality` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.historySharedUsers` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.id` | number | 1 | 0 | 0 | AUTH_NONE | `13940140402` |
| `playlist.mix` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.mixInfo` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.mixPodcastPlaylist` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.mvResourceInfos` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.name` | string | 1 | 0 | 0 | AUTH_NONE | `华语封神100首｜神仙打架年代金曲全收录` |
| `playlist.newDetailPageRemixVideo` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.newImported` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.officialPlaylistType` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.opRecommend` | boolean | 1 | 0 | 0 | AUTH_NONE | `false` |
| `playlist.ordered` | boolean | 1 | 0 | 0 | AUTH_NONE | `true` |
| `playlist.playCount` | number | 1 | 0 | 0 | AUTH_NONE | `12932981` |
| `playlist.playlistType` | string | 1 | 0 | 0 | AUTH_NONE | `UGC` |
| `playlist.podcastTrackCount` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.privacy` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.promptedMgcInfo` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.relateResType` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.remixVideo` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.score` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.shareCount` | number | 1 | 0 | 0 | AUTH_NONE | `760` |
| `playlist.sharedUsers` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.specialType` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.status` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.subscribed` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.subscribedCount` | number | 1 | 0 | 0 | AUTH_NONE | `69303` |
| `playlist.subscribers` | array<unknown> | 1 | 0 | 1 | AUTH_NONE | `undefined` |
| `playlist.tags[]` | string | 3 | 0 | 0 | AUTH_NONE | `华语` |
| `playlist.titleImage` | number | 1 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.titleImageUrl` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.trackCount` | number | 1 | 0 | 0 | AUTH_NONE | `137` |
| `playlist.trackIds[].alg` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.trackIds[].at` | number | 3 | 0 | 0 | AUTH_NONE | `1751873715302` |
| `playlist.trackIds[].dpr` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.trackIds[].f` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.trackIds[].id` | number | 3 | 0 | 0 | AUTH_NONE | `287063` |
| `playlist.trackIds[].rcmdReason` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `playlist.trackIds[].rcmdReasonTitle` | string | 3 | 0 | 0 | AUTH_NONE | `编辑推荐` |
| `playlist.trackIds[].sc` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.trackIds[].sr` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.trackIds[].t` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.trackIds[].tr` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.trackIds[].uid` | number | 3 | 0 | 0 | AUTH_NONE | `1661470704` |
| `playlist.trackIds[].v` | number | 3 | 0 | 0 | AUTH_NONE | `534` |
| `playlist.trackNumberUpdateTime` | number | 1 | 0 | 0 | AUTH_NONE | `1785510680066` |
| `playlist.tracks[].a` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].additionalTitle` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].al.id` | number | 3 | 0 | 0 | AUTH_NONE | `28520` |
| `playlist.tracks[].al.name` | string | 3 | 0 | 0 | AUTH_NONE | `逆光` |
| `playlist.tracks[].al.pic` | number | 3 | 0 | 0 | AUTH_NONE | `109951173219336670` |
| `playlist.tracks[].al.pic_str` | string | 3 | 0 | 0 | AUTH_NONE | `109951173219336672` |
| `playlist.tracks[].al.picUrl` | string | 3 | 0 | 0 | AUTH_NONE | `http://p3.music.126.net/wF25xzePLml5EGUW` |
| `playlist.tracks[].al.tns` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `playlist.tracks[].alg` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].alia` | array<unknown> | 2 | 0 | 2 | AUTH_NONE | `undefined` |
| `playlist.tracks[].alia[]` | string | 1 | 0 | 0 | AUTH_NONE | `单元剧《上班女郎》主题曲` |
| `playlist.tracks[].ar[].alias` | array<unknown> | 4 | 0 | 4 | AUTH_NONE | `undefined` |
| `playlist.tracks[].ar[].id` | number | 4 | 0 | 0 | AUTH_NONE | `9272` |
| `playlist.tracks[].ar[].name` | string | 4 | 0 | 0 | AUTH_NONE | `孙燕姿` |
| `playlist.tracks[].ar[].tns` | array<unknown> | 4 | 0 | 4 | AUTH_NONE | `undefined` |
| `playlist.tracks[].awardTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].cd` | string | 3 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.tracks[].cf` | string | 3 | 0 | 0 | AUTH_NONE | `` |
| `playlist.tracks[].copyright` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.tracks[].cp` | number | 3 | 0 | 0 | AUTH_NONE | `7002` |
| `playlist.tracks[].crbt` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].displayReason` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].displayTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].djId` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].dt` | number | 3 | 0 | 0 | AUTH_NONE | `289066` |
| `playlist.tracks[].entertainmentTags` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].fee` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.tracks[].ftype` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].h.br` | number | 3 | 0 | 0 | AUTH_NONE | `320001` |
| `playlist.tracks[].h.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].h.size` | number | 3 | 0 | 0 | AUTH_NONE | `11564974` |
| `playlist.tracks[].h.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `playlist.tracks[].h.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-40869` |
| `playlist.tracks[].hr` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].id` | number | 3 | 0 | 0 | AUTH_NONE | `287063` |
| `playlist.tracks[].l.br` | number | 3 | 0 | 0 | AUTH_NONE | `128001` |
| `playlist.tracks[].l.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].l.size` | number | 3 | 0 | 0 | AUTH_NONE | `4626016` |
| `playlist.tracks[].l.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `playlist.tracks[].l.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-36730` |
| `playlist.tracks[].m.br` | number | 3 | 0 | 0 | AUTH_NONE | `192001` |
| `playlist.tracks[].m.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].m.size` | number | 3 | 0 | 0 | AUTH_NONE | `6939002` |
| `playlist.tracks[].m.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `playlist.tracks[].m.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-38326` |
| `playlist.tracks[].mainTitle` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].mark` | number | 3 | 0 | 0 | AUTH_NONE | `17179877376` |
| `playlist.tracks[].markTags` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `playlist.tracks[].mst` | number | 3 | 0 | 0 | AUTH_NONE | `9` |
| `playlist.tracks[].mv` | number | 3 | 0 | 0 | AUTH_NONE | `5484821` |
| `playlist.tracks[].name` | string | 3 | 0 | 0 | AUTH_NONE | `我怀念的` |
| `playlist.tracks[].no` | number | 3 | 0 | 0 | AUTH_NONE | `5` |
| `playlist.tracks[].noCopyrightRcmd` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].originCoverType` | number | 3 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.tracks[].originSongSimpleData` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].pop` | number | 3 | 0 | 0 | AUTH_NONE | `100` |
| `playlist.tracks[].pst` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].pubDJProgramData` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].publishTime` | number | 3 | 0 | 0 | AUTH_NONE | `1406822400000` |
| `playlist.tracks[].resourceState` | boolean | 3 | 0 | 0 | AUTH_NONE | `true` |
| `playlist.tracks[].rt` | string | 3 | 0 | 0 | AUTH_NONE | `600902000005652593` |
| `playlist.tracks[].rtUrl` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].rtUrls` | array<unknown> | 3 | 0 | 3 | AUTH_NONE | `undefined` |
| `playlist.tracks[].rtype` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].rurl` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].s_id` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].single` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].songFeature` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].songJumpInfo` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].sq.br` | number | 3 | 0 | 0 | AUTH_NONE | `836713` |
| `playlist.tracks[].sq.fid` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].sq.size` | number | 3 | 0 | 0 | AUTH_NONE | `30233251` |
| `playlist.tracks[].sq.sr` | number | 3 | 0 | 0 | AUTH_NONE | `44100` |
| `playlist.tracks[].sq.vd` | number | 3 | 0 | 0 | AUTH_NONE | `-40833` |
| `playlist.tracks[].st` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].t` | number | 3 | 0 | 0 | AUTH_NONE | `0` |
| `playlist.tracks[].tagPicList` | null | 3 | 3 | 0 | AUTH_NONE |  |
| `playlist.tracks[].v` | number | 3 | 0 | 0 | AUTH_NONE | `568` |
| `playlist.tracks[].version` | number | 3 | 0 | 0 | AUTH_NONE | `534` |
| `playlist.trackUpdateTime` | number | 1 | 0 | 0 | AUTH_NONE | `1785510699726` |
| `playlist.trialMode` | number | 1 | 0 | 0 | AUTH_NONE | `1` |
| `playlist.uiPlaylistType` | string | 1 | 0 | 0 | AUTH_NONE | `UGC` |
| `playlist.updateFrequency` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.updateTime` | number | 1 | 0 | 0 | AUTH_NONE | `1785771099354` |
| `playlist.userId` | number | 1 | 0 | 0 | AUTH_NONE | `1661470704` |
| `playlist.videoIds` | null | 1 | 1 | 0 | AUTH_NONE |  |
| `playlist.videos` | null | 1 | 1 | 0 | AUTH_NONE |  |
