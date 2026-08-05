# ncm.video_timeline_recommend / video_timeline_recommend

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`f863dee1551550e243760695694a27f9a535a68a669dc6638d1f83f6c733747a`（pkg）
- 导出名：video_timeline_recommend
- 路由或调用方式：`/api/videotimeline/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：video / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/video_timeline_recommend.js（注释：推荐视频）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/video/timeline/recommend
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| offset | string | 可选（默认 `0`） | 源码读取 query.offset |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：videoId
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

- 终态：**partial**（blocker: 未登录层 301 系统错误（接口需会话）；AUTH_ANON（游客 cookie）可满足（200）；AUTH_USER 层待补）

| caseId | auth | status | code | durationMs | error |
| --- | --- | --- | --- | --- | --- |
| ncm.video_timeline_recommend.anon.001 | AUTH_ANON | - | 200 | 173 |  |
| ncm.video_timeline_recommend.inv.001 | AUTH_INVALID_EXPIRED | err | 301 | - | code 301 |
| ncm.video_timeline_recommend.none.001 | AUTH_NONE | err | 301 | - | code 301 |
| ncm.video_timeline_recommend.none.002 | AUTH_NONE | err | 301 | - | code 301 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `datas[].alg` | string | 3 | 0 | 0 | AUTH_ANON | `special_first_page_rcmd` |
| `datas[].data.alg` | string | 3 | 0 | 0 | AUTH_ANON | `special_first_page_rcmd` |
| `datas[].data.commentCount` | number | 3 | 0 | 0 | AUTH_ANON | `64` |
| `datas[].data.coverUrl` | string | 3 | 0 | 0 | AUTH_ANON | `https://p4.music.126.net/EV2eQMgpQLq5zc9` |
| `datas[].data.creator.accountStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.authority` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.authStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.avatarImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951163942312050` |
| `datas[].data.creator.avatarImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951163942312054` |
| `datas[].data.creator.avatarUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/35PXSTHTHrr8kB0g` |
| `datas[].data.creator.backgroundImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951163311468640` |
| `datas[].data.creator.backgroundImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951163311468647` |
| `datas[].data.creator.backgroundUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/2H7rKG3MgjASUQVc` |
| `datas[].data.creator.birthday` | number | 3 | 0 | 0 | AUTH_ANON | `937843200000` |
| `datas[].data.creator.city` | number | 3 | 0 | 0 | AUTH_ANON | `500101` |
| `datas[].data.creator.defaultAvatar` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.description` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.creator.detailDescription` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.creator.djStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.experts` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.creator.experts.1` | string | 2 | 0 | 0 | AUTH_ANON | `音乐视频达人` |
| `datas[].data.creator.experts.2` | string | 1 | 0 | 0 | AUTH_ANON | `音乐|生活图文达人` |
| `datas[].data.creator.expertTags` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.creator.followed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.gender` | number | 3 | 0 | 0 | AUTH_ANON | `2` |
| `datas[].data.creator.mutual` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.nickname` | string | 3 | 0 | 0 | AUTH_ANON | `Baby俊崽崽` |
| `datas[].data.creator.province` | number | 3 | 0 | 0 | AUTH_ANON | `500000` |
| `datas[].data.creator.remarkName` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.creator.signature` | string | 3 | 0 | 0 | AUTH_ANON | `B站/微博：Baby俊崽崽` |
| `datas[].data.creator.userId` | number | 3 | 0 | 0 | AUTH_ANON | `1464604408` |
| `datas[].data.creator.userType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.vipType` | number | 3 | 0 | 0 | AUTH_ANON | `11` |
| `datas[].data.description` | union<null|string> | 3 | 1 | 0 | AUTH_ANON | `【王俊凯】你的目光所及，会越来越美` |
| `datas[].data.durationms` | number | 3 | 0 | 0 | AUTH_ANON | `112000` |
| `datas[].data.hasRelatedGameAd` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.height` | number | 3 | 0 | 0 | AUTH_ANON | `720` |
| `datas[].data.markTypes` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.playTime` | number | 3 | 0 | 0 | AUTH_ANON | `187829` |
| `datas[].data.praised` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.praisedCount` | number | 3 | 0 | 0 | AUTH_ANON | `820` |
| `datas[].data.previewDurationms` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.previewUrl` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.relatedInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong` | array<unknown> | 2 | 0 | 2 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].a` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].al.id` | number | 1 | 0 | 0 | AUTH_ANON | `34808177` |
| `datas[].data.relateSong[].al.name` | string | 1 | 0 | 0 | AUTH_ANON | `爱，教会我们的事` |
| `datas[].data.relateSong[].al.pic` | number | 1 | 0 | 0 | AUTH_ANON | `109951167056418000` |
| `datas[].data.relateSong[].al.pic_str` | string | 1 | 0 | 0 | AUTH_ANON | `109951167056417996` |
| `datas[].data.relateSong[].al.picUrl` | string | 1 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/g-s49MkIbrY2tilB` |
| `datas[].data.relateSong[].al.tns` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].alia[]` | string | 1 | 0 | 0 | AUTH_ANON | `电视剧《遗憾拼图》片尾曲` |
| `datas[].data.relateSong[].ar[].alias` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].ar[].id` | number | 1 | 0 | 0 | AUTH_ANON | `980025` |
| `datas[].data.relateSong[].ar[].name` | string | 1 | 0 | 0 | AUTH_ANON | `周兴哲` |
| `datas[].data.relateSong[].ar[].tns` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].cd` | string | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].cf` | string | 1 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.relateSong[].copyright` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].cp` | number | 1 | 0 | 0 | AUTH_ANON | `7001` |
| `datas[].data.relateSong[].crbt` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].djId` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].dt` | number | 1 | 0 | 0 | AUTH_ANON | `287306` |
| `datas[].data.relateSong[].fee` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].ftype` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].h.br` | number | 1 | 0 | 0 | AUTH_ANON | `320000` |
| `datas[].data.relateSong[].h.fid` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].h.size` | number | 1 | 0 | 0 | AUTH_ANON | `11494966` |
| `datas[].data.relateSong[].h.vd` | number | 1 | 0 | 0 | AUTH_ANON | `-57977` |
| `datas[].data.relateSong[].id` | number | 1 | 0 | 0 | AUTH_ANON | `424264505` |
| `datas[].data.relateSong[].l.br` | number | 1 | 0 | 0 | AUTH_ANON | `128000` |
| `datas[].data.relateSong[].l.fid` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].l.size` | number | 1 | 0 | 0 | AUTH_ANON | `4598013` |
| `datas[].data.relateSong[].l.vd` | number | 1 | 0 | 0 | AUTH_ANON | `-53643` |
| `datas[].data.relateSong[].m.br` | number | 1 | 0 | 0 | AUTH_ANON | `192000` |
| `datas[].data.relateSong[].m.fid` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].m.size` | number | 1 | 0 | 0 | AUTH_ANON | `6896997` |
| `datas[].data.relateSong[].m.vd` | number | 1 | 0 | 0 | AUTH_ANON | `-55369` |
| `datas[].data.relateSong[].mst` | number | 1 | 0 | 0 | AUTH_ANON | `9` |
| `datas[].data.relateSong[].mv` | number | 1 | 0 | 0 | AUTH_ANON | `5359061` |
| `datas[].data.relateSong[].name` | string | 1 | 0 | 0 | AUTH_ANON | `你，好不好？` |
| `datas[].data.relateSong[].no` | number | 1 | 0 | 0 | AUTH_ANON | `4` |
| `datas[].data.relateSong[].pop` | number | 1 | 0 | 0 | AUTH_ANON | `100` |
| `datas[].data.relateSong[].privilege.cp` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.cs` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].privilege.dl` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.fee` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.fl` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.flag` | number | 1 | 0 | 0 | AUTH_ANON | `1541380` |
| `datas[].data.relateSong[].privilege.id` | number | 1 | 0 | 0 | AUTH_ANON | `424264505` |
| `datas[].data.relateSong[].privilege.maxbr` | number | 1 | 0 | 0 | AUTH_ANON | `999000` |
| `datas[].data.relateSong[].privilege.payed` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.pl` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.preSell` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].privilege.sp` | number | 1 | 0 | 0 | AUTH_ANON | `7` |
| `datas[].data.relateSong[].privilege.st` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.subp` | number | 1 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.toast` | boolean | 1 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].pst` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].publishTime` | number | 1 | 0 | 0 | AUTH_ANON | `1470326400000` |
| `datas[].data.relateSong[].rt` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].rtUrl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].rtUrls` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].rtype` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].rurl` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].s_id` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].st` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].t` | number | 1 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].v` | number | 1 | 0 | 0 | AUTH_ANON | `137` |
| `datas[].data.resolutions[].resolution` | number | 9 | 0 | 0 | AUTH_ANON | `240` |
| `datas[].data.resolutions[].size` | number | 9 | 0 | 0 | AUTH_ANON | `6437731` |
| `datas[].data.scm` | string | 3 | 0 | 0 | AUTH_ANON | `1.music-video-timeline.video_timeline.vi` |
| `datas[].data.shareCount` | number | 3 | 0 | 0 | AUTH_ANON | `59` |
| `datas[].data.subscribed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.threadId` | string | 3 | 0 | 0 | AUTH_ANON | `R_VI_62_F55C7BE57381AE01C7AF02920787900D` |
| `datas[].data.title` | string | 3 | 0 | 0 | AUTH_ANON | `都会好的~` |
| `datas[].data.urlInfo.id` | string | 3 | 0 | 0 | AUTH_ANON | `F55C7BE57381AE01C7AF02920787900D` |
| `datas[].data.urlInfo.needPay` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.urlInfo.payInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.urlInfo.r` | number | 3 | 0 | 0 | AUTH_ANON | `480` |
| `datas[].data.urlInfo.size` | number | 3 | 0 | 0 | AUTH_ANON | `10368735` |
| `datas[].data.urlInfo.url` | string | 3 | 0 | 0 | AUTH_ANON | `http://vodkgeyttp9.vod.126.net/cloudmusi` |
| `datas[].data.urlInfo.validityTime` | number | 3 | 0 | 0 | AUTH_ANON | `1200` |
| `datas[].data.vid` | string | 3 | 0 | 0 | AUTH_ANON | `F55C7BE57381AE01C7AF02920787900D` |
| `datas[].data.videoGroup[].alg` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `datas[].data.videoGroup[].id` | number | 9 | 0 | 0 | AUTH_ANON | `11137` |
| `datas[].data.videoGroup[].name` | string | 9 | 0 | 0 | AUTH_ANON | `TFBOYS` |
| `datas[].data.videoUserLiveInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.width` | number | 3 | 0 | 0 | AUTH_ANON | `1280` |
| `datas[].displayed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].extAlg` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].type` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `hasmore` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `msg` | string | 1 | 0 | 0 | AUTH_ANON | `发现了更多新内容` |
