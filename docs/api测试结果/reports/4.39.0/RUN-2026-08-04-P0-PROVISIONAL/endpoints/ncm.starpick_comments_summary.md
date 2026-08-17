# ncm.starpick_comments_summary / starpick_comments_summary

## 1. 元数据

- 包版本：4.39.0（provisional 锚点）
- 模块校验和：`ea1bc5b68860507ad8ba6ac6adc89ae568dd8b38a742dc13dba8475d65fb6ae6`（pkg）
- 导出名：starpick_comments_summary
- 路由或调用方式：`/api/homepage/block/page`
- 文档链接：https://neteasecloudmusicapienhanced.js.org/（https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced @ 4045f1a）
- 分类与频率：starpick / rare
- 副作用级别：read
- 测试阶段（§6 优先级）：P2
- 登录假设（静态）：none
- 最终状态：**待执行**（Phase 0 未赋值）

## 2. 已知用途与证据

- 源码：module/starpick_comments_summary.js（注释：云村星评馆 - 简要评论列表）
- 类型：interface.d.ts 有函数声明
- 文档：docs:/starpick/comments/summary
- 官方测试：未发现直接引用
- 冲突：见 06-failures-and-blockers.md（checksumDiffer=否；moduleMissing=否）

## 3. 参数契约（静态）

| name | rawType | required | default | evidence |
| --- | --- | --- | --- | --- |
| （未发现 query 参数读取） | | | |

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
| ncm.starpick_comments_summary.anon.001 | AUTH_ANON | - | 200 | 197 |  |
| ncm.starpick_comments_summary.inv.001 | AUTH_INVALID_EXPIRED | - | 200 | 134 |  |
| ncm.starpick_comments_summary.none.001 | AUTH_NONE | - | 200 | 121 |  |
| ncm.starpick_comments_summary.none.002 | AUTH_NONE | - | 200 | 233 |  |

### 累计字段表（跨 Phase，RUN-2026-08-04-P0-PROVISIONAL）

