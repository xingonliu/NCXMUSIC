# NcxMusic API 审计工具链

执行合同：`docs/api/NcxMusic-API-First-Full-Audit-Playbook.md`

本目录只提交源码与生成脚本；`.artifacts/`（raw 层）不入库。

## 布局

    scripts/api-audit/
      lib/args.js               CLI 参数解析（零依赖）
      inventory/discover.js     全量发现：module 枚举+SHA-256、types、docs 路由、tests → Universe 并集
      analyzers/static-analyze.js  每模块静态分析：URL、crypto、参数读取、默认值、cookie、本地合成
      analyzers/classify.js     分类与计划矩阵：category/frequency/sideEffect/testPhase/auth/pagination/用例数
      runners/build-phase0.js   编排：发现+分析+分类 → 01-api-inventory.csv/json
      runners/report-phase0.js  生成 00 清单、02-09 报告、endpoints/*.md+json
      runners/self-check.js     零遗漏与脱敏门禁（universe=inventory=reports，secret scan）
      redaction/secret-scan.js  字段名+值形态秘密扫描（Phase 1 起扩展样本层熵扫描）

## 典型运行（以 Phase 0 为例）

    node scripts/api-audit/runners/build-phase0.js ^
      --pkgDir <npm包解包目录> --repoDir <官方仓库克隆@锚定提交> ^
      --workDir .artifacts/api-audit/<runId>/raw ^
      --runId <runId> --packageVersion 4.39.0 ^
      --reportDir docs/api/reports/4.39.0/<runId>
    node scripts/api-audit/runners/report-phase0.js --workDir ... --runId ... --packageVersion ... --reportDir ... --packageTarball ... --upstreamCommit ... --upstreamRepo ...
    node scripts/api-audit/runners/self-check.js --workDir ... --reportDir ... --phase 0

## 纪律

- 发现器与静态分析只建立假设；字段事实以锁定版本运行样本为准。
- 每次 NcxMusic lockfile 变化或上游依赖升级后，重跑发现器，以清单差异驱动增量审计。
- 秘密扫描通过前不得提交任何报告；原始响应只进 `.artifacts/`。
