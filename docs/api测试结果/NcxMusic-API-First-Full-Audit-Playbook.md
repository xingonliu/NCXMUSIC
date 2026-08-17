# NcxMusic 全量 API First 测试与字段审计手册

> 文档状态：Baseline 0.1
>
> 建立日期：2026-08-04
>
> 执行对象：DeepSeek 或其他被指定的 API 测试 Agent
>
> 测试对象：NcxMusic 锁定版本内可发现的全部 NeteaseCloudMusicApiEnhanced API
>
> 核心目标：先建立可复现的接口事实库，再进行 Adapter、页面、播放器和 Agent Capability 开发

## 0. 给执行 Agent 的强制指令

1. 这是全量审计，不是首版接口抽样。不得因为当前 UI、首版页面或 Agent 暂时不用某个接口而跳过。
2. 高频、基础、能生产后续参数的接口先测；冷门、低频、废弃、别名、支付和高风险接口放在最后。优先级只决定顺序，不决定是否进入清单。
3. 不得用一次响应推断字段契约。每个接口必须达到本手册定义的最低样本数，并完成多变量测试。
4. 登录变量是强制维度。凡是可以发起请求的接口，至少比较未登录、游客和普通登录账号；不适用时也要给出证据并标记为不适用。
5. VIP、已购资源、资源归属、空数据、分页、参数缺省、参数边界和错误输入按适用性纳入矩阵。关键接口不能只做成对组合，必须跑关键维度的完整矩阵。
6. 参数优先从已经测试过的上游接口响应中取得并记录来源。例如先由搜索或推荐得到歌曲 ID，再测试歌曲详情；由歌曲 ID 测音频 URL；不得为已能自动取得的 ID、URL 或游标询问用户。
7. 文档、类型声明和源码只用于建立假设；锁定版本的真实运行结果才是返回字段事实。发生冲突时必须同时记录三个来源。
8. 不知道含义的字段不得猜测、删除、重命名或直接映射到业务模型。必须进入未知字段台账。
9. 所有原始响应均须保存到本地审计产物目录；提交仓库的样本必须脱敏。Cookie、MUSIC_U、CSRF、手机号、邮箱、设备标识、签名参数和带凭据的媒体 URL不得进入 Git。
10. 写操作只允许作用于本次运行创建的沙盒资源，并在同一场景中验证和回滚。不得修改用户已有歌单、评论、头像、昵称、绑定关系或其他真实资产。
11. 支付、购买、下单、账号删除、解除绑定等不可逆或可能产生费用的接口仍要进入全量清单，但默认只做源码分析、请求构造验证和负向运行探测，不做真实成功交易。它们可以以 blocked_by_safety 完成审计。
12. 接口被测试不代表自动成为 NcxMusic 页面能力或小云能力。生产注册仍须经过 Capability Catalog、安全分级与产品范围审查。
13. 禁止伪造响应、补写未执行的用例、用另一个接口的样本代替当前接口，或把无法验证写成通过。
14. 最终清单不得存在未说明的空状态。每个 API 必须获得一个明确终态以及对应证据。

## 1. 审计范围、版本锚点与完成定义

### 1.1 API Universe

本次全量接口集合定义为以下来源的并集，而不是只抄在线文档目录：

- NcxMusic 锁文件中实际安装包导出的函数。
- 实际安装包的 module 目录下所有 JavaScript 模块。
- 实际安装包的 interface.d.ts 或等价类型声明。
- 对应版本的官方文档路由目录。
- 对应版本仓库中的测试、示例和兼容别名。

集合中的每个成员分配稳定的 apiAuditId，建议格式为 ncm.规范化导出名。一个模块即使没有正常导出，也不得消失；应标为 not_exported。别名也要单列，并链接到 canonical API。

截至本文建立时对官方主分支的观察快照如下，仅用于核对发现器是否明显漏项，不能替代运行时版本：

| 项目 | 观察值 |
| --- | --- |
| 官方仓库 | NeteaseCloudMusicApiEnhanced/api-enhanced |
| 观察提交 | 4045f1ad3f82987588aaf9ea8eb3c79a61b06bb6 |
| 包名 | @neteasecloudmusicapienhanced/api |
| package.json 版本 | 4.39.0 |
| module JavaScript 数量 | 433 |
| README 建议运行时 | Node.js 22 或更高 |

数量会随上游更新变化。正式测试必须以 NcxMusic lockfile 实际解析出的包版本、完整性哈希和模块清单为准，不得把 433 写成永久常量。

### 1.2 合法终态

每个 apiAuditId 只能以以下状态之一结束：

| 状态 | 含义 |
| --- | --- |
| passed | 所有强制用例、字段分析和副作用核验通过 |
| partial | 已取得有效事实，但仍有明确缺口；必须写明缺口与影响 |
| failed_stable | 至少三次可复现地失败，且已排除短暂网络问题 |
| blocked_by_prerequisite | 缺少验证码、专用账号、真实资源或地区条件 |
| blocked_by_safety | 成功调用可能付费或造成不可逆后果，按规则停止在安全边界 |
| rate_limited | 已按退避策略验证为风控或限流，不能继续安全请求 |
| deprecated | 上游明确废弃或运行证据稳定表明已失效 |
| alias | 当前入口是另一个 API 的兼容别名 |
| not_exported | 源码存在但当前包入口无法调用 |
| unsupported_environment | 当前 OS、地区或运行时无法满足，且已记录证据 |

partial 不是用来掩盖遗漏的状态。只有已完成可执行部分、缺口有外部前置条件、并写明补测方案时才可使用。

### 1.3 全量完成门槛

以下条件同时满足才算一轮完成：

- Universe 差集为零：发现集合中的每个接口都在清单中。
- 每个接口有分类、参数契约、测试矩阵、字段表、错误表、终态和证据链接。
- 所有强制多变量维度均有结果或明确阻塞说明。
- 所有写操作有前置快照、执行证据、验证结果和回滚记录。
- 所有未知字段进入统一台账，没有静默丢弃。
- 所有报告通过秘密扫描，仓库内不存在凭据和未脱敏原始响应。
- 生成机器可读覆盖率报告，可从清单反向定位每个原始样本。

## 2. 输出目录与产物规范

