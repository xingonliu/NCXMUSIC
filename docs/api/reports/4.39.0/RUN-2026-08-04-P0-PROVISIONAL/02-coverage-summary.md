# 02-COVERAGE-SUMMARY（Phase 0）

runId：`RUN-2026-08-04-P0-PROVISIONAL`；包版本：4.39.0；生成：2026-08-04T10:36:08.371Z

## 1. Universe 与清单

| 指标 | 值 |
| --- | --- |
| Universe 总数 | 436（436） |
| repo 模块 | 433 |
| pkg 模块 | 431 |
| 类型声明 | 404 |
| docs 小节 | 391 |
| 清单条目 | 436 |
| universe − inventory 差集 | 0（Phase 0 门禁：必须为 0） |

## 2. 阶段分布（§6 优先级，只决定顺序）

| 阶段 | 接口数 |
| --- | --- |
| P0 | 57 |
| P1 | 149 |
| P2 | 197 |
| P3 | 8 |
| P4 | 3 |
| P5 | 22 |
| **合计** | **436** |

## 3. 分类分布

| 分类 | 接口数 |
| --- | --- |
| dj | 30 |
| playlist | 30 |
| song | 28 |
| user | 28 |
| auth | 26 |
| ugc | 26 |
| other | 25 |
| artist | 18 |
| comment | 18 |
| social | 17 |
| recommend | 14 |
| toplist | 13 |
| listen-history | 13 |
| vip | 13 |
| album | 11 |
| voice | 10 |
| yunbei | 10 |
| search | 9 |
| video | 9 |
| musician | 8 |
| mv | 8 |
| style | 7 |
| system | 6 |
| cloud | 6 |
| message | 6 |
| broadcast | 5 |
| fans-center | 5 |
| simi | 5 |
| digital-album | 4 |
| telemetry | 4 |
| sign | 3 |
| mlog | 3 |
| device | 2 |
| homepage | 2 |
| lyric | 2 |
| lottery | 2 |
| playmode | 2 |
| related | 2 |
| audio-match | 1 |
| profile-media | 1 |
| radio | 1 |
| starpick | 1 |
| summary | 1 |
| together | 1 |

## 4. 副作用分类

| 类别 | 接口数 |
| --- | --- |
| read | 298 |
| reversible_write | 108 |
| credential | 22 |
| upload | 6 |
| payment | 2 |

## 5. 登录假设（静态）

| 假设 | 接口数 |
| --- | --- |
| none | 218 |
| user | 208 |
| user_or_vip | 10 |

## 6. 分页形态（静态）

| 形态 | 接口数 |
| --- | --- |
| none | 314 |
| offset | 88 |
| cursor | 34 |

## 7. 计划用例预算

- 计划用例总数（按 §9 最低次数公式）：3304
- 已执行：0（Phase 0 无网络调用）

## 8. 公式（Phase 15 时才冻结）

```
inventoryCoverage = reportedApiCount / universeApiCount   // 当前 436/436（endpoint 报告待生成）
runtimeCoverage = runtimeTestedApiCount / runtimeEligibleApiCount   // Phase 0：N/A（未发起任何线上请求）
matrixCoverage = executedRequiredCases / plannedRequiredCases   // 0 / 3304
rollbackSuccess = verifiedRollbackCount / attemptedWriteScenarioCount   // N/A
fieldEvidenceCoverage = evidencedFieldCount / discoveredFieldCount   // 0 / 0（无运行样本）
```

## 9. Phase 0 自检结论

- [x] Universe 差集为零（436 条目全部进入清单）
- [x] 每个条目含分类、参数契约（静态）、计划用例数与报告路径
- [ ] 终态：全部未赋（运行时阶段按 Phase 逐批赋值）
- [ ] 登录三态：未开始（账号缺口已登记）
- [ ] 运行样本/字段字典/未知字段：Phase 1 起生成
- 详细阻断见 06-failures-and-blockers.md
## 10. Phase 1 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行接口数：67；执行 case：270
- 终态：25 个已赋（failed_stable/passed/rate_limited/partial/blocked_by_prerequisite）
- 夹具池（脱敏血缘见 03-parameter-lineage.json）：songId=100, artistId=100, albumId=100, userId=100, mvId=77, commentId=50, djId=97, programId=12, playlistId=100, toplistId=85
- 关键契约事实：见 07-multivariable-diff.md 与 06-failures-and-blockers.md

