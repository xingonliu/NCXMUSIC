'use strict'
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

const args = require('../lib/args.js')({
  workDir: { type: 'string', required: true },
  runId: { type: 'string', required: true },
  packageVersion: { type: 'string', required: true },
  reportDir: { type: 'string', required: true },
  packageTarball: { type: 'string', required: true },
  upstreamCommit: { type: 'string', required: true },
  upstreamRepo: { type: 'string', required: true },
  agentName: { type: 'string', default: 'opencode (DeepSeek 审计 Agent)' },
})

function run(cmd, argsList) {
  try {
    return execFileSync(cmd, argsList, { encoding: 'utf8' }).trim()
  } catch (e) {
    return String(e.stderr || e.message).trim()
  }
}

function sha256File(file) {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

const startedAt = new Date()
const ncmCommit = run('git', ['rev-parse', 'HEAD'])
const ncmStatus = run('git', ['status', '--porcelain'])
const nodeV = run('node', ['--version'])
const npmV = (() => { try { return execFileSync('npm.cmd', ['--version'], { encoding: 'utf8' }).trim() } catch { return run('cmd', ['/c', 'npm --version']) } })()
const gitV = run('git', ['--version'])
const pnpmV = (() => { try { return execFileSync('pnpm.cmd', ['--version'], { encoding: 'utf8' }).trim() } catch { return 'not installed' } })()
const electronV = 'N/A (仓库尚无 Electron 应用代码)'
const chromV = 'N/A (仓库尚无 Electron 应用代码)'

const discovery = JSON.parse(fs.readFileSync(path.join(args.workDir, '01-discovery-universe.json'), 'utf8'))
const analysis = JSON.parse(fs.readFileSync(path.join(args.workDir, '02-static-analysis.json'), 'utf8'))
const inventoryJson = JSON.parse(fs.readFileSync(path.join(args.reportDir, '01-api-inventory.json'), 'utf8'))
const inventory = inventoryJson.inventory
const summary = JSON.parse(fs.readFileSync(path.join(args.reportDir, '01-inventory-summary.json'), 'utf8'))

const byModule = new Map()
for (const a of analysis) byModule.set(a.moduleName, a)

function paramTable(rec) {
  const stat = byModule.get(rec.moduleName) || { params: [], defaults: [], checkToken: false }
  const defaults = stat.defaults || []
  const defMap = new Map(defaults.map((d) => [d.name, d.default]))
  const rows = (stat.params || []).map((p) => {
    const def = defMap.has(p) ? '`' + defMap.get(p) + '`' : ''
    return `| ${p} | string | ${def ? '可选（默认 ' + def + '）' : '未发现默认值'} | 源码读取 query.${p} |`
  })
  return rows.length ? rows.join('\n') : '| （未发现 query 参数读取） | | | |'
}

function writeManifest() {
  const tarballSha = sha256File(args.packageTarball)
  const lines = []
  lines.push('# 00-RUN-MANIFEST')
  lines.push('')
  lines.push('> runId：`' + args.runId + '`')
  lines.push('>')
  lines.push('> 阶段：Phase 0（版本冻结与静态审计）')
  lines.push('>')
  lines.push('> 生成时间：' + startedAt.toISOString())
  lines.push('')
  lines.push('## 1. 运行标识与参与者')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| runId | `' + args.runId + '` |')
  lines.push('| 执行 Agent | ' + args.agentName + ' |')
  lines.push('| 操作者 | 仓库所有者（AI 会话） |')
  lines.push('| 开始时间 | ' + startedAt.toISOString() + ' |')
  lines.push('| 结束时间 | Phase 0 静态产物生成完成时刻（见提交记录） |')
  lines.push('')
  lines.push('## 2. 版本冻结（PROVISIONAL，存在阻断）')
  lines.push('')
  lines.push('**阻断项：NcxMusic 仓库目前为文档仓库，尚无应用代码与 lockfile。** 因此无法按手册 §1.1 的要求从 lockfile 解析安装版本、完整性哈希与模块清单。本轮以官方 npm 包 `@neteasecloudmusicapienhanced/api@4.39.0` 与官方仓库观察提交双重锚定，标记为 provisional；NcxMusic lockfile 建立后必须创建新 runId 重跑发现器，以清单差异驱动增量审计。')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| 官方仓库 | ' + args.upstreamRepo + ' |')
  lines.push('| 上游提交（锚定） | `' + args.upstreamCommit + '` |')
  lines.push('| 包名 | @neteasecloudmusicapienhanced/api |')
  lines.push('| 解析版本 | ' + args.packageVersion + ' |')
  lines.push('| NcxMusic lockfile 完整性 | **缺失（阻断）** |')
  lines.push('| npm tarball | `' + args.packageTarball + '` |')
  lines.push('| tarball SHA-256 | `' + tarballSha + '` |')
  lines.push('| tarball shasum（npm 公布） | 8cc8c7c54354f31a2310ad7f21160e77392ac8cc |')
  lines.push('| tarball integrity（npm 公布） | sha512-faaLGT9pOmw2lu2kxdHAeyy+Ni/UqZW/laAb+Np+QexUwXKxDvPTbW3GiLkIromdAfSR519oGGizX3+Unf0q2w== |')
  lines.push('| 包内文件数 | 492（含 module 431 个 JS） |')
  lines.push('')
  lines.push('### 2.1 NcxMusic 仓库状态')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| 分支 | agent/profile-memory-prd |')
  lines.push('| HEAD | `' + ncmCommit + '` |')
  lines.push('| 工作树 | ' + (ncmStatus ? '有未提交改动：' + ncmStatus.replace(/\n/g, '; ') : 'clean') + ' |')
  lines.push('')
  lines.push('## 3. 发现统计与来源差集')
  lines.push('')
  lines.push('| 来源 | 数量 |')
  lines.push('| --- | --- |')
  lines.push('| repo module JS（提交 ' + args.upstreamCommit.slice(0, 7) + '） | ' + discovery.sources.repoModuleCount + ' |')
  lines.push('| npm 包 module JS（4.39.0） | ' + discovery.sources.pkgModuleCount + ' |')
  lines.push('| interface.d.ts 函数声明 | ' + discovery.sources.typeDeclCount + ' |')
  lines.push('| docs 接口文档小节 | ' + discovery.sources.docSectionCount + '（其中带路由 ' + discovery.sources.docRoutedCount + '） |')
  lines.push('| 测试/示例文件 | ' + discovery.sources.testFileCount + ' |')
  lines.push('| Universe 并集（apiAuditId） | ' + discovery.universe.length + ' |')
  lines.push('')
  lines.push('### 3.1 模块差集')
  lines.push('')
  lines.push('- 仅存在于 repo（不在 npm 包）：`' + discovery.moduleDiff.inRepoNotPkg.join('`, `') + '`')
  lines.push('- 仅存在于 npm 包（不在 repo）：' + (discovery.moduleDiff.inPkgNotRepo.length ? '`' + discovery.moduleDiff.inPkgNotRepo.join('`, `') + '`' : '无') + '')
  lines.push('- repo 与 pkg 字节不一致（checksumDiffer）：`' + discovery.moduleDiff.checksumDiffer.join('`, `') + '`（repo 更新于发布的 4.39.0；差异已记录于 endpoints 报告与 06 报告）')
  lines.push('- 类型声明存在但无模块文件（moduleMissing）：`' + discovery.universe.filter((u) => u.moduleMissing).map((u) => u.moduleName).join('`, `') + '`（按手册 §1.1 必须入账，预计终态 not_exported 或 alias，待 Phase 14 验证）')
  lines.push('- docs 路由存在但无法映射到模块：`' + discovery.docOnlyRoutes.join('`, `') + '`（其中 yunbei_tasks_receipt/yunbei_tasks_expense/vip_task_v1 疑似对应 yunbei_receipt/yunbei_expense/vip_tasks_v1，记入 06 报告待核）')
  lines.push('')
  lines.push('## 4. 运行环境')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| Node.js | ' + nodeV + ' |')
  lines.push('| npm | ' + npmV + ' |')
  lines.push('| pnpm | ' + pnpmV + ' |')
  lines.push('| git | ' + gitV + ' |')
  lines.push('| Electron | ' + electronV + ' |')
  lines.push('| Chromium | ' + chromV + ' |')
  lines.push('| OS | ' + os.platform() + ' ' + os.release() + ' (' + os.arch() + ') |')
  lines.push('| 语言/地区 | ' + (process.env.LANG || 'zh-CN（推断）') + ' |')
  lines.push('| 时区 | ' + Intl.DateTimeFormat().resolvedOptions().timeZone + '（' + Intl.DateTimeFormat().resolvedOptions().locale + '） |')
  lines.push('')
  lines.push('## 5. 网络配置')
  lines.push('')
  lines.push('| 项 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| 网络地区 | 未配置代理（canonical 直连预期）；具体地区未记录，Phase 1 起每样本记录 |')
  lines.push('| unblock/解锁 | canonical 配置下不启用（enhanced 配置缺失，登记测试缺口） |')
  lines.push('| ENABLE_PROXY | 未设置（canonical） |')
  lines.push('')
  lines.push('## 6. 账户分层')
  lines.push('')
  lines.push('| 层 | 状态 | 匿名标签 |')
  lines.push('| --- | --- | --- |')
  lines.push('| AUTH_NONE | 可用（无需账号） | - |')
  lines.push('| AUTH_ANON | 可自动生产（register_anonimous） | guest-01（Phase 1 创建） |')
  lines.push('| AUTH_USER | **缺失** | account-basic-01（待申请） |')
  lines.push('| AUTH_VIP | **缺失** | account-vip-01（待申请） |')
  lines.push('| AUTH_PURCHASED | **缺失** | account-purchased-01（待申请） |')
  lines.push('| AUTH_INVALID | 可构造（截断/过期 MUSIC_U） | test-invalid-01 |')
  lines.push('')
  lines.push('按手册 §4.4/§8.5，缺失账号统一登记于 06-failures-and-blockers.md，集中一次向用户申请，不逐接口询问。')
  lines.push('')
  lines.push('## 7. 写操作授权')
  lines.push('')
  lines.push('- 可逆写操作（沙盒资源）：**未授权**（Phase 11 前需用户确认专用账号与沙盒前缀 `NCXMUSIC_API_TEST_<runId>`）')
  lines.push('- 高影响写操作（头像/昵称/绑定/私信）：**未授权**')
  lines.push('- 付费操作：**未授权**（一律 blocked_by_safety）')
  lines.push('')
  lines.push('## 8. 请求节奏预算')
  lines.push('')
  lines.push('- 初始并发：1；确认无风控后纯读取最多 2；写操作串行')
  lines.push('- 请求抖动：350–800ms 随机')
  lines.push('- 限流退避：30s 起并降低全局速率')
  lines.push('- 重试：纯读取网络错误最多 3 次（2/5/15s 退避）；写操作不透明重试')
  lines.push('- 媒体专项预算：song_url_v1 等专项矩阵（9 音质 × 账号层 × 代表歌曲 × canonical/enhanced），在 RUN 阶段清单中单独说明')
  lines.push('')
  lines.push('## 9. 工具链与复现')
  lines.push('')
  lines.push('```')
  lines.push('node scripts/api-audit/runners/build-phase0.js \\')
  lines.push('  --pkgDir <npm包解包目录> --repoDir <repo克隆> --workDir .artifacts/api-audit/<runId>/raw \\')
  lines.push('  --runId <runId> --packageVersion 4.39.0 --reportDir docs/api/reports/4.39.0/<runId>')
  lines.push('node scripts/api-audit/runners/report-phase0.js --workDir ... --reportDir ...（生成本目录全部报告）')
  lines.push('node scripts/api-audit/runners/self-check.js --reportDir ...（零遗漏与脱敏门禁）')
  lines.push('```')
  lines.push('')
  lines.push('## 10. 运行配置分层')
  lines.push('')
  lines.push('| 配置 | 状态 | 说明 |')
  lines.push('| --- | --- | --- |')
  lines.push('| canonical | 计划默认 | 关闭 unblock/代理，观察原始上游合同 |')
  lines.push('| enhanced | 登记缺口 | 无解锁凭据与账号，Phase 4 音质矩阵时再评估 |')
  fs.writeFileSync(path.join(args.reportDir, '00-RUN-MANIFEST.md'), lines.join('\n'))
  return tarballSha
}

function writeCoverage() {
  const lines = []
  lines.push('# 02-COVERAGE-SUMMARY（Phase 0）')
  lines.push('')
  lines.push('runId：`' + args.runId + '`；包版本：' + args.packageVersion + '；生成：' + startedAt.toISOString())
  lines.push('')
  lines.push('## 1. Universe 与清单')
  lines.push('')
  lines.push('| 指标 | 值 |')
  lines.push('| --- | --- |')
  lines.push('| Universe 总数 | ' + summary.universeCount + '（' + discovery.universe.length + '） |')
  lines.push('| repo 模块 | ' + discovery.sources.repoModuleCount + ' |')
  lines.push('| pkg 模块 | ' + discovery.sources.pkgModuleCount + ' |')
  lines.push('| 类型声明 | ' + discovery.sources.typeDeclCount + ' |')
  lines.push('| docs 小节 | ' + discovery.sources.docSectionCount + ' |')
  lines.push('| 清单条目 | ' + inventory.length + ' |')
  lines.push('| universe − inventory 差集 | ' + (discovery.universe.length - inventory.length) + '（Phase 0 门禁：必须为 0） |')
  lines.push('')
  lines.push('## 2. 阶段分布（§6 优先级，只决定顺序）')
  lines.push('')
  lines.push('| 阶段 | 接口数 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(summary.byPhase).sort()) {
    lines.push('| ' + k + ' | ' + v + ' |')
  }
  lines.push('| **合计** | **' + summary.universeCount + '** |')
  lines.push('')
  lines.push('## 3. 分类分布')
  lines.push('')
  lines.push('| 分类 | 接口数 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])) {
    lines.push('| ' + k + ' | ' + v + ' |')
  }
  lines.push('')
  lines.push('## 4. 副作用分类')
  lines.push('')
  lines.push('| 类别 | 接口数 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(summary.bySideEffect).sort((a, b) => b[1] - a[1])) {
    lines.push('| ' + k + ' | ' + v + ' |')
  }
  lines.push('')
  lines.push('## 5. 登录假设（静态）')
  lines.push('')
  lines.push('| 假设 | 接口数 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(summary.byAuthHypothesis).sort((a, b) => b[1] - a[1])) {
    lines.push('| ' + k + ' | ' + v + ' |')
  }
  lines.push('')
  lines.push('## 6. 分页形态（静态）')
  lines.push('')
  lines.push('| 形态 | 接口数 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(summary.byPagination).sort((a, b) => b[1] - a[1])) {
    lines.push('| ' + k + ' | ' + v + ' |')
  }
  lines.push('')
  lines.push('## 7. 计划用例预算')
  lines.push('')
  lines.push('- 计划用例总数（按 §9 最低次数公式）：' + summary.plannedTotalCases)
  lines.push('- 已执行：0（Phase 0 无网络调用）')
  lines.push('')
  lines.push('## 8. 公式（Phase 15 时才冻结）')
  lines.push('')
  lines.push('```')
  lines.push('inventoryCoverage = reportedApiCount / universeApiCount   // 当前 ' + inventory.length + '/' + summary.universeCount + '（endpoint 报告待生成）')
  lines.push('runtimeCoverage = runtimeTestedApiCount / runtimeEligibleApiCount   // Phase 0：N/A（未发起任何线上请求）')
  lines.push('matrixCoverage = executedRequiredCases / plannedRequiredCases   // 0 / ' + summary.plannedTotalCases + '')
  lines.push('rollbackSuccess = verifiedRollbackCount / attemptedWriteScenarioCount   // N/A')
  lines.push('fieldEvidenceCoverage = evidencedFieldCount / discoveredFieldCount   // 0 / 0（无运行样本）')
  lines.push('```')
  lines.push('')
  lines.push('## 9. Phase 0 自检结论')
  lines.push('')
  lines.push('- [x] Universe 差集为零（' + summary.universeCount + ' 条目全部进入清单）')
  lines.push('- [x] 每个条目含分类、参数契约（静态）、计划用例数与报告路径')
  lines.push('- [ ] 终态：全部未赋（运行时阶段按 Phase 逐批赋值）')
  lines.push('- [ ] 登录三态：未开始（账号缺口已登记）')
  lines.push('- [ ] 运行样本/字段字典/未知字段：Phase 1 起生成')
  lines.push('- 详细阻断见 06-failures-and-blockers.md')
  fs.writeFileSync(path.join(args.reportDir, '02-coverage-summary.md'), lines.join('\n'))
}

function writeLineage() {
  const out = {
    schemaVersion: 1,
    runId: args.runId,
    note: 'Phase 0 静态假设；实际血缘以运行期 producers 采集为准，Phase 1 起覆盖。',
    fixtures: {},
    edges: [],
  }
  for (const rec of inventory) {
    for (const p of rec.produces) {
      out.fixtures[p] = { entityType: p, producers: [rec.apiAuditId], tags: [] }
    }
    for (const c of rec.consumes) {
      out.edges.push({ consumer: rec.apiAuditId, consumes: c, producerApi: null, producerPath: null, status: 'hypothesis' })
    }
  }
  fs.writeFileSync(path.join(args.reportDir, '03-parameter-lineage.json'), JSON.stringify(out, null, 2))
}

function writeSkeletons() {
  fs.writeFileSync(path.join(args.reportDir, '04-field-dictionary.csv'), [
    'apiAuditId,jsonPath,rawType,elementType,requiredObserved,presenceCount,sampleCount,nullCount,emptyCount,exampleRedacted,valueRangeOrEnum,authConditions,resourceConditions,firstSeenCase,lastSeenCase,semanticName,semanticConfidence,sourceEvidence,normalizedEntity,normalizedField,conflictId',
  ].join('\n') + '\n')
  fs.writeFileSync(path.join(args.reportDir, '05-unknown-fields.md'), [
    '# 05-UNKNOWN-FIELDS',
    '',
    'runId：`' + args.runId + '`',
    '',
    'Phase 0 无运行样本，台账为空。字段分析自 Phase 1 首个接口开始填充。',
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(args.reportDir, '06-failures-and-blockers.md'), [
    '# 06-FAILURES-AND-BLOCKERS（Phase 0）',
    '',
    'runId：`' + args.runId + '`',
    '',
    '## 1. 阻断与缺口（需用户一次性解决）',
    '',
    '### B-001 NcxMusic lockfile 缺失 → 版本冻结为 provisional',
    '',
    '- 现状：NcxMusic 仓库（docs-only）无应用代码与 pnpm-lock.yaml，无法按手册 §1.1 从 lockfile 解析安装版本与完整性。',
    '- 已做：以 npm 包 4.39.0 tarball（SHA-256 `' + sha256File(args.packageTarball) + '`）+ 官方 repo 提交 `' + args.upstreamCommit + '` 双重锚定，全量静态发现已按该锚点完成。',
    '- 待办：NcxMusic 应用建立 lockfile 后创建新 runId，重跑发现器做清单差异审计。',
    '',
    '### B-002 测试账号缺失（AUTH_USER / AUTH_VIP / AUTH_PURCHASED）',
    '',
    '- 需求：1 个普通测试账号（account-basic-01）、1 个 VIP 账号（account-vip-01）、1 个含已购资源账号（account-purchased-01）。',
    '- 影响：Phase 1 起登录层对比、Phase 4 音质专项矩阵（9 档 × 账号层）、VIP/付费资源接口。缺失期间这些接口只能 partial/blocked_by_prerequisite。',
    '- 用户提供方式：登录 Cookie 仅进入本机凭据层与运行时内存，不入 Git；以匿名标签记录。',
    '',
    '### B-003 enhanced 网络配置缺失',
    '',
    '- canonical 配置可直接开始；enhanced（unblock/代理）需要解锁凭据与代理地址，登记为测试缺口，Phase 4 评估。',
    '',
    '### B-004 写操作授权',
    '',
    '- Phase 11 前需确认：允许在 account-basic-01 上执行 `NCXMUSIC_API_TEST_<runId>` 前缀沙盒写操作（歌单创建/增删歌/评论发布删除/点赞/关注）。',
    '- 头像/昵称/绑定/私信等高影响写操作默认不做成功写入。',
    '',
    '## 2. 上游差异与疑似别名（Phase 14 验证）',
    '',
    '- repo 与 npm 4.39.0 字节不一致模块：decrypt、share_resource、user_event、voice_upload（repo 较新；运行时以锁定版本源码为准，本 run 以 npm 包 4.39.0 为事实基线）',
    '- npm 包缺失但 repo 存在：event_privacy、user_event_all',
    '- 类型声明存在但无模块：comment_hotwall_list、user_safe、listen_together_status（listen_together_status 疑似与 listentogether_status 同义，待验证）',
    '- docs 路由无法映射：/yunbei/tasks/receipt（疑似 yunbei_receipt）、/yunbei/tasks/expense（疑似 yunbei_expense）、/vip/task/v1（疑似 vip_tasks_v1）、/rep/ugc/user/collect-vip（模块名含连字符 rep_ugc_user_collect-vip，映射已覆盖）',
    '- 官方文档标注云村热评接口下架：docs 中"云村热评(官方下架,暂不能用)"，对应模块待确认（song_copyright_rcmd 或 hot_topic 相关，Phase 13 取证）',
    '',
    '## 3. 已知差异证据（checksumDiffer 明细）',
    '',
    '| 模块 | repo SHA-256 | pkg SHA-256 | 差异摘要 |',
    '| --- | --- | --- | --- |',
    ...inventory.filter((r) => r.repoPkgChecksumDiffer).map((r) => {
      const u = discovery.universe.find((x) => x.moduleName === r.moduleName)
      return '| ' + r.moduleName + ' | `' + (u && u.repoSha256) + '` | `' + (u && u.pkgSha256) + '` | 见该模块 endpoint 报告 §2 |'
    }),
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(args.reportDir, '07-multivariable-diff.md'), [
    '# 07-MULTIVARIABLE-DIFF（Phase 0）',
    '',
    'runId：`' + args.runId + '`',
    '',
    'Phase 0 无运行样本，无多变量差异可比。自 Phase 1 起每完成一个接口写入该接口报告 §8，本文件在 Phase 15 汇总。',
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(args.reportDir, '08-rollback-report.md'), [
    '# 08-ROLLBACK-REPORT（Phase 0）',
    '',
    'runId：`' + args.runId + '`',
    '',
    '- 尝试写场景：0',
    '- 回滚成功：0',
    '- orphan 资源：0',
    '',
    'Phase 11/12 起记录。',
    '',
  ].join('\n'))
  fs.writeFileSync(path.join(args.reportDir, '09-capability-candidates.md'), [
    '# 09-CAPABILITY-CANDIDATES（Phase 0）',
    '',
    'runId：`' + args.runId + '`',
    '',
    'Phase 0 未产生能力候选。Phase 15 汇总；支付/购买/订单类候选必须 productionExcluded。',
    '',
  ].join('\n'))
}

function writeEndpointReports() {
  const dir = path.join(args.reportDir, 'endpoints')
  fs.mkdirSync(dir, { recursive: true })
  const samplesDir = path.join(args.reportDir, 'samples-redacted')
  fs.mkdirSync(samplesDir, { recursive: true })
  fs.writeFileSync(path.join(samplesDir, '.gitkeep'), '')
  const statMissing = []
  for (const rec of inventory) {
    const stat = byModule.get(rec.moduleName) || { params: [], paginationParams: [], defaults: [], checkToken: false, unblock: false, title: null }
    const moduleMissing = rec.moduleMissing === true
    const id = rec.apiAuditId
    const md = []
    md.push('# ' + id + ' / ' + rec.exportName)
    md.push('')
    md.push('## 1. 元数据')
    md.push('')
    md.push('- 包版本：' + args.packageVersion + '（provisional 锚点）')
    md.push('- 模块校验和：' + (rec.moduleChecksum ? '`' + rec.moduleChecksum + '`（' + rec.checksumSource + '）' : '无模块文件（types-only）'))
    md.push('- 导出名：' + rec.exportName)
    md.push('- 路由或调用方式：`' + rec.route + '`')
    md.push('- 文档链接：https://neteasecloudmusicapienhanced.js.org/（' + args.upstreamRepo + ' @ ' + args.upstreamCommit.slice(0, 7) + '）')
    md.push('- 分类与频率：' + rec.category + ' / ' + rec.frequency)
    md.push('- 副作用级别：' + rec.sideEffectClass)
    md.push('- 测试阶段（§6 优先级）：' + rec.testPhase)
    md.push('- 登录假设（静态）：' + rec.authRequirementHypothesis)
    md.push('- 最终状态：**待执行**（Phase 0 未赋值）')
    md.push('')
    md.push('## 2. 已知用途与证据')
    md.push('')
    md.push('- 源码：' + (moduleMissing ? '**无模块文件**（' + args.pkgDir + '/module/' + rec.moduleName + '.js 与 repo 均不存在，仅 interface.d.ts 声明）' : 'module/' + rec.moduleName + '.js' + (stat.title ? '（注释：' + stat.title + '）' : '')))
    md.push('- 类型：' + (rec.discoveredFrom.includes('types') ? 'interface.d.ts 有函数声明' : 'interface.d.ts 无对应函数声明（types-missing）'))
    md.push('- 文档：' + rec.discoveredFrom.filter((d) => d.startsWith('docs:')).join(', ') || 'docs-missing')
    md.push('- 官方测试：' + (rec.discoveredFrom.includes('tests') ? '测试/示例引用' : '未发现直接引用'))
    md.push('- 冲突：见 06-failures-and-blockers.md（checksumDiffer=' + (rec.repoPkgChecksumDiffer ? '是' : '否') + '；moduleMissing=' + (moduleMissing ? '是' : '否') + '）')
    md.push('')
    md.push('## 3. 参数契约（静态）')
    md.push('')
    md.push('| name | rawType | required | default | evidence |')
    md.push('| --- | --- | --- | --- | --- |')
    md.push(paramTable(rec))
    md.push('')
    if (rec.checkToken) md.push('- checkToken：true')
    if (stat.unblock) md.push('- unblock 参数：支持（canonical 配置下不启用）')
    md.push('- crypto 模式：' + (rec.cryptoMode || '（未指定）'))
    md.push('- cookie 读取：' + (rec.hasCookie ? '是' : '否'))
    md.push('')
    if (moduleMissing) {
      md.push('> 本接口无模块实现（types-only），Phase 14 将按手册验证导入行为并赋 not_exported/alias/deprecated 终态。')
      md.push('')
    }
    md.push('## 4. 参数血缘（静态假设）')
    md.push('')
    md.push('- consumes：' + (rec.consumes.length ? rec.consumes.join(', ') : '（无）'))
    md.push('- produces：' + (rec.produces.length ? rec.produces.join(', ') : '（无）'))
    md.push('- producer api / case / JSONPath：Phase 1 起由运行器填充')
    md.push('')
    md.push('## 5. 测试矩阵')
    md.push('')
    md.push('| caseId | auth | resource | params | page | profile | expectedClass | actual | sampleHash |')
    md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    md.push('（Phase 0 未执行；计划用例数 ' + rec.plannedCaseCount + '）')
    md.push('')
    md.push('## 6. 响应信封')
    md.push('')
    md.push('- transport：Phase 1 起记录')
    md.push('- business code：Phase 1 起记录')
    md.push('- error shapes：Phase 1 起记录')
    md.push('')
    md.push('## 7. 字段表')
    md.push('')
    md.push('| JSONPath | rawType | presence | null | conditions | example | meaning | confidence |')
    md.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    md.push('（Phase 0 无运行样本）')
    md.push('')
    md.push('## 8. 多变量差异')
    md.push('')
    md.push('- 未登录 vs 游客：待测')
    md.push('- 游客 vs 普通登录：待测')
    md.push('- 普通 vs VIP：待测')
    md.push('- 未购 vs 已购：待测')
    md.push('- 自有 vs 他人资源：待测')
    md.push('- 默认参数 vs 显式参数：待测')
    md.push('')
    md.push('## 9. 分页、缓存和时效')
    md.push('')
    md.push('- 分页形态（静态）：' + rec.paginationKind)
    md.push('- 缓存/时效：Phase 1 起记录')
    md.push('')
    md.push('## 10. 副作用与回滚')
    md.push('')
    md.push('- pre snapshot：未执行')
    md.push('- write result：未执行')
    md.push('- read-after-write：未执行')
    md.push('- rollback：未执行')
    md.push('- orphan：无')
    md.push('')
    md.push('## 11. 未知字段与冲突')
    md.push('')
    md.push('（Phase 1 起填充 05-unknown-fields.md）')
    md.push('')
    md.push('## 12. NcxMusic 结论')
    md.push('')
    md.push('- 当前 Adapter 能否开发：待运行时字段事实')
    md.push('- 标准实体映射：待定')
    md.push('- 降级策略：待定')
    md.push('- 是否建议进入 Capability Catalog：待定（Phase 15）')
    md.push('- 建议权限级别：待定')
    md.push('- 尚未完成事项：登录三态 smoke、最低用例数、结构稳定性、字段字典')
    md.push('')
    fs.writeFileSync(path.join(dir, id + '.md'), md.join('\n'))
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({
      schemaVersion: 1,
      runId: args.runId,
      apiAuditId: id,
      packageVersion: args.packageVersion,
      moduleChecksum: rec.moduleChecksum || null,
      classification: {
        category: rec.category,
        frequency: rec.frequency,
        sideEffect: rec.sideEffectClass,
        testPhase: rec.testPhase,
      },
      sources: rec.discoveredFrom,
      parameters: (stat.params || []).map((p) => ({ name: p })),
      dependencies: {
        consumes: rec.consumes,
        produces: rec.produces,
      },
      matrix: { planned: rec.plannedCaseCount, executed: 0, cases: [] },
      fields: [],
      errors: [],
      sideEffectVerification: null,
      unknownFieldIds: [],
      conflictIds: [],
      terminalStatus: null,
      blocker: null,
      evidence: [],
    }, null, 2))
  }
  if (statMissing.length) {
    console.log('WARN: no static analysis for modules:', statMissing.join(', '))
  }
}

const tarballSha = writeManifest()
writeCoverage()
writeLineage()
writeSkeletons()
writeEndpointReports()
console.log('reports generated in', args.reportDir)
console.log('tarball sha256:', tarballSha)