建议在开发阶段建立以下结构。脚本目录可以提交，原始数据目录不得提交：

    scripts/api-audit/
      inventory/
      runners/
      analyzers/
      redaction/
      schemas/
    .artifacts/api-audit/<runId>/
      raw/
      request-log/
      rollback-journal/
      media-probes/
    docs/api/reports/<packageVersion>/<runId>/
      00-RUN-MANIFEST.md
      01-api-inventory.csv
      01-api-inventory.json
      02-coverage-summary.md
      03-parameter-lineage.json
      04-field-dictionary.csv
      05-unknown-fields.md
      06-failures-and-blockers.md
      07-multivariable-diff.md
      08-rollback-report.md
      09-capability-candidates.md
      endpoints/
      samples-redacted/

### 2.1 必须提交

- 生成清单与运行器的源码。
- 运行清单、覆盖率、参数血缘、字段字典、未知字段、失败和回滚报告。
- 每个接口的结构化 Markdown 报告。
- 经过脱敏且通过扫描的代表性响应样本。
- 发现器输出的模块名、导出名、校验和及来源，不包含第三方源码全文。

### 2.2 禁止提交

- 未脱敏的 raw 目录。
- Cookie、MUSIC_U、CSRF、API Key、手机号、邮箱、私信内容或精确设备标识。
- 可直接复用的临时播放 URL、上传授权 URL、二维码登录凭据或请求签名。
- 测试账号的完整个人资料、私有歌单内容和原始用户画像数据。

### 2.3 原始层与提交层

每次响应先原样写入 raw 层，并以只在本机有效的 runId、caseId 和时间戳命名。随后由脱敏器生成 samples-redacted。字段分析必须读取 raw 层，报告链接指向脱敏层和原始样本哈希，不能只分析经过删字段的样本。

提交前至少运行两类检查：

1. 基于字段名的秘密扫描，例如 cookie、music_u、csrf、token、phone、email、deviceId、signature。
2. 基于值模式和熵的扫描，防止秘密藏在未知字段、URL query 或 header 中。

## 3. 运行环境冻结

### 3.1 RUN MANIFEST 必填信息

每次审计先生成唯一 runId，并记录：

- 开始与结束时间、执行 Agent 名称和操作者。
- NcxMusic Git commit 与工作树状态。
- 精确包名、解析版本、lockfile 完整性值、安装包内容哈希和对应上游提交。
- 模块数、导出数、类型声明数、文档路由数及四者差集。
- Node.js、Electron、Chromium、pnpm 版本。
- OS、架构、语言、时区。
- 网络地区、代理或 unblock 配置是否启用；地址与凭据必须脱敏。
- 参与测试的账户分层、匿名编号和授权范围。
- 是否允许可逆写操作、高风险写操作或付费操作。

一次 run 中不得悄悄更换依赖版本、关键网络配置或账号。确需更换时创建新 runId；否则跨样本差异无法归因。

### 3.2 调用形态

NcxMusic 计划把 API 包作为本地 Node.js 依赖，因此主合同测试必须直接调用安装包导出函数，并分析 result.body。若未来增加 HTTP 包装层，只需为高风险和高频接口补做代表性 HTTP 一致性测试，不能用 HTTP 服务替代本地依赖合同。

示意：

    import * as ncmApi from '@neteasecloudmusicapienhanced/api'

    const result = await ncmApi.song_detail({
      ids: songIds.join(','),
      cookie: sessionCookie
    })

    const responseBody = result.body

调用签名必须以锁定版本源码和类型为准。示意代码不能当成所有接口的固定参数约定。

### 3.3 网络配置分层

至少区分两种运行配置：

| 配置 | 目的 |
| --- | --- |
| canonical | 关闭会改变返回内容的解锁、代理或替换逻辑，观察原始上游合同 |
| enhanced | 使用 NcxMusic 准备采用的增强配置，验证真实产品环境 |

两种配置的样本要分别统计，不能混在同一字段稳定性序列中。若 unblock 会让音质参数失效，必须作为单独差异结论。

### 3.4 请求节奏

- 初始阶段并发固定为 1。
- 证实安全且无风控后，纯读取最多并发 2。
- 所有写操作、登录、签到、上传和账号接口强制串行。
- 普通请求间加入 350 至 800 毫秒随机抖动。
- 遇到限流立即降低速率，不通过并发重试规避平台限制。

## 4. 多变量测试模型

### 4.1 登录与权益分层

登录态是全局强制维度，统一定义：

| 代码 | 会话状态 | 用途 |
| --- | --- | --- |
| AUTH_NONE | 不带 Cookie | 验证纯未登录行为 |
| AUTH_ANON | 由游客接口产生的会话 | 验证游客和完全未登录是否不同 |
| AUTH_USER | 普通已登录账号 | 验证个人数据与常规权益 |
| AUTH_VIP | 有效 VIP 账号 | 验证会员字段和媒体可用性 |
| AUTH_PURCHASED | 拥有至少一个已购资源的账号 | 验证单独购买权益 |
| AUTH_INVALID | 过期、截断或无效的测试 Cookie | 验证失效错误与是否意外回退游客 |

对所有可发起请求的接口，至少执行 AUTH_NONE、AUTH_ANON、AUTH_USER 三个 smoke case。若接口确认与账户无关，仍要保存三者结构差异证明；之后的扩展用例才可只选代表层。

AUTH_VIP 和 AUTH_PURCHASED 是音频 URL、音质、版权、付费资源、会员内容等接口的强制层。若当前没有合规账号，必须标记 blocked_by_prerequisite，不能用普通账号猜测。

AUTH_INVALID 是登录态、账户资料、个性化、写操作和私有资源接口的强制负向层。

### 4.2 其他维度

| 维度 | 典型取值 |
| --- | --- |
| 资源归属 | 自己创建、自己收藏、他人公开、他人私有、已删除 |
| 播放权益 | 免费、VIP、单曲付费、已购、无版权、地区受限、试听 |
| 资源状态 | 正常、空集合、超大集合、失效、下架 |
| 参数形态 | 最小必填、默认值、全部可选、缺失必填、空值、非法枚举、边界长度 |
| 分页状态 | 首页、中间页、末页、越界页、空页、游标续取 |
| 网络配置 | canonical、enhanced |
| 时间状态 | 首次调用、短时重复、跨日或到期后 |
| 平台状态 | Windows、macOS；仅平台相关接口才强制 |

