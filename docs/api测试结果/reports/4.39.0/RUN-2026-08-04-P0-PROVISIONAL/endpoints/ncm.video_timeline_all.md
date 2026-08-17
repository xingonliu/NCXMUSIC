# ncm.video_timeline_all / video_timeline_all

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`4b1fd5cdb2f4b379b511b25e8b16097895e47c58375dc7abc9d30c69180a78c2`（pkg）
- 导出名：video_timeline_all
- 路由或调用方式：`/api/videotimeline/otherclient/get`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：video / medium
- 副作用级别：read
- 测试阶段（§6 优先级）：P1
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/video_timeline_all.js（注释：全部视频列表）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/video/timeline/all
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
| ncm.video_timeline_all.anon.001 | AUTH_ANON | - | 200 | 157 |  |
| ncm.video_timeline_all.inv.001 | AUTH_INVALID_EXPIRED | err | 301 | - | code 301 |
| ncm.video_timeline_all.none.001 | AUTH_NONE | err | 301 | - | code 301 |
| ncm.video_timeline_all.none.002 | AUTH_NONE | err | 301 | - | code 301 |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 1 | 0 | 0 | AUTH_ANON | `200` |
| `datas[].alg` | string | 3 | 0 | 0 | AUTH_ANON | `special_first_page_rcmd` |
| `datas[].data.alg` | string | 3 | 0 | 0 | AUTH_ANON | `special_first_page_rcmd` |
| `datas[].data.commentCount` | number | 3 | 0 | 0 | AUTH_ANON | `73` |
| `datas[].data.coverUrl` | string | 3 | 0 | 0 | AUTH_ANON | `https://p3.music.126.net/bIOrIKRYzRhw0Fy` |
| `datas[].data.creator.accountStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.authority` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.authStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.avatarImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951163071308960` |
| `datas[].data.creator.avatarImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951163071308959` |
| `datas[].data.creator.avatarUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p4.music.126.net/-vipYavOEXErU2Gd` |
| `datas[].data.creator.backgroundImgId` | number | 3 | 0 | 0 | AUTH_ANON | `109951163086553400` |
| `datas[].data.creator.backgroundImgIdStr` | string | 3 | 0 | 0 | AUTH_ANON | `109951163086553407` |
| `datas[].data.creator.backgroundUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/525pdESWUr4n_4U1` |
| `datas[].data.creator.birthday` | number | 3 | 0 | 0 | AUTH_ANON | `-2209017600000` |
| `datas[].data.creator.city` | number | 3 | 0 | 0 | AUTH_ANON | `370100` |
| `datas[].data.creator.defaultAvatar` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.description` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.creator.detailDescription` | string | 3 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.creator.djStatus` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.creator.experts` | null | 1 | 1 | 0 | AUTH_ANON |  |
| `datas[].data.creator.experts.1` | string | 2 | 0 | 0 | AUTH_ANON | `影视视频达人` |
| `datas[].data.creator.expertTags` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.creator.followed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.gender` | number | 3 | 0 | 0 | AUTH_ANON | `2` |
| `datas[].data.creator.mutual` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.creator.nickname` | string | 3 | 0 | 0 | AUTH_ANON | `DS女老诗` |
| `datas[].data.creator.province` | number | 3 | 0 | 0 | AUTH_ANON | `370000` |
| `datas[].data.creator.remarkName` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.creator.signature` | string | 3 | 0 | 0 | AUTH_ANON | `萝莉萌系，辛辣吐槽！` |
| `datas[].data.creator.userId` | number | 3 | 0 | 0 | AUTH_ANON | `275316513` |
| `datas[].data.creator.userType` | number | 3 | 0 | 0 | AUTH_ANON | `204` |
| `datas[].data.creator.vipType` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.description` | string | 3 | 0 | 0 | AUTH_ANON | `TFBOYS五年成长史：易烊千玺高冷，王源可爱，王俊凯稳重！` |
| `datas[].data.durationms` | number | 3 | 0 | 0 | AUTH_ANON | `90966` |
| `datas[].data.hasRelatedGameAd` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.height` | number | 3 | 0 | 0 | AUTH_ANON | `1080` |
| `datas[].data.markTypes` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.playTime` | number | 3 | 0 | 0 | AUTH_ANON | `121413` |
| `datas[].data.praised` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.praisedCount` | number | 3 | 0 | 0 | AUTH_ANON | `445` |
| `datas[].data.previewDurationms` | number | 3 | 0 | 0 | AUTH_ANON | `4000` |
| `datas[].data.previewUrl` | string | 3 | 0 | 0 | AUTH_ANON | `http://vodkgeyttp9.vod.126.net/vodkgeytt` |
| `datas[].data.relatedInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong` | array<unknown> | 1 | 0 | 1 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].a` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].al.id` | number | 2 | 0 | 0 | AUTH_ANON | `35758075` |
| `datas[].data.relateSong[].al.name` | string | 2 | 0 | 0 | AUTH_ANON | `我想和你唱 第二季 第12期` |
| `datas[].data.relateSong[].al.pic` | number | 2 | 0 | 0 | AUTH_ANON | `18935789253797636` |
| `datas[].data.relateSong[].al.pic_str` | string | 2 | 0 | 0 | AUTH_ANON | `18935789253797636` |
| `datas[].data.relateSong[].al.picUrl` | string | 2 | 0 | 0 | AUTH_ANON | `http://p3.music.126.net/n257D9re3_ZCf0sv` |
| `datas[].data.relateSong[].al.tns` | array<unknown> | 2 | 0 | 2 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].alia` | array<unknown> | 2 | 0 | 2 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].ar[].alias` | array<unknown> | 4 | 0 | 4 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].ar[].id` | number | 4 | 0 | 0 | AUTH_ANON | `999220` |
| `datas[].data.relateSong[].ar[].name` | string | 4 | 0 | 0 | AUTH_ANON | `王俊凯` |
| `datas[].data.relateSong[].ar[].tns` | array<unknown> | 4 | 0 | 4 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].cd` | string | 2 | 0 | 0 | AUTH_ANON | `01` |
| `datas[].data.relateSong[].cf` | string | 2 | 0 | 0 | AUTH_ANON | `` |
| `datas[].data.relateSong[].copyright` | number | 2 | 0 | 0 | AUTH_ANON | `2` |
| `datas[].data.relateSong[].cp` | number | 2 | 0 | 0 | AUTH_ANON | `404023` |
| `datas[].data.relateSong[].crbt` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].djId` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].dt` | number | 2 | 0 | 0 | AUTH_ANON | `242369` |
| `datas[].data.relateSong[].fee` | number | 2 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].ftype` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].h.br` | number | 2 | 0 | 0 | AUTH_ANON | `320000` |
| `datas[].data.relateSong[].h.fid` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].h.size` | number | 2 | 0 | 0 | AUTH_ANON | `9697742` |
| `datas[].data.relateSong[].h.vd` | number | 2 | 0 | 0 | AUTH_ANON | `-42163` |
| `datas[].data.relateSong[].id` | number | 2 | 0 | 0 | AUTH_ANON | `490595323` |
| `datas[].data.relateSong[].l.br` | number | 2 | 0 | 0 | AUTH_ANON | `128000` |
| `datas[].data.relateSong[].l.fid` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].l.size` | number | 2 | 0 | 0 | AUTH_ANON | `3879123` |
| `datas[].data.relateSong[].l.vd` | number | 2 | 0 | 0 | AUTH_ANON | `-37936` |
| `datas[].data.relateSong[].m.br` | number | 2 | 0 | 0 | AUTH_ANON | `192000` |
| `datas[].data.relateSong[].m.fid` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].m.size` | number | 2 | 0 | 0 | AUTH_ANON | `5818662` |
| `datas[].data.relateSong[].m.vd` | number | 2 | 0 | 0 | AUTH_ANON | `-39598` |
| `datas[].data.relateSong[].mst` | number | 2 | 0 | 0 | AUTH_ANON | `9` |
| `datas[].data.relateSong[].mv` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].name` | string | 2 | 0 | 0 | AUTH_ANON | `宠爱` |
| `datas[].data.relateSong[].no` | number | 2 | 0 | 0 | AUTH_ANON | `2` |
| `datas[].data.relateSong[].pop` | number | 2 | 0 | 0 | AUTH_ANON | `95` |
| `datas[].data.relateSong[].privilege.cp` | number | 2 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.cs` | boolean | 2 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].privilege.dl` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.fee` | number | 2 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.fl` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.flag` | number | 2 | 0 | 0 | AUTH_ANON | `1541380` |
| `datas[].data.relateSong[].privilege.id` | number | 2 | 0 | 0 | AUTH_ANON | `490595323` |
| `datas[].data.relateSong[].privilege.maxbr` | number | 2 | 0 | 0 | AUTH_ANON | `999000` |
| `datas[].data.relateSong[].privilege.payed` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.pl` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.preSell` | boolean | 2 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].privilege.sp` | number | 2 | 0 | 0 | AUTH_ANON | `7` |
| `datas[].data.relateSong[].privilege.st` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].privilege.subp` | number | 2 | 0 | 0 | AUTH_ANON | `1` |
| `datas[].data.relateSong[].privilege.toast` | boolean | 2 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.relateSong[].pst` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].publishTime` | number | 2 | 0 | 0 | AUTH_ANON | `1500048000007` |
| `datas[].data.relateSong[].rt` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].rtUrl` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].rtUrls` | array<unknown> | 2 | 0 | 2 | AUTH_ANON | `undefined` |
| `datas[].data.relateSong[].rtype` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].rurl` | null | 2 | 2 | 0 | AUTH_ANON |  |
| `datas[].data.relateSong[].s_id` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].st` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].t` | number | 2 | 0 | 0 | AUTH_ANON | `0` |
| `datas[].data.relateSong[].v` | number | 2 | 0 | 0 | AUTH_ANON | `61` |
| `datas[].data.resolutions[].resolution` | number | 9 | 0 | 0 | AUTH_ANON | `240` |
| `datas[].data.resolutions[].size` | number | 9 | 0 | 0 | AUTH_ANON | `9424635` |
| `datas[].data.scm` | string | 3 | 0 | 0 | AUTH_ANON | `1.music-video-timeline.video_timeline.vi` |
| `datas[].data.shareCount` | number | 3 | 0 | 0 | AUTH_ANON | `51` |
| `datas[].data.subscribed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].data.threadId` | string | 3 | 0 | 0 | AUTH_ANON | `R_VI_62_16353BD64FCED4C92C02ACF2FB717417` |
| `datas[].data.title` | string | 3 | 0 | 0 | AUTH_ANON | `TFBOYS五年成长史：易烊千玺高冷，王源可爱，王俊凯稳重` |
| `datas[].data.urlInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.vid` | string | 3 | 0 | 0 | AUTH_ANON | `16353BD64FCED4C92C02ACF2FB717417` |
| `datas[].data.videoGroup[].alg` | null | 9 | 9 | 0 | AUTH_ANON |  |
| `datas[].data.videoGroup[].id` | number | 9 | 0 | 0 | AUTH_ANON | `11137` |
| `datas[].data.videoGroup[].name` | string | 9 | 0 | 0 | AUTH_ANON | `TFBOYS` |
| `datas[].data.videoUserLiveInfo` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].data.width` | number | 3 | 0 | 0 | AUTH_ANON | `1920` |
| `datas[].displayed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `datas[].extAlg` | null | 3 | 3 | 0 | AUTH_ANON |  |
| `datas[].type` | number | 3 | 0 | 0 | AUTH_ANON | `1` |
| `hasmore` | boolean | 1 | 0 | 0 | AUTH_ANON | `true` |
| `msg` | string | 1 | 0 | 0 | AUTH_ANON | `发现了更多新内容` |
| `rcmdLimit` | number | 1 | 0 | 0 | AUTH_ANON | `48` |
