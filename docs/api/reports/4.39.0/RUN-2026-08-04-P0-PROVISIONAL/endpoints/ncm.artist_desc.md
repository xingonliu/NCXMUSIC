# ncm.artist_desc / artist_desc

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`4d71a04cf64daa73dc8025e72e13a1d1ed2762e226ac35f0c7fa31b3ec637432`（pkg）
- 导出名：artist_desc
- 路由或调用方式：`/api/artist/introduction`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：artist / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/artist_desc.js（注释：歌手介绍）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/artist/desc
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| id | string | 未发现默认值 | 源码读取 query.id |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：artistId
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
| ncm.artist_desc.anon.001 | AUTH_ANON | - | 200 | 67 |  |
| ncm.artist_desc.id0.none.neg.001 | AUTH_NONE | err | 404 | - | code 404 |
| ncm.artist_desc.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 61 |  |
| ncm.artist_desc.none.001 | AUTH_NONE | - | 200 | 58 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `briefDesc` | string | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `邓紫棋（G.E.M.），本名邓诗颖，1991年8月16日出生于上海市，中国香港流` |
| `code` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `count` | number | 3 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `introduction[].ti` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `代表作品` |
| `introduction[].txt` | string | 9 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `泡沫、光年之外、来自天堂的魔鬼、句号、倒数、画、我的秘密、再见、多远都要在一起、` |
| `topicData[].addTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1500973322914` |
| `topicData[].categoryId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `topicData[].categoryName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `口袋乐评` |
| `topicData[].commentCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2777` |
| `topicData[].commentThreadId` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `A_TO_6_18550061` |
| `topicData[].coverUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/kQrjbW-Ipi81j1z9` |
| `topicData[].creator.accountStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.accountType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.anchor` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].creator.authenticated` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].creator.authenticationTypes` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.authority` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.authStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.avatarDetail` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].creator.avatarImgId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951163106156700` |
| `topicData[].creator.avatarUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/5yb4TeARG924Xpzb` |
| `topicData[].creator.backgroundImgId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2002210674180199` |
| `topicData[].creator.backgroundUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/VTW4vsN08vwL3uSQ` |
| `topicData[].creator.birthday` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `802022400000` |
| `topicData[].creator.city` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110101` |
| `topicData[].creator.createTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1470741806564` |
| `topicData[].creator.defaultAvatar` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].creator.description` | union<null|string> | 6 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `YOHO!GIRL官方账号` |
| `topicData[].creator.detailDescription` | union<null|string> | 6 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `YOHO!GIRL官方账号` |
| `topicData[].creator.djStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.experts` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].creator.expertTags` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].creator.followed` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].creator.gender` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `topicData[].creator.lastLoginIP` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `61.135.255.86` |
| `topicData[].creator.lastLoginTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1522229823516` |
| `topicData[].creator.locationStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `30` |
| `topicData[].creator.mutual` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].creator.nickname` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `Cutties` |
| `topicData[].creator.province` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110000` |
| `topicData[].creator.remarkName` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].creator.shortUserName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].creator.signature` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].creator.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `316704573` |
| `topicData[].creator.userName` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].creator.userType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.vipType` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].creator.viptypeVersion` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].id` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18550061` |
| `topicData[].liked` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].likedCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `9595` |
| `topicData[].mainTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
| `topicData[].memo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].number` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `topicData[].readCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `553454` |
| `topicData[].recmdContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，经历风雨后的邓紫棋愈加耀眼，相信下个9年，邓紫棋会变得更好~` |
| `topicData[].recmdTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
| `topicData[].rectanglePicUrl` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/yYzezuqmAYSez7wB` |
| `topicData[].relatedResource` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].reward` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].rewardCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].rewardMoney` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].seriesId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2490076` |
| `topicData[].shareContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].shareCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1403` |
| `topicData[].showComment` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `topicData[].showRelated` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `topicData[].summary` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，经历风雨后的邓紫棋愈加耀眼，相信下个9年，邓紫棋会变得更好~` |
| `topicData[].tags[]` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `邓紫棋` |
| `topicData[].title` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
| `topicData[].topic.addTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1500973294440` |
| `topicData[].topic.adInfo` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.auditor` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.auditStatus` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].topic.auditTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].topic.categoryId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `topicData[].topic.content[].content` | union<string|null> | 18 | 3 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `<p>7月10日是邓紫棋出道9周年的纪念日，邓紫棋也在微博中晒出了纪念日与蛋糕的` |
| `topicData[].topic.content[].id` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].topic.content[].type` | number | 18 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `13` |
| `topicData[].topic.cover` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `19083123811936976` |
| `topicData[].topic.delReason` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.fromBackend` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].topic.headPic` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].topic.hotScore` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `topicData[].topic.id` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `18550061` |
| `topicData[].topic.mainTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
| `topicData[].topic.memo` | null | 6 | 6 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `topicData[].topic.number` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `topicData[].topic.pubImmidiatly` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `topicData[].topic.pubTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1500973322914` |
| `topicData[].topic.readCount` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `553454` |
| `topicData[].topic.recomdContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.recomdTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.rectanglePic` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `19051237974735670` |
| `topicData[].topic.reward` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `topicData[].topic.seriesId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2490076` |
| `topicData[].topic.shareContent` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].topic.showComment` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `topicData[].topic.showRelated` | boolean | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `topicData[].topic.startText` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `7月10日是邓紫棋出道9周年的纪念日，邓紫棋也在微博中晒出了纪念日与蛋糕的合照~` |
| `topicData[].topic.status` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `topicData[].topic.summary` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，经历风雨后的邓紫棋愈加耀眼，相信下个9年，邓紫棋会变得更好~` |
| `topicData[].topic.tags[]` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `邓紫棋` |
| `topicData[].topic.title` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
| `topicData[].topic.updateTime` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1502439547112` |
| `topicData[].topic.userId` | number | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `316704573` |
| `topicData[].topic.wxTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `topicData[].url` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `/m/topic/18550061` |
| `topicData[].wxTitle` | string | 6 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `出道9年，你最爱邓紫棋哪首歌曲？` |