### 4.3 组合规则

- 登录、媒体 URL、音质、账户权限和写操作采用关键维度完整矩阵，禁止仅做成对抽样。
- 普通只读接口在完成登录三层 smoke 后，可对剩余非关键维度采用 pairwise 成对组合。
- 每个 case 必须有稳定 caseId，格式建议为 apiAuditId.auth.resource.params.page.profile.sequence。
- 同一比较组只改变一个计划内变量；任何额外差异必须记录。
- 输出结构差异、字段出现率、值域差异和错误差异，不能只比较 HTTP 或业务 code。

### 4.4 测试账号规则

- 使用专用测试账号，不在个人主账号上执行写操作。
- 账号以匿名标签记录，例如 account-basic-01，不记录用户名。
- 所有 Cookie 只进入本机凭据存储和运行时内存。
- 缺少 VIP、已购或地区受限账号时统一登记测试缺口，集中向用户申请一次，不要逐接口反复询问。

## 5. 全量清单生成

### 5.1 发现流程

1. 读取 NcxMusic lockfile，确定真实安装版本。
2. 枚举安装包公开 exports。
3. 枚举 module 目录的全部 JavaScript 文件，并计算内容校验和。
4. 解析 interface.d.ts 中的函数、参数与公共类型。
5. 抓取同版本官方文档目录、路由及示例。
6. 枚举官方测试和示例中使用的接口名。
7. 求并集并生成 apiAuditId。
8. 对同名、别名、文件存在但未导出、文档存在但源码缺失等差异建立显式记录。
9. 每次升级依赖重新运行发现器，使用清单差异驱动增量审计。

### 5.2 清单字段

01-api-inventory.csv 和 JSON 至少包含：

- apiAuditId
- moduleName
- exportName
- route
- requestMethod 或 direct-call
- discoveredFrom
- moduleChecksum
- category
- frequency
- testPhase
- sideEffectClass
- authRequirementHypothesis
- paginationKind
- consumes
- produces
- aliasOf
- replacement
- deprecatedEvidence
- plannedCaseCount
- executedCaseCount
- terminalStatus
- reportPath
- blocker

discoveredFrom 必须是数组，保留 exports、module、types、docs、tests 等多个来源，不能在合并后丢掉差异。

### 5.3 零遗漏检查

完成时自动断言：

    universe - inventory = empty
    inventory - endpointReports = empty
    endpointReports - terminalStatuses = empty
    runtimeSamples - inventory = empty

任何差集非空都应让覆盖率任务失败。

## 6. 测试优先级：只决定顺序

| 阶段 | 内容 | 说明 |
| --- | --- | --- |
| P0 | 环境、身份、搜索、基础详情、状态和 ID 生产者 | 优先建立后续参数池 |
| P1 | 歌曲、音频、歌词、歌单、专辑、歌手、用户、推荐、评论 | 高频核心领域 |
| P2 | 排行、社交、MV、视频、DJ、电台、播客、广播、云盘等扩展读取 | 建立完整能力视图 |
| P3 | 收藏、歌单、评论、关注、签到等可逆或可核验写入 | 必须使用沙盒资源 |
| P4 | 上传、设备、地区、低频管理和环境相关接口 | 依赖更多夹具或平台 |
| P5 | 冷门、兼容别名、已废弃、支付、订单、账号高风险接口 | 最后执行，但必须给出终态 |

不能出现“P4/P5 因为首版不用所以不测”的结论。若不能正向执行，必须完成静态分析、负向探测、安全边界说明和明确终态。

## 7. 全局执行顺序与依赖图

测试运行器不能按文件名字母顺序盲跑。先建立接口之间的 consumes 和 produces 关系，再做拓扑排序。

### Phase 0：冻结和静态审计

- 生成 RUN MANIFEST。
- 生成 API Universe、模块校验和和来源差集。
- 解析每个模块的入参、默认值、请求方式、URL 路径和明显副作用。
- 建立初始分类、风险级别和参数需求。
- 在任何网络调用前运行秘密脱敏器自测。

### Phase 1：环境与会话

- 连通性、时间、版本与匿名会话。
- 未登录、游客、普通登录、无效 Cookie 的状态判定。
- 用户账户与用户详情，取得当前 uid。
- 若有授权测试账号，再建立 VIP 与已购资源分层。

### Phase 2：公共发现与 ID 生产者

- 搜索、综合搜索、热搜、搜索建议。
- 公共推荐、榜单、歌单分类和公开内容入口。
- 目标是产生免费、VIP、付费、无版权、歌手、专辑、歌单、MV、视频、DJ 等候选 ID。

### Phase 3：核心实体详情

- 歌曲详情。
- 歌单详情和全量歌曲。
- 专辑详情及歌曲。
- 歌手详情、热门歌曲、专辑、描述与相似歌手。
- 用户公开详情。

### Phase 4：播放媒体

- 音频 URL、歌词、新版歌词、歌曲可用性、权限和试听。
- 所有音质 level、账户权益、歌曲权益和 canonical/enhanced 差异。
- 媒体 URL 只做小范围探测，不下载完整音频。

### Phase 5：用户私有读取

- 用户歌单、我喜欢、播放排行、收藏、关注、粉丝、云盘和私有状态。
- 未登录、游客、自己、他人公开和他人私有条件对比。

### Phase 6：个性化与首页

- 每日推荐歌曲、推荐歌单、私人 FM、首页区块和相关个性化入口。
- 记录是否因时间、账号、历史或游标产生结构变化。

### Phase 7：评论与社交读取

- 歌曲、歌单、专辑、MV、视频、电台等评论。
- 热门评论、新版评论、楼层、点赞状态和相关社交读取。

### Phase 8：MV 与视频

- 详情、URL、相关推荐、标签、分类和播放权限。

### Phase 9：DJ、播客、直播与广播

- 先跑发现与分类，再跑详情、节目、URL、评论和用户状态。

### Phase 10：云盘与其他领域

- 云盘、听歌识曲相关、消息、动态、主题、数字内容及其他非核心域。
- 每个子域内部继续遵守“发现接口先于详情接口”。