## 11. Phase 2 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行接口数：30；执行 case：145
- 终态：30 个已赋（partial）
- 夹具池（脱敏血缘见 03-parameter-lineage.json）：songId=100, artistId=100, albumId=100, djId=40, programId=6, playlistId=100, mvId=52, toplistId=63
- 关键契约事实：见 07-multivariable-diff.md 与 06-failures-and-blockers.md

## 12. Phase 3 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行接口数：24；执行 case：106
- 终态：24 个已赋（partial）
- 夹具池（脱敏血缘见 03-parameter-lineage.json）：songId=100, artistId=100, albumId=100, djId=40, programId=6, playlistId=100, mvId=52, toplistId=63
- 关键契约事实：见 07-multivariable-diff.md 与 06-failures-and-blockers.md

## 13. Phase 4 运行记录（RUN-2026-08-04-P0-PROVISIONAL）

- 执行接口数：7；执行 case：56
- 终态：7 个已赋（partial）
- 夹具池（脱敏血缘见 03-parameter-lineage.json）：songId=100, artistId=100, albumId=100, djId=40, programId=6, playlistId=100, mvId=52, toplistId=63
- 关键契约事实：见 07-multivariable-diff.md 与 06-failures-and-blockers.md

### 13.1 音质矩阵（song_url_v1，canonical）

| 歌曲 | level | auth | url | br | fee/payed | 试听 | 实际level |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dolby | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| dolby | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| dolby | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| exhigh | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| exhigh | inv | 001 | ERR--462 |  |  |  |
| exhigh | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| exhigh | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| higher | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| higher | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| higher | none | 001 | URL | 192000 | 0/0 | - | higher |
| hires | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| hires | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| hires | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| jyeffect | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| jyeffect | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| jyeffect | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| jymaster | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| jymaster | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| jymaster | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| lossless | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| lossless | inv | 001 | ERR--462 |  |  |  |
| lossless | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| lossless | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| sky | aac | none | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| sky | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| sky | c51 | none | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| sky | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| sky | none | 001 | URL | 320000 | 0/0 | - | exhigh |
| sky | ste | none | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| standard | anon | 001 | URL | 128012 | 1/0 | 试听30s(f6) | standard |
| standard | id0 | none | null | 0 | 0/0 | - | - |
| standard | inv | 001 | ERR--462 |  |  |  |
| standard | none | 001 | URL | 128012 | 1/0 | 试听30s(f-1) | standard |
| standard | none | 001 | URL | 128000 | 0/0 | - | standard |

- 歌A（光年之外，fee=1）：全部 9 档请求均返回 128k mp3 试听 URL（level 请求被忽略/降级），freeTrial 30s；ANON 层 freeTrialInfo.fragmentType=6、NONE 层=-1（游客 cookie 改变试听元数据形态）
- 歌B（免费，fee=0）：lossless/hires 等高档返回 320k mp3（非 flac 容器），higher→192k，standard→128k

## 14. Phase 5 状态（RUN-2026-08-04-P0-PROVISIONAL）

- **未执行**：操作者指示暂缓（Phase 5 用户私有读取不测）。
- 前置条件：AUTH_USER 测试账号（B-002，account-basic-01 待申请）；uid 由 user_account 登录态生产。
- 涉及范围（§7 Phase 5）：user_playlist、likelist、user_record、user_cloud、user_subcount、user_follows/followeds、user_dj、user_event、record_recent_*、recent_listen_list、user_audio、user_comment_history 等。
- 恢复条件：账号到位后创建子运行或同一 runId 续跑，按 spec 补齐；届时这些接口终态从空转 partial/blocked_by_prerequisite。