| JSONPath | rawType | presence | null | empty | auths | example |
| --- | --- | --- | --- | --- | --- | --- |
| `code` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `200` |
| `data.blockCodeOrderList` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].action` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlistCollection?referLog=HO` |
| `data.blocks[].actionType` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].blockCode` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `HOMEPAGE_BANNER` |
| `data.blocks[].blockDemote` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].blockStyle` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].canClose` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].canFeedback` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].action` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://nm/playlist/flow?source=HOMEPA` |
| `data.blocks[].creatives[].actionType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].creatives[].alg` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `bysong_profile_ol` |
| `data.blocks[].creatives[].creativeId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `8254864957` |
| `data.blocks[].creatives[].creativeType` | string | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DRAGON_BALL` |
| `data.blocks[].creatives[].logInfo` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `{"deepScore":"0.0","cartScore":"0.0","sr` |
| `data.blocks[].creatives[].position` | number | 16 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].action` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://songrcmd` |
| `data.blocks[].creatives[].resources[].actionType` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].creatives[].resources[].alg` | union<null|string> | 32 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `bysong_profile_ol` |
| `data.blocks[].creatives[].resources[].ctrp` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].likedCount` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].logInfo` | union<null|string> | 32 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `{"deepScore":"0.0","cartScore":"0.0","sr` |
| `data.blocks[].creatives[].resources[].name` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].playParams` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].position` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].replyCount` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceContentList` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceExtInfo.hasListened` | boolean | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.highQuality` | boolean | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.playCount` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `96907` |
| `data.blocks[].creatives[].resources[].resourceExtInfo.specialType` | number | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].creatives[].resources[].resourceId` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `-1` |
| `data.blocks[].creatives[].resources[].resourceState` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].resourceType` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `dragon_ball` |
| `data.blocks[].creatives[].resources[].resourceUrl` | null | 32 | 32 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].creatives[].resources[].uiElement.image.action` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].creatives[].resources[].uiElement.image.imageUrl` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/4DpSgAVpJny4Ewf-` |
| `data.blocks[].creatives[].resources[].uiElement.image.imageUrl2` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://p6.music.126.net/obj/wonDlsKUwrL` |
| `data.blocks[].creatives[].resources[].uiElement.image.purePicture` | boolean | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.image.title` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].creatives[].resources[].uiElement.labelTexts` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].creatives[].resources[].uiElement.labelTexts[]` | string | 44 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.canShowTitleLogo` | boolean | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.mainTitle.title` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `每日推荐` |
| `data.blocks[].creatives[].resources[].uiElement.rcmdShowType` | string | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.canShowTitleLogo` | boolean | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].resources[].uiElement.subTitle.title` | string | 20 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].creatives[].resources[].valid` | boolean | 32 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.blocks[].creatives[].uiElement.image.imageUrl` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p2.music.126.net/Ov6JJ85Z64nQpHzs` |
| `data.blocks[].creatives[].uiElement.image.purePicture` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.labelTexts` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].creatives[].uiElement.labelTexts[]` | string | 24 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `华语` |
| `data.blocks[].creatives[].uiElement.mainTitle.canShowTitleLogo` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.mainTitle.title` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `[烟火里的尘埃]如果你也爱听华晨宇` |
| `data.blocks[].creatives[].uiElement.rcmdShowType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].creatives[].uiElement.subTitle.canShowTitleLogo` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].creatives[].uiElement.subTitle.title` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.containerType` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `rn` |
| `data.blocks[].crossPlatformConfig.rnContent.component` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `rn-homepage-modules_dragonBall` |
| `data.blocks[].crossPlatformConfig.rnContent.engineId` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.rnContent.estimatedHeight` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `98` |
| `data.blocks[].crossPlatformConfig.rnContent.estimatedRatio` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].crossPlatformConfig.rnContent.moduleName` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `rn-homepage-modules` |
| `data.blocks[].dislikeShowType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].extInfo.banners[].adDispatchJson` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adid` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adLocation` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adSource` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].adurlV2` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].alg` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `banner-feature-1717750651205666` |
| `data.blocks[].extInfo.banners[].bannerBizType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `force_banner` |
| `data.blocks[].extInfo.banners[].bannerId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1717750651205666` |
| `data.blocks[].extInfo.banners[].dynamicVideoData` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].encodeId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].extInfo.banners[].event` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].exclusive` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].extInfo.banners[].extMonitor` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].extMonitorInfo` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].logContext` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].mainTitle` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorBlackList` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorClick` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorClickList` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].extInfo.banners[].monitorImpress` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].monitorImpressList` | array<unknown> | 12 | 0 | 12 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.blocks[].extInfo.banners[].monitorType` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].pic` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `http://p1.music.126.net/e8wtQuscq74yweCG` |
| `data.blocks[].extInfo.banners[].pid` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].program` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].requestId` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.blocks[].extInfo.banners[].s_ctrp` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `syspf_resourceType_3000-syspf_resourceId` |
| `data.blocks[].extInfo.banners[].scm` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1.music-homepage-home.homepage_banner_fo` |
| `data.blocks[].extInfo.banners[].showAdTag` | boolean | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.blocks[].extInfo.banners[].showContext` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].song` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].extInfo.banners[].targetId` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].extInfo.banners[].targetType` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `3000` |
| `data.blocks[].extInfo.banners[].titleColor` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `blue` |
| `data.blocks[].extInfo.banners[].typeTitle` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `独家策划` |
| `data.blocks[].extInfo.banners[].url` | union<string|null> | 12 | 8 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `https://y.music.163.com/g/yida/470cb610d` |
| `data.blocks[].extInfo.banners[].video` | null | 12 | 12 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].showType` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `BANNER` |
| `data.blocks[].sort` | number | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `0` |
| `data.blocks[].uiElement.button.action` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus://playlistCollection?referLog=HO` |
| `data.blocks[].uiElement.button.actionType` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `orpheus` |
| `data.blocks[].uiElement.button.biData` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.button.iconUrl` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.blocks[].uiElement.button.text` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `更多` |
| `data.blocks[].uiElement.rcmdShowType` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `DEFAULT` |
| `data.blocks[].uiElement.subTitle.canShowTitleLogo` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.blocks[].uiElement.subTitle.title` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `推荐歌单` |
| `data.blockUUIDs` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.cursor` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.demote` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.exposedResource` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `{"song":["1492864083","3327048489","2755` |
| `data.guideToast.hasGuideToast` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.guideToast.toastList` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `data.hasMore` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.internalTest` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.pageConfig.abtest[]` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `homepage-v7.3` |
| `data.pageConfig.fullscreen` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `false` |
| `data.pageConfig.homepageMode` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `PLAYLIST_MODE` |
| `data.pageConfig.nodataToast` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `到底啦~` |
| `data.pageConfig.orderInfo` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `PLAYLIST_MODE_2f354e31-a8f4-4fa5-a7b4-bd` |
| `data.pageConfig.refreshInterval` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `600000` |
| `data.pageConfig.refreshToast` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
| `data.pageConfig.showModeEntry` | boolean | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `true` |
| `data.pageConfig.songLabelMarkLimit` | number | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `1` |
| `data.pageConfig.songLabelMarkPriority[]` | string | 12 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `vip` |
| `data.pageConfig.title` | null | 4 | 4 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE |  |
| `data.titles` | array<unknown> | 4 | 0 | 4 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `undefined` |
| `message` | string | 4 | 0 | 0 | AUTH_ANON,AUTH_INVALID_EXPIRED,AUTH_NONE | `` |