### Phase 11：可逆写操作

- 喜欢与取消喜欢。
- 新建沙盒歌单、添加或移除测试歌曲、修改、删除。
- 评论发布与删除、点赞与取消、关注与取消等能完整回滚的操作。
- 签到等日期型或一次性接口单独按一次性协议执行。

### Phase 12：上传和高影响写操作

- 仅使用自动生成且不包含个人信息的测试图片或音频夹具。
- 头像、昵称、手机号、绑定、私信等真实账号高影响接口默认不做成功写入。
- 能在专用隔离账号安全回滚时，也必须先获得本次运行的明确授权。

### Phase 13：冷门和低频接口

- 逐项清空剩余清单，不能按主观用途合并成“其他已测”。

### Phase 14：废弃、别名、支付和不可逆接口

- 验证模块是否可导入、路由和参数是否仍存在。
- 验证别名与 canonical API 的结构关系。
- 做安全负向探测并记录成功路径为何未执行。

### Phase 15：复跑、差异和封板

- 从各类接口抽取代表样本复跑，验证测试期间合同没有漂移。
- 生成全局字段字典、未知字段台账、覆盖率和多变量差异。
- 检查所有沙盒写入均已回滚。
- 运行 Universe 零遗漏和秘密扫描门禁。

## 8. 参数血缘与全局夹具池

### 8.1 原则

参数池是测试系统的全局事实池，不是人工抄写的一组固定 ID。每个值必须携带：

- 参数名和实体类型。
- 原始值的内部安全引用；报告只显示脱敏值。
- 生产该值的 apiAuditId、caseId、响应 JSONPath 和采集时间。
- 所属账户或公共作用域。
- 权益、归属、状态等标签。
- 有效期、过期条件和最后一次验证时间。
- 是否敏感、能否进入提交层。

当消费者接口需要参数时，运行器按类型和标签从池中选择。若没有满足条件的值，调度器先运行对应生产者，而不是向用户询问。

### 8.2 典型血缘链

| 生产者 | 产物 | 消费者 |
| --- | --- | --- |
| 搜索、推荐、排行榜 | songId | 歌曲详情、音频 URL、歌词、可用性、评论、喜欢 |
| 歌曲详情 | artistId、albumId、版权候选 | 歌手、专辑、权益分类 |
| 音频 URL API | mediaUrl、实际音质、有效期 | Range 媒体探测、播放合同分析 |
| 账户状态、用户账户 | uid | 用户详情、歌单、播放排行、关注和粉丝 |
| 用户歌单、公共歌单发现 | playlistId、归属 | 歌单详情、全量歌曲、收藏和写操作 |
| 歌单详情 | trackId、trackCount | 批量歌曲详情、添加或移除沙盒歌曲 |
| 评论列表 | commentId、threadId | 楼层、点赞、回复和删除沙盒评论 |
| 歌手详情或搜索 | artistId、mvId | 歌手扩展、MV 详情和 URL |
| DJ 或播客发现 | djId、radioId、programId | 详情、节目、URL 和评论 |
| 首页或列表响应 | cursor、hasMore | 下一页请求 |
| 云盘列表 | cloudSongId 或资源引用 | 云盘详情、匹配和删除安全分析 |

重要纠偏：不能预设歌曲详情一定返回可播放音频 URL。应先从搜索或详情得到 songId，再由专门的音频 URL 接口产生 mediaUrl。

### 8.3 参数定义表

每个接口报告的参数表至少包含：

| 字段 | 说明 |
| --- | --- |
| name | 源码中的参数名 |
| rawType | 锁定版本接收的原始类型 |
| required | 必填、可选或条件必填 |
| default | 源码默认值 |
| enumOrRange | 已知枚举、数值或长度范围 |
| sensitive | 是否包含秘密或个人数据 |
| evidence | 源码、类型、文档、测试或运行错误 |
| sourceStrategy | 固定夹具、上游接口、运行环境或用户提供 |
| producerApi | 参数生产者 |
| producerPath | 响应 JSONPath |
| transform | 拼接、数组转字符串、时间转换等 |
| validFixtures | 正向样本类型 |
| invalidCases | 缺失、空值、错误类型、非法枚举和越界值 |

### 8.4 参数证据优先级

输入参数以锁定版本的模块实现为第一证据，类型声明、官方文档、官方测试和运行错误依次辅助。输出字段以真实运行样本为第一证据，源码和文档用于解释。

如果来源互相冲突，不选择性忽略。报告必须列出每个来源的说法，并说明运行器最终使用哪一种形态。

### 8.5 允许询问用户的事项

只有以下事项可以中断并询问：

- 登录 Cookie、短信验证码、二维码确认等不能从 API 自动生产的凭据动作。
- 当前缺失但确属测试目标所需的 VIP、已购或特殊地区账号。
- 是否授权本次运行在专用账号上执行特定高影响写操作。
- 无法自动生成且确有必要的真实硬件或平台环境。

提问必须按阶段合并，一次列出缺少的前置条件；不得在每个接口遇到同一问题时重复询问。

## 9. 每类接口的最低调用次数

以下数字是最低运行次数，不含静态分析。一个请求即使返回业务错误，只要确实发出且证据完整，可以计入对应负向 case；不能把未调用的静态推断计入次数。

| 接口类型 | 最低运行用例 | 强制构成 |
| --- | ---: | --- |
| 简单安全读取 | 6 | 未登录、游客、登录、最小参数、完整可选参数、一个负向参数 |
| 搜索、列表、分页 | 10 | 三种登录态、至少两个查询或资源、首/中/末/越界或空页、一个非法参数 |
| 有枚举或条件分支的读取 | max(8, 枚举值数 + 基线) | 覆盖每个枚举、默认值、缺失和非法枚举 |
| 登录、权限或资源状态接口 | 8 起 | 必需登录层乘至少两个资源夹具，再加重复与负向；实际完整矩阵可能更多 |
| 媒体 URL 与音质 | 专项矩阵 | 9 个音质档位乘适用账号层和代表歌曲类型，再加 canonical/enhanced |
| 可逆写操作 | 目标接口至少 4 次 | 有效、重复或幂等、未登录、非法参数；另执行读回验证和逆操作 |
| 沙盒资源删除或高影响操作 | 目标接口至少 4 次 | 仅测试资源：有效、重复、错误归属、未登录，并含前后快照 |
| 签到等一次性接口 | 3 | 首次合法、同日重复、未登录或非法类型 |
| 上传 | 7 | 小合法文件、另一格式、空文件、超限、错误 MIME、未登录、无效目标 |
| 废弃或别名 | 5 | 未登录、游客、登录、非法参数、与 canonical 对照 |
| 付费或不可逆安全接口 | 2 个负向探测起 | 加静态分析、模块导入和请求构造；默认不跑真实成功路径 |

