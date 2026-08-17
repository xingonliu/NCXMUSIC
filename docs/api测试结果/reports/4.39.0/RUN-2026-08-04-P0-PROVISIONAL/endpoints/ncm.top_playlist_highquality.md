# ncm.top_playlist_highquality / top_playlist_highquality

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`d14e8c89639fec111c3f155a3051ac421128cc6714a4cdd2ccbbb1d11390777a`（pkg）
- 导出名：top_playlist_highquality
- 路由或调用方式：`/api/playlist/highquality/list`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：toplist / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/top_playlist_highquality.js（注释：精品歌单）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/top/playlist/highquality
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| cat | string | 可选（默认 `全部`） | 源码读取 query.cat |
| limit | string | 可选（默认 `50`） | 源码读取 query.limit |
| before | string | 可选（默认 `0`） | 源码读取 query.before |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：pageToken
- produces：songId
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

- 分页形态（静态）：cursor
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
| ncm.top_playlist_highquality.anon.001 | AUTH_ANON | - | 200 | 144 |  |
| ncm.top_playlist_highquality.catzh.none.001 | AUTH_NONE | - | 200 | 142 |  |
| ncm.top_playlist_highquality.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 136 |  |
| ncm.top_playlist_highquality.none.001 | AUTH_NONE | - | 200 | 137 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `lasttime` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1638864996000` |
| `more` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists[].adType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].anonimous` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].cloudTrackCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].commentCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `281` |
| `playlists[].commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `A_PL_0_6666112560` |
| `playlists[].copywriter` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].coverImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951165813403260` |
| `playlists[].coverImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951165813403264` |
| `playlists[].coverImgUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p4.music.126.net/SA6bW1UlPP04rFB2` |
| `playlists[].coverStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `3` |
| `playlists[].createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1616028342548` |
| `playlists[].creator.accountStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].creator.anchor` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists[].creator.authenticationTypes` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `528448` |
| `playlists[].creator.authority` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].creator.authStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].creator.avatarDetail.identityIconUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `https://p5.music.126.net/obj/wo3DlcOGw6D` |
| `playlists[].creator.avatarDetail.identityLevel` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `3` |
| `playlists[].creator.avatarDetail.userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `playlists[].creator.avatarImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166482035730` |
| `playlists[].creator.avatarImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166482035726` |
| `playlists[].creator.avatarImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166482035726` |
| `playlists[].creator.avatarUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/Ucwr8nSWgsZemlwR` |
| `playlists[].creator.backgroundImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951165424649820` |
| `playlists[].creator.backgroundImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951165424649829` |
| `playlists[].creator.backgroundUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/PHPJLipW-QACxLrA` |
| `playlists[].creator.birthday` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `878313600000` |
| `playlists[].creator.city` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1007700` |
| `playlists[].creator.defaultAvatar` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].creator.detailDescription` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].creator.djStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `10` |
| `playlists[].creator.experts` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].creator.expertTags[]` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `英伦` |
| `playlists[].creator.followed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.gender` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1` |
| `playlists[].creator.mutual` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].creator.nickname` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `十三逆旅Corbin` |
| `playlists[].creator.province` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1000000` |
| `playlists[].creator.remarkName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].creator.signature` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `听不尽的摇滚，读不完的诗。
` |
| `playlists[].creator.userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `341030416` |
| `playlists[].creator.userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `200` |
| `playlists[].creator.vipType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `11` |
| `playlists[].description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `可爱的摇滚是怎么样的呢？
编曲“妙思清奇”，听感极具丰富，上头洗脑不按常理出牌，` |
| `playlists[].highQuality` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `6666112560` |
| `playlists[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `可爱摇滚｜一剂抵挡春困的上好良药` |
| `playlists[].newImported` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].ordered` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `true` |
| `playlists[].playCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `6792089` |
| `playlists[].privacy` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].recommendInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].recommendText` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].shareCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `3002` |
| `playlists[].socialPlaylistCover` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].specialType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribed` | union<boolean|null> | 12 | 9 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribedCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `36411` |
| `playlists[].subscribers[].accountStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].anchor` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].authenticationTypes` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].authority` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].authStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].avatarDetail` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].avatarImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166641692820` |
| `playlists[].subscribers[].avatarImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166641692819` |
| `playlists[].subscribers[].avatarImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166641692819` |
| `playlists[].subscribers[].avatarUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/FOP6J7_zHK0U1MRM` |
| `playlists[].subscribers[].backgroundImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166641685170` |
| `playlists[].subscribers[].backgroundImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `109951166641685163` |
| `playlists[].subscribers[].backgroundUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `http://p1.music.126.net/fmrmH5-qHs6hTJ47` |
| `playlists[].subscribers[].birthday` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1113235200000` |
| `playlists[].subscribers[].city` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `440100` |
| `playlists[].subscribers[].defaultAvatar` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].detailDescription` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].djStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].experts` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].expertTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].followed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].gender` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].mutual` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `false` |
| `playlists[].subscribers[].nickname` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `三川川山` |
| `playlists[].subscribers[].province` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `440000` |
| `playlists[].subscribers[].remarkName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].subscribers[].signature` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `` |
| `playlists[].subscribers[].userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1836132563` |
| `playlists[].subscribers[].userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].subscribers[].vipType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `11` |
| `playlists[].tag` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `欧美,摇滚,快乐` |
| `playlists[].tags[]` | string | 36 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `欧美` |
| `playlists[].totalDuration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `0` |
| `playlists[].trackCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `125` |
| `playlists[].trackNumberUpdateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1773660381543` |
| `playlists[].tracks` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED |  |
| `playlists[].trackUpdateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1785634217751` |
| `playlists[].updateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `1773717413000` |
| `playlists[].userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `341030416` |
| `total` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_NONE,AUTH_INVALID_EXPIRED | `402` |
