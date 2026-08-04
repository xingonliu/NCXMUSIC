# ncm.personalized_djprogram / personalized_djprogram

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`9830c3cde5bd943ea2a6b01739c69c4943b2387b7d25261f3afa8e1fab330d4b`（pkg）
- 导出名：personalized_djprogram
- 路由或调用方式：`/api/personalized/djprogram`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：recommend / high
- 副作用级别：read
- 测试阶段（§6 优先级）：P0
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/personalized_djprogram.js（注释：推荐电台）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/personalized/djprogram
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| （未发现 query 参数读取） | | | |

- crypto 模式：weapi
- cookie 读取：否

## 4. 参数血缘（静态假设）

- consumes：（无）
- produces：djId, programId, radioId
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
| ncm.personalized_djprogram.anon.001 | AUTH_ANON | - | 200 | 349 |  |
| ncm.personalized_djprogram.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 284 |  |
| ncm.personalized_djprogram.limit5.none.001 | AUTH_NONE | - | 200 | 270 |  |
| ncm.personalized_djprogram.none.001 | AUTH_NONE | - | 200 | 257 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `category` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `result[].alg` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `featured` |
| `result[].canDislike` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].copywriter` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `编辑推荐：对话守门员赵丽娜` |
| `result[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3726034207` |
| `result[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `《陋室铭》第4期｜守门员赵丽娜：“最美女足门将”、搞砸和高能量` |
| `result[].picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/5qIAku2mGg7o1h8p` |
| `result[].program.adjustedPlayCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1972` |
| `result[].program.auditStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10` |
| `result[].program.bdAuditStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `result[].program.blurCoverUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://music.163.com/api/dj/img/blur/109` |
| `result[].program.buyed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.canReward` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.channels[]` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `情感驿站` |
| `result[].program.commentCount` | number | 3 | 0 | 0 | AUTH_ANON | `2` |
| `result[].program.commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `A_DJ_1_3726034207` |
| `result[].program.coverId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173659329010` |
| `result[].program.coverUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/5qIAku2mGg7o1h8p` |
| `result[].program.createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1785384018112` |
| `result[].program.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `除了前中国女足门将这个身份，赵丽娜身上还有很多标签，乐队鼓手，足球公益项目星球计` |
| `result[].program.dj.accountStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.dj.anchor` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.dj.authenticationTypes` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.dj.authority` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.dj.authStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.dj.avatarDetail` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.dj.avatarImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173659332800` |
| `result[].program.dj.avatarImgId_str` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173659332805` |
| `result[].program.dj.avatarImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173659332805` |
| `result[].program.dj.avatarUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/Q14NKsqTb3qamvhA` |
| `result[].program.dj.backgroundImgId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951162868128400` |
| `result[].program.dj.backgroundImgIdStr` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951162868128395` |
| `result[].program.dj.backgroundUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/2zSNIqTcpHL2jIvU` |
| `result[].program.dj.birthday` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `496598400000` |
| `result[].program.dj.brand` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `陋室铭` |
| `result[].program.dj.city` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110101` |
| `result[].program.dj.defaultAvatar` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.dj.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.dj.detailDescription` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.dj.djStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `10` |
| `result[].program.dj.experts` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.dj.expertTags` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.dj.followed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.dj.gender` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `2` |
| `result[].program.dj.mutual` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.dj.nickname` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `刘语熙Rachel` |
| `result[].program.dj.province` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `110000` |
| `result[].program.dj.remarkName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.dj.signature` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `主持人、制作人` |
| `result[].program.dj.userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17771826227` |
| `result[].program.dj.userType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.dj.vipType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.duration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3452629` |
| `result[].program.h5Links` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3726034207` |
| `result[].program.isPublish` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `result[].program.likedCount` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `result[].program.listenerCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1972` |
| `result[].program.mainSong.album.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.album.artist.albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.album.artist.briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artist.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.img1v1Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `result[].program.mainSong.album.artist.musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artist.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artist.topicPerson` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artist.trans` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artists[].albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.album.artists[].briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artists[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].img1v1Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/6y-UleORITEDbvrO` |
| `result[].program.mainSong.album.artists[].musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artists[].picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.artists[].topicPerson` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.artists[].trans` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.blurPicUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.album.briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_AL_3_0` |
| `result[].program.mainSong.album.company` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.album.companyId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.description` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.gapless` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.album.onSale` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.mainSong.album.pic` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p4.music.126.net/0ju8ET1ApZSXfWac` |
| `result[].program.mainSong.album.publishTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.songs` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.album.status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.album.subType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.album.tags` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.album.transName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.album.type` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.artists[].albumSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].alias` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.artists[].briefDesc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.artists[].id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].img1v1Id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].img1v1Url` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/6y-UleORITEDbvrO` |
| `result[].program.mainSong.artists[].musicSize` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.artists[].picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.artists[].topicPerson` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.artists[].trans` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.audition` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.bMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].program.mainSong.bMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.bMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].program.mainSong.bMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16983824094` |
| `result[].program.mainSong.bMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.bMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3452629` |
| `result[].program.mainSong.bMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `138757302` |
| `result[].program.mainSong.bMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].program.mainSong.bMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.commentThreadId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `R_SO_4_3413692077` |
| `result[].program.mainSong.copyFrom` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.copyright` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `result[].program.mainSong.copyrightId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.crbt` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.dayPlays` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.disc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `result[].program.mainSong.duration` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3452629` |
| `result[].program.mainSong.fee` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.ftype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.hearTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.hMusic` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.hMusic.bitrate` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].program.mainSong.hMusic.dfsId` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.hMusic.extension` | string | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].program.mainSong.hMusic.id` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16983824094` |
| `result[].program.mainSong.hMusic.name` | null | 8 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.hMusic.playTime` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3452629` |
| `result[].program.mainSong.hMusic.size` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `138757302` |
| `result[].program.mainSong.hMusic.sr` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].program.mainSong.hMusic.volumeDelta` | number | 8 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.hrMusic` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3413692077` |
| `result[].program.mainSong.lMusic.bitrate` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `320000` |
| `result[].program.mainSong.lMusic.dfsId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.lMusic.extension` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `mp3` |
| `result[].program.mainSong.lMusic.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `16983824094` |
| `result[].program.mainSong.lMusic.name` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.lMusic.playTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3452629` |
| `result[].program.mainSong.lMusic.size` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `138757302` |
| `result[].program.mainSong.lMusic.sr` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `48000` |
| `result[].program.mainSong.lMusic.volumeDelta` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.mark` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.mMusic` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.mp3Url` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.mvid` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `《陋室铭》第4期｜守门员赵丽娜：“最美女足门将”、搞砸和高能量` |
| `result[].program.mainSong.no` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.noCopyrightRcmd` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.originCoverType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.originSongSimpleData` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.playedNum` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.popularity` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `result[].program.mainSong.position` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.ringtone` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.rtUrl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.rtUrls` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `result[].program.mainSong.rtype` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.rurl` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.score` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `result[].program.mainSong.sign` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.single` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.sqMusic` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainSong.starred` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.mainSong.starredNum` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.status` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.mainSong.transName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.mainTrackId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3413692077` |
| `result[].program.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `《陋室铭》第4期｜守门员赵丽娜：“最美女足门将”、搞砸和高能量` |
| `result[].program.programDesc` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.programFeeType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.publish` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `result[].program.pubStatus` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `5` |
| `result[].program.radio.buyed` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.radio.category` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `情感` |
| `result[].program.radio.categoryId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3` |
| `result[].program.radio.composeVideo` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.radio.createTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1785329518993` |
| `result[].program.radio.desc` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `谈笑皆友友，往来尽欢愉主播：刘语熙主持人、制作人身边有一群有趣的朋友，过着各自有` |
| `result[].program.radio.discountPrice` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.radio.dj` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.radio.feeScope` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.radio.finished` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.radio.hightQuality` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.radio.id` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1496510981` |
| `result[].program.radio.lastProgramCreateTime` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1785391214183` |
| `result[].program.radio.lastProgramId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3726052248` |
| `result[].program.radio.lastProgramName` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.radio.name` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `陋室铭` |
| `result[].program.radio.originalPrice` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.radio.picId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `109951173659329010` |
| `result[].program.radio.picUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p3.music.126.net/5qIAku2mGg7o1h8p` |
| `result[].program.radio.price` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.radio.programCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `result[].program.radio.purchaseCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.radio.radioFeeType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.radio.rcmdText` | union<null|string> | 12 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `《刚刚突然想到》是我的声音备忘录` |
| `result[].program.radio.subCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `11` |
| `result[].program.radio.subed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `result[].program.radio.underShelf` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.radio.videos` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.radio.whiteList` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.reward` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `result[].program.serialNum` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `4` |
| `result[].program.shareCount` | number | 3 | 0 | 0 | AUTH_ANON | `0` |
| `result[].program.songs` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.subscribed` | boolean | 3 | 0 | 0 | AUTH_ANON | `false` |
| `result[].program.subscribedCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.titbitImages` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.titbits` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].program.trackCount` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `result[].program.userId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `17771826227` |
| `result[].trackNumberUpdateTime` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `result[].type` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