### 9.1 结构稳定性停止规则

达到最低次数后，还必须满足：

- 连续 3 个有差异的成功样本没有出现新的 JSONPath 或新类型。
- 这 3 个样本不能是同一请求的机械重复，至少要改变资源、页码、账号或可选参数。
- 每个登录分层单独判断稳定性，不能让 AUTH_USER 的稳定覆盖 AUTH_NONE。
- 空数组不能证明数组元素结构稳定；必须继续寻找非空样本，找不到则标 array<unknown> 并登记缺口。
- 单一 null 不能决定非空时的类型。

一般接口每个分层最多 20 次；达到 20 次仍不断出现新路径或类型时，标记 schema_unstable，记录变化条件并停止无上限采样。专项媒体和明确分页遍历可超过 20 次，但必须在 RUN MANIFEST 中说明预算。

### 9.2 音质专项矩阵

对 song_url_v1 或锁定版本中的等价接口，必须覆盖当前官方文档列出的：

- standard
- higher
- exhigh
- lossless
- hires
- jyeffect
- sky
- dolby
- jymaster

代表歌曲至少包含免费、VIP、单独付费、已购买、无版权或受限、仅低音质可用等实际可取得类型。对每次请求记录请求档位、实际返回档位、URL 是否为空、试听信息、码率、格式、大小、有效期和错误。AUTH_USER、AUTH_VIP、AUTH_PURCHASED 按可取得条件完整交叉；同时比较 canonical 与 enhanced。

若某类资源或账号无法取得，不允许删去矩阵行，应保留为 blocked_by_prerequisite。

## 10. 单个 API 的标准执行工作流

每个接口都按以下步骤执行，不能只保存响应 JSON：

1. 建立静态档案：模块、导出、路由、请求方法、参数读取、默认值、Cookie 使用、副作用和源码证据。
2. 解析前置条件：列出需要的 ID、账号、文件、游标或前序状态。
3. 从夹具池取值；缺失时触发生产者 API 并记录血缘。
4. 生成多变量 case 矩阵并计算计划用例数。
5. 写入前置快照：读取目标状态，记录资源归属和测试前值。
6. 执行调用：捕获开始时间、结束时间、输入摘要、响应状态、body、headers、重定向和异常。
7. 运行字段分析：抽取 JSONPath、原始类型、出现率、空值率、数组元素类型和值域。
8. 在相邻 case 间做结构和语义差异，特别标注登录、权益和资源归属差异。
9. 若有副作用，调用独立读取接口验证真实状态，不能只相信写接口返回的成功文案。
10. 执行逆操作并再次读取验证；把回滚结果写入 rollback-journal。
11. 把新产生的 ID、游标和资源标签写回全局夹具池。
12. 生成接口报告，更新覆盖率与终态。

### 10.1 重试

- 纯读取遇到网络超时、连接重置或明确 5xx，可对完全相同请求最多重试 3 次，建议退避 2、5、15 秒。
- 遇到明确限流时使用 30 秒起的退避并降低全局速率；不得多账号并发规避。
- 登录态过期可刷新一次，再以新 caseId 记录，不覆盖旧失败样本。
- 写操作、签到、评论、关注、上传、购买或账号操作不得透明自动重试。必须先读回状态判断是否已经生效。
- 同一错误在三个独立时点稳定复现后可标 failed_stable，不进行无限重试。

### 10.2 超时与取消

每个调用记录连接超时、总超时和是否支持 AbortSignal。取消结果必须与超时区分。若库不支持真实取消，要在报告中指出进程级中断风险。

## 11. 字段类型与语义分析

### 11.1 原始类型表示

字段字典使用以下类型，不把方便业务使用的转换结果伪装成 API 原始类型：

- string
- integer
- number
- boolean
- null
- object
- array<T>
- union<A | B>
- unknown

规则：

- 数字字符串仍是 string。
- ID 在标准实体层优先保存为 string，特别是可能超过 JavaScript 安全整数范围时；但字段字典仍记录原始类型。
- 毫秒时间戳仍记为 integer，并额外标注 timestampMillis 候选语义。
- 0/1 形式的布尔值仍记录为 integer，并注明 booleanEncoding 候选。
- missing 与 null 是两种不同状态。
- 空数组先记 array<unknown>，直到取得非空样本。
- 同一路径出现不同类型时记 union，并列出触发条件和每种比例。

### 11.2 字段字典列

04-field-dictionary.csv 至少包含：

- apiAuditId
- jsonPath
- rawType
- elementType
- requiredObserved
- presenceCount
- sampleCount
- nullCount
- emptyCount
- exampleRedacted
- valueRangeOrEnum
- authConditions
- resourceConditions
- firstSeenCase
- lastSeenCase
- semanticName
- semanticConfidence
- sourceEvidence
- normalizedEntity
- normalizedField
- conflictId

requiredObserved 只能表达观察结果，例如 20/20 样本存在；不能直接声称上游永远必填。

### 11.3 响应信封和领域字段

必须区分：

- 传输或库层：状态、headers、cookies、异常。
- 通用业务信封：code、message、msg、data 等。
- 领域实体：歌曲、用户、歌单、评论等真实字段。

不同接口同名的 code 或 data 不自动认定语义相同。字段合并进入 NcxMusic 全局字段池前必须有实体 ID 和来源规则。

### 11.4 未知字段流程

任何无法确定含义的字段进入 05-unknown-fields.md，至少记录：

- apiAuditId 和完整 JSONPath。
- 原始类型、脱敏示例、出现率和首次样本。
- 出现在哪些登录态、资源类型、参数或错误条件。
- 与哪些字段共同出现，是否随某变量一起变化。
- 源码、类型、文档和官方测试中的线索。
- 当前解释假设与反例。
- 需要什么补测才能确认。
- 负责人和状态。

语义置信度固定使用：

| 值 | 含义 |
| --- | --- |
| confirmed_runtime | 多变量运行结果直接证明 |
| confirmed_source | 锁定版本源码明确命名或计算 |
| inferred | 有较强关联但尚未直接证明 |
| unknown | 没有足够证据 |
| conflicting | 运行、源码、类型或文档互相冲突 |

inferred、unknown 和 conflicting 字段不得直接进入标准领域模型、UI 文案、用户画像或小云系统提示词。可以保留在原始扩展字段中，等待后续解析。

### 11.5 冲突处理

当文档、类型、源码和运行结果不一致时：

1. 创建 conflictId。
2. 原样列出每个来源及其版本。
3. 对返回字段，锁定版本运行结果作为当前 Adapter 的事实基线。
4. 对入参，以锁定版本源码实际读取方式决定测试调用，但继续测试文档形态。
5. 说明兼容策略，例如接受两个枚举但运行时降级。
6. 依赖升级后强制重跑该冲突的全部 case。

## 12. 特殊接口测试协议

### 12.1 分页和游标

- 记录 limit、offset、page、cursor、before、time 等所有分页形态。
- 依次测试首项、中间、最后一页、恰好边界、越界和空数据。
- cursor 必须复用上一次响应原值，记录生产 caseId。
- 校验重复项、漏项、排序稳定性、hasMore 与实际数据是否一致。
- 对时间变化强的数据，只验证接口合同和相邻页一致性，不错误声称全量快照永久稳定。

### 12.2 媒体 URL

不下载完整音乐或视频。优先 HEAD；服务不支持时使用：

    Range: bytes=0-1

记录状态码、重定向链、Content-Type、Content-Length、Accept-Ranges、实际返回字节数、URL 到期字段和探测耗时。报告中的 URL 必须移除 query、签名和主机级敏感信息，只保留 URL 形态摘要与哈希。

同一临时 URL 在签发后立即、接近声明到期前和到期后各探测一次；若测试周期不允许，应标记有效期未完全验证。

### 12.3 图片尺寸

- 对网易云图片 URL 的 param 或锁定版本等价参数测试多个宽高组合。
- 至少覆盖 thumbnail、compact、card、feature、hero 对应的候选尺寸。
- 验证 Content-Type、像素尺寸、传输体积、缓存键、已有 query、已有 param、空 URL、外域 URL 和失效 URL。
- 业务语义尺寸只有实测后才能冻结为 Adapter 常量。

### 12.4 可逆写操作

所有测试资源使用统一前缀：

    NCXMUSIC_API_TEST_<runId>

八阶段场景：

1. 创建或选择本轮沙盒资源。
2. 读取并保存前置状态。
3. 合法写入。
4. 独立读取验证。
5. 重复写入，判断幂等、重复项或错误。
6. 执行未登录、错误归属或非法参数负向用例。
7. 执行逆操作或删除沙盒资源。
8. 再次读取确认完全回滚。

若回滚失败，立即停止该冲突域后续写测试，记录 orphan 资源、人工清理步骤和风险，不得继续制造更多残留。

### 12.5 一次性和日期型操作

签到、每日领取或只能执行一次的接口，不追求多个成功样本。记录首次成功、同日重复、未登录或错误类型。需要跨日验证时建立新的 runId 或明确的跨日子运行，不能伪造系统时间欺骗线上服务。

### 12.6 上传

- 只使用脚本生成的无个人信息夹具，并记录哈希、MIME、像素或时长和字节数。
- 覆盖两个合法格式、空文件、错误 MIME、边界大小、超限大小、未登录和无效目标。
- 上传成功后用独立详情接口验证；如生成远程资源，必须回滚。
- 不上传用户真实头像、录音或本地文件。

### 12.7 缓存与重复请求

同一读取请求短时重复至少一次，记录响应耗时、缓存相关 headers、易变字段和结构是否一致。重复请求只用于幂等和缓存分析，不能代替“有差异的稳定性样本”。

### 12.8 支付、购买与账号不可逆接口

这类接口仍必须存在于 inventory 和 endpoint report，但默认流程为：

1. 源码、类型、文档与路由静态分析。
2. 验证模块可导入。
3. 验证参数构造和脱敏，不提交订单。
4. 使用缺失必填、未登录或明显无效沙盒资源做至少两个负向探测。
5. 记录成功路径需要的账号、资金、授权和回滚条件。
6. 终态标记 blocked_by_safety，除非用户另行提供隔离环境和明确授权。

它们不得因此注册进 NcxMusic 首版 Agent Gateway；C-088 和 D-208 的生产范围不变。

### 12.9 Cookie 与登录状态

网页登录成功后得到的 Cookie 只保存在隔离 Session 和本机凭据层。针对锁定版本，至少比较：

- 完全不传 cookie 参数。
- 只传规范化的 MUSIC_U=<value> Cookie 字符串。
- 传登录窗口捕获并筛选后的完整必要 Cookie 集。
- 只传裸 MUSIC_U 值而不带键名，用于证明是否为错误形态。
- 传截断、随机和已过期的 MUSIC_U。
- 游客接口生成的会话。
- 用户退出后的旧 Cookie。

用登录状态、用户账户和用户详情三个独立读取入口交叉验证，不只相信单个 code。记录 uid 是否一致、昵称等身份字段是否存在、失效是否明确、是否静默回退游客以及响应中是否轮换 Cookie。原始 Cookie 和 Set-Cookie 不进入报告，只记录 cookie 形态、哈希、生成时刻和本机 generation。

测试结论应明确锁定版本实际需要的传参字段及格式，再由 NcxMusic API Adapter 统一附带；Renderer、Prompt 和 Tool 参数始终不接触 Cookie。

## 13. 单接口报告模板

每个 apiAuditId 生成一个独立 Markdown 文件，文件名使用规范化 ID。不能把同类接口只写成一份汇总。

### 13.1 Markdown 模板

    # <apiAuditId> / <exportName>

    ## 1. 元数据
    - 包版本：
    - 模块校验和：
    - 导出名：
    - 路由或调用方式：
    - 文档链接：
    - 分类与频率：
    - 副作用级别：
    - 最终状态：

    ## 2. 已知用途与证据
    - 源码：
    - 类型：
    - 文档：
    - 官方测试：
    - 冲突：

    ## 3. 参数契约
    <使用参数定义表>

    ## 4. 参数血缘
    - consumes：
    - producer api：
    - producer case：
    - JSONPath：
    - produces：

    ## 5. 测试矩阵
    | caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |

    ## 6. 响应信封
    - transport：
    - business code：
    - error shapes：

    ## 7. 字段表
    | JSONPath | rawType | presence | null | conditions | example | meaning | confidence |

    ## 8. 多变量差异
    - 未登录 vs 游客：
    - 游客 vs 普通登录：
    - 普通 vs VIP：
    - 未购 vs 已购：
    - 自有 vs 他人资源：
    - 默认参数 vs 显式参数：

    ## 9. 分页、缓存和时效

    ## 10. 副作用与回滚
    - pre snapshot：
    - write result：
    - read-after-write：
    - rollback：
    - orphan：

    ## 11. 未知字段与冲突

    ## 12. NcxMusic 结论
    - 当前 Adapter 能否开发：
    - 标准实体映射：
    - 降级策略：
    - 是否建议进入 Capability Catalog：
    - 建议权限级别：
    - 尚未完成事项：

### 13.2 机器可读报告

每个接口同时输出 JSON，至少包含：

    {
      "schemaVersion": 1,
      "runId": "...",
      "apiAuditId": "ncm.song_detail",
      "packageVersion": "...",
      "moduleChecksum": "...",
      "classification": {
        "category": "song",
        "frequency": "high",
        "sideEffect": "read"
      },
      "sources": [],
      "parameters": [],
      "dependencies": {
        "consumes": [],
        "produces": []
      },
      "matrix": {
        "planned": 0,
        "executed": 0,
        "cases": []
      },
      "fields": [],
      "errors": [],
      "sideEffectVerification": null,
      "unknownFieldIds": [],
      "conflictIds": [],
      "terminalStatus": "passed",
      "blocker": null,
      "evidence": []
    }

机器 JSON 必须通过版本化 Schema 校验。Markdown 是给人阅读的结论，JSON 是覆盖率、差异检查和未来依赖升级的输入，两者不能互相替代。

## 14. 汇总报告与质量指标

### 14.1 覆盖率

02-coverage-summary.md 至少展示：

- Universe 总数。
- 按来源发现的数量及差集。
- 各阶段总数与完成数。
- 各终态数量。
- 有运行样本的接口数。
- 满足最低用例数的接口数。
- 满足稳定性停止规则的接口数。
- 多变量矩阵覆盖率。
- 写操作回滚成功率和孤儿资源数。
- 未知字段数、冲突数、已解决数。
- 发现但未报告、已报告但无终态的差集。

建议同时输出以下公式：

    inventoryCoverage = reportedApiCount / universeApiCount
    runtimeCoverage = runtimeTestedApiCount / runtimeEligibleApiCount
    matrixCoverage = executedRequiredCases / plannedRequiredCases
    rollbackSuccess = verifiedRollbackCount / attemptedWriteScenarioCount
    fieldEvidenceCoverage = evidencedFieldCount / discoveredFieldCount

blocked_by_safety 计入 inventoryCoverage，但不计入 runtimeEligibleApiCount 的成功路径分母；必须单独展示，不能用它抬高运行通过率。

### 14.2 多变量差异报告

07-multivariable-diff.md 按接口输出：

- 只在某登录态出现或消失的 JSONPath。
- 同一路径在不同登录态的类型变化。
- 业务 code、错误结构和回退行为变化。
- VIP、已购和资源状态对 URL、实际音质、试听和权限字段的影响。
- 自有、他人、公开、私有资源的操作权限差异。
- 默认参数与显式参数是否真的改变结果。
- canonical 与 enhanced 配置差异。

报告既要列差异，也要列“确认无结构差异”的证据，避免把未比较误写成相同。

### 14.3 Capability 候选报告

09-capability-candidates.md 只做建议，不直接改 Tool Registry。每个候选包含：

- capabilityId 建议。
- 对应 apiAuditId。
- 用户意图和自然语言例子。
- 参数如何通过 Entity Resolver 获得。
- 读取或副作用分类。
- 建议音乐权限级别。
- 是否适合核心业务 Tool、组合 Skill 或冷门 Gateway。
- 是否被首版范围或安全规则排除。
- 字段合同是否足以开发。

支付、购买、订阅、下单接口即使审计完成，也必须明确标记 productionExcluded。

## 15. DeepSeek 执行纪律与分阶段交付

开始任务时可以直接给 DeepSeek 以下指令：

    完整阅读 docs/api/NcxMusic-API-First-Full-Audit-Playbook.md，并把它作为本轮 API 审计的强制执行合同。
    先完成 Phase 0 的版本冻结、全量发现、风险分类和计划矩阵，不要立即批量请求线上 API。
    等 Phase 0 产物通过零遗漏与脱敏自检后，再按依赖拓扑逐阶段执行。
    所有 API 都必须进入清单并获得终态；优先级只决定顺序。
    所有可调用接口强制比较未登录、游客、普通登录，并按手册扩展权益、归属、分页和参数变量。
    不猜 ID、不猜字段、不伪造样本；复用生产者 API 的参数并记录血缘。
    每个阶段提交检查点报告，发生安全阻塞、限流或回滚失败时按手册停止。

可以使用共享的调用器、采集器、脱敏器和字段分析器，避免复制数百份相同基础代码；但每个 apiAuditId 必须有独立的声明式测试规格、用例矩阵和报告。任何自动生成的规格仍要通过静态源码审查，不能仅根据函数名猜参数。

### 15.1 不允许一次性黑盒长跑

执行 Agent 应按 Phase 交付检查点，每个检查点都包含：

- 本阶段计划接口数、已完成数和终态分布。
- 新增参数产物和仍缺少的夹具。
- 新增未知字段、冲突和安全阻塞。
- 请求数量、限流情况和预计下一阶段影响。
- 本阶段写操作回滚结果。
- 生成文件列表和校验结果。

前一阶段的 Universe、血缘或脱敏门禁未通过时，不进入大规模后续调用。

### 15.2 阻塞处理

- 缺少上游参数：先运行生产者或扩大公共发现样本。
- 返回空集合：换另一个有标签的资源夹具，不直接认定无字段。
- 缺少登录层：继续完成可执行层，并把所需账号合并到一份申请。
- 发生限流：暂停对应域、退避、降低并发，保留现场。
- 写入结果不明：立刻读回，不盲目重试。
- 回滚失败：停止同冲突域所有后续写操作。
- 文档找不到：继续从实际安装包源码、类型和运行错误取证，不把“无文档”写成“无接口”。
- 含义无法判断：登记 unknown，不编造语义。

### 15.3 完整性自检

每个阶段结束必须回答：

1. 本阶段计划集合与报告集合的差集是什么？
2. 哪些接口没有达到最低调用次数，原因是什么？
3. 哪些接口没有完成未登录、游客、登录三层比较？
4. 哪些数组只得到空样本，元素类型仍未知？
5. 哪些写操作没有读回验证或回滚？
6. 哪些原始样本没有脱敏副本或哈希？
7. 哪些字段被猜测性命名，是否已撤回到 unknown？
8. 下一阶段需要复用哪些参数，血缘是否完整？

## 16. 三个参考工作流

### 16.1 搜索到可播放媒体

1. 用两个不同关键词分别在未登录、游客、普通登录下测试搜索。
2. 从搜索结果把 songId、artistId、albumId 连同来源 JSONPath 写入池。
3. 用 songId 测歌曲详情，补齐权益与实体字段。
4. 按歌曲类型、账号层和 9 个音质 level 调用音频 URL。
5. 对非空 URL 做 HEAD 或 0 至 1 字节 Range 探测。
6. 用同一 songId 测歌词、新版歌词、歌曲可用性和评论。
7. 对比搜索与歌曲详情重复字段，记录权威性、完整度和冲突。

该链路中只有搜索关键词可能来自预设词表；歌曲 ID、专辑 ID、歌手 ID 和音频 URL 都必须由上游响应自动生产。

### 16.2 用户歌单的登录差异

1. AUTH_NONE 调用用户歌单：保存错误或公开数据结构。
2. AUTH_ANON 使用同一 uid：观察是否等价于未登录。
3. AUTH_USER 查询自己的 uid：覆盖自建、收藏、空组和分页。
4. AUTH_USER 查询另一个公开用户：比较私有字段和权限字段。
5. AUTH_INVALID 查询自己的 uid：观察是否明确失效、静默游客化或部分返回。
6. 若接口支持 limit 和 offset，完整跑首页、中间、末页和越界页。
7. 把 playlistId、creatorId、trackCount、归属标签和分页值写回池。

### 16.3 歌单可逆写场景

1. AUTH_USER 创建名为 NCXMUSIC_API_TEST_<runId> 的空歌单。
2. 读取详情确认 creatorId 和初始 trackCount。
3. 从免费测试歌曲池选一个 songId，添加一次并读回。
4. 重复添加，判断幂等或重复处理。
5. 用未登录、错误 playlistId 和他人 playlistId 做负向用例。
6. 移除该歌曲并读回，确认 trackCount 恢复。
7. 修改沙盒歌单名称或描述，再恢复或直接删除。
8. 删除整个沙盒歌单并确认详情不可再读或不再出现在用户歌单中。
9. 任一步失败都写入 rollback-journal，并停止继续创建新歌单。

## 17. 最终验收清单

### 17.1 清单完整

- [ ] 已从实际安装版本自动发现全部 exports、module、types、docs 和 tests 项。
- [ ] 所有差集都有记录，没有人工忽略项。
- [ ] 冷门、低频、废弃、别名和敏感接口均有 endpoint report。
- [ ] 每个 apiAuditId 都有唯一终态。

### 17.2 运行充分

- [ ] 每个可运行接口达到对应类型的最低次数。
- [ ] 达到三次有差异样本的结构稳定性规则，或明确标为 schema_unstable。
- [ ] 所有接口完成未登录、游客、普通登录三层 smoke，或给出可验证的不适用证据。
- [ ] 音频、权限和写操作完成关键维度完整矩阵。
- [ ] VIP、已购或特殊地区缺口没有被普通账号结果替代。

### 17.3 字段可信

- [ ] 每个 JSONPath 有原始类型、出现率、空值和样本证据。
- [ ] missing、null、空数组和 union 被正确区分。
- [ ] 未知字段全部进入台账。
- [ ] 文档、类型、源码和运行冲突均有 conflictId。
- [ ] 未确认字段没有进入 NcxMusic 标准实体或 Agent Prompt。

### 17.4 安全与可恢复

- [ ] Git 中不存在 Cookie、MUSIC_U、CSRF、手机号、邮箱、签名 URL 或其他秘密。
- [ ] 所有写操作只使用本轮沙盒资源。
- [ ] 所有可逆写入均有独立读回和回滚证明。
- [ ] orphan 资源数量为零；若不为零，审计不能标记完全通过。
- [ ] 支付和不可逆接口没有在未授权环境执行成功路径。

### 17.5 可开发

- [ ] 参数池可以自动提供页面和 Agent 所需的实体 ID，不依赖模型猜测。
- [ ] 字段字典足以定义 API Adapter 与标准实体。
- [ ] 多变量差异足以定义游客、登录、VIP、付费和不可播放 UI。
- [ ] Capability 候选与生产安全范围分离。
- [ ] 依赖升级后可以用同一套清单和报告自动做合同差异。

只有五组验收均完成，才允许把本轮标为“全量 API 审计完成”。部分接口被 blocked_by_safety 或 blocked_by_prerequisite 并不等于伪造通过；只要清单、证据、缺口和补测条件完整，它们可以构成诚实的全量能力认知。

## 18. 官方参考

- 官方文档：https://neteasecloudmusicapienhanced.js.org/
- 官方仓库：https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced
- 包 README 与直接 Node.js 调用方式：https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/README.md
- 类型声明：https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/interface.d.ts
- 模块目录：https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/tree/main/module

执行报告必须进一步固定到本次 lockfile 对应的 tag、commit 或安装包哈希，不能只链接会持续变化的 main 分支。
